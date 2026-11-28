# Ask about this week streams the answer as server-sent events over a POST, from a model passed into `createApp`

The Owner's question goes to `POST /api/venues/:venueId/rotas/:weekStart/ask`, behind the same auth and Venue Member check as every Venue route (ADR-0001). The answer comes back on that response as server-sent events (`text/event-stream`):

- `event: delta` with `{ "text": "…" }` for each piece of the answer
- `event: done` with `{}` when it has finished
- `event: error` with `{ "code": "…" }` if it fails after streaming has started

Anything that fails before streaming starts is an ordinary status with `{ code }` (ADR-0005): `400` for a bad question, `404` for another Venue's Week, and `503 ask_unavailable` when the feature is off. The headers are flushed straight away, with `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`, so no proxy holds the stream back. While the model is quiet, a `: ping` comment goes out every 15 seconds so a proxy doesn't close the connection as idle; the parser skips comments. The web app reads it with `fetch` and a small parser in `lib/event-stream.ts`, because `EventSource` can only send a GET with no body or `Authorization` header.

The model is a dependency of `createApp`, like the email sender: `streamAnswer({ system, prompt, signal })` returns the answer as an async iterable of text. In production it's the Anthropic SDK's streaming Messages API. Tests pass in a scripted model that can answer, break partway through, or wait to be aborted, and the journey points the real SDK at a local stub of Anthropic's streaming endpoint through `ANTHROPIC_BASE_URL`. So no test needs an API key, and no fake ships in the production server.

**The feature is on only when both hold:** `ANTHROPIC_API_KEY` is set, and the Venue's Plan lists `ask_about_this_week` among its features (only Preview does, set by editing the database). Without a key, local development, CI and the tests run as before, and every Venue reports `canAskAboutThisWeek: false`, which hides the panel.

**Cost:** the model defaults to `claude-haiku-5-5` (`ASK_MODEL`) with answers capped at 400 tokens (`ASK_MAX_TOKENS`) and questions at 500 characters. Haiku 5.5 thinks by default and its thinking counts against `max_tokens`, so thinking is turned off: the whole cap goes to the answer and the first words arrive sooner. When the browser disconnects, the response's `close` event aborts the model call, so nothing is paid for an answer nobody reads. The Anthropic Console's monthly spend limit is the hard ceiling.

**Prompt injection:** the feature is read-only and the model has no tools, so the worst a crafted question or Staff Member name can do is produce a wrong answer. The Rota and the question go in separate `<rota>` and `<question>` blocks, and the system prompt says both are data, not instructions. Times are already in the Venue's local time with the day named (ADR-0003), so the model never converts timezones. The prompt carries names, Roles and times only: no emails, phone numbers, Staff Link tokens or IDs. The prompt is built by `ask-prompt.ts`, a pure function beside the ADR-0010 layers, with its own unit test: the clock-change, Overnight Shift and privacy cases have more combinations than the route's HTTP tests cover comfortably.

**Screen readers:** the visible answer updates as it streams, with `aria-busy` on it until it's done. A separate visually hidden `role="status"` region announces "Answering…" and then the whole answer (or the error) once, instead of every fragment.

**Stopping:** a Stop button shows while the answer streams. It aborts the `fetch`, which closes the connection, so the API aborts the model call as above. The text so far stays, marked "Stopped", the status region announces "Stopped", and focus goes back to the question box. Changing Week or leaving the page unmounts the panel, which aborts the same way.

**Errors show in the panel, not as a toast.** ADR-0009 sends errors nothing in a form can fix to a toast, but an answer that fails partway through keeps its partial text, and the error belongs next to it. Beside the error, Retry asks the question that failed again, even if the question box has changed since. It isn't offered for `ask_unavailable`, which asking again won't fix.

## Considered Options

- **`EventSource` with a GET**: built-in reconnection. But it can't send a body or the `Authorization` header, so the question would go in the URL (and into logs) and the token in a cookie. Rejected.
- **WebSockets**: two-way, but one question and one streamed answer don't need it, and it adds a second protocol to the API and to Render. Rejected.
- **Returning the whole answer at once**: simplest. But a short answer still takes a few seconds, and showing it as it arrives is the point of the feature. Rejected.
- **An email allowlist instead of a Plan**: no migration. But email confirmation is off in production, so an email address proves nothing. Rejected for the Preview Plan (#161).
- **Calling Anthropic's HTTP API directly**: no dependency. But the SDK handles the event format, retries and typed errors. Rejected.
