


export type Sender = 'guest' | 'user';

export type MessageHistoryItem = {
  sender: Sender;
  content: string;
  createdAt: string; 
};

export type HistoryWindowOpts = {
  maxCount?: number; 
  maxChars?: number; 
};


const lineLen = (m: MessageHistoryItem) =>
  (m.sender?.length ?? 0) + 2 + (m.content?.length ?? 0); 

const asLine = (m: MessageHistoryItem) => `${m.sender}: ${m.content}`;


export function appendWithSlidingWindow(
  arr: MessageHistoryItem[],
  msg: MessageHistoryItem,
  opts: HistoryWindowOpts = {}
): void {
  const maxCount = opts.maxCount ?? 50;
  const maxChars = opts.maxChars ?? 8000;

  
  arr.push(msg);

  
  while (arr.length > maxCount) arr.shift();

  
  let chars = 0;
  let keepStart = 0; 
  for (let i = arr.length - 1; i >= 0; i--) {
    const len = lineLen(arr[i]);
    if (chars + len > maxChars) {
      keepStart = i + 1; 
      break;
    }
    chars += len;
  }
  if (keepStart > 0) arr.splice(0, keepStart);
}

export type ContextWindowOpts = {
  maxMessages?: number; 
  maxChars?: number;    
};


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
