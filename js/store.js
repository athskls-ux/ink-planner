// Local storage in IndexedDB: one record per planner page, plus the personal word list.
const DB_NAME = "ink-planner";
let dbPromise;

function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("pages", { keyPath: "key" });
      req.result.createObjectStore("words", { keyPath: "word" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const getPage = key => run("pages", "readonly", s => s.get(key));
export const putPage = page => run("pages", "readwrite", s => s.put({ ...page, updated: Date.now() }));
export const allPages = () => run("pages", "readonly", s => s.getAll());

export const allWords = () => run("words", "readonly", s => s.getAll());
export const putWord = entry => run("words", "readwrite", s => s.put(entry));

// Backup: everything in one JSON file, so nothing is locked in this browser.
export async function exportAll() {
  return { app: "ink-planner", version: 1, exported: new Date().toISOString(), pages: await allPages(), words: await allWords() };
}
export async function importAll(data) {
  if (data?.app !== "ink-planner") throw new Error("Not an ink-planner backup");
  for (const p of data.pages || []) await run("pages", "readwrite", s => s.put(p));
  for (const w of data.words || []) await putWord(w);
}
