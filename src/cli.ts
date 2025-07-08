#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HookSettings, HookDefinition, HookType } from './types';
import * as ts from 'typescript';

const HOOK_FILES = {
  project: '.claude/hooks/hooks.ts',
  local: '.claude/hooks/hooks.local.ts',
  user: '.claude/hooks/hooks.user.ts'
} as const;

const COMPILED_HOOK_FILES = {
  project: '.hooks/hooks.js',
  local: '.hooks/hooks.local.js',
  user: '.hooks/hooks.user.js'
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

async function compileHookFile(tsPath: string, jsPath: string, location: 'project' | 'local' | 'user'): Promise<boolean> {
  try {
    // Read the TypeScript file
    let sourceCode = fs.readFileSync(tsPath, 'utf-8');
    
    // For development: replace imports from the package name to relative paths
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    const packageName = packageJson.name;
    
    // Check if we're in the package's own repository
    const isOwnRepo = fs.existsSync(path.join(process.cwd(), 'src', 'index.ts')) && 
                      fs.existsSync(path.join(process.cwd(), 'package.json'));
    
    if (isOwnRepo) {
      // Replace package imports with relative imports to dist
      sourceCode = sourceCode.replace(
        new RegExp(`from\s+['"]${packageName}['"]`, 'g'),
        `from '${path.relative(path.dirname(jsPath), path.join(process.cwd(), 'dist', 'index'))}'`
      );
      
      // Also handle relative imports like "../.." that point to the package root
      sourceCode = sourceCode.replace(
        /from\s+['"]\.\.\/(\.\.)?['"](?!\w)/g,
        `from '${path.relative(path.dirname(jsPath), path.join(process.cwd(), 'dist', 'index'))}'`
      );
    }
    
    // Compile TypeScript to JavaScript
    const result = ts.transpileModule(sourceCode, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        resolveJsonModule: true,
        skipLibCheck: true
      }
    });
    
    // If we're in the package's own repository, fix the require paths in the compiled output
    let outputText = result.outputText;
    if (isOwnRepo) {
      const relativePath = path.relative(path.dirname(jsPath), path.join(process.cwd(), 'dist', 'index')).replace(/\\/g, '/');
      // Replace the compiled require statement - handle both direct and renamed imports
      const packageNameEscaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`require\\(["']${packageNameEscaped}["']\\)`, 'g');
      outputText = outputText.replace(
        regex,
        `require('${relativePath}')`
      );
      
      // Also try without escaping the parentheses
      outputText = outputText.replace(
        new RegExp(`require\(["']${packageName}["']\)`, 'g'),
        `require('${relativePath}')`
      );
      
      // Handle relative requires like require("../..") that point to the package root
      outputText = outputText.replace(
        /require\(["']\.\.\/(\.\.)?["']\)/g,
        `require('${relativePath}')`
      );
    }
    
    // Ensure .hooks directory exists
    const jsDir = path.dirname(jsPath);
    if (!fs.existsSync(jsDir)) {
      fs.mkdirSync(jsDir, { recursive: true });
    }
    
    // Write the compiled JavaScript
    fs.writeFileSync(jsPath, outputText);
    return true;
  } catch (error) {
    console.error(`Failed to compile ${tsPath}:`, error);
    return false;
  }
}

async function updateHooks(options: CliOptions) {
  const { execSync } = require('child_process');
  let updatedAny = false;

  // Check for each type of hook file
  for (const [type, fileName] of Object.entries(HOOK_FILES)) {
    const hookFilePath = path.resolve(process.cwd(), fileName);
    const compiledHookPath = path.resolve(process.cwd(), COMPILED_HOOK_FILES[type as keyof typeof COMPILED_HOOK_FILES]);
    
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
    
    if (fs.existsSync(hookFilePath)) {
      console.log(`Found ${fileName}`);
      
      // Compile the TypeScript file
      console.log(`Compiling ${fileName} to ${COMPILED_HOOK_FILES[type as keyof typeof COMPILED_HOOK_FILES]}...`);
      const compiled = await compileHookFile(hookFilePath, compiledHookPath, type as 'project' | 'local' | 'user');
      
      if (!compiled) {
        console.error(`Failed to compile ${fileName}`);
        continue;
      }
      
      // Get hook information by running the compiled hooks file
      let hookInfo: any;
      
      // Check if the compiled file exists before trying to run it
      if (!fs.existsSync(compiledHookPath)) {
        console.error(`Error: Compiled hook file not found at ${compiledHookPath}`);
        console.error('The compilation step may have failed. Please check for TypeScript errors.');
        continue;
      }
      
      try {
        const output = execSync(
          `node "${compiledHookPath}" __generate_settings`,
          { encoding: 'utf-8' }
        );
        
        hookInfo = JSON.parse(output);
      } catch (error) {
        console.error(`Failed to load hooks from ${fileName}: ${error}`);
        continue;
      }

      await updateSettingsFile(
        settingsPath,
        compiledHookPath,
        hookInfo,
        type as 'project' | 'local' | 'user'
      );
      updatedAny = true;
    } else {
      // Hook file doesn't exist - remove managed hooks from settings if settings file exists
      if (fs.existsSync(settingsPath)) {
        console.log(`No ${fileName} found, cleaning up managed hooks from ${settingsPath}`);
        await removeFromSettingsFile(settingsPath, type as 'project' | 'local' | 'user');
      }
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
  compiledHookPath: string,
  hookInfo: any,
  location: 'project' | 'local' | 'user'
) {
  // Use absolute path for user settings, relative for project/local
  const commandPath = location === 'user' 
    ? compiledHookPath 
    : `./${COMPILED_HOOK_FILES[location]}`;
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
            command: `test -f "${commandPath}" && node "${commandPath}" __run_hook ${hookType} "${entry.matcher}" "${entry.index}" || (>&2 echo "Error: Hook script not found at ${commandPath}" && >&2 echo "Please run: npx define-claude-code-hooks" && exit 1) # ${marker}`
          }]
        });
      } else {
        // For non-tool hooks, one entry total
        settings.hooks[typedHookType]!.push({
          hooks: [{
            type: 'command',
            command: `test -f "${commandPath}" && node "${commandPath}" __run_hook ${hookType} || (>&2 echo "Error: Hook script not found at ${commandPath}" && >&2 echo "Please run: npx define-claude-code-hooks" && exit 1) # ${marker}`
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

// Run CLI if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}