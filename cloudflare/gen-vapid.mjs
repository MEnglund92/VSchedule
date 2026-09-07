#!/usr/bin/env node
// Generate a VAPID keypair for VSchedule push.
// Outputs:
//   VAPID_PUBLIC_KEY   base64url of 65-byte uncompressed EC public point (for the client & worker `k=`)
//   VAPID_PRIVATE_KEY  JSON JWK (x, y, d) for the worker secret
//
// Usage: node gen-vapid.mjs
// Then set both values as Cloudflare secrets:
//   wrangler secret put VAPID_PUBLIC_KEY
//   wrangler secret put VAPID_PRIVATE_KEY
// And embed VAPID_PUBLIC_KEY in the browser client (notifications.js, Phase 2).

import { generateKeyPairSync, createPublicKey } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// Public point as base64url (raw uncompressed, 65 bytes) — what the browser client expects.
const jwkPublic = publicKey.export({ format: 'jwk' });
const x = Buffer.from(jwkPublic.x, 'base64url');
const y = Buffer.from(jwkPublic.y, 'base64url');
const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);
const publicB64 = uncompressed.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Private JWK with x, y, d — what the worker imports for signing.
const privateJwk = privateKey.export({ format: 'jwk' });
const privateJson = JSON.stringify(privateJwk);

console.log('VAPID_PUBLIC_KEY=' + publicB64);
console.log('VAPID_PRIVATE_KEY=' + privateJson);
console.log('\nSet these with:');
console.log('  wrangler secret put VAPID_PUBLIC_KEY');
console.log('  wrangler secret put VAPID_PRIVATE_KEY');