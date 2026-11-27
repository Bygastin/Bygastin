// Cuentas Claras: la lógica pura (sin pantalla). Se puede probar con Node.
// Los montos se guardan siempre en centavos (enteros) para no perder plata por redondeo.
(function (root) {
  'use strict';

  const CURRENCIES = ['ARS', 'USD', 'EUR', 'UYU', 'CLP', 'BRL', 'MXN', 'COP', 'PEN'];
  const LIMITS = { name: 40, desc: 60, members: 30, items: 3000, amount: 1e12 };

  function uid() {
    const a = new Uint32Array(2);
    (root.crypto || require('crypto').webcrypto).getRandomValues(a);
    return (a[0].toString(36) + a[1].toString(36)).slice(0, 12).padEnd(8, '0');
  }

  // "1.234,56" · "1234.5" · "1.500" (miles) · "$ 2000" → centavos, o null si no es válido
  function parseAmount(text) {
    let s = String(text == null ? '' : text).replace(/[\s$€]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const cents = Math.round(parseFloat(s) * 100);
    return cents > 0 && cents <= LIMITS.amount ? cents : null;
  }

  const alive = list => list.filter(x => !x.x);

  // Reparte "a" centavos entre "ids" sin perder ni un centavo: el resto va a los primeros.
  function splitCents(a, ids) {
    const base = Math.floor(a / ids.length), rest = a - base * ids.length;
    return ids.map((id, i) => [id, base + (i < rest ? 1 : 0)]);
  }

  // Saldo de cada uno: positivo = le deben, negativo = debe.
  function balances(group) {
    const order = group.members.map(m => m.id);
    const bal = {};
    for (const m of group.members) bal[m.id] = 0;
    for (const it of alive(group.items)) {
      if (!(it.by in bal)) continue;
      const to = order.filter(id => it.to.includes(id));
      if (!to.length) continue;
      bal[it.by] += it.a;
      for (const [id, part] of splitCents(it.a, to)) bal[id] -= part;
    }
    return bal;
  }

  // Lo que consumió cada uno (sin contar los pagos entre ellos).
  function spentBy(group) {
    const order = group.members.map(m => m.id);
    const out = {};
    for (const m of group.members) out[m.id] = 0;
    for (const it of alive(group.items)) {
      if (it.t !== 'g') continue;
      const to = order.filter(id => it.to.includes(id));
      if (!to.length) continue;
      for (const [id, part] of splitCents(it.a, to)) out[id] += part;
    }
    return out;
  }

  // Quién le paga a quién, con pocas transferencias: el que más debe le paga al que más le deben.
  function settle(bal) {
    const debt = [], cred = [];
    for (const [id, v] of Object.entries(bal)) {
      if (v < 0) debt.push({ id, v: -v });
      else if (v > 0) cred.push({ id, v });
    }
    const byV = (x, y) => y.v - x.v || (x.id < y.id ? -1 : 1);
    const out = [];
    while (debt.length && cred.length) {
      debt.sort(byV); cred.sort(byV);
      const d = debt[0], c = cred[0], a = Math.min(d.v, c.v);
      out.push({ from: d.id, to: c.id, a });
      d.v -= a; c.v -= a;
      if (!d.v) debt.shift();
      if (!c.v) cred.shift();
    }
    return out;
  }

  // Combina dos copias del mismo grupo. Nunca se pierde nada: se juntan todos los
  // gastos y, si uno se editó en los dos celus, gana la versión más nueva.
  function merge(local, incoming) {
    if (!local) return { group: clone(incoming), added: alive(incoming.items).length, updated: 0 };
    const g = clone(local);
    if (incoming.u > g.u) { g.name = incoming.name; g.cur = incoming.cur; g.u = incoming.u; }
    const mergeList = (mine, theirs, count) => {
      const map = new Map(mine.map(x => [x.id, x]));
      for (const t of theirs) {
        const m = map.get(t.id);
        if (!m) { map.set(t.id, clone(t)); if (count && !t.x) count.added++; }
        else if (t.u > m.u) { map.set(t.id, clone(t)); if (count) count.updated++; }
      }
      return [...map.values()];
    };
    const count = { added: 0, updated: 0 };
    g.members = mergeList(g.members, incoming.members);
    g.items = mergeList(g.items, incoming.items, count);
    return { group: g, added: count.added, updated: count.updated };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Valida un grupo que llega de afuera (un link). Devuelve el grupo limpio o tira un error.
  function validateGroup(raw) {
    const fail = msg => { throw new Error(msg); };
    const isId = v => typeof v === 'string' && /^[a-z0-9]{4,16}$/.test(v);
    const isTime = v => Number.isInteger(v) && v >= 0 && v < 9e15;
    const text = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : fail('texto inválido');
    if (!raw || typeof raw !== 'object') fail('datos vacíos');
    if (!isId(raw.id)) fail('id de grupo inválido');
    if (!Array.isArray(raw.members) || raw.members.length > LIMITS.members) fail('integrantes inválidos');
    if (!Array.isArray(raw.items) || raw.items.length > LIMITS.items) fail('gastos inválidos');
    const members = raw.members.map(m => {
      if (!m || !isId(m.id) || !isTime(m.u)) fail('integrante inválido');
      const n = text(m.n, 24);
      if (!n) fail('integrante sin nombre');
      return { id: m.id, n, u: m.u, ...(m.x ? { x: 1 } : {}) };
    });
    const ids = new Set(members.map(m => m.id));
    if (ids.size !== members.length) fail('integrantes repetidos');
    const seen = new Set();
    const items = raw.items.map(it => {
      if (!it || !isId(it.id) || seen.has(it.id)) fail('gasto inválido');
      seen.add(it.id);
      if (it.t !== 'g' && it.t !== 'p') fail('tipo de gasto inválido');
      if (!Number.isInteger(it.a) || it.a <= 0 || it.a > LIMITS.amount) fail('monto inválido');
      if (!ids.has(it.by)) fail('pagador desconocido');
      if (!Array.isArray(it.to) || !it.to.length || !it.to.every(id => ids.has(id))) fail('reparto inválido');
      if (!isTime(it.at) || !isTime(it.u)) fail('fecha inválida');
      return { id: it.id, t: it.t, d: text(it.d || '', LIMITS.desc), a: it.a, by: it.by,
        to: [...new Set(it.to)], at: it.at, u: it.u, ...(it.x ? { x: 1 } : {}) };
    });
    const name = text(raw.name, LIMITS.name) || 'Grupo';
    const cur = CURRENCIES.includes(raw.cur) ? raw.cur : 'ARS';
    if (!isTime(raw.u)) fail('fecha de grupo inválida');
    return { id: raw.id, name, cur, members, items, u: raw.u };
  }

  // ---- Link para compartir: JSON comprimido en base64url dentro del #hash ----
  // El hash nunca viaja al servidor: los datos van solo de celu a celu.
  const b64u = {
    enc(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec(str) {
      const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    }
  };

  async function pipe(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }

  async function encodeGroup(group) {
    const json = new TextEncoder().encode(JSON.stringify(group));
    if (typeof CompressionStream === 'function') {
      return 'z' + b64u.enc(await pipe(json, new CompressionStream('deflate-raw')));
    }
    return 'j' + b64u.enc(json);
  }

  async function decodeGroup(code) {
    if (typeof code !== 'string' || code.length < 2 || code.length > 200000) throw new Error('link inválido');
    let bytes = b64u.dec(code.slice(1));
    if (code[0] === 'z') {
      if (typeof DecompressionStream !== 'function') throw new Error('este navegador no puede abrir el link');
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (code[0] !== 'j') throw new Error('link inválido');
    if (bytes.length > 2000000) throw new Error('link demasiado grande');
    return validateGroup(JSON.parse(new TextDecoder().decode(bytes)));
  }

  // Saca el código de un link pegado (o del #hash actual).
  function codeFromLink(text) {
    const m = String(text || '').match(/[#&]g=([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  const api = { CURRENCIES, LIMITS, uid, parseAmount, splitCents, balances, spentBy, settle, merge,
    validateGroup, encodeGroup, decodeGroup, codeFromLink, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = api;
})(typeof window !== 'undefined' ? window : globalThis);
