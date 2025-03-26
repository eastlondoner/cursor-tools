import { saveToFile } from '../../utils/output';
import { yieldOutput } from '../../utils/output';
import { TestOptions, TestReport, TestScenarioResult } from './types';
import { readFile } from './utils';

/**
 * Format a test report as Markdown
 *
 * @param report - The test report to format
 * @returns Formatted Markdown string
 */
export function formatReportAsMarkdown(report: TestReport): string {
  const {
    featureName,
    description,
    scenarios,
    timestamp,
    branch,
    provider,
    model,
    overallResult,
    failedScenarios,
    totalExecutionTime,
  } = report;

  console.log(
    `DEBUG: formatReportAsMarkdown - Number of scenarios: ${scenarios ? scenarios.length : 0}`
  );
  if (scenarios && scenarios.length > 0) {
    console.log(`DEBUG: First scenario ID: ${scenarios[0].id}, Result: ${scenarios[0].result}`);
  }

  let markdown = `# Test Report: ${featureName}\n\n`;

  // Summary section
  markdown += `## Summary\n\n`;
  markdown += `- **Result:** ${overallResult === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n`;
  markdown += `- **Timestamp:** ${new Date(timestamp).toLocaleString()}\n`;
  markdown += `- **Branch:** ${branch}\n`;
  markdown += `- **Provider:** ${provider}\n`;
  markdown += `- **Model:** ${model}\n`;
  markdown += `- **Total Execution Time:** ${totalExecutionTime.toFixed(2)} seconds\n`;

  // Use the passedScenarios property if available, otherwise count from scenarios array
  const passedCount =
    report.passedScenarios !== undefined
      ? report.passedScenarios
      : scenarios.filter((s) => s.result === 'PASS').length;

  // Calculate total scenarios count - for summary reports, this might not match scenarios.length
  const totalCount = passedCount + failedScenarios.length;

  markdown += `- **Scenarios:** ${totalCount} total, ${passedCount} passed, ${failedScenarios.length} failed\n\n`;

  // Description section
  markdown += `## Description\n\n${description}\n\n`;

  // Failed scenarios section (if any)
  if (failedScenarios.length > 0) {
    markdown += `## Failed Scenarios\n\n`;
    failedScenarios.forEach((id) => {
      const scenario = scenarios.find((s) => s.id === id);
      if (scenario) {
        markdown += `- **${scenario.id}:** ${scenario.description} - ${scenario.error || 'No error message'}\n`;
      }
    });
    markdown += `\n`;
  }

  // Detailed results section
  markdown += `## Detailed Results\n\n`;

  scenarios.forEach((scenario) => {
    markdown += `### ${scenario.id}: ${scenario.description} (${scenario.type})\n\n`;

    markdown += `#### Task Description\n\n${scenario.taskDescription}\n\n`;

    markdown += `#### Approach Taken\n\n${scenario.approachTaken}\n\n`;

    if (scenario.commands.length > 0) {
      markdown += `#### Commands Used\n\n\`\`\`bash\n${scenario.commands.join('\n')}\n\`\`\`\n\n`;
    }

    // Add Tool Call Log section
    if (scenario.toolExecutions && scenario.toolExecutions.length > 0) {
      markdown += `#### Tool Call Log\n\n`;
      scenario.toolExecutions.forEach((toolExec, index) => {
        const success = toolExec.result.success ? '✅' : '❌';
        markdown += `##### Tool Call ${index + 1}: ${success} ${toolExec.tool}\n\n`;
        markdown += `**Arguments:**\n\`\`\`json\n${JSON.stringify(toolExec.args, null, 2)}\n\`\`\`\n\n`;
        markdown += `**Output:**\n\`\`\`\n${toolExec.result.output}\n\`\`\`\n\n`;
        if (toolExec.result.error) {
          markdown += `**Error:**\n\`\`\`json\n${JSON.stringify(toolExec.result.error, null, 2)}\n\`\`\`\n\n`;
        }
        markdown += `---\n\n`;
      });
    }

    markdown += `#### Output\n\n\`\`\`\n${scenario.output}\n\`\`\`\n\n`;

    // Expected behavior section
    markdown += `#### Expected Behavior\n\n`;
    scenario.expectedBehavior.forEach((item) => {
      markdown += `- ${item.met ? '✅' : '❌'} ${item.behavior}\n`;
    });
    markdown += '\n';

    // Success criteria section
    markdown += `#### Success Criteria\n\n`;
    scenario.successCriteria.forEach((item) => {
      markdown += `- ${item.met ? '✅' : '❌'} ${item.criteria}\n`;
    });
    markdown += '\n';

    // Result
    markdown += `#### Result: ${scenario.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n\n`;

    // Execution time
    markdown += `#### Execution Time: ${scenario.executionTime.toFixed(2)} seconds\n\n`;

    markdown += '---\n\n';
  });

  return markdown;
}

/**
 * Save a test report to a file
 *
 * @param report - The test report to save
 * @param reportPath - The path to save the report to
 */
export async function saveReportToFile(report: TestReport, reportPath: string): Promise<void> {
  const markdown = formatReportAsMarkdown(report);
  await saveToFile(reportPath, markdown);
}

/**
 * Save a test result to a file
 *
 * @param report - The test report to extract the result from
 * @param resultPath - The path to save the result to
 */
export async function saveResultToFile(report: TestReport, resultPath: string): Promise<void> {
  await saveToFile(resultPath, report.overallResult);
}

/**
 * Interface for report comparison results
 */
export interface ReportComparisonResult {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
}

/**
 * Compare two test reports
 *
 * @param currentReportPath - The path to the current report
 * @param previousReportPath - The path to the previous report to compare with
 * @returns Comparison result
 */
export async function compareReports(
  currentReportPath: string,
  previousReportPath: string,
  options: TestOptions
): Promise<ReportComparisonResult> {
  try {
    // Read the reports
    const currentReportContent = await readFile(currentReportPath, 'utf-8');
    const previousReportContent = await readFile(previousReportPath, 'utf-8');

    if (!currentReportContent || !previousReportContent) {
      throw new Error('Failed to read report files');
    }

    const currentReport: TestReport = JSON.parse(currentReportContent);
    const previousReport: TestReport = JSON.parse(previousReportContent);

    // Compare scenarios
    const currentScenarioIds = new Set(currentReport.scenarios.map((s) => s.id));
    const previousScenarioIds = new Set(previousReport.scenarios.map((s) => s.id));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    const unchanged: string[] = [];

    // Find added scenarios
    for (const id of currentScenarioIds) {
      if (!previousScenarioIds.has(id)) {
        added.push(id);
      }
    }

    // Find removed scenarios
    for (const id of previousScenarioIds) {
      if (!currentScenarioIds.has(id)) {
        removed.push(id);
      }
    }

    // Find changed and unchanged scenarios
    for (const id of currentScenarioIds) {
      if (previousScenarioIds.has(id)) {
        const currentScenario = currentReport.scenarios.find((s) => s.id === id)!;
        const previousScenario = previousReport.scenarios.find((s) => s.id === id)!;

        if (currentScenario.result !== previousScenario.result) {
          changed.push(id);
          await yieldOutput(
            `  Changed: ${id} - ${previousScenario.result} -> ${currentScenario.result}\n`,
            options
          );
        } else {
          unchanged.push(id);
        }
      }
    }

    return {
      added,
      removed,
      changed,
      unchanged,
    };
  } catch (error) {
    console.error(
      'Error comparing reports:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      added: [],
      removed: [],
      changed: [],
      unchanged: [],
    };
  }
}
