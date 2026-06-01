import * as fs from "node:fs/promises";
import * as path from "node:path";
import { safeResolve } from "../security/workspace.js";
import { isBinaryBuffer } from "../utils/file.js";
import { config } from "../config/env.js";
import { textContent, errorContent } from "../types/index.js";
const RE_PATTERN_MAX_LENGTH = 200;
function isRegexSafe(pattern) {
    if (pattern.length > RE_PATTERN_MAX_LENGTH)
        return false;
    const nestedQuantifiers = /\(.+\)(\+|\*|\{.*,.*\})\s*(\+|\*|\{.*,.*\})/;
    if (nestedQuantifiers.test(pattern))
        return false;
    try {
        const re = new RegExp(pattern);
        const testInput = "x".repeat(50);
        const start = performance.now();
        re.test(testInput);
        return performance.now() - start < 100;
    }
    catch {
        return false;
    }
}
export async function handleSearchGrep(pattern, scopePath, caseSensitive, ignoredPaths, workspaceRoot, maxFileSize) {
    try {
        if (!isRegexSafe(pattern)) {
            return errorContent("Invalid or unsafe search pattern. Patterns must be under 200 characters and not cause excessive backtracking.");
        }
        const startPath = await safeResolve(scopePath);
        const filesToInspect = [];
        async function walk(currentDir, depth = 0) {
            if (depth > config.searchMaxDepth || filesToInspect.length >= config.searchMaxFiles)
                return;
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                if (ignoredPaths.has(entry.name))
                    continue;
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath, depth + 1);
                }
                else if (entry.isFile()) {
                    filesToInspect.push(fullPath);
                }
            }
        }
        await walk(startPath);
        const matches = [];
        const CHUNK_SIZE = 32;
        const regexp = new RegExp(pattern, caseSensitive ? "" : "i");
        for (let i = 0; i < filesToInspect.length; i += CHUNK_SIZE) {
            const chunk = filesToInspect.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (file) => {
                try {
                    const stats = await fs.stat(file);
                    if (stats.size > maxFileSize)
                        return;
                    const buffer = await fs.readFile(file);
                    if (isBinaryBuffer(buffer))
                        return;
                    const text = buffer.toString("utf-8");
                    if (!regexp.test(text))
                        return;
                    const lines = text.split(/\r?\n/);
                    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                        if (matches.length >= config.searchMaxMatches)
                            return;
                        const lineText = lines[lineIndex];
                        if (regexp.test(lineText)) {
                            matches.push({
                                file: path.relative(workspaceRoot, file),
                                line: lineIndex + 1,
                                text: lineText.trim(),
                            });
                        }
                    }
                }
                catch { }
            }));
            if (matches.length >= config.searchMaxMatches)
                break;
        }
        return {
            content: [textContent(JSON.stringify(matches, null, 2))],
        };
    }
    catch (err) {
        return errorContent(`Error executing grep search: ${err.message}`);
    }
}
//# sourceMappingURL=search.js.map