const counters = new Map();
const startedAt = Date.now();

function inc(name, value=1) {
  counters.set(name, (counters.get(name) || 0) + value);
}

function snapshot() {
  const out = {};
  for (const [k,v] of counters) out[k] = v;
  return {
    version: "4.3.0",
    uptimeSeconds: Math.floor((Date.now()-startedAt)/1000),
    counters: out
  };
}

module.exports = { inc, snapshot };
