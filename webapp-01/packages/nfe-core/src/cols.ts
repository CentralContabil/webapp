/** Ordem das colunas (chaves internas) — fonte única. */
export const COLS = [
  "chNFe",
  "nNF",
  "dhEmi",
  "tpNF",
  "emit_CNPJ",
  "emit_xNome",
  "dest_CNPJ",
  "dest_xNome",
  "cProd",
  "xProd",
  "NCM",
  "CFOP",
  "uCom",
  "qCom",
  "vUnCom",
  "vProd",
  "CSOSN/CST",
  "orig",
  "pICMS",
  "vICMS",
  "pIPI",
  "vIPI",
  "pPIS",
  "vPIS",
  "pCOFINS",
  "vCOFINS",
  "Descrição",
] as const;

export type ColKey = (typeof COLS)[number];

export type NfeRow = Record<ColKey, string>;

export const HEADER_MAP: Record<ColKey, string> = {
  chNFe: "Chave NFe",
  nNF: "Nº NF",
  dhEmi: "Emissão",
  tpNF: "tp OP",
  emit_CNPJ: "CNPJ Emit.",
  emit_xNome: "Nome Emit.",
  dest_CNPJ: "CNPJ Dest.",
  dest_xNome: "Nome Dest.",
  cProd: "Cod. Prod.",
  xProd: "Desc. Prod.",
  NCM: "NCM",
  CFOP: "CFOP",
  uCom: "Unidade",
  qCom: "Qtde",
  vUnCom: "Vlr Unit.",
  vProd: "Vlr Total",
  "CSOSN/CST": "CST",
  orig: "Origem",
  pICMS: "Aliq ICMS",
  vICMS: "Vlr ICMS",
  pIPI: "Aliq IPI",
  vIPI: "Vlr IPI",
  pPIS: "Aliq PIS",
  vPIS: "Vlr PIS",
  pCOFINS: "Aliq COFINS",
  vCOFINS: "Vlr COFINS",
  Descrição: "Descrição",
};

export function emptyRow(): NfeRow {
  const r = {} as NfeRow;
  for (const c of COLS) r[c] = "";
  return r;
}
