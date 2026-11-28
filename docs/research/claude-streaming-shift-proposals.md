# Streaming structured Shift proposals from Claude

Research for #177, part of the map #176 (AI drafts the Week's Rota). Checked against the Claude docs and the installed `@anthropic-ai/sdk` 1.14.0 on 28 November 2026.

## Question

How does the API get a stream of structured Shift proposals (Staff Member, Role, day, start, end) from Claude, so that it can check and save each one as it arrives? Tool use or structured outputs? How does a partial proposal look mid-stream? Which model, and what does drafting a typical Week cost (10 to 20 Staff Members, 40 to 80 Shifts, 4 past Weeks as examples)?

## Recommendation in short

- **Mechanism:** one client tool, `propose_shift`, that Claude calls once per Shift. Set `strict: true` on it, and leave `eager_input_streaming` off. Send `tool_choice: auto` and tell the model in the prompt to use the tool.
- **Incremental parsing:** none to write. Each Shift is its own `tool_use` content block. When the stream sends `content_block_stop` for that block, the SDK already holds the parsed input. Validate it with a shared Zod schema, run the hard-rule check, then save it or skip it with a reason.
- **Loop:** when the turn ends with `stop_reason: "tool_use"`, send back one `tool_result` per call, all in one user message: "added", or `is_error: true` with the skip reason. Claude can then propose a replacement. Cap it at about 3 turns. Cache the prompt so the extra turns cost little.
- **Model:** `claude-sonnet-5-5` at effort `medium`, behind a `DRAFT_MODEL` setting like `ASK_MODEL`. Test `claude-haiku-5-5` at effort `high` against the example-Weeks eval set (the map's "Judging draft quality"). It costs about a twentieth as much, and it can take over if the drafts are as good.
- **Cost:** roughly 7k to 15k input tokens and 5k to 15k output tokens per Week. That is about **$0.10 to $0.20 per drafted Week on Sonnet 5.5** and about **$0.01 on Haiku 5.5** (prices from the Anthropic pricing page, read 28 November 2026).

## The two mechanisms compared

### Option A: one tool call per Shift (recommended)

Define a tool whose input is a single Shift:

```json
{
  "name": "propose_shift",
  "description": "Add one Shift to the Draft. Call once for each Shift you propose.",
  "strict": true,
  "input_schema": {
    "type": "object",
    "properties": {
      "staffMemberId": { "type": "string" },
      "roleId": { "type": "string" },
      "day": { "type": "string", "format": "date" },
      "start": { "type": "string", "pattern": "^([01]\\d|2[0-3]):[0-5]\\d$" },
      "end": { "type": "string", "pattern": "^([01]\\d|2[0-3]):[0-5]\\d$" }
    },
    "required": ["staffMemberId", "roleId", "day", "start", "end"],
    "additionalProperties": false
  }
}
```

Claude 4 and later models make several tool calls in one response by default (parallel tool use), so a single turn can hold dozens of `propose_shift` blocks, one after another on the stream [parallel]. Each block arrives as `content_block_start` (with a placeholder `input: {}`), then `input_json_delta` events carrying `partial_json` fragments, then `content_block_stop` [streaming] [fgts].

**How a partial proposal looks mid-stream.** By default (no `eager_input_streaming`), the API "buffers each key and value in `input` until it is complete", and only then emits it as chunked `partial_json` [streaming]. So between `content_block_start` and `content_block_stop` you see fragments like `{"staffMemberId": "S12", "roleId": "R3", "day": "2026-12-05", "start": "17:00"`, but never half a value. With `eager_input_streaming: true`, the API skips that buffering and validation, so fragments can stop mid-value and the result can be invalid JSON [fgts]. Eager streaming exists to cut the wait before the first fragment of a _large_ parameter, such as a file body. A Shift is about 40 tokens, so buffering costs nothing visible here, and it is the safer choice.

**What the SDK does.** `MessageStream` in `@anthropic-ai/sdk` 1.14.0 adds each `partial_json` fragment to a buffer on the block, parses it lazily with its own tolerant partial-JSON parser, and makes `input` a plain value at `content_block_stop`. It then emits a `contentBlock` event with the finished block (`lib/MessageStream.js`, the `content_block_stop` cases). The current code iterates raw events with `for await` (`apps/api/src/lib/answer-model.ts`). The drafting model can do the same: on `content_block_stop`, read `stream.currentMessage.content[event.index]`, and if it is a `tool_use` block named `propose_shift`, hand its `input` and `id` to the caller. The SDK's partial-JSON parser lives under `_vendor/` and is not public API. This design never needs it.

**What `strict: true` adds.** Grammar-constrained sampling, so the input matches the schema: right field names, all five present, strings that match the time pattern [strict]. It does not cover a response cut off by `max_tokens` or a refusal [so]. Rota Ready validates every input with Zod anyway. Strict mode means that check almost never fails for a format reason, so the skip reasons the Owner sees are about real rules (overlap, time off and so on). Limits to respect: at most 20 strict tools, 24 optional parameters and 16 union-typed parameters per request, and no `minimum`/`maxLength` style constraints [so]. The schema above has no optional or union parameters. The compiled grammar is cached for 24 hours, so only the first request after a schema change waits for compilation [so].

**Forced tool use is not available.** Claude Opus 5.5 and Claude Sonnet 5.5 return a 400 for `tool_choice` `any` or `tool` [parallel]. Use `auto`, say in the system prompt that every Shift must go through `propose_shift`, and treat a turn with no calls as "nothing proposed".

**Feeding back skipped Shifts.** The docs require one `tool_result` per `tool_use`, all in the next user message, with `is_error: true` for a call you did not carry out [parallel]. Returning "skipped: overlaps Alex's 12:00 to 17:00 Shift" lets Claude propose a different Shift in the next turn. That uses the same machinery, so it costs little to build. Pass the assistant content back unchanged (including thinking blocks) so the cache and preserved thinking stay valid.

### Option B: structured outputs (`output_config.format`) with an array of Shifts

Ask for `{ "shifts": [ {…}, {…} ] }` as the response format. The output is grammar-constrained JSON and streams as ordinary `text_delta` events [so]. To save Shifts one at a time, the API would have to run an incremental JSON parser over the text and notice each time an array element closes. The SDK gives no public helper for this, so Rota Ready would own that parser and its tests. Further drawbacks:

- No natural place to tell Claude a Shift was skipped and ask for another, without a second request and a new schema.
- `maxItems` and similar array limits are not supported, so the schema cannot cap the count [so].
- Changing `output_config.format` invalidates the prompt cache, and a refusal or `max_tokens` stop can still leave the JSON incomplete [so].

Structured outputs fit "extract one object from this text". Option A fits "a stream of independent items, each checked as it lands", which is what the map asks for.

## Fitting ADR-0012

The design stays the same: an injected model, SSE to the browser, abort on disconnect, token caps, and a scripted model in tests.

- **Injected model.** Something like `DraftModel.draftWeek({ system, prompt, signal, onProposal })`, where `onProposal(input, id)` returns the outcome ("added" or a skip code). The model owns the turn loop and turns outcomes into `tool_result` blocks. The route owns validation and saving. A scripted test model calls `onProposal` with fixed inputs, including bad ones, and can break partway or wait to be aborted, as Ask's does. The journey can point the real SDK at a local stub of the streaming endpoint through `ANTHROPIC_BASE_URL` that emits `tool_use` blocks.
- **Validation stays in Rota Ready.** The tool input is `unknown` until a shared Zod schema accepts it. Then the hard rules run (overlaps, time off, availability, maximum hours, opening hours, Roles the Staff Member can work). A failure in either step is a skip with a reason code, returned to Claude and listed in the end-of-draft summary.
- **Short aliases, not IDs.** ADR-0012 keeps IDs out of the prompt. Give Staff Members and Roles short aliases (`S1`, `R3`) in the prompt and map them back on the server. That also saves tokens. An alias that maps to nothing is just another skip.
- **Times.** As in ADR-0003, the prompt uses the Venue's local time. Decide in the PRD how an Overnight Shift is written (for example, `end` earlier than `start` means the next day) and test it in the prompt builder, as `ask-prompt.ts` does.
- **SSE events.** Following the Ask pattern: `event: shift` for each saved Shift (so the grid can add it), `event: skipped` with `{ code }`, then `event: done` with the summary counts, or `event: error` with `{ code }`. Work out "cover not filled" in Rota Ready's own code from the cover needs and the saved Shifts, rather than trusting the model's prose.
- **Prompt injection.** This feature, unlike Ask, has a tool that writes. But every write goes through the validator, for this Venue's Draft Week only, and the Owner reviews before Publishing. The worst a crafted Staff Member note can do is produce a bad but rule-valid Draft. Keep the Ask split of data blocks and an instruction that they are data.

## Which model

From the models overview [models] and the effort and thinking pages [effort] [thinking]:

| Model             | Price (input / output per MTok)           | Latency (docs' comparison) | Thinking                                                                            | Default effort |
| ----------------- | ----------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- | -------------- |
| Claude Opus 5.5   | $4 / $20                                  | Moderate                   | Always on, cannot be disabled                                                       | `medium`       |
| Claude Sonnet 5.5 | $2 / $10                                  | Fast                       | On by default. `between_tools` turns off up-front thinking (effort `high` or below) | `high`         |
| Claude Haiku 5.5  | $0.10 / $0.50 (prompts up to 100k tokens) | Fastest                    | On by default. `disabled` allowed at effort `high` or below                         | `medium`       |

Drafting a Week means satisfying constraints across up to 20 people, with hours targets, availability, cover by Role and the patterns in past Weeks. That is more judgement than the "classification, extraction, and routing" Haiku is described for [models]. Sonnet 5.5 is "the best combination of speed and intelligence". The validator catches broken hard rules whatever the model, but cover gaps, fairness and resemblance to past Weeks depend on how well the model plans.

- **Default: Sonnet 5.5, effort `medium`, adaptive thinking.** Thinking happens before the first Shift, so the UI needs a "Planning…" state, then Shifts arrive steadily. Sonnet 5.5 recalibrated its effort levels, so sweep `low`, `medium` and `high` on the eval set rather than guessing [effort].
- **Faster first Shift:** `thinking: { type: "between_tools" }` on Sonnet 5.5 skips up-front thinking. Shifts start almost at once, perhaps at some cost to quality. Measure it.
- **Challenger: Haiku 5.5 at effort `high`.** The docs recommend `high` for "strict instruction following" and longer tasks, and suggest comparing `xhigh`/`max` with Sonnet 5.5 [effort]. Thinking counts towards `max_tokens`, so leave room for it.
- **Not Opus 5.5.** Twice Sonnet's price, slower, thinking cannot be turned off, and nothing suggests a Week needs it.

## Tokens and cost per drafted Week

**Method.** I built a sample prompt in the compact line format the prompt builder would use (`Fri 17:00-23:00 S12 Bar`): 18 Staff Members with Roles, availability, time off, hours and a note; opening hours; cover needs for 7 days; 4 past Weeks of 70 Shifts; 10 existing Shifts; and the Owner's instructions. It came to about 13,800 characters. The models overview puts the current tokenizer at about 2.5 characters per token (1M tokens ≈ 2.5M characters) [models], so the user message is about 5,500 to 7,000 tokens with the extra cost of digits and times. One `propose_shift` input is about 95 characters, so about 40 tokens, plus the tool-call framing. No API key was available here, so these are estimates. Run `messages.countTokens` (free) on a real prompt once the builder exists.

| Part                                                                                                    | Tokens (estimate)         |
| ------------------------------------------------------------------------------------------------------- | ------------------------- |
| System prompt (rules, format, data-not-instructions)                                                    | 1,500 to 2,500            |
| Tool definition plus the tool-use system prompt (286 on Sonnet 5.5 and Haiku 5.5 with `auto`) [pricing] | about 500                 |
| Venue, cover, Staff Members, existing Shifts, instructions                                              | 2,500 to 4,000            |
| 4 past Weeks (40 to 80 Shifts each, about 12 to 15 tokens a line)                                       | 2,000 to 5,000            |
| **Input, first turn**                                                                                   | **about 7,000 to 12,000** |
| Shift calls (40 to 80 × about 60 tokens)                                                                | 2,500 to 5,000            |
| Thinking at effort `medium` (varies; billed as output)                                                  | 2,000 to 8,000            |
| Short closing text                                                                                      | about 200                 |
| **Output**                                                                                              | **about 5,000 to 13,000** |

A follow-up turn for skipped Shifts re-sends the prompt. With top-level `cache_control`, the second turn reads it from the cache: $0.10 per MTok on Sonnet 5.5 and $0.01 on Haiku 5.5. The first turn writes it at 1.25 times the input price [pricing]. The prompt is well over the 512-token minimum for caching on these models.

Allowing up to 15k input and 15k output tokens with one follow-up turn, prices from [pricing], read 28 November 2026:

| Model                                               | Input                                                     | Output                             | Per Week                 |
| --------------------------------------------------- | --------------------------------------------------------- | ---------------------------------- | ------------------------ |
| Sonnet 5.5 ($2 / $10; cache write $2.50, hit $0.10) | 12k × $2.50/M ≈ $0.03, plus about 3k new per turn ≈ $0.01 | 5k to 15k × $10/M ≈ $0.05 to $0.15 | **about $0.10 to $0.20** |
| Haiku 5.5 ($0.10 / $0.50, up to 100k prompt)        | ≈ $0.002                                                  | ≈ $0.004 to $0.008                 | **about $0.01**          |
| Opus 5.5 ($4 / $20)                                 | ≈ $0.06                                                   | ≈ $0.14 to $0.30                   | about $0.20 to $0.40     |

Output dominates the cost, and thinking dominates output. So effort is the main lever. Even a 20-person Venue stays under Haiku's 100k-token higher-price threshold.

For the proof of concept, a drafted Week on Sonnet costs about the same as 20 to 40 Ask questions on Haiku. Keep the Ask cost controls: a per-User rate limit for drafting (a draft costs more, so a lower limit), abort on disconnect, and the Console spend limit as the ceiling.

## Risks and how to handle them

- **Partial JSON.** With eager streaming off, values are buffered, so a fragment never holds half a value [streaming]. Only accept a Shift at `content_block_stop`, after Zod passes. If eager streaming is ever turned on, the SDK's tolerant parser can silently cut a string short, and the docs say to validate and never trust an exception to catch it [fgts].
- **`max_tokens` cut-off mid-proposal.** The last block can be left without some fields, which Zod rejects, so nothing half-made is saved. A cut-off that lands after the last full value could leave a Shift that is complete but missing only its closing brace. That Shift is correct, so saving it is fine. Set `max_tokens` well above the expected output (for example 32,000; the SDK needs streaming for large values anyway) so thinking cannot use up the room. If the turn ends with `max_tokens`, stop the loop, keep what was saved, and report "the draft stopped early" in the summary, as Stop does.
- **The model proposes invalid Shifts.** Expected, and the reason the validator exists. Skip with a reason code and send it back as an `is_error` tool result so Claude can try again. The turn cap and a cap on proposals per draft (for example twice the open cover slots) stop a loop that keeps proposing bad Shifts.
- **Proposals that pass every rule but are poor** (unfair spreads, ignoring the note). Only the eval set and the Owner's review catch these. That belongs to the map's "Judging draft quality" ticket.
- **Refusals.** Sonnet 5.5 and Haiku 5.5 have safety classifiers that can end a response with `stop_reason: "refusal"` (HTTP 200), before or partway through output [refusals]. Rota data is unlikely to trigger them, but the code must check `stop_reason` before trusting the last block. A refusal that lands while a `tool_use` block is open is returned directly, even with server-side fallback [refusals]. The docs say to treat partial output as incomplete. Here, the Shifts already saved have each passed Rota Ready's own checks and the Owner reviews the Draft anyway, so keep them, as Stop does, and end with `event: error` and a `draft_failed` code. Server-side `fallbacks: "default"` (beta, `server-side-fallback-2026-07-01`, needs `client.beta.messages`) can retry a decline that comes before any output on Sonnet 5.5. Haiku 5.5 has no server-side fallback [refusals].
- **No tool call at all.** With `auto`, Claude may answer in prose. Treat a turn with no `propose_shift` calls as finished, and report "nothing proposed" if nothing was saved.
- **First-request latency.** Grammar compilation runs on the first request after a schema change, then is cached for 24 hours [so]. On a demo Venue this means the first draft of the day may start a little slower.
- **Thinking blocks in the loop.** Sonnet 5.5 and Haiku 5.5 tie thinking blocks to the conversation. Append the assistant `content` unchanged on each follow-up turn, and don't edit earlier turns, or the cache and thinking are invalidated (see the preserved-thinking docs).

## Sources

All read on 28 November 2026.

- [streaming] Streaming messages: https://platform.claude.com/docs/en/build-with-claude/streaming (input JSON delta, default buffering of each key and value, event sequence for tool use)
- [fgts] Fine-grained tool streaming: https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming (`eager_input_streaming`, partial or invalid JSON, accumulation contract, `INVALID_JSON` tool result)
- [so] Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs (grammar caching, schema limits, invalid outputs on refusal and `max_tokens`, streaming compatibility, cache invalidation)
- [strict] Strict tool use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- [parallel] Parallel tool use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use (multiple calls per turn, one user message of results, forced `tool_choice` rejected on Opus 5.5 and Sonnet 5.5)
- [models] Models overview: https://platform.claude.com/docs/en/models/overview (comparative latency, prices, default effort, tokenizer characters per token)
- [effort] Effort: https://platform.claude.com/docs/en/build-with-claude/effort
- [thinking] Thinking: https://platform.claude.com/docs/en/build-with-claude/thinking (`between_tools` on Sonnet 5.5)
- [pricing] Pricing: https://platform.claude.com/docs/en/about-claude/pricing (per-model rates, cache write and hit prices, Haiku 5.5 long-prompt prices, tool-use system prompt tokens)
- [refusals] Refusals and fallback: https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback
- SDK source: `@anthropic-ai/sdk` 1.14.0, `lib/MessageStream.js` (`content_block_stop` makes the parsed `input` final and emits `contentBlock`; partial parser under `_vendor/partial-json-parser`)
- Repo: `docs/adr/0012-ask-about-this-week-streams-over-sse-from-an-injected-model.md`, `apps/api/src/lib/answer-model.ts`
