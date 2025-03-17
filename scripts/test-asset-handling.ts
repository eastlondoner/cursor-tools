/**
 * Manual test script for asset handling in the test framework
 * 
 * This script simulates the asset handling functionality of the test framework
 * without relying on the full test execution process.
 */

import path from 'path';
import fs from 'fs';
import { TestEnvironmentManager } from '../src/commands/test/environment';

async function testAssetHandling() {
  console.log('Testing asset handling functionality...');

  // Create a mock scenario with a path reference
  const mockScenario = {
    id: 'test/test-asset-handling/1',
    title: 'Path Reference Asset Handling',
    taskDescription: 'This is a test scenario with a path reference: {{path:sample-asset.txt}}',
    expectedBehavior: ['Asset should be copied', 'Path reference should be replaced'],
    successCriteria: ['Asset exists in temp dir', 'Path reference is replaced with absolute path']
  };

  // Create a temporary directory
  const tempDir = await TestEnvironmentManager.createTempDirectory(mockScenario.id);
  console.log(`Created temporary directory: ${tempDir}`);

  try {
    // Copy assets and update task description with new references
    console.log('Original task description:', mockScenario.taskDescription);
    const modifiedTaskDescription = await TestEnvironmentManager.copyAssets(mockScenario, tempDir, true);
    console.log('Modified task description:', modifiedTaskDescription);

    // Check if the asset was copied
    const assetsTempDir = path.join(tempDir, 'assets');
    const files = await fs.promises.readdir(assetsTempDir);
    console.log(`Files in assets directory: ${files.join(', ')}`);

    // Check if the file exists
    const assetFile = files.find(file => file.includes('sample-asset'));
    if (assetFile) {
      console.log(`Asset file found: ${assetFile}`);
      const assetPath = path.join(assetsTempDir, assetFile);
      const content = await fs.promises.readFile(assetPath, 'utf-8');
      console.log(`Asset content: ${content}`);
    } else {
      console.error('Asset file not found in the temporary directory');
    }

    // Check if the path reference was replaced
    if (modifiedTaskDescription.includes('{{path:sample-asset.txt}}')) {
      console.error('Path reference was not replaced in the task description');
    } else if (modifiedTaskDescription.includes(tempDir)) {
      console.log('Path reference was successfully replaced with the absolute path');
    } else {
      console.error('Path reference was replaced, but not with the expected absolute path');
    }

    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Clean up the temporary directory
    await TestEnvironmentManager.cleanup(tempDir);
    console.log(`Cleaned up temporary directory: ${tempDir}`);
  }
}

// Run the test
testAssetHandling().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
