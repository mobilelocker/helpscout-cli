/**
 * helpscout inbox user <action>
 */
import { Command, Option } from 'commander';
import { mailbox, USER_STATUSES, buildCustomStatus } from '../../mailbox-client.js';
import { output, outputTable } from '../../output.js';
import { USER_STATUS_COLUMNS } from '../../columns.js';

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

  const statusCmd = new Command('status').description('View and manage user status');

  statusCmd
    .command('get <id>')
    .description('Get email and chat status for a user')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await mailbox.get(`/users/${id}/status`);
      output(data, globalOpts);
    });

  statusCmd
    .command('list')
    .description('List statuses for all users')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      if (opts.all) {
        const items = await mailbox.getAll('/users/status', 'userStatuses');
        outputTable(items, USER_STATUS_COLUMNS, globalOpts);
      } else {
        const data = await mailbox.get('/users/status');
        const items = data?._embedded?.userStatuses ?? [];
        outputTable(items, USER_STATUS_COLUMNS, globalOpts);
      }
    });

  statusCmd
    .command('set <id>')
    .description('Set email status for a user (self, or another user if admin/owner)')
    .addOption(
      new Option('--status <status>', 'Status').choices(USER_STATUSES).makeOptionMandatory(),
    )
    .option('--text <text>', 'Custom status text')
    .option('--emoji <emoji>', 'Custom status emoji (e.g. ☕)')
    .option('--emoji-name <name>', 'Custom status emoji name (e.g. :coffee:)')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = { status: opts.status };
      const customStatus = buildCustomStatus({
        text: opts.text,
        emoji: opts.emoji,
        emojiName: opts.emojiName,
      });
      if (customStatus) body.customStatus = customStatus;
      await mailbox.put(`/users/${id}/status`, body);
      output({ ok: true, id }, globalOpts);
    });

  cmd.addCommand(statusCmd);

  return cmd;
}
