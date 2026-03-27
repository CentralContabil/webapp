# -*- coding: utf-8 -*-
"""Monta o payload interno (campos entre o primeiro e o último '|') a partir de uma linha do XLSX."""
from __future__ import annotations

import math
from typing import Any

try:
    import pandas as pd
except ImportError:
    pd = None  # type: ignore


def cell_str(value: Any) -> str:
    if value is None or (pd is not None and isinstance(value, float) and pd.isna(value)):
        return ""
    if isinstance(value, float):
        if math.isnan(value):
            return ""
        if value == int(value):
            return str(int(value))
        s = f"{value:.12f}".rstrip("0").rstrip(".")
        return s if s else "0"
    if isinstance(value, int):
        return str(value)
    return str(value).strip()


def sorted_extra_keys(columns: list[str]) -> list[str]:
    extras: list[tuple[int, str]] = []
    for c in columns:
        if not isinstance(c, str) or not c.startswith("EXTRA_"):
            continue
        tail = c[6:]
        if tail.isdigit():
            extras.append((int(tail), c))
    extras.sort(key=lambda x: x[0])
    return [c for _, c in extras]


def inner_payload_for_register(reg: str, row: dict[str, Any], headers_rec: list[str]) -> list[str]:
    """
    Campos do arquivo .txt após split('|')[1:-1], na ordem do SPED físico.
    Colunas injetadas no Excel (NUM_DOC / CHV_*) não existem como pipes separados na linha.
    """
    h = headers_rec

    if reg in ("C170", "C190"):
        inner = [cell_str(row.get(h[0], ""))] + [cell_str(row.get(c, "")) for c in h[3:]]
    elif reg == "D190":
        inner = [cell_str(row.get(h[0], ""))] + [cell_str(row.get(c, "")) for c in h[3:]]
    elif reg in ("C590", "D590"):
        inner = [cell_str(row.get(h[0], ""))] + [cell_str(row.get(c, "")) for c in h[2:]]
    else:
        inner = [cell_str(row.get(c, "")) for c in h]

    return inner


def append_extras(inner: list[str], row: dict[str, Any], sheet_columns: list[str]) -> list[str]:
    for k in sorted_extra_keys(sheet_columns):
        if k in row:
            inner.append(cell_str(row[k]))
    return inner


def build_sped_line(inner: list[str]) -> str:
    return "|" + "|".join(inner) + "|"
