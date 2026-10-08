"""Parent-facing subskill summaries.

`subskill_description` is written for curriculum authors and the lesson
generator ("Use the sound-wave-explorer to...", "Letter Group 1 ... **Focus:**").
Every subskill also carries `parent_summary`: one plain sentence a parent can
read ("Observes that vibrating objects produce sound"), plus
`parent_summary_hash`, the hash of the description it was written from. A
summary whose hash no longer matches its description is stale and is rewritten.

`publish()` fills missing and stale summaries on the draft before building the
published copy, so every published subskill_index entry carries one. A Gemini
failure never blocks a publish; the subskill just publishes without a summary
and the next publish retries.
"""

import hashlib
import json
import logging
from typing import Any, Dict, List

from google import genai
from google.genai import types as genai_types

from app.core.config import settings

logger = logging.getLogger(__name__)

MODEL = "gemini-flash-latest"
BATCH = 40
MAX_WORDS = 20

PROMPT = """Rewrite each curriculum skill description below as one short sentence a parent understands.

Rules:
- At most 14 words. Start with a verb ("Hears the first sound in a word, like /c/ in cat").
- Say what the child can do. Drop app and tool names (anything like "sound-wave-explorer", "drag", "toggle", "tap"), teacher notes and lesson instructions. Keep what the child learns even when it is stated only in a "Focus:" note (for a letter group, that is the letters and their sounds).
- Keep concrete examples that help (letters, number ranges). Do not add facts.
- Return every id exactly as given.

Skills:
{items}
"""

SCHEMA = {
    "type": "object",
    "properties": {"items": {"type": "array", "items": {
        "type": "object",
        "properties": {"id": {"type": "string"}, "summary": {"type": "string"}},
        "required": ["id", "summary"]}}},
    "required": ["items"],
}


def source_hash(description: str) -> str:
    return hashlib.sha1((description or "").strip().encode()).hexdigest()[:16]


def needs_summary(ss: Dict[str, Any]) -> bool:
    desc = ss.get("subskill_description") or ""
    return bool(desc.strip()) and (
        not ss.get("parent_summary") or ss.get("parent_summary_hash") != source_hash(desc)
    )


async def _summarize(items: List[Dict[str, str]]) -> Dict[str, str]:
    try:
        resp = await genai.Client(api_key=settings.GEMINI_API_KEY).aio.models.generate_content(
            model=MODEL,
            contents=PROMPT.format(items=json.dumps(items, indent=1)),
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json", response_schema=SCHEMA, temperature=0.3,
                # Same output at a fraction of the latency of default thinking.
                thinking_config=genai_types.ThinkingConfig(thinking_budget=512),
            ),
        )
        out = json.loads(resp.text)
    except Exception as e:
        logger.warning(f"parent summary batch failed ({len(items)} subskills): {e}")
        return {}
    wanted = {i["id"] for i in items}
    return {
        i["id"]: i["summary"].strip()
        for i in out.get("items", [])
        if i.get("id") in wanted and (i.get("summary") or "").strip()
        and len(i["summary"].split()) <= MAX_WORDS
    }


async def fill_parent_summaries(doc: Dict[str, Any]) -> Dict[str, int]:
    """Write `parent_summary` + `parent_summary_hash` onto every subskill that needs one, in place."""
    pending = [ss for u in doc.get("curriculum", []) for sk in u.get("skills", [])
               for ss in sk.get("subskills", []) if needs_summary(ss)]
    written = 0
    for start in range(0, len(pending), BATCH):
        chunk = pending[start:start + BATCH]
        got = await _summarize([{"id": ss["subskill_id"], "description": ss["subskill_description"]} for ss in chunk])
        for ss in chunk:
            if ss["subskill_id"] in got:
                ss["parent_summary"] = got[ss["subskill_id"]]
                ss["parent_summary_hash"] = source_hash(ss["subskill_description"])
                written += 1
    return {"needed": len(pending), "written": written}
