/**
 * MCP tool coverage for filePath body resolution (Docs + Mailbox content tools).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { registerDocsTools } from '../src/mcp-server-docs.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let tempDir;
let bodyFile;

function makeToolRegistry() {
  const tools = new Map();
  return {
    tools,
    server: {
      registerTool(name, config, handler) {
        tools.set(name, { config, handler });
      },
    },
  };
}

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function fail(e) {
  return { content: [{ type: 'text', text: e?.message ?? String(e) }], isError: true };
}

function parseOk(result) {
  assert.equal(result.isError, undefined);
  return JSON.parse(result.content[0].text);
}

function parseErr(result) {
  assert.equal(result.isError, true);
  return result.content[0].text;
}

before(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'helpscout-mcp-text-or-file-'));
  bodyFile = join(tempDir, 'body.html');
  writeFileSync(bodyFile, '<p>MCP file body</p>\n', 'utf8');
});

after(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

test('create_article with filePath posts file contents as text', async () => {
  const calls = [];
  const docs = {
    post: async (path, body) => {
      calls.push({ path, body });
      return { id: 'a1', location: 'https://example/a1' };
    },
  };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  const result = await tools.get('create_article').handler({
    collectionId: 'c1',
    name: 'Title',
    filePath: bodyFile,
  });
  const data = parseOk(result);
  assert.equal(data.id, 'a1');
  assert.equal(calls[0].body.text, '<p>MCP file body</p>\n');
  assert.equal(calls[0].body.collectionId, 'c1');
});

test('create_article with text posts inline body', async () => {
  const calls = [];
  const docs = {
    post: async (_path, body) => {
      calls.push(body);
      return { id: 'a2' };
    },
  };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  await tools.get('create_article').handler({
    collectionId: 'c1',
    name: 'Title',
    text: '<p>Inline</p>',
  });
  assert.equal(calls[0].text, '<p>Inline</p>');
});

test('create_article returns error when both text and filePath are set', async () => {
  const docs = { post: async () => assert.fail('should not call API') };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  const result = await tools.get('create_article').handler({
    collectionId: 'c1',
    name: 'Title',
    text: '<p>x</p>',
    filePath: bodyFile,
  });
  assert.match(parseErr(result), /Provide either text or filePath, not both/);
});

test('create_article returns error when neither text nor filePath is set', async () => {
  const docs = { post: async () => assert.fail('should not call API') };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  const result = await tools.get('create_article').handler({
    collectionId: 'c1',
    name: 'Title',
  });
  assert.match(parseErr(result), /Either text or filePath is required/);
});

test('create_article returns error for missing filePath', async () => {
  const docs = { post: async () => assert.fail('should not call API') };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  const result = await tools.get('create_article').handler({
    collectionId: 'c1',
    name: 'Title',
    filePath: join(tempDir, 'missing.html'),
  });
  assert.match(parseErr(result), /File not found/);
});

test('update_article with filePath puts file contents as text', async () => {
  const calls = [];
  const docs = {
    put: async (path, body) => {
      calls.push({ path, body });
      return null;
    },
  };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  const result = await tools.get('update_article').handler({
    id: 'art-1',
    filePath: bodyFile,
  });
  parseOk(result);
  assert.equal(calls[0].path, '/articles/art-1');
  assert.equal(calls[0].body.text, '<p>MCP file body</p>\n');
});

test('update_article without text or filePath omits text field', async () => {
  const calls = [];
  const docs = {
    put: async (_path, body) => {
      calls.push(body);
      return null;
    },
  };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  await tools.get('update_article').handler({ id: 'art-1', name: 'Only name' });
  assert.equal(calls[0].name, 'Only name');
  assert.equal('text' in calls[0], false);
});

test('update_article returns error when both text and filePath are set', async () => {
  const docs = { put: async () => assert.fail('should not call API') };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  const result = await tools.get('update_article').handler({
    id: 'art-1',
    text: '<p>x</p>',
    filePath: bodyFile,
  });
  assert.match(parseErr(result), /Provide either text or filePath, not both/);
});

test('save_article_draft with filePath puts file contents as text', async () => {
  const calls = [];
  const docs = {
    put: async (path, body) => {
      calls.push({ path, body });
      return null;
    },
  };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  const result = await tools.get('save_article_draft').handler({
    id: 'art-1',
    filePath: bodyFile,
  });
  parseOk(result);
  assert.equal(calls[0].path, '/articles/art-1/drafts');
  assert.equal(calls[0].body.text, '<p>MCP file body</p>\n');
});

test('save_article_draft requires text or filePath', async () => {
  const docs = { put: async () => assert.fail('should not call API') };
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, { docs, ok, okMarkdown: ok, fail });

  const result = await tools.get('save_article_draft').handler({ id: 'art-1' });
  assert.match(parseErr(result), /Either text or filePath is required/);
});

test('MCP docs tool schemas expose filePath on create/update/draft', () => {
  const { server, tools } = makeToolRegistry();
  registerDocsTools(server, {
    docs: {},
    ok,
    okMarkdown: ok,
    fail,
  });

  for (const name of ['create_article', 'update_article', 'save_article_draft']) {
    const schema = tools.get(name).config.inputSchema;
    assert.ok(schema.filePath, `${name} should expose filePath in inputSchema`);
    assert.ok(schema.text, `${name} should expose text in inputSchema`);
  }
});

test('MCP mailbox content tools expose filePath in source schemas', () => {
  const source = readFileSync(join(ROOT, 'src', 'mcp-server.js'), 'utf8');

  for (const tool of ['create_conversation', 'reply_to_conversation', 'add_note']) {
    const start = source.indexOf(`'${tool}'`);
    assert.ok(start >= 0, `${tool} not found`);
    const next = source.indexOf('server.registerTool(', start + 1);
    const block = source.slice(start, next > 0 ? next : undefined);
    assert.match(block, /\bfilePath\b/, `${tool} schema should include filePath`);
  }

  // create_conversation uses body + filePath; reply/note use text + filePath
  assert.match(source, /paramNames:\s*\{\s*text:\s*'body',\s*file:\s*'filePath'\s*\}/);
  assert.match(source, /resolveTextOrFile\(\{\s*text,\s*filePath,\s*required:\s*true\s*\}\)/);
});

test('CLI command sources wire --file for article and inbox content commands', () => {
  const articles = readFileSync(join(ROOT, 'src', 'commands', 'docs', 'articles.js'), 'utf8');
  const threads = readFileSync(join(ROOT, 'src', 'commands', 'inbox', 'threads.js'), 'utf8');
  const conversations = readFileSync(
    join(ROOT, 'src', 'commands', 'inbox', 'conversations.js'),
    'utf8',
  );

  assert.match(articles, /command\('create'\)[\s\S]*--file <path>/);
  assert.match(articles, /command\('update <id>'\)[\s\S]*--file <path>/);
  assert.match(articles, /command\('save-draft <id>'\)[\s\S]*--file <path>/);
  assert.match(threads, /command\('reply <conversationId>'\)[\s\S]*--file <path>/);
  assert.match(threads, /command\('note <conversationId>'\)[\s\S]*--file <path>/);
  assert.match(conversations, /command\('create'\)[\s\S]*--file <path>/);
  assert.match(conversations, /paramNames:\s*\{\s*text:\s*'--body',\s*file:\s*'--file'\s*\}/);
});
