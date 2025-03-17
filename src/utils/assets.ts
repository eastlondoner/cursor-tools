import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

/**
 * Represents an asset reference in a test scenario
 */
export interface AssetReference {
  type: AssetType;
  name: string;
  content?: string; // For inline assets
  path?: string; // For path references
}

/**
 * Types of asset references
 */
export enum AssetType {
  INLINE = 'inline',
  PATH = 'path',
}

/**
 * Resolves asset references in the task description of a test scenario.
 * Loads inline assets and resolves paths for path assets.
 *
 * @param taskDescription - The task description string containing asset references.
 * @param filePath - The path to the feature behavior file (used to resolve relative asset paths).
 * @returns An object containing:
 *   - processedDescription: The task description with inline asset references replaced by their content, and path references replaced by their absolute paths.
 *   - assets: A record of AssetReference objects for each asset found in the description.
 */
export async function resolveAssetsInDescription(
  taskDescription: string,
  filePath: string
): Promise<{
  processedDescription: string;
  assets: Record<string, AssetReference>;
}> {
  let processedDescription = taskDescription;
  const assets: Record<string, AssetReference> = {};

  // Process inline asset references: [[asset:name]]
  const inlineAssetRegex = /\[\[asset:([^\]]+)\]\]/g;
  let match;
  let tempDescription = taskDescription;

  while ((match = inlineAssetRegex.exec(tempDescription)) !== null) {
    const assetName = match[1];
    const assetPath = path.join(path.dirname(filePath), path.basename(filePath, '.md'), assetName);

    try {
      // Load the asset content
      const assetContent = await readFile(assetPath, 'utf8');

      // Store the asset reference
      assets[assetName] = {
        type: AssetType.INLINE,
        name: assetName,
        content: assetContent,
      };

      // Replace the reference with the content in the task description
      processedDescription = processedDescription.replace(`[[asset:${assetName}]]`, assetContent);
    } catch (error) {
      console.error(`Error loading inline asset ${assetName} for ${filePath}:`, error);
      // Replace with error message
      processedDescription = processedDescription.replace(
        `[[asset:${assetName}]]`,
        `[Asset not found: ${assetName}]`
      );
    }
  }

  // Process path references: {{path:name}}
  const pathAssetRegex = /\{\{path:([^}]+)\}\}/g;
  tempDescription = processedDescription; // Use updated description for new regex

  while ((match = pathAssetRegex.exec(tempDescription)) !== null) {
    const assetName = match[1];
    const assetRelativePath = path.join(path.basename(filePath, '.md'), assetName);
    const assetAbsolutePath = path.resolve(path.dirname(filePath), assetRelativePath);

    // Check if the file exists
    try {
      await fs.promises.access(assetAbsolutePath, fs.constants.F_OK);

      // Store the asset reference
      assets[assetName] = {
        type: AssetType.PATH,
        name: assetName,
        path: assetAbsolutePath,
      };

      // Replace the reference with the absolute path in the task description
      processedDescription = processedDescription.replace(
        `{{path:${assetName}}}`,
        assetAbsolutePath
      );
    } catch (error) {
      console.error(`Error resolving path asset ${assetName} for ${filePath}:`, error);
      // Replace with error message
      processedDescription = processedDescription.replace(
        `{{path:${assetName}}}`,
        `[Asset path not found: ${assetName}]`
      );
    }
  }

  return {
    processedDescription,
    assets,
  };
}
