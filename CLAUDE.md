# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library that provides type-safe hook definitions for Claude Code with automatic settings management. It allows users to define hooks that run at various points in Claude Code's lifecycle without manually editing settings.json files. Hook files are executed directly using ts-node without compilation.

## Development Commands

```bash
# Install dependencies
bun install

# Build the TypeScript project
bun run build

# Watch mode for development
bun run dev

# Run tests
bun run test:run

# Run tests with coverage
bun run test:coverage

# Type checking / linting
bun run typecheck
```

## Architecture

### Key Concepts

1. **Self-Executing Hooks**: Hook files act as both the hook definition and the runner. When `defineHooks` is called, it checks if it's being run as a CLI and handles two modes:
   - `__generate_settings`: Outputs JSON information about defined hooks
   - `__run_hook`: Executes the appropriate hook handler

2. **No Separate Runner**: Unlike traditional approaches, there's no separate runner.js. The hooks file itself is executed directly by the generated commands in settings.json using ts-node.

3. **Direct TypeScript Execution**: The CLI generates commands that use ts-node to execute TypeScript hooks directly:
   - No compilation step needed
   - TypeScript hooks are executed directly using ts-node
   - No intermediate JavaScript files are generated

4. **Smart Settings Generation**: The CLI only creates settings entries for hooks that are actually defined:
   - For PreToolUse/PostToolUse: One entry per matcher
   - For other hooks (Stop, Notification, SubagentStop): One entry only if handlers exist
   - Commands use `npx ts-node` to execute the TypeScript hooks directly

5. **Multiple Hook Files**: The system supports two different hook files, all located in `.claude/hooks/`:
   - `hooks.ts` - Project hooks (updates `.claude/settings.json`)
   - `hooks.local.ts` - Local hooks (updates `.claude/settings.local.json`)

### Core Components

- **src/index.ts**: Exports `defineHooks` and `defineHook` functions. Contains the self-execution logic that makes hooks files act as their own runners.

- **src/cli.ts**: The CLI that updates settings.json files to execute TypeScript hooks using ts-node. Includes an interactive `--init` command for project setup.

- **src/types.ts**: TypeScript type definitions for all hook types, inputs, and outputs. Key distinction between tool hooks (PreToolUse/PostToolUse) that have matchers and non-tool hooks.

- **src/hooks/**: Predefined hook utilities:
  - `logToolUseEvents.ts`: Logs PreToolUse and PostToolUse events to JSON files
  - `logStopEvents.ts`: Logs Stop and SubagentStop events
  - `logNotificationEvents.ts`: Logs notification events
  - `blockEnvFiles.ts`: Security hook that blocks access to .env files
  - `announceHooks.ts`: Text-to-speech announcements for various events

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
async (input) => {
  /* ... */
};
```

### Settings.json Generation

The CLI removes all hooks marked with `__managed_by_define_claude_code_hooks__` and regenerates them based on what's defined in the hooks file. Commands are generated in the format:

```json
{
  "command": "npx ts-node \"./.claude/hooks/hooks.ts\" __run_hook PreToolUse \"Bash\" \"0\" # __managed_by_define_claude_code_hooks__"
}
```

Commands use `npx ts-node` to execute the TypeScript files directly.

## Testing

The project uses Vitest for testing with comprehensive coverage:

```bash
# Run a single test file
bun run test src/hooks/__tests__/logToolUseEvents.test.ts

# Run tests in watch mode
bun run test

# Run tests with coverage report
bun run test:coverage
```

Test structure:
- Each hook has corresponding tests in `src/hooks/__tests__/`
- Test utilities in `src/__tests__/` (fixtures, mockFs, testUtils)
- Global test setup in `src/__tests__/setup.ts`
- Coverage configuration in `vitest.config.mjs`

## Development Notes

- TypeScript compilation outputs to the `dist/` directory
- The CLI binary is defined in package.json as `define-claude-code-hooks`
- Hook source files are all located in `.claude/hooks/`:
  - `hooks.ts` (project-wide hooks)
  - `hooks.local.ts` (local-only hooks, not committed to git)
- Compatible with npm, yarn, pnpm, and bun package managers
- The CLI automatically detects which hook files exist and updates the appropriate settings files
- Requires ts-node as a dependency for executing TypeScript hooks
- When testing the package, create test repositories in the `tmp/` folder (already in `.gitignore`)

## Release Process

The project uses automated releases via GitHub Actions. To release a new version:

### Regular Releases

1. **Ensure all changes are committed** and tests pass: `bun run test:run`

2. **Run the release script** based on the type of change:
   - Patch release (bug fixes): `npm run release:patch`
   - Minor release (new features): `npm run release:minor`
   - Major release (breaking changes): `npm run release:major`

   These scripts will:
   - Update the version in `package.json`
   - Create a git commit with the version number
   - Create a git tag (e.g., `v1.0.2`)
   - Push the commit and tag to GitHub

3. **GitHub Actions will automatically**:
   - Build the project
   - Run type checking
   - Publish to npm registry with provenance

### Alpha Releases

For testing new features before a stable release:

1. **Run the alpha release script**:
   - Alpha release (incremental): `npm run release:alpha`
   - Alpha patch: `npm run release:alpha:patch`
   - Alpha minor: `npm run release:alpha:minor`
   - Alpha major: `npm run release:alpha:major`

2. **Or trigger manually via GitHub Actions**:
   - Go to Actions → Alpha Release → Run workflow
   - Select the version bump type
   - This will create and publish an alpha version

3. **Alpha versions**:
   - Are published with the `alpha` tag on npm
   - Can be installed with: `npm install @timoaus/define-claude-code-hooks@alpha`
   - Are marked as pre-releases on GitHub
   - Follow the pattern: `1.2.3-alpha.0`, `1.2.3-alpha.1`, etc.

The package is published under the `@timoaus` scope as `@timoaus/define-claude-code-hooks`.

Note: The repository must have the `NPM_TOKEN` secret configured for publishing.

## CLI Features

### Interactive Initialization

The CLI provides an `--init` command for easy project setup:

```bash
define-claude-code-hooks --init
```

This command:
- Uses interactive prompts to select predefined hooks
- Automatically installs the package if needed (including ts-node)
- Detects the package manager (npm/yarn/pnpm/bun)
- Adds a `claude:hooks` script to package.json
- Creates initial hook files with selected hooks

### Automatic Hook Detection

The CLI automatically:
- Scans for hook files in `.claude/hooks/`
- Generates commands that use ts-node to execute the TypeScript files
- Updates corresponding settings files
- Preserves user-defined hooks while managing its own

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.