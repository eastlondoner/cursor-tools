/**
 * Entry point for the Xcode command functionality in vibe-tools.
 * This file exports the main XcodeCommand instance that handles all Xcode-related operations.
 *
 * The command is designed to be simple and focused, delegating actual functionality
 * to subcommands like 'build' for better organization and maintainability.
 */

import { XcodeCommand } from './xcode.js';

// Export a singleton instance of XcodeCommand to be used by the CLI
export default new XcodeCommand();
