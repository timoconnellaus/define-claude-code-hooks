import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock modules
vi.mock('child_process');
vi.mock('fs');

const mockExecSync = execSync as any;
const mockFs = fs as any;

// Store original process values
let originalArgv: string[];
let originalExit: any;
let originalLog: any;
let originalError: any;

describe('CLI', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = '/tmp/test-hooks';
    originalArgv = [...process.argv];
    originalExit = process.exit;
    originalLog = console.log;
    originalError = console.error;
    
    process.exit = vi.fn() as any;
    console.log = vi.fn();
    console.error = vi.fn();

    // Mock fs methods
    mockFs.existsSync = vi.fn();
    mockFs.readFileSync = vi.fn();
    mockFs.writeFileSync = vi.fn();
    mockFs.mkdirSync = vi.fn();

    // Clear module cache to ensure fresh import
    vi.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    console.log = originalLog;
    console.error = originalError;
    vi.clearAllMocks();
  });

  describe('command parsing', () => {
    it('should show help when no arguments provided', async () => {
      process.argv = ['node', 'cli.js'];
      
      await import('../cli');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('define-claude-code-hooks'));
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should show help with --help flag', async () => {
      process.argv = ['node', 'cli.js', '--help'];
      
      await import('../cli');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should show help with -h flag', async () => {
      process.argv = ['node', 'cli.js', '-h'];
      
      await import('../cli');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('update command', () => {
    const mockSettingsContent = JSON.stringify({
      hooks: {
        PreToolUse: [
          { command: 'echo "old hook"' },
          { command: 'node hooks.ts __run_hook # __managed_by_define_claude_code_hooks__' }
        ]
      }
    }, null, 2);

    const mockHookInfo = {
      PreToolUse: [
        { matcher: 'Bash', handler: 'PreToolUse', index: 0 }, 
        { matcher: 'Write', handler: 'PreToolUse', index: 1 }
      ],
      PostToolUse: [{ matcher: '.*', handler: 'PostToolUse', index: 0 }],
      Stop: [{ handler: 'Stop', count: 1 }]
    };

    beforeEach(() => {
      process.argv = ['node', 'cli.js', 'update'];
      
      // Mock finding hooks file
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.endsWith('.claude/hooks/hooks.ts')) return true;
        if (path.endsWith('.claude/settings.json')) return true;
        return false;
      });

      // Mock reading settings file
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path.endsWith('settings.json')) {
          return mockSettingsContent;
        }
        return '';
      });

      // Mock executing hooks file to get info
      mockExecSync.mockReturnValue(JSON.stringify(mockHookInfo));
    });

    it('should update settings.json with new hooks', async () => {
      await import('../cli');

      // Verify hooks discovery
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('__generate_settings'),
        expect.objectContaining({ encoding: 'utf8' })
      );

      // Verify settings file was written
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);

      // Check that managed hooks were replaced
      expect(writtenContent.hooks.PreToolUse).toContainEqual(
        expect.objectContaining({ command: 'echo "old hook"' })
      );
      expect(writtenContent.hooks.PreToolUse).toContainEqual(
        expect.objectContaining({ 
          command: expect.stringContaining('__run_hook PreToolUse "Bash"')
        })
      );
      expect(writtenContent.hooks.PreToolUse).toContainEqual(
        expect.objectContaining({ 
          command: expect.stringContaining('__run_hook PreToolUse "Write"')
        })
      );
    });

    it('should create settings.json if it does not exist', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.endsWith('.claude/hooks/hooks.ts')) return true;
        if (path.endsWith('.claude/settings.json')) return false;
        if (path.endsWith('.claude')) return false;
        return false;
      });

      await import('../cli');

      // Should create .claude directory
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.claude'),
        { recursive: true }
      );

      // Should write new settings file
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);

      expect(writtenContent).toHaveProperty('hooks');
      expect(writtenContent.hooks).toHaveProperty('PreToolUse');
      expect(writtenContent.hooks).toHaveProperty('PostToolUse');
    });

    it('should handle different package managers', async () => {
      // Test with yarn
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.endsWith('yarn.lock')) return true;
        if (path.endsWith('.claude/hooks/hooks.ts')) return true;
        if (path.endsWith('.claude/settings.json')) return true;
        return false;
      });

      await import('../cli');

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);
      const command = writtenContent.hooks.PreToolUse[1].command;

      expect(command).toContain('yarn tsx');
    });

    it('should exit with error if hooks file not found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await import('../cli');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle errors from hooks execution', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Hooks file error');
      });

      await import('../cli');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error discovering hooks')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('remove command', () => {
    beforeEach(() => {
      process.argv = ['node', 'cli.js', 'remove'];
      
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.endsWith('.claude/settings.json')) return true;
        return false;
      });

      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PreToolUse: [
            { command: 'echo "user hook"' },
            { command: 'node hooks.ts # __managed_by_define_claude_code_hooks__' }
          ],
          PostToolUse: [
            { command: 'node hooks.ts # __managed_by_define_claude_code_hooks__' }
          ]
        }
      }));
    });

    it('should remove only managed hooks from settings.json', async () => {
      await import('../cli');

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);

      // User hooks should remain
      expect(writtenContent.hooks.PreToolUse).toHaveLength(1);
      expect(writtenContent.hooks.PreToolUse[0].command).toBe('echo "user hook"');

      // Managed hooks should be removed
      expect(writtenContent.hooks.PostToolUse).toHaveLength(0);
    });

    it('should handle settings.json not found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await import('../cli');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No settings.json found')
      );
    });
  });

  describe('--global flag', () => {
    beforeEach(() => {
      process.argv = ['node', 'cli.js', 'update', '--global'];
      
      const globalSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      const globalHooksPath = path.join(os.homedir(), '.claude', 'hooks', 'hooks.ts');

      mockFs.existsSync.mockImplementation((path: string) => {
        if (path === globalHooksPath) return true;
        if (path === globalSettingsPath) return true;
        return false;
      });

      mockFs.readFileSync.mockReturnValue(JSON.stringify({ hooks: {} }));
      mockExecSync.mockReturnValue(JSON.stringify({
        PreToolUse: [],
        PostToolUse: [],
        Stop: [],
        Notification: [],
        SubagentStop: []
      }));
    });

    it('should update global settings when --global flag is used', async () => {
      await import('../cli');

      const globalSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      
      expect(mockFs.readFileSync).toHaveBeenCalledWith(globalSettingsPath, 'utf8');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        globalSettingsPath,
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('integration', () => {
    it('should handle complex settings structure', async () => {
      process.argv = ['node', 'cli.js', 'update'];
      
      const complexSettings = {
        someOtherConfig: { foo: 'bar' },
        hooks: {
          PreToolUse: [
            { command: 'echo "1"' },
            { command: 'old managed # __managed_by_define_claude_code_hooks__' },
            { command: 'echo "2"' }
          ],
          CustomHook: [{ command: 'custom' }]
        },
        moreConfig: { baz: 'qux' }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(complexSettings));
      mockExecSync.mockReturnValue(JSON.stringify({
        PreToolUse: [{ matcher: 'New', handler: 'PreToolUse', index: 0 }]
      }));

      await import('../cli');

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);

      // Other config should be preserved
      expect(writtenContent.someOtherConfig).toEqual({ foo: 'bar' });
      expect(writtenContent.moreConfig).toEqual({ baz: 'qux' });
      expect(writtenContent.hooks.CustomHook).toEqual([{ command: 'custom' }]);

      // Managed hooks should be updated
      expect(writtenContent.hooks.PreToolUse).toHaveLength(3);
      expect(writtenContent.hooks.PreToolUse[0].command).toBe('echo "1"');
      expect(writtenContent.hooks.PreToolUse[2].command).toBe('echo "2"');
      expect(writtenContent.hooks.PreToolUse[1].command).toContain('__run_hook PreToolUse "New"');
    });
  });
});