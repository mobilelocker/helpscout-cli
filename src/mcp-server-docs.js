/**
 * Docs API MCP tools for Help Scout.
 */
import { openAsBlob } from 'node:fs';
import { basename } from 'node:path';
import { z } from 'zod';
import { normalizeWriteResponse } from './http.js';

const ARTICLE_COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Title' },
  { key: 'status', header: 'Status' },
  { key: 'collectionId', header: 'Collection' },
  { key: 'updatedAt', header: 'Updated' },
];

const COLLECTION_COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'visibility', header: 'Visibility' },
  { key: 'updatedAt', header: 'Updated' },
];

const CATEGORY_COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'slug', header: 'Slug' },
  { key: 'order', header: 'Order' },
  { key: 'updatedAt', header: 'Updated' },
];

const REDIRECT_COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'siteId', header: 'Site' },
  { key: 'urlMapping', header: 'From' },
  { key: 'redirect', header: 'To' },
  { key: 'updatedAt', header: 'Updated' },
];

const SITE_COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'title', header: 'Title' },
  { key: 'subDomain', header: 'Subdomain' },
  { key: 'updatedAt', header: 'Updated' },
];

async function buildUploadForm(fields, filePath) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  const blob = await openAsBlob(filePath);
  form.append('file', blob, basename(filePath));
  return form;
}

export function registerDocsTools(server, { docs, ok, okMarkdown, fail }) {
  // ─── Articles ─────────────────────────────────────────────────────────────

  server.registerTool(
    'list_articles',
    {
      description: 'List Help Scout Docs articles in a collection or category.',
      inputSchema: {
        collectionId: z.string().optional().describe('Collection ID'),
        categoryId: z.string().optional().describe('Category ID'),
        status: z.enum(['published', 'notpublished']).optional(),
        all: z.boolean().optional(),
        markdown: z.boolean().optional(),
      },
    },
    async ({ collectionId, categoryId, status, all, markdown }) => {
      try {
        if (!collectionId && !categoryId) {
          return fail(new Error('Provide collectionId or categoryId'));
        }
        const params = {};
        if (status) params.status = status;
        const path = categoryId
          ? `/categories/${categoryId}/articles`
          : `/collections/${collectionId}/articles`;
        const rows = all
          ? await docs.getAll(path, params)
          : ((await docs.get(path, params))?.articles?.items ?? []);
        if (markdown) return okMarkdown(rows, ARTICLE_COLUMNS);
        return ok(rows);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_article',
    {
      description: 'Get a single Docs article by ID, including full body HTML.',
      inputSchema: { id: z.string().describe('Article ID') },
    },
    async ({ id }) => {
      try {
        const data = await docs.get(`/articles/${id}`);
        return ok(data?.article ?? data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'search_articles',
    {
      description: 'Search Help Scout Docs articles by keyword.',
      inputSchema: {
        query: z.string(),
        collectionId: z.string().optional(),
        status: z.enum(['published', 'notpublished']).optional(),
        all: z.boolean().optional(),
        markdown: z.boolean().optional(),
      },
    },
    async ({ query, collectionId, status, all, markdown }) => {
      try {
        const params = { query };
        if (collectionId) params.collectionId = collectionId;
        if (status) params.status = status;
        const rows = all
          ? await docs.getAll('/search/articles', params)
          : ((await docs.get('/search/articles', params))?.articles?.items ?? []);
        if (markdown) return okMarkdown(rows, ARTICLE_COLUMNS);
        return ok(rows);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'list_related_articles',
    {
      description: 'List articles related to a given article.',
      inputSchema: {
        id: z.string().describe('Article ID'),
        status: z.enum(['all', 'published', 'notpublished']).optional(),
        all: z.boolean().optional(),
        markdown: z.boolean().optional(),
      },
    },
    async ({ id, status, all, markdown }) => {
      try {
        const params = {};
        if (status) params.status = status;
        const path = `/articles/${id}/related`;
        const rows = all
          ? await docs.getAll(path, params)
          : ((await docs.get(path, params))?.articles?.items ?? []);
        if (markdown) return okMarkdown(rows, ARTICLE_COLUMNS);
        return ok(rows);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'list_article_revisions',
    {
      description: 'List revisions for a Docs article.',
      inputSchema: {
        id: z.string().describe('Article ID'),
        all: z.boolean().optional(),
        markdown: z.boolean().optional(),
      },
    },
    async ({ id, all, markdown }) => {
      try {
        const path = `/articles/${id}/revisions`;
        const columns = [
          { key: 'id', header: 'ID' },
          { key: 'articleId', header: 'Article' },
          { key: 'createdAt', header: 'Created' },
        ];
        const rows = all
          ? await docs.getAll(path)
          : ((await docs.get(path))?.revisions?.items ?? []);
        if (markdown) return okMarkdown(rows, columns);
        return ok(rows);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_article_revision',
    {
      description: 'Get a specific Docs article revision.',
      inputSchema: {
        articleId: z.string(),
        revisionId: z.string(),
      },
    },
    async ({ articleId, revisionId }) => {
      try {
        const data = await docs.get(`/articles/${articleId}/revisions/${revisionId}`);
        return ok(data?.revision ?? data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_article',
    {
      description: 'Create a new Help Scout Docs article (draft by default).',
      inputSchema: {
        collectionId: z.string(),
        name: z.string(),
        text: z.string().optional(),
        status: z.enum(['published', 'notpublished']).optional(),
        reload: z.boolean().optional().describe('Return full article in response'),
      },
    },
    async ({ collectionId, name, text, status, reload }) => {
      try {
        const body = { collectionId, name, status: status ?? 'notpublished' };
        if (text) body.text = text;
        const params = reload ? { reload: 'true' } : undefined;
        const data = await docs.post('/articles', body, params);
        return ok(normalizeWriteResponse(data));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'upload_article',
    {
      description: 'Create a Docs article by uploading an HTML, text, or Markdown file.',
      inputSchema: {
        collectionId: z.string(),
        filePath: z.string().describe('Absolute path to file on disk'),
        name: z.string().optional(),
        categoryId: z.string().optional(),
        type: z.enum(['html', 'text', 'markdown']).optional(),
        reload: z.boolean().optional(),
      },
    },
    async ({ collectionId, filePath, name, categoryId, type, reload }) => {
      try {
        const apiKey = process.env.HELPSCOUT_API_KEY;
        if (!apiKey) throw new Error('HELPSCOUT_API_KEY environment variable is not set.');
        const form = new FormData();
        form.append('key', apiKey);
        form.append('collectionId', collectionId);
        if (name) form.append('name', name);
        if (categoryId) form.append('categoryId', categoryId);
        if (type) form.append('type', type);
        const blob = await openAsBlob(filePath);
        form.append('file', blob, basename(filePath));
        const params = reload ? { reload: 'true' } : undefined;
        const data = await docs.upload('/articles/upload', form, params);
        return ok(normalizeWriteResponse(data));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_article',
    {
      description: 'Update an existing Help Scout Docs article.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        text: z.string().optional(),
        status: z.enum(['published', 'notpublished']).optional(),
      },
    },
    async ({ id, name, text, status }) => {
      try {
        const body = {};
        if (name) body.name = name;
        if (text) body.text = text;
        if (status) body.status = status;
        const data = await docs.put(`/articles/${id}`, body);
        return ok(normalizeWriteResponse(data, { ok: true, id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_article_view_count',
    {
      description: 'Increment the view count for a Docs article.',
      inputSchema: {
        id: z.string(),
        count: z.number().optional().describe('Views to add (default 1)'),
      },
    },
    async ({ id, count }) => {
      try {
        await docs.put(`/articles/${id}/views`, undefined, { count: String(count ?? 1) });
        return ok({ ok: true, id });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'save_article_draft',
    {
      description: 'Create or update a draft version of a Docs article.',
      inputSchema: {
        id: z.string(),
        text: z.string(),
      },
    },
    async ({ id, text }) => {
      try {
        await docs.put(`/articles/${id}/drafts`, { text });
        return ok({ ok: true, id });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'delete_article_draft',
    {
      description: 'Delete the draft version of a Docs article.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        await docs.delete(`/articles/${id}/drafts`);
        return ok({ ok: true, id });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'delete_article',
    {
      description: 'Delete a Help Scout Docs article.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        await docs.delete(`/articles/${id}`);
        return ok({ ok: true, id });
      } catch (e) {
        return fail(e);
      }
    },
  );

  // ─── Collections ────────────────────────────────────────────────────────────

  server.registerTool(
    'list_collections',
    {
      description: 'List Help Scout Docs collections.',
      inputSchema: {
        visibility: z.enum(['public', 'private']).optional(),
        siteId: z.string().optional(),
        all: z.boolean().optional(),
        markdown: z.boolean().optional(),
      },
    },
    async ({ visibility, siteId, all, markdown }) => {
      try {
        const params = {};
        if (visibility) params.visibility = visibility;
        if (siteId) params.siteId = siteId;
        const rows = all
          ? await docs.getAll('/collections', params)
          : ((await docs.get('/collections', params))?.collections?.items ?? []);
        if (markdown) return okMarkdown(rows, COLLECTION_COLUMNS);
        return ok(rows);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_collection',
    {
      description: 'Get a Help Scout Docs collection by ID.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        const data = await docs.get(`/collections/${id}`);
        return ok(data?.collection ?? data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_collection',
    {
      description: 'Create a Docs collection.',
      inputSchema: {
        siteId: z.string(),
        name: z.string(),
        visibility: z.enum(['public', 'private']).optional(),
        order: z.number().optional(),
        description: z.string().optional(),
        reload: z.boolean().optional(),
      },
    },
    async ({ siteId, name, visibility, order, description, reload }) => {
      try {
        const body = { siteId, name, visibility: visibility ?? 'public', order: order ?? 1 };
        if (description) body.description = description;
        const params = reload ? { reload: 'true' } : undefined;
        const data = await docs.post('/collections', body, params);
        return ok(normalizeWriteResponse(data));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_collection',
    {
      description: 'Update a Docs collection.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        visibility: z.enum(['public', 'private']).optional(),
        order: z.number().optional(),
        description: z.string().optional(),
      },
    },
    async ({ id, name, visibility, order, description }) => {
      try {
        const body = {};
        if (name) body.name = name;
        if (visibility) body.visibility = visibility;
        if (order !== undefined) body.order = order;
        if (description) body.description = description;
        const data = await docs.put(`/collections/${id}`, body);
        return ok(normalizeWriteResponse(data, { ok: true, id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'delete_collection',
    {
      description: 'Delete a Docs collection.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        await docs.delete(`/collections/${id}`);
        return ok({ ok: true, id });
      } catch (e) {
        return fail(e);
      }
    },
  );

  // ─── Categories ───────────────────────────────────────────────────────────

  server.registerTool(
    'list_categories',
    {
      description: 'List categories in a Docs collection.',
      inputSchema: {
        collectionId: z.string(),
        all: z.boolean().optional(),
        markdown: z.boolean().optional(),
      },
    },
    async ({ collectionId, all, markdown }) => {
      try {
        const path = `/collections/${collectionId}/categories`;
        const rows = all
          ? await docs.getAll(path)
          : ((await docs.get(path))?.categories?.items ?? []);
        if (markdown) return okMarkdown(rows, CATEGORY_COLUMNS);
        return ok(rows);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_category',
    {
      description: 'Get a Docs category by ID.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        const data = await docs.get(`/categories/${id}`);
        return ok(data?.category ?? data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_category',
    {
      description: 'Create a Docs category.',
      inputSchema: {
        collectionId: z.string(),
        name: z.string(),
        slug: z.string().optional(),
        visibility: z.enum(['public', 'private']).optional(),
        order: z.number().optional(),
        defaultSort: z.enum(['popularity', 'name']).optional(),
        reload: z.boolean().optional(),
      },
    },
    async ({ collectionId, name, slug, visibility, order, defaultSort, reload }) => {
      try {
        const body = {
          collectionId,
          name,
          visibility: visibility ?? 'public',
          order: order ?? 1,
          defaultSort: defaultSort ?? 'popularity',
        };
        if (slug) body.slug = slug;
        const params = reload ? { reload: 'true' } : undefined;
        const data = await docs.post('/categories', body, params);
        return ok(normalizeWriteResponse(data));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_category',
    {
      description: 'Update a Docs category.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        visibility: z.enum(['public', 'private']).optional(),
        order: z.number().optional(),
        defaultSort: z.enum(['popularity', 'name']).optional(),
      },
    },
    async ({ id, name, slug, visibility, order, defaultSort }) => {
      try {
        const body = {};
        if (name) body.name = name;
        if (slug) body.slug = slug;
        if (visibility) body.visibility = visibility;
        if (order !== undefined) body.order = order;
        if (defaultSort) body.defaultSort = defaultSort;
        const data = await docs.put(`/categories/${id}`, body);
        return ok(normalizeWriteResponse(data, { ok: true, id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_category_order',
    {
      description: 'Update display order for multiple categories in a collection.',
      inputSchema: {
        collectionId: z.string(),
        categories: z
          .array(z.object({ id: z.string(), order: z.number() }))
          .describe('Array of { id, order }'),
      },
    },
    async ({ collectionId, categories }) => {
      try {
        await docs.put(`/collections/${collectionId}/categories`, { categories });
        return ok({ ok: true, collectionId });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'delete_category',
    {
      description: 'Delete a Docs category.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        await docs.delete(`/categories/${id}`);
        return ok({ ok: true, id });
      } catch (e) {
        return fail(e);
      }
    },
  );

  // ─── Redirects ──────────────────────────────────────────────────────────────

  server.registerTool(
    'list_redirects',
    {
      description: 'List redirects for a Docs site.',
      inputSchema: {
        siteId: z.string(),
        all: z.boolean().optional(),
        markdown: z.boolean().optional(),
      },
    },
    async ({ siteId, all, markdown }) => {
      try {
        const path = `/redirects/site/${siteId}`;
        const rows = all
          ? await docs.getAll(path)
          : ((await docs.get(path))?.redirects?.items ?? []);
        if (markdown) return okMarkdown(rows, REDIRECT_COLUMNS);
        return ok(rows);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_redirect',
    {
      description: 'Get a Docs redirect by ID.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        const data = await docs.get(`/redirects/${id}`);
        return ok(data?.redirect ?? data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'find_redirect',
    {
      description: 'Resolve redirect destination for a URL path on a site.',
      inputSchema: {
        siteId: z.string(),
        url: z.string().describe('URL path, e.g. /article/22-title'),
      },
    },
    async ({ siteId, url }) => {
      try {
        const data = await docs.get('/redirects', { siteId, url });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_redirect',
    {
      description: 'Create a Docs redirect.',
      inputSchema: {
        siteId: z.string(),
        urlMapping: z.string(),
        redirect: z.string(),
        reload: z.boolean().optional(),
      },
    },
    async ({ siteId, urlMapping, redirect, reload }) => {
      try {
        const body = { siteId, urlMapping, redirect };
        const params = reload ? { reload: 'true' } : undefined;
        const data = await docs.post('/redirects', body, params);
        return ok(normalizeWriteResponse(data));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_redirect',
    {
      description: 'Update a Docs redirect.',
      inputSchema: {
        id: z.string(),
        urlMapping: z.string().optional(),
        redirect: z.string().optional(),
      },
    },
    async ({ id, urlMapping, redirect }) => {
      try {
        const body = {};
        if (urlMapping) body.urlMapping = urlMapping;
        if (redirect) body.redirect = redirect;
        const data = await docs.put(`/redirects/${id}`, body);
        return ok(normalizeWriteResponse(data, { ok: true, id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'delete_redirect',
    {
      description: 'Delete a Docs redirect.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        await docs.delete(`/redirects/${id}`);
        return ok({ ok: true, id });
      } catch (e) {
        return fail(e);
      }
    },
  );

  // ─── Sites ──────────────────────────────────────────────────────────────────

  server.registerTool(
    'list_sites',
    {
      description: 'List Help Scout Docs sites.',
      inputSchema: {
        all: z.boolean().optional(),
        markdown: z.boolean().optional(),
      },
    },
    async ({ all, markdown }) => {
      try {
        const rows = all
          ? await docs.getAll('/sites')
          : ((await docs.get('/sites'))?.sites?.items ?? []);
        if (markdown) return okMarkdown(rows, SITE_COLUMNS);
        return ok(rows);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_site',
    {
      description: 'Get a Docs site by ID.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        const data = await docs.get(`/sites/${id}`);
        return ok(data?.site ?? data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_site',
    {
      description: 'Create a Docs site.',
      inputSchema: {
        title: z.string(),
        subDomain: z.string(),
        reload: z.boolean().optional(),
      },
    },
    async ({ title, subDomain, reload }) => {
      try {
        const body = { title, subDomain };
        const params = reload ? { reload: 'true' } : undefined;
        const data = await docs.post('/sites', body, params);
        return ok(normalizeWriteResponse(data));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_site',
    {
      description: 'Update a Docs site.',
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        subDomain: z.string().optional(),
      },
    },
    async ({ id, title, subDomain }) => {
      try {
        const body = {};
        if (title) body.title = title;
        if (subDomain) body.subDomain = subDomain;
        const data = await docs.put(`/sites/${id}`, body);
        return ok(normalizeWriteResponse(data, { ok: true, id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'delete_site',
    {
      description: 'Delete a Docs site.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        await docs.delete(`/sites/${id}`);
        return ok({ ok: true, id });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_site_restrictions',
    {
      description: 'Get access restriction settings for a Docs site.',
      inputSchema: { siteId: z.string() },
    },
    async ({ siteId }) => {
      try {
        const data = await docs.get(`/sites/${siteId}/restricted`);
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_site_restrictions',
    {
      description: 'Update access restriction settings for a Docs site.',
      inputSchema: {
        siteId: z.string(),
        enabled: z.boolean().optional(),
        signInUrl: z.string().optional().describe('Custom callback sign-in URL'),
      },
    },
    async ({ siteId, enabled, signInUrl }) => {
      try {
        const body = {};
        if (enabled !== undefined) body.enabled = enabled;
        if (signInUrl) {
          body.authentication = 'CALLBACK';
          body.callbackConfiguration = { signInUrl };
        }
        const data = await docs.put(`/sites/${siteId}/restricted`, body);
        return ok(data ?? { ok: true, siteId });
      } catch (e) {
        return fail(e);
      }
    },
  );

  // ─── Assets ─────────────────────────────────────────────────────────────────

  server.registerTool(
    'create_article_asset',
    {
      description: 'Upload a file for use in a Docs article (image or attachment).',
      inputSchema: {
        articleId: z.string(),
        filePath: z.string().describe('Absolute path to file on disk'),
        assetType: z.enum(['image', 'attachment']),
        fileName: z.string().optional(),
      },
    },
    async ({ articleId, filePath, assetType, fileName }) => {
      try {
        const apiKey = process.env.HELPSCOUT_API_KEY;
        if (!apiKey) throw new Error('HELPSCOUT_API_KEY environment variable is not set.');
        const fields = { key: apiKey, articleId, assetType };
        if (fileName) fields.fileName = fileName;
        const form = await buildUploadForm(fields, filePath);
        const data = await docs.upload('/assets/article', form);
        return ok(normalizeWriteResponse(data));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_settings_asset',
    {
      description: 'Upload a global Docs settings image (logo, favicon, or touchicon).',
      inputSchema: {
        filePath: z.string().describe('Absolute path to image on disk'),
        assetType: z.enum(['logo', 'favicon', 'touchicon']),
      },
    },
    async ({ filePath, assetType }) => {
      try {
        const apiKey = process.env.HELPSCOUT_API_KEY;
        if (!apiKey) throw new Error('HELPSCOUT_API_KEY environment variable is not set.');
        const form = await buildUploadForm({ key: apiKey, assetType }, filePath);
        const data = await docs.upload('/assets/settings', form);
        return ok(normalizeWriteResponse(data));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
