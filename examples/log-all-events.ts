// Example: Log all different types of events to separate JSON files
import { 
  defineHooks, 
  logStopEvents, 
  logSubagentStopEvents,
  logNotificationEvents,
  logPreToolUseEvents,
  logPostToolUseEvents 
} from 'define-claude-code-hooks';

export default defineHooks({
  // Log all notification events
  Notification: [
    logNotificationEvents({ 
      maxEventsStored: 200,
      logFileName: 'notifications.json' 
    })
  ],
  
  // Log all tool uses (before and after)
  PreToolUse: [
    logPreToolUseEvents({ 
      maxEventsStored: 500,
      includeToolInput: true 
    })
  ],
  
  PostToolUse: [
    logPostToolUseEvents({ 
      maxEventsStored: 500,
      includeToolInput: false, // Don't duplicate input
      includeToolResponse: true 
    })
  ],
  
  // Log stop events to separate files
  Stop: [logStopEvents({ 
    maxEventsStored: 100,
    logFileName: 'stops.json'
  })],
  SubagentStop: [logSubagentStopEvents({ 
    maxEventsStored: 100,
    logFileName: 'subagent-stops.json'
  })]
});