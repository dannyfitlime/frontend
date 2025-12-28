export async function fetchJSON(url, opts={}) {
  const r = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
