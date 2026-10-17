'use client';

/**
 * The ecosystem diorama's controls beside the 3D tank: the weather log (a picture calendar and a picture graph), the
 * season cards, the plant tray, the winter tray and the shade tray. Presentational only: the diorama owns the state
 * and the checks. Every control is a real button, so a learner without a precise pointer (and a test) can work it.
 */
import React from 'react';
import { LuminaBadge, LuminaChoiceChip, LuminaPanel, LuminaSectionLabel } from '../../../ui';
import { countWeather, LOG_DAYS, WEATHERS, type Animal, type Season, type Weather, type WinterPlace } from './ecosystemLife';
import type { Cover, PlantSetup } from './ecosystemModel';

export const WEATHER_PICTURE: Record<Weather, string> = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️', windy: '💨' };
const SEASON_PICTURE: Record<Season, string> = { winter: '⛄', spring: '🌷', summer: '🏖️', fall: '🍂' };
const ANIMAL_PICTURE: Record<Animal, string> = { bear: '🐻', bird: '🐦', squirrel: '🐿️', deer: '🦌' };
const PLACE_LABEL: Record<WinterPlace, string> = { den: '🪨 Cave den', south: '➡️ Fly south', hollow: '🌳 Tree hollow', meadow: '🌾 Stay in the meadow' };
const COVER_LABEL: Record<Cover | 'none', string> = { umbrella: '⛱️ Umbrella', 'leaf roof': '🍃 Leaf roof', 'clear sheet': '🔲 Clear sheet', hut: '🛖 Move it into the hut', none: '🚫 Nothing' };

/** A month of school days as pictures (4 weeks of 5), then a picture graph with one row per weather. */
export const WeatherLog: React.FC<{
  label: string;
  days: readonly Weather[];
  shown: number;
  /** Rows can be tapped to name the weather that shows the answer. */
  pickRow?: (w: Weather) => void;
  pickedRow?: Weather | null;
  onPick?: () => void;
  picked?: boolean;
  disabled?: boolean;
}> = ({ label, days, shown, pickRow, pickedRow, onPick, picked, disabled }) => {
  const n = countWeather(days.slice(0, shown));
  return (
    <LuminaPanel accent="cyan" className="space-y-3" data-weather-log={label}>
      <div className="flex items-center justify-between gap-2">
        <LuminaSectionLabel>{label}</LuminaSectionLabel>
        <span className="text-xs text-slate-400">{Math.min(shown, LOG_DAYS)} of {LOG_DAYS} days</span>
      </div>
      <div className="grid grid-cols-5 gap-1" aria-label={`${label}: weather calendar`}>
        {Array.from({ length: LOG_DAYS }, (_, i) => (
          <div key={i} className={`flex h-9 items-center justify-center rounded-md border text-xl ${i < shown ? 'border-white/15 bg-white/10' : 'border-white/5 bg-white/[0.03]'}`}
            aria-label={i < shown ? `day ${i + 1}: ${days[i]}` : `day ${i + 1}: not yet`}>
            {i < shown ? WEATHER_PICTURE[days[i]] : ''}
          </div>
        ))}
      </div>
      <div className="space-y-1" aria-label={`${label}: picture graph`}>
        {WEATHERS.map(w => {
          const row = (
            <div className="flex min-h-[28px] items-center gap-1">
              <span className="mr-1 flex h-7 w-8 shrink-0 items-center justify-center rounded border-r-2 border-white/30 bg-white/10 text-base" aria-hidden="true">{WEATHER_PICTURE[w]}</span>
              <span className="flex flex-wrap gap-0.5 text-sm leading-none">
                {Array.from({ length: n[w] }, (_, i) => <span key={i}>{WEATHER_PICTURE[w]}</span>)}
              </span>
            </div>
          );
          return pickRow ? (
            <button key={w} type="button" disabled={disabled} onClick={() => pickRow(w)} aria-pressed={pickedRow === w}
              aria-label={`${w} days row`}
              className={`block w-full rounded-md border px-1 text-left transition ${pickedRow === w ? 'border-amber-300/70 bg-amber-300/15' : 'border-transparent hover:border-white/20'}`}>
              {row}
            </button>
          ) : <div key={w}>{row}</div>;
        })}
      </div>
      {onPick && (
        <LuminaChoiceChip label={`Pick ${label}`} accent="amber" selected={picked} disabled={disabled} onClick={onPick} className="w-full justify-center" />
      )}
    </LuminaPanel>
  );
};

export const SeasonCards: React.FC<{ picked: Season | null; onPick: (s: Season) => void; disabled?: boolean }> = ({ picked, onPick, disabled }) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label="Seasons">
    {(['winter', 'spring', 'summer', 'fall'] as Season[]).map(s => (
      <LuminaChoiceChip key={s} label={`${SEASON_PICTURE[s]} ${s[0].toUpperCase()}${s.slice(1)}`} accent="amber" selected={picked === s}
        disabled={disabled} onClick={() => onPick(s)} aria-label={s} />
    ))}
  </div>
);

export const PlantTray: React.FC<{
  setup: PlantSetup;
  onChange: (s: PlantSetup) => void;
  disabled?: boolean;
}> = ({ setup, onChange, disabled }) => {
  const toggleExtra = (e: 'den' | 'berries') => onChange({ ...setup, extras: setup.extras.includes(e) ? setup.extras.filter(x => x !== e) : [...setup.extras, e] });
  return (
    <LuminaPanel accent="emerald" className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <LuminaSectionLabel>Where the pot stands</LuminaSectionLabel>
        <div className="flex flex-wrap gap-2">
          <LuminaChoiceChip label="☀️ Sunny sand" accent="emerald" selected={setup.spot === 'sun'} disabled={disabled} onClick={() => onChange({ ...setup, spot: 'sun' })} />
          <LuminaChoiceChip label="🛖 Shade hut" accent="emerald" selected={setup.spot === 'hut'} disabled={disabled} onClick={() => onChange({ ...setup, spot: 'hut' })} />
        </div>
      </div>
      <div className="space-y-2">
        <LuminaSectionLabel>In the pot</LuminaSectionLabel>
        <div className="flex flex-wrap gap-2">
          <LuminaChoiceChip label="🟫 Soil" accent="emerald" selected={setup.fill === 'soil'} disabled={disabled} onClick={() => onChange({ ...setup, fill: 'soil' })} />
          <LuminaChoiceChip label="🪨 Pebbles" accent="emerald" selected={setup.fill === 'pebbles'} disabled={disabled} onClick={() => onChange({ ...setup, fill: 'pebbles' })} />
        </div>
      </div>
      <div className="space-y-2">
        <LuminaSectionLabel>Water</LuminaSectionLabel>
        <LuminaChoiceChip label={setup.watered ? '💧 Watered' : '💧 Water it'} accent="emerald" selected={setup.watered} disabled={disabled}
          onClick={() => onChange({ ...setup, watered: !setup.watered })} />
      </div>
      <div className="space-y-2">
        <LuminaSectionLabel>Animal things</LuminaSectionLabel>
        <div className="flex flex-wrap gap-2">
          <LuminaChoiceChip label="🪵 Den" accent="emerald" selected={setup.extras.includes('den')} disabled={disabled} onClick={() => toggleExtra('den')} />
          <LuminaChoiceChip label="🫐 Berries" accent="emerald" selected={setup.extras.includes('berries')} disabled={disabled} onClick={() => toggleExtra('berries')} />
        </div>
      </div>
    </LuminaPanel>
  );
};

export const WinterTray: React.FC<{
  animals: Animal[];
  moves: Partial<Record<Animal, WinterPlace>>;
  holding: Animal | null;
  onHold: (a: Animal) => void;
  onPlace: (p: WinterPlace) => void;
  disabled?: boolean;
}> = ({ animals, moves, holding, onHold, onPlace, disabled }) => (
  <LuminaPanel accent="cyan" className="space-y-3">
    <div className="space-y-2">
      <LuminaSectionLabel>Animals</LuminaSectionLabel>
      <div className="flex flex-wrap gap-2">
        {animals.map(a => (
          <LuminaChoiceChip key={a} label={`${ANIMAL_PICTURE[a]} ${a[0].toUpperCase()}${a.slice(1)}${moves[a] ? ' ✓' : ''}`} accent="cyan"
            selected={holding === a} disabled={disabled} onClick={() => onHold(a)} aria-label={`Pick up the ${a}`} />
        ))}
      </div>
    </div>
    <div className="space-y-2">
      <LuminaSectionLabel>Winter places {holding ? `for the ${holding}` : ''}</LuminaSectionLabel>
      <div className="flex flex-wrap gap-2">
        {(['den', 'south', 'hollow', 'meadow'] as WinterPlace[]).map(p => (
          <LuminaChoiceChip key={p} label={PLACE_LABEL[p]} accent="cyan" disabled={disabled || !holding} onClick={() => onPlace(p)} aria-label={`Winter place: ${p}`} />
        ))}
      </div>
    </div>
  </LuminaPanel>
);

export const CoverTray: React.FC<{
  covers: Cover[];
  picked: Cover | null;
  onPick: (c: Cover | null) => void;
  disabled?: boolean;
}> = ({ covers, picked, onPick, disabled }) => (
  <LuminaPanel accent="amber" className="space-y-2">
    <LuminaSectionLabel>Build shade</LuminaSectionLabel>
    <div className="flex flex-wrap gap-2">
      {covers.map(c => (
        <LuminaChoiceChip key={c} label={COVER_LABEL[c]} accent="amber" selected={picked === c} disabled={disabled} onClick={() => onPick(c)} aria-label={`Cover: ${c}`} />
      ))}
      <LuminaChoiceChip label={COVER_LABEL.none} accent="amber" selected={picked === null} disabled={disabled} onClick={() => onPick(null)} aria-label="Cover: nothing" />
    </div>
  </LuminaPanel>
);

export const DayBadge: React.FC<{ weather: Weather | null }> = ({ weather }) => (
  weather ? <LuminaBadge accent="cyan">Today in the tank: {WEATHER_PICTURE[weather]} {weather}</LuminaBadge> : null
);
