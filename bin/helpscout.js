#!/usr/bin/env node
/**
 * helpscout — Help Scout CLI
 * Mailbox API v2 (helpscout inbox ...) and Docs API v1 (helpscout docs ...)
 *
 * Credentials: set HELPSCOUT_* env vars or put them in ~/.config/helpscout/env
 */
import '../src/load-env.js';
import { Command } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import { makeAuthCommand } from '../src/commands/auth.js';
import { makeConversationCommand } from '../src/commands/inbox/conversations.js';
import { makeThreadCommand } from '../src/commands/inbox/threads.js';
import { makeCustomerCommand } from '../src/commands/inbox/customers.js';
import { makeMailboxCommand } from '../src/commands/inbox/mailboxes.js';
import { makeUserCommand } from '../src/commands/inbox/users.js';
import { makeTagCommand } from '../src/commands/inbox/tags.js';
import { makeWebhookCommand } from '../src/commands/inbox/webhooks.js';
import { makeArticleCommand } from '../src/commands/docs/articles.js';
import { makeCollectionCommand } from '../src/commands/docs/collections.js';
import { makeCategoryCommand } from '../src/commands/docs/categories.js';
import { makeRedirectCommand } from '../src/commands/docs/redirects.js';
import { makeSiteCommand } from '../src/commands/docs/sites.js';
import { makeAssetCommand } from '../src/commands/docs/assets.js';

const program = new Command();

program
  .name('helpscout')
  .description('Help Scout CLI — Mailbox API v2 and Docs API v1')
  .version(pkg.version)
  // Global output format flags — inherited by all subcommands via optsWithGlobals()
  .option('--json', 'Force JSON output (default when stdout is not a TTY)')
  .option('--pretty', 'Force pretty/table output (default when stdout is a TTY)')
  .option('--markdown', 'Force Markdown table output');

// ─── helpscout auth ───────────────────────────────────────────────────────────
program.addCommand(makeAuthCommand());

// ─── helpscout inbox ──────────────────────────────────────────────────────────
const inbox = new Command('inbox');
inbox.description('Mailbox API v2 — conversations, customers, users, and more');
inbox.addCommand(makeConversationCommand());
inbox.addCommand(makeThreadCommand());
inbox.addCommand(makeCustomerCommand());
inbox.addCommand(makeMailboxCommand());
inbox.addCommand(makeUserCommand());
inbox.addCommand(makeTagCommand());
inbox.addCommand(makeWebhookCommand());
program.addCommand(inbox);

// ─── helpscout docs ───────────────────────────────────────────────────────────
const docsCmd = new Command('docs');
docsCmd.description('Docs API v1 — articles, collections, categories, and more');
docsCmd.addCommand(makeArticleCommand());
docsCmd.addCommand(makeCollectionCommand());
docsCmd.addCommand(makeCategoryCommand());
docsCmd.addCommand(makeRedirectCommand());
docsCmd.addCommand(makeSiteCommand());
docsCmd.addCommand(makeAssetCommand());
program.addCommand(docsCmd);

// Global error handler — unhandled rejections shouldn't print a stack trace
process.on('unhandledRejection', (err) => {
  process.stderr.write(JSON.stringify({ error: err?.message ?? String(err) }) + '\n');
  process.exit(1);
});

program.parse();
