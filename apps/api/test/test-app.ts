import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { pino } from 'pino';
import { inject } from 'vitest';
import { createApp } from '#src/app.js';
import { createDb, type Db } from '#src/lib/db.js';
import type { Email, EmailSender } from '#src/lib/email-sender.js';

const ISSUER = 'http://auth.test/auth/v1';
const KEY_ID = 'test-key';
const WEB_URL = 'http://web.test';

interface TokenSubject {
  id: string;
  email: string;
}

interface TokenOptions {
  key?: CryptoKey;
  issuer?: string;
  expiresAt?: string | number;
}

interface RequestOptions {
  as?: TokenSubject;
  token?: string;
  body?: string | object | undefined;
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;

function createEmailOutbox() {
  const sent: Email[] = [];
  const failingAddresses = new Set<string>();
  const sender: EmailSender = {
    async send(email) {
      if (failingAddresses.has(email.to)) throw new Error(`SMTP refused ${email.to}`);
      sent.push(email);
    },
  };
  return {
    sender,
    sent,
    failFor(address: string) {
      failingAddresses.add(address);
    },
  };
}

export async function startTestApp({ databaseUrl = inject('databaseUrl') } = {}) {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const publicJwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'ES256' };
  const db: Db = createDb(databaseUrl);
  const logLines: string[] = [];
  let now: Date | undefined;
  const outbox = createEmailOutbox();
  const server = createApp({
    db,
    clock: { now: () => now ?? new Date() },
    logger: pino({}, { write: (line: string) => logLines.push(line) }),
    staffLinkKey: randomBytes(32),
    emailSender: outbox.sender,
    webUrl: WEB_URL,
    authConfig: {
      keys: createLocalJWKSet({ keys: [publicJwk] }),
      issuer: ISSUER,
      audience: 'authenticated',
    },
  }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://localhost:${port}`;

  function signToken(
    user: TokenSubject,
    { key = privateKey, issuer = ISSUER, expiresAt = '1h' }: TokenOptions = {},
  ) {
    return new SignJWT({ email: user.email, role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
      .setSubject(user.id)
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(key);
  }

  async function signTokenWithAnotherKey(user: TokenSubject) {
    const { privateKey: otherKey } = await generateKeyPair('ES256');
    return signToken(user, { key: otherKey });
  }

  function signExpiredToken(user: TokenSubject) {
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    return signToken(user, { expiresAt: oneMinuteAgo });
  }

  async function request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    { as, token, body }: RequestOptions = {},
  ) {
    const headers: Record<string, string> = {};
    const bearer = token ?? (as && (await signToken(as)));
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    return fetch(`${baseUrl}${path}`, init);
  }

  async function close() {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.$disconnect();
  }

  function setClock(instant: string) {
    now = new Date(instant);
  }

  function logs() {
    return logLines.join('');
  }

  return {
    db,
    outbox,
    webUrl: WEB_URL,
    logs,
    setClock,
    request,
    signToken,
    signTokenWithAnotherKey,
    signExpiredToken,
    close,
  };
}
