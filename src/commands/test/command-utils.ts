import * as os from 'os';
import PQueue from 'p-queue';
import { TestOptions, RetryConfig, TestReport, TestScenarioResult } from './types';
import { createProvider } from '../../providers/base';
import { once } from '../../utils/once';
import { yieldOutput } from '../../utils/output';

/**
 * Creates and configures the retry configuration based on the provided options
 */
export function createRetryConfig(retries: number = 3): RetryConfig {
  return {
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    factor: 2, // Exponential factor
    retries,
    jitter: true, // Add some randomness to prevent thundering herd
  };
}

/**
 * Creates and configures the provider and model based on the provided options
 */
export function setupProviderAndModel(options: TestOptions): { provider: 'anthropic' | 'openrouter'; model: string } {
  const provider = options.provider || 'anthropic';
  
  // Validate provider
  switch (provider) {
    case 'anthropic':
    case 'openrouter':
      break;
    default:
      throw new Error(`Unsupported provider for test command: ${provider}`);
  }

  const model =
    options.model ||
    (provider === 'anthropic' ? 'claude-3-7-sonnet-latest' : 'anthropic/claude-3.7-sonnet');

  return { provider, model };
}

/**
 * Creates a function that returns a Gemini provider, ensuring only one instance is created
 */
export function createGeminiProviderFactory() {
  return once(() => createProvider('gemini'));
}

/**
 * Formats a time duration in seconds into a human-readable string
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${Math.floor(seconds % 60)}s`;
}

/**
 * Creates and configures a PQueue instance for parallel execution with progress reporting
 */
export function createExecutionQueue(
  options: TestOptions,
  startTime: number,
  progressStats: {
    totalScenarios: number;
    completedScenarios: number;
  }
): PQueue {
  const parallel = options.parallel || Math.max(1, os.cpus().length - 1);
  const queue = new PQueue({ concurrency: parallel });
  let lastReportTime = Date.now();
  const reportInterval = 3000; // Report every 3 seconds

  queue.on('active', () => {
    const progress = Math.round((progressStats.completedScenarios / progressStats.totalScenarios) * 100);
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - startTime) / 1000;

    // Only report at intervals to avoid excessive output
    if (parallel > 1 && (currentTime - lastReportTime > reportInterval || queue.size < parallel)) {
      // Calculate estimated time remaining
      let estimatedTimeRemaining = 0;
      if (progressStats.completedScenarios > 0) {
        const avgTimePerScenario = elapsedSeconds / progressStats.completedScenarios;
        const remainingScenarios = progressStats.totalScenarios - progressStats.completedScenarios;
        // Adjust for parallel execution
        estimatedTimeRemaining =
          (avgTimePerScenario * remainingScenarios) / Math.min(parallel, remainingScenarios || 1);
      }

      const statusMessage =
        `⏳ Progress: ${progressStats.completedScenarios}/${progressStats.totalScenarios} scenarios completed (${progress}%)
🔄 Status: ${queue.size} running, ${progressStats.totalScenarios - progressStats.completedScenarios - queue.size} pending` +
        (elapsedSeconds > 2
          ? `
⏱️ Elapsed: ${formatTime(elapsedSeconds)}
⏰ Est. remaining: ${formatTime(estimatedTimeRemaining)}
`
          : '');

      void yieldOutput(statusMessage, options).catch((err) =>
        console.error('Error yielding progress output:', err)
      );

      lastReportTime = currentTime;
    }
  });

  return queue;
}

/**
 * Creates a test report object with the common fields populated
 */
export function createTestReport(
  featureName: string,
  description: string,
  scenarios: TestScenarioResult[],
  branch: string,
  provider: string,
  model: string,
  totalExecutionTime: number
): TestReport {
  const failedScenarios = scenarios.filter((r) => r.result === 'FAIL').map((r) => r.id);
  const overallResult = failedScenarios.length === 0 ? 'PASS' : 'FAIL';

  return {
    featureName,
    description,
    scenarios,
    timestamp: new Date().toISOString(),
    branch,
    provider,
    model,
    os: `${os.platform()} ${os.release()}`,
    nodeVersion: process.version,
    overallResult,
    failedScenarios,
    totalExecutionTime,
  };
}

/**
 * Generates parallel execution statistics summary
 */
export function generateParallelStats(
  parallel: number,
  sequentialEstimatedTime: number,
  totalExecutionTime: number,
  scenarios: TestScenarioResult[]
): string {
  const timeSaved = sequentialEstimatedTime - totalExecutionTime;
  const speedupFactor = sequentialEstimatedTime / totalExecutionTime;
  const efficiency = (speedupFactor / parallel) * 100;
  const avgScenarioTime = sequentialEstimatedTime / scenarios.length;

  return `
⚡ Parallel Execution Statistics:
- Concurrency level: ${parallel}
- Estimated sequential time: ${formatTime(sequentialEstimatedTime)}
- Actual parallel time: ${formatTime(totalExecutionTime)}
- Time saved: ${formatTime(timeSaved)} (${Math.round((timeSaved / sequentialEstimatedTime) * 100)}%)
- Speedup factor: ${speedupFactor.toFixed(2)}x
- Parallel efficiency: ${efficiency.toFixed(1)}%
- Average scenario time: ${formatTime(avgScenarioTime)}
`;
} 