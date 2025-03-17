/**
 * Shared utilities for Xcode commands.
 * Contains common functionality used across different Xcode command implementations.
 */

import { readdirSync } from 'node:fs';

/**
 * Information about an Xcode project
 */
export interface XcodeProject {
  path: string;
  type: 'project' | 'workspace';
  name: string;
}

/**
 * Represents a build error or warning from Xcode
 */
export interface XcodeBuildError {
  file?: string; // Source file where the error occurred
  line?: number; // Line number in the file
  column?: number; // Column number in the file
  message: string; // Error message
  type: 'error' | 'warning' | 'note'; // Severity of the issue
}

/**
 * Maps device types to their simulator names.
 * These are the latest device types available in Xcode 15.
 */
export const DEVICE_TYPES = {
  iphone: 'iPhone 15 Pro Max',
  ipad: 'iPad Pro 13-inch (M4)',
} as const;

/**
 * Default timeouts for various operations
 */
export const DEFAULT_TIMEOUTS = {
  SIMULATOR_BOOT: 5000,
  APP_LAUNCH: 3000,
};

/**
 * Finds an Xcode project or workspace in the given directory.
 * Prefers workspaces over projects as they're more common in modern apps.
 *
 * @param dir - Directory to search in
 * @returns Project info or null if none found
 */
export function findXcodeProject(dir: string): XcodeProject | null {
  const files = readdirSync(dir);

  // First check for workspace since that's more common in modern projects
  const workspace = files.find((f) => f.endsWith('.xcworkspace'));
  if (workspace) {
    return {
      path: workspace,
      type: 'workspace',
      name: workspace.replace('.xcworkspace', ''),
    };
  }

  // Then check for project
  const project = files.find((f) => f.endsWith('.xcodeproj'));
  if (project) {
    return {
      path: project,
      type: 'project',
      name: project.replace('.xcodeproj', ''),
    };
  }

  return null;
}
