// Fix stagehand script
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sourcePath = path.resolve(__dirname, 'node_modules/@browserbasehq/stagehand/lib/dom/build/scriptContent.ts');
const targetPath = path.resolve(__dirname, 'src/commands/browser/stagehand/stagehandScript.ts');

// Read source script
const sourceContent = fs.readFileSync(sourcePath, 'utf8');
// Extract content between quotes using regular expression
const scriptContentMatch = sourceContent.match(/export const scriptContent = "([\s\S]*)";/);

if (!scriptContentMatch) {
  console.error('Could not find scriptContent in source file');
  process.exit(1);
}

const scriptContent = scriptContentMatch[1];

// Format and write to target file
const targetContent = `export const STAGEHAND_SCRIPT = "${scriptContent}";`;
fs.writeFileSync(targetPath, targetContent);

console.log('✅ Successfully updated stagehand script!'); 