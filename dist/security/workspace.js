import * as fs from "node:fs/promises";
import * as path from "node:path";
let workspaceRoot = "";
export function setWorkspaceRoot(root) {
    workspaceRoot = root;
}
export async function safeResolve(inputPath) {
    if (!inputPath || inputPath === "/") {
        return path.resolve(workspaceRoot);
    }
    const absolutePath = path.isAbsolute(inputPath)
        ? path.resolve(inputPath)
        : path.resolve(workspaceRoot, inputPath);
    const [canonicalWorkspace, canonicalTarget] = await Promise.all([
        fs.realpath(workspaceRoot).catch(() => path.resolve(workspaceRoot)),
        fs.realpath(absolutePath).catch(() => null),
    ]);
    if (canonicalTarget) {
        const isWithin = canonicalTarget === canonicalWorkspace
            || canonicalTarget.startsWith(canonicalWorkspace + path.sep);
        if (!isWithin) {
            throw new Error(`Access Denied: Path "${inputPath}" points outside the authorized workspace boundary.`);
        }
        return canonicalTarget;
    }
    let parentDir = path.dirname(absolutePath);
    while (parentDir !== path.dirname(parentDir)) {
        try {
            const canonicalParent = await fs.realpath(parentDir);
            const isWithin = canonicalParent === canonicalWorkspace
                || canonicalParent.startsWith(canonicalWorkspace + path.sep);
            if (!isWithin) {
                throw new Error(`Access Denied: The destination parent directory is outside the workspace.`);
            }
            return absolutePath;
        }
        catch {
            parentDir = path.dirname(parentDir);
        }
    }
    throw new Error("Access Denied: Unable to establish path security context.");
}
//# sourceMappingURL=workspace.js.map