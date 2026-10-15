#!/usr/bin/env bash
# Tier probe over all four di-word-reading modes. Usage: RUNS=2 run-probe.sh
cd "$(dirname "$0")/../../../.."
probe() { node scripts/difficulty-lab/tier-probe.mjs --run --component di-word-reading --mode "$1" --grade "$2" --topic "$3" --runs ${RUNS:-2} --no-none; }
probe cvc_reading K "Decode CVC words with Short 'a' (e.g., cat, map, van)"
probe cvc_reading K "Letter-Sound Group 1: s, a, t, i, p, n"
probe read_word K "Read simple CVC words and sight words aloud"
probe sight_word 1 "Identify and read Grade 1 high-frequency words that frequently appear in text but may not be decodable"
probe word_reading_review K "Review reading short-vowel CVC words and sight words"
