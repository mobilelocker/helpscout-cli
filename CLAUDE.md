# Help Scout CLI — Agent Reference

Two binaries are available:

- **`helpscout`** — CLI for scripting and terminal use
- **`helpscout-mcp`** — MCP server; prefer this for agent use (direct tool calls, no subprocess, typed schemas)

See README.md for installation.

## Git commits (this repo)

This is a **GitHub** repository. Do **not** prefix commit subjects with Jira/MLH keys (e.g. no `MLH-10 Add feature`), even though older history used that style.

- Subject: plain imperative (`Add file-path body support…`)
- Link issues with `#123`; close with `Closes #123` in the commit body or PR description
- Full rules: follow global Claude GitHub commit conventions

## MCP Setup

Running `./install.sh` registers the MCP server with Claude Code (user scope) and Cursor (`~/.cursor/mcp.json`) when those editors are detected. It also stops any already-running `helpscout-mcp` processes after installing the binary so reinstalls load the new build (reconnect Help Scout MCP in the editor if a session was open).

To add it to a specific project instead, add to your project's `.mcp.json` (Claude Code) or `.cursor/mcp.json` (Cursor):

```json
{
  "mcpServers": {
    "helpscout": {
      "command": "/usr/local/bin/helpscout-mcp"
    }
  }
}
```

The MCP server exposes 61 tools covering Mailbox API and full Docs API operations. Use the MCP tools directly instead of shelling out to the CLI when available.

## MCP Tools

**Auth:** `auth_status`, `auth_login`, `auth_logout`

**Inbox:** `list_conversations`, `get_conversation`, `create_conversation`, `update_conversation`, `delete_conversation`, `list_threads`, `reply_to_conversation`, `add_note`, `list_customers`, `get_customer`, `create_customer`, `update_customer`, `list_mailboxes`, `list_users`, `get_current_user`, `get_user_status`, `list_user_statuses`, `set_user_status`, `list_tags`

**Docs — Articles:** `list_articles`, `get_article`, `search_articles`, `list_related_articles`, `list_article_revisions`, `get_article_revision`, `create_article`, `upload_article`, `update_article`, `update_article_view_count`, `save_article_draft`, `delete_article_draft`, `delete_article`

**Docs — Collections:** `list_collections`, `get_collection`, `create_collection`, `update_collection`, `delete_collection`

**Docs — Categories:** `list_categories`, `get_category`, `create_category`, `update_category`, `update_category_order`, `delete_category`

**Docs — Redirects:** `list_redirects`, `get_redirect`, `find_redirect`, `create_redirect`, `update_redirect`, `delete_redirect`

**Docs — Sites:** `list_sites`, `get_site`, `create_site`, `update_site`, `delete_site`, `get_site_restrictions`, `update_site_restrictions`

**Docs — Assets:** `create_article_asset`, `create_settings_asset`

All list tools accept an optional `markdown: true` parameter to return a GitHub Flavored Markdown table instead of JSON — useful when displaying results directly to a user in the conversation.

Create tools return `{ id, location }` when the API responds with `201` and a `Location` or `Resource-ID` header. Pass `reload: true` on Docs article/collection create to receive the full resource in one call.

## Environment Variables

| Variable               | Required for | Purpose                   |
| ---------------------- | ------------ | ------------------------- |
| `HELPSCOUT_APP_ID`     | Mailbox API  | OAuth application ID      |
| `HELPSCOUT_APP_SECRET` | Mailbox API  | OAuth application secret  |
| `HELPSCOUT_API_KEY`    | Docs API     | API key (HTTP Basic Auth) |

These must be set in your shell environment before running the CLI or MCP server.

## Output Format

- **stdout is not a TTY** (piped, agent context): JSON by default
- **stdout is a TTY** (interactive terminal): pretty table by default
- `--json` — force JSON regardless of TTY
- `--pretty` — force table regardless of TTY
- `--markdown` — force GitHub Flavored Markdown pipe table output

Agents should rely on the default JSON behavior. Use `--markdown` only when you want to display a formatted table directly to the user. For MCP tools, pass `markdown: true` instead.

**List commands** return a JSON array:

```json
[{"id": 123, "subject": "...", ...}, ...]
```

**Get/create/update commands** return a JSON object:

```json
{"id": 123, "subject": "...", ...}
```

**Mutation commands with no response body** return:

```json
{ "ok": true, "id": 123 }
```

**Errors** go to stderr as JSON, exit code 1:

```json
{"error": "Not authenticated. Run: helpscout auth login"}
{"error": "Request failed (404)", "status": 404}
```

Empty list results return `[]`.

## Authentication

Mailbox API uses OAuth tokens cached at `~/.cache/helpscout/token.json`. Tokens are valid for 48 hours and silently auto-refresh. If the token is rejected mid-request (401), a forced refresh is attempted before failing.

**For agents:** call `auth_status` at the start of any Help Scout task. If not authenticated, call `auth_login` — it opens a browser window for the user and waits until the OAuth flow completes before returning.

## Command Reference

### Auth

```
helpscout auth login           # open browser and authenticate
helpscout auth status          # check token validity and expiry
helpscout auth logout          # remove cached token
```

### Inbox — Conversations

```
helpscout inbox conversation list [options]
  --mailbox <id>       filter by mailbox ID
  --status <s>         active (default) | closed | spam | pending
  --tag <tag>          filter by tag name
  --assigned-to <uid>  filter by assigned user ID
  --page <n>           page number (default: 1)
  --all                fetch all pages

helpscout inbox conversation get <id>

helpscout inbox conversation create [options]
  --subject <text>         (required)
  --mailbox-id <id>        (required)
  --customer-email <email> (required)
  --body <html>            initial message (optional unless --file)
  --file <path>            read initial message from file (alternative to --body)
  --status <s>             active (default) | closed | pending
  --type <t>               email (default) | chat | phone
  --tag <tag...>           repeatable
  --assigned-to <uid>

helpscout inbox conversation update <id> [options]
  --status <s>         active | closed | spam | pending
  --subject <text>
  --assigned-to <uid>
  --mailbox <id>

helpscout inbox conversation delete <id>
```

### Inbox — Threads

```
helpscout inbox thread list <conversationId> [--all]

helpscout inbox thread reply <conversationId> [options]
  --text <html>    (required unless --file)
  --file <path>    read reply from file (alternative to --text)
  --user <uid>
  --cc <emails>    comma-separated
  --bcc <emails>   comma-separated

helpscout inbox thread note <conversationId> [options]
  --text <html>    (required unless --file)
  --file <path>    read note from file (alternative to --text)
  --user <uid>
```

### Inbox — Customers

```
helpscout inbox customer list [options]
  --first-name <name>
  --last-name <name>
  --email <email>
  --page <n>
  --all

helpscout inbox customer get <id>

helpscout inbox customer create [options]
  --email <email>      (required)
  --first-name <name>
  --last-name <name>
  --phone <phone>

helpscout inbox customer update <id> [options]
  --first-name <name>
  --last-name <name>
  --email <email>
```

### Inbox — Mailboxes

```
helpscout inbox mailbox list [--all]
helpscout inbox mailbox get <id>
```

### Inbox — Users

```
helpscout inbox user list [--mailbox <id>] [--all]
helpscout inbox user get <id>
helpscout inbox user me

helpscout inbox user status get <id>
helpscout inbox user status list [--all]

helpscout inbox user status set <id> [options]
  --status <status>     (required) active | away
  --text <text>         custom status text
  --emoji <emoji>       custom status emoji, e.g. ☕
  --emoji-name <name>   custom status emoji name, e.g. :coffee:
```

### Inbox — Tags

```
helpscout inbox tag list [--all]
```

### Inbox — Webhooks

```
helpscout inbox webhook list
helpscout inbox webhook get <id>

helpscout inbox webhook create [options]
  --url <url>               (required)
  --secret <secret>         (required)
  --events <list>           comma-separated (default: convo.created,convo.updated,convo.deleted)
  --payload-version <ver>   v2 (default) | v3 (preserves system_user type)

helpscout inbox webhook delete <id>
```

### Docs — Articles

```
helpscout docs article list [options]
  --collection <id>   list articles in a collection (required unless --category)
  --category <id>     list articles in a category
  --status <s>        all (default) | published | notpublished
  --sort <field>      order | number | status | name | popularity | createdAt | updatedAt
  --order <dir>       asc | desc
  --page-size <n>     max 100
  --page <n>
  --all

helpscout docs article get <id>
helpscout docs article search --query <q> [--collection <id>] [--site <id>] [--status <s>] [--visibility all|public|private] [--page-size <n>] [--all]
helpscout docs article list-related <id> [--status all|published|notpublished] [--sort] [--order] [--all]
helpscout docs article list-revisions <id> [--all]
helpscout docs article get-revision <revisionId>

helpscout docs article create [options]
  --collection <id>   (required)
  --name <title>      (required)
  --text <html>       body HTML (required unless --file)
  --file <path>       read body HTML from file (alternative to --text)
  --status <s>        notpublished (default) | published
  --slug <slug>
  --category <id...>  category IDs (repeatable)
  --related <id...>   related article IDs (repeatable)
  --keyword <word...> keywords (repeatable)
  --reload            return full article JSON (reload=true query param)

helpscout docs article upload --collection <id> --file <path> [--name] [--category] [--slug] [--type html|text|markdown] [--reload]
helpscout docs article update <id> [--name] [--text] [--file <path>] [--status] [--slug] [--category <id...>] [--related <id...>] [--keyword <word...>] [--clear-categories] [--clear-related] [--clear-keywords] [--reload]
  body: --text or --file (at most one); categories on update: omit = unchanged; --clear-categories or null = Uncategorized; --category ids = replace (never pass Uncategorized id)
helpscout docs article update-view-count <id>
helpscout docs article save-draft <id> [--text <html> | --file <path>]
helpscout docs article delete-draft <id>
helpscout docs article delete <id>
```

### Docs — Collections

```
helpscout docs collection list [--site <id>] [--visibility public|private] [--sort] [--order] [--all]
helpscout docs collection get <id>
helpscout docs collection create --site <id> --name <name> [--visibility] [--reload]
helpscout docs collection update <id> [--name] [--visibility] [--order] [--description] [--site <id>] [--reload]
helpscout docs collection delete <id>
```

### Docs — Categories

```
helpscout docs category list --collection <id> [--sort] [--order] [--all]
helpscout docs category get <id>
helpscout docs category create --collection <id> --name <name> [--slug] [--order]
helpscout docs category update <id> [--name] [--slug] [--order]
helpscout docs category order --collection <id> --json '<[{id,order}]>'
helpscout docs category delete <id>
```

### Docs — Redirects

```
helpscout docs redirect list --site <id> [--all]
helpscout docs redirect get <id>
helpscout docs redirect find --site <id> --url <path>
helpscout docs redirect create --site <id> --url-mapping <path> --redirect <url>
helpscout docs redirect update <id> [--site <id>] [--url-mapping <path>] [--redirect <url>] [--reload]
helpscout docs redirect delete <id>
```

### Docs — Sites

```
helpscout docs site list [--all]
helpscout docs site get <id>
helpscout docs site create --title <title> --subdomain <name> [--status] [--cname] [--has-public-site] [--logo-url] [--home-url] [--bg-color] [--has-contact-form] [--mailbox-id] [--contact-email] [--style-sheet-url] [--header-code] [--reload]
helpscout docs site update <id> [same site body options as create] [--reload]
helpscout docs site delete <id>
helpscout docs site restrictions get <siteId>
helpscout docs site restrictions update <siteId> [--enabled|--disabled] [--authentication CALLBACK] [--sign-in-url <url>]
```

### Docs — Assets

```
helpscout docs asset create-article --file <path> [--width] [--height]
helpscout docs asset create-settings --file <path>
```

Endpoint and field coverage is tracked in `docs/docs-api-endpoints.json` and `src/docs-api-field-map.js`. Run `npm run scrape:docs-api` to refresh metadata from developer.helpscout.com.

## Common Patterns

**Get the mailbox ID:**

```sh
helpscout inbox mailbox list
# → [{"id": <mailbox-id>, "name": "<your-mailbox-name>", ...}]
```

**Find a customer by email:**

```sh
helpscout inbox customer list --email user@example.com
```

**List open conversations in a mailbox:**

```sh
helpscout inbox conversation list --mailbox <mailbox-id> --status active --all
```

**Reply to a conversation:**

```sh
helpscout inbox thread reply <id> --text "Thanks for reaching out!"
helpscout inbox thread reply <id> --file ./reply.html
helpscout inbox thread note <id> --file ./note.html
```

**Find a Docs collection, then list its articles:**

```sh
helpscout docs collection list
helpscout docs article list --collection <collection-id> --all
```

**Create a draft article:**

```sh
helpscout docs article create --collection <collection-id> --name "My Article" --text "<p>Body here</p>"
# → { "id": "...", "location": "https://docsapi.helpscout.net/v1/articles/..." }
helpscout docs article update <new-id> --status published
```

**Load free-form text from a file** (avoids large inline `--text` / MCP payloads; JSON APIs only — not multipart upload):

```sh
helpscout docs article create --collection <collection-id> --name "My Article" --file ./body.html
helpscout docs article update <id> --file ./body.html
helpscout docs article save-draft <id> --file ./draft.html
helpscout inbox conversation create --subject "Hi" --mailbox-id <id> --customer-email a@b.com --file ./body.html
```

MCP: pass `filePath` (absolute path) instead of `text`/`body` on `create_article`, `update_article`, `save_article_draft`, `reply_to_conversation`, `add_note`, and `create_conversation`.
