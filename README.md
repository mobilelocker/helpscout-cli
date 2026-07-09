# helpscout CLI

A command-line tool for [Help Scout](https://www.helpscout.com), covering the Mailbox API v2 (conversations, customers, users) and the full Docs API v1 (articles, collections, categories, redirects, sites, assets).

Designed for scripting, automation, and use by AI agents. Ships with an MCP server (`helpscout-mcp`) for direct integration with Claude Code, Claude Desktop, and Cursor. Outputs JSON by default when not in a terminal, pretty tables when it is.

## Prerequisites

- Node.js 20 or later
- A Help Scout account with:
  - An OAuth application (for Mailbox API) — create one at **Your Profile → My Apps**
  - An API key (for Docs API) — create one at **Your Profile → API Keys**

## Installation

```sh
git clone https://github.com/mobilelocker/helpscout-cli.git helpscout-cli
cd helpscout-cli
./install.sh
```

`install.sh` runs `npm install`, builds both binaries (`helpscout` and `helpscout-mcp`), copies them to `/usr/local/bin`, and registers the MCP server with Claude Code and Cursor (when detected) — all in one step.

### Development (run from source)

```sh
git clone https://github.com/mobilelocker/helpscout-cli.git helpscout-cli
cd helpscout-cli
npm install
node bin/helpscout.js <command>
```

## Configuration

The CLI reads credentials from environment variables. Add these to your shell profile or secrets manager:

```sh
# Required for Mailbox API (conversations, customers, users, etc.)
export HELPSCOUT_APP_ID="your-oauth-app-id"
export HELPSCOUT_APP_SECRET="your-oauth-app-secret"

# Required for Docs API (articles, collections)
export HELPSCOUT_API_KEY="your-api-key"
```

## Authentication

The Mailbox API uses OAuth 2.0. Authenticate once and the token is cached for 48 hours (auto-refreshed):

```sh
helpscout auth login     # opens browser, follow the prompt
helpscout auth status    # check when your token expires
helpscout auth logout    # remove the cached token
```

The Docs API uses your `HELPSCOUT_API_KEY` directly — no login step needed.

## MCP Server

`helpscout-mcp` is an [MCP](https://modelcontextprotocol.io) server that exposes all Help Scout operations as tools for use with Claude Code, Claude Desktop, and Cursor.

After running `install.sh`, it is registered automatically with Claude Code (user scope) and Cursor (`~/.cursor/mcp.json`) when those editors are detected. To add it to a specific project instead:

```json
{
  "mcpServers": {
    "helpscout": {
      "command": "/usr/local/bin/helpscout-mcp"
    }
  }
}
```

The MCP server includes an `auth_login` tool that opens the browser OAuth flow on demand, so agents can handle authentication without leaving the conversation.

## Output Format

By default the CLI detects whether it's running in a terminal:

- **Terminal**: pretty tables with color
- **Pipe / script**: JSON

Override with flags available on every command:

```sh
helpscout inbox mailbox list              # table in terminal, JSON in pipe
helpscout inbox mailbox list --json       # always JSON
helpscout inbox mailbox list --pretty     # always table
helpscout inbox mailbox list --markdown   # always Markdown table (GFM)
```

Errors are always written to stderr as JSON and exit with code 1:

```json
{ "error": "Not authenticated. Run: helpscout auth login" }
```

## Usage

### Conversations

```sh
# List active conversations
helpscout inbox conversation list --mailbox <mailbox-id>

# All pages, closed conversations, filtered by tag
helpscout inbox conversation list --status closed --tag billing --all

# Get a single conversation
helpscout inbox conversation get <id>

# Create a conversation
helpscout inbox conversation create \
  --subject "Welcome!" \
  --mailbox-id <mailbox-id> \
  --customer-email user@example.com \
  --body "<p>Thanks for signing up.</p>"

# Reply and add an internal note
helpscout inbox thread reply <id> --text "<p>We're looking into this.</p>"
helpscout inbox thread note <id> --text "<p>Escalated to engineering.</p>"

# Close a conversation
helpscout inbox conversation update <id> --status closed
```

### Customers

```sh
helpscout inbox customer list --email user@example.com
helpscout inbox customer get <id>
helpscout inbox customer create --email new@example.com --first-name Jane --last-name Doe
helpscout inbox customer update <id> --phone "+15555550100"
```

### Users & Mailboxes

```sh
helpscout inbox user me                        # who am I?
helpscout inbox user list                      # all users
helpscout inbox mailbox list                   # all mailboxes with their IDs

helpscout inbox user status get <id>           # email + chat status for a user
helpscout inbox user status list               # statuses for all users
helpscout inbox user status set <id> --status active --text "On a call" --emoji 📞
```

### Tags

```sh
helpscout inbox tag list
```

### Webhooks

```sh
helpscout inbox webhook list
helpscout inbox webhook create \
  --url https://example.com/hook \
  --secret mysecret \
  --events convo.created,convo.assigned \
  --payload-version v3   # opt into V3 payloads (preserves system_user type)
helpscout inbox webhook delete <id>
```

### Docs Articles

```sh
# List published articles in a collection
helpscout docs article list --collection <collection-id> --all

# Search
helpscout docs article search --query "getting started"

# Create a draft (returns id from Location header), then publish
helpscout docs article create \
  --collection <collection-id> \
  --name "New Feature Guide" \
  --text "<p>Content here.</p>"

# Or create with full body in one call
helpscout docs article create --collection <id> --name "Guide" --reload

helpscout docs article update <id> --status published
helpscout docs article delete <id>
```

### Docs Collections, Categories, Redirects, Sites

```sh
helpscout docs collection list
helpscout docs collection create --site <site-id> --name "FAQ"

helpscout docs category list --collection <collection-id>
helpscout docs category create --collection <id> --name "Getting Started"

helpscout docs redirect list --site <site-id>
helpscout docs redirect create --site <id> --from /old --to https://example.com/new

helpscout docs site list
helpscout docs site restrictions get <site-id>
```

### Docs Assets

```sh
helpscout docs asset create-article --file ./screenshot.png
helpscout docs asset create-settings --file ./logo.png
```

## Development

```sh
npm test              # run tests
npm run scrape:docs-api  # refresh docs/docs-api-endpoints.json from Help Scout docs
npm run lint          # check for lint errors
npm run lint:fix  # auto-fix lint errors
npm run format    # format with Prettier
npm run build     # bundle to dist/helpscout and dist/helpscout-mcp
```

Pre-commit hooks run ESLint and Prettier automatically on staged files.

## Author

Built by [Mobile Locker](https://mobilelocker.com) — [support@mobilelocker.com](mailto:support@mobilelocker.com)

Mobile Locker is a content management and engagement platform for the life sciences industry. We help pharmaceutical, medical device, and diagnostics companies deliver personalized content to healthcare professionals — with down-to-the-page analytics, CRM integrations (Salesforce, Veeva), and AI-powered recommendations built for regulated environments.

## License

[MIT](LICENSE)
