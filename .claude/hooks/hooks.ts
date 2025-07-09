import { defineHooks } from '../..';
import { logPreToolUseEvents, logPostToolUseEvents } from '../../src/hooks/logToolUseEvents';
import { blockEnvFiles } from '../../src/hooks/blockEnvFiles';
import { logStopEvents } from '../../src/hooks/logStopEvents';

defineHooks({
  PreToolUse: [
    logPreToolUseEvents(),
    blockEnvFiles
  ],
  PostToolUse: [logPostToolUseEvents()],
  Stop: [logStopEvents()]
});