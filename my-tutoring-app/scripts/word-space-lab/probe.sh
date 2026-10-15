#!/usr/bin/env bash
# Tier probe over a primitive's modes (add-word-space step 0b / step 4).
#   probe.sh <component> <label> "<mode>|<grade>|<topic>" ...   -> qa/word-space-lab/$DAY/<component>/<label>.txt
cd "$(dirname "$0")/../.."
comp=$1; label=$2; shift 2
out=qa/word-space-lab/${DAY:-2026-10-13}/$comp; mkdir -p "$out"
: > "$out/$label.txt"
for spec in "$@"; do
  IFS='|' read -r m g t <<< "$spec"
  node scripts/difficulty-lab/tier-probe.mjs --run --component "$comp" --mode "$m" --grade "$g" --topic "$t" --runs "${RUNS:-2}" --no-none >> "$out/$label.txt" 2>&1
done
echo "done $comp $label"
