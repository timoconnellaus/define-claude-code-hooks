import { defineHook } from '../index';
import { PreToolUseInput, PostToolUseInput, AnyHookDefinition } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ToolUseLogEntry {
  timestamp: string;
  event: string;
  sessionId: string;
  transcriptPath: string;
  toolName: string;
  toolInput?: Record<string, any>;
  toolResponse?: Record<string, any>;
}

interface LogToolUseEventsOptions {
  /**
   * Maximum number of events to store in the log file.
   * When the limit is reached, oldest events are removed first.
   * @default 100
   */
  maxEventsStored?: number;
  /**
   * Path to the log file relative to current working directory.
   * @default 'hook-log.tool-use.json'
   */
  logFileName?: string;
  /**
   * Whether to include the full tool input in the log.
   * Can be useful to disable for sensitive data or large inputs.
   * @default true
   */
  includeToolInput?: boolean;
  /**
   * Whether to include the full tool response in the log (PostToolUse only).
   * Can be useful to disable for sensitive data or large responses.
   * @default true
   */
  includeToolResponse?: boolean;
}

/**
 * Creates a PreToolUse hook that logs tool use events before execution
 * @param options Configuration options for the logger
 * @returns A PreToolUse hook definition
 */
export const logPreToolUseEvents = (options: LogToolUseEventsOptions = {}): AnyHookDefinition<'PreToolUse'> => {
  const maxEventsStored = options.maxEventsStored ?? 100;
  const logFileName = options.logFileName ?? 'hook-log.tool-use.json';
  const includeToolInput = options.includeToolInput ?? true;

  return defineHook('PreToolUse', {
    matcher: '.*', // Match all tools
    handler: async (input: PreToolUseInput) => {
      const logPath = path.join(process.cwd(), logFileName);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: input.hook_event_name,
        sessionId: input.session_id,
        transcriptPath: input.transcript_path,
        toolName: input.tool_name,
        ...(includeToolInput && { toolInput: input.tool_input })
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
        console.error('Failed to log pre-tool use event:', error);
      }
    }
  });
};

/**
 * Creates a PostToolUse hook that logs tool use events after execution
 * @param options Configuration options for the logger
 * @returns A PostToolUse hook definition
 */
export const logPostToolUseEvents = (options: LogToolUseEventsOptions = {}): AnyHookDefinition<'PostToolUse'> => {
  const maxEventsStored = options.maxEventsStored ?? 100;
  const logFileName = options.logFileName ?? 'hook-log.tool-use.json';
  const includeToolInput = options.includeToolInput ?? true;
  const includeToolResponse = options.includeToolResponse ?? true;

  return defineHook('PostToolUse', {
    matcher: '.*', // Match all tools
    handler: async (input: PostToolUseInput) => {
      const logPath = path.join(process.cwd(), logFileName);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: input.hook_event_name,
        sessionId: input.session_id,
        transcriptPath: input.transcript_path,
        toolName: input.tool_name,
        ...(includeToolInput && { toolInput: input.tool_input }),
        ...(includeToolResponse && { toolResponse: input.tool_response })
      };

      try {
        let logs: ToolUseLogEntry[] = [];
        
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
        console.error('Failed to log post-tool use event:', error);
      }
    }
  });
};

/**
 * Creates a PreToolUse hook that logs specific tools only
 * @param toolMatcher Regex pattern to match tool names (e.g., "Bash|Write|Edit")
 * @param options Configuration options for the logger
 * @returns A PreToolUse hook definition
 */
export const logPreToolUseEventsForTools = (
  toolMatcher: string, 
  options: LogToolUseEventsOptions = {}
): AnyHookDefinition<'PreToolUse'> => {
  const maxEventsStored = options.maxEventsStored ?? 100;
  const logFileName = options.logFileName ?? 'hook-log.tool-use.json';
  const includeToolInput = options.includeToolInput ?? true;

  return defineHook('PreToolUse', {
    matcher: toolMatcher,
    handler: async (input: PreToolUseInput) => {
      const logPath = path.join(process.cwd(), logFileName);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: input.hook_event_name,
        sessionId: input.session_id,
        transcriptPath: input.transcript_path,
        toolName: input.tool_name,
        ...(includeToolInput && { toolInput: input.tool_input })
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
        console.error('Failed to log pre-tool use event:', error);
      }
    }
  });
};

/**
 * Creates a PostToolUse hook that logs specific tools only
 * @param toolMatcher Regex pattern to match tool names (e.g., "Bash|Write|Edit")
 * @param options Configuration options for the logger
 * @returns A PostToolUse hook definition
 */
export const logPostToolUseEventsForTools = (
  toolMatcher: string,
  options: LogToolUseEventsOptions = {}
): AnyHookDefinition<'PostToolUse'> => {
  const maxEventsStored = options.maxEventsStored ?? 100;
  const logFileName = options.logFileName ?? 'hook-log.tool-use.json';
  const includeToolInput = options.includeToolInput ?? true;
  const includeToolResponse = options.includeToolResponse ?? true;

  return defineHook('PostToolUse', {
    matcher: toolMatcher,
    handler: async (input: PostToolUseInput) => {
      const logPath = path.join(process.cwd(), logFileName);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: input.hook_event_name,
        sessionId: input.session_id,
        transcriptPath: input.transcript_path,
        toolName: input.tool_name,
        ...(includeToolInput && { toolInput: input.tool_input }),
        ...(includeToolResponse && { toolResponse: input.tool_response })
      };

      try {
        let logs: ToolUseLogEntry[] = [];
        
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
        console.error('Failed to log post-tool use event:', error);
      }
    }
  });
};