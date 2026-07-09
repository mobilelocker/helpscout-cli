/**
 * Shared Zod schemas for Docs API MCP tools.
 */
import { z } from 'zod';

export const nullableStringArray = () =>
  z
    .array(z.string())
    .nullable()
    .optional()
    .describe('Array of IDs/strings, or null to clear (update only)');

export const siteOptionalFields = {
  title: z.string().optional(),
  subDomain: z.string().optional(),
  status: z.string().optional().describe('Site status (default: active)'),
  cname: z.string().optional().describe('Custom CNAME hostname'),
  hasPublicSite: z.boolean().optional().describe('Allow public access to the Docs site'),
  logoUrl: z.string().optional(),
  logoWidth: z.number().optional(),
  logoHeight: z.number().optional(),
  favIconUrl: z.string().optional(),
  touchIconUrl: z.string().optional(),
  homeUrl: z.string().optional(),
  homeLinkText: z.string().optional(),
  bgColor: z.string().optional().describe('Background color hex, e.g. #444444'),
  description: z.string().optional().describe('Meta description for the site'),
  hasContactForm: z.boolean().optional(),
  mailboxId: z.number().optional(),
  contactEmail: z.string().nullable().optional(),
  styleSheetUrl: z.string().optional(),
  headerCode: z.string().nullable().optional().describe('Custom HTML/JS inserted in site header'),
};

export const articleListQueryFields = {
  status: z.enum(['all', 'published', 'notpublished']).optional(),
  sort: z
    .enum(['order', 'number', 'status', 'name', 'popularity', 'createdAt', 'updatedAt'])
    .optional(),
  order: z.enum(['asc', 'desc']).optional(),
  pageSize: z.number().optional().describe('Max 100'),
};

export const searchQueryFields = {
  siteId: z.string().optional(),
  visibility: z.enum(['all', 'public', 'private']).optional(),
  pageSize: z.number().optional().describe('Max 100'),
};

export const collectionListQueryFields = {
  sort: z.enum(['order', 'number', 'visibility', 'name', 'createdAt', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
};

export const categoryListQueryFields = {
  sort: z.enum(['order', 'number', 'name', 'articleCount', 'createdAt', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
};
