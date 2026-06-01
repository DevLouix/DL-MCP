import * as fs from "node:fs/promises";
import * as path from "node:path";
import { config } from "../config/env.js";
import { safeResolve } from "../security/workspace.js";
function text(text) {
    return {
        messages: [{ role: "assistant", content: { type: "text", text } }],
    };
}
async function safeReadFile(filePath) {
    try {
        const resolved = await safeResolve(filePath);
        const stat = await fs.stat(resolved);
        if (!stat.isFile())
            return null;
        if (stat.size > config.maxFileSize)
            return `[File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB]`;
        return await fs.readFile(resolved, "utf-8");
    }
    catch {
        return null;
    }
}
export async function handleAnalyzeProject(args) {
    const targetPath = args.path || "";
    const resolved = await safeResolve(targetPath);
    const entries = [];
    try {
        const dir = await fs.readdir(resolved, { withFileTypes: true });
        for (const entry of dir) {
            if (config.ignoredPaths.has(entry.name))
                continue;
            entries.push(`${entry.name}${entry.isDirectory() ? "/" : ""}`);
        }
    }
    catch {
        return text(`Could not read directory: ${targetPath || "."}`);
    }
    const pkgJson = await safeReadFile(path.join(targetPath, "package.json"));
    const techStack = [];
    if (pkgJson) {
        try {
            const pkg = JSON.parse(pkgJson);
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps.typescript || deps["@types/node"])
                techStack.push("TypeScript");
            if (deps.react || deps["react-dom"])
                techStack.push("React");
            if (deps.express || deps.hono || deps.fastify)
                techStack.push(deps.express ? "Express" : deps.hono ? "Hono" : "Fastify");
            if (deps.next)
                techStack.push("Next.js");
            if (deps["@modelcontextprotocol/sdk"])
                techStack.push("MCP SDK");
        }
        catch { }
    }
    return text([
        `## Project Analysis: ${path.basename(resolved)}`,
        ``,
        techStack.length ? `**Tech Stack:** ${techStack.join(", ")}\n` : "",
        `**Location:** ${resolved}`,
        ``,
        `### Contents`,
        ``,
        "```",
        ...entries,
        "```",
        ``,
        pkgJson ? [
            `### Package Info`,
            ``,
            (() => {
                try {
                    const pkg = JSON.parse(pkgJson);
                    return [`**Name:** ${pkg.name || "N/A"}`, `**Version:** ${pkg.version || "N/A"}`, `**Description:** ${pkg.description || "N/A"}`].join("\n");
                }
                catch {
                    return "Invalid package.json";
                }
            })(),
        ].join("\n") : "",
        ``,
        `### Analysis`,
        ``,
        `This is a ${techStack.length > 0 ? `${techStack[0]} ` : ""}project at \`${resolved}\` containing ${entries.length} visible entries. Use more specific tools (read_file, list_directory, search_grep) to dive deeper into individual components.`,
    ].filter(Boolean).join("\n"));
}
export async function handleExplainFile(args) {
    const content = await safeReadFile(args.path);
    if (content === null) {
        return text(`Could not read file: ${args.path}`);
    }
    const ext = path.extname(args.path).toLowerCase();
    const langMap = {
        ".ts": "TypeScript", ".tsx": "TypeScript React", ".js": "JavaScript",
        ".jsx": "JavaScript React", ".py": "Python", ".rs": "Rust",
        ".go": "Go", ".java": "Java", ".rb": "Ruby", ".php": "PHP",
        ".c": "C", ".cpp": "C++", ".h": "C/C++ Header", ".cs": "C#",
        ".swift": "Swift", ".kt": "Kotlin", ".scala": "Scala",
        ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".xml": "XML",
        ".md": "Markdown", ".html": "HTML", ".css": "CSS", ".scss": "SCSS",
        ".sql": "SQL", ".sh": "Shell", ".bash": "Bash", ".zsh": "Zsh",
        ".dockerfile": "Dockerfile", ".tf": "Terraform",
    };
    const language = langMap[ext] || "Unknown";
    const lineCount = content.split("\n").length;
    return text([
        `## File: ${args.path}`,
        ``,
        `**Language:** ${language} | **Lines:** ${lineCount}`,
        ``,
        `### Overview`,
        ``,
        `This ${language} file (\`${args.path}\`) contains ${lineCount} lines of code. Below is its content for analysis:`,
        ``,
        "```" + (ext.replace(".", "") || ""),
        content.length > 10000 ? content.slice(0, 10000) + "\n\n... [truncated]" : content,
        "```",
        ``,
        `### Structure`,
        ``,
        extractStructure(content, ext),
    ].join("\n"));
}
function extractStructure(content, _ext) {
    const lines = content.split("\n");
    const exports = [];
    const classes = [];
    const functions = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^export\s+/.test(trimmed))
            exports.push(trimmed);
        if (/^class\s+\w+/.test(trimmed))
            classes.push(trimmed);
        if (/^function\s+\w+\s*\(/.test(trimmed) || /^const\s+\w+\s*=\s*(\(|async)/.test(trimmed)) {
            const match = trimmed.match(/^(?:export\s+)?(?:const\s+)?(\w+)\s*(?::|=[^=])/);
            if (match)
                functions.push(match[1]);
        }
    }
    const parts = [];
    if (exports.length > 0)
        parts.push(`**Exports:** ${exports.length}`);
    if (classes.length > 0)
        parts.push(`**Classes:** ${classes.length}`);
    if (functions.length > 0)
        parts.push(`**Functions/Consts:** ${functions.length}`);
    return parts.length > 0 ? parts.join(" | ") : "No significant structural elements detected.";
}
export async function handleReviewChanges(_args) {
    const gitDir = path.join(config.workspaceRoot, ".git");
    try {
        await fs.access(gitDir);
    }
    catch {
        return text("Not a git repository or .git not accessible.");
    }
    const { execSync } = await import("node:child_process");
    let diff;
    try {
        diff = execSync("git diff --stat", { cwd: config.workspaceRoot, encoding: "utf-8", maxBuffer: 1024 * 1024 });
    }
    catch {
        return text("Could not get git diff.");
    }
    let staged;
    try {
        staged = execSync("git diff --cached --stat", { cwd: config.workspaceRoot, encoding: "utf-8", maxBuffer: 1024 * 1024 });
    }
    catch {
        staged = "";
    }
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: config.workspaceRoot, encoding: "utf-8" }).trim();
    const lastCommit = execSync("git log -1 --oneline", { cwd: config.workspaceRoot, encoding: "utf-8", maxBuffer: 1024 * 1024 }).trim();
    const sections = [
        `## Code Review: ${branch}`,
        ``,
        `**Branch:** ${branch}`,
        `**Last Commit:** ${lastCommit}`,
        ``,
    ];
    if (staged.trim()) {
        sections.push(`### Staged Changes\n\`\`\`\n${staged}\n\`\`\`\n`);
    }
    if (diff.trim()) {
        sections.push(`### Unstaged Changes\n\`\`\`\n${diff}\n\`\`\``);
    }
    if (!diff.trim() && !staged.trim()) {
        sections.push("No changes detected. Working tree is clean.");
    }
    return text(sections.join("\n"));
}
export async function handleGenerateReadme(args) {
    const targetPath = args.path || "";
    const resolved = await safeResolve(targetPath);
    const stat = await fs.stat(resolved);
    const isFile = stat.isFile();
    const name = isFile ? path.basename(resolved) : path.basename(resolved);
    let pkg = null;
    const pkgContent = await safeReadFile(path.join(isFile ? path.dirname(targetPath) : targetPath, "package.json"));
    if (pkgContent) {
        try {
            pkg = JSON.parse(pkgContent);
        }
        catch { }
    }
    const entries = isFile ? [] : (await fs.readdir(resolved)).filter(e => !config.ignoredPaths.has(e));
    return text([
        `# ${name}`,
        ``,
        pkg?.description ? `> ${pkg.description}\n` : "",
        `## Overview`,
        ``,
        isFile
            ? `Documentation for \`${targetPath}\`. This is a ${path.extname(targetPath)} file within the project.`
            : `This is the root of \`${name}\`, a project containing ${entries.length} items${entries.length > 0 ? ` (${entries.slice(0, 15).join(", ")}${entries.length > 15 ? ", ..." : ""})` : ""}.`,
        ``,
        pkg ? [
            `## Installation`,
            ``,
            pkg.scripts?.start ? "```bash\nnpm start\n```\n" : "",
            pkg.scripts?.build ? "```bash\nnpm run build\n```\n" : "",
            pkg.scripts?.dev ? "```bash\nnpm run dev\n```\n" : "",
            `## Scripts`,
            ``,
            Object.entries(pkg.scripts || {}).map(([k, v]) => `- \`npm run ${k}\`: ${v}`).join("\n"),
        ].join("\n") : "",
        ``,
        `> Generated by DL-MCP Enterprise Filesystem Server`,
    ].filter(Boolean).join("\n"));
}
//# sourceMappingURL=handlers.js.map