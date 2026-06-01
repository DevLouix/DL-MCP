import * as fs from "node:fs/promises";
import * as path from "node:path";
import { safeResolve } from "../security/workspace.js";
import { isBinaryBuffer } from "../utils/file.js";
import type { ToolResult, GrepMatch } from "../types/index.js";
import { textContent, errorContent } from "../types/index.js";

export async function handleSearchGrep(
  pattern: string,
  scopePath: string,
  caseSensitive: boolean,
  ignoredPaths: Set<string>,
  workspaceRoot: string,
  maxFileSize: number,
): Promise<ToolResult> {
  try {
    const startPath = await safeResolve(scopePath);
    const filesToInspect: string[] = [];

    async function walk(currentDir: string, depth = 0) {
      if (depth > 12 || filesToInspect.length >= 2000) return;
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (ignoredPaths.has(entry.name)) continue;
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          filesToInspect.push(fullPath);
        }
      }
    }

    await walk(startPath);

    const matches: GrepMatch[] = [];
    const CHUNK_SIZE = 32;

    for (let i = 0; i < filesToInspect.length; i += CHUNK_SIZE) {
      const chunk = filesToInspect.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (file) => {
          try {
            const stats = await fs.stat(file);
            if (stats.size > maxFileSize) return;

            const buffer = await fs.readFile(file);
            if (isBinaryBuffer(buffer)) return;

            const text = buffer.toString("utf-8");
            if (!new RegExp(pattern, caseSensitive ? "" : "i").test(text)) return;

            const lines = text.split(/\r?\n/);
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
              const lineText = lines[lineIndex];
              if (new RegExp(pattern, caseSensitive ? "" : "i").test(lineText)) {
                matches.push({
                  file: path.relative(workspaceRoot, file),
                  line: lineIndex + 1,
                  text: lineText.trim(),
                });
                if (matches.length >= 250) return;
              }
            }
          } catch { }
        })
      );

      if (matches.length >= 250) break;
    }

    return {
      content: [textContent(JSON.stringify(matches, null, 2))],
    };
  } catch (err: any) {
    return errorContent(`Error executing grep search: ${err.message}`);
  }
}
