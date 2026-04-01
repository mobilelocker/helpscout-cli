/**
 * helpscout inbox webhook <action>
 */
import { Command } from 'commander';
import { mailbox } from '../../mailbox-client.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'url', header: 'URL' },
  { key: 'state', header: 'State' },
  { key: 'events', header: 'Events' },
  { key: 'createdAt', header: 'Created' },
];

function flattenWebhook(w) {
  return {
    ...w,
    events: Array.isArray(w.events) ? w.events.join(', ') : '',
  };
}

export function makeWebhookCommand() {
  const cmd = new Command('webhook');
  cmd.description('Manage webhooks');

  cmd
    .command('list')
    .description('List all webhooks')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await mailbox.get('/webhooks');
      const items = data?._embedded?.webhooks ?? [];
      outputTable(items.map(flattenWebhook), COLUMNS, globalOpts);
    });

  cmd
    .command('get <id>')
    .description('Get a webhook by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await mailbox.get(`/webhooks/${id}`);
      output(data, globalOpts);
    });

  cmd
    .command('create')
    .description('Create a webhook')
    .requiredOption('--url <url>', 'Callback URL')
    .requiredOption('--secret <secret>', 'Signing secret')
    .option(
      '--events <events>',
      'Comma-separated event list (e.g. convo.created,convo.updated)',
      'convo.created,convo.updated,convo.deleted',
    )
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {
        url: opts.url,
        secret: opts.secret,
        events: opts.events.split(',').map((s) => s.trim()),
      };
      const data = await mailbox.post('/webhooks', body);
      output(data ?? { ok: true }, globalOpts);
    });

  cmd
    .command('delete <id>')
    .description('Delete a webhook')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await mailbox.delete(`/webhooks/${id}`);
      output({ ok: true, id }, globalOpts);
    });

  return cmd;
}
