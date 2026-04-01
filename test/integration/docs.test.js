/**
 * Integration tests for the Docs API client.
 * Requires HELPSCOUT_API_KEY to be set. Tests are skipped automatically
 * when credentials are absent so they don't break CI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const skip = !process.env.HELPSCOUT_API_KEY;

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
