# define-claude-code-hooks

Type-safe hook definitions for Claude Code with automatic settings management.

## Installation

```bash
npm install @timoaus/define-claude-code-hooks
```

## Usage

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

# Update user settings (~/.claude/settings.json)
npx define-claude-code-hooks --user

# Update both
npx define-claude-code-hooks --project --user

# Remove managed hooks
npx define-claude-code-hooks --remove
```

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