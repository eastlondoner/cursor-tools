import type { CommandOptions, Provider } from '../../types';
import type { ToolExecutionResult } from '../../utils/tool-enabled-llm/unified-client';
import { AssetReference } from '../../utils/assets';
import { z } from 'zod';

/**
 * A specialized AsyncGenerator for test commands that can return TestReport
 */
export type TestCommandGenerator<T = any> = AsyncGenerator<string, T, unknown>;

/**
 * Extended command options for the test command
 */
export interface TestOptions extends CommandOptions {
  output?: string;
  parallel?: number;
  branch?: string;
  compareWith?: string;
  timeout?: number;
  retries?: number;
  tag?: string;
  mcpServers?: string[]; // Optional MCP servers to include in testing
  scenarios?: string; // Comma-separated list of scenario numbers to run
  provider?: Provider;
  /**
   * Maximum number of files to process concurrently.
   * @defaultValue 3
   */
  fileConcurrency?: number;
  /**
   * Skip intermediate output during test execution.
   * @defaultValue false
   */
  skipIntermediateOutput?: boolean;
}

/**
 * Represents a test scenario in a feature behavior file
 */
export interface TestScenario {
  id: string;
  type: string;
  description: string;
  taskDescription: string;
  expectedBehavior: string[];
  successCriteria: string[];
  tags?: string[];
  assets?: Record<string, AssetReference>;
}

/**
 * Represents the parsed content of a feature behavior file
 */
export interface FeatureBehavior {
  name: string;
  description: string;
  scenarios: TestScenario[];
}

/**
 * Represents the result of executing a test scenario
 */
export interface TestScenarioResult {
  id: string;
  type: string;
  description: string;
  taskDescription: string;
  approachTaken: string;
  commands: string[];
  actualCommands?: string[]; // The actual commands executed with pnpm dev prefix
  output: string;
  outputBuffer?: string[]; // Buffer to store all output from this scenario
  toolExecutions?: Array<{ tool: string; args: any; result: ToolExecutionResult }>; // History of tool executions
  expectedBehavior: {
    behavior: string;
    met: boolean;
    explanation?: string; // Explanation of why the behavior was met or not
  }[];
  successCriteria: {
    criteria: string;
    met: boolean;
    explanation?: string; // Explanation of why the criteria was met or not
  }[];
  result: 'PASS' | 'FAIL';
  executionTime: number;
  attempts?: number; // Number of attempts made to execute the scenario
  explanation?: string; // Overall explanation of the test result
  error?: string;
}

/**
 * Represents a complete test report for a feature behavior file
 */
export interface TestReport {
  featureName: string;
  description: string;
  scenarios: TestScenarioResult[];
  timestamp: string;
  branch: string;
  provider: string;
  model: string;
  os: string;
  nodeVersion: string;
  overallResult: 'PASS' | 'FAIL';
  failedScenarios: string[];
  passedScenarios?: number;
  totalExecutionTime: number;
}

/**
 * Exponential backoff retry configuration
 */
export interface RetryConfig {
  initialDelay: number;
  maxDelay: number;
  factor: number;
  retries: number;
  jitter: boolean;
}

// New Zod schema for the simplified test result JSON response
export const TestResultSchema = z.object({
  id: z.string(),
  status: z.string().transform((val) => {
    const normalized = val.trim().toUpperCase();
    return normalized === 'PASS' ? 'PASS' : 'FAIL';
  }),
  summary: z.string(),
  executionTime: z.number(),
  error: z.string().nullable().optional().default(null),
});

export type TestResult = z.infer<typeof TestResultSchema>;
