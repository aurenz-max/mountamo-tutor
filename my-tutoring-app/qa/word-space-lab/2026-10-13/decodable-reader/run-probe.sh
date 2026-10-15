#!/usr/bin/env bash
# Tier probe over the decodable-reader ladder (grade x tier). Usage: run-probe.sh > <label>.txt
cd "$(dirname "$0")/../../../.."
p() { node scripts/difficulty-lab/tier-probe.mjs --run --component decodable-reader --mode literal --grade "$1" --topic "$2" --runs ${RUNS:-1}; }
p K "A pet cat"
p 1 "A trip to the pond"
p 2 "Planting a garden"
p 3 "A storm at the beach"
p 5 "How bees make honey"
