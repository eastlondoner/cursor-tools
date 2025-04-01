/**
 * Main orchestrator for Xcode-related commands in vibe-tools.
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
import { BuildCommand } from './build.js';
import { RunCommand } from './run.js';
import { LintCommand } from './lint.js';

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
  };

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

    // If no subcommand provided, show help
    if (!subcommand) {
      yield 'Usage: vibe-tools xcode <subcommand> [args]\n';
      yield 'Available subcommands:';
      yield '  build         Build Xcode project and report errors';
      yield '  lint          Analyze code and offer to fix warnings';
      yield '  run <device>  Build and run on simulator (iphone/ipad)\n';
      yield 'Examples:';
      yield '  vibe-tools xcode build';
      yield '  vibe-tools xcode lint';
      yield '  vibe-tools xcode run iphone';
      yield '  vibe-tools xcode run ipad';
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
      return;
    }

    // Execute the subcommand with remaining args
    yield* handler.execute(args.join(' '), options);
  }
}
