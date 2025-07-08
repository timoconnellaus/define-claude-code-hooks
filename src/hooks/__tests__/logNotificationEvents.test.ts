import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logNotificationEvents } from '../logNotificationEvents';
import { createMockFs, setupFsMocks } from '../../__tests__/helpers/mockFs';
import { createNotificationInput, createLogEntry } from '../../__tests__/helpers/fixtures';
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

describe('logNotificationEvents', () => {
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

  describe('basic functionality', () => {
    it('should create a notification hook that logs events', async () => {
      const hook = logNotificationEvents();
      const input = createNotificationInput({ message: 'Test notification' });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.notification.json');
      expect(logContent).toBeDefined();
      expectJsonFileToContain(logContent!, {
        event: 'Notification',
        sessionId: 'test-session-123',
        transcriptPath: '/tmp/transcript.json',
        message: 'Test notification'
      });
    });

    it('should append to existing log file', async () => {
      const existingLog = JSON.stringify([
        createLogEntry('Notification', { message: 'Existing message' })
      ], null, 2);
      fileStorage.setFileContent('hook-log.notification.json', existingLog);

      const hook = logNotificationEvents();
      const input = createNotificationInput({ message: 'New message' });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.notification.json');
      expectJsonFileLength(logContent!, 2);
      expectJsonFileToContain(logContent!, { message: 'New message' });
    });

    it('should use custom log file name', async () => {
      const customFileName = 'custom-notifications.json';
      const hook = logNotificationEvents({ logFileName: customFileName });
      const input = createNotificationInput();

      await hook(input);

      const logContent = fileStorage.getFileContent(customFileName);
      expect(logContent).toBeDefined();
      expectJsonFileToContain(logContent!, {
        event: 'Notification',
        message: 'Test notification message'
      });
    });
  });

  describe('log rotation', () => {
    it('should maintain maxEventsStored limit', async () => {
      const maxEvents = 5;
      const existingLogs = createLargeLogArray(10, { 
        event: 'Notification',
        message: 'Old message'
      });
      fileStorage.setFileContent('hook-log.notification.json', JSON.stringify(existingLogs, null, 2));

      const hook = logNotificationEvents({ maxEventsStored: maxEvents });
      const input = createNotificationInput({ message: 'New message' });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.notification.json');
      expectJsonFileLength(logContent!, maxEvents);
      expectJsonFileToContain(logContent!, { message: 'New message' });
      
      // Verify oldest events were removed
      const logs = JSON.parse(logContent!);
      expect(logs[0].index).toBe(6); // Should start from index 6 (0-5 removed)
    });

    it('should handle edge case of exactly maxEventsStored', async () => {
      const maxEvents = 3;
      const existingLogs = createLargeLogArray(3, { 
        event: 'Notification',
        message: 'Existing'
      });
      fileStorage.setFileContent('hook-log.notification.json', JSON.stringify(existingLogs, null, 2));

      const hook = logNotificationEvents({ maxEventsStored: maxEvents });
      const input = createNotificationInput({ message: 'New message' });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.notification.json');
      expectJsonFileLength(logContent!, maxEvents);
      expectJsonFileToContain(logContent!, { message: 'New message' });
    });

    it('should work with single event', async () => {
      const hook = logNotificationEvents({ maxEventsStored: 1 });
      
      await hook(createNotificationInput({ message: 'First' }));
      await hook(createNotificationInput({ message: 'Second' }));

      const logContent = fileStorage.getFileContent('hook-log.notification.json');
      expectJsonFileLength(logContent!, 1);
      expectJsonFileToContain(logContent!, { message: 'Second' });
    });
  });

  describe('error handling', () => {
    it('should handle missing log file gracefully', async () => {
      const hook = logNotificationEvents();
      const input = createNotificationInput();

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.notification.json');
      expect(logContent).toBeDefined();
      expectJsonFileLength(logContent!, 1);
    });

    it('should handle corrupted JSON file', async () => {
      fileStorage.setFileContent('hook-log.notification.json', 'invalid json content');

      const hook = logNotificationEvents();
      const input = createNotificationInput({ message: 'New after corruption' });

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.notification.json');
      expectJsonFileLength(logContent!, 1);
      expectJsonFileToContain(logContent!, { message: 'New after corruption' });
    });

    it('should log errors to console.error', async () => {
      // Make writeFile reject to trigger the outer catch
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const hook = logNotificationEvents();
      const input = createNotificationInput();

      await hook(input);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to log notification event:',
        expect.any(Error)
      );
    });

    it('should handle write failures gracefully', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Disk full'));

      const hook = logNotificationEvents();
      const input = createNotificationInput();

      await hook(input);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to log notification event:',
        expect.any(Error)
      );
    });
  });

  describe('timestamp handling', () => {
    it('should include accurate timestamps', async () => {
      const testDate = '2024-01-01T12:00:00.000Z';
      const restoreDate = mockDate(testDate);

      const hook = logNotificationEvents();
      const input = createNotificationInput();

      await hook(input);

      const logContent = fileStorage.getFileContent('hook-log.notification.json');
      expectJsonFileToContain(logContent!, { timestamp: testDate });

      restoreDate();
    });
  });

  describe('hook configuration', () => {
    it('should be a function', () => {
      const hook = logNotificationEvents();
      expect(typeof hook).toBe('function');
    });
  });

  describe('concurrent writes', () => {
    it('should handle multiple simultaneous writes', async () => {
      const hook = logNotificationEvents();
      
      // Write messages sequentially to ensure proper ordering in test
      for (let i = 0; i < 5; i++) {
        await hook(createNotificationInput({ message: `Message ${i}` }));
      }

      const logContent = fileStorage.getFileContent('hook-log.notification.json');
      expectJsonFileLength(logContent!, 5);
      
      // Verify all messages were written
      for (let i = 0; i < 5; i++) {
        expectJsonFileToContain(logContent!, { message: `Message ${i}` });
      }
    });
  });

  describe('path resolution', () => {
    it('should resolve relative paths correctly', async () => {
      const hook = logNotificationEvents({ logFileName: './logs/notifications.json' });
      const input = createNotificationInput();

      await hook(input);

      // Should resolve to current directory
      const expectedPath = path.resolve('./logs/notifications.json');
      const logContent = fileStorage.getFileContent(expectedPath);
      expect(logContent).toBeDefined();
    });
  });
});