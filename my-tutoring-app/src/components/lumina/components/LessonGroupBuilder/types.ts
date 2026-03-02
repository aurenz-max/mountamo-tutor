/** Bloom's taxonomy phases used for lesson group ordering */
export type BloomPhase = 'identify' | 'explain' | 'apply';

/** A subskill selected for inclusion in a lesson group */
export interface SelectedSubskill {
  id: string;
  description: string;
  skillId: string;
  skillDescription: string;
  unitTitle: string;
  subject: string;
  grade?: string;
  bloomPhase: BloomPhase;
}
