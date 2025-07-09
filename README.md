# define-claude-code-hooks

Type-safe hook definitions for Claude Code with automatic settings management.

## Quick Start

### Option 1: Use the Interactive Init Command (Recommended)

```bash
npx @timoaus/define-claude-code-hooks --init
```

This interactive command will:
- Let you choose between project or local hooks
- Install predefined hooks (logging, security, announcements)
- Install the package as a dev dependency
- Add the `claude:hooks` script to your package.json
- Set up your hooks automatically

### Option 2: Manual Setup

#### 1. Install the package

```bash
npm install --save-dev @timoaus/define-claude-code-hooks
# or
yarn add --dev @timoaus/define-claude-code-hooks
# or
pnpm add --save-dev @timoaus/define-claude-code-hooks
# or
bun add --dev @timoaus/define-claude-code-hooks
```

#### 2. Add a package.json script

Add this script to your `package.json` to easily update your hooks:

```json
{
  "scripts": {
    "claude:hooks": "define-claude-code-hooks"
  }
}
```

#### 3. Create a simple hook

You can create hooks in two different files within `.claude/hooks/`:

- `hooks.ts` - Project hooks (updates `.claude/settings.json`)
- `hooks.local.ts` - Local hooks (updates `.claude/settings.local.json`)

For example, create `.claude/hooks/hooks.ts`:

```typescript
import { defineHooks } from "@timoaus/define-claude-code-hooks";

const preventEditingEnvFile = defineHook("PreToolUse", {
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
});

export default defineHooks({
  PreToolUse: [preventEditingEnvFile],
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

## Predefined Hooks

The library includes several predefined hook utilities for common logging scenarios:


| Hook Function | Options |
|--------------|---------|
| **`logPreToolUseEvents`**<br/>Logs tool uses before execution | • Optional first param: `matcher` (regex pattern, defaults to '.*' for all tools)<br/>• `maxEventsStored` (default: 100)<br/>• `logFileName` (default: 'hook-log.tool-use.json')<br/>• `includeToolInput` (default: true) |
| **`logPostToolUseEvents`**<br/>Logs tool uses after execution | • Optional first param: `matcher` (regex pattern, defaults to '.*' for all tools)<br/>• `maxEventsStored` (default: 100)<br/>• `logFileName` (default: 'hook-log.tool-use.json')<br/>• `includeToolInput` (default: true)<br/>• `includeToolResponse` (default: true) |
| **`logStopEvents`**<br/>Logs main agent stop events | • `maxEventsStored` (default: 100)<br/>• `logFileName` (default: 'hook-log.stop.json') |
| **`logSubagentStopEvents`**<br/>Logs subagent stop events | • `maxEventsStored` (default: 100)<br/>• `logFileName` (default: 'hook-log.stop.json') |
| **`logNotificationEvents`**<br/>Logs notification messages | • `maxEventsStored` (default: 100)<br/>• `logFileName` (default: 'hook-log.notification.json') |
| **`blockEnvFiles`**<br/>Blocks access to .env files | No options - blocks all .env file variants except example files |
| **`announceStop`**<br/>Announces task completion via TTS | • `message` (default: 'Task completed')<br/>• `voice` (system-specific voice name)<br/>• `rate` (speech rate in WPM)<br/>• `customCommand` (custom TTS command)<br/>• `suppressOutput` (default: false) |
| **`announceSubagentStop`**<br/>Announces subagent completion via TTS | Same options as `announceStop` |
| **`announcePreToolUse`**<br/>Announces before tool execution | • First param: `matcher` (regex pattern, defaults to '.*')<br/>• `message` (default: 'Using {toolName}')<br/>• `voice`, `rate`, `customCommand`, `suppressOutput` |
| **`announcePostToolUse`**<br/>Announces after tool execution | • First param: `matcher` (regex pattern, defaults to '.*')<br/>• `message` (default: '{toolName} completed')<br/>• `voice`, `rate`, `customCommand`, `suppressOutput` |
| **`announceNotification`**<br/>Speaks notification messages | • `message` (default: '{message}')<br/>• `voice`, `rate`, `customCommand`, `suppressOutput` |

All predefined hooks:

- Create JSON log files in your current working directory
- Automatically rotate logs when reaching `maxEventsStored` limit (keeping most recent events)
- Include timestamps, session IDs, and transcript paths in log entries
- Handle errors gracefully without interrupting Claude Code

Example usage:

```typescript
import {
  defineHooks,
  logPreToolUseEvents,
  logStopEvents,
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  PreToolUse: [
    logPreToolUseEvents({ maxEventsStored: 200, logFileName: "my-tools.json" }),
  ],
  Stop: [logStopEvents()],
});
```

## Full Usage Guide

### 1. Create a hook file

Choose where to create your hooks based on your needs (all in `.claude/hooks/`):

- `hooks.ts` - Project-wide hooks (committed to git)
- `hooks.local.ts` - Local-only hooks (not committed)

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

# Use a custom global settings path (if not in ~/.claude/settings.json)
npx define-claude-code-hooks --global-settings-path /path/to/settings.json
```

The CLI automatically detects which hook files exist and updates the corresponding settings:

- `hooks.ts` → `.claude/settings.json` (project settings, relative paths)
- `hooks.local.ts` → `.claude/settings.local.json` (local settings, relative paths)


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

1. The CLI scans for hook files (hooks.ts, hooks.local.ts)
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
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  // Log all tool use
  PreToolUse: logPreToolUseEvents(), // Logs all tools by default
  PostToolUse: logPostToolUseEvents(), // Logs all tools by default
});

// Or log specific tools only
export default defineHooks({
  PreToolUse: logPreToolUseEvents("Bash|Write|Edit", {
    maxEventsStored: 200,
    logFileName: "tool-use.json",
  }),
  PostToolUse: logPostToolUseEvents("Bash|Write|Edit", {
    maxEventsStored: 200,
    logFileName: "tool-use.json",
  }),
});
```

### Environment File Protection

```typescript
import {
  defineHooks,
  blockEnvFiles,
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  PreToolUse: [
    blockEnvFiles, // Blocks access to .env files while allowing .env.example
  ],
});
```

The `blockEnvFiles` hook:
- Blocks reading or writing to `.env` files and variants (`.env.local`, `.env.production`, etc.)
- Allows access to example env files (`.env.example`, `.env.sample`, `.env.template`, `.env.dist`)
- Works with `Read`, `Write`, `Edit`, and `MultiEdit` tools
- Provides clear error messages when access is blocked

### Text-to-Speech Announcements

```typescript
import {
  defineHooks,
  announceStop,
  announceSubagentStop,
  announcePreToolUse,
  announcePostToolUse,
  announceNotification,
} from "@timoaus/define-claude-code-hooks";

// Basic usage - announce all events
export default defineHooks({
  Stop: [announceStop()],
  SubagentStop: [announceSubagentStop()],
  PreToolUse: [announcePreToolUse()], // Announces all tools
  PostToolUse: [announcePostToolUse()], // Announces all tools
  Notification: [announceNotification()],
});

// Announce specific tools only
export default defineHooks({
  PreToolUse: [
    announcePreToolUse('Bash|Write|Edit', {
      message: "Running {toolName}"
    })
  ],
  PostToolUse: [
    announcePostToolUse('Bash|Write|Edit', {
      message: "{toolName} finished"
    })
  ],
});

// With custom voices and messages
export default defineHooks({
  Stop: [
    announceStop({
      message: "Claude has finished the task for session {sessionId}",
      voice: "Samantha", // macOS voice
      rate: 200,
    })
  ],
  Notification: [
    announceNotification({
      message: "Claude says: {message}",
      voice: "Daniel"
    })
  ],
});

// With custom TTS command (for Linux/Windows)
export default defineHooks({
  Stop: [
    announceStop({
      customCommand: "espeak -s 150 '{message}'", // Linux
      // or for Windows PowerShell:
      // customCommand: "powershell -Command \"(New-Object -ComObject SAPI.SpVoice).Speak('{message}')\""
    })
  ],
});
```

The announcement hooks:
- Use text-to-speech to announce various Claude Code events
- Support macOS (say), Linux (espeak), and Windows (PowerShell SAPI)
- Allow custom messages with template variables:
  - `{sessionId}` - The session ID
  - `{timestamp}` - Current timestamp  
  - `{toolName}` - Tool name (for PreToolUse/PostToolUse)
  - `{message}` - Notification message (for Notification hook)
- Support voice selection and speech rate customization
- Can use custom TTS commands for other systems
- Run asynchronously without blocking Claude Code

### Combining Multiple Hooks

```typescript
import {
  defineHooks,
  logStopEvents,
  logPreToolUseEvents,
  logPostToolUseEvents,
  blockEnvFiles,
  announceStop,
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  PreToolUse: [
    blockEnvFiles, // Security: prevent .env file access
    logPreToolUseEvents({ logFileName: "hook-log.tool-use.json" }),
    // Add your custom hooks here
    {
      matcher: "Bash",
      handler: async (input) => {
        // Custom logic
      },
    },
  ],

  PostToolUse: logPostToolUseEvents({ logFileName: "hook-log.tool-use.json" }),

  Stop: [
    logStopEvents("hook-log.stop.json"),
    announceStop({ message: "Task completed successfully!" }),
  ],
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
