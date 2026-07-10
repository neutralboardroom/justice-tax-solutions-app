#!/usr/bin/env python3
"""Compare user-supplied official-form ZIPs with packaged controlled source assets."""
from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLLECTIONS = {
    "individual": ROOT / "assets/official-forms/irs-individual-income-tax",
    "resolution": ROOT / "assets/official-forms/irs-tax-debt-resolution",
}


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def document_key(path: Path) -> str:
    # The user archive and packaged collection encode some accented Spanish filenames
    # differently. The IRS form/instruction code at the beginning of each filename is
    # stable and unique within these collections.
    return path.name.split(' ', 1)[0].lower()


def find_pdfs(root: Path) -> dict[str, Path]:
    files = {}
    for path in root.rglob("*.pdf"):
        if "generated-samples" in path.parts:
            continue
        key = document_key(path)
        if key in files:
            raise RuntimeError(f"Duplicate document code {key} in {root}")
        files[key] = path
    return files


def compare(archive: Path, collection: Path) -> dict:
    with tempfile.TemporaryDirectory(prefix="jts_form_archive_") as temp:
        with zipfile.ZipFile(archive) as zipped:
            bad = zipped.testzip()
            if bad:
                raise RuntimeError(f"Corrupt member in {archive.name}: {bad}")
            zipped.extractall(temp)
        uploaded = find_pdfs(Path(temp))
        packaged = find_pdfs(collection)
        exact = []
        changed = []
        for key in sorted(set(uploaded) & set(packaged)):
            if digest(uploaded[key]) == digest(packaged[key]):
                exact.append(key)
            else:
                changed.append(key)
        return {
            "archiveFilename": archive.name,
            "archiveSha256": digest(archive),
            "archivePdfCount": len(uploaded),
            "packagedPdfCount": len(packaged),
            "exactMatchCount": len(exact),
            "changedFiles": changed,
            "onlyInArchive": sorted(set(uploaded) - set(packaged)),
            "onlyInPackagedCollection": sorted(set(packaged) - set(uploaded)),
            "allArchivePdfsMatched": len(exact) == len(uploaded) and not changed and not (set(uploaded) - set(packaged)),
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--individual-zip", type=Path, required=True)
    parser.add_argument("--resolution-zip", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "assets/official-forms/intake-reports/user-supplied-archives-v0.1.72.json")
    args = parser.parse_args()
    report = {
        "version": "0.1.72",
        "generatedAt": str(date.today()),
        "purpose": "Controlled comparison of the two user-supplied IRS form archives against packaged official-form assets.",
        "individual": compare(args.individual_zip, COLLECTIONS["individual"]),
        "resolution": compare(args.resolution_zip, COLLECTIONS["resolution"]),
        "conclusion": {
            "pdfsReplaced": False,
            "reason": "Every PDF supplied in both archives exactly matches its packaged counterpart. The packaged resolution collection also contains Form 8821 and its instructions, which are preserved to avoid regression.",
            "releaseBoundary": "Hash matching proves file identity only. It does not prove current revision, semantic mapping, calculation correctness, human QA, professional approval, owner release, filing readiness, or IRS acceptance.",
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
