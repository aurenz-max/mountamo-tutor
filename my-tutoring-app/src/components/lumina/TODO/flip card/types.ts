export interface Flashcard {
  id: string;
  term: string;
  definition: string;
  category: string;
}

export interface Deck {
  topic: string;
  cards: Flashcard[];
}

export type GamePhase = 'input' | 'loading' | 'playing' | 'summary' | 'error';

export interface GameStats {
  correct: number;
  incorrect: number;
  remaining: number;
  streak: number;
}
