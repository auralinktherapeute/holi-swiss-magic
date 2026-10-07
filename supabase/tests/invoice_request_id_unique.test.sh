#!/usr/bin/env bash
# Test PostgreSQL réel, base jetable : index ti_therapist_request_id_uniq (migration 0015).
# Données fictives uniquement ; la base est créée puis détruite.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
D=$(mktemp -d); PORT=55439
trap 'pg_ctl -D "$D" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
initdb -D "$D" -U postgres -A trust >/dev/null
pg_ctl -D "$D" -o "-p $PORT -k $D -c listen_addresses=''" -l "$D/log" -w start >/dev/null
P="psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -qAt"
$P -c "CREATE TABLE public.therapist_invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), therapist_id uuid, metadata jsonb DEFAULT '{}'::jsonb);"
$P -f "$ROOT/drizzle/migrations/0015_therapist_invoices_request_id_unique.sql"
$P -f "$ROOT/drizzle/migrations/0015_therapist_invoices_request_id_unique.sql" 2>/dev/null   # idempotent
T1=00000000-0000-0000-0000-00000000000a; T2=00000000-0000-0000-0000-00000000000b
ok(){ echo "OK  $1"; }; ko(){ echo "ÉCHEC $1"; exit 1; }
# 1. Deux transactions concurrentes, même thérapeute + même request_id
INS="BEGIN; INSERT INTO therapist_invoices(therapist_id,metadata) VALUES ('$T1','{\"request_id\":\"r-same\"}'); SELECT pg_sleep(1); COMMIT;"
( rc=0; $P -c "$INS" >"$D/a.out" 2>&1 || rc=$?; echo $rc >"$D/a.rc" ) &
( sleep 0.2; rc=0; $P -c "$INS" >"$D/b.out" 2>&1 || rc=$?; echo $rc >"$D/b.rc" ) &
wait
n=$($P -c "SELECT count(*) FROM therapist_invoices WHERE metadata->>'request_id'='r-same'")
[ "$n" = 1 ] && ok "concurrence : une seule facture (count=$n)" || ko "concurrence count=$n"
rc_a=$(cat "$D/a.rc"); rc_b=$(cat "$D/b.rc")
[ $((rc_a + rc_b)) -ne 0 ] && grep -q 'ti_therapist_request_id_uniq' "$D/a.out" "$D/b.out" \
  && ok "le second envoi échoue en 23505 sur ti_therapist_request_id_uniq" || ko "erreur attendue absente"
$P -c "\\set VERBOSITY verbose" -c "INSERT INTO therapist_invoices(therapist_id,metadata) VALUES ('$T1','{\"request_id\":\"r-same\"}')" 2>"$D/c.err" || true
grep -q '23505' "$D/c.err" && ok "code SQLSTATE 23505 confirmé" || ko "code 23505 absent"
# 2. Identifiants différents autorisés
$P -c "INSERT INTO therapist_invoices(therapist_id,metadata) VALUES ('$T1','{\"request_id\":\"r-other\"}')" && ok "autre request_id autorisé"
# 3. Même identifiant, autre thérapeute autorisé
$P -c "INSERT INTO therapist_invoices(therapist_id,metadata) VALUES ('$T2','{\"request_id\":\"r-same\"}')" && ok "même request_id pour un autre thérapeute autorisé"
# 4. Identifiants nuls non bloqués
$P -c "INSERT INTO therapist_invoices(therapist_id,metadata) VALUES ('$T1','{}'),('$T1','{}'),('$T1','{\"request_id\":null}'),('$T1','{\"request_id\":null}')" && ok "identifiants absents/nuls non bloqués"
# 5. Réversible
$P -c "DROP INDEX IF EXISTS public.ti_therapist_request_id_uniq;" && ok "retour arrière possible"
echo "Tous les contrôles PostgreSQL réussis."
