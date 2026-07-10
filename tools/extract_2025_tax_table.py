#!/usr/bin/env python3
"""Extract the 2025 Form 1040 tax table from the captured official IRS instructions.

This is a build-time evidence tool. It does not interpret tax eligibility. It extracts the
published line-16 lookup table for taxable income below $100,000 and validates continuity.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import date
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/official-forms/irs-individual-income-tax/i1040gi and i1040-SR for U.S. Income Tax Return.pdf"
OUTPUT = ROOT / "assets/tax-rules/2025-federal-income-tax-table.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_rows() -> list[dict]:
    reader = PdfReader(str(SOURCE))
    rows: list[dict] = []
    # Printed instruction pages 68-79 correspond to PDF pages 68-79 (zero-based 67-78).
    for page_index in range(67, 79):
        text = reader.pages[page_index].extract_text() or ""
        for line in text.splitlines():
            tokens = re.findall(r"(?<![A-Za-z])\d[\d,]*", line)
            if len(tokens) != 6:
                continue
            values = [int(token.replace(",", "")) for token in tokens]
            lower, upper, single, mfj, mfs, hoh = values
            if not (0 <= lower < 100000 and lower < upper <= 100000):
                continue
            if not (0 < upper - lower <= 100):
                continue
            if any(value < 0 or value >= 100000 for value in (single, mfj, mfs, hoh)):
                continue
            rows.append({
                "atLeast": lower,
                "lessThan": upper,
                "single": single,
                "marriedFilingJointlyOrQualifyingSurvivingSpouse": mfj,
                "marriedFilingSeparately": mfs,
                "headOfHousehold": hoh,
                "sourcePdfPage": page_index + 1,
            })

    unique: dict[tuple[int, int], dict] = {}
    for row in rows:
        key = (row["atLeast"], row["lessThan"])
        if key in unique:
            raise RuntimeError(f"Duplicate tax-table interval: {key}")
        unique[key] = row
    ordered = [unique[key] for key in sorted(unique)]
    if not ordered or ordered[0]["atLeast"] != 0 or ordered[-1]["lessThan"] != 100000:
        raise RuntimeError("Tax table does not cover the full 0-through-99,999 range.")
    for previous, current in zip(ordered, ordered[1:]):
        if previous["lessThan"] != current["atLeast"]:
            raise RuntimeError(
                f"Tax-table gap or overlap between {previous['lessThan']} and {current['atLeast']}"
            )
    if len(ordered) != 2062:
        raise RuntimeError(f"Expected 2,062 tax-table intervals; found {len(ordered)}")
    sample = next(row for row in ordered if row["atLeast"] == 25300 and row["lessThan"] == 25350)
    if sample["marriedFilingJointlyOrQualifyingSurvivingSpouse"] != 2562:
        raise RuntimeError("Official IRS example validation failed for $25,300 MFJ taxable income.")
    return ordered


def main() -> None:
    rows = extract_rows()
    payload = {
        "version": "0.1.72",
        "taxYear": 2025,
        "tablePurpose": "Form 1040 line 16 lookup for taxable income below $100,000",
        "source": {
            "agency": "Internal Revenue Service",
            "documentTitle": "2025 Instructions for Form 1040 and 1040-SR",
            "filename": SOURCE.name,
            "relativePath": str(SOURCE.relative_to(ROOT)),
            "sha256": sha256(SOURCE),
            "officialUrl": "https://www.irs.gov/pub/irs-pdf/i1040gi.pdf",
            "printedPages": "68-79",
            "pdfPages": "68-79",
            "sourceVerificationStatus": "official_url_and_local_pdf_identified; local checksum controls packaged source",
        },
        "generatedAt": str(date.today()),
        "rowCount": len(rows),
        "coverage": {"minimumTaxableIncome": 0, "maximumTaxableIncomeExclusive": 100000},
        "filingStatusColumns": [
            "single",
            "marriedFilingJointlyOrQualifyingSurvivingSpouse",
            "marriedFilingSeparately",
            "headOfHousehold",
        ],
        "validationEvidence": {
            "continuousCoverage": True,
            "duplicateIntervals": 0,
            "officialExample": {
                "taxableIncome": 25300,
                "filingStatus": "married_filing_jointly",
                "expectedTax": 2562,
                "passed": True,
            },
        },
        "rows": rows,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT.relative_to(ROOT)),
        "rowCount": len(rows),
        "sourceSha256": payload["source"]["sha256"],
        "officialExamplePassed": True,
    }, indent=2))


if __name__ == "__main__":
    main()
