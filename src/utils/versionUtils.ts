import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import consola from 'consola';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface VersionInfo {
  current: string;
  latest: string | null;
  isOutdated: boolean;
}

/**
 * Gets the currently installed version of vibe-tools from package.json.
 */
export function getCurrentVersion(): string {
  try {
    const packageJsonPath = join(__dirname, '../../package.json'); // Adjust path relative to dist/utils
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch (error) {
    consola.error('Failed to read current version from package.json:', error);
    // Return a fallback version or handle error as appropriate
    return '0.0.0'; // Fallback version
  }
}

/**
 * Gets the latest available version of vibe-tools from the NPM registry.
 * Uses `npm view vibe-tools version`.
 */
export async function getLatestVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('npm view vibe-tools version');
    return stdout.trim();
  } catch (error) {
    consola.warn('Failed to fetch latest version from NPM:', error);
    return null; // Indicate failure to fetch
  }
}

/**
 * Checks if the currently installed version is outdated compared to the latest NPM version.
 * Note: This uses simple string comparison. For robust comparison (e.g., handling pre-releases),
 * a library like 'semver' would be better, but sticking to simplicity for now.
 */
export async function checkPackageVersion(): Promise<VersionInfo> {
  const current = getCurrentVersion();
  const latest = await getLatestVersion();

  const isOutdated = latest !== null && current !== latest;

  return {
    current,
    latest,
    isOutdated,
  };
}
