
import pandas as pd
import re

def _to_number(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip()
        if s == "":
            return None
        neg = False
        if s.startswith("(") and s.endswith(")"):
            neg = True
            s = s[1:-1]
        s = re.sub(r"[^0-9,.-]", "", s)
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            s = s.replace(",", ".")
        try:
            num = float(s)
            return -num if neg else num
        except ValueError:
            return None
    return None

class XlsxWriterExcelWriter:
    def __init__(self):
        pass

    def write(self, dataframes: dict, output):
        with pd.ExcelWriter(output, engine="xlsxwriter") as w:
            workbook  = w.book
            header_fmt = workbook.add_format({
                "bold": True,
                "bg_color": "#4F81BD",
                "font_color": "white",
                "align": "center",
                "valign": "vcenter"
            })
            cell_fmt = workbook.add_format({
                "align": "center",
                "valign": "vcenter"
            })
            num_fmt = workbook.add_format({
                "align": "center",
                "valign": "vcenter",
                "num_format": "#,##0.00"
            })
            int_fmt = workbook.add_format({
                "align": "center",
                "valign": "vcenter",
                "num_format": "0"
            })

            for name, df in dataframes.items():
                # Converte colunas 'VL_*' para número ANTES de escrever
                for col in list(df.columns):
                    if col == "_LINHA":
                        continue
                    if isinstance(col, str) and col.upper().startswith("VL_"):
                        df[col] = df[col].map(_to_number)

                df.to_excel(w, index=False, sheet_name=name)
                ws = w.sheets[name]

                # Cabeçalho
                for col_num, value in enumerate(df.columns.values):
                    ws.write(0, col_num, value, header_fmt)

                    # Largura + formato por coluna (nunca len() no valor bruto: float/NaN/pd.NA quebram)
                    if not df.empty:
                        col_lens = df[value].map(lambda x: len(str(x)))
                        m = col_lens.max()
                        max_data = int(m) if pd.notna(m) else 0
                    else:
                        max_data = 0
                    maxlen = max(max_data, len(str(value)))
                    if value == "_LINHA":
                        ws.set_column(col_num, col_num, min(14, max(8, maxlen + 2)), int_fmt)
                    elif isinstance(value, str) and value.upper().startswith("VL_"):
                        ws.set_column(col_num, col_num, min(60, max(10, maxlen + 2)), num_fmt)
                    else:
                        ws.set_column(col_num, col_num, min(60, max(10, maxlen + 2)), cell_fmt)

                # Altura das linhas
                ws.set_row(0, 25)
                for row_num in range(1, len(df) + 1):
                    ws.set_row(row_num, 28)

                ws.freeze_panes(1, 0)

        return output
