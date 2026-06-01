import * as fs from "node:fs/promises";
import * as path from "node:path";
import { safeResolve } from "../security/workspace.js";
import { writeAtomic, isBinaryBuffer } from "../utils/file.js";
import { textContent, errorContent } from "../types/index.js";
export async function handleReadFile(relPath, maxFileSize) {
    try {
        const target = await safeResolve(relPath);
        const stats = await fs.stat(target);
        if (stats.size > maxFileSize) {
            throw new Error(`File size (${(stats.size / 1024 / 1024).toFixed(2)}MB) exceeds safe ${(maxFileSize / 1024 / 1024)}MB limit.`);
        }
        const buffer = await fs.readFile(target);
        if (isBinaryBuffer(buffer)) {
            throw new Error("Target file contains raw binary data and cannot be read as text.");
        }
        return {
            content: [textContent(buffer.toString("utf-8"))],
        };
    }
    catch (err) {
        return errorContent(`Error reading file: ${err.message}`);
    }
}
export async function handleWriteFile(relPath, content) {
    try {
        const target = await safeResolve(relPath);
        await writeAtomic(target, content);
        return {
            content: [textContent(`Successfully wrote file: ${relPath}`)],
        };
    }
    catch (err) {
        return errorContent(`Error writing file: ${err.message}`);
    }
}
export async function handleEditFile(relPath, search, replace) {
    try {
        const target = await safeResolve(relPath);
        const fileContent = await fs.readFile(target, "utf-8");
        const occurrences = fileContent.split(search).length - 1;
        if (occurrences === 0) {
            throw new Error("Search block was not found anywhere in the target file.");
        }
        if (occurrences > 1) {
            throw new Error("Target block matches multiple locations in the file. Supply more unique context.");
        }
        const updated = fileContent.replace(search, replace);
        await writeAtomic(target, updated);
        return {
            content: [textContent(`Successfully updated ${relPath}`)],
        };
    }
    catch (err) {
        return errorContent(`Error editing file: ${err.message}`);
    }
}
export async function handleCopyFile(source, destination) {
    try {
        const resolvedSource = await safeResolve(source);
        const resolvedDest = await safeResolve(destination);
        await fs.mkdir(path.dirname(resolvedDest), { recursive: true });
        await fs.copyFile(resolvedSource, resolvedDest);
        return {
            content: [textContent(`Successfully copied from "${source}" to "${destination}"`)],
        };
    }
    catch (err) {
        return errorContent(`Error copying file: ${err.message}`);
    }
}
export async function handleMoveFile(source, destination) {
    try {
        const resolvedSource = await safeResolve(source);
        const resolvedDest = await safeResolve(destination);
        await fs.mkdir(path.dirname(resolvedDest), { recursive: true });
        await fs.rename(resolvedSource, resolvedDest);
        return {
            content: [textContent(`Successfully moved from "${source}" to "${destination}"`)],
        };
    }
    catch (err) {
        return errorContent(`Error moving path: ${err.message}`);
    }
}
export async function handleDeletePath(relPath) {
    try {
        const target = await safeResolve(relPath);
        const stats = await fs.stat(target);
        if (stats.isDirectory()) {
            await fs.rm(target, { recursive: true, force: true });
        }
        else {
            await fs.unlink(target);
        }
        return {
            content: [textContent(`Successfully deleted path: ${relPath}`)],
        };
    }
    catch (err) {
        return errorContent(`Error deleting path: ${err.message}`);
    }
}
//# sourceMappingURL=file.js.map