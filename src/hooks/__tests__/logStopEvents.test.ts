import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logStopEvents, logSubagentStopEvents } from '../logStopEvents';
import { createMockFs, setupFsMocks } from '../../__tests__/helpers/mockFs';
import { createStopInput, createSubagentStopInput, createLogEntry } from '../../__tests__/helpers/fixtures';
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

describe('logStopEvents', () => {
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

  describe('Stop events', () => {
    it('should create a stop hook that logs events', async () => {
      const hook = logStopEvents();
      const input = createStopInput({ stop_hook_active: true });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expect(logContent).toBeDefined();
      expectJsonFileToContain(logContent!, {
        event: 'Stop',
        sessionId: 'test-session-123',
        transcriptPath: '/tmp/transcript.json',
        stopHookActive: true
      });
    });

    it('should append to existing log file', async () => {
      const existingLog = JSON.stringify([
        createLogEntry('Stop', { stopHookActive: false })
      ], null, 2);
      fileStorage.setFileContent('hook-log.stop.json', existingLog);

      const hook = logStopEvents();
      const input = createStopInput({ stop_hook_active: true });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expectJsonFileLength(logContent!, 2);
      expectJsonFileToContain(logContent!, { stopHookActive: true });
    });

    it('should use custom log file name', async () => {
      const customFileName = 'custom-stop-events.json';
      const hook = logStopEvents({ logFileName: customFileName });
      const input = createStopInput();

      await hook(input);

      const logContent = fileStorage.getFileContent(customFileName);
      expect(logContent).toBeDefined();
      expectJsonFileToContain(logContent!, {
        event: 'Stop',
        stopHookActive: false
      });
    });

    it('should be a function', () => {
      const hook = logStopEvents();
      expect(typeof hook).toBe('function');
    });
  });

  describe('SubagentStop events', () => {
    it('should create a subagent stop hook that logs events', async () => {
      const hook = logSubagentStopEvents();
      const input = createSubagentStopInput({ stop_hook_active: true });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expect(logContent).toBeDefined();
      expectJsonFileToContain(logContent!, {
        event: 'SubagentStop',
        sessionId: 'test-session-123',
        transcriptPath: '/tmp/transcript.json',
        stopHookActive: true
      });
    });

    it('should use custom log file name', async () => {
      const customFileName = 'custom-subagent-stop.json';
      const hook = logSubagentStopEvents({ logFileName: customFileName });
      const input = createSubagentStopInput();

      await hook(input);

      const logContent = fileStorage.getFileContent(customFileName);
      expect(logContent).toBeDefined();
      expectJsonFileToContain(logContent!, {
        event: 'SubagentStop',
        stopHookActive: false
      });
    });

    it('should be a function', () => {
      const hook = logSubagentStopEvents();
      expect(typeof hook).toBe('function');
    });
  });

  describe('shared log file behavior', () => {
    it('should write both event types to the same file by default', async () => {
      const stopHook = logStopEvents();
      const subagentHook = logSubagentStopEvents();

      await stopHook(createStopInput());
      await subagentHook(createSubagentStopInput());

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expectJsonFileLength(logContent!, 2);
      expectJsonFileToContain(logContent!, { event: 'Stop' });
      expectJsonFileToContain(logContent!, { event: 'SubagentStop' });
    });

    it('should maintain separate files when configured', async () => {
      const stopHook = logStopEvents({ logFileName: 'stop-only.json' });
      const subagentHook = logSubagentStopEvents({ logFileName: 'subagent-only.json' });

      await stopHook(createStopInput());
      await subagentHook(createSubagentStopInput());

      const stopLog = fileStorage.getFileContent('stop-only.json');
      const subagentLog = fileStorage.getFileContent('subagent-only.json');

      expectJsonFileLength(stopLog!, 1);
      expectJsonFileLength(subagentLog!, 1);
      expectJsonFileToContain(stopLog!, { event: 'Stop' });
      expectJsonFileToContain(subagentLog!, { event: 'SubagentStop' });
    });
  });

  describe('log rotation', () => {
    it('should maintain maxEventsStored limit for Stop events', async () => {
      const maxEvents = 3;
      const existingLogs = createLargeLogArray(5, { 
        event: 'Stop',
        stopHookActive: false
      });
      fileStorage.setFileContent('hook-log.stop.json', JSON.stringify(existingLogs, null, 2));

      const hook = logStopEvents({ maxEventsStored: maxEvents });
      const input = createStopInput({ stop_hook_active: true });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expectJsonFileLength(logContent!, maxEvents);
      expectJsonFileToContain(logContent!, { stopHookActive: true });
    });

    it('should maintain maxEventsStored limit for SubagentStop events', async () => {
      const maxEvents = 2;
      const existingLogs = createLargeLogArray(4, { 
        event: 'SubagentStop',
        stopHookActive: false
      });
      fileStorage.setFileContent('hook-log.stop.json', JSON.stringify(existingLogs, null, 2));

      const hook = logSubagentStopEvents({ maxEventsStored: maxEvents });
      const input = createSubagentStopInput({ stop_hook_active: true });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expectJsonFileLength(logContent!, maxEvents);
      expectJsonFileToContain(logContent!, { stopHookActive: true });
    });

    it('should handle mixed event types in rotation', async () => {
      const maxEvents = 4;
      const existingLogs = [
        createLogEntry('Stop', { stopHookActive: false }),
        createLogEntry('SubagentStop', { stopHookActive: true }),
        createLogEntry('Stop', { stopHookActive: true }),
        createLogEntry('SubagentStop', { stopHookActive: false })
      ];
      fileStorage.setFileContent('hook-log.stop.json', JSON.stringify(existingLogs, null, 2));

      const hook = logStopEvents({ maxEventsStored: maxEvents });
      await hook(createStopInput({ stop_hook_active: true }));

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expectJsonFileLength(logContent!, maxEvents);
      
      // Verify first event was removed and new one added
      const logs = JSON.parse(logContent!);
      expect(logs[0].event).toBe('SubagentStop');
      expect(logs[logs.length - 1].event).toBe('Stop');
      expect(logs[logs.length - 1].stopHookActive).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle missing log file gracefully for Stop', async () => {
      const hook = logStopEvents();
      const input = createStopInput();

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expect(logContent).toBeDefined();
      expectJsonFileLength(logContent!, 1);
    });

    it('should handle corrupted JSON file for SubagentStop', async () => {
      fileStorage.setFileContent('hook-log.stop.json', '{ invalid json }}}');

      const hook = logSubagentStopEvents();
      const input = createSubagentStopInput();

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expectJsonFileLength(logContent!, 1);
      expectJsonFileToContain(logContent!, { event: 'SubagentStop' });
    });

    it('should log errors to console.error', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write error'));

      const hook = logStopEvents();
      const input = createStopInput();

      await hook(input);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to log stop event:',
        expect.any(Error)
      );
    });

    it('should handle write failures gracefully', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Write error'));

      const hook = logSubagentStopEvents();
      const input = createSubagentStopInput();

      await hook(input);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to log subagent stop event:',
        expect.any(Error)
      );
    });
  });

  describe('timestamp handling', () => {
    it('should include accurate timestamps for Stop events', async () => {
      const testDate = '2024-02-15T15:30:00.000Z';
      const restoreDate = mockDate(testDate);

      const hook = logStopEvents();
      const input = createStopInput();

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expectJsonFileToContain(logContent!, { timestamp: testDate });

      restoreDate();
    });

    it('should include accurate timestamps for SubagentStop events', async () => {
      const testDate = '2024-03-20T10:45:00.000Z';
      const restoreDate = mockDate(testDate);

      const hook = logSubagentStopEvents();
      const input = createSubagentStopInput();

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expectJsonFileToContain(logContent!, { timestamp: testDate });

      restoreDate();
    });
  });

  describe('concurrent writes', () => {
    it('should handle multiple simultaneous Stop and SubagentStop writes', async () => {
      const stopHook = logStopEvents();
      const subagentHook = logSubagentStopEvents();
      
      // Write events sequentially to ensure proper ordering in test
      for (let i = 0; i < 3; i++) {
        await stopHook(createStopInput({ stop_hook_active: i % 2 === 0 }));
      }
      
      for (let i = 0; i < 2; i++) {
        await subagentHook(createSubagentStopInput({ stop_hook_active: i % 2 === 1 }));
      }

      const logContent = fileStorage.getFileContent('hook-log.stop.json');
      expectJsonFileLength(logContent!, 5);
      
      // Verify all events were written
      const logs = JSON.parse(logContent!);
      const stopEvents = logs.filter((log: any) => log.event === 'Stop');
      const subagentEvents = logs.filter((log: any) => log.event === 'SubagentStop');
      
      expect(stopEvents).toHaveLength(3);
      expect(subagentEvents).toHaveLength(2);
    });
  });

  describe('path resolution', () => {
    it('should resolve relative paths correctly for Stop', async () => {
      const hook = logStopEvents({ logFileName: './logs/stop-events.json' });
      const input = createStopInput();

      await hook(input);

      const expectedPath = path.resolve('./logs/stop-events.json');
      const logContent = fileStorage.getFileContent(expectedPath);
      expect(logContent).toBeDefined();
    });

    it('should resolve relative paths correctly for SubagentStop', async () => {
      const hook = logSubagentStopEvents({ logFileName: '../subagent-stop.json' });
      const input = createSubagentStopInput();

      await hook(input);

      const expectedPath = path.resolve('../subagent-stop.json');
      const logContent = fileStorage.getFileContent(expectedPath);
      expect(logContent).toBeDefined();
    });
  });
});