// Cuentas Claras: la pantalla. Todo se arma con nodos del DOM (nada de innerHTML).
(function () {
  'use strict';
  const CC = window.CC;
  const KEY = 'cuentas-claras-v1';
  const $ = id => document.getElementById(id);

  // ---------- Guardado local ----------
  let db = load();
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && raw.groups && typeof raw.groups === 'object') {
        const groups = {};
        for (const g of Object.values(raw.groups)) {
          try { const ok = CC.validateGroup(g); groups[ok.id] = ok; } catch (e) { /* se descarta lo roto */ }
        }
        return { groups, last: raw.last && typeof raw.last === 'object' ? raw.last : {} };
      }
    } catch (e) {}
    return { groups: {}, last: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('No se pudo guardar en este navegador'); } }

  // ---------- Utilidades ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
    return el;
  }
  const fmtCache = {};
  function money(cents, cur) {
    const f = fmtCache[cur] || (fmtCache[cur] = new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur }));
    return f.format(cents / 100);
  }
  const toInput = cents => (cents / 100).toLocaleString('es-AR', { maximumFractionDigits: 2, useGrouping: false });
  const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function dayLabel(ms) {
    const k = dayKey(ms), today = dayKey(Date.now()), yest = dayKey(Date.now() - 864e5);
    if (k === today) return 'Hoy';
    if (k === yest) return 'Ayer';
    return new Date(ms).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const fromDayKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };
  const stamp = (() => { let last = 0; return () => (last = Math.max(Date.now(), last + 1)); })();

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- Estado de navegación ----------
  const st = { gid: null, tab: 'gastos' };
  const group = () => db.groups[st.gid];
  const members = g => g.members.filter(m => !m.x);
  const nameOf = (g, id) => (g.members.find(m => m.id === id) || { n: '¿?' }).n;

  function go(gid, tab) {
    st.gid = gid; st.tab = tab || 'gastos';
    history.pushState({ gid, tab: st.tab }, '');
    render();
  }
  window.addEventListener('popstate', e => {
    if (!$('sheet-wrap').classList.contains('hidden')) { hideSheet(); if (e.state && e.state.sheet) return; }
    const s = e.state || {};
    st.gid = s.gid && db.groups[s.gid] ? s.gid : null;
    st.tab = s.tab || 'gastos';
    render();
  });

  // ---------- Hoja inferior (formularios) ----------
  function openSheet(title, body) {
    $('sheet-title').textContent = title;
    $('sheet-body').replaceChildren(body);
    $('sheet-wrap').classList.remove('hidden');
    history.pushState({ ...(history.state || {}), sheet: true }, '');
    const first = body.querySelector('input:not([type=checkbox]):not([type=radio]),select');
    if (first && !matchMedia('(pointer:coarse)').matches) setTimeout(() => first.focus(), 50);
  }
  function hideSheet() { $('sheet-wrap').classList.add('hidden'); $('sheet-body').replaceChildren(); }
  function closeSheet() { if (history.state && history.state.sheet) history.back(); else hideSheet(); }
  $('sheet-wrap').addEventListener('click', e => { if (e.target === $('sheet-wrap')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('sheet-wrap').classList.contains('hidden')) closeSheet(); });

  // ---------- Render principal ----------
  $('back').onclick = () => history.back();
  $('menu').onclick = () => editGroup(group());
  $('fab').onclick = () => editItem(group(), null);
  for (const b of $('tabs').querySelectorAll('button')) {
    b.onclick = () => { st.tab = b.dataset.tab; history.replaceState({ gid: st.gid, tab: st.tab }, ''); render(); };
  }

  function render() {
    const g = group();
    if (st.gid && !g) st.gid = null;
    $('back').classList.toggle('hidden', !g);
    $('menu').classList.toggle('hidden', !g);
    $('tabs').classList.toggle('hidden', !g);
    $('fab').classList.toggle('hidden', !g || st.tab !== 'gastos');
    $('title').textContent = g ? g.name : 'Cuentas Claras';
    document.title = g ? g.name + ' · Cuentas Claras' : 'Cuentas Claras';
    for (const b of $('tabs').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.tab === st.tab));
    const view = !g ? homeView() : st.tab === 'saldos' ? balanceView(g) : st.tab === 'compartir' ? shareView(g) : itemsView(g);
    $('view').replaceChildren(view);
    window.scrollTo(0, 0);
  }

  // ---------- Inicio ----------
  function homeView() {
    const list = Object.values(db.groups).sort((a, b) => lastActivity(b) - lastActivity(a));
    return h('div', { class: 'stack' },
      list.length ? null : h('section', { class: 'hero' },
        h('div', { class: 'hero-emoji', text: '🧾' }),
        h('h2', { text: 'Gastos compartidos, sin cuentas' }),
        h('p', { text: 'Anotá quién pagó qué en el viaje, la casa o la salida. Al final te digo quién le paga a quién, con la menor cantidad de transferencias.' }),
        h('p', { class: 'muted', text: 'No hace falta registrarse: el grupo se comparte con un link o un QR, y todo queda en tu celu.' })),
      list.map(g => {
        const total = CC.spentBy(g), sum = Object.values(total).reduce((s, v) => s + v, 0);
        return h('button', { class: 'card group-card', onclick: () => go(g.id) },
          h('div', { class: 'gc-name', text: g.name }),
          h('div', { class: 'muted', text: members(g).map(m => m.n).join(', ') }),
          h('div', { class: 'gc-total', text: money(sum, g.cur) }));
      }),
      h('button', { class: 'btn primary', onclick: () => newGroup() }, '＋ Nuevo grupo'),
      h('button', { class: 'btn', onclick: () => joinByLink() }, '🔗 Unirme con un link'),
      list.length ? null : h('button', { class: 'btn ghost', onclick: demo }, '✨ Probar con un ejemplo'),
      h('p', { class: 'foot muted' }, 'Hecho por ', h('a', { href: '../../', text: 'Gastón' }), ' · funciona sin internet y se instala como app'));
  }
  const lastActivity = g => Math.max(g.u, ...g.items.map(i => i.u));

  function newGroup() {
    const name = h('input', { maxLength: 40, placeholder: 'Ej: Viaje a Bariloche', required: true });
    const cur = h('select', {}, CC.CURRENCIES.map(c => h('option', { value: c, text: c })));
    const rows = h('div', { class: 'stack sm' });
    const addRow = (val = '') => {
      const inp = h('input', { maxLength: 24, placeholder: 'Nombre', value: val });
      const row = h('div', { class: 'row' }, inp, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Quitar', onclick: () => row.remove() }, '✕'));
      rows.append(row); return inp;
    };
    addRow(); addRow();
    const form = h('form', { class: 'stack', onsubmit: e => {
      e.preventDefault();
      const names = [...new Set([...rows.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean))];
      if (!name.value.trim()) return toast('Ponele un nombre al grupo');
      if (names.length < 2) return toast('Hacen falta al menos dos personas');
      const u = stamp();
      const g = { id: CC.uid(), name: name.value.trim().slice(0, 40), cur: cur.value, u,
        members: names.slice(0, CC.LIMITS.members).map(n => ({ id: CC.uid(), n: n.slice(0, 24), u })), items: [] };
      db.groups[g.id] = g; save();
      hideSheet(); history.replaceState({ gid: g.id, tab: 'gastos' }, '');
      st.gid = g.id; st.tab = 'gastos'; render();
    } },
      h('label', {}, 'Nombre del grupo', name),
      h('label', {}, 'Moneda', cur),
      h('div', { class: 'label' }, '¿Quiénes son?'), rows,
      h('button', { type: 'button', class: 'btn ghost', onclick: () => addRow().focus() }, '＋ Agregar persona'),
      h('button', { class: 'btn primary', type: 'submit' }, 'Crear grupo'));
    openSheet('Nuevo grupo', form);
  }

  function demo() {
    const u = stamp(), day = 864e5, t0 = Date.now() - 3 * day;
    const ids = ['Gastón', 'Lu', 'Nico', 'Sofi'].map(n => ({ id: CC.uid(), n, u }));
    const [a, b, c, d] = ids.map(m => m.id), all = [a, b, c, d];
    const it = (dsc, amount, by, to, at) => ({ id: CC.uid(), t: 'g', d: dsc, a: amount * 100, by, to, at, u });
    const g = { id: CC.uid(), name: 'Viaje a Bariloche', cur: 'ARS', u, members: ids, items: [
      it('Nafta', 68000, a, all, t0), it('Cabaña (2 noches)', 240000, b, all, t0 + 3600e3),
      it('Súper', 51300, c, all, t0 + day), it('Chocolates', 18500, d, [b, d], t0 + day + 7200e3),
      it('Cerro Catedral', 96000, a, [a, b, c], t0 + 2 * day), it('Cena de cordero', 87200, c, all, t0 + 2 * day + 9e6)] };
    db.groups[g.id] = g; save(); go(g.id);
  }

  function joinByLink() {
    const inp = h('input', { placeholder: 'Pegá acá el link que te pasaron', autocomplete: 'off' });
    const form = h('form', { class: 'stack', onsubmit: e => {
      e.preventDefault();
      const code = CC.codeFromLink(inp.value);
      if (!code) return toast('Ese link no tiene un grupo adentro');
      hideSheet(); history.replaceState({ gid: st.gid, tab: st.tab }, '');
      importCode(code);
    } },
      h('p', { class: 'muted', text: 'Si te mandaron el link por WhatsApp, también podés tocarlo directo. Con el QR, alcanza con apuntarle con la cámara.' }),
      inp, h('button', { class: 'btn primary', type: 'submit' }, 'Abrir grupo'));
    openSheet('Unirme con un link', form);
  }

  // ---------- Gastos ----------
  function itemsView(g) {
    const items = g.items.filter(i => !i.x).sort((x, y) => y.at - x.at || y.u - x.u);
    const spent = CC.spentBy(g), total = Object.values(spent).reduce((s, v) => s + v, 0);
    if (!items.length) return h('div', { class: 'stack' },
      h('section', { class: 'empty' }, h('div', { class: 'hero-emoji', text: '🪙' }),
        h('p', { text: 'Todavía no hay gastos. Tocá “＋ Gasto” para anotar el primero.' })));
    const out = h('div', { class: 'stack' },
      h('div', { class: 'summary' },
        h('div', {}, h('div', { class: 'muted small', text: 'Gastaron entre todos' }), h('div', { class: 'big', text: money(total, g.cur) })),
        h('div', { class: 'right' }, h('div', { class: 'muted small', text: 'Por persona' }), h('div', { class: 'mid', text: money(Math.round(total / Math.max(1, members(g).length)), g.cur) }))));
    let lastDay = null, box = null;
    for (const it of items) {
      const k = dayKey(it.at);
      if (k !== lastDay) { lastDay = k; out.append(h('div', { class: 'day', text: dayLabel(it.at) })); box = h('div', { class: 'card list' }); out.append(box); }
      const pay = it.t === 'p';
      const who = pay ? nameOf(g, it.by) + ' le pagó a ' + nameOf(g, it.to[0])
        : 'Pagó ' + nameOf(g, it.by) + (it.to.length === members(g).length ? ' · entre todos' : ' · entre ' + it.to.map(id => nameOf(g, id)).join(', '));
      box.append(h('button', { class: 'item' + (pay ? ' pay' : ''), onclick: () => editItem(g, it) },
        h('span', { class: 'ico', text: pay ? '🤝' : emojiFor(it.d) }),
        h('span', { class: 'grow' }, h('span', { class: 'idesc', text: pay ? 'Pago' : it.d || 'Gasto' }), h('span', { class: 'muted small', text: who })),
        h('span', { class: 'amt', text: money(it.a, g.cur) })));
    }
    return out;
  }

  const EMOJI = [[/nafta|combus|gasolin|peaje|auto|uber|taxi|remis|colectivo|bondi/i, '🚗'], [/super|mercado|almac|verdu/i, '🛒'],
    [/cena|almuerzo|comida|resto|pizza|asado|parrill|cordero|hambur|empanad/i, '🍽️'], [/caf[eé]|desayuno|medialuna/i, '☕'],
    [/birra|cerveza|vino|fernet|trago|bar\b|boliche/i, '🍻'], [/caba[ñn]a|hotel|hostel|airbnb|alquiler|depto/i, '🏠'],
    [/luz|gas\b|agua|internet|wifi|expensa/i, '💡'], [/entrada|cine|recital|teatro|cerro|excurs|tour/i, '🎟️'],
    [/vuelo|avi[oó]n|pasaje|micro/i, '✈️'], [/regalo/i, '🎁'], [/chocolate|helado|postre/i, '🍫']];
  const plain = d => String(d || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const emojiFor = d => (EMOJI.find(([re]) => re.test(plain(d))) || [0, '🧾'])[1];

  function chips(g, type, selected, name) {
    return h('div', { class: 'chips' }, members(g).map(m => h('label', { class: 'chip' },
      h('input', { type, name, value: m.id, checked: selected.includes(m.id) }), h('span', { text: m.n }))));
  }

  function editItem(g, it) {
    const isPay = it && it.t === 'p';
    const ms = members(g);
    const defBy = it ? it.by : (db.last[g.id] && ms.some(m => m.id === db.last[g.id]) ? db.last[g.id] : ms[0].id);
    const desc = h('input', { maxLength: CC.LIMITS.desc, placeholder: 'Ej: Súper, nafta, cena…', value: it ? it.d : '' });
    const amount = h('input', { inputMode: 'decimal', placeholder: '0,00', value: it ? toInput(it.a) : '', autocomplete: 'off', class: 'amount-input' });
    const date = h('input', { type: 'date', value: dayKey(it ? it.at : Date.now()) });
    const by = chips(g, 'radio', [defBy], 'by');
    const to = isPay ? chips(g, 'radio', it.to, 'to') : chips(g, 'checkbox', it ? it.to : ms.map(m => m.id), 'to');
    const preview = h('p', { class: 'muted small preview' });
    const upd = () => {
      const a = CC.parseAmount(amount.value), n = to.querySelectorAll('input:checked').length;
      preview.textContent = a && n ? (isPay ? '' : 'Le toca ' + money(Math.floor(a / n), g.cur) + ' a cada uno') : '';
    };
    amount.addEventListener('input', upd); to.addEventListener('change', upd); upd();

    const form = h('form', { class: 'stack', onsubmit: e => {
      e.preventDefault();
      const a = CC.parseAmount(amount.value);
      if (!a) return toast('Revisá el monto');
      const payer = (by.querySelector('input:checked') || {}).value;
      const benef = [...to.querySelectorAll('input:checked')].map(i => i.value);
      if (!payer) return toast('Elegí quién pagó');
      if (!benef.length) return toast('Elegí entre quiénes se reparte');
      if (isPay && (benef.length !== 1 || benef[0] === payer)) return toast('Un pago va de una persona a otra');
      const at = date.value ? fromDayKey(date.value) : Date.now();
      const keepTime = it && dayKey(it.at) === date.value ? it.at : at;
      const rec = { id: it ? it.id : CC.uid(), t: isPay ? 'p' : 'g', d: desc.value.trim().slice(0, CC.LIMITS.desc),
        a, by: payer, to: benef, at: it ? keepTime : (date.value === dayKey(Date.now()) ? Date.now() : at), u: stamp() };
      g.items = g.items.filter(x => x.id !== rec.id).concat(rec);
      db.last[g.id] = payer; save(); closeSheet(); render();
      toast(it ? 'Cambios guardados' : 'Gasto anotado');
    } },
      isPay ? null : h('label', {}, 'Qué fue', desc),
      h('label', {}, 'Monto (' + g.cur + ')', amount),
      h('div', { class: 'label', text: isPay ? 'Quién pagó' : '¿Quién pagó?' }), by,
      h('div', { class: 'label' }, isPay ? 'A quién' : '¿Entre quiénes se reparte?',
        isPay ? null : h('button', { type: 'button', class: 'link', onclick: () => {
          const boxes = [...to.querySelectorAll('input')], allOn = boxes.every(b => b.checked);
          boxes.forEach(b => { b.checked = !allOn; }); upd();
        } }, 'todos / nadie')),
      to,
      preview,
      h('label', {}, 'Fecha', date),
      h('div', { class: 'row' },
        it ? h('button', { type: 'button', class: 'btn danger', onclick: () => {
          if (!confirm('¿Borrar este ' + (isPay ? 'pago' : 'gasto') + '?')) return;
          it.x = 1; it.u = stamp(); save(); closeSheet(); render(); toast('Borrado');
        } }, 'Borrar') : null,
        h('button', { class: 'btn primary grow', type: 'submit' }, it ? 'Guardar' : 'Anotar gasto')));
    openSheet(it ? (isPay ? 'Editar pago' : 'Editar gasto') : 'Nuevo gasto', form);
  }

  // ---------- Saldos ----------
  function balanceView(g) {
    const bal = CC.balances(g), spent = CC.spentBy(g), plan = CC.settle(bal);
    const ms = g.members.filter(m => !m.x || bal[m.id]);
    const max = Math.max(1, ...ms.map(m => Math.abs(bal[m.id] || 0)));
    return h('div', { class: 'stack' },
      h('div', { class: 'card' }, ms.map(m => {
        const v = bal[m.id] || 0, w = Math.round(Math.abs(v) / max * 50);
        return h('div', { class: 'bal' },
          h('div', { class: 'bal-top' }, h('span', { class: 'bname', text: m.n }),
            h('span', { class: v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted', text: v > 0 ? 'le deben ' + money(v, g.cur) : v < 0 ? 'debe ' + money(-v, g.cur) : 'a mano' })),
          h('div', { class: 'track' }, h('i', { class: v >= 0 ? 'pos' : 'neg', style: v >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%` })),
          h('div', { class: 'muted small', text: 'Consumió ' + money(spent[m.id] || 0, g.cur) }));
      })),
      h('h3', { text: 'Para quedar a mano' }),
      plan.length ? h('div', { class: 'card list' }, plan.map(p => h('div', { class: 'item settle' },
        h('span', { class: 'grow' }, h('b', { text: nameOf(g, p.from) }), ' le paga a ', h('b', { text: nameOf(g, p.to) })),
        h('span', { class: 'amt', text: money(p.a, g.cur) }),
        h('button', { class: 'btn sm', onclick: () => {
          if (!confirm(`¿Registrar que ${nameOf(g, p.from)} le pagó ${money(p.a, g.cur)} a ${nameOf(g, p.to)}?`)) return;
          g.items.push({ id: CC.uid(), t: 'p', d: '', a: p.a, by: p.from, to: [p.to], at: Date.now(), u: stamp() });
          save(); render(); toast('Pago registrado 🤝');
        } }, 'Ya pagó'))))
        : h('div', { class: 'card empty' }, h('div', { class: 'hero-emoji', text: '🎉' }), h('p', { text: 'Están todos a mano.' })),
      plan.length ? h('button', { class: 'btn', onclick: () => shareText(g, plan) }, '💬 Mandar resumen por WhatsApp') : null,
      h('p', { class: 'muted small', text: 'Calculamos la menor cantidad de transferencias para que nadie quede debiendo.' }));
  }

  function shareText(g, plan) {
    const lines = ['🧾 ' + g.name + ' — para quedar a mano:', ...plan.map(p => `• ${nameOf(g, p.from)} → ${nameOf(g, p.to)}: ${money(p.a, g.cur)}`)];
    const text = lines.join('\n');
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
  }

  // ---------- Compartir ----------
  function shareUrl(code) { return location.origin + location.pathname + '#g=' + code; }

  function shareView(g) {
    const canvas = h('canvas', { class: 'qr', width: 10, height: 10, 'aria-label': 'Código QR del grupo' });
    const status = h('p', { class: 'muted small center', text: 'Armando el código…' });
    const copy = h('button', { class: 'btn primary', disabled: true }, '📋 Copiar link');
    const send = h('button', { class: 'btn', disabled: true }, '📤 Compartir');
    CC.encodeGroup(g).then(code => {
      const url = shareUrl(code);
      copy.disabled = send.disabled = false;
      copy.onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
        .then(() => toast('Link copiado'), () => prompt('Copiá este link:', url));
      send.onclick = () => navigator.share ? navigator.share({ title: g.name, text: 'Sumate a "' + g.name + '" en Cuentas Claras', url }).catch(() => {}) : copy.onclick();
      try { drawQR(canvas, url); status.textContent = g.items.length + (g.items.length === 1 ? ' movimiento · ' : ' movimientos · ') + Math.round(url.length / 100) / 10 + ' KB'; }
      catch (e) { canvas.classList.add('hidden'); status.textContent = 'Hay demasiados gastos para que entren en un QR. Usá el link: funciona igual.'; }
    }).catch(() => { status.textContent = 'No se pudo armar el link en este navegador.'; });
    return h('div', { class: 'stack' },
      h('div', { class: 'card center' }, canvas, status),
      copy, send,
      h('div', { class: 'card how' },
        h('h3', { text: '¿Cómo funciona?' }),
        h('ol', {},
          h('li', { text: 'El otro escanea el QR con la cámara o abre el link.' }),
          h('li', { text: 'Se le abre el grupo con todos los gastos, sin crear cuenta.' }),
          h('li', { text: 'Cuando alguien anota gastos nuevos, vuelve a compartir: los gastos se combinan, no se pisan.' })),
        h('p', { class: 'muted small', text: 'Los datos viajan dentro del link y se guardan solo en los celus. No pasan por ningún servidor.' })));
  }

  function drawQR(canvas, text) {
    const qr = window.qrcode(0, 'L');
    qr.addData(text, 'Byte'); qr.make();
    const n = qr.getModuleCount(), quiet = 4, size = n + quiet * 2;
    const scale = Math.max(2, Math.floor(560 / size));
    canvas.width = canvas.height = size * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b2b22';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
  }

  // ---------- Editar grupo ----------
  function editGroup(g) {
    const name = h('input', { maxLength: 40, value: g.name });
    const cur = h('select', {}, CC.CURRENCIES.map(c => h('option', { value: c, text: c, selected: c === g.cur })));
    const used = new Set(g.items.filter(i => !i.x).flatMap(i => [i.by, ...i.to]));
    const rows = h('div', { class: 'stack sm' });
    const draft = members(g).map(m => ({ ...m }));
    const drawRows = () => rows.replaceChildren(...draft.filter(m => !m.gone).map(m => {
      const inp = h('input', { maxLength: 24, value: m.n, oninput: () => { m.n = inp.value; } });
      return h('div', { class: 'row' }, inp, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Quitar a ' + m.n, onclick: () => {
        if (used.has(m.id)) return toast(m.n + ' tiene gastos: borralos o editalos primero');
        if (m.isNew) draft.splice(draft.indexOf(m), 1); else m.gone = true;
        drawRows();
      } }, '✕'));
    }));
    drawRows();
    const form = h('form', { class: 'stack', onsubmit: e => {
      e.preventDefault();
      const alive = draft.filter(m => !m.gone && m.n.trim());
      if (alive.length < 2) return toast('Hacen falta al menos dos personas');
      if (alive.length > CC.LIMITS.members) return toast('Máximo ' + CC.LIMITS.members + ' personas');
      const u = stamp();
      if (name.value.trim() && (name.value.trim() !== g.name || cur.value !== g.cur)) { g.name = name.value.trim().slice(0, 40); g.cur = cur.value; g.u = u; }
      for (const d of draft) {
        const n = d.n.trim().slice(0, 24);
        const m = g.members.find(x => x.id === d.id);
        if (d.isNew) { if (n) g.members.push({ id: d.id, n, u }); }
        else if (d.gone || !n) { if (!used.has(m.id)) { m.x = 1; m.u = u; } }
        else if (n !== m.n) { m.n = n; m.u = u; }
      }
      save(); closeSheet(); render(); toast('Grupo actualizado');
    } },
      h('label', {}, 'Nombre del grupo', name),
      h('label', {}, 'Moneda', cur),
      h('div', { class: 'label', text: 'Personas' }), rows,
      h('button', { type: 'button', class: 'btn ghost', onclick: () => {
        draft.push({ id: CC.uid(), n: '', u: 0, isNew: true }); drawRows();
        const ins = rows.querySelectorAll('input'); ins[ins.length - 1].focus();
      } }, '＋ Agregar persona'),
      h('button', { class: 'btn primary', type: 'submit' }, 'Guardar'),
      h('button', { type: 'button', class: 'btn danger', onclick: () => {
        if (!confirm('¿Borrar "' + g.name + '" de este celu? A los demás no se les borra.')) return;
        delete db.groups[g.id]; delete db.last[g.id]; save();
        hideSheet(); st.gid = null; history.replaceState({}, ''); render();
      } }, 'Borrar grupo de este celu'));
    openSheet('Editar grupo', form);
  }

  // ---------- Abrir un link con un grupo ----------
  async function importCode(code) {
    let inc;
    try { inc = await CC.decodeGroup(code); }
    catch (e) { toast(e instanceof SyntaxError || /fetch|data|deflate|decod/i.test(e.message) ? 'El link está incompleto o dañado' : 'No se pudo abrir el link: ' + e.message); return; }
    const local = db.groups[inc.id];
    const r = CC.merge(local, inc);
    let check;
    try { check = CC.validateGroup(r.group); } catch (e) { toast('El link trae datos que no cierran'); return; }
    db.groups[check.id] = check; save();
    st.gid = check.id; st.tab = 'gastos';
    history.replaceState({}, '', location.pathname + location.search);
    history.pushState({ gid: check.id, tab: 'gastos' }, '');
    render();
    toast(!local ? 'Te sumaste a "' + check.name + '"'
      : r.added || r.updated ? 'Se combinaron: ' + r.added + (r.added === 1 ? ' nuevo' : ' nuevos') + (r.updated ? ', ' + r.updated + (r.updated === 1 ? ' actualizado' : ' actualizados') : '')
      : 'Ya tenías todo al día');
  }

  // ---------- Arranque ----------
  history.replaceState({}, '', location.href);
  render();
  const code = CC.codeFromLink(location.hash);
  if (code) importCode(code);
  window.addEventListener('hashchange', () => { const c = CC.codeFromLink(location.hash); if (c) importCode(c); });
  window.addEventListener('storage', e => { if (e.key === KEY) { db = load(); render(); } });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
