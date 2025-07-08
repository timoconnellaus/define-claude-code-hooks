import {
  defineHooks,
  logStopEvents,
  logSubagentStopEvents,
  logPostToolUseEvents,
  logPreToolUseEvents,
  logNotificationEvents,
} from "../..";

export default defineHooks({
  Stop: [logStopEvents({ maxEventsStored: 100 })],
  SubagentStop: [logSubagentStopEvents({ maxEventsStored: 100 })],
  PostToolUse: [logPostToolUseEvents({ maxEventsStored: 100 })],
  PreToolUse: [logPreToolUseEvents({ maxEventsStored: 100 })],
  Notification: [logNotificationEvents({ maxEventsStored: 100 })],
});
