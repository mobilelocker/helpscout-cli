#!/usr/bin/env node
/**
 * Scrape Help Scout Docs API endpoint pages and refresh docs/docs-api-endpoints.json.
 *
 * Usage: npm run scrape:docs-api
 *
 * Requires playwright (devDependency). Updates scrapedAt and validates page count
 * against the committed catalog structure.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'docs', 'docs-api-endpoints.json');
const BASE = 'https://developer.helpscout.com/docs-api';

const SIDEBAR_PATHS = [
  '/articles/list/',
  '/articles/search/',
  '/articles/list-related/',
  '/articles/list-revisions/',
  '/articles/get/',
  '/articles/get-revision/',
  '/articles/create/',
  '/articles/update/',
  '/articles/upload/',
  '/articles/update-view-count/',
  '/articles/delete/',
  '/articles/save-draft/',
  '/articles/delete-draft/',
  '/assets/create-article/',
  '/assets/create-settings/',
  '/categories/list/',
  '/categories/get/',
  '/categories/create/',
  '/categories/update/',
  '/categories/order/',
  '/categories/delete/',
  '/collections/list/',
  '/collections/get/',
  '/collections/create/',
  '/collections/update/',
  '/collections/delete/',
  '/redirects/list/',
  '/redirects/get/',
  '/redirects/find/',
  '/redirects/create/',
  '/redirects/update/',
  '/redirects/delete/',
  '/sites/list/',
  '/sites/get/',
  '/sites/create/',
  '/sites/update/',
  '/sites/delete/',
  '/sites/get-restrictions/',
  '/sites/update-restrictions/',
];

function inferResponsePattern(text) {
  const lower = text.toLowerCase();
  if (lower.includes('multipart/form-data')) return '201-json';
  if (lower.includes('204 no content')) return '204';
  if (lower.includes('location header')) return '201-location';
  if (lower.includes('application/json')) return 'json';
  return 'unknown';
}

function extractMethod(text) {
  const match = text.match(/\b(GET|POST|PUT|DELETE|PATCH)\b/);
  return match?.[1] ?? null;
}

function extractPath(text) {
  const match = text.match(/https:\/\/docsapi\.helpscout\.net\/v1([^\s"'<>]+)/);
  return match?.[1] ?? null;
}

async function scrapePages(browser) {
  const page = await browser.newPage();
  const scraped = [];

  for (const slug of SIDEBAR_PATHS) {
    const url = `${BASE}${slug}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const bodyText = await page.locator('main, article, .content, body').first().innerText();
    const method = extractMethod(bodyText);
    const apiPath = extractPath(bodyText);
    scraped.push({
      slug,
      url,
      method,
      path: apiPath,
      responsePattern: inferResponsePattern(bodyText),
    });
    process.stderr.write(`Scraped ${slug}\n`);
  }

  await page.close();
  return scraped;
}

async function main() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    process.stderr.write(
      'playwright is not installed. Run: npm install --save-dev playwright && npx playwright install chromium\n',
    );
    process.exit(1);
  }

  const existing = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const scraped = await scrapePages(browser);
    const endpointCount = existing.groups.reduce((n, g) => n + g.endpoints.length, 0);

    if (scraped.length !== endpointCount) {
      process.stderr.write(
        `Warning: scraped ${scraped.length} pages but catalog has ${endpointCount} endpoints\n`,
      );
    }

    const updated = {
      ...existing,
      scrapedAt: new Date().toISOString().slice(0, 10),
      scrapeMeta: {
        pageCount: scraped.length,
        pages: scraped,
      },
    };

    await writeFile(CATALOG_PATH, `${JSON.stringify(updated, null, 2)}\n`);
    process.stderr.write(`Updated ${CATALOG_PATH}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
