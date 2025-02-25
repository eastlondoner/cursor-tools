/**
 * Implementation of the Xcode lint command.
 * This command analyzes code and offers to fix warnings.
 *
 * Key features:
 * - Warning analysis
 * - Interactive fixes
 * - SwiftLint integration
 */

import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { findXcodeProject } from './utils.js';
import { BuildCommand } from './build.js';

export class LintCommand implements Command {
  /**
   * Main execution method for the lint command.
   * Analyzes code and offers to fix warnings.
   *
   * @param query - Command query string (unused)
   * @param options - Command options
   * @yields Status messages and command output
   */
  async *execute(query: string, options: CommandOptions): CommandGenerator {
    try {
      const dir = process.cwd();
      const project = findXcodeProject(dir);
      if (!project) {
        throw new Error('No Xcode project or workspace found in current directory');
      }

      yield 'Building project to check for warnings...\n';

      // First build the project to get warnings
      const buildCommand = new BuildCommand();
      let warnings: string[] = [];
      try {
        yield* buildCommand.execute('', options);
      } catch (error: any) {
        // Capture any build output that might contain warnings
        if (error.message) {
          warnings = error.message
            .split('\n')
            .filter((line: string) => line.includes(': warning:'))
            .map((line: string) => line.trim());
        }
        if (error.message.includes('Build failed due to errors')) {
          throw new Error(
            'Cannot analyze warnings while there are build errors. Please fix errors first.'
          );
        }
      }

      if (warnings.length === 0) {
        yield 'No warnings found!\n';
        return;
      }

      yield `\nFound ${warnings.length} warnings to analyze:\n`;
      for (const warning of warnings) {
        yield `${warning}\n`;
      }

      yield '\nTo fix these warnings:\n';
      yield '1. Use SwiftLint to enforce consistent style:\n';
      yield '   brew install swiftlint\n';
      yield '   Add .swiftlint.yml to your project\n';
      yield '\n2. Common fixes:\n';
      yield '   - Unused variables: Remove or use `_`\n';
      yield '   - Long lines: Break into multiple lines\n';
      yield '   - Force unwrap: Use optional binding\n';
      yield '   - Implicit type: Explicitly declare types\n';
      yield '\n3. Run SwiftLint auto-correct:\n';
      yield '   swiftlint --fix\n';
    } catch (error: any) {
      console.error(`Lint failed: ${error}`);
      throw error;
    }
  }
}
