import type {
  NotificationInput,
  StopInput,
  SubagentStopInput,
  PreToolUseInput,
  PostToolUseInput
} from '../../types';

export const createNotificationInput = (overrides?: Partial<NotificationInput>): NotificationInput => ({
  session_id: 'test-session-123',
  transcript_path: '/tmp/transcript.json',
  hook_event_name: 'Notification',
  message: 'Test notification message',
  ...overrides
});

export const createStopInput = (overrides?: Partial<StopInput>): StopInput => ({
  session_id: 'test-session-123',
  transcript_path: '/tmp/transcript.json',
  hook_event_name: 'Stop',
  stop_hook_active: false,
  ...overrides
});

export const createSubagentStopInput = (overrides?: Partial<SubagentStopInput>): SubagentStopInput => ({
  session_id: 'test-session-123',
  transcript_path: '/tmp/transcript.json',
  hook_event_name: 'SubagentStop',
  stop_hook_active: false,
  ...overrides
});

export const createPreToolUseInput = (overrides?: Partial<PreToolUseInput>): PreToolUseInput => ({
  session_id: 'test-session-123',
  transcript_path: '/tmp/transcript.json',
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'echo "test"' },
  ...overrides
});

export const createPostToolUseInput = (overrides?: Partial<PostToolUseInput>): PostToolUseInput => ({
  session_id: 'test-session-123',
  transcript_path: '/tmp/transcript.json',
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'echo "test"' },
  tool_response: { output: 'test' },
  ...overrides
});

export const createLogEntry = (event: string, additionalData: Record<string, any> = {}) => ({
  timestamp: new Date().toISOString(),
  event,
  sessionId: 'test-session-123',
  transcriptPath: '/tmp/transcript.json',
  ...additionalData
});