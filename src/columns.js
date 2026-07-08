/**
 * Shared table column definitions, used by both the CLI (outputTable) and
 * the MCP server (okMarkdown) so the two front-ends stay in sync.
 */

export const USER_STATUS_COLUMNS = [
  { key: 'userId', header: 'User ID' },
  { key: 'email', header: 'Email Status' },
  { key: 'chat', header: 'Chat Status' },
];
