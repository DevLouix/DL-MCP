import * as fs from "node:fs/promises";
import * as path from "node:path";
import { safeResolve } from "../security/workspace.js";
import { textContent, errorContent } from "../types/index.js";
export async function handleListDirectory(relPath, recursive, ignoredPaths, workspaceRoot) {
    try {
        const rootPath = await safeResolve(relPath);
        const results = [];
        let fileCount = 0;
        async function scan(currentPath, depth = 0) {
            if (depth > 3 || fileCount >= 1000)
                return;
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                if (ignoredPaths.has(entry.name))
                    continue;
                fileCount++;
                if (fileCount >= 1000)
                    break;
                const fullPath = path.join(currentPath, entry.name);
                const relativeToRoot = path.relative(rootPath, fullPath);
                let size = 0;
                let mtime = "";
                try {
                    const stats = await fs.stat(fullPath);
                    size = stats.size;
                    mtime = stats.mtime.toISOString();
                }
                catch { }
                results.push({
                    name: relativeToRoot || entry.name,
                    type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
                    size,
                    lastModified: mtime,
                });
                if (recursive && entry.isDirectory()) {
                    await scan(fullPath, depth + 1);
                }
            }
        }
        await scan(rootPath);
        return {
            content: [textContent(JSON.stringify(results, null, 2))],
        };
    }
    catch (err) {
        return errorContent(`Error listing directory: ${err.message}`);
    }
}
export async function handleCreateDirectory(relPath) {
    try {
        const targetPath = await safeResolve(relPath);
        await fs.mkdir(targetPath, { recursive: true });
        return {
            content: [textContent(`Successfully created directory structure: ${relPath}`)],
        };
    }
    catch (error) {
        return errorContent(`Error creating directory: ${error.message}`);
    }
}
