/**
 * helpscout inbox user <action>
 */
import { Command } from 'commander';
import { mailbox } from '../../mailbox-client.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'firstName', header: 'First' },
  { key: 'lastName', header: 'Last' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Role' },
  { key: 'createdAt', header: 'Created' },
];

export function makeUserCommand() {
  const cmd = new Command('user');
  cmd.description('List and inspect users');

  cmd
    .command('list')
    .description('List all users')
    .option('--mailbox <id>', 'Filter by mailbox ID')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const params = {};
      if (opts.mailbox) params.mailboxId = opts.mailbox;

      if (opts.all) {
        const items = await mailbox.getAll('/users', 'users', params);
        outputTable(items, COLUMNS, globalOpts);
      } else {
        const data = await mailbox.get('/users', params);
        const items = data?._embedded?.users ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a user by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await mailbox.get(`/users/${id}`);
      output(data, globalOpts);
    });

  cmd
    .command('me')
    .description('Get the current authenticated user')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await mailbox.get('/users/me');
      output(data, globalOpts);
    });

  return cmd;
}
