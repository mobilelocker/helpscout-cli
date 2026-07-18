/**
 * helpscout inbox thread <action>
 */
import { Command } from 'commander';
import { mailbox } from '../../mailbox-client.js';
import { output, outputTable } from '../../output.js';
import { resolveTextOrFile } from '../../text-or-file.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'type', header: 'Type' },
  { key: 'status', header: 'Status' },
  { key: 'createdAt', header: 'Created' },
  { key: 'createdBy', header: 'Author' },
];

function flattenThread(t) {
  return {
    ...t,
    createdBy: t.createdBy
      ? `${t.createdBy.first ?? ''} ${t.createdBy.last ?? ''}`.trim() || t.createdBy.email
      : '',
  };
}

export function makeThreadCommand() {
  const cmd = new Command('thread');
  cmd.description('Manage conversation threads');

  cmd
    .command('list <conversationId>')
    .description('List threads for a conversation')
    .option('--all', 'Fetch all pages')
    .action(async (conversationId, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      if (opts.all) {
        const items = await mailbox.getAll(`/conversations/${conversationId}/threads`, 'threads');
        outputTable(items.map(flattenThread), COLUMNS, globalOpts);
      } else {
        const data = await mailbox.get(`/conversations/${conversationId}/threads`);
        const items = data?._embedded?.threads ?? [];
        outputTable(items.map(flattenThread), COLUMNS, globalOpts);
      }
    });

  cmd
    .command('reply <conversationId>')
    .description('Create a reply thread')
    .option('--text <text>', 'Reply text (HTML allowed; required unless --file)')
    .option('--file <path>', 'Read reply text from file (alternative to --text)')
    .option('--user <userId>', 'Author user ID')
    .option('--cc <emails>', 'Comma-separated CC addresses')
    .option('--bcc <emails>', 'Comma-separated BCC addresses')
    .action(async (conversationId, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const text = await resolveTextOrFile({
        text: opts.text,
        filePath: opts.file,
        required: true,
        paramNames: { text: '--text', file: '--file' },
      });
      const body = { type: 'reply', text };
      if (opts.user) body.user = parseInt(opts.user);
      if (opts.cc) body.cc = opts.cc.split(',').map((s) => s.trim());
      if (opts.bcc) body.bcc = opts.bcc.split(',').map((s) => s.trim());

      await mailbox.post(`/conversations/${conversationId}/threads/reply`, body);
      output({ ok: true }, globalOpts);
    });

  cmd
    .command('note <conversationId>')
    .description('Create an internal note')
    .option('--text <text>', 'Note text (HTML allowed; required unless --file)')
    .option('--file <path>', 'Read note text from file (alternative to --text)')
    .option('--user <userId>', 'Author user ID')
    .action(async (conversationId, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const text = await resolveTextOrFile({
        text: opts.text,
        filePath: opts.file,
        required: true,
        paramNames: { text: '--text', file: '--file' },
      });
      const body = { type: 'note', text };
      if (opts.user) body.user = parseInt(opts.user);

      await mailbox.post(`/conversations/${conversationId}/threads/note`, body);
      output({ ok: true }, globalOpts);
    });

  return cmd;
}
