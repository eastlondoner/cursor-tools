import { FeatureBehavior, TestScenario } from './types';
import { readFile } from './utils';
import { resolveAssetsInDescription } from '../../utils/assets';

/**
 * Parse a feature behavior file into a structured object
 *
 * @param filePath - Path to the feature behavior file
 * @returns Parsed feature behavior or null if parsing failed
 */
export async function parseFeatureBehaviorFile(filePath: string): Promise<FeatureBehavior | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');

    let name = '';
    let description = '';
    const scenarios: TestScenario[] = [];

    let currentSection: string = '';
    let currentScenario: Partial<TestScenario> = {};
    let taskDescription = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse feature name
      if (line.startsWith('# Feature Behavior:')) {
        name = line.substring('# Feature Behavior:'.length).trim();
      }
      // Parse description section
      else if (line === '## Description') {
        currentSection = 'description';
      }
      // Parse test scenarios section
      else if (line === '## Test Scenarios') {
        currentSection = 'scenarios';
      }
      // Parse individual scenario
      else if (line.startsWith('### Scenario')) {
        // Save previous scenario if exists
        if (Object.keys(currentScenario).length > 0) {
          scenarios.push(currentScenario as TestScenario);
        }

        // Initialize new scenario
        currentScenario = {
          id: `Scenario ${scenarios.length + 1}`,
          description: line.substring(line.indexOf(':') + 1).trim(),
          type: line.includes('(Happy Path)')
            ? 'Happy Path'
            : line.includes('(Error Handling)')
              ? 'Error Handling'
              : line.includes('(Edge Case)')
                ? 'Edge Case'
                : line.includes('(Performance)')
                  ? 'Performance'
                  : 'Other',
          taskDescription: '',
          expectedBehavior: [],
          successCriteria: [],
          tags: [],
          assets: {},
        };

        currentSection = 'scenario';
        taskDescription = '';
      }
      // Parse description content
      else if (currentSection === 'description' && line !== '') {
        if (description) description += '\n';
        description += line;
      }
      // Parse scenario sections
      else if (currentSection === 'scenario') {
        if (line === '**Task Description:**') {
          currentSection = 'taskDescription';
        } else if (line === '**Expected Behavior:**') {
          currentSection = 'expectedBehavior';
        } else if (line === '**Success Criteria:**') {
          currentSection = 'successCriteria';
        } else if (line.startsWith('**Tags:**')) {
          if (currentScenario.tags === undefined) {
            currentScenario.tags = [];
          }
          const tagsText = line.substring('**Tags:**'.length).trim();
          if (tagsText) {
            currentScenario.tags = tagsText.split(',').map((tag) => tag.trim());
          }
        }
      }

      // Process content based on current section
      if (currentSection === 'taskDescription' && line !== '' && !line.startsWith('**')) {
        if (taskDescription) taskDescription += '\n';
        taskDescription += line;
        currentScenario.taskDescription = taskDescription;
      } else if (currentSection === 'expectedBehavior' && line.startsWith('- ')) {
        currentScenario.expectedBehavior = currentScenario.expectedBehavior || [];
        currentScenario.expectedBehavior.push(line.substring(2).trim());
      } else if (currentSection === 'successCriteria' && line.startsWith('- ')) {
        currentScenario.successCriteria = currentScenario.successCriteria || [];
        currentScenario.successCriteria.push(line.substring(2).trim());
      }
    }

    // Add the last scenario
    if (Object.keys(currentScenario).length > 0) {
      scenarios.push(currentScenario as TestScenario);
    }

    // Process asset references in task descriptions
    for (const scenario of scenarios) {
      // Use the new asset resolution utility
      const assetResolution = await resolveAssetsInDescription(scenario.taskDescription, filePath);
      scenario.taskDescription = assetResolution.processedDescription;
      scenario.assets = assetResolution.assets;
    }

    return {
      name,
      description,
      scenarios,
    };
  } catch (error) {
    console.error(`Error parsing feature behavior file: ${filePath}`, error);
    return null;
  }
}

/**
 * Generate a prompt for the AI agent to execute a test scenario
 *
 * @param scenario - The test scenario to execute
 * @returns A prompt for the AI agent
 */
export function generateScenarioPrompt(scenario: TestScenario): string {
  // Update the prompt to include the new JSON response instructions
  const prompt = `
Task Description: ${scenario.taskDescription}

Expected Behavior:
${scenario.expectedBehavior.map((b) => `- ${b}`).join('\n')}

Success Criteria:
${scenario.successCriteria.map((c) => `- ${c}`).join('\n')}
`;

  return prompt;
}
