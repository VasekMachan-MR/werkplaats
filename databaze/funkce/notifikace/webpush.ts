// Web Push bez knihoven – jen Web Crypto (RFC 8291 šifrování aes128gcm, RFC 8292 VAPID). Funguje v Supabase (Deno) i v Node 20+.
const enc = new TextEncoder();
export const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const zB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const spoj = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hmac(klic: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", klic, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

// nový pár klíčů VAPID: verejny = raw P-256 bod (base64url, jde do aplikace), soukromy = JWK (zůstává jen na serveru)
export async function novyVapid() {
  const p = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return { verejny: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", p.publicKey))), soukromy: await crypto.subtle.exportKey("jwk", p.privateKey) };
}

async function vapidHlavicka(endpoint: string, vapid: { verejny: string; soukromy: JsonWebKey }, kontakt: string) {
  const hlava = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const telo = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: kontakt })));
  const k = await crypto.subtle.importKey("jwk", vapid.soukromy, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const podpis = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, enc.encode(hlava + "." + telo)));
  return `vapid t=${hlava}.${telo}.${b64u(podpis)}, k=${vapid.verejny}`;
}

// zašifrovaná zpráva pro jeden odběr (p256dh + auth z prohlížeče)
export async function zasifruj(zprava: string, p256dh: string, auth: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const ua = zB64u(p256dh), tajne = zB64u(auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asVerejny = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKlic = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKlic }, as.privateKey, 256));
  const ikm = await hmac(await hmac(tajne, ecdh), spoj(enc.encode("WebPush: info\0"), ua, asVerejny, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, spoj(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, spoj(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const sifra = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, spoj(enc.encode(zprava), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   // 4096
  return spoj(salt, rs, new Uint8Array([asVerejny.length]), asVerejny, sifra);
}

// odeslání jedné notifikace; vrací HTTP stav push služby (201 = doručeno; 404/410 = odběr už neplatí)
export async function posli(odber: { endpoint: string; p256dh: string; auth: string }, data: unknown, vapid: { verejny: string; soukromy: JsonWebKey }, kontakt = "mailto:info@mercedesrest.cz") {
  const telo = await zasifruj(JSON.stringify(data), odber.p256dh, odber.auth);
  const r = await fetch(odber.endpoint, { method: "POST", headers: {
    authorization: await vapidHlavicka(odber.endpoint, vapid, kontakt), "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: "86400", urgency: "high"
  }, body: telo });
  return r.status;
}
