#!/usr/bin/env python3
# /opt/notiapply/apply_diff.py
"""Applies LLM-generated resume diff to LaTeX master source with input validation.

Usage: python3 apply_diff.py /tmp/notiapply_diff_{application_id}.json [--dry-run]

Input JSON:
  { "master_latex": "...", "diff": { "bullets_swapped": [...], "keywords_added": [...] }, "application_id": N }

Output: writes tailored .tex file, prints output path to stdout.
"""

import re
import json
import sys
import os

# LaTeX control sequences that should never be injected by LLM
DANGEROUS_LATEX_COMMANDS = [
    r'\input',
    r'\include',
    r'\write',
    r'\immediate',
    r'\newcommand',
    r'\renewcommand',
    r'\def',
    r'\end{document}',
    r'\catcode',
]


def validate_diff(diff: dict) -> None:
    """Validate diff structure and content to prevent malformed LLM output."""
    if not isinstance(diff, dict):
        raise ValueError("diff must be a dictionary")

    # Validate blocks_to_keep
    blocks_to_keep = diff.get("blocks_to_keep")
    if blocks_to_keep is not None:
        if not isinstance(blocks_to_keep, list):
            raise ValueError("blocks_to_keep must be a list")
        if not all(isinstance(b, str) for b in blocks_to_keep):
            raise ValueError("blocks_to_keep must contain only strings")

    # Validate bullets_swapped
    bullets_swapped = diff.get("bullets_swapped", [])
    if not isinstance(bullets_swapped, list):
        raise ValueError("bullets_swapped must be a list")

    for i, swap in enumerate(bullets_swapped):
        if not isinstance(swap, dict):
            raise ValueError(f"bullets_swapped[{i}] must be a dictionary")
        if "remove" not in swap or "add" not in swap:
            raise ValueError(f"bullets_swapped[{i}] must have 'remove' and 'add' keys")
        if not isinstance(swap["remove"], str) or not isinstance(swap["add"], str):
            raise ValueError(f"bullets_swapped[{i}] values must be strings")

        # Sanitize LaTeX in added text
        for cmd in DANGEROUS_LATEX_COMMANDS:
            if cmd in swap["add"]:
                raise ValueError(f"Dangerous LaTeX command '{cmd}' detected in bullets_swapped[{i}].add")

    # Validate keywords_added
    keywords = diff.get("keywords_added", [])
    if not isinstance(keywords, list):
        raise ValueError("keywords_added must be a list")
    if not all(isinstance(k, str) for k in keywords):
        raise ValueError("keywords_added must contain only strings")

    # Check for dangerous LaTeX in keywords
    for i, keyword in enumerate(keywords):
        for cmd in DANGEROUS_LATEX_COMMANDS:
            if cmd in keyword:
                raise ValueError(f"Dangerous LaTeX command '{cmd}' detected in keywords_added[{i}]")


def sanitize_latex(text: str) -> str:
    """Escape special LaTeX characters in LLM-generated text."""
    # Don't escape if text already looks like LaTeX (contains backslashes)
    if '\\' in text:
        # Validate it doesn't contain dangerous commands
        for cmd in DANGEROUS_LATEX_COMMANDS:
            if cmd in text:
                raise ValueError(f"Dangerous LaTeX command '{cmd}' detected in generated text")
        return text

    # For plain text, escape special LaTeX characters
    replacements = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\textasciicircum{}',
    }

    for char, escaped in replacements.items():
        text = text.replace(char, escaped)

    return text


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


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python3 apply_diff.py <input.json> [--dry-run]\n")
        sys.exit(1)

    path = sys.argv[1]
    dry_run = "--dry-run" in sys.argv

    try:
        payload = json.loads(open(path).read())
    except (FileNotFoundError, json.JSONDecodeError) as e:
        sys.stderr.write(f"Error reading input file: {e}\n")
        sys.exit(1)

    # Validate payload structure
    if "master_latex" not in payload or "diff" not in payload:
        sys.stderr.write("Error: payload must contain 'master_latex' and 'diff' keys\n")
        sys.exit(1)

    try:
        # Validate diff structure
        validate_diff(payload["diff"])

        # Apply transformations
        output = apply_diff(payload["master_latex"], payload["diff"])

        if dry_run:
            sys.stdout.write("DRY RUN - Output preview:\n")
            sys.stdout.write("=" * 60 + "\n")
            sys.stdout.write(output[:500] + "...\n")
            sys.stdout.write("=" * 60 + "\n")
        else:
            out_path = path.replace(".json", "_output.tex")
            with open(out_path, "w") as f:
                f.write(output)
            os.remove(path)  # clean up temp file
            print(out_path)  # n8n captures this as the output path

    except ValueError as e:
        sys.stderr.write(f"Validation error: {str(e)}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Unexpected error: {str(e)}\n")
        sys.exit(1)
