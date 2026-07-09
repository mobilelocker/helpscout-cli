/**
 * helpscout docs article <action>
 */
import { openAsBlob } from 'node:fs';
import { basename } from 'node:path';
import { Command } from 'commander';
import { docs } from '../../docs-client.js';
import { normalizeWriteResponse } from '../../http.js';
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
    .description('List articles in a collection or category')
    .option('--collection <id>', 'Collection ID')
    .option('--category <id>', 'Category ID')
    .option('--status <status>', 'Filter by status (published, notpublished)', 'published')
    .option('--page <n>', 'Page number', '1')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      if (!opts.collection && !opts.category) {
        throw new Error('Provide --collection or --category');
      }

      const params = { status: opts.status };
      const path = opts.category
        ? `/categories/${opts.category}/articles`
        : `/collections/${opts.collection}/articles`;

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
    .command('list-related <id>')
    .description('List articles related to an article')
    .option('--status <status>', 'Status filter', 'all')
    .option('--all', 'Fetch all pages')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const params = { status: opts.status };
      const path = `/articles/${id}/related`;

      if (opts.all) {
        const items = await docs.getAll(path, params);
        outputTable(items, COLUMNS, globalOpts);
      } else {
        const data = await docs.get(path, params);
        const items = data?.articles?.items ?? [];
        outputTable(items, COLUMNS, globalOpts);
      }
    });

  cmd
    .command('list-revisions <id>')
    .description('List revisions for an article')
    .option('--all', 'Fetch all pages')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const path = `/articles/${id}/revisions`;
      const revColumns = [
        { key: 'id', header: 'ID' },
        { key: 'articleId', header: 'Article' },
        { key: 'createdAt', header: 'Created' },
      ];

      if (opts.all) {
        const items = await docs.getAll(path);
        outputTable(items, revColumns, globalOpts);
      } else {
        const data = await docs.get(path);
        const items = data?.revisions?.items ?? [];
        outputTable(items, revColumns, globalOpts);
      }
    });

  cmd
    .command('get-revision <articleId> <revisionId>')
    .description('Get a specific article revision')
    .action(async (articleId, revisionId, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const data = await docs.get(`/articles/${articleId}/revisions/${revisionId}`);
      output(data?.revision ?? data, globalOpts);
    });

  cmd
    .command('create')
    .description('Create an article')
    .requiredOption('--collection <id>', 'Collection ID')
    .requiredOption('--name <title>', 'Article title')
    .option('--text <html>', 'Article body HTML')
    .option('--status <status>', 'Status (published, notpublished)', 'notpublished')
    .option('--reload', 'Return the created article in the response')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {
        collectionId: opts.collection,
        name: opts.name,
        status: opts.status,
      };
      if (opts.text) body.text = opts.text;

      const params = opts.reload ? { reload: 'true' } : undefined;
      const data = await docs.post('/articles', body, params);
      output(normalizeWriteResponse(data), globalOpts);
    });

  cmd
    .command('upload')
    .description('Create an article by uploading a file (HTML, text, or Markdown)')
    .requiredOption('--collection <id>', 'Collection ID')
    .requiredOption('--file <path>', 'File to upload')
    .option('--name <title>', 'Article title (defaults to file name)')
    .option('--category <id>', 'Category ID')
    .option('--type <type>', 'html, text, or markdown')
    .option('--reload', 'Return the created article in the response')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const apiKey = process.env.HELPSCOUT_API_KEY;
      if (!apiKey) throw new Error('HELPSCOUT_API_KEY environment variable is not set.');

      const form = new FormData();
      form.append('key', apiKey);
      form.append('collectionId', opts.collection);
      if (opts.name) form.append('name', opts.name);
      if (opts.category) form.append('categoryId', opts.category);
      if (opts.type) form.append('type', opts.type);
      const blob = await openAsBlob(opts.file);
      form.append('file', blob, basename(opts.file));

      const params = opts.reload ? { reload: 'true' } : undefined;
      const data = await docs.upload('/articles/upload', form, params);
      output(normalizeWriteResponse(data), globalOpts);
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
      output(normalizeWriteResponse(data, { ok: true, id }), globalOpts);
    });

  cmd
    .command('update-view-count <id>')
    .description('Increment article view count')
    .option('--count <n>', 'Number of views to add', '1')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await docs.put(`/articles/${id}/views`, undefined, { count: opts.count });
      output({ ok: true, id }, globalOpts);
    });

  cmd
    .command('save-draft <id>')
    .description('Create or update a draft version of an article')
    .requiredOption('--text <html>', 'Draft body HTML')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await docs.put(`/articles/${id}/drafts`, { text: opts.text });
      output({ ok: true, id }, globalOpts);
    });

  cmd
    .command('delete-draft <id>')
    .description('Delete the draft version of an article')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await docs.delete(`/articles/${id}/drafts`);
      output({ ok: true, id }, globalOpts);
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
