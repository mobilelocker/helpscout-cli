/**
 * helpscout docs asset <action>
 */
import { openAsBlob } from 'node:fs';
import { basename } from 'node:path';
import { Command } from 'commander';
import { docs } from '../../docs-client.js';
import { normalizeWriteResponse } from '../../http.js';
import { output } from '../../output.js';

async function buildUploadForm(fields, filePath) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  const blob = await openAsBlob(filePath);
  form.append('file', blob, basename(filePath));
  return form;
}

export function makeAssetCommand() {
  const cmd = new Command('asset');
  cmd.description('Upload Docs assets');

  cmd
    .command('create-article')
    .description('Upload a file for use in an article')
    .requiredOption('--article-id <id>', 'Article ID')
    .requiredOption('--file <path>', 'File to upload')
    .requiredOption('--asset-type <type>', 'image or attachment')
    .option('--file-name <name>', 'Override uploaded file name')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const apiKey = process.env.HELPSCOUT_API_KEY;
      if (!apiKey) throw new Error('HELPSCOUT_API_KEY environment variable is not set.');

      const fields = {
        key: apiKey,
        articleId: opts.articleId,
        assetType: opts.assetType,
      };
      if (opts.fileName) fields.fileName = opts.fileName;

      const form = await buildUploadForm(fields, opts.file);
      const data = await docs.upload('/assets/article', form);
      output(normalizeWriteResponse(data), globalOpts);
    });

  cmd
    .command('create-settings')
    .description('Upload a global Docs settings image (logo, favicon, touchicon)')
    .requiredOption('--file <path>', 'Image file to upload')
    .requiredOption('--asset-type <type>', 'logo, favicon, or touchicon')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const apiKey = process.env.HELPSCOUT_API_KEY;
      if (!apiKey) throw new Error('HELPSCOUT_API_KEY environment variable is not set.');

      const form = await buildUploadForm({ key: apiKey, assetType: opts.assetType }, opts.file);
      const data = await docs.upload('/assets/settings', form);
      output(normalizeWriteResponse(data), globalOpts);
    });

  return cmd;
}
