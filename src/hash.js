import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function hashBuffer(buffer) {
  return `0x${createHash("sha256").update(buffer).digest("hex")}`;
}

export async function hashFile(filePath) {
  return hashBuffer(await readFile(filePath));
}
