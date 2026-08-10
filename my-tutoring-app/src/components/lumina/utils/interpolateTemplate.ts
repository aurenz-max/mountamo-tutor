/**
 * Interpolate {{key}} template variables from a data bag.
 *
 * Mirror of the backend's `interpolate_template` (lumina_tutor.py): Mustache-style
 * `{{key}}` where `key` is `\w+`, looked up in `data`. Missing/null values are
 * DROPPED (rendered as '') — never a filler marker. The backend removed its
 * "(not set)" filler after a live session had the tutor speak it aloud to a
 * 5-year-old (2026-08-05 review, seq 584); a preview that still showed it would
 * assert prompt text runtime never produces.
 *
 * Keep this byte-compatible with the backend so frontend previews match runtime.
 */
export function interpolateTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * Strict variant — mirror of the backend's `interpolate_line`: a SCRIPT line
 * (scaffolding level, struggle response) with any unresolved placeholder is not
 * a usable script, so the whole line is dropped (null) rather than shipped with
 * a hole in it. Returns null for empty templates too.
 */
export function interpolateLine(
  template: string,
  data: Record<string, unknown>,
): string | null {
  if (!template) return null;
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    const value = data[m[1]];
    if (value === undefined || value === null) return null;
  }
  return interpolateTemplate(template, data);
}
