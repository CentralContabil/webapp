from pathlib import Path
class SpedFileReader:
    def read(self, path: Path) -> str:
        for enc in ("utf-8","latin-1","cp1252"):
            try:
                return path.read_text(encoding=enc, errors="replace")
            except Exception:
                continue
        raise RuntimeError("Falha ao ler o arquivo.")