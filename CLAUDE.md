# Help Scout CLI — Agent Reference

Two binaries are available:

- **`helpscout`** — CLI for scripting and terminal use
- **`helpscout-mcp`** — MCP server; prefer this for agent use (direct tool calls, no subprocess, typed schemas)

See README.md for installation.

## MCP Setup

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "helpscout": {
      "command": "/usr/local/bin/helpscout-mcp"
    }
  }
}
```

The MCP server exposes 26 tools covering all operations below. Use the MCP tools directly instead of shelling out to the CLI when available.

## MCP Tools

`auth_status`, `auth_login`, `auth_logout`, `list_conversations`, `get_conversation`, `create_conversation`, `update_conversation`, `delete_conversation`, `list_threads`, `reply_to_conversation`, `add_note`, `list_customers`, `get_customer`, `create_customer`, `update_customer`, `list_mailboxes`, `list_users`, `get_current_user`, `list_tags`, `list_articles`, `get_article`, `search_articles`, `create_article`, `update_article`, `delete_article`, `list_collections`, `get_collection`

All list tools (`list_conversations`, `list_threads`, `list_customers`, `list_mailboxes`, `list_users`, `list_tags`, `list_articles`, `search_articles`, `list_collections`) accept an optional `markdown: true` parameter to return a GitHub Flavored Markdown table instead of JSON — useful when displaying results directly to a user in the conversation.

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
  --body <html>
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
  --text <html>    (required)
  --user <uid>
  --cc <emails>    comma-separated
  --bcc <emails>   comma-separated

helpscout inbox thread note <conversationId> [options]
  --text <html>    (required)
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
  --url <url>        (required)
  --secret <secret>  (required)
  --events <list>    comma-separated (default: convo.created,convo.updated,convo.deleted)

helpscout inbox webhook delete <id>
```

### Docs — Articles

```
helpscout docs article list [options]
  --collection <id>
  --status <s>       published (default) | notpublished
  --page <n>
  --all

helpscout docs article get <id>

helpscout docs article search [options]
  --query <q>        (required)
  --collection <id>
  --status <s>
  --all

helpscout docs article create [options]
  --collection <id>  (required)
  --name <title>     (required)
  --text <html>
  --status <s>       notpublished (default) | published

helpscout docs article update <id> [options]
  --name <title>
  --text <html>
  --status <s>       published | notpublished

helpscout docs article delete <id>
```

### Docs — Collections

```
helpscout docs collection list [options]
  --site <id>
  --visibility <v>   public | private
  --all

helpscout docs collection get <id>
```

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
```

**Find a Docs collection, then list its articles:**

```sh
helpscout docs collection list
helpscout docs article list --collection <collection-id> --all
```

**Create a draft article:**

```sh
helpscout docs article create --collection <collection-id> --name "My Article" --text "<p>Body here</p>"
# Returns the new article object including its id
helpscout docs article update <new-id> --status published
```
