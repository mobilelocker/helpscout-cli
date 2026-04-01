/**
 * helpscout inbox mailbox <action>
 */
import { Command } from 'commander';
import { mailbox } from '../../mailbox-client.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'slug', header: 'Slug' },
  { key: 'createdAt', header: 'Created' },
];

export function makeMailboxCommand() {
  const cmd = new Command('mailbox');
  cmd.description('List and inspect mailboxes (inboxes)');

  cmd
    .command('list')
    .description('List all mailboxes')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      if (opts.all) {
        const items = await mailbox.getAll('/mailboxes', 'mailboxes');
        outputTable(items, COLUMNS, globalOpts);
      } else {
        const data = await mailbox.get('/mailboxes');
        const items = data?._embedded?.mailboxes ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a mailbox by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await mailbox.get(`/mailboxes/${id}`);
      output(data, globalOpts);
    });

  return cmd;
}
