# CodePilot

Multi-model AI agent desktop client (Electron + Next.js). Connect any provider, extend with MCP & skills, remote bridge, assistant workspace.

[![GitHub release](https://img.shields.io/github/v/release/erbanku/CodePilot)](https://github.com/erbanku/CodePilot/releases)
[![Downloads](https://img.shields.io/github/downloads/erbanku/CodePilot/total)](https://github.com/erbanku/CodePilot/releases)
[![License](https://img.shields.io/badge/license-BSL--1.1-orange)](LICENSE)

[中文](./README_CN.md) | [日本語](./README_JA.md) | [Docs](https://www.codepilot.sh/docs)

## Download

| Platform | Download                                                                                                                              | Arch        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| macOS    | [Apple Silicon](https://github.com/erbanku/CodePilot/releases/latest) · [Intel](https://github.com/erbanku/CodePilot/releases/latest) | arm64 / x64 |
| Windows  | [Installer](https://github.com/erbanku/CodePilot/releases/latest)                                                                     | x64 + arm64 |
| Linux    | Build from source                                                                                                                     | x64 + arm64 |

## Quick Start

**Release:** download → Settings > Providers → add API key → chat.

**From source** (Node 18+):

```bash
git clone https://github.com/erbanku/CodePilot.git
cd CodePilot
npm install
npm run electron:dev   # or: npm run dev
```

Optional: `npm install -g @anthropic-ai/claude-code` for file edit / terminal / git tools.

## Features

- 17+ providers (Anthropic, OpenRouter, Bedrock, Vertex, Chinese APIs, Ollama, custom)
- MCP (stdio / sse / http) + skills marketplace
- Bridge: Telegram / Feishu / Discord / QQ / WeChat
- Assistant workspace, generative UI, media studio, task scheduler
- Session pause / resume / rewind, split screen, usage analytics

## Docs

- [Installation](https://www.codepilot.sh/docs/installation) · [Providers](https://www.codepilot.sh/docs/providers) · [MCP](https://www.codepilot.sh/docs/mcp) · [Skills](https://www.codepilot.sh/docs/skills) · [Bridge](https://www.codepilot.sh/docs/bridge) · [FAQ](https://www.codepilot.sh/docs/faq)
- [ARCHITECTURE.md](./ARCHITECTURE.md)

## Contributing

```bash
npm install && npm run electron:dev
npm run test   # before PR
```

[Issues](https://github.com/erbanku/CodePilot/issues) · [Discussions](https://github.com/erbanku/CodePilot/discussions)

## License

[BSL-1.1](LICENSE) — personal / academic / non-profit free; commercial use needs a separate license. Converts to Apache 2.0 on 2029-03-16.
