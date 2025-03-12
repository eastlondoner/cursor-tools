# Plan for Concurrent File Execution in Test Command

## Current Implementation Issue

In the current implementation of `runTests` in `command.ts`, when processing multiple files with a glob pattern, files are processed sequentially:

```typescript
// Process each file
for await (const file of filesStream) {
  try {
    // Process the file...

    // Wait for all scenarios to complete
    await queue.onIdle();
    await Promise.allSettled(resultPromises);

    // Process results and create report...
  } catch (error) {
    // Handle error...
  }
}
```

This approach blocks processing of subsequent files until all scenarios in the current file have completed, reducing overall throughput and efficiency.

## Proposed Solution

Refactor the code to process multiple files concurrently, allowing for better resource utilization and reduced total execution time.

### Implementation Plan

1. **Collect All Files First**

   - Replace the `for await` loop with collecting all files into an array first
   - Use the existing `findFeatureBehaviorFilesArray` function in `utils.ts` instead of the async generator

2. **Create a File Processing Queue**

   - Use the existing `PQueue` library to create a file-level queue
   - Add a new `fileConcurrency` option to control the maximum number of files processed concurrently
   - Leverage the existing queue management patterns from the scenario execution code

3. **Process Files Concurrently**

   - Extract the file processing logic into a separate function
   - Submit each file to the file processing queue
   - Track file processing results and promises
   - Wait for all file processing to complete at the end

4. **Update Progress Reporting**
   - Add global stats for tracking overall progress across all files
   - Update the progress reporting to show file-level and scenario-level progress

## Implementation Details

### 1. Update the `TestOptions` Interface in `types.ts`

```typescript
export interface TestOptions extends CommandOptions {
  // ... existing options
  fileConcurrency?: number; // Maximum number of files to process concurrently
}
```

### 2. Create a File Processing Function in `command-utils.ts`

```typescript
/**
 * Process a single feature file and return its report
 */
export async function processFeatureFile(
  file: string,
  options: ExtendedTestOptions,
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

    // Execute scenarios (similar to existing code)
    const startTime = Date.now();
    const progressStats = {
      totalScenarios: scenarios.length,
      completedScenarios: 0,
    };

    const queue = createExecutionQueue(options, startTime, progressStats);
    const resultPromises: Promise<TestScenarioResult | void>[] = [];

    // Add scenarios to the queue
    for (const scenario of scenarios) {
      // ... Add scenarios to queue (existing code)
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
```

### 3. Modify the `runTests` Method in `command.ts`

```typescript
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
    const files = await findFeatureBehaviorFilesArray(query);
    yield `📂 Found ${files.length} feature behavior files matching pattern: ${query}\n`;

    // Create global stats for tracking
    const globalStats = {
      totalFiles: files.length,
      completedFiles: 0,
      totalScenarios: 0,
      completedScenarios: 0,
      passedScenarios: 0,
      failedScenarios: 0,
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

    // Output callback function to handle yields
    const outputCallback = async (output: string) => {
      if (!options.skipIntermediateOutput) {
        yield output;
      }
    };

    // Create a queue for file processing
    const fileQueue = createFileProcessingQueue(options, globalStats);

    // Submit all files for processing
    const fileResults: { file: string; report: TestReport | null }[] = [];
    const filePromises: Promise<void>[] = [];

    for (const file of files) {
      const promise = fileQueue.add(async () => {
        const result = await processFeatureFile(
          file,
          options,
          commonConfig,
          globalStats,
          outputCallback
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

    // Generate and output summary report (similar to existing code)
    // ...
  } else {
    // Single file processing (unchanged)
    // ...
  }
}
```

### 4. Update the CLI Command Definition in `index.ts`

```typescript
// Add the fileConcurrency option to the yargs command definition
.option('file-concurrency', {
  alias: 'fc',
  type: 'number',
  description: 'Maximum number of files to process concurrently',
  default: 3,
})
```

## Performance Considerations

1. **Balance Between File and Scenario Concurrency**:

   - The system now has two levels of concurrency: file-level and scenario-level
   - Total concurrent operations = `fileConcurrency × parallel`
   - Setting these too high could overwhelm system resources

2. **Memory Usage**:

   - Processing multiple files concurrently will increase memory usage
   - Each file's scenarios and results will be held in memory
   - Default `fileConcurrency` of 3 is conservative to avoid memory issues

3. **I/O Operations**:

   - Multiple concurrent file writes could occur when saving reports
   - File system performance may impact overall speed

4. **Network and API Limits**:
   - Consider provider rate limits when setting concurrency levels
   - Higher concurrency may lead to more API errors if rate limits are exceeded

## Expected Improvements

For a test suite with 10 files, each containing 5 scenarios, the expected improvements are:

1. **Sequential Processing (Current)**:

   - Process time = Sum of all file processing times
   - If each file takes ~60 seconds, total time = ~600 seconds

2. **Concurrent Processing (3 files)**:

   - Process time ≈ (Total files / concurrency) × avg file time
   - With 3 concurrent files: ~200 seconds (3× faster)

3. **Concurrent Processing (5 files)**:
   - With 5 concurrent files: ~120 seconds (5× faster)

The actual improvement will depend on:

- The number of files
- The complexity of scenarios
- System resources
- Provider API response times and rate limits

## Next Steps

1. Implement the `processFeatureFile` function in `command-utils.ts`
2. Implement the `createFileProcessingQueue` function in `command-utils.ts`
3. Implement the `filterScenarios` helper function in `command-utils.ts`
4. Update the `runTests` method in `command.ts`
5. Add the `fileConcurrency` option to the CLI command
6. Update the `TestOptions` interface in `types.ts`
7. Test with various concurrency settings
8. Document the new feature in the README.md
