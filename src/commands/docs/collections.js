/**
 * helpscout docs collection <action>
 */
import { Command } from 'commander';
import { docs } from '../../docs-client.js';
import { normalizeWriteResponse } from '../../http.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'number', header: 'Number' },
  { key: 'visibility', header: 'Visibility' },
  { key: 'siteId', header: 'Site' },
  { key: 'updatedAt', header: 'Updated' },
];

export function makeCollectionCommand() {
  const cmd = new Command('collection');
  cmd.description('Manage Docs collections');

  cmd
    .command('list')
    .description('List all collections')
    .option('--site <id>', 'Filter by site ID')
    .option('--visibility <v>', 'Filter by visibility (public, private)')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const params = {};
      if (opts.site) params.siteId = opts.site;
      if (opts.visibility) params.visibility = opts.visibility;

      if (opts.all) {
        const items = await docs.getAll('/collections', params);
        outputTable(items, COLUMNS, globalOpts);
      } else {
        const data = await docs.get('/collections', params);
        const items = data?.collections?.items ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a collection by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await docs.get(`/collections/${id}`);
      output(data?.collection ?? data, globalOpts);
    });

  cmd
    .command('create')
    .description('Create a collection')
    .requiredOption('--site <id>', 'Site ID')
    .requiredOption('--name <name>', 'Collection name')
    .option('--visibility <v>', 'public or private', 'public')
    .option('--order <n>', 'Display order', '1')
    .option('--description <text>', 'Optional description (max 45 chars)')
    .option('--reload', 'Return the created collection in the response')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {
        siteId: opts.site,
        name: opts.name,
        visibility: opts.visibility,
        order: Number(opts.order),
      };
      if (opts.description) body.description = opts.description;

      const params = opts.reload ? { reload: 'true' } : undefined;
      const data = await docs.post('/collections', body, params);
      output(normalizeWriteResponse(data), globalOpts);
    });

  cmd
    .command('update <id>')
    .description('Update a collection')
    .option('--name <name>', 'Collection name')
    .option('--visibility <v>', 'public or private')
    .option('--order <n>', 'Display order')
    .option('--description <text>', 'Description')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {};
      if (opts.name) body.name = opts.name;
      if (opts.visibility) body.visibility = opts.visibility;
      if (opts.order) body.order = Number(opts.order);
      if (opts.description) body.description = opts.description;

      const data = await docs.put(`/collections/${id}`, body);
      output(normalizeWriteResponse(data, { ok: true, id }), globalOpts);
    });

  cmd
    .command('delete <id>')
    .description('Delete a collection')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await docs.delete(`/collections/${id}`);
      output({ ok: true, id }, globalOpts);
    });

  return cmd;
}
