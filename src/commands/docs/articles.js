/**
 * helpscout docs article <action>
 */
import { Command } from 'commander';
import { docs } from '../../docs-client.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Title' },
  { key: 'status', header: 'Status' },
  { key: 'collectionId', header: 'Collection' },
  { key: 'updatedAt', header: 'Updated' },
];

export function makeArticleCommand() {
  const cmd = new Command('article');
  cmd.description('Manage Docs articles');

  cmd
    .command('list')
    .description('List articles')
    .option('--collection <id>', 'Filter by collection ID')
    .option('--status <status>', 'Filter by status (published, notpublished)', 'published')
    .option('--page <n>', 'Page number', '1')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const params = { status: opts.status };

      const path = opts.collection ? `/collections/${opts.collection}/articles` : '/articles';

      if (opts.all) {
        const items = await docs.getAll(path, params);
        outputTable(items, COLUMNS, globalOpts);
      } else {
        params.page = opts.page;
        const data = await docs.get(path, params);
        const items = data?.articles?.items ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <id>')
    .description('Get an article by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await docs.get(`/articles/${id}`);
      output(data?.article ?? data, globalOpts);
    });

  cmd
    .command('search')
    .description('Search articles')
    .requiredOption('--query <q>', 'Search query')
    .option('--collection <id>', 'Limit to collection')
    .option('--status <status>', 'Status filter', 'published')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const params = { query: opts.query, status: opts.status };
      if (opts.collection) params.collectionId = opts.collection;

      if (opts.all) {
        const items = await docs.getAll('/search/articles', params);
        outputTable(items, COLUMNS, globalOpts);
      } else {
        const data = await docs.get('/search/articles', params);
        const items = data?.articles?.items ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  cmd
    .command('create')
    .description('Create an article')
    .requiredOption('--collection <id>', 'Collection ID')
    .requiredOption('--name <title>', 'Article title')
    .option('--text <html>', 'Article body HTML')
    .option('--status <status>', 'Status (published, notpublished)', 'notpublished')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {
        collectionId: opts.collection,
        name: opts.name,
        status: opts.status,
      };
      if (opts.text) body.text = opts.text;

      const data = await docs.post('/articles', body);
      output(data?.article ?? data ?? { ok: true }, globalOpts);
    });

  cmd
    .command('update <id>')
    .description('Update an article')
    .option('--name <title>', 'New title')
    .option('--text <html>', 'New body HTML')
    .option('--status <status>', 'New status (published, notpublished)')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {};
      if (opts.name) body.name = opts.name;
      if (opts.text) body.text = opts.text;
      if (opts.status) body.status = opts.status;

      const data = await docs.put(`/articles/${id}`, body);
      output(data?.article ?? { ok: true, id }, globalOpts);
    });

  cmd
    .command('delete <id>')
    .description('Delete an article')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await docs.delete(`/articles/${id}`);
      output({ ok: true, id }, globalOpts);
    });

  return cmd;
}
