import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import fetch from 'node-fetch';
import { getCurrentVersion } from '../utils/versionUtils';

const TELEMETRY_ENDPOINT = 'https://vibe-tools-infra.flowisgreat.workers.dev/api/pipeline';
const CONFIG_DIR = join(homedir(), '.vibe-tools');
const DIAGNOSTICS_PATH = join(CONFIG_DIR, 'diagnostics.json');
const SESSION_ID = randomUUID();

interface DiagnosticsData {
  userId?: string;
  telemetryEnabled?: boolean;
}

// Define command states that we want to track
interface CommandState {
  command: string;
  startTime: number;
  tokenCount?: number;
  promptTokens?: number;
  completionTokens?: number;
  provider?: string;
  model?: string;
  // Plan command specific fields
  fileProvider?: string;
  fileModel?: string;
  thinkingProvider?: string;
  thinkingModel?: string;
  options?: Record<string, any>;
  error?: any;
}

let diagnosticsData: DiagnosticsData | null = null;
let currentCommandState: CommandState | null = null;

export const TELEMETRY_DATA_DESCRIPTION = `
Vibe-Tools collects anonymous usage data to improve the tool.

We track:
  - Command executed (e.g., repo, web), duration, success/failure, flags used.
  - General error types (e.g., API key missing, network error).
  - Features used (e.g., --save-to, --debug, --video).
  - Installation choices (IDE, config location).

We DO NOT track:
  - Queries, prompts, file contents, code, or any personal data.
  - API keys or other secrets.

This helps us fix bugs and prioritize features. Telemetry can be disabled via the VIBE_TOOLS_NO_TELEMETRY=1 environment variable.
`;

function readDiagnosticsFile(): DiagnosticsData {
  if (diagnosticsData) {
    return diagnosticsData;
  }
  try {
    if (existsSync(DIAGNOSTICS_PATH)) {
      const content = readFileSync(DIAGNOSTICS_PATH, 'utf-8');
      diagnosticsData = JSON.parse(content);
      return diagnosticsData!;
    }
  } catch (error) {
    console.error('Error reading diagnostics file:', error);
    // If reading fails, proceed as if the file doesn't exist
  }
  diagnosticsData = {};
  return diagnosticsData;
}

function writeDiagnosticsFile(data: DiagnosticsData): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(DIAGNOSTICS_PATH, JSON.stringify(data, null, 2), 'utf-8');
    diagnosticsData = data; // Update in-memory cache
  } catch (error) {
    console.error('Error writing diagnostics file:', error);
  }
}

function getTelemetryStatusFromDiagnostics(): boolean | null {
  const data = readDiagnosticsFile();
  if (typeof data.telemetryEnabled === 'boolean') {
    return data.telemetryEnabled;
  }
  return null; // Return null if not explicitly set
}

export function setTelemetryStatus(enabled: boolean): void {
  const data = readDiagnosticsFile();
  const updatedData = { ...data, telemetryEnabled: enabled };

  // Handle userId logic when opting out
  if (enabled === false && data.userId && !data.userId.startsWith('anonymous_')) {
    updatedData.userId = 'anonymous_opt_out';
  } else if (enabled === true && (!data.userId || data.userId.startsWith('anonymous_'))) {
    // Assign a new ID if enabling and current ID is anonymous or missing
    updatedData.userId = randomUUID();
  }

  writeDiagnosticsFile(updatedData);
}

export function isTelemetryEnabled(): boolean | null {
  if (
    process.env.VIBE_TOOLS_NO_TELEMETRY === '1' ||
    process.env.VIBE_TOOLS_NO_TELEMETRY === 'true'
  ) {
    return false;
  }

  return getTelemetryStatusFromDiagnostics();
}

function getUserIdFromDiagnostics(): string {
  const data = readDiagnosticsFile();
  const enabledStatus = isTelemetryEnabled(); // Use the unified check

  if (enabledStatus === false) {
    return data.userId && data.userId.startsWith('anonymous_opt_out')
      ? data.userId
      : 'anonymous_opt_out';
  }
  if (enabledStatus === null) {
    return 'anonymous_pending_prompt';
  }

  // Telemetry is enabled (true)
  if (data.userId && !data.userId.startsWith('anonymous_')) {
    return data.userId; // Return existing valid ID
  } else {
    // Generate and save a new ID if missing or anonymous while enabled
    const newUserId = randomUUID();
    const updatedData = { ...data, userId: newUserId, telemetryEnabled: true }; // Ensure status is also true
    writeDiagnosticsFile(updatedData);
    return newUserId;
  }
}

// Initialize diagnostics on load - reads the file once if needed
readDiagnosticsFile();

// Start tracking a new command execution
export function startCommand(command: string, options?: Record<string, any>): void {
  // Extract provider and model from options
  const provider = options?.provider;
  const model = options?.model;

  // Create sanitized options (removing provider and model which will be tracked separately)
  const sanitizedOptions = options ? sanitizeOptions(options) : undefined;

  currentCommandState = {
    command,
    startTime: Date.now(),
    provider,
    model,
    options: sanitizedOptions,
  };
}

// Update the state with information like token count
export function updateCommandState(
  update: Partial<Omit<CommandState, 'command' | 'startTime'>>
): void {
  if (currentCommandState) {
    // Log the update being applied
    console.log(`[Telemetry] Updating command state with:`, update);
    Object.assign(currentCommandState, update);
  } else {
    console.log(`[Telemetry] Attempted to update state, but no current command state exists.`);
  }
}

// Record an error that occurred during command execution
export function recordError(error: any): void {
  if (currentCommandState) {
    // Store only error type and message, not the full error object
    currentCommandState.error = {
      type: error.constructor.name,
      message: error.message,
    };
  }
}

// End command tracking and send telemetry
export async function endCommand(debug?: boolean): Promise<void> {
  if (!currentCommandState) return;

  const duration = Date.now() - currentCommandState.startTime;

  // Explicitly build properties from the current state
  const eventProperties: Record<string, any> = {
    command: currentCommandState.command,
    duration,
    // Explicitly include all potential token types, using undefined if not set
    contextTokens: currentCommandState.tokenCount, // Use the original name from state
    promptTokens: currentCommandState.promptTokens,
    completionTokens: currentCommandState.completionTokens,
    // Add provider and model as separate properties
    provider: currentCommandState.provider,
    model: currentCommandState.model,
    // Add plan-specific provider and model fields
    fileProvider: currentCommandState.fileProvider,
    fileModel: currentCommandState.fileModel,
    thinkingProvider: currentCommandState.thinkingProvider,
    thinkingModel: currentCommandState.thinkingModel,
    options: currentCommandState.options,
    hasError: !!currentCommandState.error,
    errorType: currentCommandState.error?.type,
  };

  // Remove undefined token properties before sending for cleaner payload
  if (eventProperties.contextTokens === undefined) delete eventProperties.contextTokens;
  if (eventProperties.promptTokens === undefined) delete eventProperties.promptTokens;
  if (eventProperties.completionTokens === undefined) delete eventProperties.completionTokens;
  if (eventProperties.provider === undefined) delete eventProperties.provider;
  if (eventProperties.model === undefined) delete eventProperties.model;
  if (eventProperties.fileProvider === undefined) delete eventProperties.fileProvider;
  if (eventProperties.fileModel === undefined) delete eventProperties.fileModel;
  if (eventProperties.thinkingProvider === undefined) delete eventProperties.thinkingProvider;
  if (eventProperties.thinkingModel === undefined) delete eventProperties.thinkingModel;

  // Log the state and final properties just before sending
  debug && console.log(`[Telemetry] State before sending command_executed:`, currentCommandState);
  debug && console.log(`[Telemetry] Properties being sent:`, eventProperties);

  // Track the command event
  await trackEvent('command_executed', eventProperties, debug);

  // Track error as separate event if present
  if (currentCommandState.error) {
    await trackEvent(
      'command_error',
      {
        command: currentCommandState.command,
        errorType: currentCommandState.error.type,
        errorMessage: currentCommandState.error.message,
      },
      debug
    );
  }

  // Reset the command state
  currentCommandState = null;
}

// Helper function to sanitize option objects (remove sensitive data)
function sanitizeOptions(options: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  // Copy only non-sensitive values to avoid sending private data
  // List of options that are safe to track
  const safeOptions = [
    'debug',
    'maxTokens',
    'saveTo',
    'quiet',
    'html',
    'headless',
    'console',
    'network',
    'reasoningEffort',
    'timeout',
  ];

  for (const key of safeOptions) {
    if (key in options && options[key] !== undefined) {
      sanitized[key] = options[key];
    }
  }

  // Track certain options as booleans (presence only)
  if (options.withDoc) {
    sanitized.hasWithDoc = true;
    sanitized.withDocCount = Array.isArray(options.withDoc) ? options.withDoc.length : 1;
  }

  return sanitized;
}

export async function trackEvent(
  eventName: string,
  properties: Record<string, any>,
  debug?: boolean
): Promise<void> {
  const enabledStatus = isTelemetryEnabled();

  if (enabledStatus !== true) {
    if (debug) {
      console.log(`[Telemetry] Telemetry is disabled, not sending event: ${eventName}`);
    }
    return;
  }

  const currentUserId = getUserIdFromDiagnostics();
  if (currentUserId.startsWith('anonymous_')) {
    if (debug) {
      console.log(
        '[Telemetry] Error: Attempted to track event with anonymous ID while telemetry is enabled.'
      );
    }
    return;
  }

  const payload = {
    data: {
      eventName,
      userId: currentUserId,
      sessionId: SESSION_ID,
      timestamp: new Date().toISOString(),
      toolVersion: getCurrentVersion(),
      ...properties,
    },
  };

  // Log the exact payload before sending
  if (debug) {
    console.log(`[Telemetry] Sending event: ${eventName}`, JSON.stringify(payload));
  }

  try {
    // Set a timeout using a standard approach rather than AbortSignal.timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch((error) => {
      // Handle network errors
      if (debug) {
        console.log(`[Telemetry] Network error during fetch: ${error.message}`);
      }
      return null;
    });

    clearTimeout(timeoutId);

    if (response && !response.ok) {
      if (debug) {
        console.log(`[Telemetry] Fetch failed: ${response.status} ${response.statusText}`);
      }
    } else if (response && debug) {
      console.log(`[Telemetry] Event sent successfully: ${eventName}`);
    }
  } catch (error) {
    if (debug) {
      console.log(
        `[Telemetry] Error during fetch: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    // Don't rethrow - telemetry errors should never break user flow
  }
}
