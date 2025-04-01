/**
 * Implementation of the Xcode build command.
 * This command handles building iOS apps and reporting build errors.
 *
 * Key features:
 * - Automatic project/workspace detection
 * - Build output streaming
 * - Error parsing and reporting
 */

import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { spawn } from 'node:child_process';
import { findXcodeProject, type XcodeBuildError } from './utils.js';

/**
 * Command-specific flags and options
 */
interface BuildCommandOptions {
  buildPath?: string;
  destination?: string;
}

export class BuildCommand implements Command {
  /**
   * Builds the Xcode project and streams output.
   * Handles both project and workspace configurations.
   *
   * @param dir - Project directory
   * @returns Promise resolving to build info and errors
   */

  // Default build path relative to project directory
  private defaultBuildPath = './.build/DerivedData';

  // Default destination for simulator
  private defaultDestination = 'platform=iOS Simulator,name=iPhone 16 Pro';

  private async getBuildOutput(
    dir: string,
    options: BuildCommandOptions = {}
  ): Promise<{ output: string; errors: XcodeBuildError[]; buildPath: string }> {
    return new Promise((resolve, reject) => {
      const project = findXcodeProject(dir);
      if (!project) {
        reject(new Error('No Xcode project or workspace found in the current directory'));
        return;
      }

      // Use provided build path or default
      const buildPath = options.buildPath || this.defaultBuildPath;

      // Use provided destination or default
      const destination = options.destination || this.defaultDestination;

      // Create absolute path for the build directory
      const absoluteBuildPath = buildPath.startsWith('/') ? buildPath : `${dir}/${buildPath}`;

      // Build the project/workspace
      const args = [
        '-configuration',
        'Debug',
        '-sdk',
        'iphonesimulator',
        '-scheme',
        project.name,
        '-derivedDataPath',
        buildPath,
        '-destination',
        destination,
        '-UseNewBuildSystem=YES',
        '-parallel-testing-enabled=YES',
        '-parallelizeTargets=YES',
        'CODE_SIGN_IDENTITY=-',
        'CODE_SIGNING_REQUIRED=NO',
        'CODE_SIGNING_ALLOWED=NO',
      ];

      if (project.type === 'workspace') {
        args.unshift('-workspace', project.path);
      } else {
        args.unshift('-project', project.path);
      }

      console.log('Running:', 'xcodebuild', args.join(' '));
      const xcodebuild = spawn('xcodebuild', args, { cwd: dir });
      let output = '';
      xcodebuild.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Stream all build output for better debugging
        console.log(text.trim());
      });
      xcodebuild.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.error(text.trim());
      });
      xcodebuild.on('error', reject);
      xcodebuild.on('close', (code) => {
        if (code === 0) {
          resolve({
            output,
            errors: this.parseBuildOutput(output),
            buildPath: absoluteBuildPath,
          });
        } else {
          reject(
            new Error(
              `Build failed with exit code ${code}. Check the build output above for details.`
            )
          );
        }
      });
    });
  }

  /**
   * Parses build output to extract errors and warnings.
   * Handles both file-specific and general messages.
   *
   * @param output - Raw build output string
   * @returns Array of parsed errors
   */
  private parseBuildOutput(output: string): XcodeBuildError[] {
    const errors: XcodeBuildError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match lines with file paths (e.g. "/path/to/file: error: message")
      if (line.includes(': error:') || line.includes(': warning:') || line.includes(': note:')) {
        const match = line.match(/^(.+?):\s*(error|warning|note):\s*(.+)$/);
        if (match) {
          const [, file, type, message] = match;
          errors.push({
            file: file.trim(),
            message: message.trim(),
            type: type as 'error' | 'warning' | 'note',
          });
        }
      }
      // Match direct messages (e.g. "error: message")
      else if (
        line.trim().startsWith('error:') ||
        line.trim().startsWith('warning:') ||
        line.trim().startsWith('note:')
      ) {
        const match = line.trim().match(/^(error|warning|note):\s*(.+)$/);
        if (match) {
          const [, type, message] = match;
          errors.push({
            message: message.trim(),
            type: type as 'error' | 'warning' | 'note',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Main execution method for the build command.
   * Builds the project and reports any errors or warnings.
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

      // Extract build path and destination options from the query string
      // Format: [buildPath=path] [destination=platform,name=Device]
      const buildPathMatch = query.match(/buildPath=([^\s]+)/);
      const destinationMatch = query.match(/destination=([^\s]+)/);

      const buildOptions: BuildCommandOptions = {
        buildPath: buildPathMatch ? buildPathMatch[1] : this.defaultBuildPath,
        destination: destinationMatch ? destinationMatch[1] : this.defaultDestination,
      };

      yield 'Building Xcode project...\n';

      // Pass build options to getBuildOutput
      const { errors, buildPath } = await this.getBuildOutput(dir, buildOptions);

      // Store build path in global state for the run command to use
      process.env.XCODE_BUILD_PATH = buildPath;

      // Group errors by type
      const buildErrors = errors.filter((e) => e.type === 'error');
      const warnings = errors.filter((e) => e.type === 'warning');
      const notes = errors.filter((e) => e.type === 'note');

      // Report errors first - these are blocking
      if (buildErrors.length > 0) {
        yield '\nBuild Errors:\n';
        for (const error of buildErrors) {
          if (error.file) {
            yield `${error.file}: ${error.message}\n`;
          } else {
            yield `${error.message}\n`;
          }
        }
        throw new Error('Build failed due to errors');
      }

      // Report warnings - these are non-blocking
      if (warnings.length > 0) {
        yield '\nWarnings:\n';
        for (const warning of warnings) {
          if (warning.file) {
            yield `${warning.file}: ${warning.message}\n`;
          } else {
            yield `${warning.message}\n`;
          }
        }
        yield '\nUse "vibe-tools xcode lint" to analyze and fix warnings.\n';
      }

      // Report notes - these are informational
      if (notes.length > 0) {
        yield '\nNotes:\n';
        for (const note of notes) {
          if (note.file) {
            yield `${note.file}: ${note.message}\n`;
          } else {
            yield `${note.message}\n`;
          }
        }
      }

      yield '\nBuild completed successfully.\n';
    } catch (error: any) {
      console.error(`Build failed: ${error}`);
      throw error;
    }
  }
}
