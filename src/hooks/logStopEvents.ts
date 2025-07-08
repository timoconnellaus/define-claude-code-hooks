import { defineHook } from '../index';
import { StopInput, SubagentStopInput, AnyHookDefinition } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

interface LogStopEventsOptions {
  /**
   * Maximum number of events to store in the log file.
   * When the limit is reached, oldest events are removed first.
   * @default 100
   */
  maxEventsStored?: number;
  /**
   * Path to the log file relative to current working directory.
   * @default 'hook-log.stop.json'
   */
  logFileName?: string;
}

/**
 * Creates a Stop hook that logs stop events to a JSON file
 * @param options Configuration options for the logger
 * @returns A Stop hook definition
 */
export const logStopEvents = (options: LogStopEventsOptions = {}): AnyHookDefinition<'Stop'> => {
  const maxEventsStored = options.maxEventsStored ?? 100;
  const logFileName = options.logFileName ?? 'hook-log.stop.json';

  return defineHook('Stop', async (input: StopInput) => {
    const logPath = path.join(process.cwd(), logFileName);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: input.hook_event_name,
      sessionId: input.session_id,
      transcriptPath: input.transcript_path,
      stopHookActive: input.stop_hook_active
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
      console.error('Failed to log stop event:', error);
    }
  });
};

/**
 * Creates a SubagentStop hook that logs subagent stop events to a JSON file
 * @param options Configuration options for the logger
 * @returns A SubagentStop hook definition
 */
export const logSubagentStopEvents = (options: LogStopEventsOptions = {}): AnyHookDefinition<'SubagentStop'> => {
  const maxEventsStored = options.maxEventsStored ?? 100;
  const logFileName = options.logFileName ?? 'hook-log.stop.json';

  return defineHook('SubagentStop', async (input: SubagentStopInput) => {
    const logPath = path.join(process.cwd(), logFileName);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: input.hook_event_name,
      sessionId: input.session_id,
      transcriptPath: input.transcript_path,
      stopHookActive: input.stop_hook_active
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
      console.error('Failed to log subagent stop event:', error);
    }
  });
};