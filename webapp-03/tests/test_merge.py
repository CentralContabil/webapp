# -*- coding: utf-8 -*-
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from openpyxl import Workbook, load_workbook
import pytest

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))
_FIXTURE_SPED = _ROOT.parent / "webapp-01" / "tests" / "fixtures" / "sped_minimo.txt"
_ENGINE = _ROOT.parent / "webapp-02" / "sped_engine"
_CLI_EXPORT = _ENGINE / "cli.py"
_CLI_MERGE = _ROOT / "cli_merge.py"
from merger import merge_sped_from_xlsx


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


@pytest.mark.skipif(not _FIXTURE_SPED.is_file(), reason="fixture SPED ausente")
@pytest.mark.skipif(not _CLI_EXPORT.is_file(), reason="sped_engine ausente")
def test_merge_aplica_edicao_reg_0000(tmp_path: Path) -> None:
    xlsx = tmp_path / "out_0000.xlsx"
    out_txt = tmp_path / "merged_0000.txt"
    subprocess.run(
        [sys.executable, str(_CLI_EXPORT), "--input", str(_FIXTURE_SPED), "--output", str(xlsx), "--sheets", "0000"],
        cwd=str(_ENGINE),
        check=True,
        capture_output=True,
        text=True,
    )

    wb = load_workbook(xlsx)
    ws = wb["0000"]
    headers = [str(c.value or "") for c in ws[1]]
    col_nome = headers.index("NOME") + 1
    ws.cell(row=2, column=col_nome).value = "EMPRESA EDITADA TESTE"
    wb.save(xlsx)

    subprocess.run(
        [sys.executable, str(_CLI_MERGE), "--sped", str(_FIXTURE_SPED), "--xlsx", str(xlsx), "--output", str(out_txt)],
        cwd=str(_ROOT),
        check=True,
        capture_output=True,
        text=True,
    )

    merged = out_txt.read_text(encoding="utf-8", errors="replace")
    assert "EMPRESA EDITADA TESTE" in merged


def test_merge_aplica_reg_generico_fora_dos_headers(tmp_path: Path) -> None:
    sped = tmp_path / "orig.txt"
    xlsx = tmp_path / "edit.xlsx"
    out = tmp_path / "out.txt"
    sped.write_text("|0000|017|0|\n|Z999|A|B|\n", encoding="utf-8")

    wb = Workbook()
    ws = wb.active
    ws.title = "Z999"
    ws.append(["_LINHA", "COL_01", "COL_02", "COL_03"])
    ws.append([2, "Z999", "EDITADO", "B"])
    wb.save(xlsx)

    merge_sped_from_xlsx(sped, xlsx, out)

    merged = out.read_text(encoding="utf-8", errors="replace")
    assert "|Z999|EDITADO|B|" in merged


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
