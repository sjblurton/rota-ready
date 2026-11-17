import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@rota-ready/shared';
import { createApp } from './app.js';

describe('GET /api/health', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  describe('when the API is running', () => {
    let response: Response;
    let body: unknown;

    beforeEach(async () => {
      response = await fetch(`${baseUrl}/api/health`);
      body = await response.json();
    });

    it('responds with 200', () => {
      expect(response.status).toBe(200);
    });

    it('reports the API as ok, in the shape the web app parses', () => {
      expect(healthResponseSchema.parse(body)).toEqual({ api: 'ok' });
    });
  });
});
