import type {
  ToolDefinition,
  ToolExecutionResult,
} from '../../../utils/tool-enabled-llm/unified-client';

import * as childProcess from 'child_process';
import { promisify } from 'util';

const exec = promisify(childProcess.exec);

/**
 * Create a tool definition for executing vibe-tools commands in the development environment
 *
 * @returns A tool definition for command execution
 */
export function createCommandExecutionTool(options: { debug: boolean }): ToolDefinition {
  return {
    name: 'execute_command',
    description: 'Execute a vibe-tools command in the development environment',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The vibe-tools command to execute',
        },
      },
      required: ['command'],
    },
    execute: async (args: { command: string }): Promise<ToolExecutionResult> => {
      try {
        // Replace vibe-tools with pnpm dev to use development code
        const devCommand = args.command.replace(/^vibe-tools\s/, 'pnpm dev ');

        if (options.debug) {
          console.log(`\nExecuting command: ${devCommand}`);
        }

        let { stdout, stderr } = await exec(devCommand, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer to handle large outputs
        });

        stdout = stdout.trim();
        stderr = stderr.trim();

        if (stderr && !stdout) {
          return {
            success: false,
            output: stderr,
            error: {
              message: 'Command returned error output',
              details: { stderr },
            },
          };
        }

        // Return successful result with both stdout and stderr if available
        return {
          success: true,
          output: stdout || 'Command executed successfully with no output',
          ...(stderr
            ? { error: { message: 'Warning: stderr output was present', details: { stderr } } }
            : {}),
        };
      } catch (error) {
        // Handle specific error types with detailed information
        if (error instanceof Error) {
          const errorObj: ToolExecutionResult & {
            error: { message: string; code?: number; details?: Record<string, any> };
          } = {
            success: false,
            output: `Command execution failed: ${error.message}`,
            error: {
              message: error.message,
            },
          };

          // Extract exit code from child process error if available
          if ('code' in error && typeof error.code === 'number') {
            errorObj.error.code = error.code;
          }

          // For command not found or permission errors
          if (error.message.includes('command not found') || error.message.includes('ENOENT')) {
            errorObj.error.details = {
              type: 'COMMAND_NOT_FOUND',
              suggestion: 'Ensure the command is installed and in your PATH',
            };
          } else if (
            error.message.includes('permission denied') ||
            error.message.includes('EACCES')
          ) {
            errorObj.error.details = {
              type: 'PERMISSION_DENIED',
              suggestion: 'Check file permissions or try with appropriate privileges',
            };
          }

          return errorObj;
        }

        return {
          success: false,
          output: 'Command execution failed with unknown error',
          error: {
            message: 'Unknown error',
          },
        };
      }
    },
  };
}
