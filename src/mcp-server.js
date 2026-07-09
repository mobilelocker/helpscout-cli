/**
 * Help Scout MCP server.
 * Exposes Help Scout Mailbox API v2 and Docs API v1 as MCP tools.
 * Runs over stdio — do not write to stdout (corrupts JSON-RPC messages).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { login, logout, status } from './auth.js';
import { mailbox, buildCustomStatus } from './mailbox-client.js';
import { docs } from './docs-client.js';
import { normalizeWriteResponse } from './http.js';
import { registerDocsTools } from './mcp-server-docs.js';
import { USER_STATUS_COLUMNS } from './columns.js';
import pkg from '../package.json' with { type: 'json' };

// 61 tools:
//   Auth (3):         auth_status, auth_login, auth_logout
//   Conversations (5): list_conversations, get_conversation, create_conversation,
//                      update_conversation, delete_conversation
//   Threads (3):      list_threads, reply_to_conversation, add_note
//   Customers (4):    list_customers, get_customer, create_customer, update_customer
//   Mailboxes (1):    list_mailboxes
//   Users (5):        list_users, get_current_user (get_user via list), get_user_status,
//                     list_user_statuses, set_user_status
//   Tags (1):         list_tags
//   Docs (39):       see registerDocsTools in mcp-server-docs.js
const server = new McpServer({ name: 'helpscout', version: pkg.version });

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
      const data = await mailbox.post('/conversations', payload);
      return ok(normalizeWriteResponse(data));
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
      const data = await mailbox.post('/customers', body);
      return ok(normalizeWriteResponse(data));
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
  'get_user_status',
  {
    description: 'Get email (routing) and chat status for a single user.',
    inputSchema: {
      id: z.number().describe('User ID'),
    },
  },
  async ({ id }) => {
    try {
      return ok(await mailbox.get(`/users/${id}/status`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'list_user_statuses',
  {
    description: 'List email (routing) and chat statuses for all users.',
    inputSchema: {
      all: z.boolean().optional().describe('Fetch all pages'),
      markdown: z.boolean().optional().describe('Return a Markdown table instead of JSON'),
    },
  },
  async ({ all, markdown }) => {
    try {
      const rows = all
        ? await mailbox.getAll('/users/status', 'userStatuses')
        : ((await mailbox.get('/users/status'))?._embedded?.userStatuses ?? []);
      if (markdown) {
        return okMarkdown(rows, USER_STATUS_COLUMNS);
      }
      return ok(rows);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'set_user_status',
  {
    description:
      "Set a user's email (routing) status. Admins/owners can set status for other users; " +
      'non-admins may only set their own.',
    inputSchema: {
      id: z.number().describe('User ID'),
      status: z.enum(['active', 'away']).describe('Status to set'),
      text: z.string().optional().describe('Custom status text'),
      emoji: z.string().optional().describe('Custom status emoji, e.g. ☕'),
      emojiName: z.string().optional().describe('Custom status emoji name, e.g. :coffee:'),
    },
  },
  async ({ id, status, text, emoji, emojiName }) => {
    try {
      const body = { status };
      const customStatus = buildCustomStatus({ text, emoji, emojiName });
      if (customStatus) body.customStatus = customStatus;
      await mailbox.put(`/users/${id}/status`, body);
      return ok({ ok: true, id });
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

registerDocsTools(server, { docs, ok, okMarkdown, fail });

// ─── Start ────────────────────────────────────────────────────────────────────

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Help Scout MCP server running');
}
