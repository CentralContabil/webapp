# -*- coding: utf-8 -*-
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import re

_ROOT = Path(__file__).resolve().parent
_SPED_ENGINE = _ROOT.parent / "webapp-02" / "sped_engine"
if _SPED_ENGINE.is_dir():
    sys.path.insert(0, str(_SPED_ENGINE))

from cabecalhos_sped import merge_headers  # noqa: E402
from config import HEADERS  # noqa: E402

from line_builders import (
    append_extras,
    build_sped_line,
    inner_payload_for_register_with_template,
    normalize_sped_field,
)

MERGE_HEADERS = merge_headers(HEADERS)
REG_SHEET_RE = re.compile(r"^[0-9A-Z]{4}$")


def _is_reg_sheet(name: str) -> bool:
    return bool(REG_SHEET_RE.fullmatch(name.strip().upper()))


def _sorted_col_keys(columns: list[str]) -> list[str]:
    cols: list[tuple[int, str]] = []
    for c in columns:
        if not isinstance(c, str) or not c.startswith("COL_"):
            continue
        tail = c[4:]
        if tail.isdigit():
            cols.append((int(tail), c))
    cols.sort(key=lambda x: x[0])
    return [c for _, c in cols]


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

    editable_sheets = [sheet for sheet in xl.sheet_names if _is_reg_sheet(sheet)]
    if not editable_sheets:
        raise ValueError("Nenhuma aba de registro SPED encontrada no XLSX.")

    for sheet in editable_sheets:

        df = pd.read_excel(xl, sheet_name=sheet, dtype=object)
        if "_LINHA" not in df.columns:
            raise ValueError(f"Aba '{sheet}': coluna _LINHA obrigatória (use XLSX gerado pela ferramenta atual).")
        if df.empty:
            continue

        headers_rec = MERGE_HEADERS.get(sheet)
        cols = list(df.columns)
        col_keys = _sorted_col_keys(cols)
        if headers_rec is None and not col_keys:
            raise ValueError(
                f"Aba '{sheet}': sem mapeamento conhecido e sem colunas COL_XX para reconstruir a linha."
            )

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
            orig_inner = orig.rstrip("\r\n").split("|")[1:-1]

            row_dict = {c: row[c] for c in cols}
            if headers_rec is not None:
                inner = inner_payload_for_register_with_template(sheet, row_dict, headers_rec, orig_inner)
            else:
                inner = []
                for i, c in enumerate(col_keys):
                    template_value = orig_inner[i] if i < len(orig_inner) else None
                    inner.append(normalize_sped_field(c, row_dict.get(c, ""), template_value))
            inner = append_extras(inner, row_dict, cols, template_inner=orig_inner)
            # Mantém a cardinalidade exata de campos da linha original para evitar
            # rejeições no PVA por "número de campos diferente do leiaute".
            if len(inner) < len(orig_inner):
                inner.extend([""] * (len(orig_inner) - len(inner)))
            elif len(inner) > len(orig_inner):
                inner = inner[: len(orig_inner)]
            lines[n - 1] = build_sped_line(inner)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + ("\n" if text.endswith("\n") else ""), encoding="utf-8", newline="\n")
