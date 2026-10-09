/**
 * Hand-written model chains for cause-effect-chain's levers (`causeEffectChainLevers.ts`). Everyday settings, far
 * from the history the generator writes, so a model card never reads as a learner's card (`modelLeaks`). Each chain has four causes in
 * causal order, an ending, one event that could only happen after the ending, and one that was only true at the
 * time. Every card is speakable and every cause card owns a word no other cause card has (`chainEarSeparable`),
 * so a model chain can also be asked as a practice item. Words the history chains use ("heavy", "wooden",
 * "workers", "train", "children", "water") are kept out.
 */
export interface ModelChain {
  id: string;
  icon: string;
  outcome: string;
  /** Earliest first. */
  causes: [string, string, string, string];
  /** Could only happen once the ending had happened. */
  after: string;
  /** True at the time; pushed nothing along. */
  background: string;
}

export const MODEL_CHAINS: readonly ModelChain[] = [
  { id: 'sunflower', icon: '🌻', outcome: 'A sunflower blooms beside the garden fence.',
    causes: ['Maya pushes a striped seed into the soft soil.', 'Rain soaks the dirt around the tiny seed.',
      'A green sprout pokes up toward the sunshine.', 'Long leaves unfold along the stem.'],
    after: 'Bees buzz around the bright yellow petals.', background: 'A red bicycle leans against the shed.' },
  { id: 'snowman', icon: '⛄', outcome: 'A snowman with a carrot nose stands in the yard.',
    causes: ['Snow falls all night over the quiet lane.', 'Leo rolls a snowball into a big round base.',
      'His sister stacks two smaller balls on top.', 'Leo presses a carrot into the top ball for a nose.'],
    after: 'The neighbors stop to snap a photo of the snowman.', background: 'A blue mailbox stands at the corner.' },
  { id: 'lemonade', icon: '🍋', outcome: 'Friends sip cold lemonade on a sunny afternoon.',
    causes: ['Grandpa buys a bag of lemons at the market.', 'Ana squeezes the lemons into a glass pitcher.',
      'She stirs in sugar and ice cubes.', 'Ana pours the lemonade into plastic cups.'],
    after: 'The empty cups pile up in the recycling bin.', background: 'A radio plays quiet music in the kitchen.' },
  { id: 'tooth', icon: '🦷', outcome: 'Sam finds a shiny coin under his pillow.',
    causes: ['Sam feels his front tooth wiggle.', 'The loose tooth pops out during lunch.',
      'Sam tucks the tooth under his pillow at bedtime.', 'His mom swaps the tooth for a coin while he sleeps.'],
    after: 'Sam buys a sticker with the coin.', background: 'A night light glows in the hallway.' },
  { id: 'puppy', icon: '🐶', outcome: 'The puppy naps on a clean blanket, smelling like soap.',
    causes: ['The puppy rolls in a mud puddle.', 'Dad fills the tub with bubbly suds.',
      'Kim scrubs the puppy with soapy bubbles.', 'Kim dries the puppy with a fluffy towel.'],
    after: 'Kim drapes the damp towel outside to dry.', background: 'Clouds drift slowly over the sky.' },
  { id: 'cake', icon: '🎂', outcome: 'Everyone sings while candles glow on a chocolate cake.',
    causes: ['Mom mixes flour, eggs and cocoa in a bowl.', 'The batter bakes in a hot oven.',
      'Ravi spreads frosting over the cooled cake.', 'Ravi pushes eight candles into the frosting.'],
    after: 'Guests carry home slices wrapped in napkins.', background: 'A calendar sits on the pantry shelf.' },
];
