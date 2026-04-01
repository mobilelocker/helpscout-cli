/**
 * Output formatting — auto-detects TTY for pretty vs JSON.
 * Commands should never call console.log directly; use these functions.
 */
import Table from 'cli-table3';

/**
 * Determine the output format.
 * Priority: --json → --markdown → --pretty → TTY auto-detect
 * Returns: 'json' | 'markdown' | 'pretty'
 */
export function getOutputFormat(opts = {}) {
  if (opts.json) return 'json';
  if (opts.markdown) return 'markdown';
  if (opts.pretty) return 'pretty';
  return process.stdout.isTTY ? 'pretty' : 'json';
}

/**
 * Determine if pretty output is desired.
 * Priority: explicit --json flag → explicit --pretty flag → TTY auto-detect
 */
export function shouldPretty(opts = {}) {
  const fmt = getOutputFormat(opts);
  return fmt === 'pretty' || fmt === 'markdown';
}

/**
 * Print data to stdout. `opts` should come from commander's optsWithGlobals().
 * - pretty mode: uses the provided formatter or falls back to JSON.stringify
 * - markdown mode: single objects as key-value table; arrays as JSON
 * - JSON mode: always raw JSON, one object per call
 */
export function output(data, opts = {}, formatter = null) {
  const fmt = getOutputFormat(opts);

  if (fmt === 'markdown') {
    if (formatter) {
      process.stdout.write(formatter(data) + '\n');
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      const rows = Object.entries(data).map(([k, v]) => ({
        k,
        v:
          v === null || v === undefined
            ? ''
            : typeof v === 'object'
              ? JSON.stringify(v)
              : String(v),
      }));
      process.stdout.write(
        makeMarkdownTable(rows, [
          { key: 'k', header: 'Field' },
          { key: 'v', header: 'Value' },
        ]) + '\n',
      );
    } else {
      process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    }
    return;
  }

  if (fmt === 'pretty') {
    if (formatter) {
      process.stdout.write(formatter(data) + '\n');
    } else {
      process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    }
  } else {
    process.stdout.write(JSON.stringify(data) + '\n');
  }
}

/**
 * Print an error to stderr and exit with code 1.
 * Always outputs JSON-shaped error regardless of TTY.
 */
export function outputError(message, status = null, exit = true) {
  const err = { error: message };
  if (status !== null && status !== undefined) err.status = status;
  process.stderr.write(JSON.stringify(err) + '\n');
  if (exit) process.exit(1);
}

/**
 * Build a cli-table3 table from an array of objects.
 * `columns` is an array of { key, header, width? } descriptors.
 */
export function makeTable(rows, columns) {
  const table = new Table({
    head: columns.map((c) => c.header),
    style: { head: ['cyan'] },
    wordWrap: true,
  });

  for (const row of rows) {
    table.push(
      columns.map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }),
    );
  }

  return table.toString();
}

/**
 * Build a GitHub Flavored Markdown pipe table from an array of objects.
 * `columns` is an array of { key, header } descriptors.
 */
export function makeMarkdownTable(rows, columns) {
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
  return [header, divider, ...body].join('\n');
}

/**
 * Convenience: output a list of objects as a table in pretty mode,
 * a markdown table in markdown mode, or as a JSON array in pipe mode.
 */
export function outputTable(rows, columns, opts = {}) {
  const fmt = getOutputFormat(opts);

  if (!Array.isArray(rows) || rows.length === 0) {
    if (fmt !== 'json') {
      process.stdout.write('(no results)\n');
    } else {
      process.stdout.write(JSON.stringify([]) + '\n');
    }
    return;
  }

  if (fmt === 'markdown') {
    process.stdout.write(makeMarkdownTable(rows, columns) + '\n');
  } else if (fmt === 'pretty') {
    process.stdout.write(makeTable(rows, columns) + '\n');
  } else {
    process.stdout.write(JSON.stringify(rows) + '\n');
  }
}
