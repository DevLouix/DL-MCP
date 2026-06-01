import type pino from "pino";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolResult = CallToolResult;

export function textContent(text: string): { type: "text"; text: string } {
  return { type: "text" as const, text };
}

export function errorContent(text: string): ToolResult {
  return { isError: true, content: [textContent(text)] } as ToolResult;
}

export interface DirectoryEntry {
  name: string;
  type: string;
  size: number;
  lastModified: string;
}

export interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

export interface FileInfo {
  name: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  created: string;
  lastModified: string;
  lastAccessed: string;
  mode: string;
}

export type Logger = pino.Logger;
