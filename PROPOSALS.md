# Proposals for Isolated Test Execution

## Proposal 1: Scenario-Level Isolation with Process Manager

This approach focuses on creating isolated environments at the scenario level by creating temporary directories and modifying command execution.

### Implementation Steps:

1. **Create Isolated Environment Manager:**
   - Create a new utility class `TestEnvironmentManager` that handles:
     - Creating unique temporary directories
     - Copying assets to temp directories
     - Managing cleanup after tests

2. **Modify Scenario Execution:**
   - Update `executeScenario` to create a dedicated temp directory per scenario:
   ```typescript
   export async function executeScenario(
     scenario: TestScenario,
     options: { /* existing options */ },
     geminiProvider: BaseModelProvider
   ): Promise<TestScenarioResult> {
     // Create temp directory for this scenario
     const tempDir = await TestEnvironmentManager.createTempDirectory(scenario.id);
     
     // Copy required assets
     await TestEnvironmentManager.copyAssets(scenario, tempDir);
     
     try {
       // Continue with existing scenario execution but in the temp directory
       // Pass the tempDir to the command execution tool
       const tools = [createCommandExecutionTool({ ...options, cwd: tempDir })];
       
       // Rest of execution logic...
       
       return result;
     } finally {
       // Clean up temp directory
       await TestEnvironmentManager.cleanup(tempDir);
     }
   }
   ```

3. **Modify Command Execution Tool:**
   - Update the command execution tool to use the provided CWD:
   ```typescript
   export function createCommandExecutionTool(options: {
     debug: boolean;
     cwd?: string; // Add CWD parameter
     // Other options
   }) {
     return {
       name: 'execute_command',
       description: 'Execute a vibe-tools command',
       parameters: {
         command: {
           type: 'string',
           description: 'The vibe-tools command to execute',
         },
       },
       execute: async ({ command }) => {
         // Determine absolute path to vibe-tools entry point
         const cursorToolsPath = path.resolve(__dirname, '../../../src/index.ts');
         
         // Build command using Node with tsx for TypeScript support
         const execCommand = `node --import=tsx "${cursorToolsPath}" ${command}`;
         
         try {
           // Execute in the temp directory if provided
           const execOptions = { 
             shell: true,
             cwd: options.cwd || process.cwd(),
           };
           
           // Execute command
           const { stdout, stderr } = await execAsync(execCommand, execOptions);
           
           return { success: true, output: stdout, error: stderr };
         } catch (error) {
           // Error handling...
         }
       },
     };
   }
   ```

4. **Asset Management System:**
   - Implement functions to:
     - Parse asset references from scenario descriptions
     - Locate asset files relative to the test file
     - Copy assets to the temporary directory
     - Update asset references in prompts to point to the new locations

5. **Environment Variable Handling:**
   - Create isolated environment variable sets for each scenario
   - Merge base environment variables with test-specific ones
   - Pass the environment to the command execution

### Advantages:
- Complete isolation between test scenarios
- Each test runs in its own directory with its own assets
- Minimizes interference between parallel tests
- Straightforward implementation that builds on existing architecture

### Disadvantages:
- Additional overhead for creating directories and copying assets
- May require careful handling of asset paths in prompts
- Requires changes to asset reference resolution

## Detailed Implementation Plan for Proposal 1

Based on Gemini's recommendation, we'll proceed with implementing Proposal 1. Here's a detailed plan:

### 1. TestEnvironmentManager Class

Create a new file `src/commands/test/environment.ts`:

```typescript
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Manages isolated test environments for each test scenario.
 * Handles temporary directory creation, asset copying, and cleanup.
 */
export class TestEnvironmentManager {
  /**
   * Creates a unique temporary directory for a test scenario.
   * @param scenarioId The ID of the test scenario
   * @returns The path to the created temporary directory
   */
  static async createTempDirectory(scenarioId: string): Promise<string> {
    // Create a unique directory name with timestamp and random suffix for collision avoidance
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const dirName = `vibe-tools-test-${scenarioId}-${timestamp}-${randomSuffix}`;
    const tempDir = path.join(os.tmpdir(), dirName);
    
    // Ensure the directory exists
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    if (process.env.DEBUG) {
      console.log(`[DEBUG] Created temporary directory: ${tempDir}`);
    }
    
    return tempDir;
  }
  
  /**
   * Extracts asset references from a scenario task description.
   * Supports both inline content references [[asset:name]] and path references {{path:name}}.
   * @param taskDescription The task description containing asset references
   * @returns Array of asset references with their type (inline or path)
   */
  static extractAssetReferences(taskDescription: string): Array<{
    type: 'inline' | 'path';
    name: string;
    originalRef: string;
  }> {
    const assetRefs: Array<{
      type: 'inline' | 'path';
      name: string;
      originalRef: string;
    }> = [];
    
    // Extract inline content references: [[asset:name]]
    const inlineMatches = taskDescription.matchAll(/\[\[asset:([^\]]+)\]\]/g);
    for (const match of inlineMatches) {
      assetRefs.push({
        type: 'inline',
        name: match[1],
        originalRef: match[0],
      });
    }
    
    // Extract path references: {{path:name}}
    const pathMatches = taskDescription.matchAll(/\{\{path:([^\}]+)\}\}/g);
    for (const match of pathMatches) {
      assetRefs.push({
        type: 'path',
        name: match[1],
        originalRef: match[0],
      });
    }
    
    return assetRefs;
  }
  
  /**
   * Resolves the actual file path for an asset based on the scenario ID.
   * @param assetRef The asset reference object
   * @param scenarioId The ID of the test scenario
   * @param testDir The base directory for test files (optional)
   * @returns The absolute path to the asset file
   */
  static resolveAssetPath(
    assetRef: { name: string; type: 'inline' | 'path' },
    scenarioId: string,
    testDir: string = path.resolve(process.cwd(), 'tests/feature-behaviors')
  ): string {
    // Scenario ID format: category/file-name/scenario-id
    // We extract the category and file name to locate the asset directory
    const parts = scenarioId.split('/');
    if (parts.length < 2) {
      throw new Error(`Invalid scenario ID: ${scenarioId}. Expected format: category/file-name/scenario-id`);
    }
    
    const category = parts[0];
    const fileName = parts[1];
    
    // Asset directory is named the same as the file (minus extension)
    const assetDir = path.join(testDir, category, `${fileName}`);
    const assetPath = path.join(assetDir, assetRef.name);
    
    // Verify the asset exists
    if (!fs.existsSync(assetPath)) {
      throw new Error(`Asset file not found: ${assetPath}`);
    }
    
    return assetPath;
  }
  
  /**
   * Copies all assets referenced in a scenario to the temporary directory.
   * @param scenario The test scenario
   * @param tempDir The temporary directory to copy assets to
   * @returns Modified task description with updated asset references
   */
  static async copyAssets(scenario: any, tempDir: string): Promise<string> {
    // Extract asset references from task description
    const assetRefs = this.extractAssetReferences(scenario.taskDescription);
    
    if (assetRefs.length === 0) {
      return scenario.taskDescription;
    }
    
    // Create assets directory in temp dir
    const assetsTempDir = path.join(tempDir, 'assets');
    await fs.promises.mkdir(assetsTempDir, { recursive: true });
    
    let modifiedTaskDescription = scenario.taskDescription;
    
    // Process each asset reference
    for (const assetRef of assetRefs) {
      // Resolve the asset path based on scenario ID
      const sourcePath = this.resolveAssetPath(assetRef, scenario.id);
      const assetFileName = path.basename(sourcePath);
      const destPath = path.join(assetsTempDir, assetFileName);
      
      // Copy the asset file
      await fs.promises.copyFile(sourcePath, destPath);
      
      if (process.env.DEBUG) {
        console.log(`[DEBUG] Copied asset: ${sourcePath} -> ${destPath}`);
      }
      
      // Update references in the task description
      if (assetRef.type === 'inline') {
        // For inline references, load the content
        const content = await fs.promises.readFile(destPath, 'utf-8');
        modifiedTaskDescription = modifiedTaskDescription.replace(
          assetRef.originalRef,
          content
        );
      } else {
        // For path references, replace with the new absolute path
        modifiedTaskDescription = modifiedTaskDescription.replace(
          assetRef.originalRef,
          destPath
        );
      }
    }
    
    return modifiedTaskDescription;
  }
  
  /**
   * Cleans up the temporary directory after test execution.
   * @param tempDir The temporary directory to clean up
   */
  static async cleanup(tempDir: string): Promise<void> {
    try {
      // Recursive directory removal
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      
      if (process.env.DEBUG) {
        console.log(`[DEBUG] Cleaned up temporary directory: ${tempDir}`);
      }
    } catch (error) {
      // Log but don't throw - cleanup failures shouldn't fail tests
      console.error(`[WARNING] Failed to clean up temporary directory: ${tempDir}`, error);
    }
  }
}
```

### 2. Update Scenario Execution

Modify `src/commands/test/executor.ts` to use the TestEnvironmentManager:

```typescript
// Import the TestEnvironmentManager
import { TestEnvironmentManager } from './environment';
// ... existing imports

export async function executeScenario(
  scenario: TestScenario,
  options: {
    model: string;
    timeout: number;
    retryConfig: RetryConfig;
    debug: boolean;
    mcpServers?: string[];
    scenarioId: string;
    outputBuffer?: string[];
  },
  geminiProvider: BaseModelProvider
): Promise<TestScenarioResult> {
  const { model, timeout, retryConfig, debug, scenarioId, outputBuffer = [] } = options;

  // Create a temporary directory for this scenario
  const tempDir = await TestEnvironmentManager.createTempDirectory(scenarioId);
  
  // Copy assets and update task description with new references
  const modifiedTaskDescription = await TestEnvironmentManager.copyAssets(scenario, tempDir);
  
  // Create a modified scenario with updated task description
  const modifiedScenario = {
    ...scenario,
    taskDescription: modifiedTaskDescription
  };
  
  const appendToBuffer = (text: string, shouldPrefix: boolean = true) => {
    // ... existing implementation
  };

  try {
    // Create the command execution tool with the temp directory
    const tools = [
      createCommandExecutionTool({ 
        debug, 
        cwd: tempDir,
        scenarioId,
        appendToBuffer
      })
    ];

    // Continue with existing execution logic, using modifiedScenario
    // ...

    return result;
  } catch (error) {
    // ... existing error handling
  } finally {
    // Clean up the temporary directory
    await TestEnvironmentManager.cleanup(tempDir);
  }
}
```

### 3. Update Command Execution Tool

Update the command execution tool in `src/commands/test/tools.ts` (create this file if it doesn't exist):

```typescript
import * as path from 'path';
import * as util from 'util';
import * as child_process from 'child_process';

const execAsync = util.promisify(child_process.exec);

export function createCommandExecutionTool(options: {
  debug: boolean;
  cwd?: string;
  scenarioId: string;
  appendToBuffer: (text: string, shouldPrefix?: boolean) => void;
}) {
  const { debug, cwd, scenarioId, appendToBuffer } = options;

  return {
    name: 'execute_command',
    description: 'Execute a vibe-tools command',
    parameters: {
      properties: {
        command: {
          type: 'string',
          description: 'The vibe-tools command to execute',
        },
      },
      required: ['command'],
    },
    execute: async ({ command }: { command: string }) => {
      // Determine absolute path to vibe-tools entry point
      const cursorToolsPath = path.resolve(__dirname, '../../../src/index.ts');
      
      // Build command using Node with tsx for TypeScript support
      const execCommand = `node --import=tsx "${cursorToolsPath}" ${command}`;
      
      if (debug) {
        appendToBuffer(`[DEBUG] Executing in ${cwd}: ${execCommand}`);
      }
      
      try {
        // Execute in the temporary directory if provided
        const execOptions: child_process.ExecOptions = { 
          shell: true,
          cwd: cwd || process.cwd(),
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large outputs
        };
        
        // Execute command
        const { stdout, stderr } = await execAsync(execCommand, execOptions);
        
        if (stdout) {
          appendToBuffer(`COMMAND OUTPUT:\n${stdout}`);
        }
        
        if (stderr) {
          appendToBuffer(`COMMAND ERRORS:\n${stderr}`);
        }
        
        return { 
          success: true, 
          output: stdout, 
          error: stderr 
        };
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : String(error);
        
        appendToBuffer(`COMMAND ERROR: ${errorMessage}`);
        
        return { 
          success: false, 
          output: '', 
          error: errorMessage 
        };
      }
    },
  };
}
```

### 4. Integration with LLM Client

Ensure that the LLM client uses the updated task description and properly forwards the temporary directory context:

```typescript
// Update the LLM client initialization to pass the modified scenario
const llmClient = new ToolEnabledLLMClient({
  provider,
  model: options.model,
  tools,
  timeout: options.timeout,
  debug: options.debug,
});

// Pass the modified scenario content
const messages = buildScenarioPrompt(modifiedScenario);
```

### 5. Testing and Validation

Test the implementation with various scenarios:
1. Scenarios with no assets
2. Scenarios with inline asset references
3. Scenarios with path-based asset references
4. Scenarios that execute commands that interact with files
5. Parallel execution of scenarios

## Proposal 2: Process-Level Isolation with Child Processes

This approach focuses on complete process isolation by spawning child processes for each vibe-tools command, each with its own working directory and environment.

### Implementation Steps:

1. **Create Process Isolation System:**
   - Create a new utility class `IsolatedProcessManager` that handles:
     - Creating a unique temporary directory for each test scenario
     - Preparing assets and environment for each command execution
     - Spawning isolated child processes for commands

2. **Modify Test Executor Architecture:**
   ```typescript
   export async function executeScenario(
     scenario: TestScenario,
     options: { /* existing options */ },
     geminiProvider: BaseModelProvider
   ): Promise<TestScenarioResult> {
     // Create base temp directory for this scenario
     const scenarioTempDir = await IsolatedProcessManager.createScenarioDirectory(scenario.id);
     
     // Parse and copy all assets needed for the scenario
     await IsolatedProcessManager.prepareAssets(scenario, scenarioTempDir);
     
     try {
       // Create custom tool for isolated execution
       const isolatedExecutionTool = {
         name: 'execute_command',
         description: 'Execute a vibe-tools command in an isolated environment',
         parameters: {
           command: {
             type: 'string',
             description: 'The vibe-tools command to execute',
           },
         },
         execute: async ({ command }) => {
           // For each command execution, create a fresh command-specific temp directory
           const commandTempDir = await IsolatedProcessManager.createCommandDirectory(
             scenarioTempDir, 
             command
           );
           
           // Determine entry point path
           const entryPoint = path.resolve(process.cwd(), 'src/index.ts');
           
           // Build the execution environment
           const env = IsolatedProcessManager.buildEnvironment();
           
           // Execute the command in the isolated directory
           const result = await IsolatedProcessManager.executeCommand(
             entryPoint,
             command,
             commandTempDir,
             env,
             options.debug
           );
           
           return result;
         },
       };
       
       // Use the isolated execution tool
       const tools = [isolatedExecutionTool];
       
       // Continue with LLM client execution using the isolated tool
       // Rest of execution logic...
       
       return result;
     } finally {
       // Clean up all temp directories
       await IsolatedProcessManager.cleanup(scenarioTempDir);
     }
   }
   ```

3. **Process Manager Implementation:**
   ```typescript
   export class IsolatedProcessManager {
     static async createScenarioDirectory(scenarioId: string): Promise<string> {
       const tempDir = path.join(os.tmpdir(), `vibe-tools-test-${scenarioId}-${Date.now()}`);
       await fs.promises.mkdir(tempDir, { recursive: true });
       return tempDir;
     }
     
     static async createCommandDirectory(scenarioDir: string, command: string): Promise<string> {
       // Create unique directory for each command execution
       const commandHash = crypto.createHash('md5').update(command).digest('hex').slice(0, 8);
       const commandDir = path.join(scenarioDir, `cmd-${commandHash}`);
       await fs.promises.mkdir(commandDir, { recursive: true });
       return commandDir;
     }
     
     static buildEnvironment(): NodeJS.ProcessEnv {
       // Create clean environment with only necessary variables
       return {
         ...process.env,
         // Add test-specific environment variables
         CURSOR_TOOLS_TEST_MODE: 'true',
       };
     }
     
     static async executeCommand(
       entryPoint: string,
       command: string,
       cwd: string,
       env: NodeJS.ProcessEnv,
       debug: boolean
     ): Promise<{ success: boolean; output: string; error: string }> {
       try {
         // Execute node with tsx for TypeScript support
         const execCommand = `node --import=tsx "${entryPoint}" ${command}`;
         
         if (debug) {
           console.log(`[DEBUG] Executing in ${cwd}: ${execCommand}`);
         }
         
         // Execute command in specified directory with custom environment
         const { stdout, stderr } = await execAsync(execCommand, { 
           shell: true,
           cwd,
           env,
         });
         
         return { success: true, output: stdout, error: stderr };
       } catch (error) {
         // Handle execution errors
         return { 
           success: false, 
           output: '', 
           error: error instanceof Error ? error.message : String(error) 
         };
       }
     }
     
     static async prepareAssets(scenario: TestScenario, tempDir: string): Promise<void> {
       // Parse asset references from scenario
       const assetRefs = this.extractAssetReferences(scenario.taskDescription);
       
       // For each asset reference
       for (const assetRef of assetRefs) {
         // Locate the asset file
         const assetPath = this.resolveAssetPath(assetRef, scenario.id);
         
         // Copy to temp directory
         await fs.promises.copyFile(
           assetPath, 
           path.join(tempDir, path.basename(assetPath))
         );
       }
     }
     
     // Additional methods for asset extraction, resolution, and cleanup
   }
   ```

4. **Asset Reference System:**
   - Implement a robust system to:
     - Extract asset references from task descriptions using regex
     - Resolve asset paths relative to test files
     - Transform asset references in prompts to point to the temp directory
     - Support both inline content loading and path references

### Advantages:
- Complete isolation at both scenario and command level
- Each command execution gets a fresh environment
- No state bleeding between commands
- Better mimics real-world usage where each command is discrete
- More robust for complex test scenarios with multiple steps

### Disadvantages:
- More complex implementation
- Higher overhead for directory creation and process spawning
- May be slower for scenarios with many command executions
- Requires more sophisticated asset and environment management 