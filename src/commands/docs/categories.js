/**
 * helpscout docs category <action>
 */
import { Command } from 'commander';
import { docs } from '../../docs-client.js';
import { normalizeWriteResponse } from '../../http.js';
import { output, outputTable } from '../../output.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'slug', header: 'Slug' },
  { key: 'order', header: 'Order' },
  { key: 'updatedAt', header: 'Updated' },
];

export function makeCategoryCommand() {
  const cmd = new Command('category');
  cmd.description('Manage Docs categories');

  cmd
    .command('list')
    .description('List categories in a collection')
    .requiredOption('--collection <id>', 'Collection ID')
    .option(
      '--sort <field>',
      'Sort field (order, number, name, articleCount, createdAt, updatedAt)',
    )
    .option('--order <dir>', 'Sort direction (asc, desc)')
    .option('--page <n>', 'Page number', '1')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const path = `/collections/${opts.collection}/categories`;
      const params = {};
      if (opts.sort) params.sort = opts.sort;
      if (opts.order) params.order = opts.order;

      if (opts.all) {
        const items = await docs.getAll(path, params);
        outputTable(items, COLUMNS, globalOpts);
      } else {
        params.page = opts.page;
        const data = await docs.get(path, params);
        const items = data?.categories?.items ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a category by ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await docs.get(`/categories/${id}`);
      output(data?.category ?? data, globalOpts);
    });

  cmd
    .command('create')
    .description('Create a category')
    .requiredOption('--collection <id>', 'Collection ID')
    .requiredOption('--name <name>', 'Category name')
    .option('--slug <slug>', 'URL slug')
    .option('--visibility <v>', 'public or private', 'public')
    .option('--order <n>', 'Display order', '1')
    .option('--default-sort <sort>', 'popularity or name', 'popularity')
    .option('--reload', 'Return the created category in the response')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {
        collectionId: opts.collection,
        name: opts.name,
        visibility: opts.visibility,
        order: Number(opts.order),
        defaultSort: opts.defaultSort,
      };
      if (opts.slug) body.slug = opts.slug;

      const params = opts.reload ? { reload: 'true' } : undefined;
      const data = await docs.post('/categories', body, params);
      output(normalizeWriteResponse(data), globalOpts);
    });

  cmd
    .command('update <id>')
    .description('Update a category')
    .option('--name <name>', 'Category name')
    .option('--slug <slug>', 'URL slug')
    .option('--visibility <v>', 'public or private')
    .option('--order <n>', 'Display order')
    .option('--default-sort <sort>', 'popularity or name')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {};
      if (opts.name) body.name = opts.name;
      if (opts.slug) body.slug = opts.slug;
      if (opts.visibility) body.visibility = opts.visibility;
      if (opts.order) body.order = Number(opts.order);
      if (opts.defaultSort) body.defaultSort = opts.defaultSort;

      const data = await docs.put(`/categories/${id}`, body);
      output(normalizeWriteResponse(data, { ok: true, id }), globalOpts);
    });

  cmd
    .command('order')
    .description('Update category order within a collection')
    .requiredOption('--collection <id>', 'Collection ID')
    .requiredOption('--json <payload>', 'JSON array of { id, order } objects')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const categories = JSON.parse(opts.json);
      await docs.put(`/collections/${opts.collection}/categories`, { categories });
      output({ ok: true }, globalOpts);
    });

  cmd
    .command('delete <id>')
    .description('Delete a category')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await docs.delete(`/categories/${id}`);
      output({ ok: true, id }, globalOpts);
    });

  return cmd;
}
