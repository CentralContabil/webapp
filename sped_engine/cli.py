#!/usr/bin/env python3
"""CLI headless: converte SPED .txt em XLSX (sem Tkinter/Qt)."""
import argparse
import json
import sys
from pathlib import Path

from cli_progress_stdout import CliProgress
from config import HEADERS
from dataframe_builder import DefaultDataFrameBuilder
from parser import DefaultSpedParser
from processor import Processor
from reader import SpedFileReader
from report import DefaultReportBuilder
from writer_xlsxwriter import XlsxWriterExcelWriter


def main() -> int:
    p = argparse.ArgumentParser(description="SPED EFD TXT -> XLSX")
    p.add_argument("--input", required=True, help="Arquivo SPED .txt")
    p.add_argument("--output", required=True, help="Caminho completo do .xlsx de saída")
    args = p.parse_args()
    inp = Path(args.input)
    out = Path(args.output)
    if not inp.is_file():
        print(json.dumps({"kind": "error", "message": f"Entrada não encontrada: {inp}"}), flush=True)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        if out.suffix.lower() != ".xlsx":
            out = out.with_suffix(".xlsx")

        prog = CliProgress()
        processor = Processor(
            reader=SpedFileReader(),
            parser=DefaultSpedParser(),
            df_builder=DefaultDataFrameBuilder(HEADERS),
            writer=XlsxWriterExcelWriter(),
            formatter=None,
            reporter=DefaultReportBuilder(),
            progress=prog,
        )
        processor.run(inp, out)
        print(json.dumps({"kind": "done", "output": str(out.resolve())}), flush=True)
        return 0
    except Exception as e:
        print(json.dumps({"kind": "error", "message": str(e)}), flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
