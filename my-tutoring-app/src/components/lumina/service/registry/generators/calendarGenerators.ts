import { registerGenerator } from '../contentRegistry';
import { generateCalendarExplorer } from '../../calendar/gemini-calendar-explorer';
import { generateTimelineBuilder } from '../../calendar/gemini-timeline-builder';

registerGenerator('calendar-explorer', async (item, topic, gradeContext) => ({
  type: 'calendar-explorer',
  instanceId: item.instanceId,
  data: await generateCalendarExplorer(topic, gradeContext, item.config),
}));

registerGenerator('timeline-builder', async (item, topic, gradeContext) => ({
  type: 'timeline-builder',
  instanceId: item.instanceId,
  data: await generateTimelineBuilder(topic, gradeContext, item.config),
}));
