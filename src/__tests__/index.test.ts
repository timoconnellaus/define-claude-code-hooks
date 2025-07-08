import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineHook, defineHooks } from '../index';
import { 
  createPreToolUseInput, 
  createPostToolUseInput, 
  createStopInput,
  createNotificationInput,
  createSubagentStopInput 
} from './utils/mockData';

describe('defineHook', () => {
  it('should create a PreToolUse hook definition', () => {
    const handler = vi.fn();
    const hook = defineHook({
      type: 'PreToolUse',
      matcher: 'Bash',
      handler
    });

    expect(hook.type).toBe('PreToolUse');
    expect(hook.matcher).toBe('Bash');
    expect(hook.handler).toBe(handler);
  });

  it('should create a PostToolUse hook definition', () => {
    const handler = vi.fn();
    const hook = defineHook({
      type: 'PostToolUse',
      matcher: '.*',
      handler
    });

    expect(hook.type).toBe('PostToolUse');
    expect(hook.matcher).toBe('.*');
    expect(hook.handler).toBe(handler);
  });

  it('should create a Stop hook definition', () => {
    const handler = vi.fn();
    const hook = defineHook({
      type: 'Stop',
      handler
    });

    expect(hook.type).toBe('Stop');
    expect(hook.handler).toBe(handler);
  });

  it('should create a Notification hook definition', () => {
    const handler = vi.fn();
    const hook = defineHook({
      type: 'Notification',
      handler
    });

    expect(hook.type).toBe('Notification');
    expect(hook.handler).toBe(handler);
  });

  it('should create a SubagentStop hook definition', () => {
    const handler = vi.fn();
    const hook = defineHook({
      type: 'SubagentStop',
      handler
    });

    expect(hook.type).toBe('SubagentStop');
    expect(hook.handler).toBe(handler);
  });
});

describe('defineHooks', () => {
  let originalArgv: string[];
  let originalStdin: any;
  let mockExit: any;

  beforeEach(() => {
    originalArgv = [...process.argv];
    originalStdin = process.stdin;
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.stdin = originalStdin;
    mockExit.mockRestore();
  });

  describe('__generate_settings mode', () => {
    it('should output hook information in JSON format', async () => {
      process.argv = ['node', 'test.js', '__generate_settings'];
      const mockLog = vi.spyOn(console, 'log');

      const hooks = {
        PreToolUse: [
          { matcher: 'Bash', handler: vi.fn() },
          { matcher: 'Write', handler: vi.fn() }
        ],
        PostToolUse: [
          { matcher: '.*', handler: vi.fn() }
        ],
        Stop: vi.fn(),
        Notification: vi.fn()
      };

      try {
        await defineHooks(hooks);
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      const output = JSON.parse(mockLog.mock.calls[0][0]);
      expect(output.PreToolUse).toHaveLength(2);
      expect(output.PreToolUse[0]).toMatchObject({ matcher: 'Bash', handler: 'PreToolUse' });
      expect(output.PreToolUse[1]).toMatchObject({ matcher: 'Write', handler: 'PreToolUse' });
      expect(output.PostToolUse).toHaveLength(1);
      expect(output.PostToolUse[0]).toMatchObject({ matcher: '.*', handler: 'PostToolUse' });
      expect(output.Stop).toHaveLength(1);
      expect(output.Notification).toHaveLength(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle empty hooks', async () => {
      process.argv = ['node', 'test.js', '__generate_settings'];
      const mockLog = vi.spyOn(console, 'log');

      try {
        await defineHooks({});
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      const output = JSON.parse(mockLog.mock.calls[0][0]);
      expect(output).toEqual({});
    });
  });

  describe('__run_hook mode', () => {
    it('should run PreToolUse hook with correct parameters', async () => {
      const handler = vi.fn().mockResolvedValue({ decision: 'approve' });
      const hooks = {
        PreToolUse: [{ matcher: 'Bash', handler }]
      };

      const input = createPreToolUseInput();
      process.argv = ['node', 'test.js', '__run_hook', 'PreToolUse', 'Bash', '0'];
      
      // Mock stdin
      const mockStdin = {
        setEncoding: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(input));
          } else if (event === 'end') {
            callback();
          }
        }),
        resume: vi.fn()
      };
      process.stdin = mockStdin as any;

      try {
        await defineHooks(hooks);
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(handler).toHaveBeenCalledWith(input);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle PostToolUse hook', async () => {
      const handler = vi.fn().mockResolvedValue({});
      const hooks = {
        PostToolUse: [{ matcher: '.*', handler }]
      };

      const input = createPostToolUseInput();
      process.argv = ['node', 'test.js', '__run_hook', 'PostToolUse', '.*', '0'];
      
      const mockStdin = {
        setEncoding: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(input));
          } else if (event === 'end') {
            callback();
          }
        }),
        resume: vi.fn()
      };
      process.stdin = mockStdin as any;

      try {
        await defineHooks(hooks);
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(handler).toHaveBeenCalledWith(input);
    });

    it('should handle Stop hook', async () => {
      const handler = vi.fn().mockResolvedValue({});
      const hooks = {
        Stop: handler
      };

      const input = createStopInput();
      process.argv = ['node', 'test.js', '__run_hook', 'Stop'];
      
      const mockStdin = {
        setEncoding: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(input));
          } else if (event === 'end') {
            callback();
          }
        }),
        resume: vi.fn()
      };
      process.stdin = mockStdin as any;

      try {
        await defineHooks(hooks);
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(handler).toHaveBeenCalledWith(input);
    });

    it('should handle hook errors gracefully', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Hook failed'));
      const hooks = {
        PreToolUse: [{ matcher: 'Bash', handler }]
      };

      const input = createPreToolUseInput();
      process.argv = ['node', 'test.js', '__run_hook', 'PreToolUse', 'Bash', '0'];
      
      const mockStdin = {
        setEncoding: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(input));
          } else if (event === 'end') {
            callback();
          }
        }),
        resume: vi.fn()
      };
      process.stdin = mockStdin as any;

      const mockError = vi.spyOn(console, 'error');

      try {
        await defineHooks(hooks);
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(mockError).toHaveBeenCalledWith('Error in hook:', expect.any(Error));
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle missing hook gracefully', async () => {
      const hooks = {
        PreToolUse: [{ matcher: 'Write', handler: vi.fn() }]
      };

      process.argv = ['node', 'test.js', '__run_hook', 'PreToolUse', 'Bash', '0'];
      
      const mockStdin = {
        setEncoding: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback('{}');
          } else if (event === 'end') {
            callback();
          }
        }),
        resume: vi.fn()
      };
      process.stdin = mockStdin as any;

      const mockError = vi.spyOn(console, 'error');

      try {
        await defineHooks(hooks);
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(mockError).toHaveBeenCalledWith('Hook not found');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle PreToolUse block result', async () => {
      const handler = vi.fn().mockResolvedValue({ decision: 'block', reason: 'Blocked' });
      const hooks = {
        PreToolUse: [{ matcher: 'Bash', handler }]
      };

      const input = createPreToolUseInput();
      process.argv = ['node', 'test.js', '__run_hook', 'PreToolUse', 'Bash', '0'];
      
      const mockStdin = {
        setEncoding: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(input));
          } else if (event === 'end') {
            callback();
          }
        }),
        resume: vi.fn()
      };
      process.stdin = mockStdin as any;

      const mockLog = vi.spyOn(console, 'log');
      const mockError = vi.spyOn(console, 'error');

      try {
        await defineHooks(hooks);
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(mockLog).toHaveBeenCalledWith(JSON.stringify({ decision: 'block', reason: 'Blocked' }));
      expect(mockError).toHaveBeenCalledWith('Blocked');
      expect(mockExit).toHaveBeenCalledWith(2);
    });
  });

  describe('normal execution mode', () => {
    it('should not execute hooks when not in CLI mode', async () => {
      process.argv = ['node', 'test.js'];
      const handler = vi.fn();
      const hooks = {
        PreToolUse: [{ matcher: 'Bash', handler }]
      };

      await defineHooks(hooks);

      expect(handler).not.toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });
  });
});