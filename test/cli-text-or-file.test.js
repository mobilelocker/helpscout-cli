/**
 * CLI coverage for --file / --text body resolution on articles and inbox commands.
 *
 * Network safety:
 * - global fetch is replaced with a stub that never calls through to the network
 * - env credentials are overridden with fakes for the suite duration
 * - OAuth token cache is temporarily replaced with a non-secret placeholder so
 *   mailbox commands can build Authorization headers; the real cache is restored
 *   afterward. The placeholder token is never sent over the network.
 */
import { describe, it, mock, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { Command } from 'commander';
import { makeArticleCommand } from '../src/commands/docs/articles.js';
import { makeConversationCommand } from '../src/commands/inbox/conversations.js';
import { makeThreadCommand } from '../src/commands/inbox/threads.js';

const TOKEN_PATH = join(homedir(), '.cache', 'helpscout', 'token.json');
const FAKE_TOKEN = JSON.stringify({
  access_token: 'test-access-token-not-real',
  refresh_token: 'test-refresh-token-not-real',
  expires_at: Date.now() + 3_600_000,
});

describe('CLI text-or-file body loading', () => {
  let tempDir;
  let bodyFile;
  let originalEnv;
  let originalToken;
  let originalFetch;
  let originalStdoutWrite;
  let fetchStub;
  const fetchCalls = [];

  function makeFetchStub() {
    return mock.fn(async (url, opts = {}) => {
      // Hard fence: this stub must never delegate to the real network.
      fetchCalls.push({
        url: String(url),
        method: opts.method ?? 'GET',
        body: typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body,
      });
      return {
        ok: true,
        status: 201,
        headers: {
          get: (h) => {
            if (h === 'Location') return 'https://docsapi.helpscout.net/v1/articles/art-1';
            if (h === 'Resource-ID') return '99';
            return null;
          },
        },
        text: async () => '',
        json: async () => null,
      };
    });
  }

  function installNetworkFence() {
    originalFetch = globalThis.fetch;
    fetchStub = makeFetchStub();
    globalThis.fetch = fetchStub;
  }

  function makeCliRoot(addCommands) {
    const root = new Command();
    root.exitOverride();
    root.option('--json');
    root.configureOutput({ writeOut: () => {}, writeErr: () => {} });
    addCommands(root);
    return root;
  }

  async function runCli(root, args) {
    assert.equal(globalThis.fetch, fetchStub, 'fetch stub must remain installed');
    await root.parseAsync(['node', 'helpscout', ...args, '--json'], { from: 'node' });
  }

  /**
   * Swallow CLI JSON lines on stdout without blocking the test runner's TAP output.
   */
  function installStdoutJsonFilter() {
    originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, encoding, cb) => {
      const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      if (/^\s*[{[]/.test(text)) {
        if (typeof encoding === 'function') encoding();
        else if (typeof cb === 'function') cb();
        return true;
      }
      return originalStdoutWrite(chunk, encoding, cb);
    };
  }

  before(async () => {
    originalEnv = {
      HELPSCOUT_API_KEY: process.env.HELPSCOUT_API_KEY,
      HELPSCOUT_APP_ID: process.env.HELPSCOUT_APP_ID,
      HELPSCOUT_APP_SECRET: process.env.HELPSCOUT_APP_SECRET,
    };
    originalToken = existsSync(TOKEN_PATH) ? readFileSync(TOKEN_PATH, 'utf8') : null;
    installStdoutJsonFilter();
    installNetworkFence();

    // Fake credentials + placeholder token (not sent anywhere; fetch is fenced).
    process.env.HELPSCOUT_API_KEY = 'test-api-key-not-real';
    process.env.HELPSCOUT_APP_ID = 'test-app-id-not-real';
    process.env.HELPSCOUT_APP_SECRET = 'test-app-secret-not-real';
    await mkdir(join(homedir(), '.cache', 'helpscout'), { recursive: true });
    await writeFile(TOKEN_PATH, FAKE_TOKEN);

    tempDir = mkdtempSync(join(tmpdir(), 'helpscout-cli-text-or-file-'));
    bodyFile = join(tempDir, 'body.html');
    writeFileSync(bodyFile, '<p>File body content</p>\n', 'utf8');
  });

  afterEach(() => {
    fetchCalls.length = 0;
    // Reinstall a fresh stub each test so call history stays isolated.
    fetchStub = makeFetchStub();
    globalThis.fetch = fetchStub;
  });

  after(async () => {
    if (originalStdoutWrite) process.stdout.write = originalStdoutWrite;
    if (originalFetch) globalThis.fetch = originalFetch;

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    if (originalToken === null) {
      try {
        await unlink(TOKEN_PATH);
      } catch {
        // ignore
      }
    } else {
      await writeFile(TOKEN_PATH, originalToken);
    }

    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('article create from file posts file contents as text', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await runCli(root, [
      'article',
      'create',
      '--collection',
      'col-1',
      '--name',
      'From file',
      '--file',
      bodyFile,
    ]);

    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /^https:\/\/docsapi\.helpscout\.net\/v1\/articles$/);
    assert.equal(fetchCalls[0].method, 'POST');
    assert.equal(fetchCalls[0].body.text, '<p>File body content</p>\n');
    assert.equal(fetchCalls[0].body.collectionId, 'col-1');
    assert.equal(fetchCalls[0].body.name, 'From file');
    assert.equal(fetchStub.mock.callCount(), 1);
  });

  it('article create from inline text posts that text', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await runCli(root, [
      'article',
      'create',
      '--collection',
      'col-1',
      '--name',
      'Inline',
      '--text',
      '<p>Inline</p>',
    ]);

    assert.equal(fetchCalls[0].body.text, '<p>Inline</p>');
  });

  it('article create rejects both text and file flags', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await assert.rejects(
      () =>
        runCli(root, [
          'article',
          'create',
          '--collection',
          'col-1',
          '--name',
          'Both',
          '--text',
          '<p>x</p>',
          '--file',
          bodyFile,
        ]),
      /Provide either --text or --file, not both/,
    );
    assert.equal(fetchCalls.length, 0);
  });

  it('article create requires text or file', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await assert.rejects(
      () => runCli(root, ['article', 'create', '--collection', 'col-1', '--name', 'None']),
      /Either --text or --file is required/,
    );
    assert.equal(fetchCalls.length, 0);
  });

  it('article create rejects missing file path', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await assert.rejects(
      () =>
        runCli(root, [
          'article',
          'create',
          '--collection',
          'col-1',
          '--name',
          'Missing',
          '--file',
          join(tempDir, 'does-not-exist.html'),
        ]),
      /File not found/,
    );
    assert.equal(fetchCalls.length, 0);
  });

  it('article update from file puts file contents as text', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await runCli(root, ['article', 'update', 'art-9', '--file', bodyFile]);

    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /\/articles\/art-9$/);
    assert.equal(fetchCalls[0].method, 'PUT');
    assert.equal(fetchCalls[0].body.text, '<p>File body content</p>\n');
  });

  it('article update without body omits text', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await runCli(root, ['article', 'update', 'art-9', '--name', 'Renamed only']);

    assert.equal(fetchCalls[0].body.name, 'Renamed only');
    assert.equal('text' in fetchCalls[0].body, false);
  });

  it('article update rejects both text and file flags', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await assert.rejects(
      () => runCli(root, ['article', 'update', 'art-9', '--text', '<p>x</p>', '--file', bodyFile]),
      /Provide either --text or --file, not both/,
    );
    assert.equal(fetchCalls.length, 0);
  });

  it('article save-draft from file puts file contents as text', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await runCli(root, ['article', 'save-draft', 'art-9', '--file', bodyFile]);

    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /\/articles\/art-9\/drafts$/);
    assert.equal(fetchCalls[0].method, 'PUT');
    assert.equal(fetchCalls[0].body.text, '<p>File body content</p>\n');
  });

  it('article save-draft requires text or file', async () => {
    const root = makeCliRoot((r) => r.addCommand(makeArticleCommand()));
    await assert.rejects(
      () => runCli(root, ['article', 'save-draft', 'art-9']),
      /Either --text or --file is required/,
    );
  });

  it('thread reply from file posts file contents', async () => {
    // Mailbox client may read a local token cache for the Authorization header value,
    // but fetch is fenced so nothing is sent to the real API.
    const root = makeCliRoot((r) => {
      const inbox = new Command('inbox');
      inbox.addCommand(makeThreadCommand());
      r.addCommand(inbox);
    });
    await runCli(root, ['inbox', 'thread', 'reply', '42', '--file', bodyFile]);

    assert.equal(fetchCalls.length, 1);
    assert.match(
      fetchCalls[0].url,
      /^https:\/\/api\.helpscout\.net\/v2\/conversations\/42\/threads\/reply$/,
    );
    assert.equal(fetchCalls[0].body.type, 'reply');
    assert.equal(fetchCalls[0].body.text, '<p>File body content</p>\n');
  });

  it('thread reply from inline text posts that text', async () => {
    const root = makeCliRoot((r) => {
      const inbox = new Command('inbox');
      inbox.addCommand(makeThreadCommand());
      r.addCommand(inbox);
    });
    await runCli(root, ['inbox', 'thread', 'reply', '42', '--text', '<p>Thanks</p>']);

    assert.equal(fetchCalls[0].body.text, '<p>Thanks</p>');
  });

  it('thread reply requires text or file', async () => {
    const root = makeCliRoot((r) => {
      const inbox = new Command('inbox');
      inbox.addCommand(makeThreadCommand());
      r.addCommand(inbox);
    });
    await assert.rejects(
      () => runCli(root, ['inbox', 'thread', 'reply', '42']),
      /Either --text or --file is required/,
    );
  });

  it('thread note from file posts file contents', async () => {
    const root = makeCliRoot((r) => {
      const inbox = new Command('inbox');
      inbox.addCommand(makeThreadCommand());
      r.addCommand(inbox);
    });
    await runCli(root, ['inbox', 'thread', 'note', '42', '--file', bodyFile]);

    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /\/conversations\/42\/threads\/note$/);
    assert.equal(fetchCalls[0].body.type, 'note');
    assert.equal(fetchCalls[0].body.text, '<p>File body content</p>\n');
  });

  it('conversation create from file includes thread with file body', async () => {
    const root = makeCliRoot((r) => {
      const inbox = new Command('inbox');
      inbox.addCommand(makeConversationCommand());
      r.addCommand(inbox);
    });
    await runCli(root, [
      'inbox',
      'conversation',
      'create',
      '--subject',
      'Hello',
      '--mailbox-id',
      '7',
      '--customer-email',
      'a@example.com',
      '--file',
      bodyFile,
    ]);

    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /^https:\/\/api\.helpscout\.net\/v2\/conversations$/);
    assert.deepEqual(fetchCalls[0].body.threads, [
      { type: 'customer', text: '<p>File body content</p>\n' },
    ]);
  });

  it('conversation create without body or file omits threads', async () => {
    const root = makeCliRoot((r) => {
      const inbox = new Command('inbox');
      inbox.addCommand(makeConversationCommand());
      r.addCommand(inbox);
    });
    await runCli(root, [
      'inbox',
      'conversation',
      'create',
      '--subject',
      'Hello',
      '--mailbox-id',
      '7',
      '--customer-email',
      'a@example.com',
    ]);

    assert.equal('threads' in fetchCalls[0].body, false);
  });

  it('conversation create rejects both body and file flags', async () => {
    const root = makeCliRoot((r) => {
      const inbox = new Command('inbox');
      inbox.addCommand(makeConversationCommand());
      r.addCommand(inbox);
    });
    await assert.rejects(
      () =>
        runCli(root, [
          'inbox',
          'conversation',
          'create',
          '--subject',
          'Hello',
          '--mailbox-id',
          '7',
          '--customer-email',
          'a@example.com',
          '--body',
          '<p>x</p>',
          '--file',
          bodyFile,
        ]),
      /Provide either --body or --file, not both/,
    );
    assert.equal(fetchCalls.length, 0);
  });
});
