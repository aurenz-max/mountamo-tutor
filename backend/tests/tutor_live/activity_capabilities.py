"""Live probes read the host registry instead of reproducing its catalog in Python."""
import requests


def fetch_activity_spec(frontend, primitives, direct_visuals=False):
    response = requests.get(frontend.rstrip('/') + '/api/lumina/live-activity/capabilities',
        params={'primitives': ','.join(primitives), 'directVisuals': str(direct_visuals).lower()}, timeout=30)
    response.raise_for_status()
    return response.json()


def fetch_journey(frontend, primitive):
    """The harness journey for one primitive, declared in `liveJourneySpec.ts`.

    Kept OFF the capability envelope on purpose: that envelope is what the model is
    given, and a test fact does not belong in it. Same module as the mounted driver
    loads, so the two cannot drift.
    """
    response = requests.get(frontend.rstrip('/') + '/api/lumina/live-activity/journey',
        params={'primitive': primitive}, timeout=30)
    response.raise_for_status()
    return response.json()
