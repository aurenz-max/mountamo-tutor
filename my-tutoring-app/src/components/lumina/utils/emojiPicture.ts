/**
 * True only for one Unicode emoji pictograph, including an optional skin-tone
 * modifier or a joined sequence such as a family/profession emoji.
 *
 * Picture fields are rendered verbatim. A merely non-empty string therefore
 * is not a safe fallback: model-authored prose would become the learner's
 * supposed visual stimulus.
 */
const SINGLE_EMOJI_PICTURE = new RegExp(
  '^(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?'
  + '(?:\\u200D(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?)*$',
  'u',
);

export const isSingleEmojiPicture = (value: string | undefined): value is string =>
  Boolean(value?.trim() && SINGLE_EMOJI_PICTURE.test(value.trim()));
