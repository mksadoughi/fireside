/**
 * Fireside Registration Worker
 * Deployed to: api.fireside.run
 *
 * Handles subdomain registration for name.fireside.run.
 * Each Fireside host claims a permanent subdomain backed by a Cloudflare Named Tunnel.
 *
 * Routes:
 *   POST /check     – check name availability
 *   POST /claim     – claim a name, provision tunnel + DNS
 *   POST /heartbeat – extend name TTL (called daily by host binary)
 *   POST /release   – release name (called on clean uninstall)
 */

export interface Env {
  NAMES: KVNamespace;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  CF_ZONE_ID: string;
  HEARTBEAT_TTL_DAYS: string;
}

// ── Reserved names ────────────────────────────────────────────────────────────

const RESERVED = new Set([
  "admin", "api", "www", "app", "mail", "blog", "docs", "support",
  "billing", "install", "relay", "connect", "status", "dashboard",
  "fireside", "help", "login", "signup", "register", "download",
  "releases", "static", "assets", "cdn", "dev", "staging", "test",
  "demo", "sandbox", "internal", "ops", "infra", "monitor",
]);

// ── Name validation ───────────────────────────────────────────────────────────

function isValidName(name: string): boolean {
  // 3–32 chars, lowercase alphanumeric and hyphens, no leading/trailing hyphen
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(name) ||
         /^[a-z0-9]{3,32}$/.test(name);
}

// ── Name suggestions ──────────────────────────────────────────────────────────

function suggestions(base: string): string[] {
  const clean = base.replace(/[^a-z0-9]/g, "").slice(0, 20);
  const results: string[] = [];
  const suffixes = ["-home", "-ai", "-hub"];
  for (const s of suffixes) {
    const candidate = clean + s;
    if (isValidName(candidate) && !RESERVED.has(candidate)) results.push(candidate);
  }
  // Numeric suffix fallback
  for (let i = 2; results.length < 3; i++) {
    const candidate = `${clean}${i}`;
    if (isValidName(candidate)) results.push(candidate);
    if (i > 9) break;
  }
  return results.slice(0, 3);
}

// ── Rate limiting (IP-based, via KV) ─────────────────────────────────────────

async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const val = await env.NAMES.get(key);
  const count = val ? parseInt(val, 10) : 0;
  if (count >= 3) return false;
  // Increment with 1-hour TTL
  await env.NAMES.put(key, String(count + 1), { expirationTtl: 3600 });
  return true;
}

// ── KV record type ────────────────────────────────────────────────────────────

interface NameRecord {
  tunnelId: string;
  tunnelName: string;
  instanceId: string;   // opaque ID from the Fireside binary (used for heartbeat auth)
  claimedAt: number;    // unix ms
  expiresAt: number;    // unix ms
}

// ── Cloudflare API helpers ────────────────────────────────────────────────────

async function cfAPI(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; data: unknown; errors?: unknown[] }> {
  const url = `https://api.cloudflare.com/client/v4${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as { success: boolean; result: unknown; errors?: unknown[] };
  if (!data.success) {
    console.error(`CF API ${method} ${path} failed:`, JSON.stringify(data.errors));
  }
  return { ok: data.success, data: data.result, errors: data.errors };
}

async function createTunnel(env: Env, name: string): Promise<{ id: string; token: string } | null> {
  // Generate a random tunnel secret (required by Cloudflare API)
  const secretBytes = new Uint8Array(32);
  crypto.getRandomValues(secretBytes);
  const tunnelSecret = btoa(String.fromCharCode(...secretBytes));

  const { ok, data } = await cfAPI(env, "POST",
    `/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel`,
    { name: `fireside-${name}`, tunnel_secret: tunnelSecret, config_src: "cloudflare" },
  );
  if (!ok) return null;
  const tunnel = data as { id: string };

  // Fetch the connector token (not returned in create response)
  const tokenResp = await cfAPI(env, "GET",
    `/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel/${tunnel.id}/token`,
  );
  if (!tokenResp.ok) {
    // Clean up the tunnel we just created
    await deleteTunnel(env, tunnel.id);
    return null;
  }
  const token = tokenResp.data as string;

  return { id: tunnel.id, token };
}

async function deleteTunnel(env: Env, tunnelId: string): Promise<boolean> {
  const { ok } = await cfAPI(env, "DELETE",
    `/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel/${tunnelId}`,
  );
  return ok;
}

async function addDNSRecord(env: Env, name: string, tunnelId: string): Promise<boolean> {
  const { ok } = await cfAPI(env, "POST",
    `/zones/${env.CF_ZONE_ID}/dns_records`,
    {
      type: "CNAME",
      name: `${name}.fireside.run`,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
    },
  );
  return ok;
}

async function deleteDNSRecord(env: Env, name: string): Promise<boolean> {
  // List DNS records to find the one for this name
  const { ok, data } = await cfAPI(env, "GET",
    `/zones/${env.CF_ZONE_ID}/dns_records?name=${name}.fireside.run&type=CNAME`,
  );
  if (!ok) return false;
  const records = data as { id: string }[];
  if (!records.length) return true; // already gone
  const { ok: deleted } = await cfAPI(env, "DELETE",
    `/zones/${env.CF_ZONE_ID}/dns_records/${records[0].id}`,
  );
  return deleted;
}

// ── Tunnel ingress config (routes HTTP traffic to localhost) ──────────────────

async function setTunnelIngress(env: Env, tunnelId: string): Promise<boolean> {
  const { ok } = await cfAPI(env, "PUT",
    `/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel/${tunnelId}/configurations`,
    {
      config: {
        ingress: [
          { service: "http://localhost:7654" },
        ],
      },
    },
  );
  return ok;
}

// ── TTL helper ────────────────────────────────────────────────────────────────

function ttlMs(env: Env): number {
  const days = parseInt(env.HEARTBEAT_TTL_DAYS || "30", 10);
  return days * 24 * 60 * 60 * 1000;
}

// ── JSON response helpers ─────────────────────────────────────────────────────

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Route handlers ────────────────────────────────────────────────────────────

// POST /check  { name: string }
// Returns: { available: bool, suggestions?: string[] }
async function handleCheck(req: Request, env: Env): Promise<Response> {
  const body = await req.json() as { name?: string };
  const name = (body.name || "").toLowerCase().trim();

  if (!isValidName(name)) {
    return err("Name must be 3–32 lowercase letters, numbers, or hyphens.");
  }
  if (RESERVED.has(name)) {
    return ok({ available: false, suggestions: suggestions(name) });
  }
  const existing = await env.NAMES.get(`name:${name}`);
  if (existing) {
    return ok({ available: false, suggestions: suggestions(name) });
  }
  return ok({ available: true });
}

// POST /claim  { name: string, instance_id: string }
// Returns: { tunnel_token: string, tunnel_name: string, subdomain: string }
async function handleClaim(req: Request, env: Env, ip: string): Promise<Response> {
  if (!await checkRateLimit(env, ip)) {
    return err("Too many attempts. Try again in an hour.", 429);
  }

  const body = await req.json() as { name?: string; instance_id?: string };
  const name = (body.name || "").toLowerCase().trim();
  const instanceId = (body.instance_id || "").trim();

  if (!isValidName(name)) {
    return err("Invalid name.");
  }
  if (RESERVED.has(name)) {
    return err("That name is reserved.");
  }
  if (!instanceId || instanceId.length < 32) {
    return err("Missing or invalid instance_id.");
  }

  // Check availability (re-check under the same request to reduce TOCTOU window)
  const existing = await env.NAMES.get(`name:${name}`);
  if (existing) {
    return ok({ available: false, suggestions: suggestions(name) }, 409);
  }

  // Reserve the name immediately to prevent concurrent claims
  // (KV is eventually consistent, but this reduces the collision window significantly)
  const reservationKey = `reserving:${name}`;
  const alreadyReserving = await env.NAMES.get(reservationKey);
  if (alreadyReserving) {
    return ok({ available: false, suggestions: suggestions(name) }, 409);
  }
  await env.NAMES.put(reservationKey, "1", { expirationTtl: 60 });

  // Provision Cloudflare Named Tunnel
  const tunnel = await createTunnel(env, name);
  if (!tunnel) {
    await env.NAMES.delete(reservationKey);
    return err("Failed to create tunnel. Please try again.", 500);
  }

  // Set tunnel ingress config (routes to localhost:7654)
  await setTunnelIngress(env, tunnel.id);

  // Add DNS CNAME — if this fails, clean up tunnel first
  const dnsOk = await addDNSRecord(env, name, tunnel.id);
  if (!dnsOk) {
    await deleteTunnel(env, tunnel.id);
    await env.NAMES.delete(reservationKey);
    return err("Failed to create DNS record. Please try again.", 500);
  }

  // Write permanent KV record
  const record: NameRecord = {
    tunnelId: tunnel.id,
    tunnelName: `fireside-${name}`,
    instanceId,
    claimedAt: Date.now(),
    expiresAt: Date.now() + ttlMs(env),
  };
  await env.NAMES.put(`name:${name}`, JSON.stringify(record));
  await env.NAMES.delete(reservationKey);

  return ok({
    tunnel_token: tunnel.token,
    tunnel_name: `fireside-${name}`,
    subdomain: `${name}.fireside.run`,
  }, 201);
}

// POST /heartbeat  { name: string, instance_id: string }
async function handleHeartbeat(req: Request, env: Env): Promise<Response> {
  const body = await req.json() as { name?: string; instance_id?: string };
  const name = (body.name || "").toLowerCase().trim();
  const instanceId = (body.instance_id || "").trim();

  const raw = await env.NAMES.get(`name:${name}`);
  if (!raw) return err("Name not found.", 404);

  const record: NameRecord = JSON.parse(raw);
  if (record.instanceId !== instanceId) return err("Unauthorized.", 403);

  record.expiresAt = Date.now() + ttlMs(env);
  await env.NAMES.put(`name:${name}`, JSON.stringify(record));
  return ok({ ok: true, expires_at: record.expiresAt });
}

// POST /release  { name: string, instance_id: string }
async function handleRelease(req: Request, env: Env): Promise<Response> {
  const body = await req.json() as { name?: string; instance_id?: string };
  const name = (body.name || "").toLowerCase().trim();
  const instanceId = (body.instance_id || "").trim();

  const raw = await env.NAMES.get(`name:${name}`);
  if (!raw) return ok({ ok: true }); // already gone

  const record: NameRecord = JSON.parse(raw);
  if (record.instanceId !== instanceId) return err("Unauthorized.", 403);

  // Atomic cleanup: DNS first, then tunnel, then KV
  await deleteDNSRecord(env, name);
  await deleteTunnel(env, record.tunnelId);
  await env.NAMES.delete(`name:${name}`);

  return ok({ ok: true });
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // CORS for local dev
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (req.method !== "POST") return err("Method not allowed.", 405);

    const url = new URL(req.url);
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";

    switch (url.pathname) {
      case "/check":     return handleCheck(req, env);
      case "/claim":     return handleClaim(req, env, ip);
      case "/heartbeat": return handleHeartbeat(req, env);
      case "/release":   return handleRelease(req, env);
      default:           return err("Not found.", 404);
    }
  },
};
