# -*- coding: utf-8 -*-
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

_ROOT = Path(__file__).resolve().parent
_SPED_ENGINE = _ROOT.parent / "webapp-02" / "sped_engine"
if _SPED_ENGINE.is_dir():
    sys.path.insert(0, str(_SPED_ENGINE))

from config import HEADERS, SHEET_ORDER  # noqa: E402

from line_builders import append_extras, build_sped_line, inner_payload_for_register


def _read_text(path: Path) -> str:
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            return path.read_text(encoding=enc, errors="replace")
        except OSError:
            continue
    raise RuntimeError(f"Não foi possível ler {path}")


def _reg_from_sped_line(line: str) -> str | None:
    if "|" not in line:
        return None
    parts = line.rstrip("\r\n").split("|")
    if len(parts) < 3:
        return None
    return (parts[1] or "").strip().upper() or None


def merge_sped_from_xlsx(sped_path: Path, xlsx_path: Path, output_path: Path) -> None:
    text = _read_text(sped_path)
    lines = text.splitlines()
    if not lines:
        raise ValueError("Arquivo SPED vazio.")

    xl = pd.ExcelFile(xlsx_path, engine="openpyxl")

    for sheet in SHEET_ORDER:
        if sheet not in xl.sheet_names:
            raise ValueError(f"Aba obrigatória ausente no XLSX: {sheet}")
        if sheet not in HEADERS:
            continue

        df = pd.read_excel(xl, sheet_name=sheet, dtype=object)
        if "_LINHA" not in df.columns:
            raise ValueError(f"Aba '{sheet}': coluna _LINHA obrigatória (use XLSX gerado pela ferramenta atual).")
        if df.empty:
            continue

        headers_rec = HEADERS[sheet]
        cols = list(df.columns)

        for idx in range(len(df)):
            row = df.iloc[idx]
            line_no = row["_LINHA"]
            if pd.isna(line_no):
                continue
            try:
                n = int(float(line_no))
            except (TypeError, ValueError) as e:
                raise ValueError(f"Aba '{sheet}', linha Excel {idx + 2}: _LINHA inválida: {line_no!r}") from e

            if n < 1 or n > len(lines):
                raise ValueError(f"Aba '{sheet}', linha Excel {idx + 2}: _LINHA={n} fora do intervalo (1–{len(lines)}).")

            orig = lines[n - 1]
            reg_file = _reg_from_sped_line(orig)
            if reg_file != sheet:
                raise ValueError(
                    f"Aba '{sheet}', _LINHA={n}: registro no SPED é {reg_file!r}, esperado {sheet!r}."
                )

            row_dict = {c: row[c] for c in cols}
            inner = inner_payload_for_register(sheet, row_dict, headers_rec)
            inner = append_extras(inner, row_dict, cols)
            lines[n - 1] = build_sped_line(inner)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + ("\n" if text.endswith("\n") else ""), encoding="utf-8", newline="\n")
