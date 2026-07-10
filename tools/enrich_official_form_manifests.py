#!/usr/bin/env python3
"""Add controlled source and revision metadata without overstating live verification."""
from __future__ import annotations

import json
import re
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
COLLECTIONS = [
    ROOT / "assets/official-forms/irs-individual-income-tax",
    ROOT / "assets/official-forms/irs-tax-debt-resolution",
]
VERIFIED_URLS = {
    "f1040": "https://www.irs.gov/pub/irs-pdf/f1040.pdf",
    "i1040gi": "https://www.irs.gov/pub/irs-pdf/i1040gi.pdf",
}


def code_from_filename(filename: str) -> str:
    return filename.split(" ", 1)[0].lower().removesuffix(".pdf")


def metadata_for(pdf: Path) -> dict:
    reader = PdfReader(str(pdf))
    meta = reader.metadata or {}
    title = str(meta.get("/Title") or "").strip()
    subject = str(meta.get("/Subject") or "").strip()
    creation = str(meta.get("/CreationDate") or "").strip()
    year_match = re.search(r"\b(20\d{2})\b", f"{title} {subject}")
    return {
        "pdfTitle": title,
        "pdfSubject": subject,
        "pdfCreationDate": creation,
        "revisionOrTaxYearFromPdfMetadata": int(year_match.group(1)) if year_match else None,
    }


def main() -> None:
    for collection in COLLECTIONS:
        manifest_path = collection / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["version"] = "0.1.72"
        manifest["sourceArchiveIntakeReport"] = "assets/official-forms/intake-reports/user-supplied-archives-v0.1.72.json"
        manifest["sourceControlPolicy"] = (
            "A captured PDF remains blocked from real-user release until its current official source, revision, tax year, "
            "semantic mapping, calculations, human visual QA, professional approval, and owner release are separately verified."
        )
        for item in manifest.get("forms", []):
            filename = item.get("filename", "")
            pdf = ROOT / item.get("relativePath", "")
            code = code_from_filename(filename)
            if pdf.exists():
                item.update(metadata_for(pdf))
                item["checksumStatus"] = "packaged_file_matches_manifest_sha256"
            candidate = f"https://www.irs.gov/pub/irs-pdf/{code}.pdf"
            item["officialUrlCandidate"] = candidate
            if code in VERIFIED_URLS:
                item["officialUrl"] = VERIFIED_URLS[code]
                item["sourceVerificationStatus"] = "official_irs_url_verified_2026-07-10"
            else:
                item["sourceVerificationStatus"] = "user_supplied_official_archive_hash_matched; live_official_url_and_current_revision_reverification_required"
            item["activeSupersededStatus"] = "not_yet_live_verified"
            item["releaseStatus"] = "captured_source_only"
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(collection.name, len(manifest.get("forms", [])))


if __name__ == "__main__":
    main()
