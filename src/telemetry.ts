import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import fetch from 'node-fetch';
import { version } from '../package.json';

const TELEMETRY_ENDPOINT = 'https://vibe-tools-infra.flowisgreat.workers.dev/api/pipeline';
const CONFIG_DIR = join(homedir(), '.vibe-tools');
const DIAGNOSTICS_PATH = join(CONFIG_DIR, 'diagnostics.json');
const SESSION_ID = randomUUID();

interface DiagnosticsData {
  userId?: string;
  telemetryEnabled?: boolean;
}

let diagnosticsData: DiagnosticsData | null = null;

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
  // Fallback in case of unexpected issues, although write should handle errors
  // return 'anonymous_error'; // Removed redundant error handling covered by writeDiagnosticsFile
}

// Initialize diagnostics on load - reads the file once if needed
readDiagnosticsFile();

export async function trackEvent(
  eventName: string,
  properties: Record<string, any>,
  debug?: boolean
): Promise<void> {
  try {
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
        toolVersion: version,
        ...properties,
      },
    };

    if (debug) {
      console.log(`[Telemetry] Sending event: ${eventName}`, JSON.stringify(payload));
    }

    try {
      const response = await fetch(TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        if (debug) {
          console.log(`Telemetry fetch failed: ${response.status} ${response.statusText}`);
        }
      } else if (debug) {
        console.log(`[Telemetry] Event sent successfully: ${eventName}`);
      }
    } catch (error) {
      if (debug) {
        console.log('Telemetry error during fetch:', error);
      }
    }
  } catch (error) {
    if (debug) {
      console.log(`Telemetry error during event processing for ${eventName}:`, error);
    }
  }
}
