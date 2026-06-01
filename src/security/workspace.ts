import * as fs from "node:fs/promises";
import * as path from "node:path";

let workspaceRoot = "";

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
}

export async function safeResolve(inputPath: string): Promise<string> {
  if (!inputPath || inputPath === "/") {
    return path.resolve(workspaceRoot);
  }

  const absolutePath = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(workspaceRoot, inputPath);

  const canonicalWorkspace = await fs.realpath(workspaceRoot);

  try {
    const canonicalTarget = await fs.realpath(absolutePath);

    const isWithin = canonicalTarget === canonicalWorkspace
      || canonicalTarget.startsWith(canonicalWorkspace + path.sep);

    if (!isWithin) {
      throw new Error(`Access Denied: Path "${inputPath}" points outside the authorized workspace boundary.`);
    }
    return canonicalTarget;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      let parentDir = path.dirname(absolutePath);
      let canonicalParent: string | null = null;

      while (parentDir !== path.dirname(parentDir)) {
        try {
          canonicalParent = await fs.realpath(parentDir);
          break;
        } catch {
          parentDir = path.dirname(parentDir);
        }
      }

      if (canonicalParent) {
        const isWithin = canonicalParent === canonicalWorkspace
          || canonicalParent.startsWith(canonicalWorkspace + path.sep);
        if (!isWithin) {
          throw new Error(`Access Denied: The destination parent directory is outside the workspace.`);
        }
      } else {
        throw new Error("Access Denied: Unable to establish path security context.");
      }
      return absolutePath;
    }
    throw err;
  }
}
