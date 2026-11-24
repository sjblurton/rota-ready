import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { pino } from 'pino';
import { inject } from 'vitest';
import { createApp } from '#src/app.js';
import type { Prisma } from '#src/generated/prisma/client.js';
import { createDb, type Db } from '#src/lib/db.js';
import type { Email, EmailSender } from '#src/lib/email-sender.js';

const ISSUER = 'http://auth.test/auth/v1';
const KEY_ID = 'test-key';
const DEFAULT_NOW = '2026-01-05T12:00:00.000Z';
const BLOCKED_REQUEST_TIMEOUT_MS = 2_000;

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
export type StaffMemberLock = Awaited<ReturnType<TestApp['holdStaffMemberLock']>>;
type CompetingChange = (tx: Prisma.TransactionClient) => Promise<unknown>;

function createEmailOutbox() {
  const sent: Email[] = [];
  const sender: EmailSender = {
    async send(email) {
      sent.push(email);
    },
  };
  return { sender, sent };
}

export async function startTestApp({ databaseUrl = inject('databaseUrl') } = {}) {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const publicJwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'ES256' };
  const db: Db = createDb(databaseUrl);
  const logLines: string[] = [];
  let now = new Date(DEFAULT_NOW);
  const outbox = createEmailOutbox();
  const unfinishedLocks = new Set<() => Promise<void>>();
  const server = createApp({
    db,
    clock: { now: () => new Date(now) },
    logger: pino({}, { write: (line: string) => logLines.push(line) }),
    staffLinkKey: randomBytes(32),
    emailSender: outbox.sender,
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

  async function holdStaffMemberLock(staffMemberId: string) {
    let lockTaken!: (holderPid: number) => void;
    const locked = new Promise<number>((resolve) => (lockTaken = resolve));
    let runChange!: (change: CompetingChange) => void;
    const changeReady = new Promise<CompetingChange>((resolve) => (runChange = resolve));
    const transaction = db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM staff_members WHERE id = ${staffMemberId}::uuid FOR UPDATE`;
        const [{ pid }] = await tx.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() AS pid`;
        lockTaken(pid);
        await (await changeReady)(tx);
      },
      { timeout: 10_000 },
    );
    const rolledBack = transaction.catch(() => undefined);
    unfinishedLocks.add(async () => {
      runChange(() => Promise.reject(new Error('rolled back when the test app closed')));
      await rolledBack;
    });
    const holderPid = await Promise.race([locked, transaction.then(() => locked)]);

    async function isAQueryBlockedByTheHolder() {
      const rows = await db.$queryRaw<unknown[]>`
        SELECT 1 FROM pg_stat_activity
        WHERE wait_event_type = 'Lock' AND ${holderPid}::int = ANY(pg_blocking_pids(pid))`;
      return rows.length > 0;
    }

    return {
      async waitForBlockedRequest() {
        const deadline = Date.now() + BLOCKED_REQUEST_TIMEOUT_MS;
        while (!(await isAQueryBlockedByTheHolder())) {
          if (Date.now() > deadline) {
            throw new Error('No query waited on the Staff Member row lock in time');
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      },
      async commitAfter(change: CompetingChange) {
        runChange(change);
        await transaction;
      },
    };
  }

  async function close() {
    await Promise.all([...unfinishedLocks].map((rollBack) => rollBack()));
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
    logs,
    setClock,
    request,
    holdStaffMemberLock,
    signToken,
    signTokenWithAnotherKey,
    signExpiredToken,
    close,
  };
}
