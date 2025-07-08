// Common input fields for all hook types
interface BaseHookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

// Tool-specific inputs
export interface PreToolUseInput extends BaseHookInput {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: Record<string, any>;
}

export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, any>;
  tool_response: Record<string, any>;
}

export interface NotificationInput extends BaseHookInput {
  hook_event_name: 'Notification';
  message: string;
}

export interface StopInput extends BaseHookInput {
  hook_event_name: 'Stop';
  stop_hook_active: boolean;
}

export interface SubagentStopInput extends BaseHookInput {
  hook_event_name: 'SubagentStop';
  stop_hook_active: boolean;
}

// Union type for all hook inputs
export type HookInput = 
  | PreToolUseInput 
  | PostToolUseInput 
  | NotificationInput 
  | StopInput 
  | SubagentStopInput;

// Common output fields
interface BaseHookOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
}

// Decision control for different hook types
export interface PreToolUseOutput extends BaseHookOutput {
  decision?: 'approve' | 'block';
  reason?: string;
}

export interface PostToolUseOutput extends BaseHookOutput {
  decision?: 'block';
  reason?: string;
}

export interface StopOutput extends BaseHookOutput {
  decision?: 'block';
  reason?: string;
}

export type NotificationOutput = BaseHookOutput;
export type SubagentStopOutput = StopOutput;

// Map hook types to their input/output types
export interface HookTypeMap {
  PreToolUse: {
    input: PreToolUseInput;
    output: PreToolUseOutput;
  };
  PostToolUse: {
    input: PostToolUseInput;
    output: PostToolUseOutput;
  };
  Notification: {
    input: NotificationInput;
    output: NotificationOutput;
  };
  Stop: {
    input: StopInput;
    output: StopOutput;
  };
  SubagentStop: {
    input: SubagentStopInput;
    output: SubagentStopOutput;
  };
}

export type HookType = keyof HookTypeMap;

// Handler function type
export type HookHandler<T extends HookType> = (
  input: HookTypeMap[T]['input']
) => HookTypeMap[T]['output'] | void | Promise<HookTypeMap[T]['output'] | void>;

// Hook definition for tool-based hooks (PreToolUse, PostToolUse)
export interface ToolHookDefinition<T extends 'PreToolUse' | 'PostToolUse'> {
  matcher: string;
  handler: HookHandler<T>;
}

// Hook definition for non-tool hooks
export type NonToolHookDefinition<T extends HookType> = T extends Exclude<HookType, 'PreToolUse' | 'PostToolUse'> ? HookHandler<T> : never;

// Combined hook definition type
export type AnyHookDefinition<T extends HookType> = 
  T extends 'PreToolUse' | 'PostToolUse' 
    ? ToolHookDefinition<T>
    : NonToolHookDefinition<T>;

// Exit codes
export enum ExitCode {
  SUCCESS = 0,
  ERROR = 1,
  BLOCKING_ERROR = 2,
}

// Hook definition for settings.json
export interface HookCommand {
  type: 'command';
  command: string;
  timeout?: number;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookCommand[];
}

export interface HookSettings {
  hooks?: {
    PreToolUse?: HookMatcher[];
    PostToolUse?: HookMatcher[];
    Notification?: HookMatcher[];
    Stop?: HookMatcher[];
    SubagentStop?: HookMatcher[];
  };
}

// Hook definitions for defineHooks
export type HookDefinition = {
  PreToolUse?: ToolHookDefinition<'PreToolUse'>[];
  PostToolUse?: ToolHookDefinition<'PostToolUse'>[];
  Notification?: NonToolHookDefinition<'Notification'>[];
  Stop?: NonToolHookDefinition<'Stop'>[];
  SubagentStop?: NonToolHookDefinition<'SubagentStop'>[];
};