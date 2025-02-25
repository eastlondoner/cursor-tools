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
        await execAsync(`xcrun simctl boot "${deviceId}" && open -a Simulator --args -CurrentDeviceUDID "${deviceId}"`);
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
      // First try to get the exact DerivedData path from build settings
      const { stdout: buildSettingsOutput } = await execAsync('xcodebuild -showBuildSettings');
      const lines = buildSettingsOutput.split('\n');

      // Look for CONFIGURATION_BUILD_DIR first as it's most specific
      let appPath = '';
      for (const line of lines) {
        if (line.includes('CONFIGURATION_BUILD_DIR =')) {
          const buildDir = line.split('=')[1].trim();
          const possiblePath = join(buildDir, 'PapersApp.app');
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
          const possiblePath = join(buildDir, 'PapersApp.app');
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
        const appBundle = files.find((f) => f.endsWith('.app'));
        if (appBundle) {
          appPath = join(searchPath, appBundle);
          console.log(`Found app bundle at ${appPath}`);
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
      // First build the project
      const buildCommand = new BuildCommand();
      yield* buildCommand.execute('', options);

      // Get device type from query or use default
      const deviceType = query.toLowerCase();
      if (deviceType && !['iphone', 'ipad'].includes(deviceType)) {
        throw new Error('Invalid device type. Use "iphone" or "ipad"');
      }

      // Get device name based on type
      const deviceName = deviceType === 'ipad' 
        ? DEVICE_TYPES.ipad 
        : DEVICE_TYPES.iphone;

      console.log(`Using device: ${deviceName}`);

      // Find the app bundle using our improved method
      const appPath = await this.findAppBundle(process.cwd());
      console.log(`App path: ${appPath}`);

      // Use the bundle identifier from your Xcode settings
      const bundleId = 'com.papers.app';
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
}
