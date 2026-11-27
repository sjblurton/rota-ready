import { askEventSchema, type AskEvent } from '@rota-ready/shared';
import type { EventStreamMessage } from '@/lib/event-stream';

function parsedData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export function askEventsFrom(messages: EventStreamMessage[]): AskEvent[] {
  return messages.flatMap(({ event, data }) => {
    const parsed = askEventSchema.safeParse({ event, data: parsedData(data) });
    return parsed.success ? [parsed.data] : [];
  });
}
