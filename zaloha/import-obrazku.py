#!/usr/bin/env python3
"""Jednorázově nahraje obrázky z Apple Poznámek do Ostatních dokumentů zakázek přes funkci import-obrazku.
Složky: <číslo zakázky>-<jméno>/<soubory>. Použití: ZALOHA_KLIC=… python3 zaloha/import-obrazku.py SLOZKA ZAKAZKY.json
ZAKAZKY.json = {"7370": "<uuid zakázky>", …}"""
import base64, json, os, sys, urllib.request
API = "https://yokbljdjcvwbadbcwmgx.supabase.co/functions/v1/import-obrazku"
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic"}
koren, zak = sys.argv[1], json.load(open(sys.argv[2]))
for sl in sorted(os.listdir(koren)):
    zid = zak[sl.split("-")[0]]
    for f in sorted(os.listdir(os.path.join(koren, sl))):
        mime = MIME.get(os.path.splitext(f)[1].lower())
        if not mime: print("přeskočeno:", f); continue
        tel = json.dumps({"zakazka_id": zid, "nazev": f, "mime": mime, "data": base64.b64encode(open(os.path.join(koren, sl, f), "rb").read()).decode()}).encode()
        r = urllib.request.Request(API, data=tel, headers={"x-zaloha": os.environ["ZALOHA_KLIC"], "content-type": "application/json"})
        print(sl, json.load(urllib.request.urlopen(r, timeout=120)))
