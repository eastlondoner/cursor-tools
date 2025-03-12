import * as os from 'os';
import PQueue from 'p-queue';
import {
  TestOptions,
  RetryConfig,
  TestReport,
  TestScenarioResult,
  TestScenario,
  FeatureBehavior,
} from './types';
import { createProvider } from '../../providers/base';
import { once } from '../../utils/once';
import { yieldOutput } from '../../utils/output';
import { parseFeatureBehaviorFile } from './parser';
import { executeScenario } from './executor-new';
import { saveReportToFile, saveResultToFile } from './reporting';
import { getReportFilename, getResultFilename } from './utils';
import * as path from 'path';

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
export function setupProviderAndModel(options: TestOptions): {
  provider: 'anthropic' | 'openrouter';
  model: string;
} {
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
    (provider === 'anthropic' ? 'claude-3-5-haiku-latest' : 'anthropic/claude-3.5-haiku');

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
    const progress = Math.round(
      (progressStats.completedScenarios / progressStats.totalScenarios) * 100
    );
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
  const passedScenarios = scenarios.filter((r) => r.result === 'PASS').length;
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
    passedScenarios,
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

/**
 * Helper function to filter scenarios based on tags and scenario numbers
 */
export function filterScenarios(
  scenarios: TestScenario[],
  tags?: string[],
  scenarioNumbers?: string
): TestScenario[] {
  let filteredScenarios = [...scenarios];

  if (tags) {
    filteredScenarios = filteredScenarios.filter(
      (scenario) => scenario.tags && scenario.tags.some((tag) => tags.includes(tag))
    );
  }

  if (scenarioNumbers) {
    const numbers = scenarioNumbers
      .split(',')
      .map((num) => parseInt(num.trim(), 10))
      .filter((num) => !isNaN(num) && num > 0);

    if (numbers.length > 0) {
      filteredScenarios = filteredScenarios.filter((scenario) => {
        const scenarioNumber = parseInt(scenario.id.split(' ')[1], 10);
        return numbers.includes(scenarioNumber);
      });
    }
  }

  return filteredScenarios;
}

/**
 * Create a queue for processing files in parallel
 */
export function createFileProcessingQueue(
  options: TestOptions,
  globalStats: {
    totalFiles: number;
    completedFiles: number;
    totalScenarios: number;
    completedScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
  }
): PQueue {
  const fileConcurrency = options.fileConcurrency || 3;
  const queue = new PQueue({ concurrency: fileConcurrency });
  let lastReportTime = Date.now();
  const reportInterval = 5000; // Report every 5 seconds

  queue.on('active', () => {
    const fileProgress = Math.round((globalStats.completedFiles / globalStats.totalFiles) * 100);
    const scenarioProgress =
      globalStats.totalScenarios > 0
        ? Math.round((globalStats.completedScenarios / globalStats.totalScenarios) * 100)
        : 0;

    const currentTime = Date.now();

    // Only report at intervals to avoid excessive output
    if (currentTime - lastReportTime > reportInterval || queue.size < fileConcurrency) {
      const statusMessage = `
📊 Overall Progress:
📂 Files: ${globalStats.completedFiles}/${globalStats.totalFiles} (${fileProgress}%)
🧪 Scenarios: ${globalStats.completedScenarios}/${globalStats.totalScenarios} (${scenarioProgress}%)
✅ Passed: ${globalStats.passedScenarios}
❌ Failed: ${globalStats.failedScenarios}
🔄 Current processing: ${queue.size} files
`;

      void yieldOutput(statusMessage, options).catch((err) =>
        console.error('Error yielding progress output:', err)
      );

      lastReportTime = currentTime;
    }
  });

  return queue;
}

/**
 * Process a single feature file and return its report
 */
export async function processFeatureFile(
  file: string,
  options: TestOptions,
  commonConfig: {
    provider: 'anthropic' | 'openrouter';
    model: string;
    branchOutputDir: string;
    branch: string;
    timeout: number;
    retryConfig: RetryConfig;
    debug: boolean;
    mcpServers: string[];
    tags?: string[];
  },
  globalStats: {
    totalFiles: number;
    completedFiles: number;
    totalScenarios: number;
    completedScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
  },
  outputCallback: (output: string) => Promise<void>
): Promise<{ file: string; report: TestReport | null }> {
  try {
    // Parse the feature file
    const featureBehavior = await parseFeatureBehaviorFile(file);
    if (!featureBehavior) {
      await outputCallback(`⚠️ Could not parse feature behavior file: ${file}\n`);
      return { file, report: null };
    }

    if (featureBehavior.scenarios.length === 0) {
      await outputCallback(`⚠️ No scenarios found in: ${file}\n`);
      return { file, report: null };
    }

    // Filter scenarios if needed (based on tags and scenario numbers)
    let scenarios = filterScenarios(
      featureBehavior.scenarios,
      commonConfig.tags,
      options.scenarios
    );

    if (scenarios.length === 0) {
      await outputCallback(`⚠️ No matching scenarios in: ${file}\n`);
      return { file, report: null };
    }

    // Update global stats
    globalStats.totalScenarios += scenarios.length;

    // Execute scenarios
    const startTime = Date.now();
    const progressStats = {
      totalScenarios: scenarios.length,
      completedScenarios: 0,
    };

    const queue = createExecutionQueue(options, startTime, progressStats);
    const resultPromises: Promise<TestScenarioResult | void>[] = [];

    // Add scenarios to the queue
    for (const scenario of scenarios) {
      const result = queue.add(async (): Promise<TestScenarioResult> => {
        const scenarioId = scenario.id;
        const scenarioOutputBuffer: string[] = [];

        try {
          const scenarioResult = await executeScenario(
            scenario,
            {
              provider: commonConfig.provider,
              model: commonConfig.model,
              timeout: commonConfig.timeout,
              retryConfig: commonConfig.retryConfig,
              debug: commonConfig.debug,
              mcpServers: commonConfig.mcpServers,
              scenarioId,
              outputBuffer: scenarioOutputBuffer,
            },
            createGeminiProviderFactory()()
          );

          scenarioResult.outputBuffer = scenarioOutputBuffer;
          progressStats.completedScenarios++;
          return scenarioResult;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const failedResult: TestScenarioResult = {
            id: scenarioId,
            type: scenario.type,
            description: scenario.description,
            taskDescription: scenario.taskDescription,
            approachTaken: '',
            commands: [],
            output: '',
            outputBuffer: scenarioOutputBuffer,
            expectedBehavior: scenario.expectedBehavior.map((behavior) => ({
              behavior,
              met: false,
              explanation: 'Execution error',
            })),
            successCriteria: scenario.successCriteria.map((criteria) => ({
              criteria,
              met: false,
              explanation: 'Execution error',
            })),
            result: 'FAIL',
            executionTime: 0,
            attempts: 0,
            explanation: 'Failed to execute scenario',
            error: errorMessage,
          };
          progressStats.completedScenarios++;
          return failedResult;
        }
      });

      resultPromises.push(
        result.then(async (result) => {
          if (result && !options.skipIntermediateOutput) {
            await outputCallback(
              `\n${'='.repeat(80)}\n` +
                `📝 Scenario: ${result.id}\n` +
                `${'='.repeat(80)}\n\n` +
                `${
                  result.outputBuffer && result.outputBuffer.length > 0
                    ? result.outputBuffer.join('')
                    : 'No logs available for this scenario.\n'
                }` +
                `\n${'='.repeat(80)}\n\n`
            );
          }
        })
      );
    }

    // Wait for scenarios to complete
    await queue.onIdle();
    await Promise.allSettled(resultPromises);

    // Process results and create report
    const results = (await Promise.all(resultPromises)).filter((r): r is TestScenarioResult => !!r);

    const totalExecutionTime = (Date.now() - startTime) / 1000;

    // Create and save report
    const testReport = createTestReport(
      featureBehavior.name,
      featureBehavior.description,
      results,
      commonConfig.branch,
      commonConfig.provider,
      commonConfig.model,
      totalExecutionTime
    );

    // Save report files
    const reportFilePath = path.join(commonConfig.branchOutputDir, getReportFilename(file));
    await saveReportToFile(testReport, reportFilePath);

    const resultFilePath = path.join(commonConfig.branchOutputDir, getResultFilename(file));
    await saveResultToFile(testReport, resultFilePath);

    // Update global statistics
    globalStats.completedScenarios += scenarios.length;
    globalStats.passedScenarios += results.filter((r) => r.result === 'PASS').length;
    globalStats.failedScenarios += testReport.failedScenarios.length;
    globalStats.completedFiles += 1;

    return { file, report: testReport };
  } catch (error) {
    await outputCallback(
      `❌ Error processing ${file}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return { file, report: null };
  }
}
