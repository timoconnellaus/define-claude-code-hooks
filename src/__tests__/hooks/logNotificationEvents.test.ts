import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logNotificationEvents } from '../../hooks/logNotificationEvents';
import { createNotificationInput } from '../utils/mockData';

vi.mock('fs/promises');

const mockFs = fs as any;

describe('logNotificationEvents', () => {
  const testLogPath = '/test/logs/notifications.json';
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

  describe('Notification handler', () => {
    it('should log notification events to file', async () => {
      const handler = logNotificationEvents(testLogPath);
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const input = createNotificationInput();
      const result = await handler(input);

      expect(result).toEqual({});
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname(testLogPath), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testLogPath,
        expect.stringContaining('"type":"Notification"'),
        'utf8'
      );

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData).toHaveLength(1);
      expect(writtenData[0]).toMatchObject({
        type: 'Notification',
        timestamp: expect.any(String),
        data: input
      });
    });

    it('should log different notification levels', async () => {
      const handler = logNotificationEvents(testLogPath);
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const levels = ['info', 'warning', 'error'] as const;
      
      for (const level of levels) {
        vi.clearAllMocks();
        mockFs.readFile.mockResolvedValue('[]');
        
        const input = createNotificationInput({ level, message: `${level} message` });
        await handler(input);

        const writeCall = mockFs.writeFile.mock.calls[0];
        const writtenData = JSON.parse(writeCall[1]);
        
        expect(writtenData[0]).toMatchObject({
          type: 'Notification',
          data: {
            level,
            message: `${level} message`
          }
        });
      }
    });

    it('should append to existing log file', async () => {
      const handler = logNotificationEvents(testLogPath);
      
      const existingLogs = [
        { 
          type: 'Notification', 
          timestamp: '2024-01-01', 
          data: { level: 'info', message: 'old notification' } 
        }
      ];
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogs, null, 2));
      
      const input = createNotificationInput({ level: 'warning', message: 'new warning' });
      await handler(input);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData).toHaveLength(2);
      expect(writtenData[0]).toEqual(existingLogs[0]);
      expect(writtenData[1]).toMatchObject({
        type: 'Notification',
        data: input
      });
    });

    it('should handle maxEvents limit', async () => {
      const handler = logNotificationEvents(testLogPath, 5);
      
      const existingLogs = Array(10).fill(null).map((_, i) => ({
        type: 'Notification',
        timestamp: `2024-01-0${i + 1}`,
        data: { level: 'info', message: `Message ${i}` }
      }));
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogs, null, 2));
      
      const input = createNotificationInput();
      await handler(input);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData).toHaveLength(5);
      expect(writtenData[0]).toEqual(existingLogs[6]);
      expect(writtenData[4]).toMatchObject({
        type: 'Notification',
        data: input
      });
    });

    it('should handle file write errors gracefully', async () => {
      const handler = logNotificationEvents(testLogPath);
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      const mockError = vi.spyOn(console, 'error');
      const input = createNotificationInput();
      const result = await handler(input);

      expect(result).toEqual({});
      expect(mockError).toHaveBeenCalledWith(
        'Failed to log notification event:',
        expect.any(Error)
      );
    });

    it('should handle corrupted log file', async () => {
      const handler = logNotificationEvents(testLogPath);
      
      mockFs.readFile.mockResolvedValue('{ invalid json');
      
      const mockError = vi.spyOn(console, 'error');
      const input = createNotificationInput();
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

  describe('configuration', () => {
    it('should use default log path when not specified', async () => {
      const handler = logNotificationEvents();
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await handler(createNotificationInput());

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('/test/project', 'hook-log.notification.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('should respect absolute log path', async () => {
      const absolutePath = '/absolute/path/notifications.log';
      const handler = logNotificationEvents(absolutePath);
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await handler(createNotificationInput());

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        absolutePath,
        expect.any(String),
        'utf8'
      );
    });

    it('should handle relative log path', async () => {
      const relativePath = './logs/notify.json';
      const handler = logNotificationEvents(relativePath);
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await handler(createNotificationInput());

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('/test/project', 'logs/notify.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('should default maxEvents to 100', async () => {
      const handler = logNotificationEvents(testLogPath);
      
      const existingLogs = Array(150).fill(null).map((_, i) => ({
        type: 'Notification',
        timestamp: new Date(2024, 0, i + 1).toISOString(),
        data: { level: 'info', message: `Message ${i}` }
      }));
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogs, null, 2));
      
      await handler(createNotificationInput());

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      
      expect(writtenData).toHaveLength(100);
    });
  });
});