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
   * @throws Error if directory creation fails
   */
  static async createTempDirectory(scenarioId: string): Promise<string> {
    // Create a unique directory name with timestamp and random suffix for collision avoidance
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    // Replace any whitespace and special characters with hyphens to ensure no whitespace in directory names
    const sanitizedScenarioId = scenarioId.replace(/[\s\W]+/g, '-');
    const dirName = `vibe-tools-test-${sanitizedScenarioId}-${timestamp}-${randomSuffix}`;
    const tempDir = path.join(os.tmpdir(), dirName);

    // Ensure the directory exists
    try {
      await fs.promises.mkdir(tempDir, { recursive: true });
    } catch (error) {
      const errorMessage = `Failed to create temporary directory at ${tempDir}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Create a symlink to the node_modules directory only
    // Note: We don't create a symlink to the src directory to maintain isolation
    const projectRoot = process.cwd();
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    const symlinkPath = path.join(tempDir, 'node_modules');

    try {
      await fs.promises.symlink(nodeModulesPath, symlinkPath, 'junction');
    } catch (error) {
      const errorMessage = `Failed to create symlink to node_modules: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      // Don't throw here - we can still proceed with tests even without the symlink,
      // it might just result in test failures that will be properly reported
    }

    // Copy package.json to the temporary directory
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
      await fs.promises.writeFile(path.join(tempDir, 'package.json'), packageJsonContent);
    } catch (error) {
      const errorMessage = `Failed to copy package.json: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      // Don't throw here - we can still proceed with tests even without package.json,
      // it might just result in test failures that will be properly reported
    }

    // Create .cursor/rules directory and copy vibe-tools.mdc file to prevent warnings
    try {
      // Check if the cursor rules file exists in the project root
      const cursorRulesSourcePath = path.join(projectRoot, '.cursor', 'rules', 'vibe-tools.mdc');
      const cursorRulesDestDir = path.join(tempDir, '.cursor', 'rules');
      const cursorRulesDestPath = path.join(cursorRulesDestDir, 'vibe-tools.mdc');

      if (fs.existsSync(cursorRulesSourcePath)) {
        // Create the .cursor/rules directory in the temp directory
        await fs.promises.mkdir(cursorRulesDestDir, { recursive: true });

        // Copy the cursor rules file
        const cursorRulesContent = await fs.promises.readFile(cursorRulesSourcePath, 'utf-8');
        await fs.promises.writeFile(cursorRulesDestPath, cursorRulesContent);
      } else {
        // Also check for .cursorrules in the project root (alternative location)
        const altCursorRulesPath = path.join(projectRoot, '.cursorrules');
        if (fs.existsSync(altCursorRulesPath)) {
          // Copy the .cursorrules file
          const cursorRulesContent = await fs.promises.readFile(altCursorRulesPath, 'utf-8');
          await fs.promises.writeFile(path.join(tempDir, '.cursorrules'), cursorRulesContent);
          console.log(`Copied .cursorrules to ${tempDir}`);
        } else {
          console.log('No cursor rules file found to copy');
        }
      }
    } catch (error) {
      const errorMessage = `Failed to copy cursor rules: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      // Don't throw here - we can still proceed with tests even without cursor rules,
      // it will just show warnings
    }

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

    // Extract inline assets: {{inline:name:content}}
    const inlineMatches = Array.from(taskDescription.matchAll(/\{\{inline:([^:]+):([^}]+)\}\}/g));
    for (const match of inlineMatches) {
      assetRefs.push({
        type: 'inline',
        name: match[1],
        originalRef: match[0],
      });
    }

    // Extract path references: {{path:name}}
    const pathMatches = Array.from(taskDescription.matchAll(/\{\{path:([^}]+)\}\}/g));
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
   * Extracts environment variable overrides from task description.
   * Supports [[env:unset:VARIABLE_NAME]] to unset variables and
   * [[env:set:VARIABLE_NAME=value]] to set variables.
   *
   * @param taskDescription The task description text
   * @returns Record of environment variable overrides
   */
  static extractEnvOverrides(taskDescription: string): Record<string, string | undefined> {
    const envOverrides: Record<string, string | undefined> = {};

    // Extract env unset directives: [[env:unset:VARIABLE_NAME]]
    const envUnsetMatches = Array.from(taskDescription.matchAll(/\[\[env:unset:([^\]]+)\]\]/gi));
    for (const match of envUnsetMatches) {
      const variableName = match[1];
      if (variableName) {
        envOverrides[variableName] = undefined; // Set value to undefined to unset it
        if (process.env.DEBUG) {
          console.log(`[DEBUG] Unsetting environment variable: ${variableName}`);
        }
      } else {
        console.warn(`[WARNING] Invalid env unset directive: ${match[0]}`);
      }
    }

    // Extract env set directives: [[env:set:VARIABLE_NAME=value]]
    const envSetMatches = Array.from(
      taskDescription.matchAll(/\[\[env:set:([^=\]]+)=([^\]]+)\]\]/gi)
    );
    for (const match of envSetMatches) {
      const variableName = match[1];
      const variableValue = match[2];
      if (variableName && variableValue) {
        envOverrides[variableName] = variableValue; // Set value to override/set it
        if (process.env.DEBUG) {
          console.log(`[DEBUG] Setting environment variable: ${variableName}=${variableValue}`);
        }
      } else {
        console.warn(`[WARNING] Invalid env set directive: ${match[0]}`);
      }
    }

    return envOverrides;
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
      throw new Error(
        `Invalid scenario ID: ${scenarioId}. Expected format: category/file-name/scenario-id`
      );
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
   * @param debug Whether to enable debug mode
   * @returns Modified task description with updated asset references
   */
  static async copyAssets(scenario: any, tempDir: string, debug: boolean = false): Promise<string> {
    // Extract asset references from task description
    const assetRefs = this.extractAssetReferences(scenario.taskDescription);

    if (assetRefs.length === 0) {
      if (debug) console.log('No asset references found in task description');
      return scenario.taskDescription;
    }

    if (debug)
      console.log(`Found ${assetRefs.length} asset references in task description:`, assetRefs);

    // Create assets directory in temp dir
    const assetsTempDir = path.join(tempDir, 'assets');
    try {
      await fs.promises.mkdir(assetsTempDir, { recursive: true });
    } catch (error) {
      const errorMessage = `Failed to create assets directory at ${assetsTempDir}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      // We'll continue and try to copy assets anyway, but log the warning
    }

    let modifiedTaskDescription = scenario.taskDescription;
    const failedAssets: Array<{ name: string; error: string }> = [];

    // Process each asset reference
    for (const assetRef of assetRefs) {
      try {
        // Resolve the asset path based on scenario ID
        const sourcePath = this.resolveAssetPath(assetRef, scenario.id);
        const assetFileName = path.basename(sourcePath);
        const destPath = path.join(assetsTempDir, assetFileName);

        // Copy the asset file
        await fs.promises.copyFile(sourcePath, destPath);

        if (process.env.DEBUG) {
          console.log(`[DEBUG] Copied asset: ${sourcePath} -> ${destPath}`);
        } else {
          console.log(`Copied asset: ${assetFileName}`);
        }

        // Update references in the task description
        if (assetRef.type === 'inline') {
          // For inline references, load the content
          const content = await fs.promises.readFile(destPath, 'utf-8');
          modifiedTaskDescription = modifiedTaskDescription.replace(assetRef.originalRef, content);
        } else {
          // For path references, replace with the new absolute path
          const beforeReplace = modifiedTaskDescription;
          modifiedTaskDescription = modifiedTaskDescription.replace(assetRef.originalRef, destPath);

          // Verify the replacement occurred
          if (beforeReplace === modifiedTaskDescription) {
            console.warn(
              `Warning: Failed to replace path reference ${assetRef.originalRef} with ${destPath}`
            );
          } else {
            console.log(
              `Replaced path reference ${assetRef.originalRef} with absolute path ${destPath}`
            );
          }
        }
      } catch (error) {
        const errorMessage = `Error processing asset ${assetRef.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage);
        failedAssets.push({
          name: assetRef.name,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other assets even if one fails
      }
    }

    // Report failed assets if any
    if (failedAssets.length > 0) {
      console.error(`Failed to copy ${failedAssets.length} assets:`);
      failedAssets.forEach((fail) => {
        console.error(`  - ${fail.name}: ${fail.error}`);
      });
    }

    return modifiedTaskDescription;
  }

  /**
   * Cleans up the temporary directory after test execution.
   * @param tempDir The temporary directory to clean up
   */
  static async cleanup(tempDir: string): Promise<void> {
    if (!tempDir || typeof tempDir !== 'string' || tempDir.trim() === '') {
      console.warn('Cleanup called with invalid temp directory path');
      return;
    }

    // Safety check to ensure we're only deleting directories in the temp folder
    const normalizedTempDir = path.normalize(tempDir);
    const normalizedOsTempDir = path.normalize(os.tmpdir());

    if (!normalizedTempDir.startsWith(normalizedOsTempDir)) {
      console.error(`[WARNING] Attempted to clean up directory outside of temp: ${tempDir}`);
      return;
    }

    try {
      // Recursive directory removal
      await fs.promises.rm(tempDir, { recursive: true, force: true });

      console.log(`Cleaned up temporary directory: ${tempDir}`);
    } catch (error) {
      // Log but don't throw - cleanup failures shouldn't fail tests
      console.error(`[WARNING] Failed to clean up temporary directory: ${tempDir}`, error);

      // Try to list what's still there to help debugging
      try {
        const entries = await fs.promises.readdir(tempDir);
        console.error(`[WARNING] Remaining files in ${tempDir}: ${entries.join(', ')}`);
      } catch {
        // Just suppressing further errors during error handling
      }
    }
  }
}
