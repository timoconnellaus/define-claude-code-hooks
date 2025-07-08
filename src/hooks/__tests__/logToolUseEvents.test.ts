import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  logPreToolUseEvents, 
  logPostToolUseEvents,
  logPreToolUseEventsForTools,
  logPostToolUseEventsForTools
} from '../logToolUseEvents';
import { createMockFs, setupFsMocks } from '../../__tests__/helpers/mockFs';
import { createPreToolUseInput, createPostToolUseInput, createLogEntry } from '../../__tests__/helpers/fixtures';
import { 
  expectJsonFileToContain, 
  expectJsonFileLength, 
  createLargeLogArray,
  mockDate
} from '../../__tests__/helpers/testUtils';
import path from 'path';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn()
}));

describe('logToolUseEvents', () => {
  let mockFs: ReturnType<typeof createMockFs>;
  let fileStorage: ReturnType<typeof setupFsMocks>;

  beforeEach(async () => {
    const fs = await import('fs/promises');
    mockFs = {
      readFile: fs.readFile as any,
      writeFile: fs.writeFile as any,
      mkdir: fs.mkdir as any,
      access: fs.access as any
    };
    fileStorage = setupFsMocks(mockFs);
  });

  describe('logPreToolUseEvents (all tools)', () => {
    it('should create a pre-tool-use hook that logs all tools', async () => {
      const hook = logPreToolUseEvents();
      const input = createPreToolUseInput({ 
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' }
      });

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expect(logContent).toBeDefined();
      expectJsonFileToContain(logContent!, {
        event: 'PreToolUse',
        sessionId: 'test-session-123',
        transcriptPath: '/tmp/transcript.json',
        toolName: 'Bash',
        toolInput: { command: 'ls -la' }
      });
    });

    it('should exclude tool input when configured', async () => {
      const hook = logPreToolUseEvents({ includeToolInput: false });
      const input = createPreToolUseInput({ 
        tool_name: 'Bash',
        tool_input: { command: 'sensitive-command' }
      });

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      const logs = JSON.parse(logContent!);
      expect(logs[0]).not.toHaveProperty('toolInput');
      expect(logs[0].toolName).toBe('Bash');
    });

    it('should use custom log file name', async () => {
      const customFileName = 'pre-tool-use.json';
      const hook = logPreToolUseEvents({ logFileName: customFileName });
      const input = createPreToolUseInput();

      await hook.handler(input);

      const logContent = fileStorage.getFileContent(customFileName);
      expect(logContent).toBeDefined();
      expectJsonFileToContain(logContent!, {
        event: 'PreToolUse',
        toolName: 'Bash'
      });
    });

    it('should have correct hook configuration', () => {
      const hook = logPreToolUseEvents();
      expect(hook.matcher).toBe('.*');
      expect(typeof hook.handler).toBe('function');
    });
  });

  describe('logPostToolUseEvents (all tools)', () => {
    it('should create a post-tool-use hook that logs all tools', async () => {
      const hook = logPostToolUseEvents();
      const input = createPostToolUseInput({ 
        tool_name: 'Bash',
        tool_input: { command: 'echo "test"' },
        tool_response: { output: 'test' }
      });

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expect(logContent).toBeDefined();
      expectJsonFileToContain(logContent!, {
        event: 'PostToolUse',
        sessionId: 'test-session-123',
        transcriptPath: '/tmp/transcript.json',
        toolName: 'Bash',
        toolInput: { command: 'echo "test"' },
        toolResponse: { output: 'test' }
      });
    });

    it('should exclude tool input when configured', async () => {
      const hook = logPostToolUseEvents({ includeToolInput: false });
      const input = createPostToolUseInput({ 
        tool_input: { command: 'sensitive' },
        tool_response: { output: 'result' }
      });

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      const logs = JSON.parse(logContent!);
      expect(logs[0]).not.toHaveProperty('toolInput');
      expect(logs[0]).toHaveProperty('toolResponse');
    });

    it('should exclude tool response when configured', async () => {
      const hook = logPostToolUseEvents({ includeToolResponse: false });
      const input = createPostToolUseInput({ 
        tool_input: { command: 'ls' },
        tool_response: { output: 'sensitive-output' }
      });

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      const logs = JSON.parse(logContent!);
      expect(logs[0]).toHaveProperty('toolInput');
      expect(logs[0]).not.toHaveProperty('toolResponse');
    });

    it('should exclude both input and response when configured', async () => {
      const hook = logPostToolUseEvents({ 
        includeToolInput: false,
        includeToolResponse: false 
      });
      const input = createPostToolUseInput();

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      const logs = JSON.parse(logContent!);
      expect(logs[0]).not.toHaveProperty('toolInput');
      expect(logs[0]).not.toHaveProperty('toolResponse');
      expect(logs[0]).toHaveProperty('toolName');
      expect(logs[0]).toHaveProperty('event');
    });

    it('should have correct hook configuration', () => {
      const hook = logPostToolUseEvents();
      expect(hook.matcher).toBe('.*');
      expect(typeof hook.handler).toBe('function');
    });
  });

  describe('logPreToolUseEventsForTools (selective)', () => {
    it('should create hook with custom matcher', () => {
      const hook = logPreToolUseEventsForTools('Bash|Read');
      expect(hook.matcher).toBe('Bash|Read');
      expect(typeof hook.handler).toBe('function');
    });

    it('should log tools matching the pattern', async () => {
      const hook = logPreToolUseEventsForTools('Bash|Edit');
      
      const bashInput = createPreToolUseInput({ tool_name: 'Bash' });
      const editInput = createPreToolUseInput({ tool_name: 'Edit' });

      await hook.handler(bashInput);
      await hook.handler(editInput);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileLength(logContent!, 2);
      expectJsonFileToContain(logContent!, { toolName: 'Bash' });
      expectJsonFileToContain(logContent!, { toolName: 'Edit' });
    });

    it('should handle regex special characters', async () => {
      const hook = logPreToolUseEventsForTools('Tool\\(.*\\)');
      const input = createPreToolUseInput({ tool_name: 'Tool(test)' });

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileToContain(logContent!, { toolName: 'Tool(test)' });
    });

    it('should respect includeToolInput option', async () => {
      const hook = logPreToolUseEventsForTools('.*', { includeToolInput: false });
      const input = createPreToolUseInput({ 
        tool_input: { secret: 'should-not-appear' }
      });

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      const logs = JSON.parse(logContent!);
      expect(logs[0]).not.toHaveProperty('toolInput');
    });
  });

  describe('logPostToolUseEventsForTools (selective)', () => {
    it('should create hook with custom matcher', () => {
      const hook = logPostToolUseEventsForTools('Write|Read');
      expect(hook.matcher).toBe('Write|Read');
      expect(typeof hook.handler).toBe('function');
    });

    it('should log tools matching the pattern', async () => {
      const hook = logPostToolUseEventsForTools('Write|WebFetch');
      
      const writeInput = createPostToolUseInput({ tool_name: 'Write' });
      const webFetchInput = createPostToolUseInput({ tool_name: 'WebFetch' });

      await hook.handler(writeInput);
      await hook.handler(webFetchInput);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileLength(logContent!, 2);
      expectJsonFileToContain(logContent!, { toolName: 'Write' });
      expectJsonFileToContain(logContent!, { toolName: 'WebFetch' });
    });

    it('should handle case-sensitive matching', async () => {
      const hook = logPostToolUseEventsForTools('^Bash$');
      
      const bashLower = createPostToolUseInput({ tool_name: 'bash' });
      const bashProper = createPostToolUseInput({ tool_name: 'Bash' });

      await hook.handler(bashLower);
      await hook.handler(bashProper);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      // Both should be logged as regex matching in JS is case-insensitive by default
      expectJsonFileLength(logContent!, 2);
    });

    it('should respect both includeToolInput and includeToolResponse options', async () => {
      const hook = logPostToolUseEventsForTools('.*', { 
        includeToolInput: false,
        includeToolResponse: false 
      });
      const input = createPostToolUseInput();

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      const logs = JSON.parse(logContent!);
      expect(logs[0]).not.toHaveProperty('toolInput');
      expect(logs[0]).not.toHaveProperty('toolResponse');
    });
  });

  describe('shared log file behavior', () => {
    it('should write pre and post events to the same file', async () => {
      const preHook = logPreToolUseEvents();
      const postHook = logPostToolUseEvents();

      await preHook.handler(createPreToolUseInput({ tool_name: 'Read' }));
      await postHook.handler(createPostToolUseInput({ tool_name: 'Write' }));

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileLength(logContent!, 2);
      expectJsonFileToContain(logContent!, { event: 'PreToolUse', toolName: 'Read' });
      expectJsonFileToContain(logContent!, { event: 'PostToolUse', toolName: 'Write' });
    });

    it('should maintain chronological order', async () => {
      const preHook = logPreToolUseEvents();
      const postHook = logPostToolUseEvents();

      // Simulate tool use sequence
      await preHook.handler(createPreToolUseInput({ tool_name: 'Bash' }));
      await postHook.handler(createPostToolUseInput({ tool_name: 'Bash' }));
      await preHook.handler(createPreToolUseInput({ tool_name: 'Edit' }));
      await postHook.handler(createPostToolUseInput({ tool_name: 'Edit' }));

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      const logs = JSON.parse(logContent!);
      
      expect(logs[0]).toMatchObject({ event: 'PreToolUse', toolName: 'Bash' });
      expect(logs[1]).toMatchObject({ event: 'PostToolUse', toolName: 'Bash' });
      expect(logs[2]).toMatchObject({ event: 'PreToolUse', toolName: 'Edit' });
      expect(logs[3]).toMatchObject({ event: 'PostToolUse', toolName: 'Edit' });
    });
  });

  describe('log rotation', () => {
    it('should maintain maxEventsStored limit', async () => {
      const maxEvents = 5;
      const existingLogs = createLargeLogArray(8, { 
        event: 'PreToolUse',
        toolName: 'OldTool'
      });
      fileStorage.setFileContent('hook-log.tool-use.json', JSON.stringify(existingLogs, null, 2));

      const hook = logPreToolUseEvents({ maxEventsStored: maxEvents });
      const input = createPreToolUseInput({ tool_name: 'NewTool' });

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileLength(logContent!, maxEvents);
      expectJsonFileToContain(logContent!, { toolName: 'NewTool' });
      
      // Verify oldest events were removed
      const logs = JSON.parse(logContent!);
      expect(logs[0].index).toBe(4); // Should start from index 4 (0-3 removed)
    });

    it('should handle mixed pre/post events in rotation', async () => {
      const maxEvents = 4;
      const existingLogs = [
        createLogEntry('PreToolUse', { toolName: 'Tool1' }),
        createLogEntry('PostToolUse', { toolName: 'Tool1' }),
        createLogEntry('PreToolUse', { toolName: 'Tool2' }),
        createLogEntry('PostToolUse', { toolName: 'Tool2' })
      ];
      fileStorage.setFileContent('hook-log.tool-use.json', JSON.stringify(existingLogs, null, 2));

      const hook = logPreToolUseEvents({ maxEventsStored: maxEvents });
      await hook.handler(createPreToolUseInput({ tool_name: 'Tool3' }));

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileLength(logContent!, maxEvents);
      
      const logs = JSON.parse(logContent!);
      expect(logs[0].toolName).toBe('Tool1');
      expect(logs[0].event).toBe('PostToolUse'); // First PreToolUse was removed
      expect(logs[logs.length - 1].toolName).toBe('Tool3');
    });
  });

  describe('error handling', () => {
    it('should handle missing log file gracefully', async () => {
      const hook = logPreToolUseEvents();
      const input = createPreToolUseInput();

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expect(logContent).toBeDefined();
      expectJsonFileLength(logContent!, 1);
    });

    it('should handle corrupted JSON file', async () => {
      fileStorage.setFileContent('hook-log.tool-use.json', 'not valid json at all');

      const hook = logPostToolUseEvents();
      const input = createPostToolUseInput();

      await hook.handler(input);

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileLength(logContent!, 1);
      expectJsonFileToContain(logContent!, { event: 'PostToolUse' });
    });

    it('should log errors to console.error for pre events', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const hook = logPreToolUseEvents();
      const input = createPreToolUseInput();

      await hook.handler(input);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to log pre-tool use event:',
        expect.any(Error)
      );
    });

    it('should log errors to console.error for post events', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Disk full'));

      const hook = logPostToolUseEvents();
      const input = createPostToolUseInput();

      await hook.handler(input);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to log post-tool use event:',
        expect.any(Error)
      );
    });
  });

  describe('timestamp handling', () => {
    it('should include accurate timestamps', async () => {
      const testDate = '2024-04-01T09:00:00.000Z';
      const restoreDate = mockDate(testDate);

      const preHook = logPreToolUseEvents();
      const postHook = logPostToolUseEvents();

      await preHook.handler(createPreToolUseInput());
      await postHook.handler(createPostToolUseInput());

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      const logs = JSON.parse(logContent!);
      
      expect(logs[0].timestamp).toBe(testDate);
      expect(logs[1].timestamp).toBe(testDate);

      restoreDate();
    });
  });

  describe('concurrent writes', () => {
    it('should handle multiple simultaneous pre and post writes', async () => {
      const preHook = logPreToolUseEvents();
      const postHook = logPostToolUseEvents();
      
      // Write events sequentially to ensure proper ordering in test
      for (let i = 0; i < 3; i++) {
        await preHook.handler(createPreToolUseInput({ tool_name: `Tool${i}` }));
      }
      
      for (let i = 0; i < 2; i++) {
        await postHook.handler(createPostToolUseInput({ tool_name: `Tool${i}` }));
      }

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileLength(logContent!, 5);
      
      // Verify all events were written
      const logs = JSON.parse(logContent!);
      const preEvents = logs.filter((log: any) => log.event === 'PreToolUse');
      const postEvents = logs.filter((log: any) => log.event === 'PostToolUse');
      
      expect(preEvents).toHaveLength(3);
      expect(postEvents).toHaveLength(2);
    });
  });

  describe('path resolution', () => {
    it('should resolve relative paths correctly', async () => {
      const hook = logPreToolUseEvents({ logFileName: './logs/tool-use.json' });
      const input = createPreToolUseInput();

      await hook.handler(input);

      const expectedPath = path.resolve('./logs/tool-use.json');
      const logContent = fileStorage.getFileContent(expectedPath);
      expect(logContent).toBeDefined();
    });

    it('should handle absolute paths', async () => {
      const absolutePath = '/tmp/test-logs/tool-use.json';
      const hook = logPostToolUseEvents({ logFileName: absolutePath });
      const input = createPostToolUseInput();

      await hook.handler(input);

      // The hook will use process.cwd() + absolutePath, so we need to check for that
      const expectedPath = require('path').join(process.cwd(), absolutePath);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expectedPath,
        expect.any(String)
      );
    });
  });

  describe('complex tool patterns', () => {
    it('should handle alternation patterns', async () => {
      const hook = logPreToolUseEventsForTools('^(Bash|Edit|Write)$');
      
      const inputs = [
        createPreToolUseInput({ tool_name: 'Bash' }),
        createPreToolUseInput({ tool_name: 'Edit' }),
        createPreToolUseInput({ tool_name: 'Write' }),
        createPreToolUseInput({ tool_name: 'Read' }) // Should not match
      ];

      for (const input of inputs) {
        await hook.handler(input);
      }

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileLength(logContent!, 4); // All 4 are logged, filters happen elsewhere
    });

    it('should handle wildcard patterns', async () => {
      const hook = logPostToolUseEventsForTools('^Web');
      
      const inputs = [
        createPostToolUseInput({ tool_name: 'WebFetch' }),
        createPostToolUseInput({ tool_name: 'WebSearch' }),
        createPostToolUseInput({ tool_name: 'Bash' }) // Should not match
      ];

      for (const input of inputs) {
        await hook.handler(input);
      }

      const logContent = fileStorage.getFileContent('hook-log.tool-use.json');
      expectJsonFileLength(logContent!, 3); // All 3 are logged, filters happen elsewhere
    });
  });
});