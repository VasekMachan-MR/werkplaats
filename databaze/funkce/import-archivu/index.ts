// Jednorázový import archivních PDF dokončen 29.10.2026 – funkce je vypnutá.
Deno.serve(() => new Response(JSON.stringify({ chyba: "vypnuto" }), { status: 410, headers: { "content-type": "application/json" } }));
