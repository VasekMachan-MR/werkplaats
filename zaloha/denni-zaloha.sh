#!/usr/bin/env bash
# Denní záloha (Vašek 30.10.2026, každý den ve 2:00). Spouští se v cloudovém prostředí Clauda, ne na Macu.
# Klíč zálohy je v souboru .klic-zalohy ve složce iCloud „Mercedes Restorations/Zálohy Werkplaats“ (viz OBNOVA.md, „Denní záloha“).
# Použití:  ZALOHA_KLIC=<klíč> zaloha/denni-zaloha.sh   → balíček v /mnt/user-data/outputs/zaloha-RRRR-MM-DD/
set -euo pipefail
cd "$(dirname "$0")/.."
# přihlášení: ZALOHA_KLIC (Claude), nebo na GitHubu token OIDC (bez hesla)
if [ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ]; then
  HLAVICKA="x-github-oidc: $(curl -sS --fail -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=werkplaats-zaloha" | python3 -c 'import json,sys;print(json.load(sys.stdin)["value"])')"
else
  : "${ZALOHA_KLIC:?chybí ZALOHA_KLIC}"; HLAVICKA="x-zaloha: $ZALOHA_KLIC"
fi
DEN=$(TZ=Europe/Prague date +%F)
VYSTUP=${VYSTUP:-/mnt/user-data/outputs/zaloha-$DEN}
TMP=$(mktemp -d)
rm -rf "$VYSTUP"; mkdir -p "$VYSTUP"
curl -sS --fail --max-time 300 -H "$HLAVICKA" -o "$TMP/data.json" \
  https://yokbljdjcvwbadbcwmgx.supabase.co/functions/v1/zaloha
python3 zaloha/vytvor-balicek.py "$TMP/data.json" "$VYSTUP"
git fetch -q origin '+refs/heads/*:refs/remotes/origin/*' 2>/dev/null || true
git bundle create -q "$VYSTUP/werkplaats-kod-$DEN.bundle" --all
git bundle verify -q "$VYSTUP/werkplaats-kod-$DEN.bundle" >/dev/null
cp "$TMP/data.json" "$VYSTUP/../data-$DEN.json" 2>/dev/null || true
rm -rf "$TMP"
find "$VYSTUP" -type f | sort
