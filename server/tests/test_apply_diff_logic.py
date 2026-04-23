import re
import sys

# Simplified version of the function for testing
def apply_diff(master_latex: str, diff: dict) -> str:
    result = master_latex

    # 1. Block-level Truncation
    blocks_to_keep = diff.get("blocks_to_keep")
    if blocks_to_keep is not None:
        pattern = re.compile(r"%\s*<BLOCK:([^>]+)>(.*?)%\s*<ENDBLOCK:\1>", re.DOTALL)
        
        def filter_blocks(match):
            block_name = match.group(1).strip()
            content = match.group(0)
            if block_name in blocks_to_keep:
                return content
            return ""
            
        result = pattern.sub(filter_blocks, result)

    # 2. Bullet Level Swaps
    for swap in diff.get("bullets_swapped", []):
        remove_text = swap["remove"].strip()
        add_text = swap["add"].strip()
        if remove_text in result:
             result = result.replace(remove_text, add_text, 1)

    # 3. Keyword Injection
    keywords = diff.get("keywords_added", [])
    if keywords:
        inject_str = ", ".join(keywords)
        if "% SKILLS_INJECT_POINT" in result:
            def inject_callback(match):
                line = match.group(0).rstrip()
                if line.endswith("}"):
                    return line[:-1] + f", {inject_str}}}"
                return line + f", {inject_str}"

            result = re.sub(
                r"(\\textbf\{(Skills|Programming Languages|Tools)[^}]*\}[^\n]*)",
                inject_callback,
                result, count=1
            )
            
    return result

# --- Test Cases ---

master = """
\\section{Experience}
% <BLOCK:A>
Experience A Content
% <ENDBLOCK:A>

% <BLOCK:B>
Experience B Content
% <ENDBLOCK:B>

\\section{Skills}
\\textbf{Programming Languages}{: Python, C++}
% SKILLS_INJECT_POINT
"""

print("Test 1: Truncation (Keep only A)")
diff1 = {"blocks_to_keep": ["A"]}
out1 = apply_diff(master, diff1)
assert "Experience A Content" in out1
assert "Experience B Content" not in out1
print("PASS")

print("Test 2: Skill Injection")
diff2 = {"keywords_added": ["Rust", "Go"]}
out2 = apply_diff(master, diff2)
assert "Python, C++, Rust, Go" in out2
print("PASS")

print("Test 3: Truncation + Selection (Keep none)")
diff3 = {"blocks_to_keep": []}
out3 = apply_diff(master, diff3)
assert "Experience A Content" not in out3
assert "Experience B Content" not in out3
print("PASS")

print("Test 4: Missing Skills Marker")
master_no_marker = "\\section{Skills}\n\\textbf{Languages}{: Python}"
diff4 = {"keywords_added": ["Rust"]}
out4 = apply_diff(master_no_marker, diff4)
assert "Rust" not in out4 # Should gracefully skip
print("PASS")

print("Test 5: Partial Selection (Keep only B)")
diff5 = {"blocks_to_keep": ["B"]}
out5 = apply_diff(master, diff5)
assert "Experience B Content" in out5
assert "Experience A Content" not in out5
print("PASS")

print("Test 6: Empty Diff")
out6 = apply_diff(master, {})
assert out6 == master
print("PASS")

print("\nAll logical tests passed!")
