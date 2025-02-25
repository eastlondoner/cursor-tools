/**
 * Utility module that provides a Promise-based wrapper around Node's exec function.
 * This allows for easier async/await usage of child process execution throughout the codebase.
 *
 * Usage:
 * ```typescript
 * try {
 *   const { stdout, stderr } = await execAsync('some command');
 *   console.log('Output:', stdout);
 * } catch (error) {
 *   console.error('Failed:', error);
 * }
 * ```
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

// Convert the callback-based exec function to a Promise-based one
export const execAsync = promisify(exec);
