/**
 * helpscout docs site <action>
 */
import { Command } from 'commander';
import { docs } from '../../docs-client.js';
import { normalizeWriteResponse } from '../../http.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'title', header: 'Title' },
  { key: 'subDomain', header: 'Subdomain' },
  { key: 'cname', header: 'CNAME' },
  { key: 'updatedAt', header: 'Updated' },
];

export function makeSiteCommand() {
  const cmd = new Command('site');
  cmd.description('Manage Docs sites');

  cmd
    .command('list')
    .description('List all sites')
    .option('--page <n>', 'Page number', '1')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      if (opts.all) {
        const items = await docs.getAll('/sites');
        outputTable(items, COLUMNS, globalOpts);
      } else {
        const data = await docs.get('/sites', { page: opts.page });
        const items = data?.sites?.items ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a site by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await docs.get(`/sites/${id}`);
      output(data?.site ?? data, globalOpts);
    });

  cmd
    .command('create')
    .description('Create a site')
    .requiredOption('--title <title>', 'Site title')
    .requiredOption('--subdomain <name>', 'Subdomain')
    .option('--reload', 'Return the created site in the response')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = { title: opts.title, subDomain: opts.subdomain };
      const params = opts.reload ? { reload: 'true' } : undefined;
      const data = await docs.post('/sites', body, params);
      output(normalizeWriteResponse(data), globalOpts);
    });

  cmd
    .command('update <id>')
    .description('Update a site')
    .option('--title <title>', 'Site title')
    .option('--subdomain <name>', 'Subdomain')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {};
      if (opts.title) body.title = opts.title;
      if (opts.subdomain) body.subDomain = opts.subdomain;

      const data = await docs.put(`/sites/${id}`, body);
      output(normalizeWriteResponse(data, { ok: true, id }), globalOpts);
    });

  cmd
    .command('delete <id>')
    .description('Delete a site')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await docs.delete(`/sites/${id}`);
      output({ ok: true, id }, globalOpts);
    });

  const restrictions = new Command('restrictions');
  restrictions.description('Manage site access restrictions');

  restrictions
    .command('get <siteId>')
    .description('Get site restriction settings')
    .action(async (siteId, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await docs.get(`/sites/${siteId}/restricted`);
      output(data, globalOpts);
    });

  restrictions
    .command('update <siteId>')
    .description('Update site restriction settings')
    .option('--enabled', 'Enable restrictions')
    .option('--disabled', 'Disable restrictions')
    .option('--sign-in-url <url>', 'Custom callback sign-in URL')
    .action(async (siteId, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {};
      if (opts.enabled) body.enabled = true;
      if (opts.disabled) body.enabled = false;
      if (opts.signInUrl) {
        body.authentication = 'CALLBACK';
        body.callbackConfiguration = { signInUrl: opts.signInUrl };
      }

      const data = await docs.put(`/sites/${siteId}/restricted`, body);
      output(data ?? { ok: true, id: siteId }, globalOpts);
    });

  cmd.addCommand(restrictions);

  return cmd;
}
