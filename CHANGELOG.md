# Changelog

## [1.2.2] — 2026-07-09

### Fixed

- Docs `--all` pagination (`docs article search/list`, `docs collection list`, and MCP list/search tools with `all: true`) returned no results — `docs.getAll()` now unwraps nested API envelopes such as `{ articles: { items, pages } }` instead of expecting top-level `items`
- MCP server failed for Docs API calls in Cursor and Cursor CLI because subprocesses do not inherit shell profile env vars — credentials are loaded from `~/.config/helpscout/env` at startup, `install.sh` seeds that file on first install, and Cursor registration includes `envFile`

## [1.2.1] — 2026-07-09

### Fixed

- `install.sh` no longer fails on re-run when the helpscout MCP server is already registered in Claude Code — `register-mcp.js` checks the existing config and skips when the command path is unchanged, or removes and re-adds when it needs updating

## [1.2.0] — 2026-07-09

### Added

- `scripts/register-mcp.js` — registers the MCP server with Claude Code (when `claude` is on PATH) and Cursor (when detected), merging into `~/.cursor/mcp.json` without clobbering other servers
- Unit tests for MCP registration merge logic, idempotency, and malformed-config handling

### Changed

- `install.sh` now uses `register-mcp.js` instead of calling `claude mcp add` directly; install succeeds when only one editor is present (or neither)

## [1.1.0] — 2026-07-08

### Added

- `helpscout inbox webhook create --payload-version <v2|v3>` — opt into Mailbox API V3 webhook payloads, which preserve the `system_user` type on conversation data so AI agents can be distinguished from regular users (V2 remains the default)
- User status support, matching the Mailbox API's Set/Get/List User Status endpoints:
  - CLI: `helpscout inbox user status get <id>`, `helpscout inbox user status list [--all]`, `helpscout inbox user status set <id> --status <active|away> [--text] [--emoji] [--emoji-name]`
  - MCP tools: `get_user_status`, `list_user_statuses`, `set_user_status` (29 MCP tools total, up from 26)

### Fixed

- Crash on write endpoints (e.g. Docs `POST/PUT /articles`) that return a 200/201 with an empty body instead of JSON — `request()` in both `docs-client.js` and `mailbox-client.js` now safely returns `null` for empty responses instead of throwing on JSON parsing
- MCP tools `create_article`, `update_article`, `create_conversation`, and `create_customer` now handle the empty-body case above correctly instead of returning `"null"` to the calling agent
- `helpscout --version` and the MCP server's reported version now read from `package.json` instead of a hardcoded string
- Raised minimum Node version to `>=20.10.0` (previously `>=20.0.0`), which is what's actually required by JSON import attribute syntax already in use

### Changed

- Extracted shared `USER_AGENT` and `parseJsonBody()` helpers (`src/http.js`) out of duplicated logic in `mailbox-client.js` and `docs-client.js`

## [1.0.0] — 2026-04-01

### Added

- CLI binary (`helpscout`) covering the full Help Scout Mailbox API v2 and Docs API v1
- MCP server binary (`helpscout-mcp`) exposing 26 tools for agent use with Claude Code and Claude Desktop
- OAuth 2.0 authentication with 48-hour token caching and silent auto-refresh
- Conversations: list, get, create, update, delete (with filters for status, tag, assignee)
- Threads: list, reply, add internal note
- Customers: list, get, create, update
- Mailboxes: list, get
- Users: list, get, me
- Tags: list
- Webhooks: list, get, create, delete
- Docs Articles: list, get, search, create, update, delete
- Docs Collections: list, get
- Auto-detecting output: JSON when piped, pretty tables in terminal
- `--json`, `--pretty`, and `--markdown` output flags on all list commands
- Rate limit handling (429) with automatic retry
- Automatic token refresh on 401
- `install.sh` for one-step installation to `/usr/local/bin`
