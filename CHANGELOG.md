# Changelogs for CodePilot

> Created and Maintained by @erbanku and fellow AI agents

## 07/11/2026

- fix(updates): app update check now queries `erbanku/codepilot` GitHub Releases instead of `op7418/CodePilot`
- fix(runtime): Conflict check toggle (default off) now also suppresses Claude CLI multi-install scan/warnings in `/api/claude-status`, not only the preference-vs-actual drift banner (PR #5 gap)
- fix(platform): dedupe npm/bun wrapper vs `node_modules/@anthropic-ai/claude-code` realpath as one install (#623 false positive)
- chore: ignore `.vscode/`

## [0.38.4] - 2026-03-20

### Bug Fixes

- **#341**: Fixed Claude Code CLI not being recognized as a valid provider — `/api/setup` now checks `findClaudeBinary()` so the chat page no longer shows "no provider configured" when Claude Code CLI is available
- **#343/#346**: Fixed session crash when switching provider/model — server-side PATCH handler now auto-clears stale `sdk_session_id` when provider or model changes, preventing resume failures
- **#347**: Fixed default model always reverting to first model in list — introduced global default model setting that persists across sessions

### New Features

- **Global Default Model**: New setting in the provider page to choose a default model across all providers. New conversations automatically use this model. Existing conversations are not affected.
- **Default Model Indicator**: The model selector in the chat input now shows a "Default" tag next to the configured default model

### Improvements

- **Error Classification**: Session state errors (stale session, resume failed) are now correctly classified instead of being reported as provider configuration problems
- **Select Component**: Fixed Radix Select dropdown growing unbounded on scroll — now capped at 16rem with proper overflow scrolling
