import { Command, CommandOptions, CommandGenerator } from '../types.ts';
import { CURSOR_RULES_TEMPLATE } from '../cursorrules.ts';

export class InstructionsCommand implements Command {
  async *execute(query?: string, options?: CommandOptions): CommandGenerator {
    // Extract just the cursor-tools Integration section
    const startTag = '<cursor-tools Integration>';
    const endTag = '</cursor-tools Integration>';
    const start = CURSOR_RULES_TEMPLATE.indexOf(startTag) + startTag.length;
    const end = CURSOR_RULES_TEMPLATE.indexOf(endTag);
    const instructions = CURSOR_RULES_TEMPLATE.slice(start, end).trim();
    
    yield instructions;
  }

  getDescription(): string {
    return 'Output the cursor-tools instructions and command reference';
  }

  getHelp(): string {
    return `
Usage: cursor-tools instructions

Output the complete cursor-tools instructions and command reference.
This includes detailed information about all available commands, their options,
and best practices for using cursor-tools effectively.

Options:
  --save-to=<file path>  Save the instructions to a file in addition to displaying them
  --help                 Show this help message

Examples:
  cursor-tools instructions
  cursor-tools instructions --save-to=cursor-tools-reference.md
`;
  }
} 