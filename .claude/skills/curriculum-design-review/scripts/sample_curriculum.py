"""Sample a saved published curriculum response; no network or curriculum writes."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import random
import re
import secrets


def grade_key(value):
    value = str(value).strip().lower()
    if value in ('k', 'kindergarten'):
        return 'K'
    if value in ('pk', 'pre-k', 'prekindergarten', 'pre-kinder'):
        return 'PK'
    match = re.fullmatch(r'(?:grade\s*)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*grade)?', value)
    if match and 1 <= int(match[1]) <= 12:
        return str(int(match[1]))
    raise ValueError(f'Unrecognized grade: {value!r}')


def subject_key(value):
    return re.sub(r'[^a-z0-9]', '', str(value).lower())


def require_id(node, kind):
    value = node.get('id')
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'Missing {kind} id')
    return value


def sample_document(document, subject, grade, skill_count, subskill_count, seed):
    if skill_count < 1 or subskill_count < 1:
        raise ValueError('Sample counts must be positive')
    units = document.get('curriculum')
    if not isinstance(units, list) or not units:
        raise ValueError('Expected a nonempty curriculum list from the published endpoint')
    expected_grade = grade_key(grade)
    expected_subject = subject_key(subject)
    scoped = []
    out_of_scope = []
    seen_units, seen_skills, seen_children = set(), set(), set()
    for unit in units:
        uid = require_id(unit, 'unit')
        if uid in seen_units:
            raise ValueError(f'Duplicate unit id: {uid}')
        seen_units.add(uid)
        actual_grade = unit.get('grade', document.get('grade'))
        actual_subject = unit.get('subject', document.get('subject'))
        if actual_grade is None or not actual_subject:
            raise ValueError(f'Missing scope metadata on unit {uid}; inspect the source before sampling')
        if grade_key(actual_grade) != expected_grade or subject_key(actual_subject) != expected_subject:
            out_of_scope.append(uid)
            continue
        skills = unit.get('skills')
        if not isinstance(skills, list):
            raise ValueError(f'Missing skills list: {uid}')
        for skill in skills:
            sid = require_id(skill, 'skill')
            if sid in seen_skills:
                raise ValueError(f'Duplicate skill id: {sid}')
            seen_skills.add(sid)
            children = skill.get('subskills')
            if not isinstance(children, list):
                raise ValueError(f'Missing subskills list: {sid}')
            for child in children:
                cid = require_id(child, 'subskill')
                if cid in seen_children:
                    raise ValueError(f'Duplicate subskill id: {cid}')
                seen_children.add(cid)
                if not isinstance(child.get('description'), str) or not child['description'].strip():
                    raise ValueError(f'Missing subskill description: {cid}')
            scoped.append(dict(unitId=uid, unitTitle=unit.get('title'), skill=skill))
    eligible = sorted((x for x in scoped if len(x['skill']['subskills']) >= subskill_count), key=lambda x:x['skill']['id'])
    if len(eligible) < skill_count:
        raise ValueError(f'Need {skill_count} eligible skills; found {len(eligible)} for {subject}/grade {grade}')
    rng = random.Random(seed)
    selected = []
    for entry in rng.sample(eligible, skill_count):
        children = rng.sample(sorted(entry['skill']['subskills'], key=lambda x:x['id']), subskill_count)
        selected.append(dict(**entry, selectedSubskills=children))
    return dict(subject=subject, grade=expected_grade, seed=seed,
                algorithm='Python random.Random(seed); ID-sorted eligible skills then ID-sorted children; sample without replacement; no redraw',
                pythonVersion=platform.python_version(), requestedSkills=skill_count,
                requestedSubskillsPerSkill=subskill_count, scopedSkillCount=len(scoped),
                eligibleSkillIds=[x['skill']['id'] for x in eligible],
                excludedSkills=[dict(id=x['skill']['id'], subskillCount=len(x['skill']['subskills']), reason='fewer children than requested') for x in scoped if len(x['skill']['subskills']) < subskill_count],
                outOfScopeUnitIds=out_of_scope, selected=selected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--subject', required=True)
    parser.add_argument('--grade', required=True)
    parser.add_argument('--skills', type=int, default=5)
    parser.add_argument('--subskills', type=int, default=2)
    parser.add_argument('--seed', type=int)
    parser.add_argument('--source-url', help='Optional provenance only; never fetched')
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error('Output must not overwrite the source snapshot')
    raw = args.input.read_bytes()
    try:
        result = sample_document(json.loads(raw.decode('utf-8-sig')), args.subject, args.grade,
                                 args.skills, args.subskills, args.seed if args.seed is not None else secrets.randbits(64))
    except (ValueError, TypeError, KeyError, AttributeError) as error:
        parser.error(str(error))
    result.update(sourceFile=str(args.input.resolve()), sourceUrl=args.source_url,
                  sourceSha256=hashlib.sha256(raw).hexdigest(), sampledAt=datetime.now(timezone.utc).isoformat())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(f'Sampled {len(result["selected"])} skills, {sum(len(s["selectedSubskills"]) for s in result["selected"])} subskills; seed={result["seed"]}')


if __name__ == '__main__':
    main()
