// Example: Log only specific tools for debugging
import { 
  defineHooks,
  logPreToolUseEventsForTools,
  logPostToolUseEventsForTools 
} from 'define-claude-code-hooks';

export default defineHooks({
  PreToolUse: [
    // Log all file write operations
    logPreToolUseEventsForTools('Write|Edit|MultiEdit', {
      maxEventsStored: 200,
      logFileName: 'file-writes.json',
      includeToolInput: true
    }),
    
    // Log all bash commands
    logPreToolUseEventsForTools('Bash', {
      maxEventsStored: 300,
      logFileName: 'bash-commands.json',
      includeToolInput: true
    })
  ],
  
  PostToolUse: [
    // Log bash command results
    logPostToolUseEventsForTools('Bash', {
      maxEventsStored: 300,
      logFileName: 'bash-results.json',
      includeToolInput: false,
      includeToolResponse: true
    }),
    
    // Log file search operations
    logPostToolUseEventsForTools('Grep|Glob|LS', {
      maxEventsStored: 100,
      logFileName: 'file-searches.json',
      includeToolInput: true,
      includeToolResponse: true
    })
  ]
});