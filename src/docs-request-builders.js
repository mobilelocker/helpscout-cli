/**
 * Shared request body builders for Docs API CLI and MCP tools.
 */

export function reloadParams(reload) {
  return reload ? { reload: 'true' } : undefined;
}

export function pickQueryParams(source, keys) {
  const params = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value;
    }
  }
  return params;
}

function applyOptional(body, key, value) {
  if (value !== undefined) body[key] = value;
}

function applyNullableArray(body, key, value, clear) {
  if (clear) body[key] = null;
  else if (value !== undefined) body[key] = value;
}

export function buildArticleCreateBody(input) {
  const body = {
    collectionId: input.collectionId,
    name: input.name,
    text: input.text,
    status: input.status ?? 'notpublished',
  };
  applyOptional(body, 'slug', input.slug);
  if (input.categories !== undefined) body.categories = input.categories;
  if (input.related !== undefined) body.related = input.related;
  if (input.keywords !== undefined) body.keywords = input.keywords;
  return body;
}

export function buildArticleUpdateBody(input) {
  const body = {};
  applyOptional(body, 'name', input.name);
  applyOptional(body, 'text', input.text);
  applyOptional(body, 'status', input.status);
  applyOptional(body, 'slug', input.slug);
  applyNullableArray(body, 'categories', input.categories, input.clearCategories);
  applyNullableArray(body, 'related', input.related, input.clearRelated);
  applyNullableArray(body, 'keywords', input.keywords, input.clearKeywords);
  return body;
}

export const SITE_BODY_KEYS = [
  'status',
  'subDomain',
  'cname',
  'hasPublicSite',
  'title',
  'logoUrl',
  'logoWidth',
  'logoHeight',
  'favIconUrl',
  'touchIconUrl',
  'homeUrl',
  'homeLinkText',
  'bgColor',
  'description',
  'hasContactForm',
  'mailboxId',
  'contactEmail',
  'styleSheetUrl',
  'headerCode',
];

export function buildSiteBody(input, { partial = false } = {}) {
  const body = {};
  for (const key of SITE_BODY_KEYS) {
    if (input[key] !== undefined) body[key] = input[key];
  }
  if (!partial && input.title !== undefined) body.title = input.title;
  if (!partial && input.subDomain !== undefined) body.subDomain = input.subDomain;
  return body;
}

export function buildSiteCreateBody(input) {
  return buildSiteBody(input, { partial: false });
}

export function buildSiteUpdateBody(input) {
  return buildSiteBody(input, { partial: true });
}

export function buildCollectionUpdateBody(input) {
  const body = {};
  applyOptional(body, 'name', input.name);
  applyOptional(body, 'visibility', input.visibility);
  if (input.order !== undefined) body.order = input.order;
  applyOptional(body, 'description', input.description);
  if (input.siteId !== undefined) body.siteId = input.siteId;
  return body;
}

export function buildSiteRestrictionsBody(input) {
  const body = {};
  if (input.enabled !== undefined) body.enabled = input.enabled;
  if (input.authentication) body.authentication = input.authentication;
  if (input.signInUrl) {
    body.authentication = input.authentication ?? 'CALLBACK';
    body.callbackConfiguration = { signInUrl: input.signInUrl };
  }
  return body;
}

export function mergeRedirectUpdate(existing, input) {
  return {
    siteId: input.siteId ?? existing.siteId ?? existing.site?.id,
    urlMapping: input.urlMapping ?? existing.urlMapping,
    redirect: input.redirect ?? existing.redirect,
  };
}

export function normalizeCliArray(value) {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}
