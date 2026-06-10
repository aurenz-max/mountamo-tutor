/**
 * Interpolate {{key}} template variables from a data bag.
 *
 * Mirror of the backend's `interpolate_template` (lumina_tutor.py): Mustache-style
 * `{{key}}` where `key` is `\w+`, looked up in `data`. Missing/null values render
 * as `(not set)` so prompts stay faithful to what the AI actually receives.
 *
 * Keep this byte-compatible with the backend so frontend previews match runtime.
 */
export function interpolateTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? '(not set)' : String(value);
  });
}
