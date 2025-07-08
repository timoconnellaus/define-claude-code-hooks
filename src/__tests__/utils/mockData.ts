import type { 
  PreToolUseInput, 
  PostToolUseInput, 
  StopInput, 
  NotificationInput,
  SubagentStopInput
} from '../../types';

export function createPreToolUseInput(overrides: Partial<PreToolUseInput> = {}): PreToolUseInput {
  return {
    hook_event_name: 'PreToolUse',
    session_id: 'test-session-123',
    transcript_path: '/tmp/transcript.json',
    tool_name: 'Bash',
    tool_input: { command: 'echo "test"' },
    ...overrides
  };
}

export function createPostToolUseInput(overrides: Partial<PostToolUseInput> = {}): PostToolUseInput {
  return {
    hook_event_name: 'PostToolUse',
    session_id: 'test-session-123',
    transcript_path: '/tmp/transcript.json',
    tool_name: 'Bash',
    tool_input: { command: 'echo "test"' },
    tool_response: { output: 'test' },
    ...overrides
  };
}

export function createStopInput(overrides: Partial<StopInput> = {}): StopInput {
  return {
    hook_event_name: 'Stop',
    session_id: 'test-session-123',
    transcript_path: '/tmp/transcript.json',
    stop_hook_active: true,
    ...overrides
  };
}

export function createNotificationInput(overrides: Partial<NotificationInput> = {}): NotificationInput {
  return {
    hook_event_name: 'Notification',
    session_id: 'test-session-123',
    transcript_path: '/tmp/transcript.json',
    message: 'Test notification',
    ...overrides
  };
}

export function createSubagentStopInput(overrides: Partial<SubagentStopInput> = {}): SubagentStopInput {
  return {
    hook_event_name: 'SubagentStop',
    session_id: 'test-session-123',
    transcript_path: '/tmp/transcript.json',
    stop_hook_active: true,
    ...overrides
  };
}