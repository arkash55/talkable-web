// Small helpers for in-place sliding history + building a model context.
// History is mutated (push/shift/splice) to avoid allocating new arrays.

export type Sender = 'guest' | 'user';

export type MessageHistoryItem = {
  sender: Sender;
  content: string;
  createdAt: string; // ISO
};

export type HistoryWindowOpts = {
  maxCount?: number; // hard cap on number of messages kept
  maxChars?: number; // hard cap on approx total chars across messages
};

// internal helpers
const lineLen = (m: MessageHistoryItem) =>
  (m.sender?.length ?? 0) + 2 + (m.content?.length ?? 0); // "sender: " + content

const asLine = (m: MessageHistoryItem) => `${m.sender}: ${m.content}`;

/**
 * Append a message to `arr` and prune **in place** to satisfy window limits.
 * - Removes oldest items when over maxCount
 * - Trims from the front until approx char budget fits maxChars
 */
export function appendWithSlidingWindow(
  arr: MessageHistoryItem[],
  msg: MessageHistoryItem,
  opts: HistoryWindowOpts = {}
): void {
  const maxCount = opts.maxCount ?? 50;
  const maxChars = opts.maxChars ?? 8000;

  // Append newest
  arr.push(msg);

  // Prune by count (drop oldest)
  while (arr.length > maxCount) arr.shift();

  // Prune by char budget (approx)
  let chars = 0;
  let keepStart = 0; // index of first item to keep
  for (let i = arr.length - 1; i >= 0; i--) {
    const len = lineLen(arr[i]);
    if (chars + len > maxChars) {
      keepStart = i + 1; // keep everything after i
      break;
    }
    chars += len;
  }
  if (keepStart > 0) arr.splice(0, keepStart);
}

export type ContextWindowOpts = {
  maxMessages?: number; // cap number of messages included
  maxChars?: number;    // cap total chars in context
};

/**
 * Build the model context from history (read-only).
 * Returns oldest → newest as compact "sender: text" lines.
 * Does NOT mutate the passed `history`.
 */
export function buildContextWindow(
  history: MessageHistoryItem[],
  opts: ContextWindowOpts = {}
): string[] {
  const maxMessages = opts.maxMessages ?? 12;
  const maxChars = opts.maxChars ?? 1500;

  let chars = 0;
  const picked: string[] = [];

  for (let i = history.length - 1; i >= 0 && picked.length < maxMessages; i--) {
    const line = asLine(history[i]);
    if (chars + line.length > maxChars) break;
    picked.push(line);
    chars += line.length;
  }
  return picked.reverse();
}
