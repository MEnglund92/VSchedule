# VSchedule push worker (Cloudflare)

Background push notifications for VSchedule. Runs on Cloudflare Workers (free tier)
with a cron trigger and KV bindings. No server to manage.

## Anatomy

- `worker.js` — the worker: `POST /subscribe`, `POST /unsubscribe`, `GET /health`,
  and `scheduled` (cron) that checks lessons and sends Web Push.
  Pure WebCrypto (RFC 8291 + VAPID) — no npm deps, runs natively on Workers.
- `wrangler.toml` — worker config: cron `*/15 * * * *`, KV bindings (fill in IDs).
- `gen-vapid.mjs` — generates the VAPID keypair in the exact formats the worker needs
  (`VAPID_PUBLIC_KEY` base64url public point + `VAPID_PRIVATE_KEY` JWK JSON).
- `../lesson-data.json` — the shared schedule (same source of truth as the web app).

## How push works

1. User opens the installed PWA → `notifications.js` (Phase 2) asks permission → gets a
   `PushSubscription` from `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <VAPID_PUBLIC_KEY> })`.
2. The subscription `{ endpoint, keys, leadMin }` is `POST`ed to this worker's `/subscribe`.
3. Every 15 minutes the `scheduled` cron:
   - reads `lesson-data.json` (from GitHub Pages, cached in `SCHEDULE_CACHE` KV)
   - for today's lessons within each subscriber's `leadMin` window that haven't been sent
     (dedupe in `DEDUPE` KV) → pushes a Web Push notification to the device.
4. `../sw.js` shows the notification and opens the app on click.

Even if the app/device is closed, the push still arrives — that is the
"background/closed-app" notification behavior you asked for.

## Deploy (one time, ~15 min)

Prereqs: Node 18+, a free Cloudflare account.

```powershell
# 1. Install wrangler
npm i -g wrangler

# 2. Log in (opens a browser)
wrangler login

# 3. Generate the VAPID keypair and save the output
node gen-vapid.mjs
#    VAPID_PUBLIC_KEY  = base64url public point  (also needed in the client later)
#    VAPID_PRIVATE_KEY = JSON JWK

# 4. Create the three KV namespaces (copy each returned id into wrangler.toml)
wrangler kv namespace create SUBSCRIPTIONS
wrangler kv namespace create DEDUPE
wrangler kv namespace create SCHEDULE_CACHE

# 5. Set secrets
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put CONTACT_EMAIL

# 6. Edit worker.js: set SCHEDULE_URL (YOUR_GH_USER -> your GitHub username)

# 7. Deploy
wrangler deploy
```

## Client wiring (Phase 2, still to do)

`../notifications.js` currently does local Web Notifications. Phase 2 adds:

```js
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
});
await fetch('<worker>/subscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, leadMin }) });
```

plus an unsubscribe path, and graceful fallback if the worker is unreachable.
The VAPID_PUBLIC_KEY from `gen-vapid.mjs` must be embedded in the client.

## Fill-in checklist before going live (search for TODO / YOUR_GH_USER / REPLACE_)
- [ ] `wrangler.toml`: three KV namespace ids
- [ ] `worker.js`: `SCHEDULE_URL`
- [ ] Deploy + verify `GET /health` returns `{ok:true}`
- [ ] Embed `VAPID_PUBLIC_KEY` in the client (Phase 2)