---
description: Create a new default hook export for the repository
---

# Create a New Default Hook

I'll help you create a new default hook that can be exported from this repository and used in `.claude/hooks/hooks.ts` files.

## Hook Requirements

$ARGUMENTS

## Understanding Hook Structure

Based on the codebase analysis, here's how to create a new default hook:

### 1. Hook Types

There are two categories of hooks:

**Tool Hooks** (PreToolUse, PostToolUse):
- Require a `matcher` (regex pattern for tool names)
- Have a `handler` function
- Can match multiple tools with patterns like `"Write|Edit|MultiEdit"`

**Non-Tool Hooks** (Notification, Stop, SubagentStop):
- Only have a handler function
- No matcher required

### 2. Hook Input Types

Each hook type receives specific input:

```typescript
// PreToolUse
{
  hook_event_name: 'PreToolUse',
  tool_name: string,
  tool_input: Record<string, any>,
  session_id: string,
  transcript_path: string
}

// PostToolUse (same as PreToolUse plus)
{
  tool_response: Record<string, any>
}

// Notification
{
  hook_event_name: 'Notification',
  message: string,
  session_id: string,
  transcript_path: string
}

// Stop/SubagentStop
{
  hook_event_name: 'Stop' | 'SubagentStop',
  stop_hook_active: boolean,
  session_id: string,
  transcript_path: string
}
```

### 3. Hook Output Types

Hooks can return structured responses:

```typescript
// PreToolUse can return:
{
  decision?: 'approve' | 'block',
  reason?: string,
  continue?: boolean,
  stopReason?: string,
  suppressOutput?: boolean
}

// PostToolUse can return:
{
  decision?: 'block',
  reason?: string,
  continue?: boolean,
  stopReason?: string,
  suppressOutput?: boolean
}

// Other hooks can return:
{
  continue?: boolean,
  stopReason?: string,
  suppressOutput?: boolean
}
```

### 4. Creating a Default Hook

To create a new default hook:

1. Create a new file in the `src/hooks/` directory (e.g., `src/hooks/myHook.ts`)
2. Export a hook definition using the `defineHook` function
3. Add the export to `src/index.ts`

#### Important Implementation Guidelines:

**Always import types from types.ts:**
- Import specific input types like `PreToolUseInput`, `StopInput`, etc.
- Never manually define types that already exist in `types.ts`
- Use the imported types for proper type safety

**Hook file structure:**
```typescript
// src/hooks/blockDangerousCommands.ts
import { defineHook } from '../index';
import { PreToolUseInput } from '../types';  // Import proper types!

export const blockDangerousCommands = defineHook('PreToolUse', {
  matcher: 'Bash',
  handler: async (input: PreToolUseInput) => {  // Use the imported type
    const command = input.tool_input.command;
    const dangerous = ['rm -rf /', 'dd if=/dev/zero', ':(){:|:&};:'];
    
    if (dangerous.some(cmd => command?.includes(cmd))) {
      return {
        decision: 'block',
        reason: `Dangerous command detected: ${command}`
      };
    }
  }
});

// Then in src/index.ts, add:
export { blockDangerousCommands } from './hooks/blockDangerousCommands';
```

**For hooks that handle multiple related events:**
- You may need to create separate hook definitions (e.g., `logStopEvents` and `logSubagentStopEvents`)
- Each hook type has its own specific input type
- Share common logic between related hooks when appropriate

### 5. Using the Hook

Users can then import and use the hook:

```typescript
// .claude/hooks/hooks.ts
import { defineHooks, blockDangerousCommands } from 'define-claude-code-hooks';

export default defineHooks({
  PreToolUse: [
    blockDangerousCommands,
    // other hooks...
  ]
});
```

### 6. Common Patterns and Best Practices

**File I/O in hooks:**
- Use `process.cwd()` to get the current working directory for file paths
- Always handle errors gracefully (file not found, parse errors, etc.)
- Consider using try-catch blocks for file operations
- For JSON files, handle both empty/non-existent files and existing data
- Implement log rotation/size limits to prevent unbounded file growth

**Type inference:**
- Use `typeof` for inferring types from values (e.g., `typeof logEntry[]`)
- This keeps your types in sync with your actual data structures

**Factory pattern for configurable hooks:**
- Create factory functions that accept options and return hook definitions
- This allows users to customize behavior without modifying the hook code
- Example: `logStopEvents({ maxEventsStored: 100 })`
- Return type should be `AnyHookDefinition<HookType>` for proper typing
- Use default parameters or nullish coalescing (`??`) for option defaults

**Hook return types:**
- Import `AnyHookDefinition` from types for factory function return types
- This ensures proper type checking when the hook is used in `defineHooks`
- Example: `export const myHook = (options): AnyHookDefinition<'Stop'> => ...`

**Testing hooks:**
- Create standalone test files that import and call your hooks directly
- For factory functions, test the returned hook definition directly
- Non-tool hooks (Stop, Notification, SubagentStop) are functions themselves
- Test with realistic input data matching the actual hook input types
- Verify output files or side effects as expected
- Clean up test artifacts after running
- Test edge cases like file size limits and error conditions

### 7. Advanced Hook Patterns

**Tool hooks with matchers:**
- Tool hooks (PreToolUse, PostToolUse) require both `matcher` and `handler`
- Use `.*` as matcher to match all tools
- Use pipe syntax for multiple tools: `"Bash|Write|Edit"`
- The matcher is a regex pattern, so complex patterns are supported
- Consider creating both generic (all tools) and specific variants

**Configurable data inclusion:**
- Add options to control what data is logged/processed
- Example: `includeToolInput`, `includeToolResponse` options
- Helps with sensitive data, performance, and log size
- Use object spread with conditional inclusion: `...(condition && { field: value })`

**Consistent option interfaces:**
- Keep option names consistent across similar hooks
- Common options: `maxEventsStored`, `logFileName`
- Document all options with JSDoc comments
- Provide sensible defaults for all options

**Multiple hook variants:**
- Consider creating both generic and specific versions
- Example: `logPreToolUseEvents()` for all tools
- Example: `logPreToolUseEventsForTools('Bash')` for specific tools
- This gives users flexibility without code duplication

**File organization:**
- Group related hooks in the same file
- Example: All tool logging in `logToolUseEvents.ts`
- Export multiple related functions from one file
- Keep consistent naming patterns

**Testing considerations:**
- Tool hooks have a `handler` property that contains the actual function
- Non-tool hooks ARE the function themselves
- Always check the hook structure before calling
- Test with realistic hook inputs matching actual Claude Code events

## Let me create the hook for you

Based on your requirements, I'll create the appropriate hook structure and implementation.