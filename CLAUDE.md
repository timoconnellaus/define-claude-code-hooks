# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library that provides type-safe hook definitions for Claude Code with automatic settings management. It allows users to define hooks that run at various points in Claude Code's lifecycle without manually editing settings.json files.

## Build Commands

```bash
# Build the TypeScript project
bun run build

# Watch mode for development
bun run dev

# Install dependencies
bun install
```

## Architecture

### Key Concepts

1. **Self-Executing Hooks**: The hooks.ts file acts as both the hook definition and the runner. When `defineHooks` is called, it checks if it's being run as a CLI and handles two modes:
   - `__generate_settings`: Outputs JSON information about defined hooks
   - `__run_hook`: Executes the appropriate hook handler

2. **No Separate Runner**: Unlike traditional approaches, there's no separate runner.js. The hooks file itself is executed directly by the generated commands in settings.json.

3. **Smart Settings Generation**: The CLI only creates settings entries for hooks that are actually defined:
   - For PreToolUse/PostToolUse: One entry per matcher
   - For other hooks (Stop, Notification, SubagentStop): One entry only if handlers exist

### Core Components

- **src/index.ts**: Exports `defineHooks` and `defineHook` functions. Contains the self-execution logic that makes hooks files act as their own runners.

- **src/cli.ts**: The CLI that updates settings.json files. It executes the hooks file with `__generate_settings` to discover what hooks are defined, then generates appropriate commands.

- **src/types.ts**: TypeScript type definitions for all hook types, inputs, and outputs. Key distinction between tool hooks (PreToolUse/PostToolUse) that have matchers and non-tool hooks.

### Hook Definition Structure

Tool hooks (PreToolUse/PostToolUse):
```typescript
{
  matcher: string,  // Regex pattern for tool names
  handler: async (input) => { /* ... */ }
}
```

Non-tool hooks (Stop, Notification, SubagentStop):
```typescript
async (input) => { /* ... */ }
```

### Settings.json Generation

The CLI removes all hooks marked with `__managed_by_define_claude_code_hooks__` and regenerates them based on what's defined in the hooks file. This ensures clean updates without parsing TypeScript.

## Development Notes

- The project uses Bun for package management and running scripts
- TypeScript compilation outputs to the `dist/` directory
- The CLI binary is defined in package.json as `define-claude-code-hooks`
- Hook files must be located at `.claude/hooks/hooks.ts`