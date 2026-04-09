#!/usr/bin/env python3
"""Sanitize PDF generation code to remove forbidden Unicode characters."""
import re, sys

REPLACEMENTS = {
    '\u00b2': '<super>2</super>', '\u00b3': '<super>3</super>', '\u00b9': '<super>1</super>',
    '\u2070': '<super>0</super>', '\u2074': '<super>4</super>', '\u2075': '<super>5</super>',
    '\u2076': '<super>6</super>', '\u2077': '<super>7</super>', '\u2078': '<super>8</super>',
    '\u2079': '<super>9</super>',
    '\u2080': '<sub>0</sub>', '\u2081': '<sub>1</sub>', '\u2082': '<sub>2</sub>',
    '\u2083': '<sub>3</sub>', '\u2084': '<sub>4</sub>', '\u2085': '<sub>5</sub>',
    '\u2086': '<sub>6</sub>', '\u2087': '<sub>7</sub>', '\u2088': '<sub>8</sub>',
    '\u2089': '<sub>9</sub>',
    '\u2245': '=~', '\u2248': '~=', '\u0394': 'Delta', '\u2212': '-',
    '\u00d7': 'x', '\u2728': '', '\u2705': '', '\u274c': '', '\u26a0': '',
}

def sanitize(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    for char, repl in REPLACEMENTS.items():
        content = content.replace(char, repl)
    content = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)).encode('ascii', 'ignore').decode(), content)
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Sanitized {filepath}")
    else:
        print(f"Clean: {filepath}")

if __name__ == '__main__':
    for f in sys.argv[1:]:
        sanitize(f)
