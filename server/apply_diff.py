#!/usr/bin/env python3
# /opt/notiapply/apply_diff.py
"""Applies LLM-generated resume diff to LaTeX master source.

Usage: python3 apply_diff.py /tmp/notiapply_diff_{application_id}.json

Input JSON:
  { "master_latex": "...", "diff": { "bullets_swapped": [...], "keywords_added": [...] }, "application_id": N }

Output: writes tailored .tex file, prints output path to stdout.
"""

import re
import json
import sys
import os


def apply_diff(master_latex: str, diff: dict) -> str:
    result = master_latex

    for swap in diff.get("bullets_swapped", []):
        remove_text = swap["remove"].strip()
        add_text = swap["add"].strip()
        if remove_text not in result:
            raise ValueError(f"Bullet not found in master: {remove_text[:80]}")
        result = result.replace(remove_text, add_text, 1)

    keywords = diff.get("keywords_added", [])
    if keywords:
        inject_str = ", ".join(keywords)
        if "% SKILLS_INJECT_POINT" not in result:
            sys.stderr.write("Warning: SKILLS_INJECT_POINT marker missing — keyword injection skipped\n")
        else:
            result = re.sub(
                r"(\\textbf\{Skills\}[^\n]*)",
                lambda m: m.group(0).rstrip() + f", {inject_str}",
                result, count=1
            )
    return result


path = sys.argv[1]
payload = json.loads(open(path).read())
os.remove(path)  # clean up temp file

try:
    output = apply_diff(payload["master_latex"], payload["diff"])
    out_path = path.replace(".json", "_output.tex")
    open(out_path, "w").write(output)
    print(out_path)  # n8n captures this as the output path
except ValueError as e:
    sys.stderr.write(str(e) + "\n")
    sys.exit(1)
