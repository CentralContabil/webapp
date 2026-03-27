/**
 * Expande arrastar pasta (webkit) e filtra extensões:
 * - Na raiz do drop: .xml e .zip
 * - Dentro de pastas: só .xml (ignora outros arquivos para não ir lixo ao parse)
 */

function isXml(file: Pick<File, "name">): boolean {
  return file.name.toLowerCase().endsWith(".xml");
}

function isZip(file: Pick<File, "name">): boolean {
  return file.name.toLowerCase().endsWith(".zip");
}

function allowAtRoot(file: File): boolean {
  return isXml(file) || isZip(file);
}

function allowInsideFolder(file: File): boolean {
  return isXml(file);
}

function readEntriesAsync(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const acc: FileSystemEntry[] = [];
    const read = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) resolve(acc);
          else {
            acc.push(...batch);
            read();
          }
        },
        (err) => reject(err)
      );
    };
    read();
  });
}

async function entryToFiles(entry: FileSystemEntry, depth: number): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      (entry as FileSystemFileEntry).file(
        (file) => {
          const ok = depth === 0 ? allowAtRoot(file) : allowInsideFolder(file);
          resolve(ok ? [file] : []);
        },
        reject
      );
    });
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await readEntriesAsync(reader);
    const nested = await Promise.all(entries.map((e) => entryToFiles(e, depth + 1)));
    return nested.flat();
  }
  return [];
}

async function extractFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = dt.items;
  if (items?.length && typeof items[0].webkitGetAsEntry === "function") {
    const out: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) out.push(...(await entryToFiles(entry, 0)));
    }
    return out;
  }
  return Array.from(dt.files).filter(allowAtRoot);
}

export function fileLabel(file: File): string {
  const w = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return w && w.length > 0 ? w : file.name;
}

/** Para `useDropzone({ getFilesFromEvent })` — cobre arrastar e o input file. */
export async function getFilesFromEvent(event: Event): Promise<File[]> {
  if ("dataTransfer" in event && event.dataTransfer) {
    return extractFromDataTransfer(event.dataTransfer);
  }
  const t = event.target as HTMLInputElement | null;
  if (t?.files?.length) {
    return Array.from(t.files).filter(allowAtRoot);
  }
  return [];
}
