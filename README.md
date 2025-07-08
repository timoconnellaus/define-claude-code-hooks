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

Add this script to your `package.json` to easily update your hooks:

```json
{
  "scripts": {
    "claude:hooks": "define-claude-code-hooks"
  }
}
```

### 3. Create a simple hook

You can create hooks in three different files within `.claude/hooks/`:

- `hooks.ts` - Project hooks (updates `.claude/settings.json`)
- `hooks.local.ts` - Local hooks (updates `.claude/settings.local.json`)
- `hooks.user.ts` - User hooks (updates `~/.claude/settings.json`)

For example, create `.claude/hooks/hooks.ts`:

```typescript
import { defineHooks } from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  PreToolUse: [
    // Prevent editing .env files
    {
      matcher: "Write|Edit|MultiEdit",
      handler: async (input) => {
        const filePath = input.tool_input.file_path;
        if (filePath && filePath.endsWith(".env")) {
          return {
            decision: "block",
            reason:
              "Direct editing of .env files is not allowed for security reasons",
          };
        }
      },
    },
  ],
});
```

### 4. Add a predefined hook

Extend your hooks with built-in logging utilities:

```typescript
import {
  defineHooks,
  logPreToolUseEvents,
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  PreToolUse: [logPreToolUseEvents({ maxEventsStored: 100 })],
});
```

Creates a log file in your project root: hook-log.tool-use.json

### 5. Activate your hooks

Run the script to update your settings:

```bash
npm run claude:hooks
```

The CLI will automatically detect which hook files exist and update the corresponding settings files. Your hooks are now active! Claude Code will respect your rules and log tool usage.

## Full Usage Guide

### 1. Create a hook file

Choose where to create your hooks based on your needs (all in `.claude/hooks/`):

- `hooks.ts` - Project-wide hooks (committed to git)
- `hooks.local.ts` - Local-only hooks (not committed)
- `hooks.user.ts` - User-specific hooks (updates ~/.claude/settings.json)

Example:

```typescript
import { defineHooks } from "define-claude-code-hooks";

export default defineHooks({
  PreToolUse: [
    // Block grep commands and suggest ripgrep
    {
      matcher: "Bash",
      handler: async (input) => {
        if (input.tool_input.command?.includes("grep")) {
          return {
            decision: "block",
            reason: "Use ripgrep (rg) instead of grep for better performance",
          };
        }
      },
    },

    // Log all file writes
    {
      matcher: "Write|Edit|MultiEdit",
      handler: async (input) => {
        console.error(`Writing to file: ${input.tool_input.file_path}`);
      },
    },
  ],

  PostToolUse: [
    // Format TypeScript files after editing
    {
      matcher: "Write|Edit",
      handler: async (input) => {
        if (input.tool_input.file_path?.endsWith(".ts")) {
          const { execSync } = require("child_process");
          execSync(`prettier --write "${input.tool_input.file_path}"`);
        }
      },
    },
  ],

  Notification: [
    // Custom notification handler
    async (input) => {
      console.log(`Claude says: ${input.message}`);
    },
  ],
});
```

### 2. Update your Claude Code settings:

```bash
# Automatically detect and update all hook files
npx define-claude-code-hooks

# Remove all managed hooks
npx define-claude-code-hooks --remove
```

The CLI automatically detects which hook files exist and updates the corresponding settings:

- `hooks.ts` → `.claude/settings.json` (project settings, relative paths)
- `hooks.local.ts` → `.claude/settings.local.json` (local settings, relative paths)
- `hooks.user.ts` → `~/.claude/settings.json` (user settings, absolute paths)

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
const bashHook = defineHook("PreToolUse", {
  matcher: "Bash",
  handler: async (input) => {
    /* ... */
  },
});

// Non-tool hook
const stopHook = defineHook("Stop", async (input) => {
  /* ... */
});
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
  continue?: boolean; // Whether Claude should continue
  stopReason?: string; // Message when continue is false
  suppressOutput?: boolean; // Hide output from transcript

  // PreToolUse specific
  decision?: "approve" | "block";
  reason?: string; // Reason for decision
}
```

## How It Works

1. The CLI scans for hook files (hooks.ts, hooks.local.ts, hooks.user.ts)
2. For each file found, it updates the corresponding settings.json with commands that use ts-node to execute TypeScript directly
3. Marks managed hooks so they can be safely removed later

## TypeScript Support

This library is written in TypeScript and provides full type safety for all hook inputs and outputs.

## Predefined Hook Utilities

The library includes several predefined hook utilities for common logging scenarios:

### Stop Event Logging

```typescript
import {
  defineHooks,
  logStopEvents,
  logSubagentStopEvents,
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  Stop: [logStopEvents("hook-log.stop.json")],
  SubagentStop: [logSubagentStopEvents("hook-log.subagent.json")],
});
```

### Notification Logging

```typescript
import {
  defineHooks,
  logNotificationEvents,
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  Notification: [logNotificationEvents("hook-log.notifications.json")],
});
```

### Tool Use Logging

```typescript
import {
  defineHooks,
  logPreToolUseEvents,
  logPostToolUseEvents,
  logPreToolUseEventsForTools,
  logPostToolUseEventsForTools,
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  // Log all tool use
  PreToolUse: [
    {
      matcher: ".*", // Matches all tools
      handler: logPreToolUseEvents("hook-log.tool-use.json"),
    },
  ],

  PostToolUse: [
    {
      matcher: ".*", // Matches all tools
      handler: logPostToolUseEvents("hook-log.tool-use.json"),
    },
  ],
});

// Or log specific tools only
export default defineHooks({
  PreToolUse: logPreToolUseEventsForTools(
    ["Bash", "Write", "Edit"],
    "hook-log.tool-use.json"
  ),
  PostToolUse: logPostToolUseEventsForTools(
    ["Bash", "Write", "Edit"],
    "hook-log.tool-use.json"
  ),
});
```

### Combining Multiple Hooks

```typescript
import {
  defineHooks,
  logStopEvents,
  logPreToolUseEventsForTools,
  logPostToolUseEventsForTools,
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  PreToolUse: [
    ...logPreToolUseEventsForTools([".*"], "hook-log.tool-use.json"),
    // Add your custom hooks here
    {
      matcher: "Bash",
      handler: async (input) => {
        // Custom logic
      },
    },
  ],

  PostToolUse: logPostToolUseEventsForTools([".*"], "hook-log.tool-use.json"),

  Stop: [logStopEvents("hook-log.stop.json")],
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
