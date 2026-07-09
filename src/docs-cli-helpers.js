/**
 * Shared CLI helpers for Docs API commands.
 */

export function addSiteBodyOptions(command) {
  return command
    .option('--status <status>', 'Site status (default: active)')
    .option('--cname <host>', 'Custom CNAME hostname')
    .option('--has-public-site', 'Allow public access to the Docs site')
    .option('--no-public-site', 'Disallow public access to the Docs site')
    .option('--logo-url <url>', 'Logo image URL')
    .option('--logo-width <n>', 'Logo width in pixels', parseFloat)
    .option('--logo-height <n>', 'Logo height in pixels', parseFloat)
    .option('--fav-icon-url <url>', 'Favicon URL')
    .option('--touch-icon-url <url>', 'Touch icon URL')
    .option('--home-url <url>', 'Home page URL')
    .option('--home-link-text <text>', 'Home link label')
    .option('--bg-color <hex>', 'Background color hex, e.g. #444444')
    .option('--description <text>', 'Meta description for the site')
    .option('--has-contact-form', 'Enable contact form')
    .option('--no-contact-form', 'Disable contact form')
    .option('--mailbox-id <id>', 'Mailbox ID for contact form', parseFloat)
    .option('--contact-email <email>', 'Contact form email')
    .option('--style-sheet-url <url>', 'Custom stylesheet URL')
    .option('--header-code <html>', 'Custom HTML/JS for site header');
}

export function siteBodyFromOpts(opts) {
  const body = {};
  if (opts.title) body.title = opts.title;
  if (opts.subdomain) body.subDomain = opts.subdomain;
  if (opts.status) body.status = opts.status;
  if (opts.cname) body.cname = opts.cname;
  if (opts.hasPublicSite) body.hasPublicSite = true;
  if (opts.noPublicSite) body.hasPublicSite = false;
  if (opts.logoUrl) body.logoUrl = opts.logoUrl;
  if (opts.logoWidth !== undefined) body.logoWidth = opts.logoWidth;
  if (opts.logoHeight !== undefined) body.logoHeight = opts.logoHeight;
  if (opts.favIconUrl) body.favIconUrl = opts.favIconUrl;
  if (opts.touchIconUrl) body.touchIconUrl = opts.touchIconUrl;
  if (opts.homeUrl) body.homeUrl = opts.homeUrl;
  if (opts.homeLinkText) body.homeLinkText = opts.homeLinkText;
  if (opts.bgColor) body.bgColor = opts.bgColor;
  if (opts.description) body.description = opts.description;
  if (opts.hasContactForm) body.hasContactForm = true;
  if (opts.noContactForm) body.hasContactForm = false;
  if (opts.mailboxId !== undefined) body.mailboxId = opts.mailboxId;
  if (opts.contactEmail !== undefined) body.contactEmail = opts.contactEmail;
  if (opts.styleSheetUrl) body.styleSheetUrl = opts.styleSheetUrl;
  if (opts.headerCode !== undefined) body.headerCode = opts.headerCode;
  return body;
}

export function articleUpdateOptsFromCli(opts) {
  return {
    name: opts.name,
    text: opts.text,
    status: opts.status,
    slug: opts.slug,
    categories: opts.category,
    related: opts.related,
    keywords: opts.keyword,
    clearCategories: opts.clearCategories,
    clearRelated: opts.clearRelated,
    clearKeywords: opts.clearKeywords,
  };
}
