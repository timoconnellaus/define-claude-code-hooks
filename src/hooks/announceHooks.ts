import { defineHook } from '../index';
import { StopInput, SubagentStopInput, PreToolUseInput, PostToolUseInput, NotificationInput, AnyHookDefinition } from '../types';
import { spawn } from 'child_process';

export interface AnnouncementOptions {
  /**
   * The message to speak.
   * Supports template variables:
   * - {sessionId} - The session ID
   * - {timestamp} - Current timestamp
   * - {toolName} - Tool name (for tool hooks)
   * - {message} - Notification message (for notification hook)
   * @default Varies by hook type
   */
  message?: string;

  /**
   * The voice to use for TTS (system-specific).
   * On macOS: Use 'say -v ?' to list available voices
   * On Linux: Depends on the TTS engine installed
   * @default undefined (uses system default)
   */
  voice?: string;

  /**
   * The speech rate (words per minute).
   * @default undefined (uses system default)
   */
  rate?: number;

  /**
   * Whether to suppress the hook's console output
   * @default false
   */
  suppressOutput?: boolean;

  /**
   * Custom TTS command to use instead of the default.
   * Should include {message} placeholder for the text to speak.
   * Example: "espeak '{message}'" or "say -v Daniel '{message}'"
   * @default undefined (auto-detects based on platform)
   */
  customCommand?: string;
}

// Helper function to speak text
async function speak(text: string, options: AnnouncementOptions): Promise<{ suppressOutput?: boolean }> {
  try {
    const { voice, rate, suppressOutput = false, customCommand } = options;

    // Determine the TTS command based on platform
    let command: string = '';
    let args: string[] = [];

    if (customCommand) {
      // Use custom command
      const fullCommand = customCommand.replace('{message}', text);
      // Split command and args (simple split, doesn't handle quoted args perfectly)
      const parts = fullCommand.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      command = parts[0] || '';
      args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, ''));
    } else if (process.platform === 'darwin') {
      // macOS: use 'say' command
      command = 'say';
      args = [];
      if (voice) args.push('-v', voice);
      if (rate) args.push('-r', rate.toString());
      args.push(text);
    } else if (process.platform === 'linux') {
      // Linux: try espeak (most common)
      command = 'espeak';
      args = [];
      if (rate) args.push('-s', rate.toString());
      args.push(text);
    } else if (process.platform === 'win32') {
      // Windows: use PowerShell with SAPI
      command = 'powershell';
      args = [
        '-Command',
        `Add-Type -AssemblyName System.Speech; ` +
        `$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
        (voice ? `$synth.SelectVoice("${voice}"); ` : '') +
        (rate ? `$synth.Rate = ${Math.round((rate - 150) / 15)}; ` : '') + // Convert WPM to -10 to 10 scale
        `$synth.Speak("${text.replace(/"/g, '`"')}")`
      ];
    } else {
      if (!suppressOutput) {
        console.log('[TTS] Unsupported platform for text-to-speech');
      }
      return { suppressOutput };
    }

    // Spawn the TTS process
    const ttsProcess = spawn(command, args, {
      detached: false,
      stdio: 'ignore'
    });

    // Don't wait for the process to complete - let it run in background
    ttsProcess.unref();

    if (!suppressOutput) {
      console.log(`[TTS] Speaking: "${text}"`);
    }

    return { suppressOutput };
  } catch (error) {
    if (!options.suppressOutput) {
      console.error('[TTS] Error:', error instanceof Error ? error.message : String(error));
    }
    return { suppressOutput: options.suppressOutput };
  }
}

/**
 * Creates a Stop hook that announces when tasks complete using text-to-speech.
 * 
 * @example
 * ```typescript
 * import { defineHooks, announceStop } from 'define-claude-code-hooks';
 * 
 * export default defineHooks({
 *   Stop: [announceStop()]
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // With custom message and voice
 * export default defineHooks({
 *   Stop: [announceStop({
 *     message: "Claude has finished the task for session {sessionId}",
 *     voice: "Samantha", // macOS voice
 *     rate: 200
 *   })]
 * });
 * ```
 */
export const announceStop = (options: AnnouncementOptions = {}): AnyHookDefinition<'Stop'> => {
  const defaultMessage = "Task completed";
  
  return defineHook('Stop', async (input: StopInput) => {
    const message = (options.message || defaultMessage)
      .replace('{sessionId}', input.session_id)
      .replace('{timestamp}', new Date().toLocaleString());
    
    return speak(message, options);
  });
};

/**
 * Creates a SubagentStop hook that announces subagent task completion using text-to-speech.
 * 
 * @example
 * ```typescript
 * import { defineHooks, announceSubagentStop } from 'define-claude-code-hooks';
 * 
 * export default defineHooks({
 *   SubagentStop: [announceSubagentStop()]
 * });
 * ```
 */
export const announceSubagentStop = (options: AnnouncementOptions = {}): AnyHookDefinition<'SubagentStop'> => {
  const defaultMessage = "Subagent task completed";
  
  return defineHook('SubagentStop', async (input: SubagentStopInput) => {
    const message = (options.message || defaultMessage)
      .replace('{sessionId}', input.session_id)
      .replace('{timestamp}', new Date().toLocaleString());
    
    return speak(message, options);
  });
};

/**
 * Creates a PreToolUse hook that announces tool usage before execution.
 * 
 * @example
 * ```typescript
 * import { defineHooks, announcePreToolUse } from 'define-claude-code-hooks';
 * 
 * export default defineHooks({
 *   PreToolUse: [
 *     announcePreToolUse('.*') // Announce all tools
 *   ]
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Only announce specific tools
 * export default defineHooks({
 *   PreToolUse: [
 *     announcePreToolUse('Bash|Write|Edit', {
 *       message: "Running {toolName} tool"
 *     })
 *   ]
 * });
 * ```
 */
export const announcePreToolUse = (matcher: string = '.*', options: AnnouncementOptions = {}): AnyHookDefinition<'PreToolUse'> => {
  const defaultMessage = "Using {toolName}";
  
  return defineHook('PreToolUse', {
    matcher,
    handler: async (input: PreToolUseInput) => {
      const message = (options.message || defaultMessage)
        .replace('{toolName}', input.tool_name)
        .replace('{sessionId}', input.session_id)
        .replace('{timestamp}', new Date().toLocaleString());
      
      return speak(message, options);
    }
  });
};

/**
 * Creates a PostToolUse hook that announces tool usage after execution.
 * 
 * @example
 * ```typescript
 * import { defineHooks, announcePostToolUse } from 'define-claude-code-hooks';
 * 
 * export default defineHooks({
 *   PostToolUse: [
 *     announcePostToolUse('.*', {
 *       message: "{toolName} completed"
 *     })
 *   ]
 * });
 * ```
 */
export const announcePostToolUse = (matcher: string = '.*', options: AnnouncementOptions = {}): AnyHookDefinition<'PostToolUse'> => {
  const defaultMessage = "{toolName} completed";
  
  return defineHook('PostToolUse', {
    matcher,
    handler: async (input: PostToolUseInput) => {
      const message = (options.message || defaultMessage)
        .replace('{toolName}', input.tool_name)
        .replace('{sessionId}', input.session_id)
        .replace('{timestamp}', new Date().toLocaleString());
      
      return speak(message, options);
    }
  });
};

/**
 * Creates a Notification hook that speaks notification messages aloud.
 * 
 * @example
 * ```typescript
 * import { defineHooks, announceNotification } from 'define-claude-code-hooks';
 * 
 * export default defineHooks({
 *   Notification: [announceNotification()]
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // With custom prefix
 * export default defineHooks({
 *   Notification: [
 *     announceNotification({
 *       message: "Claude says: {message}"
 *     })
 *   ]
 * });
 * ```
 */
export const announceNotification = (options: AnnouncementOptions = {}): AnyHookDefinition<'Notification'> => {
  const defaultMessage = "{message}";
  
  return defineHook('Notification', async (input: NotificationInput) => {
    const message = (options.message || defaultMessage)
      .replace('{message}', input.message)
      .replace('{sessionId}', input.session_id)
      .replace('{timestamp}', new Date().toLocaleString());
    
    return speak(message, options);
  });
};

// Legacy exports for backwards compatibility
export const announceTaskCompletion = announceStop;
export const announceSubagentTaskCompletion = announceSubagentStop;