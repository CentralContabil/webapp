import pandas as pd

class DefaultDataFrameBuilder:
    def __init__(self, headers: dict):
        self.headers = headers

    def build(self, rec: str, rows):
        base = len(self.headers[rec])
        if not rows:
            return pd.DataFrame(columns=["_LINHA"] + self.headers[rec]), 0, 0

        adjusted = []
        mism, max_extra = 0, 0

        for item in rows:
            line_no, r = item
            r = list(r)
            if r and str(r[0]).upper() != rec:
                mism += 1
            if len(r) < base:
                r += [""] * (base - len(r))
            row_out = [line_no] + r
            adjusted.append(row_out)
            ex = len(r) - base
            if ex > max_extra:
                max_extra = ex

        extra_cols = [f"EXTRA_{i:02d}" for i in range(1, max_extra + 1)]
        cols = ["_LINHA"] + self.headers[rec] + extra_cols
        df = pd.DataFrame(adjusted, columns=cols)
        return df, max_extra, mism
