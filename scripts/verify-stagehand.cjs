/* eslint-env node, commonjs */
const { readFileSync } = require('fs');
const { resolve } = require('path');

function verifyStagehandScript() {
  // Read our bundled script
  const bundledScriptPath = resolve(__dirname, '../src/commands/browser/stagehand/stagehandScript.ts');
  const bundledContent = readFileSync(bundledScriptPath, 'utf8');
  
  // Extract the actual script content from our bundled version (removing the export and comment)
  const scriptMatch = bundledContent.match(/export const STAGEHAND_SCRIPT = "([\s\S]*)";/);
  if (!scriptMatch) {
    throw new Error('Could not find STAGEHAND_SCRIPT in bundled file');
  }
  const bundledScript = scriptMatch[1].replace(/\\n/g, '\n');

  // Read the original script from node_modules
  const originalScriptPath = resolve(__dirname, '../node_modules/@browserbasehq/stagehand/lib/dom/build/index.js');
  const originalScript = readFileSync(originalScriptPath, 'utf8');

  // Compare the scripts
  if (bundledScript.trim() !== originalScript.trim()) {
    throw new Error(
      'Stagehand script mismatch detected!\n' +
      'The bundled script in src/commands/browser/stagehand/stagehandScript.ts does not match\n' +
      'the script in node_modules/@browserbasehq/stagehand/lib/dom/build/index.js\n\n' +
      'Please update the bundled script to match the latest version.'
    );
  }

  console.log('✓ Stagehand script verification passed');
}

// If this script is run directly
if (require.main === module) {
  verifyStagehandScript();
}

module.exports = { verifyStagehandScript }; 
