/* eslint-env node, commonjs */
/* global console, process, __dirname */
const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { verifyStagehandScript } = require('./verify-stagehand.cjs');

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit' });
}

function getVersion() {
  const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json')));
  return packageJson.version;
}

function hasGitChanges() {
  try {
    execSync('git diff --staged --quiet', { stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
}

function isVersionPublished(version) {
  try {
    execSync(`npm view vibe-tools@${version} version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

try {
  // Get additional arguments to pass to npm publish
  const args = process.argv.slice(2);
  const tagIndex = args.indexOf('--tag');
  const tag = tagIndex !== -1 ? args[tagIndex + 1] : null;
  const publishArgs = args.join(' ');

  // Validate that --tag is set to either alpha or latest
  if (!tag || !['alpha', 'latest'].includes(tag)) {
    throw new Error('--tag must be set to either "alpha" or "latest"');
  }

  // Verify stagehand script matches
  console.log('\nVerifying stagehand script...');
  verifyStagehandScript();

  // Run lint and build
  run('npm run lint');
  run('npm run build');

  // Get version from package.json
  const version = getVersion();

  // Stage package.json changes
  run('git add package.json');

  // Only commit if there are staged changes
  if (hasGitChanges()) {
    run(`git commit -m "release: v${version}"`);
  }

  // Check if version is already published
  if (isVersionPublished(version)) {
    if (tag) {
      // If version exists and tag is specified, just update the tag
      console.log(`Version ${version} already exists, updating tag...`);
      run(`npm dist-tag add vibe-tools@${version} ${tag}`);
    } else {
      throw new Error(`Version ${version} is already published. Please increment the version number or specify a tag to update.`);
    }
  } else {
    // Publish new version to npm with any additional arguments
    run(`npm publish ${publishArgs}`);
  }

  // Push to GitHub
  run('git push');

  console.log(`\n✨ Successfully released v${version}`);
} catch (error) {
  console.error('\n🚨 Release failed:', error.message);
  process.exit(1);
} 
