/**
 * helpscout docs redirect <action>
 */
import { Command } from 'commander';
import { docs } from '../../docs-client.js';
import { normalizeWriteResponse } from '../../http.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'siteId', header: 'Site' },
  { key: 'urlMapping', header: 'From' },
  { key: 'redirect', header: 'To' },
  { key: 'updatedAt', header: 'Updated' },
];

export function makeRedirectCommand() {
  const cmd = new Command('redirect');
  cmd.description('Manage Docs redirects');

  cmd
    .command('list')
    .description('List redirects for a site')
    .requiredOption('--site <id>', 'Site ID')
    .option('--page <n>', 'Page number', '1')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const path = `/redirects/site/${opts.site}`;

      if (opts.all) {
        const items = await docs.getAll(path);
        outputTable(items, COLUMNS, globalOpts);
      } else {
        const data = await docs.get(path, { page: opts.page });
        const items = data?.redirects?.items ?? data?.items ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a redirect by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await docs.get(`/redirects/${id}`);
      output(data?.redirect ?? data, globalOpts);
    });

  cmd
    .command('find')
    .description('Find redirect destination for a URL path')
    .requiredOption('--site <id>', 'Site ID')
    .requiredOption('--url <path>', 'URL path to resolve (e.g. /article/22-title)')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await docs.get('/redirects', { siteId: opts.site, url: opts.url });
      output(data, globalOpts);
    });

  cmd
    .command('create')
    .description('Create a redirect')
    .requiredOption('--site <id>', 'Site ID')
    .requiredOption('--url-mapping <path>', 'Path to redirect from')
    .requiredOption('--redirect <url>', 'Destination URL')
    .option('--reload', 'Return the created redirect in the response')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {
        siteId: opts.site,
        urlMapping: opts.urlMapping,
        redirect: opts.redirect,
      };
      const params = opts.reload ? { reload: 'true' } : undefined;
      const data = await docs.post('/redirects', body, params);
      output(normalizeWriteResponse(data), globalOpts);
    });

  cmd
    .command('update <id>')
    .description('Update a redirect')
    .option('--url-mapping <path>', 'Path to redirect from')
    .option('--redirect <url>', 'Destination URL')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {};
      if (opts.urlMapping) body.urlMapping = opts.urlMapping;
      if (opts.redirect) body.redirect = opts.redirect;

      const data = await docs.put(`/redirects/${id}`, body);
      output(normalizeWriteResponse(data, { ok: true, id }), globalOpts);
    });

  cmd
    .command('delete <id>')
    .description('Delete a redirect')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await docs.delete(`/redirects/${id}`);
      output({ ok: true, id }, globalOpts);
    });

  return cmd;
}
