#!/usr/bin/env python3

"""
Claude Code token usage analyzer.
Adapted from https://gist.github.com/kieranklaassen/7b2ebb39cbbb78cc2831497605d76cc6
Analyzes ~/.claude/projects/ JSONL files for token usage patterns.
"""

import json
import os
import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timedelta, timezone

PROJECTS_DIR = Path.home() / ".claude" / "projects"

# Filter: only include sessions that started within the last N days (None = all time)
SINCE_DAYS = int(os.environ.get("SINCE_DAYS", "0")) or None
SINCE_DATE = os.environ.get("SINCE_DATE")  # e.g. "2026-03-30"


def extract_text_content(content):
    """Extract text from message content (string or list)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(item.get("text", ""))
            elif isinstance(item, str):
                parts.append(item)
        return "\n".join(parts).strip()
    return ""


def is_human_prompt(msg_obj):
    """Check if this is a human-originated prompt (not tool result)."""
    content = msg_obj.get("message", {}).get("content", "")
    if isinstance(content, list):
        types = [i.get("type") for i in content if isinstance(i, dict)]
        if types and all(t == "tool_result" for t in types):
            return False
    return True


def parse_session(jsonl_path, is_subagent=False):
    """Parse a single JSONL session file."""
    usage_total = defaultdict(int)
    prompts = []
    agent_id = None
    session_id = None
    timestamp_start = None
    subagent_sessions = []

    try:
        with open(jsonl_path, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception:
        return None

    for line in lines:
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue

        msg_type = obj.get("type")
        ts = obj.get("timestamp")

        if ts and not timestamp_start:
            timestamp_start = ts

        if not agent_id:
            agent_id = obj.get("agentId")

        if not session_id:
            session_id = obj.get("sessionId")

        if msg_type == "assistant":
            usage = obj.get("message", {}).get("usage", {})
            usage_total["input_tokens"] += usage.get("input_tokens", 0)
            usage_total["cache_creation_input_tokens"] += usage.get("cache_creation_input_tokens", 0)
            usage_total["cache_read_input_tokens"] += usage.get("cache_read_input_tokens", 0)
            usage_total["output_tokens"] += usage.get("output_tokens", 0)

        elif msg_type == "user":
            user_type = obj.get("userType", "")
            is_sidechain = obj.get("isSidechain", False)
            content = obj.get("message", {}).get("content", "")
            text = extract_text_content(content)

            if text and not is_sidechain and is_human_prompt(obj) and user_type != "tool":
                prompts.append({
                    "text": text,
                    "timestamp": obj.get("timestamp"),
                    "entrypoint": obj.get("entrypoint", ""),
                })

    # Check for subagent sessions
    session_dir = jsonl_path.parent / jsonl_path.stem
    if session_dir.is_dir():
        subagents_dir = session_dir / "subagents"
        if subagents_dir.is_dir():
            for sub_file in subagents_dir.glob("*.jsonl"):
                sub_data = parse_session(sub_file, is_subagent=True)
                if sub_data:
                    sub_data["subagent_file"] = str(sub_file.name)
                    subagent_sessions.append(sub_data)

    total_tokens = (
        usage_total["input_tokens"]
        + usage_total["cache_creation_input_tokens"]
        + usage_total["cache_read_input_tokens"]
        + usage_total["output_tokens"]
    )

    return {
        "file": str(jsonl_path),
        "session_id": session_id or jsonl_path.stem,
        "agent_id": agent_id,
        "is_subagent": is_subagent,
        "timestamp_start": timestamp_start,
        "usage": dict(usage_total),
        "total_tokens": total_tokens,
        "prompts": prompts,
        "subagent_sessions": subagent_sessions,
    }


def get_project_name(project_dir_name):
    """Convert directory name to readable project name."""
    name = project_dir_name
    # Strip Windows user path prefixes (case-insensitive)
    for prefix in ["c--Users-xbox3-", "C--Users-xbox3-"]:
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    return name or project_dir_name


def get_cutoff():
    """Return a UTC-aware datetime cutoff, or None for all time."""
    if SINCE_DATE:
        return datetime.fromisoformat(SINCE_DATE).replace(tzinfo=timezone.utc)
    if SINCE_DAYS:
        return datetime.now(timezone.utc) - timedelta(days=SINCE_DAYS)
    return None


def session_in_range(session, cutoff):
    if not cutoff or not session["timestamp_start"]:
        return True
    ts_str = session["timestamp_start"]
    try:
        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return ts >= cutoff
    except ValueError:
        return True


def analyze_all():
    """Analyze all projects and sessions."""
    projects = defaultdict(list)
    cutoff = get_cutoff()

    for project_dir in sorted(PROJECTS_DIR.iterdir()):
        if not project_dir.is_dir():
            continue

        project_name = get_project_name(project_dir.name)

        for jsonl_file in sorted(project_dir.glob("*.jsonl")):
            session = parse_session(jsonl_file)
            if session and session["total_tokens"] > 0 and session_in_range(session, cutoff):
                projects[project_name].append(session)

    return projects


def format_tokens(n):
    """Format token count with commas."""
    return f"{n:,}"


def summarize_projects(projects):
    """Build per-project summary."""
    summaries = []

    for project_name, sessions in projects.items():
        total = defaultdict(int)
        all_subagent_tokens = 0
        subagent_count = 0

        for session in sessions:
            for k, v in session["usage"].items():
                total[k] += v

            for sub in session["subagent_sessions"]:
                all_subagent_tokens += sub["total_tokens"]
                subagent_count += 1

        grand_total = sum(total.values())

        summaries.append({
            "project": project_name,
            "sessions": len(sessions),
            "usage": dict(total),
            "total_tokens": grand_total,
            "subagent_tokens": all_subagent_tokens,
            "subagent_count": subagent_count,
        })

    summaries.sort(key=lambda x: x["total_tokens"], reverse=True)
    return summaries


def find_costly_sessions(projects, top_n=20):
    """Find the most token-heavy sessions across all projects."""
    all_sessions = []
    for project_name, sessions in projects.items():
        for session in sessions:
            all_sessions.append((project_name, session))
    all_sessions.sort(key=lambda x: x[1]["total_tokens"], reverse=True)
    return all_sessions[:top_n]


def find_costly_subagents(projects, top_n=20):
    """Find the most token-heavy subagent sessions."""
    all_subs = []
    for project_name, sessions in projects.items():
        for session in sessions:
            for sub in session["subagent_sessions"]:
                all_subs.append((project_name, session["session_id"], sub))
    all_subs.sort(key=lambda x: x[2]["total_tokens"], reverse=True)
    return all_subs[:top_n]


def print_summary(summaries, projects):
    """Print a quick summary to stdout."""
    grand_total = sum(s["total_tokens"] for s in summaries)
    total_sessions = sum(s["sessions"] for s in summaries)
    total_subagent_tokens = sum(s["subagent_tokens"] for s in summaries)
    total_subagent_count = sum(s["subagent_count"] for s in summaries)

    print(f"\n{'='*86}")
    print(f"CLAUDE CODE TOKEN USAGE REPORT")
    print(f"{'='*86}")

    cutoff = get_cutoff()
    date_range = f"Since {cutoff.strftime('%Y-%m-%d')}" if cutoff else "All time"
    print(f"Range: {date_range}")
    print(f"Total: {format_tokens(grand_total)} tokens across {total_sessions} sessions in {len(summaries)} projects")
    print(f"Subagents: {total_subagent_count} sessions using {format_tokens(total_subagent_tokens)} tokens ({total_subagent_tokens*100//max(grand_total,1)}% of total)")
    print(f"{'='*86}\n")

    print(f"{'Project':<40} {'Sessions':>8} {'Total Tokens':>14} {'Subagents':>10} {'Sub Tokens':>14}")
    print("-" * 90)

    for s in summaries[:30]:
        pct = f"({s['subagent_tokens']*100//max(s['total_tokens'],1)}%)" if s['subagent_tokens'] > 0 else ""
        print(
            f"{s['project']:<40} {s['sessions']:>8,} {format_tokens(s['total_tokens']):>14} {s['subagent_count']:>10,} {format_tokens(s['subagent_tokens']):>14} {pct}"
        )

    print(f"\n{'Top 15 costliest sessions:'}")
    print("-" * 90)
    for i, (proj, session) in enumerate(find_costly_sessions(projects, top_n=15), 1):
        ts = session["timestamp_start"][:10] if session["timestamp_start"] else "?"
        subs = len(session["subagent_sessions"])
        sub_tokens = sum(s["total_tokens"] for s in session["subagent_sessions"])
        first_prompt = ""
        if session["prompts"]:
            first_prompt = session["prompts"][0]["text"][:70].replace("\n", " ")
        sub_info = f" [{subs} subs: {format_tokens(sub_tokens)}]" if subs > 0 else ""
        print(f" {i:>2}. [{ts}] {format_tokens(session['total_tokens']):>12} {proj}{sub_info}")
        if first_prompt:
            print(f"      > {first_prompt}")

    # Subagent-heavy sessions
    print(f"\n{'Top 15 costliest subagent runs:'}")
    print("-" * 90)
    costly_subs = find_costly_subagents(projects, top_n=15)
    for i, (proj, session_id, sub) in enumerate(costly_subs, 1):
        u = sub["usage"]
        print(f" {i:>2}. {format_tokens(sub['total_tokens']):>12} tokens | {proj} | session {session_id[:8]}... | {sub.get('subagent_file', '?')}")


def main():
    print("Scanning projects...")
    projects = analyze_all()
    print(f"Found {len(projects)} projects")

    summaries = summarize_projects(projects)
    print_summary(summaries, projects)


if __name__ == "__main__":
    main()
