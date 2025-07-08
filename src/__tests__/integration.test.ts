import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

describe('Integration Tests', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Create directory structure
    fs.mkdirSync(path.join(tempDir, '.claude', 'hooks'), { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('End-to-end workflow', () => {
    it('should define hooks, generate settings, and execute hooks', () => {
      // Step 1: Create a hooks.ts file
      const hooksContent = `
import { defineHooks } from '${path.resolve(originalCwd, 'src/index')}';

export default defineHooks({
  PreToolUse: [
    {
      matcher: 'Bash',
      handler: async (input) => {
        console.log('PreToolUse:', JSON.stringify(input));
        return { decision: 'approve' };
      }
    }
  ],
  PostToolUse: [
    {
      matcher: '.*',
      handler: async (input) => {
        console.log('PostToolUse:', JSON.stringify(input));
        return {};
      }
    }
  ],
  Stop: async (input) => {
    console.log('Stop:', JSON.stringify(input));
    return {};
  }
});
`;

      fs.writeFileSync(path.join(tempDir, '.claude/hooks/hooks.ts'), hooksContent);

      // Step 2: Test __generate_settings mode
      const generateResult = execSync(
        `node -r ts-node/register ${path.join(tempDir, '.claude/hooks/hooks.ts')} __generate_settings`,
        { encoding: 'utf8', cwd: tempDir }
      );

      const hookInfo = JSON.parse(generateResult);
      expect(hookInfo.PreToolUse).toHaveLength(1);
      expect(hookInfo.PreToolUse[0]).toMatchObject({ matcher: 'Bash', handler: 'PreToolUse' });
      expect(hookInfo.PostToolUse).toHaveLength(1);
      expect(hookInfo.PostToolUse[0]).toMatchObject({ matcher: '.*', handler: 'PostToolUse' });
      expect(hookInfo.Stop).toHaveLength(1);

      // Step 3: Test __run_hook mode for PreToolUse
      const preToolInput = {
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript.json',
        tool_name: 'Bash',
        tool_input: { command: 'echo "test"' }
      };

      const preToolResult = execSync(
        `node -r ts-node/register ${path.join(tempDir, '.claude/hooks/hooks.ts')} __run_hook PreToolUse "Bash" "0"`,
        { 
          encoding: 'utf8', 
          cwd: tempDir,
          input: JSON.stringify(preToolInput)
        }
      );

      expect(preToolResult).toContain('PreToolUse:');
      expect(preToolResult).toContain('"tool_name":"Bash"');

      // Step 4: Test __run_hook mode for Stop
      const stopInput = {
        hook_event_name: 'Stop',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript.json',
        stop_hook_active: true
      };

      const stopResult = execSync(
        `node -r ts-node/register ${path.join(tempDir, '.claude/hooks/hooks.ts')} __run_hook Stop`,
        { 
          encoding: 'utf8', 
          cwd: tempDir,
          input: JSON.stringify(stopInput)
        }
      );

      expect(stopResult).toContain('Stop:');
      expect(stopResult).toContain('"stop_hook_active":true');
    });

    it('should handle PreToolUse block results correctly', () => {
      const hooksContent = `
import { defineHooks } from '${path.resolve(originalCwd, 'src/index')}';

export default defineHooks({
  PreToolUse: [
    {
      matcher: 'Bash',
      handler: async (input) => {
        if (input.tool_input.command?.includes('rm')) {
          return { decision: 'block', reason: 'Dangerous command blocked' };
        }
        return { decision: 'approve' };
      }
    }
  ]
});
`;

      fs.writeFileSync(path.join(tempDir, '.claude/hooks/hooks.ts'), hooksContent);

      // Test with dangerous command
      const dangerousInput = {
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript.json',
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' }
      };

      const skipResult = execSync(
        `node -r ts-node/register ${path.join(tempDir, '.claude/hooks/hooks.ts')} __run_hook PreToolUse "Bash" "0"`,
        { 
          encoding: 'utf8', 
          cwd: tempDir,
          input: JSON.stringify(dangerousInput)
        }
      );

      const skipOutput = JSON.parse(skipResult);
      expect(skipOutput).toEqual({
        decision: 'block',
        reason: 'Dangerous command blocked'
      });

      // Test with safe command
      const safeInput = {
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript.json',
        tool_name: 'Bash',
        tool_input: { command: 'echo "safe"' }
      };

      const allowResult = execSync(
        `node -r ts-node/register ${path.join(tempDir, '.claude/hooks/hooks.ts')} __run_hook PreToolUse "Bash" "0"`,
        { 
          encoding: 'utf8', 
          cwd: tempDir,
          input: JSON.stringify(safeInput)
        }
      );

      expect(allowResult.trim()).toBe('');
    });

    it('should handle logging hooks integration', () => {
      const hooksContent = `
import { defineHooks } from '${path.resolve(originalCwd, 'src/index')}';
import { logPreToolUseEvents, logPostToolUseEvents } from '${path.resolve(originalCwd, 'src/hooks/logToolUseEvents')}';
import { logStopEvents } from '${path.resolve(originalCwd, 'src/hooks/logStopEvents')}';

const preToolLogger = logPreToolUseEvents({ logFileName: './tool-events.json', maxEventsStored: 10 });
const postToolLogger = logPostToolUseEvents({ logFileName: './tool-events.json', maxEventsStored: 10 });
const stopLogger = logStopEvents('./stop-events.json', 5);

export default defineHooks({
  PreToolUse: [preToolLogger],
  PostToolUse: [postToolLogger],
  Stop: stopLogger
});
`;

      fs.writeFileSync(path.join(tempDir, '.claude/hooks/hooks.ts'), hooksContent);

      // Execute PreToolUse
      const preToolInput = {
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript.json',
        tool_name: 'Write',
        tool_input: { file_path: 'test.txt', content: 'hello' }
      };

      execSync(
        `node -r ts-node/register ${path.join(tempDir, '.claude/hooks/hooks.ts')} __run_hook PreToolUse ".*" "0"`,
        { 
          encoding: 'utf8', 
          cwd: tempDir,
          input: JSON.stringify(preToolInput)
        }
      );

      // Execute PostToolUse
      const postToolInput = {
        hook_event_name: 'PostToolUse',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript.json',
        tool_name: 'Write',
        tool_input: { file_path: 'test.txt', content: 'hello' },
        tool_response: { output: 'File written successfully' }
      };

      execSync(
        `node -r ts-node/register ${path.join(tempDir, '.claude/hooks/hooks.ts')} __run_hook PostToolUse ".*" "0"`,
        { 
          encoding: 'utf8', 
          cwd: tempDir,
          input: JSON.stringify(postToolInput)
        }
      );

      // Execute Stop
      const stopInput = {
        hook_event_name: 'Stop',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript.json',
        stop_hook_active: true
      };

      execSync(
        `node -r ts-node/register ${path.join(tempDir, '.claude/hooks/hooks.ts')} __run_hook Stop`,
        { 
          encoding: 'utf8', 
          cwd: tempDir,
          input: JSON.stringify(stopInput)
        }
      );

      // Verify log files were created
      const toolLog = JSON.parse(fs.readFileSync(path.join(tempDir, 'tool-events.json'), 'utf8'));
      expect(toolLog).toHaveLength(2);
      expect(toolLog[0].event).toBe('PreToolUse');
      expect(toolLog[1].event).toBe('PostToolUse');

      const stopLog = JSON.parse(fs.readFileSync(path.join(tempDir, 'stop-events.json'), 'utf8'));
      expect(stopLog).toHaveLength(1);
      expect(stopLog[0].type).toBe('Stop');
    });

    it('should handle errors gracefully', () => {
      const hooksContent = `
import { defineHooks } from '${path.resolve(originalCwd, 'src/index')}';

export default defineHooks({
  PreToolUse: [
    {
      matcher: 'Bash',
      handler: async (input) => {
        throw new Error('Hook error');
      }
    }
  ]
});
`;

      fs.writeFileSync(path.join(tempDir, '.claude/hooks/hooks.ts'), hooksContent);

      const input = {
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        transcript_path: '/tmp/transcript.json',
        tool_name: 'Bash',
        tool_input: { command: 'echo "test"' }
      };

      // Should exit with error code 1
      expect(() => {
        execSync(
          `node -r ts-node/register ${path.join(tempDir, '.claude/hooks/hooks.ts')} __run_hook PreToolUse "Bash" "0"`,
          { 
            encoding: 'utf8', 
            cwd: tempDir,
            input: JSON.stringify(input),
            stdio: 'pipe'
          }
        );
      }).toThrow();
    });
  });

  describe('CLI integration', () => {
    it('should generate correct settings.json from hooks file', () => {
      // Create hooks file
      const hooksContent = `
import { defineHooks } from '${path.resolve(originalCwd, 'src/index')}';

export default defineHooks({
  PreToolUse: [
    { matcher: 'Bash', handler: async () => ({ decision: 'approve' }) },
    { matcher: 'Write', handler: async () => ({ decision: 'approve' }) }
  ],
  Stop: async () => ({})
});
`;

      fs.writeFileSync(path.join(tempDir, '.claude/hooks/hooks.ts'), hooksContent);

      // Run CLI update command
      const cliPath = path.resolve(originalCwd, 'src/cli.ts');
      execSync(
        `node -r ts-node/register ${cliPath} update`,
        { cwd: tempDir }
      );

      // Verify settings.json was created
      const settingsPath = path.join(tempDir, '.claude/settings.json');
      expect(fs.existsSync(settingsPath)).toBe(true);

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.PreToolUse).toHaveLength(2);
      expect(settings.hooks.Stop).toHaveLength(1);

      // Verify commands contain ts-node
      const bashHook = settings.hooks.PreToolUse.find((h: any) => 
        h.command.includes('"Bash"')
      );
      expect(bashHook).toBeDefined();
      expect(bashHook.command).toContain('ts-node/register');
      expect(bashHook.command).toContain('__managed_by_define_claude_code_hooks__');
    });

    it('should preserve existing non-managed hooks', () => {
      // Create existing settings with mixed hooks
      const existingSettings = {
        hooks: {
          PreToolUse: [
            { command: 'echo "user hook"' },
            { command: 'old managed # __managed_by_define_claude_code_hooks__' }
          ]
        }
      };

      fs.writeFileSync(
        path.join(tempDir, '.claude/settings.json'), 
        JSON.stringify(existingSettings, null, 2)
      );

      // Create hooks file
      const hooksContent = `
import { defineHooks } from '${path.resolve(originalCwd, 'src/index')}';

export default defineHooks({
  PreToolUse: [
    { matcher: 'NewHook', handler: async () => ({ decision: 'approve' }) }
  ]
});
`;

      fs.writeFileSync(path.join(tempDir, '.claude/hooks/hooks.ts'), hooksContent);

      // Run CLI update
      const cliPath = path.resolve(originalCwd, 'src/cli.ts');
      execSync(
        `node -r ts-node/register ${cliPath} update`,
        { cwd: tempDir }
      );

      // Verify settings
      const settings = JSON.parse(
        fs.readFileSync(path.join(tempDir, '.claude/settings.json'), 'utf8')
      );

      expect(settings.hooks.PreToolUse).toHaveLength(2);
      expect(settings.hooks.PreToolUse[0].command).toBe('echo "user hook"');
      expect(settings.hooks.PreToolUse[1].command).toContain('NewHook');
    });
  });
});