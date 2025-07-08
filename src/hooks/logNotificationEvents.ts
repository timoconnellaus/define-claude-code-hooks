import { defineHook } from '../index';
import { NotificationInput, AnyHookDefinition } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

interface LogNotificationEventsOptions {
  /**
   * Maximum number of events to store in the log file.
   * When the limit is reached, oldest events are removed first.
   * @default 100
   */
  maxEventsStored?: number;
  /**
   * Path to the log file relative to current working directory.
   * @default 'hook-log.notification.json'
   */
  logFileName?: string;
}

/**
 * Creates a Notification hook that logs notification events to a JSON file
 * @param options Configuration options for the logger
 * @returns A Notification hook definition
 */
export const logNotificationEvents = (options: LogNotificationEventsOptions = {}): AnyHookDefinition<'Notification'> => {
  const maxEventsStored = options.maxEventsStored ?? 100;
  const logFileName = options.logFileName ?? 'hook-log.notification.json';

  return defineHook('Notification', async (input: NotificationInput) => {
    const logPath = path.join(process.cwd(), logFileName);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: input.hook_event_name,
      sessionId: input.session_id,
      transcriptPath: input.transcript_path,
      message: input.message
    };

    try {
      let logs: typeof logEntry[] = [];
      
      try {
        const existingData = await fs.readFile(logPath, 'utf-8');
        logs = JSON.parse(existingData);
      } catch {
        // File doesn't exist or is invalid, start with empty array
      }
      
      logs.push(logEntry);
      
      // Keep only the most recent entries up to maxEventsStored
      if (logs.length > maxEventsStored) {
        logs = logs.slice(-maxEventsStored);
      }
      
      await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Failed to log notification event:', error);
    }
  });
};