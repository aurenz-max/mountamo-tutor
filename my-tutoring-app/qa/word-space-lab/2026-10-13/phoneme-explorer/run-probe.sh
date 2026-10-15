#!/usr/bin/env bash
# Tier probe over all six phoneme-explorer modes at K. Usage: run-probe.sh <label>
cd "$(dirname "$0")/../../../.."
for m in isolate ending medial blend segment manipulate; do
  case $m in
    isolate) t="Identify the beginning sound in a word";; ending) t="Identify the ending sound in a word";;
    medial) t="Identify the medial sound in a word";; blend) t="Blend three phonemes into a CVC word";;
    segment) t="Segment a CVC word into its phonemes";; manipulate) t="Substitute one phoneme for another";;
  esac
  node scripts/difficulty-lab/tier-probe.mjs --run --component phoneme-explorer --mode $m --grade K --topic "$t" --runs ${RUNS:-1} --no-none
done
