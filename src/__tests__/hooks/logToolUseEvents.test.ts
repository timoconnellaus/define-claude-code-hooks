import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logPreToolUseEvents, logPostToolUseEvents } from '../../hooks/logToolUseEvents';
import { createPreToolUseInput, createPostToolUseInput } from '../utils/mockData';

vi.mock('fs/promises');

const mockFs = fs as any;

describe('logToolUseEvents', () => {
  const testLogPath = '/test/logs/tool-use.json';
  let originalCwd: () => string;

  beforeEach(() => {
    originalCwd = process.cwd;
    process.cwd = vi.fn().mockReturnValue('/test/project');
    
    // Reset mocks
    vi.clearAllMocks();
    mockFs.readFile = vi.fn();
    mockFs.writeFile = vi.fn();
    mockFs.mkdir = vi.fn();
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  describe('PreToolUse handler', () => {
    it('should log PreToolUse events to file', async () => {
      const preHook = logPreToolUseEvents({ logFileName: testLogPath });
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' }); // File doesn't exist
      
      const input = createPreToolUseInput();
      const result = await preHook.handler(input);

      expect(result).toBeUndefined();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testLogPath,
        expect.any(String),
        expect.any(Object)
      );

      // Verify logged data structure
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData).toHaveLength(1);
      expect(writtenData[0]).toMatchObject({
        event: 'PreToolUse',
        timestamp: expect.any(String),
        toolName: input.tool_name,
        toolInput: input.tool_input
      });
    });

    it('should append to existing log file', async () => {
      const preHook = logPreToolUseEvents({ logFileName: testLogPath });
      
      const existingLogs = [
        { event: 'PreToolUse', timestamp: '2024-01-01', toolName: 'Bash' }
      ];
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogs, null, 2));
      
      const input = createPreToolUseInput();
      await preHook.handler(input);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData).toHaveLength(2);
      expect(writtenData[0]).toEqual(existingLogs[0]);
      expect(writtenData[1]).toMatchObject({
        event: 'PreToolUse',
        toolName: input.tool_name
      });
    });

    it('should handle maxEvents limit', async () => {
      const preHook = logPreToolUseEvents({ logFileName: testLogPath, maxEventsStored: 2 });
      
      const existingLogs = [
        { event: 'PreToolUse', timestamp: '2024-01-01', toolName: 'Bash' },
        { event: 'PostToolUse', timestamp: '2024-01-02', toolName: 'Write' },
        { event: 'PreToolUse', timestamp: '2024-01-03', toolName: 'Edit' }
      ];
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogs, null, 2));
      
      const input = createPreToolUseInput();
      await preHook.handler(input);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      // Should keep only the last 2 events
      expect(writtenData).toHaveLength(2);
      expect(writtenData[0]).toEqual(existingLogs[2]); // Most recent from existing
      expect(writtenData[1]).toMatchObject({
        event: 'PreToolUse',
        toolName: input.tool_name
      });
    });
  });

  describe('PostToolUse handler', () => {
    it('should log PostToolUse events to file', async () => {
      const postHook = logPostToolUseEvents({ logFileName: testLogPath });
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const input = createPostToolUseInput();
      const result = await postHook.handler(input);

      expect(result).toBeUndefined();
      expect(mockFs.writeFile).toHaveBeenCalled();

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData[0]).toMatchObject({
        event: 'PostToolUse',
        timestamp: expect.any(String),
        toolName: input.tool_name,
        toolInput: input.tool_input,
        toolResponse: input.tool_response
      });
    });

    it('should handle file write errors gracefully', async () => {
      const postHook = logPostToolUseEvents({ logFileName: testLogPath });
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      const mockError = vi.spyOn(console, 'error');
      const input = createPostToolUseInput();
      const result = await postHook.handler(input);

      // Should not throw, just log error
      expect(result).toBeUndefined();
      expect(mockError).toHaveBeenCalledWith(
        'Failed to log post-tool use event:',
        expect.any(Error)
      );
    });

    it('should handle corrupted log file', async () => {
      const postHook = logPostToolUseEvents({ logFileName: testLogPath });
      
      mockFs.readFile.mockResolvedValue('invalid json');
      
      const input = createPostToolUseInput();
      await postHook.handler(input);

      // Should write new log file with just the new event
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      expect(writtenData).toHaveLength(1);
    });
  });

  describe('configuration', () => {
    it('should use default log path when not specified', async () => {
      const preHook = logPreToolUseEvents();
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await preHook.handler(createPreToolUseInput());

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('/test/project', 'hook-log.tool-use.json'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should respect absolute log path', async () => {
      const absolutePath = '/absolute/path/to/log.json';
      const preHook = logPreToolUseEvents({ logFileName: absolutePath });
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await preHook.handler(createPreToolUseInput());

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        absolutePath,
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle relative log path', async () => {
      const relativePath = './logs/events.json';
      const preHook = logPreToolUseEvents({ logFileName: relativePath });
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await preHook.handler(createPreToolUseInput());

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('/test/project', 'logs/events.json'),
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});