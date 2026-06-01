import * as fs from "node:fs/promises";
import * as path from "node:path";
import { safeResolve } from "../security/workspace.js";
import { textContent, errorContent } from "../types/index.js";
export async function handleGetFileInfo(relPath) {
    try {
        const target = await safeResolve(relPath);
        const stats = await fs.stat(target);
        const info = {
            name: path.basename(target),
            size: stats.size,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            isSymbolicLink: stats.isSymbolicLink(),
            created: stats.birthtime.toISOString(),
            lastModified: stats.mtime.toISOString(),
            lastAccessed: stats.atime.toISOString(),
            mode: stats.mode.toString(8),
        };
        return {
            content: [textContent(JSON.stringify(info, null, 2))],
        };
    }
    catch (err) {
        return errorContent(`Error retrieving file info: ${err.message}`);
    }
}
