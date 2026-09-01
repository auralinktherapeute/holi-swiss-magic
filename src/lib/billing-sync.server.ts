// Synchronisation non destructive des prestations du profil thérapeute
// (therapists.services) vers le catalogue de facturation (billing_services).
// Idempotent : création ou mise à jour, jamais de suppression. La TVA et la
// position Tarif 590 déjà réglées côté facturation sont conservées.

type AnyClient = any;

export async function syncProfileServicesToBilling(
  client: AnyClient,
  therapistId: string,
): Promise<{ synced: number }> {
  const { data: t } = await client
    .from("therapists")
    .select("services, currency")
    .eq("id", therapistId)
    .maybeSingle();

  const services = Array.isArray(t?.services) ? (t!.services as any[]) : [];
  if (!services.length) return { synced: 0 };

  const { data: existing } = await client
    .from("billing_services")
    .select("id, name, internal_code")
    .eq("therapist_id", therapistId);

  const rows = (existing ?? []) as any[];
  const byCode = new Map(
    rows.filter((r) => r.internal_code).map((r) => [String(r.internal_code), r]),
  );
  const byName = new Map(rows.map((r) => [String(r.name ?? "").trim().toLowerCase(), r]));

  let synced = 0;
  for (let i = 0; i < services.length; i++) {
    const s = services[i] ?? {};
    const name = String(s.name ?? "").trim();
    if (!name) continue;
    const code = s.id ? `profil:${s.id}` : null;
    const base = {
      name,
      description: s.short_description || s.description || null,
      duration_min: Number(s.duration_min) || 60,
      price: Number(s.price_chf) || 0,
      position: i,
      is_active: s.visible !== false,
    };
    const match = (code ? byCode.get(code) : undefined) ?? byName.get(name.toLowerCase());
    if (match) {
      const { error } = await client
        .from("billing_services")
        .update({ ...base, internal_code: match.internal_code ?? code })
        .eq("id", match.id);
      if (!error) synced++;
    } else {
      const { error } = await client.from("billing_services").insert({
        ...base,
        therapist_id: therapistId,
        internal_code: code,
        currency: t?.currency ?? "CHF",
      });
      if (!error) synced++;
    }
  }
  return { synced };
}
