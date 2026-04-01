/**
 * Help Scout MCP server.
 * Exposes Help Scout Mailbox API v2 and Docs API v1 as MCP tools.
 * Runs over stdio — do not write to stdout (corrupts JSON-RPC messages).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { login, logout, status } from './auth.js';
import { mailbox } from './mailbox-client.js';
import { docs } from './docs-client.js';

// 26 tools:
//   Auth (3):         auth_status, auth_login, auth_logout
//   Conversations (5): list_conversations, get_conversation, create_conversation,
//                      update_conversation, delete_conversation
//   Threads (3):      list_threads, reply_to_conversation, add_note
//   Customers (4):    list_customers, get_customer, create_customer, update_customer
//   Mailboxes (1):    list_mailboxes
//   Users (3):        list_users, get_current_user (get_user via list)
//   Tags (1):         list_tags
//   Articles (6):     list_articles, get_article, search_articles, create_article,
//                     update_article, delete_article
//   Collections (2):  list_collections, get_collection
const server = new McpServer({ name: 'helpscout', version: '1.0.0' });

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function okMarkdown(rows, columns) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { content: [{ type: 'text', text: '(no results)' }] };
  }
  const escape = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const header = '| ' + columns.map((c) => escape(c.header)).join(' | ') + ' |';
  const divider = '| ' + columns.map(() => '---').join(' | ') + ' |';
  const body = rows.map((row) => {
    const cells = columns.map((c) => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return escape(JSON.stringify(val));
      return escape(val);
    });
    return '| ' + cells.join(' | ') + ' |';
  });
  const table = [header, divider, ...body].join('\n');
  return { content: [{ type: 'text', text: table }] };
}

function fail(e) {
  return { content: [{ type: 'text', text: e?.message ?? String(e) }], isError: true };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

server.registerTool(
  'auth_status',
  {
    description:
      'Check Help Scout authentication status. Call this before other tools if you are unsure whether the user is authenticated.',
    inputSchema: {},
  },
  async () => {
    try {
      return ok(await status());
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'auth_login',
  {
    description:
      'Start the Help Scout OAuth flow. Opens a browser window for the user to authorize access. Waits until authentication completes before returning.',
    inputSchema: {},
  },
  async () => {
    try {
      return ok(await login());
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'auth_logout',
  {
    description: 'Remove the cached Help Scout OAuth token.',
    inputSchema: {},
  },
  async () => {
    try {
      return ok(await logout());
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Conversations ────────────────────────────────────────────────────────────

server.registerTool(
  'list_conversations',
  {
    description: 'List conversations from the Help Scout inbox.',
    inputSchema: {
      mailboxId: z.number().optional().describe('Filter by mailbox ID'),
      status: z
        .enum(['active', 'closed', 'spam', 'pending'])
        .optional()
        .describe('Filter by status (default: active)'),
      tag: z.string().optional().describe('Filter by tag name'),
      assignedTo: z.number().optional().describe('Filter by assigned user ID'),
      all: z.boolean().optional().describe('Fetch all pages (default: returns first page only)'),
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
    },
  },
  async ({ mailboxId, status, tag, assignedTo, all, markdown }) => {
    try {
      const params = {};
      if (mailboxId) params.mailboxId = mailboxId;
      if (status) params.status = status;
      if (tag) params.tag = tag;
      if (assignedTo) params.assignedTo = assignedTo;
      const rows = all
        ? await mailbox.getAll('/conversations', 'conversations', params)
        : ((await mailbox.get('/conversations', params))?._embedded?.conversations ?? []);
      if (markdown) {
        return okMarkdown(
          rows.map((c) => ({
            ...c,
            assignee: c.assignee ? `${c.assignee.first} ${c.assignee.last}`.trim() : '',
          })),
          [
            { key: 'id', header: 'ID' },
            { key: 'subject', header: 'Subject' },
            { key: 'status', header: 'Status' },
            { key: 'assignee', header: 'Assignee' },
            { key: 'createdAt', header: 'Created' },
          ],
        );
      }
      return ok(rows);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'get_conversation',
  {
    description: 'Get a single conversation by ID, including all fields.',
    inputSchema: {
      id: z.number().describe('Conversation ID'),
    },
  },
  async ({ id }) => {
    try {
      return ok(await mailbox.get(`/conversations/${id}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'create_conversation',
  {
    description: 'Create a new conversation in Help Scout.',
    inputSchema: {
      subject: z.string().describe('Conversation subject'),
      mailboxId: z.number().describe('Mailbox ID to create the conversation in'),
      customerEmail: z.string().describe('Customer email address'),
      body: z.string().optional().describe('Initial message body (HTML allowed)'),
      status: z
        .enum(['active', 'closed', 'pending'])
        .optional()
        .describe('Status (default: active)'),
      type: z
        .enum(['email', 'chat', 'phone'])
        .optional()
        .describe('Conversation type (default: email)'),
      tags: z.array(z.string()).optional().describe('Tags to apply'),
      assignedTo: z.number().optional().describe('User ID to assign the conversation to'),
    },
  },
  async ({ subject, mailboxId, customerEmail, body, status, type, tags, assignedTo }) => {
    try {
      const payload = {
        subject,
        mailboxId,
        customer: { email: customerEmail },
        status: status ?? 'active',
        type: type ?? 'email',
      };
      if (body) payload.threads = [{ type: 'customer', body }];
      if (tags) payload.tags = tags;
      if (assignedTo) payload.assignTo = assignedTo;
      return ok(await mailbox.post('/conversations', payload));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'update_conversation',
  {
    description: 'Update a conversation status, subject, assignment, or mailbox.',
    inputSchema: {
      id: z.number().describe('Conversation ID'),
      status: z.enum(['active', 'closed', 'spam', 'pending']).optional(),
      subject: z.string().optional(),
      assignedTo: z.number().optional().describe('User ID to assign to'),
      mailboxId: z.number().optional().describe('Move to a different mailbox'),
    },
  },
  async ({ id, status, subject, assignedTo, mailboxId }) => {
    try {
      const body = {};
      if (status) body.status = status;
      if (subject) body.subject = subject;
      if (assignedTo) body.assignTo = assignedTo;
      if (mailboxId) body.mailboxId = mailboxId;
      await mailbox.patch(`/conversations/${id}`, body);
      return ok({ ok: true, id });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'delete_conversation',
  {
    description: 'Permanently delete a conversation.',
    inputSchema: {
      id: z.number().describe('Conversation ID'),
    },
  },
  async ({ id }) => {
    try {
      await mailbox.delete(`/conversations/${id}`);
      return ok({ ok: true, id });
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Threads ──────────────────────────────────────────────────────────────────

server.registerTool(
  'list_threads',
  {
    description: 'List all threads (messages and notes) in a conversation.',
    inputSchema: {
      conversationId: z.number().describe('Conversation ID'),
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
    },
  },
  async ({ conversationId, markdown }) => {
    try {
      const data = await mailbox.get(`/conversations/${conversationId}/threads`);
      const rows = data?._embedded?.threads ?? [];
      if (markdown) {
        return okMarkdown(
          rows.map((t) => ({
            ...t,
            author: t.createdBy
              ? t.createdBy.first || t.createdBy.last
                ? `${t.createdBy.first ?? ''} ${t.createdBy.last ?? ''}`.trim()
                : (t.createdBy.email ?? '')
              : '',
          })),
          [
            { key: 'id', header: 'ID' },
            { key: 'type', header: 'Type' },
            { key: 'status', header: 'Status' },
            { key: 'author', header: 'Author' },
            { key: 'createdAt', header: 'Created' },
          ],
        );
      }
      return ok(rows);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'reply_to_conversation',
  {
    description: 'Send a reply to a customer in a conversation.',
    inputSchema: {
      conversationId: z.number().describe('Conversation ID'),
      text: z.string().describe('Reply body (HTML allowed)'),
      userId: z.number().optional().describe('Author user ID (defaults to token owner)'),
      cc: z.string().optional().describe('Comma-separated CC email addresses'),
      bcc: z.string().optional().describe('Comma-separated BCC email addresses'),
    },
  },
  async ({ conversationId, text, userId, cc, bcc }) => {
    try {
      const body = { type: 'reply', body: text };
      if (userId) body.userId = userId;
      if (cc) body.cc = cc.split(',').map((s) => s.trim());
      if (bcc) body.bcc = bcc.split(',').map((s) => s.trim());
      await mailbox.post(`/conversations/${conversationId}/threads/reply`, body);
      return ok({ ok: true, conversationId });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'add_note',
  {
    description: 'Add an internal note to a conversation (not visible to customers).',
    inputSchema: {
      conversationId: z.number().describe('Conversation ID'),
      text: z.string().describe('Note body (HTML allowed)'),
      userId: z.number().optional().describe('Author user ID (defaults to token owner)'),
    },
  },
  async ({ conversationId, text, userId }) => {
    try {
      const body = { type: 'note', body: text };
      if (userId) body.userId = userId;
      await mailbox.post(`/conversations/${conversationId}/threads/note`, body);
      return ok({ ok: true, conversationId });
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Customers ────────────────────────────────────────────────────────────────

server.registerTool(
  'list_customers',
  {
    description: 'List customers, optionally filtered by name or email.',
    inputSchema: {
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      all: z.boolean().optional().describe('Fetch all pages'),
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
    },
  },
  async ({ firstName, lastName, email, all, markdown }) => {
    try {
      const params = {};
      if (firstName) params.firstName = firstName;
      if (lastName) params.lastName = lastName;
      if (email) params.email = email;
      const rows = all
        ? await mailbox.getAll('/customers', 'customers', params)
        : ((await mailbox.get('/customers', params))?._embedded?.customers ?? []);
      if (markdown) {
        return okMarkdown(
          rows.map((c) => ({
            ...c,
            email: c.emails?.[0]?.value ?? '',
          })),
          [
            { key: 'id', header: 'ID' },
            { key: 'firstName', header: 'First' },
            { key: 'lastName', header: 'Last' },
            { key: 'email', header: 'Email' },
            { key: 'createdAt', header: 'Created' },
          ],
        );
      }
      return ok(rows);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'get_customer',
  {
    description: 'Get a customer by ID.',
    inputSchema: {
      id: z.number().describe('Customer ID'),
    },
  },
  async ({ id }) => {
    try {
      return ok(await mailbox.get(`/customers/${id}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'create_customer',
  {
    description: 'Create a new customer.',
    inputSchema: {
      email: z.string().describe('Customer email address'),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
    },
  },
  async ({ email, firstName, lastName, phone }) => {
    try {
      const body = { emails: [{ value: email, type: 'work' }] };
      if (firstName) body.firstName = firstName;
      if (lastName) body.lastName = lastName;
      if (phone) body.phones = [{ value: phone, type: 'work' }];
      return ok(await mailbox.post('/customers', body));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'update_customer',
  {
    description: 'Update a customer name or email.',
    inputSchema: {
      id: z.number().describe('Customer ID'),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
    },
  },
  async ({ id, firstName, lastName, email }) => {
    try {
      const body = {};
      if (firstName) body.firstName = firstName;
      if (lastName) body.lastName = lastName;
      if (email) body.emails = [{ value: email, type: 'work' }];
      await mailbox.patch(`/customers/${id}`, body);
      return ok({ ok: true, id });
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Mailboxes, Users, Tags ───────────────────────────────────────────────────

server.registerTool(
  'list_mailboxes',
  {
    description: 'List all Help Scout mailboxes (inboxes). Use this to get mailbox IDs.',
    inputSchema: {
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
    },
  },
  async ({ markdown }) => {
    try {
      const data = await mailbox.get('/mailboxes');
      const rows = data?._embedded?.mailboxes ?? [];
      if (markdown) {
        return okMarkdown(rows, [
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'email', header: 'Email' },
          { key: 'slug', header: 'Slug' },
        ]);
      }
      return ok(rows);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'list_users',
  {
    description: 'List all Help Scout users (agents).',
    inputSchema: {
      mailboxId: z.number().optional().describe('Filter by mailbox ID'),
      all: z.boolean().optional().describe('Fetch all pages'),
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
    },
  },
  async ({ mailboxId, all, markdown }) => {
    try {
      const params = {};
      if (mailboxId) params.mailboxId = mailboxId;
      const rows = all
        ? await mailbox.getAll('/users', 'users', params)
        : ((await mailbox.get('/users', params))?._embedded?.users ?? []);
      if (markdown) {
        return okMarkdown(rows, [
          { key: 'id', header: 'ID' },
          { key: 'firstName', header: 'First' },
          { key: 'lastName', header: 'Last' },
          { key: 'email', header: 'Email' },
          { key: 'role', header: 'Role' },
        ]);
      }
      return ok(rows);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'get_current_user',
  {
    description: 'Get the currently authenticated Help Scout user.',
    inputSchema: {},
  },
  async () => {
    try {
      return ok(await mailbox.get('/users/me'));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'list_tags',
  {
    description: 'List all tags in the Help Scout account.',
    inputSchema: {
      all: z.boolean().optional().describe('Fetch all pages'),
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
    },
  },
  async ({ all, markdown }) => {
    try {
      const rows = all
        ? await mailbox.getAll('/tags', 'tags')
        : ((await mailbox.get('/tags'))?._embedded?.tags ?? []);
      if (markdown) {
        return okMarkdown(rows, [
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'color', header: 'Color' },
        ]);
      }
      return ok(rows);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Docs Articles ────────────────────────────────────────────────────────────

server.registerTool(
  'list_articles',
  {
    description: 'List Help Scout Docs articles, optionally filtered by collection.',
    inputSchema: {
      collectionId: z.string().optional().describe('Filter by collection ID'),
      status: z
        .enum(['published', 'notpublished'])
        .optional()
        .describe('Filter by status (default: published)'),
      all: z.boolean().optional().describe('Fetch all pages'),
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
    },
  },
  async ({ collectionId, status, all, markdown }) => {
    try {
      const params = {};
      if (status) params.status = status;
      const path = collectionId ? `/collections/${collectionId}/articles` : '/articles';
      const rows = all
        ? await docs.getAll(path, params)
        : ((await docs.get(path, params))?.articles?.items ?? []);
      if (markdown) {
        return okMarkdown(rows, [
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Title' },
          { key: 'status', header: 'Status' },
          { key: 'collectionId', header: 'Collection' },
          { key: 'updatedAt', header: 'Updated' },
        ]);
      }
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
    inputSchema: {
      id: z.string().describe('Article ID'),
    },
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
      query: z.string().describe('Search query'),
      collectionId: z.string().optional().describe('Limit search to a specific collection'),
      status: z.enum(['published', 'notpublished']).optional(),
      all: z.boolean().optional().describe('Fetch all pages'),
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
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
      if (markdown) {
        return okMarkdown(rows, [
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Title' },
          { key: 'status', header: 'Status' },
          { key: 'collectionId', header: 'Collection' },
          { key: 'updatedAt', header: 'Updated' },
        ]);
      }
      return ok(rows);
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
      collectionId: z.string().describe('Collection ID to create the article in'),
      name: z.string().describe('Article title'),
      text: z.string().optional().describe('Article body HTML'),
      status: z
        .enum(['published', 'notpublished'])
        .optional()
        .describe('Status (default: notpublished)'),
    },
  },
  async ({ collectionId, name, text, status }) => {
    try {
      const body = { collectionId, name, status: status ?? 'notpublished' };
      if (text) body.text = text;
      return ok(await docs.post('/articles', body));
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
      id: z.string().describe('Article ID'),
      name: z.string().optional().describe('New title'),
      text: z.string().optional().describe('New body HTML'),
      status: z.enum(['published', 'notpublished']).optional(),
    },
  },
  async ({ id, name, text, status }) => {
    try {
      const body = {};
      if (name) body.name = name;
      if (text) body.text = text;
      if (status) body.status = status;
      return ok(await docs.put(`/articles/${id}`, body));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'delete_article',
  {
    description: 'Delete a Help Scout Docs article.',
    inputSchema: {
      id: z.string().describe('Article ID'),
    },
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

// ─── Docs Collections ─────────────────────────────────────────────────────────

server.registerTool(
  'list_collections',
  {
    description: 'List Help Scout Docs collections. Use this to get collection IDs.',
    inputSchema: {
      visibility: z.enum(['public', 'private']).optional(),
      all: z.boolean().optional().describe('Fetch all pages'),
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
    },
  },
  async ({ visibility, all, markdown }) => {
    try {
      const params = {};
      if (visibility) params.visibility = visibility;
      const rows = all
        ? await docs.getAll('/collections', params)
        : ((await docs.get('/collections', params))?.collections?.items ?? []);
      if (markdown) {
        return okMarkdown(rows, [
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'visibility', header: 'Visibility' },
          { key: 'updatedAt', header: 'Updated' },
        ]);
      }
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
    inputSchema: {
      id: z.string().describe('Collection ID'),
    },
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

// ─── Start ────────────────────────────────────────────────────────────────────

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Help Scout MCP server running');
}
