/**
 * Tests for src/http.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocationId,
  parseCreatedResponse,
  unwrapSingleItemEnvelope,
  normalizeWriteResponse,
} from '../src/http.js';

function mockResponse({ status = 200, headers = {} }) {
  return {
    status,
    headers: {
      get: (name) => headers[name] ?? null,
    },
  };
}

test('parseLocationId extracts last path segment', () => {
  assert.equal(
    parseLocationId('https://docsapi.helpscout.net/v1/articles/63754159b00eaf68a3f3de6c'),
    '63754159b00eaf68a3f3de6c',
  );
});

test('unwrapSingleItemEnvelope unwraps nested resource', () => {
  assert.deepEqual(unwrapSingleItemEnvelope({ article: { id: 'abc', name: 'Test' } }), {
    id: 'abc',
    name: 'Test',
  });
});

test('parseCreatedResponse returns Location id for Docs 201', () => {
  const res = mockResponse({
    status: 201,
    headers: { Location: 'https://docsapi.helpscout.net/v1/articles/abc123' },
  });
  assert.deepEqual(parseCreatedResponse(res, null), {
    id: 'abc123',
    location: 'https://docsapi.helpscout.net/v1/articles/abc123',
  });
});

test('parseCreatedResponse returns Resource-ID for Mailbox 201', () => {
  const res = mockResponse({
    status: 201,
    headers: {
      'Resource-ID': '123',
      Location: 'https://api.helpscout.net/v2/conversations/123',
    },
  });
  assert.deepEqual(parseCreatedResponse(res, null), {
    id: 123,
    location: 'https://api.helpscout.net/v2/conversations/123',
  });
});

test('parseCreatedResponse prefers JSON body when present', () => {
  const res = mockResponse({ status: 201 });
  const body = { article: { id: 'from-body', name: 'Article' } };
  assert.deepEqual(parseCreatedResponse(res, body), { id: 'from-body', name: 'Article' });
});

test('normalizeWriteResponse returns id object from create response', () => {
  assert.deepEqual(normalizeWriteResponse({ id: 'abc', location: 'https://example.com/abc' }), {
    id: 'abc',
    location: 'https://example.com/abc',
  });
});
