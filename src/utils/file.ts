import * as fs from "node:fs/promises";
import * as path from "node:path";

const TEMP_PREFIX = ".tmp.";

export function isBinaryBuffer(buffer: Buffer): boolean {
  for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
    const charCode = buffer[i];
    if (charCode === 0 || (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13)) {
      return true;
    }
  }
  return false;
}

export async function writeAtomic(targetPath: string, content: string): Promise<void> {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `${TEMP_PREFIX}${Math.random().toString(36).slice(2, 9)}`);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tempPath, content, "utf-8");
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch { }
    throw error;
  }
}
