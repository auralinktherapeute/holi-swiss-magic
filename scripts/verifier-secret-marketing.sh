#!/bin/bash
# Vérifie que MARKETING_AGENT_SECRET ouvre bien la RPC en production.
cd ~/Documents/holi-swiss-magic || exit 1
KEY=$(grep -hE '^SUPABASE_PUBLISHABLE_KEY=' .env       | sed -E 's/^[^=]+=//; s/"//g' | tr -d "'\r")
SEC=$(grep -hE '^MARKETING_AGENT_SECRET='   .env.local | sed -E 's/^[^=]+=//; s/"//g' | tr -d "'\r")

if [ -z "$SEC" ]; then
  echo "❌ MARKETING_AGENT_SECRET est vide dans .env.local"; exit 1
fi
echo "Secret trouvé : ${SEC:0:8}… (${#SEC} caractères)"

R=$(curl -s -w "\n%{http_code}" -X POST \
  "https://qqwudmnfavvaukuldulr.supabase.co/rest/v1/rpc/get_pending_marketing_topics" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"_secret\":\"$SEC\"}")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')

case "$CODE" in
  200) echo "✅ Secret valide — la RPC répond."
       echo "   Sujets en attente : $(echo "$BODY" | grep -o '"id"' | wc -l | tr -d ' ')"
       echo "$BODY" | head -c 400 ;;
  401) echo "❌ HTTP 401 — secret refusé. Vérifie la valeur copiée depuis Supabase." ;;
  404) echo "❌ HTTP 404 — la RPC n'existe pas : migration 20260801230000 non appliquée." ;;
  *)   echo "❌ HTTP $CODE"; echo "$BODY" | head -c 300 ;;
esac
