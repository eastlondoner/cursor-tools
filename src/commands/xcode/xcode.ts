/**
 * Main orchestrator for Xcode-related commands in cursor-tools.
 * Implements the Command interface and manages subcommands for different Xcode operations.
 *
 * Currently supported subcommands:
 * - build: Builds the Xcode project and reports errors
 * - lint: Analyzes code and offers to fix warnings
 * - run: Builds and runs the app in simulator
 *
 * The command uses a subcommand pattern to keep the codebase organized and extensible.
 * Each subcommand is implemented as a separate class that handles its specific functionality.
 */

import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { BuildCommand } from './build';
import { RunCommand } from './run';
import { LintCommand } from './lint';

/**
 * Maps subcommand names to their implementing classes.
 * This allows easy addition of new subcommands without modifying existing code.
 */
type SubcommandMap = {
  [key: string]: Command;
};

export class XcodeCommand implements Command {
  /**
   * Registry of available subcommands.
   * Each subcommand is instantiated once and reused for all invocations.
   */
  private subcommands: SubcommandMap = {
    build: new BuildCommand(),
    run: new RunCommand(),
    lint: new LintCommand(),
    help: {
      execute: async function* (this: XcodeCommand, _: string, options: CommandOptions): CommandGenerator {
        yield this.getHelp();
      }.bind(this),
    },
  };

  /**
   * Returns a description of the Xcode command for help text.
   */
  getDescription(): string {
    return 'Build, run, and lint iOS apps in Xcode projects';
  }

  /**
   * Returns detailed help text for the Xcode command.
   */
  getHelp(): string {
    return `Xcode Command - Build, run, and lint iOS apps

Usage: cursor-tools xcode <subcommand> [args]

Subcommands:
  build         Build Xcode project and report errors
  run [device]  Build and run on simulator (iphone/ipad)
  lint          Analyze code and offer to fix warnings
  help          Show this help message

Examples:
  cursor-tools xcode build                # Build the project
  cursor-tools xcode run iphone           # Run on iPhone simulator
  cursor-tools xcode run ipad             # Run on iPad simulator
  cursor-tools xcode lint                 # Analyze code for warnings
  cursor-tools xcode help                 # Show this help message

Notes:
- Automatically detects .xcworkspace or .xcodeproj in current directory
- Uses latest simulator devices (iPhone 15 Pro Max, iPad Pro 13-inch)
- Streams build progress in real-time
- Reports errors, warnings, and notes with file locations
- Uses Debug configuration and iphonesimulator SDK
- Automatically handles simulator lifecycle (boot, install, launch)
- Detects app bundle identifier from Info.plist
- Uses Xcode's DerivedData for build products
- Includes SwiftLint integration for code style analysis

Dependencies:
- Requires Xcode and Xcode Command Line Tools
- Optional: SwiftLint for enhanced code analysis`;
  }

  /**
   * Main execution method for the Xcode command.
   * Parses the input query to determine which subcommand to run.
   *
   * @param query - The command query string (e.g., "build" or "run iphone")
   * @param options - Global command options that apply to all subcommands
   * @yields Status messages and command output
   */
  async *execute(query: string, options: CommandOptions): CommandGenerator {
    // Split query into subcommand and remaining args
    const [subcommand, ...args] = query.split(' ');

    // If no subcommand provided or help requested, show help
    if (!subcommand || subcommand === 'help' || options.help) {
      yield* this.subcommands.help.execute('', options);
      return;
    }

    // Get the subcommand handler
    const handler = this.subcommands[subcommand];
    if (!handler) {
      yield `Unknown subcommand: ${subcommand}\n`;
      yield 'Available subcommands:';
      yield '  build         Build Xcode project and report errors';
      yield '  lint          Analyze code and offer to fix warnings';
      yield '  run <device>  Build and run on simulator (iphone/ipad)';
      yield '  help          Show this help message';
      return;
    }

    // Execute the subcommand with remaining args
    yield* handler.execute(args.join(' '), options);
  }
}
