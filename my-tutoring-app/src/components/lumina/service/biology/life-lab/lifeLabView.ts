/**
 * Life Lab's half of the kit's look stage: a world's first screen, with no key, for the blind reader.
 *
 * It draws what `LifeLab.tsx` shows before the child acts, in plain HTML: places and their conditions, living things,
 * what the child can change, the displays. Living things and options appear as their emoji and words; the component's
 * own drawings (beaks, feet, moths) are not here, so the reader cannot judge those.
 */
import { DISPLAY_CSS, displayHtml, esc } from '../../agent-kit/displays';
import { childPage, surfaceView, type LookView } from '../../agent-kit/look';
import type { SurfaceItem } from '../../agent-kit/surfaces';
import { TERMS_DESIGN, termWords, termsHtml, type Term } from '../../agent-kit/terms';
import { TEACH_DESIGN, teachFrameWords, teachHtml, type TeachStep } from '../../agent-kit/teach';
import { COND_KEYS, COND_WORDS, type Level } from '../../../primitives/visual-primitives/biology/life-lab/lifeLabAtlas';
import { featureLine, lifeScene } from '../../../primitives/visual-primitives/biology/life-lab/lifeLabWorkspace';
import { initState, itemsOf, normalizeWorld, optionsOf, type LifeWorld } from '../../../primitives/visual-primitives/biology/life-lab/lifeLabWorld';

const CSS = `${DISPLAY_CSS}
.zones{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px}.zone{flex:1 1 170px;padding:12px;border-radius:12px;background:#1e293b}
.zone b{display:block;margin-bottom:6px}.chip{display:inline-block;font-size:12px;background:rgba(0,0,0,.25);border-radius:999px;padding:2px 8px;margin:0 4px 4px 0}
.beings{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;min-height:70px;align-items:flex-end}.being{text-align:center;font-size:12px}.being span{display:block;font-size:34px}
.panel{padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);margin-bottom:12px}.hint{font-size:12px;color:#94a3b8;margin:0 0 8px}
.row{display:flex;flex-wrap:wrap;gap:8px}.pick{border:2px solid rgba(255,255,255,.15);border-radius:12px;padding:6px 12px}.box{border:2px dashed #475569;border-radius:12px;width:70px;height:80px;display:flex;align-items:center;justify-content:center;color:#64748b}
.btn{display:inline-block;background:#059669;border-radius:8px;padding:6px 14px;margin-right:8px}`;

const words = (s: unknown) => esc(String(s ?? '').replace(/_/g, ' '));

/** The author drew something in these frames, so it is shown its own drawing. */
const teachDrew = (teach?: readonly TeachStep[]) => (teach ?? []).some(s => s.show.some(d => d.kind === 'svg'));

/** A kit item with its teach frames: the kit's own view, plus the frames above the task. */
export function lifeLabItemView(item: SurfaceItem, teach?: readonly TeachStep[], terms?: readonly Term[]): LookView {
  const drew = teachDrew(teach);
  const design = [teach?.length ? TEACH_DESIGN : '', terms?.length ? TERMS_DESIGN : ''].filter(Boolean).join(' ');
  const view = surfaceView(item, { before: `${teachHtml(teach)}${termsHtml(terms)}`, ...(design ? { design } : {}) });
  return { ...view, drawn: view.drawn || drew, words: `${(teach ?? []).map(s => `Shown first: ${teachFrameWords(s)}`).join('\n')}\n${view.words}${terms?.length ? `\nLearn more drawer: ${termWords(terms)}` : ''}`.trim() };
}

export function lifeLabView(world: LifeWorld, ask: string, teach?: readonly TeachStep[], terms?: readonly Term[]): LookView {
  const w = normalizeWorld(world);
  const state = initState(w);
  const rule = w.rules[0] as { kind: string; parents?: string[]; traits?: string[] };
  const choose = w.controls.find(c => c.type === 'choose') as { among: string[] } | undefined;

  const being = (id: string) => {
    const b = w.beings.find(x => x.id === id)!;
    const card = choose ? choose.among.indexOf(id) : -1;
    const role = rule.kind === 'inherits' ? ['mother ', 'father '][rule.parents!.indexOf(id)] ?? '' : '';
    const chips = rule.kind === 'inherits' ? (rule.traits ?? []).filter(t => state.beings[id].traits[t]).map(t => `<i class="chip">${words(t)}: ${words(state.beings[id].traits[t])}</i>`).join('') : '';
    return `<div class="being"><span>${esc(b.emoji)}</span>${card >= 0 ? `Card ${String.fromCharCode(97 + card)}` : `${role}${words(b.name)}`}${chips}</div>`;
  };

  const zone = (z: LifeWorld['zones'][number]) => {
    const c = state.zones[z.id];
    const chips = [
      ...COND_KEYS.filter(k => typeof c[k] === 'number').map(k => COND_WORDS[k][c[k] as Level]),
      ...Object.entries(c).filter(([k, v]) => !(COND_KEYS as readonly string[]).includes(k) && k !== 'color' && v !== undefined).map(([k, v]) => featureLine(k, v)),
    ];
    const hunted = w.beings.find(b => b.variants && b.zone === z.id);
    const here = w.beings.filter(b => b.zone === z.id && !b.variants).map(b => being(b.id)).join('');
    const crowd = hunted ? hunted.variants!.map(v => `<div class="being"><span>${esc(hunted.emoji)}</span>${v.count} ${words(v.value)}</div>`).join('') : '';
    return `<div class="zone"${c.color ? ` style="background:${esc(c.color)}"` : ''}><b>${esc(z.emoji ?? '')} ${words(z.label)}${c.color ? ` (${words(c.color)})` : ''}</b>${chips.map(t => `<i class="chip">${words(t)}</i>`).join('')}<div class="beings">${crowd}${here}</div></div>`;
  };

  const control = (c: LifeWorld['controls'][number]) => {
    if (c.type === 'move') return '<p class="hint">Tap an animal, then tap the place where it should live.</p>';
    if (c.type === 'condition') return `<p class="hint">Buttons turn ${c.keys.map(words).join(' and ')} down or up in: ${c.zones.map(id => words(w.zones.find(z => z.id === id)?.label)).join(', ')}</p>`;
    if (c.type === 'trait') return `<div class="panel"><p class="hint">Pick one:</p><div class="row">${optionsOf(w).map(o => `<div class="pick">${esc(o.emoji ?? '')} ${words(o.label)}</div>`).join('')}</div></div>`;
    if (c.type === 'predict') return `<div class="panel"><p class="hint">Your prediction:</p><div class="row">${(w.beings.find(b => b.id === c.of)?.variants ?? []).map(v => `<div class="pick">more ${words(v.value)}</div>`).join('')}</div></div>`;
    if (c.type === 'order') return `<div class="panel"><div class="row">${Array.from({ length: c.slots }, (_, i) => `<div class="box">${i + 1}</div>`).join('')}</div><div class="row" style="margin-top:10px">${itemsOf(w).map(x => `<div class="pick">${esc(x.emoji ?? '')} ${words(x.name)}</div>`).join('')}</div></div>`;
    return '';
  };

  const body = `${teachHtml(teach)}${termsHtml(terms)}<p class="prompt">${esc(ask)}</p>
${w.show?.length ? `<div class="panel row">${w.show.map(d => `<div>${displayHtml(d)}</div>`).join('')}</div>` : ''}
${w.zones.length ? `<div class="zones">${w.zones.map(zone).join('')}</div>` : ''}
${w.controls.map(control).join('')}
<div><span class="btn">Try it</span><span class="btn">I'm done!</span></div>`;

  const facts = lifeScene({ id: 'look', type: 'life_cycle', world: w, ask, why: '', standards: '', difficulty: { band: 'easy', score: 0, reasons: [] } } as never,
    { state, tries: [], running: false, solved: false }).facts;
  return {
    ask,
    html: childPage(body, CSS),
    words: [...(teach ?? []).map(s => `Shown first: ${teachFrameWords(s)}`), `Places: ${facts.places}`, `The child can change: ${facts.canChange}`, ...(facts.shown ? [`Also shown: ${facts.shown}`] : []), ...(terms?.length ? [`Learn more drawer: ${termWords(terms)}`] : [])].join('\n'),
    design: `Where there is a "Try it" button the child can run the world and watch what happens as often as they like before pressing "I'm done!". Trying and watching is the activity, not a shortcut. Living things are shown here as emoji; the real screen draws some parts in more detail.${teach?.length ? ` ${TEACH_DESIGN}` : ''}${terms?.length ? ` ${TERMS_DESIGN}` : ''}`,
    drawn: (w.show ?? []).some(d => d.kind === 'svg') || teachDrew(teach),
  };
}
