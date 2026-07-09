import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArticleCreateBody,
  buildArticleUpdateBody,
  buildSiteCreateBody,
  buildSiteUpdateBody,
  buildCollectionUpdateBody,
  buildSiteRestrictionsBody,
  mergeRedirectUpdate,
  reloadParams,
} from '../src/docs-request-builders.js';

test('buildArticleCreateBody includes optional arrays when provided', () => {
  const body = buildArticleCreateBody({
    collectionId: 'c1',
    name: 'Title',
    text: '<p>Hi</p>',
    categories: ['cat1'],
    related: ['a2'],
    keywords: ['help'],
    slug: 'my-slug',
  });
  assert.deepEqual(body, {
    collectionId: 'c1',
    name: 'Title',
    text: '<p>Hi</p>',
    status: 'notpublished',
    slug: 'my-slug',
    categories: ['cat1'],
    related: ['a2'],
    keywords: ['help'],
  });
});

test('buildArticleUpdateBody supports null clears', () => {
  const body = buildArticleUpdateBody({
    name: 'New',
    clearCategories: true,
    clearKeywords: true,
  });
  assert.equal(body.name, 'New');
  assert.equal(body.categories, null);
  assert.equal(body.keywords, null);
  assert.equal(body.related, undefined);
});

test('buildSiteCreateBody collects site fields', () => {
  const body = buildSiteCreateBody({
    title: 'Docs',
    subDomain: 'docs',
    bgColor: '#fff',
    hasPublicSite: true,
  });
  assert.equal(body.title, 'Docs');
  assert.equal(body.subDomain, 'docs');
  assert.equal(body.bgColor, '#fff');
  assert.equal(body.hasPublicSite, true);
});

test('buildSiteUpdateBody omits unset fields', () => {
  const body = buildSiteUpdateBody({ title: 'Renamed' });
  assert.deepEqual(body, { title: 'Renamed' });
});

test('buildCollectionUpdateBody includes siteId move', () => {
  const body = buildCollectionUpdateBody({ siteId: 's2', name: 'Moved' });
  assert.deepEqual(body, { siteId: 's2', name: 'Moved' });
});

test('buildSiteRestrictionsBody sets authentication explicitly', () => {
  const body = buildSiteRestrictionsBody({
    enabled: true,
    authentication: 'CALLBACK',
    signInUrl: 'https://example.com/signin',
  });
  assert.equal(body.enabled, true);
  assert.equal(body.authentication, 'CALLBACK');
  assert.deepEqual(body.callbackConfiguration, { signInUrl: 'https://example.com/signin' });
});

test('mergeRedirectUpdate fills missing fields from existing', () => {
  const merged = mergeRedirectUpdate(
    { siteId: 's1', urlMapping: '/old', redirect: 'https://a.com' },
    { redirect: 'https://b.com' },
  );
  assert.deepEqual(merged, {
    siteId: 's1',
    urlMapping: '/old',
    redirect: 'https://b.com',
  });
});

test('reloadParams returns reload query when true', () => {
  assert.deepEqual(reloadParams(true), { reload: 'true' });
  assert.equal(reloadParams(false), undefined);
});
