export const LETTER_WORKSHOP_MODES = ['trace', 'copy', 'write'] as const;
export type LetterWorkshopMode = typeof LETTER_WORKSHOP_MODES[number];

export const LETTER_WORKSHOP_MODE_INFO = {
  trace: { label: 'Assisted tracing', assistance: 'trace-guide' },
  copy: { label: 'Copy beside a model', assistance: 'beside-model' },
  write: { label: 'Write from listening', assistance: 'auditory-cue' },
} as const;

export function isLetterWorkshopMode(value: unknown): value is LetterWorkshopMode {
  return LETTER_WORKSHOP_MODES.some(mode => mode === value);
}
