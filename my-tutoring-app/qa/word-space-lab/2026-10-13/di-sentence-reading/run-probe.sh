#!/usr/bin/env bash
# Tier probe over all four di-sentence-reading modes. Usage: RUNS=2 run-probe.sh
cd "$(dirname "$0")/../../../.."
probe() { node scripts/difficulty-lab/tier-probe.mjs --run --component di-sentence-reading --mode "$1" --grade "$2" --topic "$3" --runs ${RUNS:-2} --no-none; }
probe decodable_sentence K "Read decodable sentences with short 'a' CVC words"
probe decodable_sentence K "Letter-Sound Group 1: s, a, t, i, p, n"
probe read_sentence 1 "Read simple sentences with accuracy"
probe sight_phrase_sentence K "Read sentences with high-frequency sight words"
probe sentence_review 1 "Review reading short sentences with CVC and sight words"
