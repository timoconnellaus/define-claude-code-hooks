// Example: Log all stop events to hook-log.stop.json
import { defineHooks, logStopEvents, logSubagentStopEvents } from 'define-claude-code-hooks';

export default defineHooks({
  // Keep up to 100 stop events (default)
  Stop: [logStopEvents()],
  
  // Keep up to 50 subagent stop events in a custom file
  SubagentStop: [logSubagentStopEvents({ 
    maxEventsStored: 50,
    logFileName: 'subagent-stops.json'
  })]
});