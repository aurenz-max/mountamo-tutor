#!/usr/bin/env bash
# Tier probe over the word-level spelling-pattern-explorer modes. Usage: run-probe.sh > <label>.txt
cd "$(dirname "$0")/../../../.."
p() { node scripts/difficulty-lab/tier-probe.mjs --run --component spelling-pattern-explorer --mode "$1" --grade "$2" --topic "$3" --runs ${RUNS:-2} --no-none; }
p short_vowel 1 "Spell CVC words with short vowels"
p long_vowel 1 "Spell words with silent e (CVCe)"
p long_vowel 2 "Spell long vowel teams ai, ay, ee, ea, oa"
p r_controlled 2 "Spell words with r-controlled vowels ar, or, er"
p silent_letter 2 "Spell words with silent letters kn, wr, mb"
p silent_letter 2 "Spell words with silent letters kn and wr"
