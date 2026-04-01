/**
 * helpscout inbox conversation <action>
 */
import { Command } from 'commander';
import { mailbox } from '../../mailbox-client.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'subject', header: 'Subject' },
  { key: 'status', header: 'Status' },
  { key: 'mailboxId', header: 'Mailbox' },
  { key: 'assignee', header: 'Assignee' },
  { key: 'createdAt', header: 'Created' },
];

function flattenConversation(c) {
  return {
    ...c,
    assignee: c.assignee ? `${c.assignee.first} ${c.assignee.last}` : '',
  };
}

export function makeConversationCommand() {
  const cmd = new Command('conversation');
  cmd.description('Manage conversations');

  cmd
    .command('list')
    .description('List conversations')
    .option('--mailbox <id>', 'Filter by mailbox ID')
    .option('--status <status>', 'Filter by status (active, closed, spam, pending)', 'active')
    .option('--tag <tag>', 'Filter by tag')
    .option('--assigned-to <userId>', 'Filter by assigned user ID')
    .option('--page <n>', 'Page number', '1')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const params = {};
      if (opts.mailbox) params.mailbox = opts.mailbox;
      if (opts.status) params.status = opts.status;
      if (opts.tag) params.tag = opts.tag;
      if (opts.assignedTo) params.assignedTo = opts.assignedTo;

      if (opts.all) {
        const items = await mailbox.getAll('/conversations', 'conversations', params);
        outputTable(items.map(flattenConversation), COLUMNS, globalOpts);
      } else {
        params.page = opts.page;
        const data = await mailbox.get('/conversations', params);
        const items = data?._embedded?.conversations ?? [];
        outputTable(items.map(flattenConversation), COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a conversation by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await mailbox.get(`/conversations/${id}`);
      output(data, globalOpts);
    });

  cmd
    .command('create')
    .description('Create a conversation')
    .requiredOption('--subject <subject>', 'Subject')
    .requiredOption('--mailbox-id <id>', 'Mailbox ID')
    .requiredOption('--customer-email <email>', 'Customer email')
    .option('--body <text>', 'Initial message body')
    .option('--status <status>', 'Status (active, closed, pending)', 'active')
    .option('--type <type>', 'Conversation type (email, chat, phone)', 'email')
    .option('--tag <tag...>', 'Tags to apply')
    .option('--assigned-to <userId>', 'User ID to assign to')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {
        subject: opts.subject,
        mailboxId: parseInt(opts.mailboxId),
        customer: { email: opts.customerEmail },
        status: opts.status,
        type: opts.type,
      };
      if (opts.body) {
        body.threads = [{ type: 'customer', text: opts.body }];
      }
      if (opts.tag) body.tags = opts.tag;
      if (opts.assignedTo) body.assignTo = parseInt(opts.assignedTo);

      const data = await mailbox.post('/conversations', body);
      output(data ?? { ok: true }, globalOpts);
    });

  cmd
    .command('update <id>')
    .description('Update a conversation')
    .option('--status <status>', 'New status (active, closed, spam, pending)')
    .option('--subject <subject>', 'New subject')
    .option('--assigned-to <userId>', 'Assign to user ID')
    .option('--mailbox <id>', 'Move to mailbox ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {};
      if (opts.status) body.status = opts.status;
      if (opts.subject) body.subject = opts.subject;
      if (opts.assignedTo) body.assignTo = parseInt(opts.assignedTo);
      if (opts.mailbox) body.mailboxId = parseInt(opts.mailbox);

      await mailbox.patch(`/conversations/${id}`, body);
      output({ ok: true, id }, globalOpts);
    });

  cmd
    .command('delete <id>')
    .description('Delete a conversation')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await mailbox.delete(`/conversations/${id}`);
      output({ ok: true, id }, globalOpts);
    });

  return cmd;
}
