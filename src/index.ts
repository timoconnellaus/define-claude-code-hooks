#!/usr/bin/env node

import { HookType, HookHandler, HookTypeMap, ExitCode, HookDefinition, AnyHookDefinition } from './types';

export * from './types';
export { logStopEvents, logSubagentStopEvents } from './hooks/logStopEvents';
export { logNotificationEvents } from './hooks/logNotificationEvents';
export { 
  logPreToolUseEvents, 
  logPostToolUseEvents
} from './hooks/logToolUseEvents';

/**
 * Define a typed hook handler for Claude Code
 * @param type The type of hook (PreToolUse, PostToolUse, etc.)
 * @param definition The hook definition (with matcher for tool hooks, or just handler for others)
 * @returns A hook definition object
 */
export function defineHook<T extends HookType>(
  type: T,
  definition: AnyHookDefinition<T>
): AnyHookDefinition<T> {
  return definition;
}

/**
 * Define multiple hooks with matchers
 * @param hooks Object mapping hook types to matchers and handlers
 * @returns Object with all hook definitions
 */
export function defineHooks(hooks: HookDefinition): HookDefinition {
  // Check if we're being run as a CLI
  if (require.main === module.parent) {
    const [, , mode, ...args] = process.argv;
    
    if (mode === '__generate_settings') {
      // Generate settings mode
      const settings: any = {};
      
      // Process each hook type
      for (const [hookType, handlers] of Object.entries(hooks)) {
        if (!handlers || handlers.length === 0) continue;
        
        settings[hookType] = [];
        
        if (hookType === 'PreToolUse' || hookType === 'PostToolUse') {
          // For tool hooks, create one entry per matcher
          for (const handler of handlers as any[]) {
            if (handler && typeof handler === 'object' && 'matcher' in handler) {
              settings[hookType].push({
                matcher: handler.matcher,
                handler: hookType,
                index: handlers.indexOf(handler)
              });
            }
          }
        } else {
          // For non-tool hooks, create one entry
          settings[hookType].push({
            handler: hookType,
            count: handlers.length
          });
        }
      }
      
      // Output as JSON
      console.log(JSON.stringify(settings));
      process.exit(0);
    } else if (mode === '__run_hook') {
      // Run hook mode
      const [hookType, matcher, index] = args;
      runHookHandler(hooks, hookType as HookType, matcher, index);
    }
  }
  
  return hooks;
}

async function runHookHandler(hooks: HookDefinition, hookType: HookType, matcher?: string, index?: string) {
  try {
    // Read JSON input from stdin
    const inputData = await readStdin();
    
    let input: any;
    try {
      input = JSON.parse(inputData);
    } catch (error) {
      console.error('Error: Invalid JSON input:', error);
      process.exit(ExitCode.ERROR);
    }

    // Validate hook type matches
    if (input.hook_event_name !== hookType) {
      console.error(`Error: Expected ${hookType} hook, got ${input.hook_event_name}`);
      process.exit(ExitCode.ERROR);
    }

    // Get handlers for this hook type
    const hookHandlers = hooks[hookType];
    if (!hookHandlers || !Array.isArray(hookHandlers) || hookHandlers.length === 0) {
      // No handlers, exit silently
      process.exit(ExitCode.SUCCESS);
    }

    // Execute appropriate handler(s)
    const results: any[] = [];
    
    if ((hookType === 'PreToolUse' || hookType === 'PostToolUse') && matcher && index) {
      if ('tool_name' in input) {
        // Check if the tool matches the specified matcher
        const regex = new RegExp(matcher);
        if (regex.test(input.tool_name) || input.tool_name === matcher) {
          // Execute the specific handler at the given index
          const hookDef = hookHandlers[parseInt(index)];
          if (hookDef && typeof hookDef === 'object' && 'handler' in hookDef) {
            const result = await hookDef.handler(input);
            if (result) results.push(result);
          }
        }
      }
    } else if (hookType !== 'PreToolUse' && hookType !== 'PostToolUse') {
      // For non-tool hooks, execute all handlers
      for (const handler of hookHandlers) {
        if (typeof handler === 'function') {
          const result = await handler(input);
          if (result) results.push(result);
        }
      }
    }

    // Handle the results
    let finalResult: any = null;
    
    for (const result of results) {
      if (result && typeof result === 'object') {
        // If any handler blocks, that takes precedence
        if ('decision' in result && result.decision === 'block') {
          finalResult = result;
          break;
        }
        // If no blocking decision yet, use this result
        if (!finalResult) {
          finalResult = result;
        }
      }
    }

    // Output the result
    if (finalResult && typeof finalResult === 'object') {
      console.log(JSON.stringify(finalResult));
      
      if ('decision' in finalResult && finalResult.decision === 'block') {
        if ('reason' in finalResult && finalResult.reason && shouldOutputToStderr(hookType)) {
          console.error(finalResult.reason);
          process.exit(ExitCode.BLOCKING_ERROR);
        }
      }
      
      if (finalResult.continue === false) {
        process.exit(ExitCode.SUCCESS);
      }
    }

    process.exit(ExitCode.SUCCESS);
  } catch (error) {
    console.error('Hook execution error:', error);
    process.exit(ExitCode.ERROR);
  }
}

/**
 * Helper to determine if stderr should be used for blocking feedback
 */
function shouldOutputToStderr(type: HookType): boolean {
  return type === 'PreToolUse' || type === 'PostToolUse' || type === 'Stop' || type === 'SubagentStop';
}

/**
 * Read all stdin input
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

