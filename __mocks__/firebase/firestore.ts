import { vi } from "vitest";

// __mocks__/firebase/firestore.ts
type Listener = (snap: any) => void;

const store = new Map<string, any>();          // "path" -> data
const listeners = new Map<string, Set<Listener>>();
let idCounter = 1;

const now = () => new Date();                  // simple timestamp
export const serverTimestamp = () => ({ __serverTimestamp: true, at: now() });

export class Timestamp {
  // only what you need in tests
  static now() { return now(); }
}

const pathOf = (...parts: any[]) =>
  parts.filter(Boolean).map(String).join('/');

const isDbArg = (x: any) => x && typeof x === 'object' && x.__isDb;
export const db = { __isDb: true };            // not used, but handy if imported

// ---------- Refs ----------
export const collection = (...args: any[]) => {
  let parts = args;
  if (isDbArg(parts[0])) parts = parts.slice(1);
  return { __type: 'collection', path: pathOf(...parts) };
};

export const doc = (...args: any[]) => {
  let parts = args;
  if (isDbArg(parts[0])) parts = parts.slice(1);

  // Support Firestore's doc(collectionRef) form: auto-generate an ID
  if (
    parts.length === 1 &&
    parts[0] &&
    typeof parts[0] === 'object' &&
    parts[0].__type === 'collection' &&
    typeof parts[0].path === 'string'
  ) {
    const colRef = parts[0];
    const id = String(idCounter++);
    return { __type: 'doc', path: `${colRef.path}/${id}` };
  }

  return { __type: 'doc', path: pathOf(...parts) };
};

// ---------- Snapshots ----------
class MockDocSnap {
  constructor(public _path: string, private _data: any | null) {}
  exists() { return this._data != null; }
  data() { return this._data; }
  get id() { return this._path.split('/').pop(); }
  get ref() { return doc(this._path); }
}

class MockQuerySnap {
  constructor(public docs: MockDocSnap[]) {}
  get empty() { return this.docs.length === 0; }
  get size() { return this.docs.length; }
  forEach(cb: (d: MockDocSnap) => void) { this.docs.forEach(cb); }
}

// ---------- Basic ops ----------
export const getDoc = vi.fn(async (ref: any) => {
  const data = store.get(ref.path) ?? null;
  return new MockDocSnap(ref.path, data);
});

export const setDoc = vi.fn(async (ref: any, data: any, opts?: { merge?: boolean }) => {
  const curr = store.get(ref.path);
  const next = opts?.merge ? { ...(curr ?? {}), ...materialize(data) } : materialize(data);
  store.set(ref.path, next);
  notify(ref.path);
});

export const updateDoc = vi.fn(async (ref: any, patch: any) => {
  const curr = store.get(ref.path);
  if (!curr) throw Object.assign(new Error('not-found'), { code: 'not-found' });
  store.set(ref.path, { ...curr, ...materialize(patch) });
  notify(ref.path);
});

export const deleteDoc = vi.fn(async (ref: any) => {
  store.delete(ref.path);
  notify(ref.path);
});

export const addDoc = vi.fn(async (colRef: any, data: any) => {
  const id = String(idCounter++);
  const path = `${colRef.path}/${id}`;
  const next = materialize(data);
  store.set(path, next);
  notify(path);
  return { id, path, ref: doc(path) };
});

// ---------- Queries ----------
export const where = (...args: any[]) => ({ __type: 'where', args });
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({ __type: 'orderBy', field, dir });
export const qLimit = (n: number) => ({ __type: 'limit', n });
export const limit = qLimit; // <-- allow `import { limit as qLimit }` from the service
export const startAfter = (cursor: any) => ({ __type: 'startAfter', cursor });

export const query = (...parts: any[]) => {
  const [source, ...mods] = parts;
  return { __type: 'query', source, mods };
};

export const getDocs = vi.fn(async (qOrCol: any) => {
  let colPath = qOrCol.__type === 'query' ? qOrCol.source.path : qOrCol.path;
  let rows = entriesUnder(colPath).map(([p, v]) => new MockDocSnap(p, v));

  const mods = qOrCol.__type === 'query' ? qOrCol.mods : [];

  // apply where (only "==" supported)
  for (const m of mods) {
    if (m?.__type === 'where') {
      const [field, op, value] = m.args;
      rows = rows.filter(snap => {
        const data = snap.data();
        // nested path support "members.uid" style
        const resolved = field.split('.').reduce((acc, k) => acc?.[k], data);
        return op === '==' ? resolved === value : true;
      });
    }
  }

  // orderBy
  for (const m of mods) {
    if (m?.__type === 'orderBy') {
      const { field, dir } = m;
      rows.sort((a, b) => {
        const av = fieldValue(a.data(), field);
        const bv = fieldValue(b.data(), field);
        const cmp = av > bv ? 1 : av < bv ? -1 : 0;
        return dir === 'desc' ? -cmp : cmp;
      });
    }
  }

  // startAfter — cursor by id (common in tests)
  const startMod = mods.find((m: any) => m?.__type === 'startAfter');
  if (startMod?.cursor) {
    const idx = rows.findIndex((s) => s.id === startMod.cursor.id);
    if (idx >= 0) rows = rows.slice(idx + 1);
  }

  // limit
  const lim = mods.find((m: any) => m?.__type === 'limit');
  if (lim?.n) rows = rows.slice(0, lim.n);

  return new MockQuerySnap(rows);
});

// ---------- Realtime ----------
export const onSnapshot = vi.fn((refOrQuery: any, cb: Function) => {
  if (refOrQuery.__type === 'doc') {
    const path = refOrQuery.path;
    addListener(path, () => cb(new MockDocSnap(path, store.get(path) ?? null)));
    // initial
    cb(new MockDocSnap(path, store.get(path) ?? null));
    return () => removeListener(path, cb as any);
  }

  // query or collection onSnapshot
  const basePath = refOrQuery.__type === 'query' ? refOrQuery.source.path : refOrQuery.path;
  const handler = () => getDocs(refOrQuery).then((snap) => cb(snap));

  // subscribe to all docs under the path (naive)
  const paths = entriesUnder(basePath).map(([p]) => p);
  for (const p of paths) addListener(p, handler);
  // also keep a wildcard handler for future docs under the path
  addListener(basePath, handler);

  // initial fire
  handler();

  return () => {
    for (const p of paths) removeListener(p, handler);
    removeListener(basePath, handler);
  };
});

// ---------- Transactions & Batch ----------
export const runTransaction = vi.fn(async (_db: any, updater: Function) => {
  const tx = {
    get: async (ref: any) => getDoc(ref),
    set: async (ref: any, data: any) => setDoc(ref, data),
    update: async (ref: any, data: any) => updateDoc(ref, data),
    delete: async (ref: any) => deleteDoc(ref),
  };
  return updater(tx);
});

export const writeBatch = vi.fn((_db: any) => {
  const ops: (() => void | Promise<void>)[] = [];
  return {
    delete: (ref: any) => ops.push(() => store.delete(ref.path)),
    set: (ref: any, data: any, opts?: any) => ops.push(() => setDoc(ref, data, opts)),
    update: (ref: any, patch: any) => ops.push(() => updateDoc(ref, patch)),
    commit: async () => {
      for (const op of ops) await op();
      // naive notify: fire all listeners
      for (const p of new Set(store.keys())) notify(p);
    },
  };
});

// ---------- Helpers ----------
const fieldValue = (obj: any, path: string) =>
  path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);

const materialize = (obj: any) => {
  // turn serverTimestamp() placeholders into real dates
  const walk = (v: any): any => {
    if (v && v.__serverTimestamp) return now();
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: any = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  return walk(obj);
};

const entriesUnder = (prefix: string) =>
  Array.from(store.entries()).filter(([p]) => p.startsWith(prefix + '/'));

const notify = (path: string) => {
  listeners.get(path)?.forEach((cb) => cb(new MockDocSnap(path, store.get(path) ?? null)));
  // also notify parent collection "base" listeners
  const parent = path.split('/').slice(0, -1).join('/');
  listeners.get(parent)?.forEach((cb) => cb(new MockDocSnap(path, store.get(path) ?? null)));
};

const addListener = (path: string, cb: Listener) => {
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path)!.add(cb);
};

const removeListener = (path: string, cb: Listener) => {
  listeners.get(path)?.delete(cb);
};

// ---------- test helpers ----------
export const __resetFirestore = () => {
  store.clear();
  listeners.clear();
  idCounter = 1;
};

export const __setDoc = (path: string, data: any) => {
  store.set(path, materialize(data));
  notify(path);
};
