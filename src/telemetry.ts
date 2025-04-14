import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import fetch from 'node-fetch';
import { version } from '../package.json';

const TELEMETRY_ENDPOINT = 'https://vibe-tools-telemetry.flowisgreat.workers.dev/api/pipeline';
const CONFIG_DIR = join(homedir(), '.vibe-tools');
const USER_ID_PATH = join(CONFIG_DIR, 'user_id');
const TELEMETRY_STATUS_PATH = join(CONFIG_DIR, 'telemetry_status');
const SESSION_ID = randomUUID();

let userId: string | null = null;
let telemetryStatus: boolean | null = null;

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

function getTelemetryStatusFromFile(): boolean | null {
  if (telemetryStatus !== null) {
    return telemetryStatus;
  }
  try {
    if (existsSync(TELEMETRY_STATUS_PATH)) {
      const content = readFileSync(TELEMETRY_STATUS_PATH, 'utf-8').trim().toLowerCase();
      if (content === 'true') {
        telemetryStatus = true;
        return true;
      }
      if (content === 'false') {
        telemetryStatus = false;
        return false;
      }
    }
  } catch (error) {
    console.error('Error reading telemetry status file:', error);
  }
  telemetryStatus = null;
  return null;
}

export function setTelemetryStatus(enabled: boolean): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(TELEMETRY_STATUS_PATH, String(enabled), 'utf-8');
    telemetryStatus = enabled;
    if (enabled === false && userId && !userId.startsWith('anonymous_')) {
      userId = 'anonymous_opt_out';
    }
  } catch (error) {
    console.error('Error writing telemetry status file:', error);
  }
}

export function isTelemetryEnabled(): boolean | null {
  if (
    process.env.VIBE_TOOLS_NO_TELEMETRY === '1' ||
    process.env.VIBE_TOOLS_NO_TELEMETRY === 'true'
  ) {
    return false;
  }

  return getTelemetryStatusFromFile();
}

function getUserId(): string {
  if (userId) {
    return userId;
  }

  const enabledStatus = isTelemetryEnabled();

  if (enabledStatus === false || enabledStatus === null) {
    userId = enabledStatus === false ? 'anonymous_opt_out' : 'anonymous_pending_prompt';
    return userId;
  }

  try {
    if (existsSync(USER_ID_PATH)) {
      userId = readFileSync(USER_ID_PATH, 'utf-8').trim();
    } else {
      userId = randomUUID();
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
      }
      writeFileSync(USER_ID_PATH, userId, 'utf-8');
    }
  } catch (error) {
    console.error('Error handling persistent user ID:', error);
    userId = 'anonymous_error';
  }
  return userId!;
}

getUserId();

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

  const currentUserId = getUserId();
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
}
