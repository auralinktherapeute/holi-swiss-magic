// Parseur camt.054 (ISO 20022) sans dépendance ni service externe.
// Volontairement tolérant : lit les <Ntry> et leurs <TxDtls>.

export type CamtEntry = {
  /** Référence QR (QRR, 27 chiffres) ou SCOR (RFxx...) trouvée dans l'avis */
  reference: string | null;
  /** Montant crédité (positif) en unité de la devise */
  amount: number;
  currency: string;
  /** Date de valeur/comptabilisation ISO (YYYY-MM-DD) */
  date: string | null;
  /** Nom du débiteur si présent */
  debtor: string | null;
  /** Sens : true = crédit (encaissement) */
  credit: boolean;
  /** Identifiant bancaire de l'écriture (AcctSvcrRef / EndToEndId) */
  bankRef: string | null;
};

function stripNs(tag: string) {
  const i = tag.indexOf(":");
  return i === -1 ? tag : tag.slice(i + 1);
}

function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Retourne tous les blocs <tag ...>...</tag> (namespace ignoré) d'une chaîne. */
function blocks(xml: string, tag: string): string[] {
  const out: string[] = [];
  const open = new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${tag}(\\s[^>]*)?>`, "g");
  let m: RegExpExecArray | null;
  while ((m = open.exec(xml))) {
    const start = m.index + m[0].length;
    // recherche de la fermeture correspondante en tenant compte de l'imbrication
    const scan = new RegExp(`<(/?)(?:[A-Za-z0-9_.-]+:)?${tag}(?:\\s[^>]*)?>`, "g");
    scan.lastIndex = start;
    let depth = 1;
    let s: RegExpExecArray | null;
    while ((s = scan.exec(xml))) {
      if (s[1] === "/") {
        depth -= 1;
        if (depth === 0) {
          out.push(xml.slice(start, s.index));
          open.lastIndex = s.index + s[0].length;
          break;
        }
      } else depth += 1;
    }
    if (depth !== 0) break;
  }
  return out;
}

function first(xml: string, tag: string): string | null {
  const b = blocks(xml, tag);
  return b.length ? decode(b[0]!) : null;
}

function firstAttrText(xml: string, tag: string): { text: string | null; ccy: string | null } {
  const re = new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${tag}(\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${tag}>`);
  const m = re.exec(xml);
  if (!m) return { text: null, ccy: null };
  const attrs = m[1] ?? "";
  const ccy = /Ccy="([A-Z]{3})"/.exec(attrs)?.[1] ?? null;
  return { text: decode(m[2] ?? ""), ccy };
}

export function normalizeReference(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (/^\d{27}$/.test(cleaned)) return cleaned;
  if (/^RF\d{2}[0-9A-Z]{1,21}$/.test(cleaned)) return cleaned;
  return cleaned || null;
}

export function parseCamt054(xml: string): { entries: CamtEntry[]; errors: string[] } {
  const errors: string[] = [];
  if (!xml || !/<[A-Za-z]/.test(xml)) return { entries: [], errors: ["Fichier vide ou non XML."] };
  if (!/BkToCstmrDbtCdtNtfctn|BkToCstmrStmt/.test(xml)) {
    errors.push("Le fichier ne ressemble pas à un camt.054/camt.053 — tentative de lecture quand même.");
  }
  const entries: CamtEntry[] = [];
  for (const ntry of blocks(xml, "Ntry")) {
    const amt = firstAttrText(ntry, "Amt");
    const cdtDbt = first(ntry, "CdtDbtInd");
    const credit = (cdtDbt ?? "CRDT").toUpperCase() === "CRDT";
    const bookg = first(blocks(ntry, "BookgDt")[0] ?? "", "Dt") ?? first(blocks(ntry, "ValDt")[0] ?? "", "Dt");
    const bankRefEntry = first(ntry, "AcctSvcrRef");
    const details = blocks(ntry, "TxDtls");
    const total = Number(amt.text ?? "0");

    if (details.length === 0) {
      entries.push({
        reference: normalizeReference(first(ntry, "Ref") ?? first(ntry, "Ustrd")),
        amount: Number.isFinite(total) ? total : 0,
        currency: amt.ccy ?? "CHF",
        date: bookg ? bookg.slice(0, 10) : null,
        debtor: null,
        credit,
        bankRef: bankRefEntry,
      });
      continue;
    }

    for (const tx of details) {
      const txAmt = firstAttrText(tx, "Amt");
      const amount = Number(txAmt.text ?? amt.text ?? "0");
      const strdRef = first(blocks(tx, "CdtrRefInf")[0] ?? "", "Ref");
      const ustrd = first(tx, "Ustrd");
      const endToEnd = first(tx, "EndToEndId");
      const debtorBlock = blocks(tx, "Dbtr")[0] ?? "";
      entries.push({
        reference: normalizeReference(strdRef ?? ustrd),
        amount: Number.isFinite(amount) ? amount : 0,
        currency: txAmt.ccy ?? amt.ccy ?? "CHF",
        date: bookg ? bookg.slice(0, 10) : null,
        debtor: first(debtorBlock, "Nm"),
        credit,
        bankRef: first(tx, "AcctSvcrRef") ?? endToEnd ?? bankRefEntry,
      });
    }
  }
  if (entries.length === 0) errors.push("Aucune écriture (<Ntry>) trouvée dans le fichier.");
  return { entries, errors };
}

export { stripNs };
