import pandas as pd

class DefaultDataFrameBuilder:
    def __init__(self, headers: dict):
        self.headers = headers

    def build(self, rec: str, rows):
        base = len(self.headers[rec])
        if not rows:
            return pd.DataFrame(columns=self.headers[rec]), 0, 0

        adjusted = []
        mism, max_extra = 0, 0

        for r in rows:
            if r and str(r[0]).upper() != rec:
                mism += 1
            r = list(r)
            if len(r) < base:
                r += [""] * (base - len(r))
            adjusted.append(r)
            ex = len(r) - base
            if ex > max_extra:
                max_extra = ex

        extra_cols = [f"EXTRA_{i:02d}" for i in range(1, max_extra + 1)]
        df = pd.DataFrame(adjusted, columns=self.headers[rec] + extra_cols)
        return df, max_extra, mism
