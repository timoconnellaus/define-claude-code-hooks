// Example: Log only specific tools for debugging
import {
  defineHooks,
  logPreToolUseEvents,
  logPostToolUseEvents,
} from "@timoaus/define-claude-code-hooks";

export default defineHooks({
  PreToolUse: [
    // Log all file write operations
    logPreToolUseEvents("Write|Edit|MultiEdit", {
      maxEventsStored: 200,
      logFileName: "file-writes.json",
      includeToolInput: true,
    }),

    // Log all bash commands
    logPreToolUseEvents("Bash", {
      maxEventsStored: 300,
      logFileName: "bash-commands.json",
      includeToolInput: true,
    }),
  ],

  PostToolUse: [
    // Log bash command results
    logPostToolUseEvents("Bash", {
      maxEventsStored: 300,
      logFileName: "bash-results.json",
      includeToolInput: false,
      includeToolResponse: true,
    }),

    // Log file search operations
    logPostToolUseEvents("Grep|Glob|LS", {
      maxEventsStored: 100,
      logFileName: "file-searches.json",
      includeToolInput: true,
      includeToolResponse: true,
    }),
  ],
});
