import { z } from "zod";
import { handleListDirectory, handleCreateDirectory } from "./directory.js";
import { handleReadFile, handleWriteFile, handleEditFile, handleCopyFile, handleMoveFile, handleDeletePath } from "./file.js";
import { handleGetFileInfo } from "./info.js";
import { handleSearchGrep } from "./search.js";
import { handleHttpRequest } from "./http.js";
import { config } from "../config/env.js";
import { errorContent } from "../types/index.js";
function withAuditLog(toolName, handler, logger) {
    return async (params) => {
        const start = Date.now();
        try {
            const result = await handler(params);
            logger.info({
                tool: toolName,
                params,
                durationMs: Date.now() - start,
                success: !result.isError,
            }, result.isError ? "Tool returned error" : "Tool succeeded");
            return result;
        }
        catch (err) {
            logger.error({
                tool: toolName,
                params,
                durationMs: Date.now() - start,
                success: false,
                error: err.message,
            }, "Tool threw unexpectedly");
            return errorContent(`Internal error: ${err.message}`);
        }
    };
}
export function registerAllTools(server, logger) {
    server.registerTool("list_directory", {
        description: "Lists content of a directory. Supports controlled recursion.",
        inputSchema: {
            path: z.string().default("").describe("Relative path to inspect inside the workspace"),
            recursive: z.boolean().optional().default(false).describe("List all subdirectories recursively up to safety bounds"),
        },
    }, withAuditLog("list_directory", ({ path: relPath, recursive }) => handleListDirectory(relPath, recursive, config.ignoredPaths, config.workspaceRoot), logger));
    server.registerTool("read_file", {
        description: "Read the full contents of a text file inside the workspace root. Rejects files larger than 5MB.",
        inputSchema: {
            path: z.string().describe("Relative path to target file"),
        },
    }, withAuditLog("read_file", ({ path: relPath }) => handleReadFile(relPath, config.maxFileSize), logger));
    server.registerTool("get_file_info", {
        description: "Retrieves metadata and system statistics of a specific file or directory.",
        inputSchema: {
            path: z.string().describe("Relative path to inspect"),
        },
    }, withAuditLog("get_file_info", ({ path: relPath }) => handleGetFileInfo(relPath), logger));
    server.registerTool("write_file", {
        description: "Completely write or overwrite file content atomically. Automatically provisions parent paths.",
        inputSchema: {
            path: z.string().describe("Relative target destination"),
            content: z.string().describe("Plaintext content to write"),
        },
    }, withAuditLog("write_file", ({ path: relPath, content }) => handleWriteFile(relPath, content), logger));
    server.registerTool("edit_file", {
        description: "Apply precision updates to a file by exchanging an exact code search block with replacement blocks.",
        inputSchema: {
            path: z.string().describe("Relative target file path"),
            search: z.string().describe("The exact sequence to locate in the file"),
            replace: z.string().describe("The replacement sequence"),
        },
    }, withAuditLog("edit_file", ({ path: relPath, search, replace }) => handleEditFile(relPath, search, replace), logger));
    server.registerTool("copy_file", {
        description: "Copy a file within the workspace. Ensures both paths are sandboxed.",
        inputSchema: {
            source: z.string().describe("Relative path to original file"),
            destination: z.string().describe("Relative path to destination copy"),
        },
    }, withAuditLog("copy_file", ({ source, destination }) => handleCopyFile(source, destination), logger));
    server.registerTool("move_file", {
        description: "Move or rename a file or directory inside the workspace.",
        inputSchema: {
            source: z.string().describe("Relative path to source file/directory"),
            destination: z.string().describe("Relative destination path"),
        },
    }, withAuditLog("move_file", ({ source, destination }) => handleMoveFile(source, destination), logger));
    server.registerTool("delete_path", {
        description: "Deletes a path (recursive if directory) inside the workspace.",
        inputSchema: {
            path: z.string().describe("Relative path of the target to remove"),
        },
    }, withAuditLog("delete_path", ({ path: relPath }) => handleDeletePath(relPath), logger));
    server.registerTool("search_grep", {
        description: "Searches for matching strings or regex patterns within all text files in the workspace (ignoring binary files and system folders).",
        inputSchema: {
            pattern: z.string().describe("The string query or regex structure to match in file contents"),
            path: z.string().default("").describe("Optional relative sub-folder to limit search range"),
            caseSensitive: z.boolean().optional().default(false).describe("Set true to execute case-sensitive search"),
        },
    }, withAuditLog("search_grep", ({ pattern, path: scopePath, caseSensitive }) => handleSearchGrep(pattern, scopePath, caseSensitive, config.ignoredPaths, config.workspaceRoot, config.maxFileSize), logger));
    server.registerTool("create_directory", {
        description: "Create a new directory (recursively if needed) inside the workspace.",
        inputSchema: {
            path: z.string().describe("Relative path of directory to create"),
        },
    }, withAuditLog("create_directory", ({ path: relPath }) => handleCreateDirectory(relPath), logger));
    server.registerTool("make_http_request", {
        description: "Executes an HTTP request (GET, POST, etc.) to access websites, fetch raw HTML, or query external APIs.",
        inputSchema: {
            url: z.string().url().describe("The fully qualified HTTP/HTTPS URL to request"),
            method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional().default("GET").describe("The HTTP method to use"),
            headers: z.record(z.string(), z.string()).optional().describe("Optional key-value map of custom request headers"),
            body: z.string().optional().describe("Optional raw text or JSON string body for POST/PUT requests"),
        },
    }, withAuditLog("make_http_request", ({ url, method, headers, body }) => handleHttpRequest(url, method, headers, body, config.maxHttpResponseSize), logger));
}
//# sourceMappingURL=registry.js.map