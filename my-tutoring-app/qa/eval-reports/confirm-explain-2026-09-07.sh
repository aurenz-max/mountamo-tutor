#!/usr/bin/env bash
# Fresh-generation half of `/lesson-coverage confirm` for qa/di item 36:
# three real-pipeline draws of one topic, each judged (--source confirm) and
# scored. Usage: confirm-explain-2026-09-07.sh "<topic>" "<gradeLevel>" <tag>
set -u
cd "$(dirname "$0")/../.."
topic="$1"; grade="$2"; tag="$3"
enc() { node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$1"; }
for n in 1 2 3; do
  echo "=== $tag draw $n — $(date +%H:%M:%S)"
  out="qa/eval-reports/confirm-explain-$tag-$n.json"
  curl -s -m 900 "http://localhost:3000/api/lumina/topic-trace?topic=$(enc "$topic")&gradeLevel=$(enc "$grade")&package=true" -o "$out"
  id=$(node -e "const p=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).package; if(!p){console.error('NO PACKAGE'); process.exit(1);} require('fs').writeFileSync('qa/lesson-bench/packages/'+p.id+'.json', JSON.stringify(p,null,2)); console.log(p.id)" "$out") || { echo "produce failed for $tag draw $n"; head -c 400 "$out"; echo; continue; }
  echo "package $id"
  node -e "const p=require('./qa/lesson-bench/packages/$id.json'); for (const b of p.manifest.objectiveBlocks) for (const c of b.components) if (c.componentId==='di-spoken-practice') { const d=(p.components||[]).find(x=>x.instanceId===c.instanceId); console.log(' spoken slot', b.objectiveId, c.instanceId, 'pin', c.config?.targetEvalMode, '| generated', d?.data?.challengeType, 'items', d?.data?.items?.length, (d?.data?.items||[]).map(i=>i.stimulusText+' -> '+i.expectedAnswer).join(' ; ')); }"
  node scripts/lesson-coverage.mjs eval "qa/lesson-bench/packages/$id.json" --write --source confirm 2>&1 | grep -v "^\[" | grep -E "▶|obj[0-9]|generation_failure|⚠|summary" | cut -c1-260
  node scripts/lesson-bench.mjs score "qa/lesson-bench/packages/$id.json" 2>&1 | grep -v "^\[" | tail -12 | cut -c1-220
done
echo "=== $tag done — $(date +%H:%M:%S)"
