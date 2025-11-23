"""
Seed prompt templates for the curriculum authoring service.

IMPORTANT NOTE:
================
This script is NO LONGER USED to seed "default" problem generation templates.

The problem generation system now relies on context variety through primitives
(objects, characters, scenarios, locations) sampled during generation. This creates
natural variation in prompts without needing a static "default" template.

The workflow is now:
1. Generate problems with varied prompts (using primitives)
2. Evaluate generated problems
3. Store high-quality prompts (>85% score) as template candidates
4. Build a library of proven prompts from real-world evaluation

This script can still be used to create CUSTOM templates for specific use cases,
but should NOT create a "default_problem_generation" template that overrides
the variation system.

Usage:
    python scripts/seed_prompt_templates.py
"""

import requests
import json

BASE_URL = "http://localhost:8001"

def create_prompt_template(name, template_type, template_text, template_variables, is_active=True):
    """Create a prompt template via the API."""
    url = f"{BASE_URL}/api/prompts"

    payload = {
        "template_name": name,
        "template_type": template_type,
        "template_text": template_text,
        "template_variables": template_variables,
        "is_active": is_active,
        "change_notes": "Custom template"
    }

    response = requests.post(url, json=payload)

    if response.status_code == 200:
        data = response.json()
        print(f"[SUCCESS] Created template: {name} (v{data.get('version', 1)})")
        print(f"   Template ID: {data.get('template_id')}")
        return data
    else:
        print(f"[ERROR] Failed to create template: {name}")
        print(f"   Status: {response.status_code}")
        print(f"   Error: {response.text}")
        return None

def main():
    print("Prompt Template Seeding Script")
    print("=" * 50)
    print("\nNOTE: The 'default' template has been removed.")
    print("Problem generation now uses context variety through primitives.")
    print("\nTo create custom templates, modify this script and add your templates here.")
    print("\nNo templates to seed. Exiting.")
    print("=" * 50)

if __name__ == "__main__":
    main()
