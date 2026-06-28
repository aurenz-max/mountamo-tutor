import { registerContextGenerator } from '../contentRegistry';
import { generateCalendarExplorer } from '../../calendar/gemini-calendar-explorer';
import { generateTimelineBuilder } from '../../calendar/gemini-timeline-builder';

registerContextGenerator('calendar-explorer', async (ctx) => ({
  type: 'calendar-explorer',
  instanceId: ctx.instanceId,
  data: await generateCalendarExplorer(ctx),
}));

registerContextGenerator('timeline-builder', async (ctx) => ({
  type: 'timeline-builder',
  instanceId: ctx.instanceId,
  data: await generateTimelineBuilder(ctx),
}));
