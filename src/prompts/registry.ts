import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { handleAnalyzeProject, handleExplainFile, handleReviewChanges, handleGenerateReadme } from "./handlers.js";
import type { Logger } from "../types/index.js";

function withAuditLog(
  promptName: string,
  handler: (args: any) => Promise<GetPromptResult>,
  logger: Logger,
): (args: any) => Promise<GetPromptResult> {
  return async (args) => {
    const start = Date.now();
    try {
      const result = await handler(args);
      logger.info({
        prompt: promptName,
        args,
        durationMs: Date.now() - start,
        messageCount: result.messages?.length,
      }, "Prompt succeeded");
      return result;
    } catch (err: any) {
      logger.error({
        prompt: promptName,
        args,
        durationMs: Date.now() - start,
        error: err.message,
      }, "Prompt threw unexpectedly");
      throw err;
    }
  };
}

export function registerAllPrompts(server: McpServer, logger: Logger): void {
  server.registerPrompt(
    "analyze_project",
    {
      title: "Analyze Project",
      description: "Analyzes the entire project structure, detects technologies used, and provides a comprehensive summary with key files and architecture insights.",
      argsSchema: {
        path: z.string().default("").describe("Relative sub-path to limit the analysis scope"),
      },
    },
    withAuditLog("analyze_project", handleAnalyzeProject, logger),
  );

  server.registerPrompt(
    "explain_file",
    {
      title: "Explain File",
      description: "Explains a specific file's purpose, implementation details, and how it fits into the broader project architecture.",
      argsSchema: {
        path: z.string().describe("Relative path of the file to explain"),
      },
    },
    withAuditLog("explain_file", handleExplainFile, logger),
  );

  server.registerPrompt(
    "review_changes",
    {
      title: "Review Changes",
      description: "Reviews recent uncommitted git changes in the workspace, summarizing what was modified, added, or deleted with impact analysis.",
      argsSchema: {
        path: z.string().default("").describe("Optional relative sub-path to limit review scope"),
      },
    },
    withAuditLog("review_changes", handleReviewChanges, logger),
  );

  server.registerPrompt(
    "generate_readme",
    {
      title: "Generate README",
      description: "Generates a comprehensive README.md for the project or a specific file, with descriptions, usage instructions, and API documentation.",
      argsSchema: {
        path: z.string().default("").describe("Relative path to focus the README on (defaults to project root)"),
      },
    },
    withAuditLog("generate_readme", handleGenerateReadme, logger),
  );
}
