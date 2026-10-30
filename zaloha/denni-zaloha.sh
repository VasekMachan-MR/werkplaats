#!/usr/bin/env bash
# Denní záloha (Vašek 30.10.2026, každý den ve 2:00). Spouští se v cloudovém prostředí Clauda, ne na Macu.
# Předtím se do soukrome.zalohovaci_klice zapíše otisk jednorázového klíče (viz OBNOVA.md, „Denní záloha“).
# Použití:  ZALOHA_KLIC=<klíč> zaloha/denni-zaloha.sh   → balíček v /mnt/user-data/outputs/zaloha-RRRR-MM-DD/
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ZALOHA_KLIC:?chybí ZALOHA_KLIC}"
DEN=$(TZ=Europe/Prague date +%F)
VYSTUP=/mnt/user-data/outputs/zaloha-$DEN
TMP=$(mktemp -d)
rm -rf "$VYSTUP"; mkdir -p "$VYSTUP"
curl -sS --fail --max-time 300 -H "x-zaloha: $ZALOHA_KLIC" -o "$TMP/data.json" \
  https://yokbljdjcvwbadbcwmgx.supabase.co/functions/v1/zaloha
python3 zaloha/vytvor-balicek.py "$TMP/data.json" "$VYSTUP"
git fetch -q origin '+refs/heads/*:refs/remotes/origin/*' 2>/dev/null || true
git bundle create -q "$VYSTUP/werkplaats-kod-$DEN.bundle" --all
git bundle verify -q "$VYSTUP/werkplaats-kod-$DEN.bundle" >/dev/null
rm -rf "$TMP"
find "$VYSTUP" -type f | sort
