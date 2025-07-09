#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HookSettings, HookDefinition, HookType } from './types';
import inquirer from 'inquirer';
import { execSync } from 'child_process';

const HOOK_FILES = {
  project: '.claude/hooks/hooks.ts',
  local: '.claude/hooks/hooks.local.ts'
} as const;

const MANAGED_BY_MARKER = '__managed_by_define_claude_code_hooks__';

function getManagedMarker(location: 'project' | 'local'): string {
  return MANAGED_BY_MARKER;
}

interface CliOptions {
  remove?: boolean;
  init?: boolean;
  alternateDistPath?: string;
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
      case '--init':
        options.init = true;
        break;
      case '--alternate-dist-path':
        if (process.env.NODE_ENV !== 'development') {
          console.error('--alternate-dist-path is only available in development mode');
          process.exit(1);
        }
        if (i + 1 < args.length) {
          options.alternateDistPath = args[++i];
        } else {
          console.error('--alternate-dist-path requires a path argument');
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
    if (options.init) {
      await initHooks(options);
    } else if (options.remove) {
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
  --init                            Initialize hooks in your project
  --remove                          Remove managed hooks from all settings files
  --help                            Show this help message${process.env.NODE_ENV === 'development' ? `
  --alternate-dist-path <path>      Use alternate dist path (development only)` : ''}

This command will automatically detect hook files in .claude/hooks/:
  - hooks.ts       → Updates .claude/settings.json
  - hooks.local.ts → Updates .claude/settings.local.json

Note: Requires ts-node to be installed in your project.
`);
}


async function updateHooks(options: CliOptions) {
  let updatedAny = false;

  // Check for each type of hook file
  for (const [type, fileName] of Object.entries(HOOK_FILES)) {
    const hookFilePath = path.resolve(process.cwd(), fileName);
    
    // Determine settings file path
    let settingsPath: string;
    switch (type) {
      case 'project':
        settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
        break;
      case 'local':
        settingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
        break;
      default:
        continue;
    }
    
    if (fs.existsSync(hookFilePath)) {
      console.log(`Found ${fileName}`);
      
      // Get hook information by running the TypeScript hooks file with ts-node
      let hookInfo: any;
      
      try {
        const output = execSync(
          `npx ts-node "${hookFilePath}" __generate_settings`,
          { encoding: 'utf-8' }
        );
        
        hookInfo = JSON.parse(output);
      } catch (error) {
        console.error(`Failed to load hooks from ${fileName}: ${error}`);
        continue;
      }

      await updateSettingsFile(
        settingsPath,
        hookFilePath,
        hookInfo,
        type as 'project' | 'local'
      );
      updatedAny = true;
    } else {
      // Hook file doesn't exist - remove managed hooks from settings if settings file exists
      if (fs.existsSync(settingsPath)) {
        console.log(`No ${fileName} found, cleaning up managed hooks from ${settingsPath}`);
        await removeFromSettingsFile(settingsPath, type as 'project' | 'local');
      }
    }
  }

  if (!updatedAny) {
    console.log('No hook files found. Create one of:');
    console.log('  - .claude/hooks/hooks.ts (project settings)');
    console.log('  - .claude/hooks/hooks.local.ts (local settings)');
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
  
  if (!removedAny) {
    console.log('No settings files found to clean up.');
  }
}



async function updateSettingsFile(
  settingsPath: string,
  hookFilePath: string,
  hookInfo: any,
  location: 'project' | 'local'
) {
  // Use relative path for project/local
  const commandPath = `./${HOOK_FILES[location]}`;
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
            command: `test -f "${commandPath}" && npx ts-node "${commandPath}" __run_hook ${hookType} "${entry.matcher}" "${entry.index}" || (>&2 echo "Error: Hook script not found at ${commandPath}" && >&2 echo "Please run: npx define-claude-code-hooks" && exit 1) # ${marker}`
          }]
        });
      } else {
        // For non-tool hooks, one entry total
        settings.hooks[typedHookType]!.push({
          hooks: [{
            type: 'command',
            command: `test -f "${commandPath}" && npx ts-node "${commandPath}" __run_hook ${hookType} || (>&2 echo "Error: Hook script not found at ${commandPath}" && >&2 echo "Please run: npx define-claude-code-hooks" && exit 1) # ${marker}`
          }]
        });
      }
    }
  }
  
  // Write updated settings
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(`Updated ${location} settings at ${settingsPath}`);
}

async function removeFromSettingsFile(settingsPath: string, location: 'project' | 'local') {
  if (!fs.existsSync(settingsPath)) {
    return;
  }
  
  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings: HookSettings = JSON.parse(content);
    
    if (!settings.hooks) {
      return;
    }
    
    // Remove managed hooks
    const marker = getManagedMarker(location);
    let removedCount = 0;
    
    for (const hookType of Object.keys(settings.hooks) as HookType[]) {
      if (settings.hooks[hookType]) {
        const originalLength = settings.hooks[hookType]!.length;
        settings.hooks[hookType] = settings.hooks[hookType]!.filter(
          matcher => !(matcher.hooks.length === 1 && 
                      matcher.hooks[0].command.includes(marker))
        );
        
        removedCount += originalLength - settings.hooks[hookType]!.length;
        
        // Remove empty arrays
        if (settings.hooks[hookType]!.length === 0) {
          delete settings.hooks[hookType];
        }
      }
    }
    
    if (removedCount > 0) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log(`Removed ${removedCount} managed hooks from ${settingsPath}`);
    }
  } catch (error) {
    console.error(`Error updating ${settingsPath}:`, error);
  }
}

async function initHooks(options: CliOptions) {
  console.log('🪝 Welcome to Claude Code Hooks!\n');
  
  // Check if package is already installed
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  const packageName = packageJson.name;
  const currentDir = process.cwd();
  
  // Check if we're in the hooks package itself
  const isOwnRepo = fs.existsSync(path.join(currentDir, 'src', 'index.ts')) && 
                    fs.existsSync(path.join(currentDir, 'package.json')) &&
                    JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf-8')).name === packageName;
  
  if (isOwnRepo) {
    console.log('⚠️  Running init in the hooks package itself. For testing purposes only.\n');
  }
  
  // Select hook location
  const { hookLocation } = await inquirer.prompt([
    {
      type: 'list',
      name: 'hookLocation',
      message: 'Where would you like to configure hooks?',
      choices: [
        { name: 'Project hooks (shared with team)', value: 'project' },
        { name: 'Local hooks (not committed to git)', value: 'local' }
      ]
    }
  ]);
  
  // Select predefined hooks
  const { selectedHooks } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedHooks',
      message: 'Which predefined hooks would you like to install?',
      choices: [
        { 
          name: '📊 Log Tool Use Events - Track all tool usage in a JSON file',
          value: 'logToolUse',
          checked: true
        },
        {
          name: '🛑 Block Env Files - Security hook to prevent reading .env files',
          value: 'blockEnv',
          checked: true
        },
        {
          name: '🔔 Announce Events - Text-to-speech announcements for various events',
          value: 'announce'
        },
        {
          name: '📝 Log Stop Events - Track when tasks complete',
          value: 'logStop'
        },
        {
          name: '💬 Log Notifications - Track notification events',
          value: 'logNotification'
        }
      ]
    }
  ]);
  
  // Create .claude/hooks directory
  const hooksDir = path.join(currentDir, '.claude', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
  
  // Generate hook file content
  const hookFileName = hookLocation === 'project' ? 'hooks.ts' : 'hooks.local.ts';
  const hookFilePath = path.join(hooksDir, hookFileName);
  
  // Check if hook file already exists
  if (fs.existsSync(hookFilePath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `${hookFileName} already exists. Overwrite it?`,
        default: false
      }
    ]);
    
    if (!overwrite) {
      console.log('\nAborted. No changes made.');
      return;
    }
  }
  
  // Generate imports and hook definitions
  let imports: string[] = [];
  let hookDefinitions: string[] = [];
  
  // Add imports based on selected hooks
  if (options.alternateDistPath) {
    imports.push(`import { defineHooks } from '${path.join(options.alternateDistPath, 'index.js').replace(/\\/g, '/')}';`);
  } else if (isOwnRepo) {
    // For development in the package itself
    imports.push(`import { defineHooks } from '../..';`);
  } else {
    imports.push(`import { defineHooks } from '${packageName}';`);
  }
  
  if (selectedHooks.includes('logToolUse')) {
    if (options.alternateDistPath) {
      imports.push(`import { logPreToolUseEvents, logPostToolUseEvents } from '${path.join(options.alternateDistPath, 'hooks', 'logToolUseEvents.js').replace(/\\/g, '/')}';`);
    } else if (isOwnRepo) {
      imports.push(`import { logPreToolUseEvents, logPostToolUseEvents } from '../../src/hooks/logToolUseEvents';`);
    } else {
      imports.push(`import { logPreToolUseEvents, logPostToolUseEvents } from '${packageName}/hooks/logToolUseEvents';`);
    }
    hookDefinitions.push(`  PreToolUse: [logPreToolUseEvents()],`);
    hookDefinitions.push(`  PostToolUse: [logPostToolUseEvents()],`);
  }
  
  if (selectedHooks.includes('blockEnv')) {
    if (options.alternateDistPath) {
      imports.push(`import { blockEnvFiles } from '${path.join(options.alternateDistPath, 'hooks', 'blockEnvFiles.js').replace(/\\/g, '/')}';`);
    } else if (isOwnRepo) {
      imports.push(`import { blockEnvFiles } from '../../src/hooks/blockEnvFiles';`);
    } else {
      imports.push(`import { blockEnvFiles } from '${packageName}/hooks/blockEnvFiles';`);
    }
    hookDefinitions.push(`  PreToolUse: [...(hookDefinitions.includes('PreToolUse') ? [] : []), blockEnvFiles],`);
  }
  
  if (selectedHooks.includes('announce')) {
    if (options.alternateDistPath) {
      imports.push(`import { announcePreToolUse, announcePostToolUse, announceStop, announceSubagentStop, announceNotification } from '${path.join(options.alternateDistPath, 'hooks', 'announceHooks.js').replace(/\\/g, '/')}';`);
    } else if (isOwnRepo) {
      imports.push(`import { announcePreToolUse, announcePostToolUse, announceStop, announceSubagentStop, announceNotification } from '../../src/hooks/announceHooks';`);
    } else {
      imports.push(`import { announcePreToolUse, announcePostToolUse, announceStop, announceSubagentStop, announceNotification } from '${packageName}/hooks/announceHooks';`);
    }
    hookDefinitions.push(`  PreToolUse: [...(hookDefinitions.includes('PreToolUse') ? [] : []), announcePreToolUse()],`);
    hookDefinitions.push(`  PostToolUse: [...(hookDefinitions.includes('PostToolUse') ? [] : []), announcePostToolUse()],`);
    hookDefinitions.push(`  Stop: announceStop(),`);
    hookDefinitions.push(`  SubagentStop: announceSubagentStop(),`);
    hookDefinitions.push(`  Notification: announceNotification(),`);
  }
  
  if (selectedHooks.includes('logStop')) {
    if (options.alternateDistPath) {
      imports.push(`import { logStopEvents, logSubagentStopEvents } from '${path.join(options.alternateDistPath, 'hooks', 'logStopEvents.js').replace(/\\/g, '/')}';`);
    } else if (isOwnRepo) {
      imports.push(`import { logStopEvents, logSubagentStopEvents } from '../../src/hooks/logStopEvents';`);
    } else {
      imports.push(`import { logStopEvents, logSubagentStopEvents } from '${packageName}/hooks/logStopEvents';`);
    }
    hookDefinitions.push(`  Stop: ${hookDefinitions.includes('Stop') ? '(...) => { logStopEvents()(...); announceStop()(...); }' : 'logStopEvents()'},`);
    hookDefinitions.push(`  SubagentStop: ${hookDefinitions.includes('SubagentStop') ? '(...) => { logSubagentStopEvents()(...); announceSubagentStop()(...); }' : 'logSubagentStopEvents()'},`);
  }
  
  if (selectedHooks.includes('logNotification')) {
    if (options.alternateDistPath) {
      imports.push(`import { logNotificationEvents } from '${path.join(options.alternateDistPath, 'hooks', 'logNotificationEvents.js').replace(/\\/g, '/')}';`);
    } else if (isOwnRepo) {
      imports.push(`import { logNotificationEvents } from '../../src/hooks/logNotificationEvents';`);
    } else {
      imports.push(`import { logNotificationEvents } from '${packageName}/hooks/logNotificationEvents';`);
    }
    hookDefinitions.push(`  Notification: ${hookDefinitions.includes('Notification') ? '(...) => { logNotificationEvents()(...); announceNotification()(...); }' : 'logNotificationEvents()'},`);
  }
  
  // Clean up duplicate PreToolUse/PostToolUse entries
  const cleanedDefinitions: string[] = [];
  const seenHookTypes = new Set<string>();
  
  for (const def of hookDefinitions) {
    const hookType = def.trim().split(':')[0];
    if (hookType === 'PreToolUse' || hookType === 'PostToolUse') {
      if (!seenHookTypes.has(hookType)) {
        seenHookTypes.add(hookType);
        // Combine all handlers for this hook type
        const handlers: string[] = [];
        if (selectedHooks.includes('logToolUse') && hookType === 'PreToolUse') {
          handlers.push('logPreToolUseEvents()');
        }
        if (selectedHooks.includes('logToolUse') && hookType === 'PostToolUse') {
          handlers.push('logPostToolUseEvents()');
        }
        if (selectedHooks.includes('blockEnv') && hookType === 'PreToolUse') {
          handlers.push('blockEnvFiles');
        }
        if (selectedHooks.includes('announce') && hookType === 'PreToolUse') {
          handlers.push('announcePreToolUse()');
        }
        if (selectedHooks.includes('announce') && hookType === 'PostToolUse') {
          handlers.push('announcePostToolUse()');
        }
        if (handlers.length > 0) {
          cleanedDefinitions.push(`  ${hookType}: [${handlers.join(', ')}],`);
        }
      }
    } else if (!seenHookTypes.has(hookType)) {
      seenHookTypes.add(hookType);
      cleanedDefinitions.push(def);
    }
  }
  
  // Generate hook file content
  const hookFileContent = `${imports.join('\n')}

defineHooks({
${cleanedDefinitions.join('\n')}
});
`;
  
  // Write hook file
  fs.writeFileSync(hookFilePath, hookFileContent);
  console.log(`\n✅ Created ${hookFileName}`);
  
  // Check if the package is installed locally
  let needsInstall = false;
  if (!isOwnRepo) {
    try {
      const projectPackageJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(projectPackageJsonPath)) {
        const projectPackageJson = JSON.parse(fs.readFileSync(projectPackageJsonPath, 'utf-8'));
        const deps = { ...projectPackageJson.dependencies, ...projectPackageJson.devDependencies };
        needsInstall = !deps[packageName];
      } else {
        needsInstall = true;
      }
    } catch {
      needsInstall = true;
    }
  }
  
  if (needsInstall) {
    console.log(`\n📦 Installing ${packageName}...`);
    
    // Detect package manager
    let packageManager = 'npm';
    if (fs.existsSync(path.join(currentDir, 'yarn.lock'))) {
      packageManager = 'yarn';
    } else if (fs.existsSync(path.join(currentDir, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
    } else if (fs.existsSync(path.join(currentDir, 'bun.lockb'))) {
      packageManager = 'bun';
    }
    
    const installCmd = packageManager === 'yarn' ? 'yarn add -D' : `${packageManager} install -D`;
    
    try {
      execSync(`${installCmd} ${packageName}`, { stdio: 'inherit', cwd: currentDir });
      console.log(`✅ Installed ${packageName}`);
    } catch (error) {
      console.error(`\n❌ Failed to install ${packageName}. Please install it manually:`);
      console.error(`   ${installCmd} ${packageName}`);
    }
  }
  
  // Add script to package.json
  const projectPackageJsonPath = path.join(currentDir, 'package.json');
  if (fs.existsSync(projectPackageJsonPath)) {
    const projectPackageJson = JSON.parse(fs.readFileSync(projectPackageJsonPath, 'utf-8'));
    
    if (!projectPackageJson.scripts) {
      projectPackageJson.scripts = {};
    }
    
    if (!projectPackageJson.scripts['claude:hooks']) {
      if (options.alternateDistPath) {
        // Use the provided alternate dist path
        const cliPath = path.join(options.alternateDistPath, 'cli.js');
        projectPackageJson.scripts['claude:hooks'] = `node "${cliPath}"`;
      } else if (isOwnRepo) {
        // For development, point to the local built CLI
        const packageRoot = path.join(__dirname, '..');
        const cliPath = path.join(packageRoot, 'dist', 'cli.js');
        projectPackageJson.scripts['claude:hooks'] = `node "${cliPath}"`;
      } else {
        projectPackageJson.scripts['claude:hooks'] = 'define-claude-code-hooks';
      }
      fs.writeFileSync(projectPackageJsonPath, JSON.stringify(projectPackageJson, null, 2) + '\n');
      console.log('✅ Added "claude:hooks" script to package.json');
    }
    
    // Run the hooks setup
    console.log('\n🔧 Setting up hooks...');
    try {
      if (options.alternateDistPath) {
        // Use the provided alternate dist path
        const cliPath = path.join(options.alternateDistPath, 'cli.js');
        execSync(`node "${cliPath}"`, { stdio: 'inherit', cwd: currentDir });
      } else if (isOwnRepo) {
        // In development, run the CLI directly from the package root
        const packageRoot = path.join(__dirname, '..');
        const cliPath = path.join(packageRoot, 'dist', 'cli.js');
        execSync(`node "${cliPath}"`, { stdio: 'inherit', cwd: currentDir });
      } else {
        // Detect package manager and run the script
        let runCmd = 'npm run';
        if (fs.existsSync(path.join(currentDir, 'yarn.lock'))) {
          runCmd = 'yarn';
        } else if (fs.existsSync(path.join(currentDir, 'pnpm-lock.yaml'))) {
          runCmd = 'pnpm run';
        } else if (fs.existsSync(path.join(currentDir, 'bun.lockb'))) {
          runCmd = 'bun run';
        }
        
        execSync(`${runCmd} claude:hooks`, { stdio: 'inherit', cwd: currentDir });
      }
      console.log('\n✅ Hooks have been set up successfully!');
      console.log(`\n📁 Hook file created at: ${path.relative(currentDir, hookFilePath)}`);
      console.log('📝 You can customize your hooks by editing this file.');
      console.log('🔄 Run "claude:hooks" after making changes to update the settings.');
    } catch (error) {
      console.error('\n❌ Failed to run hooks setup. Please run manually:');
      console.error('   npm run claude:hooks');
    }
  } else {
    console.log('\n⚠️  No package.json found. Please create one or run in a Node.js project.');
    console.log('\nTo complete setup manually:');
    console.log(`1. Install the package: npm install -D ${packageName}`);
    console.log('2. Add to package.json scripts: "claude:hooks": "define-claude-code-hooks"');
    console.log('3. Run: npm run claude:hooks');
  }
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}