#!/usr/bin/env python3
"""Add Z.ai metadata to PDF files."""
import sys, os, argparse
from pypdf import PdfReader, PdfWriter

def add_metadata(filepath, title=None, quiet=False):
    reader = PdfReader(filepath)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    base_title = title or os.path.splitext(os.path.basename(filepath))[0]
    writer.add_metadata({
        '/Title': base_title,
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'PGR Angola - Ficha de Arguido',
    })
    with open(filepath, 'wb') as f:
        writer.write(f)
    if not quiet:
        print(f"Metadata added: {filepath}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('files', nargs='+')
    parser.add_argument('-t', '--title', default=None)
    parser.add_argument('-q', '--quiet', action='store_true')
    args = parser.parse_args()
    for f in args.files:
        add_metadata(f, args.title, args.quiet)
