#!/usr/bin/env python3
"""Zrcadlo fotek, videí a PDF ze Supabase Storage do Cloudflare R2 (koš werkplaats-soubory). Jen přidává, nic nemaže.
Použití: python3 zaloha/zrcadlo-souboru.py data.json   (env R2_ENDPOINT, AWS_* z GitHub Secrets; přihlášení viz prihlaseni())"""
import json, os, subprocess, sys, tempfile, urllib.request
API = "https://yokbljdjcvwbadbcwmgx.supabase.co/functions/v1/zaloha?odkazy=1"
KOS = "werkplaats-soubory"
ep = os.environ["R2_ENDPOINT"]
aws = ["aws", "--endpoint-url", ep, "--region", "auto"]
def prihlaseni():
    """ZALOHA_KLIC (Claude), nebo na GitHubu čerstvý token OIDC (bez hesla)."""
    if os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"):
        r = urllib.request.Request(os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=werkplaats-zaloha",
                                   headers={"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
        return {"x-github-oidc": json.load(urllib.request.urlopen(r, timeout=30))["value"]}
    return {"x-zaloha": os.environ["ZALOHA_KLIC"]}


cesty = json.load(open(sys.argv[1], encoding="utf-8")).get("soubory", [])
out = subprocess.run(aws + ["s3api", "list-objects-v2", "--bucket", KOS, "--query", "Contents[].Key", "--output", "json"], capture_output=True, text=True, check=True).stdout
mam = set(json.loads(out or "null") or [])
chybi = [c for c in cesty if c not in mam]
print(f"V úložišti {len(cesty)} souborů, v R2 už {len(mam)}, nahraji {len(chybi)}")
nahrano = 0
for i in range(0, len(chybi), 500):
    davka = chybi[i:i + 500]
    req = urllib.request.Request(API, data=json.dumps({"cesty": davka}).encode(), headers={**prihlaseni(), "content-type": "application/json"})
    odkazy = json.load(urllib.request.urlopen(req, timeout=120))["odkazy"]
    for c in davka:
        u = odkazy.get(c)
        if not u:
            print("bez odkazu:", c); continue
        with tempfile.NamedTemporaryFile() as f:
            with urllib.request.urlopen(u, timeout=300) as r:
                while (b := r.read(1 << 20)): f.write(b)
            f.flush()
            subprocess.run(aws + ["s3", "cp", "--only-show-errors", f.name, f"s3://{KOS}/{c}"], check=True)
        nahrano += 1
print(f"OK: nahráno {nahrano} souborů do R2")
