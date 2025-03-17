import * as path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import * as fs from 'fs';
import { mkdir } from 'fs/promises';
import { glob } from 'glob';
import { RetryConfig } from './types';
import fastGlob from 'fast-glob';

const exec = promisify(execCallback);
export const readFile = promisify(fs.readFile);

/**
 * Get the current git branch
 *
 * @returns The current branch name or 'unknown-branch' if not in a git repository
 */
export async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout } = await exec('git branch --show-current');
    return stdout.trim() || 'unknown-branch';
  } catch (error) {
    console.error('Error determining current branch:', error);
    return 'unknown-branch';
  }
}

/**
 * Create a directory if it doesn't exist
 *
 * @param dir - Directory path to create
 */
export async function createDirIfNotExists(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Find all feature behavior files matching a pattern
 *
 * @param pattern - Glob pattern to match feature behavior files
 * @returns AsyncGenerator that yields file paths as they are found
 */
export async function* findFeatureBehaviorFiles(
  pattern: string
): AsyncGenerator<string, void, unknown> {
  const stream = fastGlob.stream(pattern, {
    absolute: false, // Return paths relative to cwd
    dot: true, // Include dotfiles
    followSymbolicLinks: true, // Follow symlinks
    onlyFiles: true, // Only return files, not directories
  });

  for await (const file of stream) {
    yield file.toString();
  }
}

/**
 * Find all feature behavior files matching a pattern (non-streaming version)
 *
 * @param pattern - Glob pattern to match feature behavior files
 * @returns Promise resolving to array of file paths
 * @deprecated Use the streaming version instead
 */
export async function findFeatureBehaviorFilesArray(pattern: string): Promise<string[]> {
  return glob(pattern);
}

/**
 * Generate a standardized report filename for a feature behavior file
 *
 * @param featureBehaviorFile - Path to the feature behavior file
 * @returns Report filename
 */
export function getReportFilename(featureBehaviorFile: string): string {
  const baseName = path.basename(featureBehaviorFile, '.md');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${baseName}_report_${timestamp}.md`;
}

/**
 * Generate a standardized result filename for a feature behavior file
 *
 * @param featureBehaviorFile - Path to the feature behavior file
 * @returns Result filename
 */
export function getResultFilename(featureBehaviorFile: string): string {
  const baseName = path.basename(featureBehaviorFile, '.md');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${baseName}_result_${timestamp}.txt`;
}

/**
 * Check if an error is transient (network error, rate limit, etc.)
 *
 * @param error - The error to check
 * @returns True if the error is transient and should be retried
 */
export function isTransientError(error: unknown): boolean {
  // Network errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('throttle') ||
      message.includes('eai_again') ||
      message.includes('socket') ||
      message.includes('connection') ||
      message.includes('temporary')
    );
  }
  return false;
}

/**
 * Calculate exponential backoff delay with jitter
 *
 * @param attempt - Current attempt number (1-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const { initialDelay, maxDelay, factor, jitter } = config;

  // Calculate base delay with exponential factor
  let delay = initialDelay * Math.pow(factor, attempt - 1);

  // Apply jitter
  if (jitter) {
    // Add random jitter between -25% and +25%
    const jitterFactor = 0.25;
    const randomJitter = 1 - jitterFactor + Math.random() * jitterFactor * 2;
    delay = delay * randomJitter;
  }

  // Cap at maximum delay
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
