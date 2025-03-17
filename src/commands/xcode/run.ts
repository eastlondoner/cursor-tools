/**
 * Implementation of the Xcode run command.
 * This command handles running iOS apps in the simulator.
 *
 * Key features:
 * - Simulator device management
 * - Device state detection
 * - App installation and launch
 */

import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execAsync } from '../../utils/execAsync.js';
import { BuildCommand } from './build.js';
import { DEVICE_TYPES, DEFAULT_TIMEOUTS } from './utils.js';

/**
 * Command-specific flags and options
 */
interface RunCommandFlags {
  device?: string; // Target device for the build (iphone/ipad)
}

export class RunCommand implements Command {
  flags: RunCommandFlags = {};

  /**
   * Ensures that the Simulator.app is running.
   * This is required before we can interact with simulator devices.
   * @param deviceId - The ID of the device we want to use
   */
  private async ensureSimulatorRunning(deviceId: string): Promise<void> {
    try {
      // Check if Simulator.app is running
      const { stdout } = await execAsync('pgrep -x "Simulator"');
      if (!stdout.trim()) {
        console.log('Starting Simulator.app...');
        // Start Simulator.app with the specific device
        await execAsync(
          `xcrun simctl boot "${deviceId}" && open -a Simulator --args -CurrentDeviceUDID "${deviceId}"`
        );
        // Wait longer for it to fully start
        console.log('Waiting for Simulator.app to initialize...');
        await new Promise((resolve) => setTimeout(resolve, DEFAULT_TIMEOUTS.SIMULATOR_BOOT));
      } else {
        // If Simulator is already running, ensure we're using the right device
        await execAsync(`open -a Simulator --args -CurrentDeviceUDID "${deviceId}"`);
      }
    } catch (error: any) {
      // Only throw if it's not already booted
      if (!error.message?.includes('Unable to boot device in current state: Booted')) {
        throw error;
      }
    }
  }

  /**
   * Gets the UUID for a simulator device by name.
   * Handles parsing the output of xcrun simctl list devices.
   *
   * @param deviceName - Name of the device to find
   * @returns Promise resolving to the device UUID
   * @throws Error if device not found or UUID can't be parsed
   */
  private async getDeviceId(deviceName: string): Promise<string> {
    const deviceList = await this.getDeviceList();
    console.log('Available devices:', deviceList);

    // Use stored device name from build process
    if (process.env.XCODE_DEVICE_NAME) {
      deviceName = process.env.XCODE_DEVICE_NAME;
    }

    // Clean device name of any quotes or extra parameters
    deviceName = deviceName.replace(/^"|"$/g, '').split(' buildPath=')[0];

    console.log(`Looking for device: "${deviceName}"`);

    const lines = deviceList.split('\n');
    for (const line of lines) {
      if (line.includes(deviceName)) {
        const uuidMatch = line.match(/\(([\w-]{36})\)/);
        if (uuidMatch && uuidMatch[1]) {
          const deviceId = uuidMatch[1];
          console.log(`Found device ID for ${deviceName}: ${deviceId}`);
          return deviceId;
        }
      }
    }
    throw new Error(`Could not find device ID for ${deviceName}`);
  }

  /**
   * Gets the current state of a simulator device.
   * States can be: Booted, Shutdown, etc.
   *
   * @param deviceId - UUID of the device
   * @returns Current state string
   */
  private async getDeviceState(deviceId: string): Promise<string> {
    const { stdout } = await execAsync(`xcrun simctl list devices | grep "${deviceId}"`);
    // The state is in the last set of parentheses
    const matches = stdout.match(/\(([\w-]+)\)/g);
    if (matches && matches.length >= 2) {
      // The last match contains the state
      const state = matches[matches.length - 1].slice(1, -1);
      console.log(`Current device state: ${state}`);
      return state;
    }
    return 'Unknown';
  }

  /**
   * Finds the built app bundle in DerivedData.
   * Uses multiple strategies to ensure we find the correct bundle.
   *
   * @param projectDir - Project directory
   * @returns Path to the .app bundle
   */
  private async findAppBundle(projectDir: string): Promise<string> {
    try {
      // Get the app name dynamically
      const appName = await this.getAppName();
      console.log(`Looking for app bundle with name: ${appName}`);

      // First check if we have a custom build path from the build command
      if (process.env.XCODE_BUILD_PATH) {
        console.log(
          `Using build path from previous build command: ${process.env.XCODE_BUILD_PATH}`
        );

        // The standard location for simulator builds
        const simulatorBuildPath = join(
          process.env.XCODE_BUILD_PATH,
          'Build/Products/Debug-iphonesimulator',
          appName
        );

        if (existsSync(simulatorBuildPath)) {
          console.log(`Found app bundle at ${simulatorBuildPath}`);
          return simulatorBuildPath;
        }

        // Try searching for any .app in the build directory
        const productsPath = join(
          process.env.XCODE_BUILD_PATH,
          'Build/Products/Debug-iphonesimulator'
        );
        if (existsSync(productsPath)) {
          const files = readdirSync(productsPath);
          const appBundle = files.find((f) => f.endsWith('.app'));
          if (appBundle) {
            const bundlePath = join(productsPath, appBundle);
            console.log(`Found app bundle at ${bundlePath}`);
            return bundlePath;
          }
        }
      }

      // Fall back to the original search methods if no custom build path or app not found

      // First try to get the exact DerivedData path from build settings
      const { stdout: buildSettingsOutput } = await execAsync('xcodebuild -showBuildSettings');
      const lines = buildSettingsOutput.split('\n');

      // Look for CONFIGURATION_BUILD_DIR first as it's most specific
      let appPath = '';
      for (const line of lines) {
        if (line.includes('CONFIGURATION_BUILD_DIR =')) {
          const buildDir = line.split('=')[1].trim();
          const possiblePath = join(buildDir, appName);
          if (existsSync(possiblePath)) {
            console.log(`Found app bundle at ${possiblePath}`);
            return possiblePath;
          }
        }
      }

      // If not found, try TARGET_BUILD_DIR
      for (const line of lines) {
        if (line.includes('TARGET_BUILD_DIR =')) {
          const buildDir = line.split('=')[1].trim();
          const possiblePath = join(buildDir, appName);
          if (existsSync(possiblePath)) {
            console.log(`Found app bundle at ${possiblePath}`);
            return possiblePath;
          }
        }
      }

      // If still not found, search in DerivedData
      const { stdout: derivedDataPath } = await execAsync(
        'xcodebuild -showBuildSettings | grep OBJROOT'
      );
      const basePath = derivedDataPath.split('=')[1].trim().split('Build/Intermediates.noindex')[0];

      // Search for .app bundles in the Debug-iphonesimulator directory
      const searchPath = join(basePath, 'Build/Products/Debug-iphonesimulator');
      if (existsSync(searchPath)) {
        const files = readdirSync(searchPath);

        // First try to find a specific app with our known app name
        const appBundle = files.find((f) => f === appName);
        if (appBundle) {
          appPath = join(searchPath, appBundle);
          console.log(`Found app bundle at ${appPath}`);
          return appPath;
        }

        // If not found, take the first .app bundle we find
        const anyAppBundle = files.find((f) => f.endsWith('.app'));
        if (anyAppBundle) {
          appPath = join(searchPath, anyAppBundle);
          console.log(`Found app bundle at ${appPath} (fallback method)`);
          return appPath;
        }
      }

      throw new Error('Could not find built app bundle in DerivedData');
    } catch (error: any) {
      throw new Error(`Failed to find app bundle: ${error.message}`);
    }
  }

  /**
   * Handles the simulator lifecycle:
   * 1. Gets device UUID
   * 2. Checks device state
   * 3. Boots simulator if needed
   * 4. Installs and launches the app
   *
   * @param deviceName - Name of the simulator device
   * @param bundleId - Bundle identifier of the app
   * @param appPath - Path to the built .app bundle
   */
  private async runOnSimulator(deviceName: string, bundleId: string, appPath: string) {
    // Get device ID from name
    const deviceId = await this.getDeviceId(deviceName);

    // First ensure Simulator.app is running with our desired device
    await this.ensureSimulatorRunning(deviceId);

    // Get current state
    const state = await this.getDeviceState(deviceId);
    console.log(`Current device state: ${state}`);

    // Boot simulator if needed
    if (state !== 'Booted') {
      console.log('Booting simulator...');
      try {
        await execAsync(`xcrun simctl boot "${deviceId}"`);
        // Wait for simulator to fully boot
        console.log('Waiting for simulator to complete boot...');
        await new Promise((resolve) => setTimeout(resolve, DEFAULT_TIMEOUTS.APP_LAUNCH));
      } catch (error: any) {
        if (!error.message?.includes('Unable to boot device in current state: Booted')) {
          throw new Error(`Failed to boot simulator: ${error}`);
        }
      }
    }

    // Verify app path exists
    if (!existsSync(appPath)) {
      throw new Error(`App bundle not found at path: ${appPath}`);
    }

    // Install and launch app
    console.log('Installing app...');
    try {
      await execAsync(`xcrun simctl install "${deviceId}" "${appPath}"`);
    } catch (error: any) {
      throw new Error(`Failed to install app: ${error.message}`);
    }

    console.log('Launching app...');
    try {
      await execAsync(`xcrun simctl launch "${deviceId}" "${bundleId}"`);
    } catch (error: any) {
      throw new Error(`Failed to launch app: ${error.message}`);
    }

    // Bring Simulator window to front
    await execAsync('open -a Simulator');
  }

  /**
   * Main execution method for the run command.
   * First builds the app, then runs it in the simulator.
   *
   * @param query - Command query string (e.g., "iphone" or "ipad")
   * @param options - Command options
   * @yields Status messages and command output
   */
  async *execute(query: string, options: CommandOptions): CommandGenerator {
    try {
      // Parse query for device type and custom options
      // Format could be:
      // - "iphone" or "ipad" (simple device type)
      // - "device=iPhone 16 Pro" (specific device name)
      // - "buildPath=./build" (custom build path)

      let deviceName = '';
      let buildOptions = '';

      // Check for specific device name
      if (query.includes('device=')) {
        const parts = query.split(' ');
        // Find the part that starts with device=
        const devicePart = parts.find((p) => p.startsWith('device='));
        if (devicePart) {
          // Extract the device name, which might include quotes
          const deviceWithQuotes = devicePart.substring(7); // Remove "device="
          deviceName = deviceWithQuotes.replace(/^"|"$/g, ''); // Remove quotes if present

          // Remove device option from parts array
          const filteredParts = parts.filter((p) => !p.startsWith('device='));
          buildOptions = filteredParts.join(' ');
        }
      } else {
        // Simple device type format (iphone/ipad)
        const deviceType = query.toLowerCase().split(/\s+/)[0];

        if (deviceType) {
          if (!['iphone', 'ipad'].includes(deviceType)) {
            throw new Error('Invalid device type. Use "iphone", "ipad", or "device=Device Name"');
          }

          // Get device name based on type
          deviceName = deviceType === 'ipad' ? DEVICE_TYPES.ipad : DEVICE_TYPES.iphone;

          // Remove device type from query for build command
          buildOptions = query.replace(deviceType, '').trim();
        } else {
          // Default to iPhone if no device specified
          deviceName = DEVICE_TYPES.iphone;
          buildOptions = query;
        }
      }

      console.log(`Using device: ${deviceName}`);

      // Temporarily store the deviceName so it doesn't get lost
      process.env.XCODE_DEVICE_NAME = deviceName;

      // First build the project with any remaining options
      const buildCommand = new BuildCommand();
      yield* buildCommand.execute(buildOptions, options);

      // Find the app bundle using our improved method
      const appPath = await this.findAppBundle(process.cwd());
      console.log(`App path: ${appPath}`);

      // Extract bundle identifier dynamically from Info.plist
      const bundleId = await this.getBundleIdentifier(appPath);
      console.log(`Using bundle identifier: ${bundleId}`);

      // Run on simulator
      await this.runOnSimulator(deviceName, bundleId, appPath);

      yield 'App launched successfully in simulator.\n';
    } catch (error: any) {
      console.error(`Run failed: ${error}`);
      throw error;
    }
  }

  private async getDeviceList(): Promise<string> {
    const { stdout } = await execAsync('xcrun simctl list devices');
    return stdout;
  }

  /**
   * Extracts the bundle identifier from the app's Info.plist file
   *
   * @param appPath - Path to the .app bundle
   * @returns The bundle identifier string
   */
  private async getBundleIdentifier(appPath: string): Promise<string> {
    try {
      // Use plutil to extract the CFBundleIdentifier from Info.plist
      const infoPlistPath = join(appPath, 'Info.plist');
      const { stdout } = await execAsync(`plutil -p "${infoPlistPath}" | grep CFBundleIdentifier`);

      // Extract the value from the JSON-like output
      const match = stdout.match(/"CFBundleIdentifier"\s*=>\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }

      // Fallback: Try to get it from build settings
      const { stdout: buildSettings } = await execAsync(
        'xcodebuild -showBuildSettings | grep PRODUCT_BUNDLE_IDENTIFIER'
      );
      const settingsMatch = buildSettings.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*(.+)$/m);
      if (settingsMatch && settingsMatch[1]) {
        return settingsMatch[1].trim();
      }

      throw new Error('Could not determine bundle identifier');
    } catch (error: any) {
      console.error(`Error getting bundle identifier: ${error.message}`);
      throw new Error(`Failed to determine bundle identifier: ${error.message}`);
    }
  }

  /**
   * Gets the app name from Xcode build settings
   *
   * @returns The app name
   */
  private async getAppName(): Promise<string> {
    try {
      // Get app name from build settings
      const { stdout } = await execAsync('xcodebuild -showBuildSettings | grep PRODUCT_NAME');
      const match = stdout.match(/PRODUCT_NAME\s*=\s*(.+)$/m);
      if (match && match[1]) {
        const appName = match[1].trim();
        console.log(`Found app name: ${appName}`);
        return `${appName}.app`;
      }

      // Fallback: try to find the target name
      const { stdout: targetOutput } = await execAsync('xcodebuild -list | grep "Targets:" -A 10');
      const targetMatch = targetOutput.match(/Targets:\s*\n\s*(.+)/);
      if (targetMatch && targetMatch[1]) {
        const appName = targetMatch[1].trim();
        console.log(`Found target name: ${appName}`);
        return `${appName}.app`;
      }

      throw new Error('Could not determine app name');
    } catch (error: any) {
      console.error(`Error getting app name: ${error.message}`);
      throw new Error(`Failed to determine app name: ${error.message}`);
    }
  }
}
