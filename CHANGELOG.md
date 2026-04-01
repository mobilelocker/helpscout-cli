# Changelog

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
