/**
 * Live Docs API integration tests.
 *
 * Opt-in only — never runs during plain `npm test`, even if HELPSCOUT_API_KEY is set.
 *
 *   HELPSCOUT_RUN_INTEGRATION=1 npm test
 *   # or just this file:
 *   HELPSCOUT_RUN_INTEGRATION=1 node --test test/integration/docs.test.js
 *
 * Requires HELPSCOUT_API_KEY. Creates and deletes a draft article.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const runIntegration = process.env.HELPSCOUT_RUN_INTEGRATION === '1';
const skip = !runIntegration || !process.env.HELPSCOUT_API_KEY;

test('list_collections returns at least one collection', { skip }, async () => {
  const { docs } = await import('../../src/docs-client.js');
  const result = await docs.get('/collections');
  const collections = result?.collections?.items ?? [];
  assert.ok(Array.isArray(collections));
  assert.ok(collections.length > 0, 'expected at least one collection');
  assert.ok(collections[0].id, 'collection should have an id');
  assert.ok(collections[0].name, 'collection should have a name');
});

test('list_articles for a collection returns an array', { skip }, async () => {
  const { docs } = await import('../../src/docs-client.js');
  // Fetch first collection, then list its articles
  const collectionsResult = await docs.get('/collections');
  const collections = collectionsResult?.collections?.items ?? [];
  if (collections.length === 0) return; // nothing to test
  const collectionId = collections[0].id;
  const result = await docs.get(`/collections/${collectionId}/articles`);
  const articles = result?.articles?.items ?? [];
  assert.ok(Array.isArray(articles));
});

test('search_articles with a broad query returns results', { skip }, async () => {
  const { docs } = await import('../../src/docs-client.js');
  const result = await docs.get('/search/articles', { query: 'a' });
  const articles = result?.articles?.items ?? [];
  assert.ok(Array.isArray(articles));
});

test('article create returns id from Location header', { skip }, async () => {
  const { docs } = await import('../../src/docs-client.js');
  const collectionsResult = await docs.get('/collections');
  const collections = collectionsResult?.collections?.items ?? [];
  if (collections.length === 0) return;

  const collectionId = collections[0].id;
  const created = await docs.post('/articles', {
    collectionId,
    name: `CLI integration test ${Date.now()}`,
    status: 'notpublished',
  });
  assert.ok(created?.id, 'create should return id from Location header');

  const fetched = await docs.get(`/articles/${created.id}`);
  const article = fetched?.article ?? fetched;
  assert.equal(article.id, created.id);

  await docs.delete(`/articles/${created.id}`);
});
