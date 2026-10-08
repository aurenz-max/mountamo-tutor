import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { OPEN_BUILDER_MISSES, SCENES, type OpenBuilderVerdict, type SceneId } from '../../primitives/visual-primitives/creation/openBuilderModel';

/**
 * The open builder's check: Gemini vision reads a picture of the board, the same picture the child
 * sees, against the goal the child heard. No coordinates and no rules list: a build that reasonably
 * reads as the thing and does the job the goal names passes. Flash-latest, because flash-lite gave away
 * the fix in the 10-06 judge probes (qa/open-build/judge-*.json).
 */
const JUDGE_MODEL = 'gemini-flash-latest';

const SYSTEM = `You are a warm, encouraging building buddy for a child aged 5-10. The child built something out of plain toy blocks on a side-view board to meet a goal. You see a PICTURE of the board.
How the picture works: it is a side view. Blocks fall until they rest on the ground or on another block. Every block has a little smiley face; that is only the blocks' style, not a character. The emoji pictures (animals, people, a car, the moon, flowers) are the scenery the child builds for; the child did not build them and cannot move them.
Judge like a kind teacher looking at a young child's block build:
- met is true when the build reasonably looks like what the goal asks for AND does the job the goal names (a bridge that reaches from one side to the other, a tower about as tall as the thing named, a roof over a space, steps that go all the way up, a wall between two things). It does not need to be neat, realistic, symmetrical or pretty. Blocky is fine. Extra blocks are fine. For young children, if it is a fair try at the idea and does the job, it is met.
- met is false only when a part the goal names is clearly missing, or the build clearly does not do the job (the bridge stops short of the far side, the tower is much shorter than the giraffe, there is no roof, a gap lets the sheep through).
- miss (when not met): "missing_part" when something the goal asks for is not there, "does_not_work" when the parts are there but it does not do the job.
- noticed: one short sentence saying something specific you SEE in the child's build (a block, a color, where it is, what it looks like). Sound like a friend who looked closely. No "perfect", no "great job".
- nudge: when not met, ONE short question a 5-year-old can understand that points their eyes at a part of the build or the scene, WITHOUT saying what to add, remove or move. Empty when met.
Name things the way the child sees them: "your blue blocks", "the right side of the river", "the top of your tower". Never mention rows, columns, coordinates or this picture.`;

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    noticed: { type: Type.STRING },
    met: { type: Type.BOOLEAN },
    miss: { type: Type.STRING, enum: [...OPEN_BUILDER_MISSES], nullable: true },
    nudge: { type: Type.STRING },
  },
  required: ['noticed', 'met', 'nudge'],
};

export interface OpenBuilderJudgeRequest {
  sceneId: SceneId;
  goal: string;
  /** PNG of the board, base64 without the data: prefix. */
  image: string;
}

export async function judgeOpenBuild(req: OpenBuilderJudgeRequest): Promise<OpenBuilderVerdict> {
  const scene = SCENES[req.sceneId];
  if (!scene) throw new Error(`Unknown open-builder scene ${req.sceneId}`);
  if (typeof req.image !== 'string' || req.image.length < 100) throw new Error('Open builder: no picture of the build');
  const res = await ai.models.generateContent({
    model: JUDGE_MODEL,
    contents: [{ role: 'user', parts: [
      { text: `GOAL the child heard: ${req.goal}\nSCENERY (not built by the child): ${scene.sceneNote}\nThe picture shows the board now:` },
      { inlineData: { mimeType: 'image/png', data: req.image } },
    ] }],
    config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', responseSchema: schema, temperature: 0.4 },
  });
  const out = JSON.parse(res.text ?? '{}') as Partial<OpenBuilderVerdict> & { miss?: string | null };
  const met = out.met === true;
  return {
    met,
    // A not-met verdict always names a miss; one the judge left out reads as a missing part.
    ...(met ? {} : { miss: OPEN_BUILDER_MISSES.includes(out.miss as never) ? out.miss as OpenBuilderVerdict['miss'] : 'missing_part' }),
    noticed: String(out.noticed ?? '').trim(),
    nudge: met ? '' : String(out.nudge ?? '').trim(),
  };
}

