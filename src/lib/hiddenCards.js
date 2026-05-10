const KEY = 'dealsifter.hiddenCardIds';
let subs = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(arr);
  } catch (e) { void e; return new Set(); }
}

function write(set) {
  try {
    const arr = Array.from(set);
    localStorage.setItem(KEY, JSON.stringify(arr));
    subs.forEach((cb) => cb(new Set(arr)));
  } catch (e) { void e; }
}

export function getHiddenSet() {
  return read();
}

export function toggleHidden(id) {
  const s = read();
  const key = String(id);
  if (s.has(key)) s.delete(key);
  else s.add(key);
  write(s);
  return s;
}

export function addHidden(id) {
  const s = read(); s.add(String(id)); write(s); return s;
}

export function removeHidden(id) {
  const s = read(); s.delete(String(id)); write(s); return s;
}

export function subscribe(cb) {
  subs.add(cb);
  // send current
  cb(read());
  return () => subs.delete(cb);
}
