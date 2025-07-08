# define-claude-code-hooks

Type-safe hook definitions for Claude Code with automatic settings management.

## Quick Start

### 1. Install the package

```bash
npm install @timoaus/define-claude-code-hooks
# or
yarn add @timoaus/define-claude-code-hooks
# or
pnpm add @timoaus/define-claude-code-hooks
# or
bun add @timoaus/define-claude-code-hooks
```

### 2. Add a package.json script

Add this script to your `package.json` to easily update your local settings:

```json
{
  "scripts": {
    "claude:hooks": "define-claude-code-hooks --local"
  }
}
```

### 3. Create a simple hook

Create `.claude/hooks/hooks.ts`:

```typescript
import { defineHooks } from '@timoaus/define-claude-code-hooks';

export default defineHooks({
  PreToolUse: [
    // Prevent editing .env files
    {
      matcher: 'Write|Edit|MultiEdit',
      handler: async (input) => {
        const filePath = input.tool_input.file_path;
        if (filePath && filePath.endsWith('.env')) {
          return {
            decision: 'block',
            reason: 'Direct editing of .env files is not allowed for security reasons'
          };
        }
      }
    }
  ]
});
```

### 4. Add a predefined hook

Extend your hooks with built-in logging utilities:

```typescript
import { defineHooks, logPreToolUseEvents } from '@timoaus/define-claude-code-hooks';

export default defineHooks({
  PreToolUse: [
    // Prevent editing .env files
    {
      matcher: 'Write|Edit|MultiEdit',
      handler: async (input) => {
        const filePath = input.tool_input.file_path;
        if (filePath && filePath.endsWith('.env')) {
          return {
            decision: 'block',
            reason: 'Direct editing of .env files is not allowed for security reasons'
          };
        }
      }
    },
    // Log all tool usage
    logPreToolUseEvents({ maxEventsStored: 100 })
  ]
});
```

### 5. Activate your hooks

Run the script to update your local settings:

```bash
npm run claude:hooks
```

Your hooks are now active! Claude Code will respect your rules and log tool usage.

## Full Usage Guide

### 1. Create a `hooks.ts` file in `.claude/hooks/`:

```typescript
import { defineHooks } from 'define-claude-code-hooks';

export default defineHooks({
  PreToolUse: [
    // Block grep commands and suggest ripgrep
    {
      matcher: 'Bash',
      handler: async (input) => {
        if (input.tool_input.command?.includes('grep')) {
          return {
            decision: 'block',
            reason: 'Use ripgrep (rg) instead of grep for better performance'
          };
        }
      }
    },
    
    // Log all file writes
    {
      matcher: 'Write|Edit|MultiEdit',
      handler: async (input) => {
        console.error(`Writing to file: ${input.tool_input.file_path}`);
      }
    }
  ],
  
  PostToolUse: [
    // Format TypeScript files after editing
    {
      matcher: 'Write|Edit',
      handler: async (input) => {
        if (input.tool_input.file_path?.endsWith('.ts')) {
          const { execSync } = require('child_process');
          execSync(`prettier --write "${input.tool_input.file_path}"`);
        }
      }
    }
  ],
  
  Notification: [
    // Custom notification handler
    async (input) => {
      console.log(`Claude says: ${input.message}`);
    }
  ]
});
```

### 2. Update your Claude Code settings:

```bash
# Update project settings (.claude/settings.json)
npx define-claude-code-hooks

# Update local settings (.claude/settings.local.json)
npx define-claude-code-hooks --local

# Update user settings (~/.claude/settings.json)
npx define-claude-code-hooks --user

# Update multiple settings at once
npx define-claude-code-hooks --project --local --user

# Remove managed hooks
npx define-claude-code-hooks --remove
```

**Path behavior:**
- **Project settings** (`.claude/settings.json`) - Uses relative paths, can be committed to version control
- **Local settings** (`.claude/settings.local.json`) - Uses relative paths, typically git-ignored for user-specific overrides
- **User settings** (`~/.claude/settings.json`) - Uses absolute paths, works across all repositories

## API

### `defineHooks(hooks: HookDefinition)`

Define multiple hooks. Returns the hook definition object.
- For PreToolUse and PostToolUse: pass an array of objects with `matcher` and `handler`
- For other hooks: pass an array of handler functions

### `defineHook(type: HookType, definition)`

Define a single hook (for advanced use cases).
- For PreToolUse and PostToolUse: pass an object with `matcher` and `handler`
- For other hooks: pass just the handler function

Example:
```typescript
// Tool hook
const bashHook = defineHook('PreToolUse', {
  matcher: 'Bash',
  handler: async (input) => { /* ... */ }
});

// Non-tool hook
const stopHook = defineHook('Stop', async (input) => { /* ... */ });
```

### Hook Types

- `PreToolUse`: Runs before tool execution, can block or approve
- `PostToolUse`: Runs after tool execution
- `Notification`: Handles Claude Code notifications
- `Stop`: Runs when main agent stops
- `SubagentStop`: Runs when subagent stops

### Hook Outputs

Hooks can return structured responses:

```typescript
interface HookOutput {
  // Common fields
  continue?: boolean;      // Whether Claude should continue
  stopReason?: string;     // Message when continue is false
  suppressOutput?: boolean; // Hide output from transcript
  
  // PreToolUse specific
  decision?: 'approve' | 'block';
  reason?: string;         // Reason for decision
}
```

## How It Works

1. The CLI reads your `.claude/hooks/hooks.ts` file
2. Updates the Claude Code settings.json with commands that use ts-node to execute TypeScript directly
3. Marks managed hooks so they can be safely removed later

## TypeScript Support

This library is written in TypeScript and provides full type safety for all hook inputs and outputs.

## Predefined Hook Utilities

The library includes several predefined hook utilities for common logging scenarios:

### Stop Event Logging

```typescript
import { defineHooks, logStopEvents, logSubagentStopEvents } from '@timoaus/define-claude-code-hooks';

export default defineHooks({
  Stop: [logStopEvents('hook-log.stop.json')],
  SubagentStop: [logSubagentStopEvents('hook-log.subagent.json')]
});
```

### Notification Logging

```typescript
import { defineHooks, logNotificationEvents } from '@timoaus/define-claude-code-hooks';

export default defineHooks({
  Notification: [logNotificationEvents('hook-log.notifications.json')]
});
```

### Tool Use Logging

```typescript
import { 
  defineHooks, 
  logPreToolUseEvents, 
  logPostToolUseEvents,
  logPreToolUseEventsForTools,
  logPostToolUseEventsForTools 
} from '@timoaus/define-claude-code-hooks';

export default defineHooks({
  // Log all tool use
  PreToolUse: [
    {
      matcher: '.*',  // Matches all tools
      handler: logPreToolUseEvents('hook-log.tool-use.json')
    }
  ],
  
  PostToolUse: [
    {
      matcher: '.*',  // Matches all tools
      handler: logPostToolUseEvents('hook-log.tool-use.json')
    }
  ]
});

// Or log specific tools only
export default defineHooks({
  PreToolUse: logPreToolUseEventsForTools(['Bash', 'Write', 'Edit'], 'hook-log.tool-use.json'),
  PostToolUse: logPostToolUseEventsForTools(['Bash', 'Write', 'Edit'], 'hook-log.tool-use.json')
});
```

### Combining Multiple Hooks

```typescript
import { 
  defineHooks, 
  logStopEvents,
  logPreToolUseEventsForTools,
  logPostToolUseEventsForTools 
} from '@timoaus/define-claude-code-hooks';

export default defineHooks({
  PreToolUse: [
    ...logPreToolUseEventsForTools(['.*'], 'hook-log.tool-use.json'),
    // Add your custom hooks here
    {
      matcher: 'Bash',
      handler: async (input) => {
        // Custom logic
      }
    }
  ],
  
  PostToolUse: logPostToolUseEventsForTools(['.*'], 'hook-log.tool-use.json'),
  
  Stop: [logStopEvents('hook-log.stop.json')]
});
```

### Log File Format

The predefined hooks create JSON log files with the following structure:

```json
[
  {
    "timestamp": "2025-01-07T10:30:00.000Z",
    "event": "PreToolUse",
    "sessionId": "abc-123",
    "transcriptPath": "/path/to/transcript.jsonl",
    "toolName": "Bash",
    "toolInput": {
      "command": "ls -la"
    }
  }
]
```