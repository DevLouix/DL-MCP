## DL-MCP Enterprise Filesystem Server

### Downloads

| Platform | File | Size |
|----------|------|------|
| Linux (x64) | `dl-mcp-linux` | Binary |
| macOS (arm64) | `dl-mcp-macos` | Binary |
| Windows (x64) | `dl-mcp-win.exe` | Binary |
| Cross-platform | `dl-mcp-bundle.tar.gz` | Node.js bundle (all platforms) |
| Cross-platform | `dl-mcp-bundle.zip` | Node.js bundle (all platforms) |

### Quick Start

```bash
# 1. Download for your platform
chmod +x dl-mcp-linux

# 2. Create .env file
echo 'WORKSPACE_ROOT=.
PORT=3544
AUTH_TOKEN=your-secret-token' > .env

# 3. Run
./dl-mcp-linux
```

### Node.js Bundle (alternative)

```bash
# Requires Node.js 20+
node dl-mcp-bundle.cjs
```

### Docker (coming soon)

### Changelog
