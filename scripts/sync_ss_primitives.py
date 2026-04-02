"""Sync all SOCIAL_STUDIES subskill primitives and eval modes to drafts."""
import json
import urllib.request

updates = {
    'SS001-01-c': ('comparison-panel', ['explore']),
    'SS001-01-d': ('matching-activity', None),
    'SS001-02-a': ('fact-file', ['explore', 'recall']),
    'SS001-02-b': ('matching-activity', None),
    'SS001-02-c': ('comparison-panel', ['explore']),
    'SS001-02-d': ('fast-fact', None),
    'SS001-03-a': ('foundation-explorer', None),
    'SS001-03-b': ('categorization-activity', None),
    'SS001-03-c': ('matching-activity', None),
    'SS001-03-d': ('fast-fact', None),
    'SS001-04-a': ('foundation-explorer', None),
    'SS001-04-b': ('matching-activity', None),
    'SS001-04-c': ('fact-file', ['explore', 'recall']),
    'SS001-04-d': ('fast-fact', None),
    'SS001-05-a': ('matching-activity', None),
    'SS001-05-b': ('timeline-explorer', ['explore', 'order']),
    'SS001-05-c': ('media-player', None),
    'SS001-05-d': ('sequencing-activity', None),
    'SS002-01-a': ('comparison-panel', ['explore']),
    'SS002-01-b': ('categorization-activity', None),
    'SS002-02-a': ('foundation-explorer', None),
    'SS002-03-a': ('comparison-panel', ['explore']),
    'SS002-03-b': ('categorization-activity', None),
    'SS002-04-a': ('fact-file', ['explore', 'recall']),
    'SS002-04-b': ('matching-activity', None),
    'SS002-04-c': ('comparison-panel', ['explore']),
    'SS002-05-a': ('foundation-explorer', None),
    'SS002-05-c': ('ai-tutor-session', None),
    'SS002-06-a': ('comparison-panel', ['explore']),
    'SS002-06-b': ('categorization-activity', None),
    'SS002-06-c': ('fast-fact', None),
    'SS003-01-a': ('foundation-explorer', None),
    'SS003-01-b': ('comparison-panel', ['explore']),
    'SS003-01-c': ('custom-visual', None),
    'SS003-01-d': ('fast-fact', None),
    'SS003-02-a': ('foundation-explorer', None),
    'SS003-02-b': ('matching-activity', None),
    'SS003-02-c': ('knowledge-check', ['recall', 'apply']),
    'SS003-03-a': ('foundation-explorer', None),
    'SS003-03-b': ('vocabulary-explorer', ['explore', 'recall']),
    'SS003-03-c': ('matching-activity', None),
    'SS003-04-a': ('comparison-panel', ['explore']),
    'SS003-04-b': ('categorization-activity', None),
    'SS003-04-c': ('matching-activity', None),
    'SS003-04-d': ('image-comparison', None),
    'SS003-05-a': ('foundation-explorer', None),
    'SS003-05-b': ('categorization-activity', None),
    'SS003-05-c': ('sequencing-activity', None),
    'SS003-05-d': ('fast-fact', None),
    'SS003-06-a': ('vocabulary-explorer', ['explore', 'recall']),
    'SS003-06-b': ('knowledge-check', ['recall', 'apply']),
    'SS003-06-c': ('ai-tutor-session', None),
    'SS004-01-a': ('comparison-panel', ['explore']),
    'SS004-01-b': ('categorization-activity', None),
    'SS004-01-c': ('image-comparison', None),
    'SS004-01-d': ('vocabulary-explorer', ['explore', 'recall']),
    'SS004-02-a': ('how-it-works', ['guided', 'sequence']),
    'SS004-02-b': ('timeline-explorer', ['explore', 'order']),
    'SS004-02-c': ('sequencing-activity', None),
    'SS004-03-a': ('comparison-panel', ['explore']),
    'SS004-03-b': ('matching-activity', None),
    'SS004-03-c': ('image-comparison', None),
    'SS004-03-d': ('timeline-explorer', ['explore', 'order']),
    'SS004-04-a': ('fact-file', ['explore', 'recall']),
    'SS004-04-b': ('fact-file', ['explore', 'recall']),
    'SS004-04-c': ('matching-activity', None),
    'SS004-04-d': ('timeline-explorer', ['explore', 'order']),
    'SS004-05-a': ('timeline-explorer', ['explore', 'order']),
    'SS004-05-b': ('categorization-activity', None),
    'SS004-05-c': ('media-player', None),
    'SS005-01-a': ('foundation-explorer', None),
    'SS005-01-b': ('matching-activity', None),
    'SS005-01-c': ('flashcard-deck', None),
    'SS005-01-d': ('ai-tutor-session', None),
    'SS005-02-a': ('foundation-explorer', None),
    'SS005-02-b': ('fact-file', ['explore', 'recall']),
    'SS005-02-c': ('matching-activity', None),
    'SS005-02-d': ('ai-tutor-session', None),
    'SS005-03-a': ('comparison-panel', ['explore']),
    'SS005-03-b': ('categorization-activity', None),
    'SS005-03-c': ('knowledge-check', ['recall', 'apply']),
    'SS005-03-d': ('ai-tutor-session', None),
    'SS005-04-a': ('timeline-explorer', ['explore', 'order']),
    'SS005-04-b': ('matching-activity', None),
    'SS005-04-c': ('fact-file', ['explore', 'recall']),
    'SS005-04-d': ('comparison-panel', ['explore']),
}

ok = 0
err = 0
for sid, (prim, modes) in updates.items():
    body = {'target_primitive': prim}
    if modes:
        body['target_eval_modes'] = modes
    req = urllib.request.Request(
        f'http://localhost:8001/api/curriculum/subskills/{sid}?grade=1&subject_id=SOCIAL_STUDIES',
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json'},
        method='PUT'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            if result.get('target_primitive') == prim:
                ok += 1
            else:
                print(f'WARN {sid}: expected {prim}, got {result.get("target_primitive")}')
                err += 1
    except Exception as e:
        print(f'ERR {sid}: {e}')
        err += 1

print(f'\nDone: {ok} OK, {err} errors (out of {len(updates)} total)')
