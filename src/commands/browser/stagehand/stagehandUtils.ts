import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { z } from 'zod';
import type { StagehandConfig, ObservationResult } from '../../../types/browser/browser';
import { loadConfig } from '../../../config.ts';

export class StagehandError extends Error {
  readonly details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'StagehandError';
    this.details = details;
  }
}

export class ActionError extends StagehandError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'ActionError';
  }
}

export class ExtractionSchemaError extends StagehandError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'ExtractionSchemaError';
  }
}

export class ObservationError extends StagehandError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'ObservationError';
  }
}

export class NavigationError extends StagehandError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'NavigationError';
  }
}

export class PlaywrightError extends StagehandError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'PlaywrightError';
  }
}

export async function initializeBrowser(
  options: { headless?: boolean; timeout?: number } = {}
): Promise<{ browser: Browser; page: Page }> {
  try {
    const browser = await chromium.launch({
      headless: options.headless ?? true,
    });
    const page = await browser.newPage();
    if (options.timeout) {
      page.setDefaultTimeout(options.timeout);
    }
    return { browser, page };
  } catch (error) {
    throw new PlaywrightError('Failed to initialize browser', error);
  }
}

interface ExtendedConfig {
  browser?: {
    stagehand?: StagehandConfig;
  };
}

export function loadBrowserConfig(): StagehandConfig {
  const config = loadConfig() as ExtendedConfig;
  return {
    env: config.browser?.stagehand?.env ?? 'LOCAL',
    headless: config.browser?.stagehand?.headless ?? true,
    verbose: config.browser?.stagehand?.verbose ?? (1 as 0 | 1 | 2),
    debugDom: config.browser?.stagehand?.debugDom ?? false,
    enableCaching: config.browser?.stagehand?.enableCaching ?? false,
  };
}

export async function loadSchema(schemaPath: string | object): Promise<z.ZodType<any>> {
  if (typeof schemaPath === 'string') {
    try {
      const schema = await import(schemaPath);
      return z.object(schema);
    } catch (error) {
      throw new ExtractionSchemaError(`Failed to load schema from ${schemaPath}`, error);
    }
  }
  return z.object(schemaPath as any);
}

export function formatOutput<T>(result: T, debug = false): string {
  const output: string[] = [];

  if (typeof result === 'string') {
    output.push('Results:', '', result);
  } else if (Array.isArray(result)) {
    output.push('Results:', '');
    if (result.length === 0) {
      output.push('No results found.');
    } else {
      output.push(
        ...result.map((item, index) => {
          if (typeof item === 'string') {
            return `${index + 1}. ${item}`;
          }
          if (typeof item === 'object' && item !== null) {
            const formatted = Object.entries(item)
              .map(([key, value]) => `  ${key}: ${value}`)
              .join('\n');
            return `${index + 1}. Item:\n${formatted}`;
          }
          return `${index + 1}. ${JSON.stringify(item)}`;
        })
      );
    }
  } else if (result && typeof result === 'object') {
    const resultObj = result as unknown;
    if (isObservationResult(resultObj)) {
      output.push(
        'Page Observation Results:',
        '',
        `Summary: ${resultObj.summary}`,
        '',
        '--- Interactive Elements ---',
        ...resultObj.elements
          .map((elem, index) => [
            `${index + 1}. ${elem.type} - ${elem.description}`,
            `   Location: ${elem.location}`,
            `   Possible actions: ${elem.actions.join(', ')}`,
            '',
          ])
          .flat()
      );
    } else {
      output.push('Results:', '', JSON.stringify(result, null, 2));
    }
  }

  if (debug) {
    output.push(
      '',
      '--- Debug Information ---',
      JSON.stringify({ config: loadBrowserConfig() }, null, 2),
      '--- End Debug Information ---'
    );
  }

  return output.join('\n');
}

function isObservationResult(value: unknown): value is ObservationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'elements' in value &&
    'summary' in value &&
    Array.isArray((value as ObservationResult).elements)
  );
}

export function handleBrowserError(error: unknown, debug = false): string {
  let message: string;
  let details: unknown;
  let errorType = 'Unknown Error';

  if (error instanceof StagehandError) {
    message = error.message;
    details = error.details;
    errorType = error.name;
  } else if (error instanceof Error) {
    message = error.message;
    details = error.stack;
    errorType = error.name;
  } else {
    message = 'An unknown error occurred';
    details = error;
  }

  const output = [`${errorType}: ${message}`];

  if (debug && details) {
    output.push('', '--- Debug Information ---');
    if (typeof details === 'string') {
      output.push(details);
    } else {
      output.push(JSON.stringify(details, null, 2));
    }
    output.push('--- End Debug Information ---\n');
  }

  return output.join('\n');
}
