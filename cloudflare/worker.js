// VSchedule push worker — scheduled background notifications.
// Runs on Cloudflare Workers (free). Cron-scheduled to check the lesson
// schedule and send Web Push to subscribed devices when a lesson is
// about to start (device/app can be closed — true background push).
//
// Fully WebCrypto-based (no npm deps, no Node crypto) — runs natively.
//
// Endpoints:
//   POST /subscribe   { endpoint, keys: {p256dh, auth}, leadMin }
//   POST /unsubscribe { endpoint }
//   GET  /health
// Cron: "scheduled" event defined in wrangler.toml
//
// Secrets (set via `wrangler secret put`, never commit):
//   VAPID_PUBLIC_KEY   base64url of the 65-byte uncompressed EC public point (from gen-vapid.mjs)
//   VAPID_PRIVATE_KEY  JSON JWK (with x,y,d) of the EC P-256 key (from gen-vapid.mjs)
//   CONTACT_EMAIL      contact email for VAPID `sub`

// ---------------------------------------------------------------------------
// Base64URL + RFC 8291 push encryption + VAPID signing (WebCrypto only)
// ---------------------------------------------------------------------------
const enc = new TextEncoder();
const B64 = {
  toBytes: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
  from: b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
};

async function hkdf(ikm, salt, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

// Encrypt payload per RFC 8291 (AES-128-GCM with ECDH P-256 + HKDF).
async function encryptPayload(payloadBytes, p256dhB64, authB64) {
  const p256dh = B64.toBytes(p256dhB64);
  const authSecret = B64.toBytes(authB64);

  const serverKey = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKey.publicKey));

  const subscriberKey = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhBits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, serverKey.privateKey, 256));

  const prk = await hkdf(ecdhBits, authSecret, enc.encode('Content-Encoding: auth\0'), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cekInfo = new Uint8Array([...enc.encode('Content-Encoding: aes128gcm\0'), 0, ...serverPublicRaw]);
  const cek = await hkdf(prk, salt, cekInfo, 16);

  const nonceInfo = new Uint8Array([...enc.encode('Content-Encoding: nonce\0'), ...serverPublicRaw]);
  const nonceBuf = await hkdf(prk, salt, nonceInfo, 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBuf, additionalData: new Uint8Array([...enc.encode('WebPush: info\0'), ...p256dh, ...serverPublicRaw]) },
    key, payloadBytes
  ));

  const header = new Uint8Array([...salt, 0, 0, 0x10, 0, 0, 0x02, 0, ...serverPublicRaw]);
  return new Uint8Array([...header, ...ciphertext]);
}

async function vapidSign(privateJwk, publicKeyB64, audience, contactEmail) {
  const now = Math.floor(Date.now() / 1000);
  const signingInput = B64.from(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))) + '.' +
                       B64.from(enc.encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: 'mailto:' + contactEmail })));
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)));
  return `vapid t=${signingInput}.${B64.from(sig)}, k=${publicKeyB64}`;
}

// Send a single push notification. Returns HTTP status; deletes dead subs on 404/410.
async function pushHandler(sub, payloadObj, env) {
  const audience = new URL(sub.endpoint).origin;
  const privateJwk = JSON.parse(env.VAPID_PRIVATE_KEY);
  const authorization = await vapidSign(privateJwk, env.VAPID_PUBLIC_KEY, audience, env.CONTACT_EMAIL);
  const body = enc.encode(JSON.stringify(payloadObj));
  const ciphertext = await encryptPayload(body, sub.keys.p256dh, sub.keys.auth);

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      TTL: '3600',
      'Content-Length': String(ciphertext.byteLength)
    },
    body: ciphertext
  });

  if (res.status === 404 || res.status === 410) {
    await env.SUBSCRIPTIONS.delete(sub.endpoint).catch(() => {});
  }
  return res.status;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------
const SCHEDULE_URL = 'https://menglund92.github.io/VSchedule/lesson-data.json';

async function fetchSchedule(env) {
  try {
    const res = await fetch(SCHEDULE_URL);
    if (res.ok) {
      const json = await res.json();
      await env.SCHEDULE_CACHE.put('schedule', JSON.stringify(json));
      return json;
    }
  } catch (e) { /* fall through to cache */ }
  return env.SCHEDULE_CACHE.get('schedule', { type: 'json' });
}

function isSchoolDay(date) {
  const d = date.getDay(); // 0=Sun..6=Sat
  return d >= 1 && d <= 5;
}

function minutesOfNow(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function padMin(m) {
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

export default {
  async scheduled(event, env, ctx) {
    const now = new Date();
    if (!isSchoolDay(now)) return;

    const schedule = await fetchSchedule(env);
    if (!schedule) return;

    const nowMin = minutesOfNow(now);
    const dayIndex = now.getDay();
    const todayLessons = schedule.lessons.filter(l => l.day === dayIndex);

    const list = await env.SUBSCRIPTIONS.list();
    const tasks = [];

    for (const { value } of list.keys) {
      let sub;
      try { sub = JSON.parse(value); } catch { continue; }

      for (const lesson of todayLessons) {
        const startMin = lesson.start; // minutes since midnight
        const lead = sub.leadMin || 10;
        if (!(nowMin >= startMin - lead && nowMin < startMin)) continue;

        const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${lesson.day}-${startMin}-${sub.endpoint}`;
        const sent = await env.DEDUPE.get(key);
        if (sent) continue;
        await env.DEDUPE.put(key, '1', { expirationTtl: 60 * 60 * 48 });

        const minsLeft = startMin - nowMin;
        tasks.push(pushHandler(sub, {
          title: `VSchedule · ${lesson.subject}`,
          body: `${lesson.subject} börjar kl. ${padMin(startMin)} (om ${minsLeft} min) · ${lesson.time}`,
          url: './'
        }, env).catch(() => {}));
      }
    }

    await Promise.allSettled(tasks);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json', ...cors } });
    }

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      try {
        const b = await request.json();
        const sub = { endpoint: b.endpoint, keys: b.keys, leadMin: Math.max(1, Math.min(60, parseInt(b.leadMin, 10) || 10)) };
        if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
          return new Response(JSON.stringify({ ok: false, error: 'invalid subscription' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        await env.SUBSCRIPTIONS.put(sub.endpoint, JSON.stringify(sub));
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      try {
        const { endpoint } = await request.json();
        await env.SUBSCRIPTIONS.delete(endpoint);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    return new Response('Not found', { status: 404, headers: cors });
  }
};