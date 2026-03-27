# -*- coding: utf-8 -*-
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))
_FIXTURE_SPED = _ROOT.parent / "webapp-01" / "tests" / "fixtures" / "sped_minimo.txt"
_ENGINE = _ROOT.parent / "webapp-02" / "sped_engine"
_CLI_EXPORT = _ENGINE / "cli.py"
_CLI_MERGE = _ROOT / "cli_merge.py"


@pytest.mark.skipif(not _FIXTURE_SPED.is_file(), reason="fixture SPED ausente")
@pytest.mark.skipif(not _CLI_EXPORT.is_file(), reason="sped_engine ausente")
def test_roundtrip_minimo_unchanged(tmp_path: Path) -> None:
    xlsx = tmp_path / "out.xlsx"
    out_txt = tmp_path / "merged.txt"
    subprocess.run(
        [sys.executable, str(_CLI_EXPORT), "--input", str(_FIXTURE_SPED), "--output", str(xlsx)],
        cwd=str(_ENGINE),
        check=True,
        capture_output=True,
        text=True,
    )
    subprocess.run(
        [sys.executable, str(_CLI_MERGE), "--sped", str(_FIXTURE_SPED), "--xlsx", str(xlsx), "--output", str(out_txt)],
        cwd=str(_ROOT),
        check=True,
        capture_output=True,
        text=True,
    )
    orig = _FIXTURE_SPED.read_text(encoding="utf-8", errors="replace")
    merged = out_txt.read_text(encoding="utf-8", errors="replace")
    assert merged.rstrip("\r\n") == orig.rstrip("\r\n")


def test_inner_payload_c170_skips_injected() -> None:
    sys.path.insert(0, str(_ROOT.parent / "webapp-02" / "sped_engine"))
    from config import HEADERS  # noqa: WPS433

    from line_builders import build_sped_line, inner_payload_for_register

    row = {
        "REG": "C170",
        "NUM_DOC": "999",
        "CHV_NFE": "x",
        "NUM_ITEM": "1",
        "COD_ITEM": "ABC",
    }
    inner = inner_payload_for_register("C170", row, HEADERS["C170"])
    assert inner[0] == "C170"
    assert "999" not in inner and "x" not in inner
    assert inner[1] == "1"
    assert inner[2] == "ABC"
    assert build_sped_line(inner).startswith("|C170|1|ABC|")
