#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HookSettings, HookDefinition, HookType } from './types';

const HOOK_FILES = {
  project: '.claude/hooks/hooks.ts',
  local: '.claude/hooks/hooks.local.ts',
  user: '.claude/hooks/hooks.user.ts'
} as const;

const MANAGED_BY_MARKER = '__managed_by_define_claude_code_hooks__';

function getManagedMarker(location: 'project' | 'local' | 'user'): string {
  if (location === 'user') {
    // For user settings, include the project path to avoid conflicts
    return `${MANAGED_BY_MARKER}:${process.cwd()}`;
  }
  return MANAGED_BY_MARKER;
}

interface CliOptions {
  remove?: boolean;
  globalSettingsPath?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--remove':
        options.remove = true;
        break;
      case '--global-settings-path':
        if (i + 1 < args.length) {
          options.globalSettingsPath = args[++i];
        } else {
          console.error('--global-settings-path requires a path argument');
          process.exit(1);
        }
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
  --remove                          Remove managed hooks from all settings files
  --global-settings-path <path>     Custom path to global Claude settings.json
                                    (default: ~/.claude/settings.json)
  --help                            Show this help message

This command will automatically detect hook files in .claude/hooks/:
  - hooks.ts       → Updates .claude/settings.json
  - hooks.local.ts → Updates .claude/settings.local.json
  - hooks.user.ts  → Updates ~/.claude/settings.json (or custom path)
`);
}

async function updateHooks(options: CliOptions) {
  const { execSync } = require('child_process');
  let updatedAny = false;

  // Check for each type of hook file
  for (const [type, fileName] of Object.entries(HOOK_FILES)) {
    const hookFilePath = path.resolve(process.cwd(), fileName);
    
    if (fs.existsSync(hookFilePath)) {
      console.log(`Found ${fileName}`);
      
      // Get hook information by running the hooks file
      let hookInfo: any;
      
      try {
        const output = execSync(
          `node -r ts-node/register "${hookFilePath}" __generate_settings`,
          { encoding: 'utf-8' }
        );
        
        hookInfo = JSON.parse(output);
      } catch (error) {
        console.error(`Failed to load hooks from ${fileName}: ${error}`);
        continue;
      }

      // Determine settings file path
      let settingsPath: string;
      switch (type) {
        case 'project':
          settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
          break;
        case 'local':
          settingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
          break;
        case 'user':
          settingsPath = options.globalSettingsPath || path.join(os.homedir(), '.claude', 'settings.json');
          break;
        default:
          continue;
      }

      await updateSettingsFile(
        settingsPath,
        hookFilePath,
        hookInfo,
        type as 'project' | 'local' | 'user'
      );
      updatedAny = true;
    }
  }

  if (!updatedAny) {
    console.log('No hook files found. Create one of:');
    console.log('  - .claude/hooks/hooks.ts (project settings)');
    console.log('  - .claude/hooks/hooks.local.ts (local settings)');
    console.log('  - .claude/hooks/hooks.user.ts (user settings)');
  }
}

async function removeHooks(options: CliOptions) {
  let removedAny = false;
  
  // Remove from project settings
  const projectSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  if (fs.existsSync(projectSettingsPath)) {
    await removeFromSettingsFile(projectSettingsPath, 'project');
    removedAny = true;
  }
  
  // Remove from local settings
  const localSettingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
  if (fs.existsSync(localSettingsPath)) {
    await removeFromSettingsFile(localSettingsPath, 'local');
    removedAny = true;
  }
  
  // Remove from user settings
  const userSettingsPath = options.globalSettingsPath || path.join(os.homedir(), '.claude', 'settings.json');
  if (fs.existsSync(userSettingsPath)) {
    await removeFromSettingsFile(userSettingsPath, 'user');
    removedAny = true;
  }
  
  if (!removedAny) {
    console.log('No settings files found to clean up.');
  }
}



async function updateSettingsFile(
  settingsPath: string,
  hookFilePath: string,
  hookInfo: any,
  location: 'project' | 'local' | 'user'
) {
  // Use absolute path for user settings, relative for project/local
  const commandPath = location === 'user' 
    ? hookFilePath 
    : `./${HOOK_FILES[location]}`;
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
  const marker = getManagedMarker(location);
  for (const hookType of Object.keys(settings.hooks) as HookType[]) {
    if (settings.hooks[hookType]) {
      settings.hooks[hookType] = settings.hooks[hookType]!.filter(
        matcher => !(matcher.hooks.length === 1 && 
                    matcher.hooks[0].command.includes(marker))
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
            command: `node -r ts-node/register --no-warnings "${commandPath}" __run_hook ${hookType} "${entry.matcher}" "${entry.index}" # ${marker}`
          }]
        });
      } else {
        // For non-tool hooks, one entry total
        settings.hooks[typedHookType]!.push({
          hooks: [{
            type: 'command',
            command: `node -r ts-node/register --no-warnings "${commandPath}" __run_hook ${hookType} # ${marker}`
          }]
        });
      }
    }
  }
  
  // Write updated settings
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(`Updated ${location} settings at ${settingsPath}`);
}

async function removeFromSettingsFile(settingsPath: string, location: 'project' | 'local' | 'user') {
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
    const marker = getManagedMarker(location);
    for (const hookType of Object.keys(settings.hooks) as HookType[]) {
      if (settings.hooks[hookType]) {
        settings.hooks[hookType] = settings.hooks[hookType]!.filter(
          matcher => !(matcher.hooks.length === 1 && 
                      matcher.hooks[0].command.includes(marker))
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