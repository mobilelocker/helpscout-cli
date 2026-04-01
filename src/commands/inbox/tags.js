/**
 * helpscout inbox tag <action>
 */
import { Command } from 'commander';
import { mailbox } from '../../mailbox-client.js';
import { outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'color', header: 'Color' },
  { key: 'ticketCount', header: 'Tickets' },
];

export function makeTagCommand() {
  const cmd = new Command('tag');
  cmd.description('List tags');

  cmd
    .command('list')
    .description('List all tags')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      if (opts.all) {
        const items = await mailbox.getAll('/tags', 'tags');
        outputTable(items, COLUMNS, globalOpts);
      } else {
        const data = await mailbox.get('/tags');
        const items = data?._embedded?.tags ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  return cmd;
}
