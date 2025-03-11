import {
  ContentBlock,
  ContentBlockParam,
  ImageBlockParam,
  TextBlock,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/index.mjs';
import { z } from 'zod';
import { exhaustiveMatchGuard } from '../../../utils/exhaustiveMatchGuard';

// Schema for cache control in Anthropic message content
const CacheControlSchema = z.object({
  type: z.literal('ephemeral'),
});

// Schema for text content in Anthropic message
const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

// Schema for image content in Anthropic message
const ImageContentSchema = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.string().regex(/^image\/(jpeg|png|gif|webp)$/),
    data: z.string(),
  }),
});

// Schema for tool use content in Anthropic message
const ToolUseSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.any()),
});

// Union schema for all valid content types
const ContentBlockSchema = z.union([TextContentSchema, ImageContentSchema, ToolUseSchema]);

function applyOverrides(
  content: z.infer<typeof ContentBlockSchema>,
  overrides: { cacheControl?: 'ephemeral' }
): ContentBlockParam {
  if (overrides.cacheControl) {
    switch (content.type) {
      case 'text':
        return {
          type: 'text',
          text: content.text,
          cache_control: { type: overrides.cacheControl },
          citations: null,
        } as TextBlock;
      case 'tool_use':
        return {
          ...content,
          type: 'tool_use',
          cache_control: { type: overrides.cacheControl },
        } as ToolUseBlock;
      case 'image':
        return {
          ...content,
          type: 'image',
          cache_control: { type: overrides.cacheControl },
        } as ImageBlockParam;
      default:
        console.error('Unknown content type', content);
        throw exhaustiveMatchGuard(content);
    }
  }
  return content as ContentBlockParam;
}
/**
 * Validates if a message content is a valid Anthropic message content object.
 * If the content is a string or doesn't match the expected structure, returns null.
 *
 * @param content - The message content to validate
 * @returns The validated content object if valid, null otherwise
 */
export function asValidMessageContentObject(
  content: unknown,
  overrides: { cacheControl?: 'ephemeral' }
): null | ContentBlockParam[] {
  if (typeof content === 'string') {
    return null;
  }

  // If content is an array, validate each block
  if (Array.isArray(content)) {
    const result = z.array(ContentBlockSchema).safeParse(content);
    return result.success ? result.data.map((block) => applyOverrides(block, overrides)) : null;
  }

  // If content is an object, try to validate it as a single content block
  const result = ContentBlockSchema.safeParse(content);
  return result.success ? [applyOverrides(result.data, overrides)] : null;
}
