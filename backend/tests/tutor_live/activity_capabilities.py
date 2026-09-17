"""Live probes read the host registry instead of reproducing its catalog in Python."""
import requests


def fetch_activity_spec(frontend, primitives, direct_visuals=False):
    response = requests.get(frontend.rstrip('/') + '/api/lumina/live-activity/capabilities',
        params={'primitives': ','.join(primitives), 'directVisuals': str(direct_visuals).lower()}, timeout=30)
    response.raise_for_status()
    return response.json()
