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

    # 1. Block-level Truncation
    # If blocks_to_keep is provided, delete all other tagged blocks
    blocks_to_keep = diff.get("blocks_to_keep")
    if blocks_to_keep is not None:
        # Regex to find blocks like % <BLOCK:Name> ... % <ENDBLOCK:Name>
        # Use re.DOTALL to match across lines
        pattern = re.compile(r"%\s*<BLOCK:([^>]+)>(.*?)%\s*<ENDBLOCK:\1>", re.DOTALL)
        
        def filter_blocks(match):
            block_name = match.group(1).strip()
            content = match.group(0)
            if block_name in blocks_to_keep:
                return content
            return "" # Remove block
            
        result = pattern.sub(filter_blocks, result)

    # 2. Bullet Level Swaps (for the remaining blocks)
    for swap in diff.get("bullets_swapped", []):
        remove_text = swap["remove"].strip()
        add_text = swap["add"].strip()
        if remove_text in result:
             result = result.replace(remove_text, add_text, 1)

    # 3. Keyword Injection
    # Look for any skill-like line and append there if marker exists
    keywords = diff.get("keywords_added", [])
    if keywords:
        inject_str = ", ".join(keywords)
        if "% SKILLS_INJECT_POINT" in result:
            def inject_callback(match):
                line = match.group(0).rstrip()
                # If the line ends with a brace (like \textbf{...}), insert before it
                if line.endswith("}"):
                    return line[:-1] + f", {inject_str}}}"
                return line + f", {inject_str}"

            result = re.sub(
                r"(\\textbf\{(Skills|Programming Languages|Tools)[^}]*\}[^\n]*)",
                inject_callback,
                result, count=1
            )
        else:
            sys.stderr.write("Warning: SKILLS_INJECT_POINT marker missing — keyword injection skipped\n")
            
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
