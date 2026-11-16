"""Validate printed synthetic fixture PDFs, after browser-qa.mjs; no student source files."""
from pathlib import Path
from pypdf import PdfReader
import pdfplumber

root = Path(__file__).resolve().parent.parent / 'qa'
for kind in ['students', 'supervisor']:
    path = root / f'{kind}-38-long-names.pdf'
    reader = PdfReader(path)
    assert len(reader.pages) == 2, (kind, len(reader.pages))
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            assert 594 < page.width < 597 and 840 < page.height < 843
            assert page.chars, (kind, i, 'empty page')
            assert all(c['x0'] >= 15 and c['x1'] <= page.width - 15 for c in page.chars), (kind, i, 'horizontal clipping')
            assert all(c['top'] >= 15 and c['bottom'] <= page.height - 15 for c in page.chars), (kind, i, 'vertical clipping')
    print(f'{kind}: 2 A4 pages, no empty pages or clipped text')
