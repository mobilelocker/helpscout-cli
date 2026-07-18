/**
 * Resolve free-form text from an inline string or a file path.
 */
import { readFile } from 'node:fs/promises';

/**
 * @param {object} options
 * @param {string} [options.text] Inline text/HTML
 * @param {string} [options.filePath] Path to a file whose contents become the text
 * @param {boolean} [options.required=false] When true, require text or filePath
 * @param {{ text?: string, file?: string }} [options.paramNames] Names used in error messages
 * @returns {Promise<string|undefined>}
 */
export async function resolveTextOrFile({
  text,
  filePath,
  required = false,
  paramNames = {},
} = {}) {
  const textName = paramNames.text ?? 'text';
  const fileName = paramNames.file ?? 'filePath';

  const hasText = text !== undefined && text !== null;
  const hasFile = filePath !== undefined && filePath !== null && String(filePath).length > 0;

  if (hasText && hasFile) {
    throw new Error(`Provide either ${textName} or ${fileName}, not both.`);
  }
  if (required && !hasText && !hasFile) {
    throw new Error(`Either ${textName} or ${fileName} is required.`);
  }
  if (hasFile) {
    try {
      return await readFile(filePath, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`, { cause: err });
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Unable to read file: ${filePath} (${message})`, { cause: err });
    }
  }
  if (hasText) return text;
  return undefined;
}
