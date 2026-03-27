from pathlib import Path
from utils import sanitize_filename

class DefaultFileNamer:
    def suggest(self, out_dir: Path, razao: str, cnpj: str) -> Path:
        safe = sanitize_filename(f"{razao}_{cnpj}")
        return Path(out_dir) / f"SPED_Fiscal_{safe}.xlsx"