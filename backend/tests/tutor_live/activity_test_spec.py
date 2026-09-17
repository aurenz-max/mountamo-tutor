"""Synthetic host offers for transport tests, not a backend capability catalog."""
def activity(primitive_id='number-line', owner='tutor', modes=None):
    return {'primitiveId': primitive_id, 'teachingOwner': owner, 'canAdvance': owner == 'tutor',
            'modes': modes or ['jump'], 'guidance': 'Use the host-provided task and teaching contract.'}


def visual():
    return {'name': 'show_shapes', 'primitiveId': 'test-shapes', 'description': 'Show host-rendered shapes.',
            'parameters': {'type': 'OBJECT', 'properties': {'count': {'type': 'INTEGER'}}, 'required': ['count']}}


def spec(*, runner=False, visuals=False, plan=None):
    result = {'activities': [activity()], 'visuals': [visual()] if visuals else []}
    if runner: result['activities'].append(activity('ten-frame', 'di-runner', ['make_ten', 'operate']))
    if plan: result['plan'] = plan
    return result
