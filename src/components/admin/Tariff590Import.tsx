import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  importTariffCatalog, listTariffCatalogs, listTariffPositions,
  type TariffCatalog, type TariffPosition,
} from "@/lib/billing-services.functions";

type Row = { code: string; designation: string; description?: string | null; unit?: string | null };

/** Découpe une ligne CSV en respectant les guillemets. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/** Parse un CSV `code,designation,description,unite` — aucun code n'est inventé. */
export function parseTariffCsv(text: string): { rows: Row[]; errors: string[] } {
  const errors: string[] = [];
  const rows: Row[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors: ["Le fichier est vide."] };

  let start = 0;
  const head = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  if (head[0]?.startsWith("code")) start = 1;

  const seen = new Set<string>();
  for (let i = start; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]!);
    const code = c[0] ?? "", designation = c[1] ?? "";
    if (!code || !designation) { errors.push(`Ligne ${i + 1} : code ou désignation manquant.`); continue; }
    if (seen.has(code)) { errors.push(`Ligne ${i + 1} : code « ${code} » en double.`); continue; }
    seen.add(code);
    rows.push({ code, designation, description: c[2] || null, unit: c[3] || null });
  }
  return { rows, errors };
}

export default function Tariff590Import() {
  const importFn = useServerFn(importTariffCatalog);
  const catalogsFn = useServerFn(listTariffCatalogs);
  const positionsFn = useServerFn(listTariffPositions);

  const [catalogs, setCatalogs] = useState<TariffCatalog[]>([]);
  const [positions, setPositions] = useState<TariffPosition[]>([]);
  const [name, setName] = useState("Tarif 590");
  const [version, setVersion] = useState("");
  const [source, setSource] = useState("");
  const [activate, setActivate] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [c, p] = await Promise.all([catalogsFn(), positionsFn({ data: {} })]);
    setCatalogs(c); setPositions(p);
  }, [catalogsFn, positionsFn]);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);

  async function onFile(file: File) {
    const text = await file.text();
    const parsed = parseTariffCsv(text);
    setRows(parsed.rows); setErrors(parsed.errors);
    if (parsed.rows.length === 0) toast.error("Aucune position valide dans ce fichier.");
  }

  async function submit() {
    if (!version.trim()) { toast.error("Indiquez la version du catalogue."); return; }
    if (rows.length === 0) { toast.error("Importez d'abord un fichier CSV valide."); return; }
    setBusy(true);
    try {
      const res = await importFn({ data: {
        name: name.trim(), version: version.trim(),
        source: source.trim() || null, valid_from: null, valid_to: null,
        activate, positions: rows,
      } });
      toast.success(`${res.imported} positions importées.`);
      setRows([]); setErrors([]);
      await refresh();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setBusy(false); }
  }

  const input: React.CSSProperties = {
    width: "100%", minHeight: 44, padding: "8px 12px", borderRadius: 8,
    border: "1px solid rgba(184,110,249,0.25)", background: "rgba(255,255,255,0.04)",
    color: "inherit", fontSize: 14,
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
        Importez un catalogue Tarif 590 officiel validé, au format CSV
        <code style={{ margin: "0 4px" }}>code;désignation;description;unité</code>.
        Aucune position n'est générée automatiquement et aucune liste tierce n'est copiée.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Nom du catalogue
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Version
          <input style={input} value={version} placeholder="2026.1"
            onChange={(e) => setVersion(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: "1 / -1" }}>
          Source (organisme, document de référence)
          <input style={input} value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
      </div>

      <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
        Fichier CSV
        <input type="file" accept=".csv,text/csv" style={input}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
        Activer ce catalogue après import
      </label>

      {errors.length > 0 && (
        <ul style={{ fontSize: 12, color: "#ff8080", margin: 0, paddingLeft: 18 }}>
          {errors.slice(0, 10).map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      {rows.length > 0 && (
        <p style={{ fontSize: 13, margin: 0 }}>
          {rows.length} positions prêtes à être importées (aperçu :{" "}
          {rows.slice(0, 3).map((r) => r.code).join(", ")}…).
        </p>
      )}

      <button type="button" onClick={submit} disabled={busy}
        style={{
          minHeight: 44, padding: "0 18px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "#b86ef9", color: "#fff", fontWeight: 600, justifySelf: "start",
          opacity: busy ? 0.6 : 1,
        }}>
        {busy ? "Import en cours…" : "Importer le catalogue"}
      </button>

      <div style={{ fontSize: 13, opacity: 0.75 }}>
        {catalogs.length === 0
          ? "Aucun catalogue importé pour l'instant."
          : `${catalogs.length} catalogue(s), ${positions.length} positions actives.`}
      </div>
    </div>
  );
}
