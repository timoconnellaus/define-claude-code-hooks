import {
  defineHooks,
  defineHook,
  logPreToolUseEvents,
  logPostToolUseEvents,
  logStopEvents,
} from "../..";

export default defineHooks({
  PreToolUse: [logPreToolUseEvents({ maxEventsStored: 100 })],
  PostToolUse: [logPostToolUseEvents({ maxEventsStored: 100 })],
  Stop: [logStopEvents({ maxEventsStored: 100 })],
});
