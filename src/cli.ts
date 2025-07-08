#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HookSettings, HookDefinition, HookType } from './types';

const HOOK_FILE_NAME = '.claude/hooks/hooks.ts';
const MANAGED_BY_MARKER = '__managed_by_define_claude_code_hooks__';

interface CliOptions {
  projectSettings?: boolean;
  localSettings?: boolean;
  userSettings?: boolean;
  remove?: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  // Parse arguments
  for (const arg of args) {
    switch (arg) {
      case '--project':
        options.projectSettings = true;
        break;
      case '--local':
        options.localSettings = true;
        break;
      case '--user':
        options.userSettings = true;
        break;
      case '--remove':
        options.remove = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        showHelp();
        process.exit(1);
    }
  }

  // Default to project settings if not specified
  if (!options.projectSettings && !options.localSettings && !options.userSettings) {
    options.projectSettings = true;
  }

  try {
    if (options.remove) {
      await removeHooks(options);
    } else {
      await updateHooks(options);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Usage: npx define-claude-code-hooks [options]

Options:
  --project    Update project settings (.claude/settings.json) [default]
  --local      Update local settings (.claude/settings.local.json)
  --user       Update user settings (~/.claude/settings.json)
  --remove     Remove managed hooks from settings
  --help       Show this help message

This command will read hooks from .claude/hooks/hooks.ts
and update the appropriate settings.json file.
`);
}

async function updateHooks(options: CliOptions) {
  // Find and load hook definitions
  const hookFilePath = path.resolve(process.cwd(), HOOK_FILE_NAME);
  
  if (!fs.existsSync(hookFilePath)) {
    throw new Error(`${HOOK_FILE_NAME} not found in current directory`);
  }

  // Get hook information by running the hooks file
  const { execSync } = require('child_process');
  let hookInfo: any;
  
  try {
    const output = execSync(
      `node -r ts-node/register "${hookFilePath}" __generate_settings`,
      { encoding: 'utf-8' }
    );
    
    hookInfo = JSON.parse(output);
  } catch (error) {
    throw new Error(`Failed to load hooks: ${error}`);
  }

  // Update settings
  if (options.projectSettings) {
    await updateSettingsFile(
      path.join(process.cwd(), '.claude', 'settings.json'),
      hookFilePath,
      hookInfo,
      'project'
    );
  }
  
  if (options.localSettings) {
    await updateSettingsFile(
      path.join(process.cwd(), '.claude', 'settings.local.json'),
      hookFilePath,
      hookInfo,
      'local'
    );
  }
  
  if (options.userSettings) {
    await updateSettingsFile(
      path.join(os.homedir(), '.claude', 'settings.json'),
      hookFilePath,
      hookInfo,
      'user'
    );
  }
}

async function removeHooks(options: CliOptions) {
  if (options.projectSettings) {
    await removeFromSettingsFile(
      path.join(process.cwd(), '.claude', 'settings.json')
    );
  }
  
  if (options.localSettings) {
    await removeFromSettingsFile(
      path.join(process.cwd(), '.claude', 'settings.local.json')
    );
  }
  
  if (options.userSettings) {
    await removeFromSettingsFile(
      path.join(os.homedir(), '.claude', 'settings.json')
    );
  }
}



async function updateSettingsFile(
  settingsPath: string,
  hookFilePath: string,
  hookInfo: any,
  location: 'project' | 'local' | 'user'
) {
  // Use relative path for project/local settings, absolute for user settings
  const commandPath = location === 'user' ? hookFilePath : `./${HOOK_FILE_NAME}`;
  // Ensure directory exists
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Load existing settings
  let settings: HookSettings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Could not parse existing settings.json: ${error}`);
    }
  }
  
  // Initialize hooks object if needed
  if (!settings.hooks) {
    settings.hooks = {};
  }
  
  // Remove existing managed hooks
  for (const hookType of Object.keys(settings.hooks) as HookType[]) {
    if (settings.hooks[hookType]) {
      settings.hooks[hookType] = settings.hooks[hookType]!.filter(
        matcher => !(matcher.hooks.length === 1 && 
                    matcher.hooks[0].command.includes(MANAGED_BY_MARKER))
      );
      
      // Remove empty arrays
      if (settings.hooks[hookType]!.length === 0) {
        delete settings.hooks[hookType];
      }
    }
  }
  
  // Add hooks based on what's defined
  for (const [hookType, entries] of Object.entries(hookInfo)) {
    const typedHookType = hookType as HookType;
    if (!settings.hooks[typedHookType]) {
      settings.hooks[typedHookType] = [];
    }
    
    for (const entry of entries as any[]) {
      if (hookType === 'PreToolUse' || hookType === 'PostToolUse') {
        // For tool hooks, one entry per matcher
        settings.hooks[typedHookType]!.push({
          matcher: entry.matcher,
          hooks: [{
            type: 'command',
            command: `node -r ts-node/register --no-warnings "${commandPath}" __run_hook ${hookType} "${entry.matcher}" "${entry.index}" # ${MANAGED_BY_MARKER}`
          }]
        });
      } else {
        // For non-tool hooks, one entry total
        settings.hooks[typedHookType]!.push({
          hooks: [{
            type: 'command',
            command: `node -r ts-node/register --no-warnings "${commandPath}" __run_hook ${hookType} # ${MANAGED_BY_MARKER}`
          }]
        });
      }
    }
  }
  
  // Write updated settings
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(`Updated ${location} settings at ${settingsPath}`);
}

async function removeFromSettingsFile(settingsPath: string) {
  if (!fs.existsSync(settingsPath)) {
    console.log(`No settings file found at ${settingsPath}`);
    return;
  }
  
  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings: HookSettings = JSON.parse(content);
    
    if (!settings.hooks) {
      console.log('No hooks found in settings');
      return;
    }
    
    // Remove managed hooks
    for (const hookType of Object.keys(settings.hooks) as HookType[]) {
      if (settings.hooks[hookType]) {
        settings.hooks[hookType] = settings.hooks[hookType]!.filter(
          matcher => !(matcher.hooks.length === 1 && 
                      matcher.hooks[0].command.includes(MANAGED_BY_MARKER))
        );
        
        // Remove empty arrays
        if (settings.hooks[hookType]!.length === 0) {
          delete settings.hooks[hookType];
        }
      }
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`Removed managed hooks from ${settingsPath}`);
  } catch (error) {
    console.error(`Error updating ${settingsPath}:`, error);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}