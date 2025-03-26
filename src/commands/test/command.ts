import * as path from 'path';
import * as os from 'os';
import type { Command } from '../../types';
import { loadEnv, loadConfig } from '../../config';
import { yieldOutput } from '../../utils/output';
import { TestError, FeatureFileParseError } from '../../errors';
import { TestOptions, TestReport, TestScenarioResult } from './types';
import { parseFeatureBehaviorFile } from './parser';
import { executeScenario } from './executor-new';
import { saveReportToFile, saveResultToFile, compareReports } from './reporting';
import {
  getCurrentBranch,
  createDirIfNotExists,
  findFeatureBehaviorFiles,
  getReportFilename,
  getResultFilename,
} from './utils';
import {
  createRetryConfig,
  setupProviderAndModel,
  createGeminiProviderFactory,
  createExecutionQueue,
  createTestReport,
  generateParallelStats,
} from './command-utils';
import { createFileProcessingQueue, processFeatureFile } from './file-processing';

interface ExtendedTestOptions extends TestOptions {
  skipIntermediateOutput?: boolean;
}

/**
 * Implementation of the test command
 */
export class TestCommand implements Command {
  private config;

  constructor() {
    // Load environment variables and configuration
    loadEnv();
    this.config = loadConfig();
  }

  /**
   * Execute the test command
   *
   * @param query - Path to the feature behavior file or glob pattern
   * @param options - Test command options
   */
  async *execute(
    query: string,
    options: ExtendedTestOptions
  ): AsyncGenerator<string, void, unknown> {
    try {
      for await (const output of this.runTests(query, options)) {
        yield output;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new TestError(`Failed to execute test: ${error.message}`);
      }
      throw new TestError('Failed to execute test: Unknown error');
    }
  }

  /**
   * Run tests for either a single file or multiple files matching a pattern
   * @param query - Path to the feature behavior file or glob pattern
   * @param options - Test command options
   */
  private async *runTests(
    query: string,
    options: ExtendedTestOptions
  ): AsyncGenerator<string, void, unknown> {
    // Set up common configuration
    const { provider, model } = setupProviderAndModel(options);
    const outputDir = options.output || 'tests/reports';
    const branch = options.branch || (await getCurrentBranch());
    const timeout = options.timeout || 300; // 5 minutes
    const retries = options.retries || 3;
    const debug = options.debug || false;
    const mcpServers = options.mcpServers || [];
    const tags = options.tag ? options.tag.split(',') : undefined;
    const retryConfig = createRetryConfig(retries);
    const geminiProvider = createGeminiProviderFactory();

    // Create output directory
    const branchOutputDir = path.join(outputDir, branch);
    await createDirIfNotExists(branchOutputDir);

    // Determine if we're processing a single file or multiple files
    const isGlobPattern = query.includes('*');

    if (isGlobPattern) {
      // Find all files matching the pattern
      const files: string[] = [];
      for await (const file of findFeatureBehaviorFiles(query)) {
        files.push(file);
      }
      yield `📂 Found ${files.length} feature behavior files matching pattern: ${query}\n`;

      // Create global stats for tracking
      const globalStats = {
        totalFiles: files.length,
        completedFiles: 0,
        totalScenarios: 0,
        completedScenarios: 0,
        passedScenarios: 0,
        failedScenarios: 0,
        totalExecutionTime: 0,
      };

      // Common configuration for all files
      const commonConfig = {
        provider,
        model,
        branchOutputDir,
        branch,
        timeout,
        retryConfig,
        debug,
        mcpServers,
        tags,
      };

      // Create a queue for file processing
      const fileQueue = createFileProcessingQueue(options, globalStats);

      // Submit all files for processing
      const fileResults: { file: string; report: TestReport | null }[] = [];
      const filePromises: Promise<void>[] = [];

      // Create a wrapper for outputCallback that handles yielding
      const yieldWrapper = async (output: string) => {
        if (!options.skipIntermediateOutput) {
          await yieldOutput(output, options);
        }
      };

      for (const file of files) {
        const promise = fileQueue.add(async () => {
          const result = await processFeatureFile(
            file,
            options,
            commonConfig,
            globalStats,
            yieldWrapper
          );
          if (result.report) {
            fileResults.push(result);
          }
        });
        filePromises.push(promise);
      }

      // Wait for all file processing to complete
      await fileQueue.onIdle();
      await Promise.allSettled(filePromises);

      // Create and save overall summary report
      const overallSummaryReport = createTestReport(
        'Summary Report - Multiple Features',
        `Overall test summary for pattern: ${query}`,
        [], // Scenarios are not relevant for summary report
        branch,
        provider,
        model,
        globalStats.totalExecutionTime
      );

      // Set the passedScenarios property directly from globalStats
      overallSummaryReport.passedScenarios = globalStats.passedScenarios;

      // Update the failedScenarios list with actual failed file paths
      const failedFiles = fileResults
        .filter((fr) => fr.report?.overallResult === 'FAIL')
        .map((fr) => fr.file);

      // If we have specific failed scenarios from individual reports, use those
      // Otherwise, just use the file paths as the failed scenarios list
      if (failedFiles.length > 0) {
        overallSummaryReport.failedScenarios = failedFiles;
      } else {
        // Create dummy failed scenario IDs if needed
        overallSummaryReport.failedScenarios = Array(globalStats.failedScenarios)
          .fill(0)
          .map((_, i) => `failed-scenario-${i + 1}`);
      }

      const summaryReportFilePath = path.join(
        outputDir,
        getReportFilename(`summary-all-features-${Date.now()}`)
      );
      await saveReportToFile(overallSummaryReport, summaryReportFilePath);
      yield `📊 Summary report saved to: ${summaryReportFilePath}\n`;

      const summaryResultFilePath = path.join(
        outputDir,
        getResultFilename(`summary-all-features-${Date.now()}`)
      );
      await saveResultToFile(overallSummaryReport, summaryResultFilePath);
      yield `🏁 Summary result saved to: ${summaryResultFilePath}\n`;

      // Output final summary
      yield `
---------------------------------------------------------
📊 Overall Test Summary:
---------------------------------------------------------
🧪 Total Scenarios: ${globalStats.totalScenarios}
✅ Passed Scenarios: ${globalStats.passedScenarios}
❌ Failed Scenarios: ${globalStats.failedScenarios}${
        globalStats.failedScenarios > 0
          ? `\n${fileResults
              .filter((fr) => fr.report?.overallResult === 'FAIL')
              .map(
                (fr) =>
                  `  - Feature File: ${fr.file} - Failed Scenarios: ${fr.report?.failedScenarios.join(
                    ', '
                  )}`
              )
              .join('\n')}`
          : ''
      }
⏱️ Total Execution Time: ${globalStats.totalExecutionTime.toFixed(2)}s
🏁 Overall Result: ${globalStats.failedScenarios === 0 ? '✅ PASS' : '❌ FAIL'}
---------------------------------------------------------
`;
    } else {
      // Single file processing
      const featureBehavior = await parseFeatureBehaviorFile(query);
      if (!featureBehavior) {
        throw new FeatureFileParseError(query);
      }

      yield `\n🧪 Testing feature behavior: ${query}\n`;
      yield `📋 Options: outputDir=${outputDir}, branch=${branch}, model=${model}, timeout=${timeout}s, retries=${retries}${
        tags ? `, tags=${tags.join(',')}` : ''
      }${options.scenarios ? `, scenarios=${options.scenarios}` : ''}${
        mcpServers.length > 0 ? `, mcpServers=[${mcpServers.join(', ')}]` : ''
      }\n\n`;

      yield `📖 Testing feature: ${featureBehavior.name}\n`;
      yield `🔍 Description: ${featureBehavior.description}\n`;
      yield `🧩 Scenarios: ${featureBehavior.scenarios.length}\n\n`;

      // Filter scenarios
      let scenarios = featureBehavior.scenarios;
      if (tags) {
        scenarios = scenarios.filter(
          (scenario) => scenario.tags && scenario.tags.some((tag) => tags.includes(tag))
        );
        yield `🏷️ Filtered to ${scenarios.length} scenarios with tags: ${tags.join(', ')}\n\n`;
      }

      if (options.scenarios) {
        const numbers = options.scenarios
          .split(',')
          .map((num) => parseInt(num.trim(), 10))
          .filter((num) => !isNaN(num) && num > 0);

        if (numbers.length > 0) {
          scenarios = scenarios.filter((scenario) => {
            const scenarioNumber = parseInt(scenario.id.split(' ')[1], 10);
            return numbers.includes(scenarioNumber);
          });
          yield `🔢 Filtered to ${scenarios.length} scenarios with numbers: ${numbers.join(
            ', '
          )}\n\n`;
        }
      }

      if (scenarios.length === 0) {
        yield `⚠️ No scenarios to test\n`;
        return;
      }

      // Execute scenarios
      const startTime = Date.now();
      const progressStats = {
        totalScenarios: scenarios.length,
        completedScenarios: 0,
      };

      const queue = createExecutionQueue(options, startTime, progressStats);
      const actualResultPromises: Promise<TestScenarioResult | void>[] = [];

      for (const scenario of scenarios) {
        console.log(`DEBUG: Adding scenario ${scenario.id} to queue for result collection`);
        const result = queue.add(async (): Promise<TestScenarioResult> => {
          const scenarioId = scenario.id;
          const scenarioOutputBuffer: string[] = [];

          try {
            const scenarioResult = await executeScenario(
              scenario,
              {
                provider,
                model,
                timeout,
                retryConfig,
                debug,
                mcpServers,
                scenarioId,
                outputBuffer: scenarioOutputBuffer,
              },
              geminiProvider()
            );

            scenarioResult.outputBuffer = scenarioOutputBuffer;
            progressStats.completedScenarios++;
            console.log(
              `DEBUG: executeScenario returned result for ${scenarioId}:`,
              scenarioResult
            );
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

        actualResultPromises.push(result);
      }

      await queue.onIdle();
      await Promise.allSettled(actualResultPromises);

      // Use Promise.allSettled to properly handle both fulfilled and rejected promises
      const settledPromises = await Promise.allSettled(actualResultPromises);
      console.log(`DEBUG: Found ${settledPromises.length} settled promises`);

      // Log status of each settled promise
      settledPromises.forEach((result, index) => {
        console.log(`DEBUG: Promise ${index} status: ${result.status}`);
        if (result.status === 'fulfilled') {
          console.log(`DEBUG: Promise ${index} value:`, result.value);
        } else {
          console.log(`DEBUG: Promise ${index} reason:`, result.reason);
        }
      });

      // Extract only successfully fulfilled promises with actual TestScenarioResult values
      const results = settledPromises
        .filter(
          (r): r is PromiseFulfilledResult<TestScenarioResult> =>
            r.status === 'fulfilled' && r.value !== undefined
        )
        .map((r) => r.value);

      console.log(`DEBUG Command: Results array has ${results.length} scenarios`);
      if (results.length > 0) {
        console.log(
          `DEBUG Command: First scenario ID: ${results[0].id}, Result: ${results[0].result}`
        );
      }

      const totalExecutionTime = (Date.now() - startTime) / 1000;

      // Create and save report
      const testReport = createTestReport(
        featureBehavior.name,
        featureBehavior.description,
        results,
        branch,
        provider,
        model,
        totalExecutionTime
      );

      // Explicitly set scenarios to make sure they're in the report
      testReport.scenarios = results;
      console.log(
        `DEBUG Command: After setting scenarios, report has ${testReport.scenarios.length} scenarios`
      );

      const reportFilePath = path.join(branchOutputDir, getReportFilename(query));
      await saveReportToFile(testReport, reportFilePath);
      yield `📊 Report saved to: ${reportFilePath}\n`;

      const resultFilePath = path.join(branchOutputDir, getResultFilename(query));
      await saveResultToFile(testReport, resultFilePath);
      yield `🏁 Result saved to: ${resultFilePath}\n`;

      // Compare with previous report if specified
      if (options.compareWith) {
        const comparisonResult = await compareReports(reportFilePath, options.compareWith, options);
        yield `\n📈 Comparison with ${options.compareWith}:\n`;
        yield `  - ${comparisonResult.added.length} new scenarios\n`;
        yield `  - ${comparisonResult.removed.length} removed scenarios\n`;
        yield `  - ${comparisonResult.changed.length} changed results\n`;
        yield `  - ${comparisonResult.unchanged.length} unchanged results\n`;
      }

      // Calculate sequential estimated time for parallel stats
      const sequentialEstimatedTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);
      const parallel = options.parallel || Math.max(1, os.cpus().length - 1);

      // Output final summary
      yield `
📋 Test Summary for ${featureBehavior.name}:
- Total scenarios: ${scenarios.length}
- Passed: ${scenarios.length - testReport.failedScenarios.length}
- Failed: ${testReport.failedScenarios.length}${
        testReport.failedScenarios.length > 0 ? ` (${testReport.failedScenarios.join(', ')})` : ''
      }
- Overall result: ${testReport.overallResult}
- Total execution time: ${totalExecutionTime.toFixed(2)}s
${
  parallel > 1
    ? generateParallelStats(parallel, sequentialEstimatedTime, totalExecutionTime, results)
    : ''
}`;
    }
  }
}
