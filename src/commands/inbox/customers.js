/**
 * helpscout inbox customer <action>
 */
import { Command } from 'commander';
import { mailbox } from '../../mailbox-client.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'firstName', header: 'First' },
  { key: 'lastName', header: 'Last' },
  { key: 'email', header: 'Email' },
  { key: 'createdAt', header: 'Created' },
];

function flattenCustomer(c) {
  return {
    ...c,
    email: c.emails?.[0]?.value ?? '',
  };
}

export function makeCustomerCommand() {
  const cmd = new Command('customer');
  cmd.description('Manage customers');

  cmd
    .command('list')
    .description('List customers')
    .option('--first-name <name>', 'Filter by first name')
    .option('--last-name <name>', 'Filter by last name')
    .option('--email <email>', 'Filter by email')
    .option('--page <n>', 'Page number', '1')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const params = {};
      if (opts.firstName) params.firstName = opts.firstName;
      if (opts.lastName) params.lastName = opts.lastName;
      if (opts.email) params.email = opts.email;

      if (opts.all) {
        const items = await mailbox.getAll('/customers', 'customers', params);
        outputTable(items.map(flattenCustomer), COLUMNS, globalOpts);
      } else {
        params.page = opts.page;
        const data = await mailbox.get('/customers', params);
        const items = data?._embedded?.customers ?? [];
        outputTable(items.map(flattenCustomer), COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a customer by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await mailbox.get(`/customers/${id}`);
      output(data, globalOpts);
    });

  cmd
    .command('create')
    .description('Create a customer')
    .requiredOption('--email <email>', 'Customer email')
    .option('--first-name <name>', 'First name')
    .option('--last-name <name>', 'Last name')
    .option('--phone <phone>', 'Phone number')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {
        emails: [{ value: opts.email, type: 'work' }],
      };
      if (opts.firstName) body.firstName = opts.firstName;
      if (opts.lastName) body.lastName = opts.lastName;
      if (opts.phone) body.phones = [{ value: opts.phone, type: 'work' }];

      const data = await mailbox.post('/customers', body);
      output(data ?? { ok: true }, globalOpts);
    });

  cmd
    .command('update <id>')
    .description('Update a customer')
    .option('--first-name <name>', 'First name')
    .option('--last-name <name>', 'Last name')
    .option('--email <email>', 'Email address')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {};
      if (opts.firstName) body.firstName = opts.firstName;
      if (opts.lastName) body.lastName = opts.lastName;
      if (opts.email) body.emails = [{ value: opts.email, type: 'work' }];

      await mailbox.patch(`/customers/${id}`, body);
      output({ ok: true, id }, globalOpts);
    });

  return cmd;
}
