import * as path from 'path';
import PQueue from 'p-queue';
import { TestOptions, RetryConfig, TestReport, TestScenarioResult, TestScenario } from './types';
import { parseFeatureBehaviorFile } from './parser';
import { executeScenario } from './executor-new';
import { saveReportToFile, saveResultToFile } from './reporting';
import { getReportFilename, getResultFilename } from './utils';
import { yieldOutput } from '../../utils/output';
import {
  createGeminiProviderFactory,
  createExecutionQueue,
  createTestReport,
} from './command-utils';

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
    totalExecutionTime: number;
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
    totalExecutionTime: number;
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

    // Create an array to store the actual results
    const scenarioResults: TestScenarioResult[] = [];

    // Modify the queue creation to store results directly
    const executeScenarioWithTracking = async (
      scenario: TestScenario
    ): Promise<TestScenarioResult> => {
      const scenarioId = scenario.id;
      const scenarioOutputBuffer: string[] = [];

      try {
        const result = await executeScenario(
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

        // Store the result in our tracking array
        scenarioResults.push(result);
        return result;
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

        // Store the failed result in our tracking array
        scenarioResults.push(failedResult);
        return failedResult;
      }
    };

    // Add scenarios to the queue with our tracking wrapper
    for (const scenario of scenarios) {
      const result = queue.add(() => executeScenarioWithTracking(scenario));

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

    // Use the collected results
    const results = scenarioResults;

    console.log(`DEBUG: Results array has ${results.length} scenarios`);
    if (results.length > 0) {
      console.log(`DEBUG: First scenario ID: ${results[0].id}, Result: ${results[0].result}`);
    }

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

    // Make sure the scenarios are added to the report
    testReport.scenarios = results;

    // Save report files
    const reportFilePath = path.join(commonConfig.branchOutputDir, getReportFilename(file));
    await saveReportToFile(testReport, reportFilePath);

    const resultFilePath = path.join(commonConfig.branchOutputDir, getResultFilename(file));
    await saveResultToFile(testReport, resultFilePath);

    // Update global statistics
    // Count scenarios with explicit 'PASS' result
    const passedCount = results.filter((r) => r.result === 'PASS').length;
    const failedCount = testReport.failedScenarios.length;

    // Update the test report's passedScenarios property
    testReport.passedScenarios = passedCount;

    // Update global statistics
    globalStats.completedScenarios += scenarios.length;
    globalStats.passedScenarios += passedCount;
    globalStats.failedScenarios += failedCount;
    globalStats.completedFiles += 1;
    globalStats.totalExecutionTime += totalExecutionTime;

    return { file, report: testReport };
  } catch (error) {
    await outputCallback(
      `❌ Error processing ${file}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return { file, report: null };
  }
}
