export interface EventStreamMessage {
  event: string;
  data: string;
}

const DEFAULT_EVENT = 'message';

function messageOf(frame: string): EventStreamMessage | undefined {
  let event = DEFAULT_EVENT;
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    if (field === 'data') data.push(value);
  }
  return data.length > 0 ? { event, data: data.join('\n') } : undefined;
}

export function createEventStreamParser() {
  let unfinished = '';
  return {
    push(chunk: string): EventStreamMessage[] {
      const frames = (unfinished + chunk).replace(/\r\n/g, '\n').split('\n\n');
      unfinished = frames.pop() ?? '';
      return frames.map(messageOf).filter((message) => message !== undefined);
    },
  };
}
