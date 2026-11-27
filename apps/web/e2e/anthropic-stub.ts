import { createServer, type ServerResponse } from 'node:http';

export const STUB_ANSWER_CHUNKS = ['Sam Jones ', 'works the most hours ', 'this Week.'];

const CHUNK_DELAY_MS = 150;
const port = Number(process.env.ANTHROPIC_STUB_PORT ?? 3001);

function send(res: ServerResponse, event: string, data: object) {
  res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
}

function pause() {
  return new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
}

async function streamAnswer(res: ServerResponse) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  send(res, 'message_start', {
    message: {
      id: 'msg_stub',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-5-5',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  });
  send(res, 'content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
  for (const text of STUB_ANSWER_CHUNKS) {
    await pause();
    if (res.destroyed) return;
    send(res, 'content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
  }
  send(res, 'content_block_stop', { index: 0 });
  send(res, 'message_delta', {
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: STUB_ANSWER_CHUNKS.length },
  });
  send(res, 'message_stop', {});
  res.end();
}

if (import.meta.main) {
  createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') return res.end('ok');
    if (req.method !== 'POST' || req.url !== '/v1/messages') {
      res.writeHead(404).end();
      return;
    }
    req.resume();
    req.on('end', () => void streamAnswer(res));
  }).listen(port);
}
