import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logStopEvents } from '../../hooks/logStopEvents';
import { createStopInput, createSubagentStopInput } from '../utils/mockData';

vi.mock('fs/promises');

const mockFs = fs as any;

describe('logStopEvents', () => {
  const testLogPath = '/test/logs/stop.json';
  let originalCwd: () => string;

  beforeEach(() => {
    originalCwd = process.cwd;
    process.cwd = vi.fn().mockReturnValue('/test/project');
    
    vi.clearAllMocks();
    mockFs.readFile = vi.fn();
    mockFs.writeFile = vi.fn();
    mockFs.mkdir = vi.fn();
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  describe('Stop handler', () => {
    it('should log Stop events to file', async () => {
      const handler = logStopEvents(testLogPath);
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const input = createStopInput();
      const result = await handler(input);

      expect(result).toEqual({});
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname(testLogPath), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testLogPath,
        expect.stringContaining('"type":"Stop"'),
        'utf8'
      );

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData).toHaveLength(1);
      expect(writtenData[0]).toMatchObject({
        type: 'Stop',
        timestamp: expect.any(String),
        data: input
      });
    });

    it('should append to existing log file', async () => {
      const handler = logStopEvents(testLogPath);
      
      const existingLogs = [
        { type: 'Stop', timestamp: '2024-01-01', data: { reason: 'completed' } }
      ];
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogs, null, 2));
      
      const input = createStopInput({ reason: 'user_cancelled' });
      await handler(input);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData).toHaveLength(2);
      expect(writtenData[0]).toEqual(existingLogs[0]);
      expect(writtenData[1]).toMatchObject({
        type: 'Stop',
        data: input
      });
    });

    it('should handle maxEvents limit', async () => {
      const handler = logStopEvents(testLogPath, 3);
      
      const existingLogs = Array(5).fill(null).map((_, i) => ({
        type: 'Stop',
        timestamp: `2024-01-0${i + 1}`,
        data: { reason: 'completed' }
      }));
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogs, null, 2));
      
      const input = createStopInput();
      await handler(input);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData).toHaveLength(3);
      expect(writtenData[0]).toEqual(existingLogs[3]);
      expect(writtenData[1]).toEqual(existingLogs[4]);
      expect(writtenData[2]).toMatchObject({
        type: 'Stop',
        data: input
      });
    });

    it('should handle file write errors gracefully', async () => {
      const handler = logStopEvents(testLogPath);
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      const mockError = vi.spyOn(console, 'error');
      const input = createStopInput();
      const result = await handler(input);

      expect(result).toEqual({});
      expect(mockError).toHaveBeenCalledWith(
        'Failed to log stop event:',
        expect.any(Error)
      );
    });

    it('should handle corrupted log file', async () => {
      const handler = logStopEvents(testLogPath);
      
      mockFs.readFile.mockResolvedValue('not valid json');
      
      const mockError = vi.spyOn(console, 'error');
      const input = createStopInput();
      await handler(input);

      expect(mockError).toHaveBeenCalledWith(
        'Failed to parse existing log file, starting fresh:',
        expect.any(Error)
      );

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      expect(writtenData).toHaveLength(1);
    });
  });

  describe('SubagentStop handler', () => {
    it('should log SubagentStop events using logStopEvents', async () => {
      const { SubagentStop } = await import('../../hooks/logSubagentStopEvents');
      const handler = SubagentStop(testLogPath);
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const input = createSubagentStopInput();
      const result = await handler(input);

      expect(result).toEqual({});
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testLogPath,
        expect.stringContaining('"type":"SubagentStop"'),
        'utf8'
      );

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData[0]).toMatchObject({
        type: 'SubagentStop',
        timestamp: expect.any(String),
        data: input
      });
    });
  });

  describe('configuration', () => {
    it('should use default log path when not specified', async () => {
      const handler = logStopEvents();
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await handler(createStopInput());

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('/test/project', 'hook-log.stop.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('should respect absolute log path', async () => {
      const absolutePath = '/absolute/path/to/stop.log';
      const handler = logStopEvents(absolutePath);
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await handler(createStopInput());

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        absolutePath,
        expect.any(String),
        'utf8'
      );
    });

    it('should default maxEvents to 100', async () => {
      const handler = logStopEvents(testLogPath);
      
      // Create 150 existing logs
      const existingLogs = Array(150).fill(null).map((_, i) => ({
        type: 'Stop',
        timestamp: new Date(2024, 0, i + 1).toISOString(),
        data: { reason: 'completed' }
      }));
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogs, null, 2));
      
      await handler(createStopInput());

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      // Should keep only the last 100 events
      expect(writtenData).toHaveLength(100);
      expect(writtenData[0]).toEqual(existingLogs[50]); // 150 - 100 + 1 new = 51st element
    });
  });
});