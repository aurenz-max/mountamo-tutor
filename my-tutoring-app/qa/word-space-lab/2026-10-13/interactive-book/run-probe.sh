#!/usr/bin/env bash
# Tier probe over interactive-book read-focus-word. Usage: run-probe.sh > <label>.txt
cd "$(dirname "$0")/../../../.."
p() { node scripts/difficulty-lab/tier-probe.mjs --run --component interactive-book --mode read-focus-word --grade "$1" --topic "$2" --runs ${RUNS:-2} --no-none; }
p K "Read CVC words with short a in a simple book"
p 1 "Read words with consonant digraphs sh, ch, th in connected text"
p K "Letter Group 1: s, a, t, i, p, n"
p K "Farm animals"
