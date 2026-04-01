/**
 * helpscout docs collection <action>
 */
import { Command } from 'commander';
import { docs } from '../../docs-client.js';
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

  return cmd;
}
