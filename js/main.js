'use strict';
(() => {
  /* ============================================================
     SEGURIDAD
     - Nada se inserta con innerHTML: todo se arma con nodos y
       textContent, así ningún texto puede convertirse en código.
     - Los links y colores de los proyectos se validan antes de usarse.
     - Los datos guardados en el navegador se revisan al leerlos.
     ============================================================ */

  // Si otra página intenta mostrar el portafolio dentro de un marco
  // (clickjacking), se tapa el contenido y se ofrece abrirlo directo.
  if (window.self !== window.top) {
    document.documentElement.classList.add('framed');
    document.addEventListener('DOMContentLoaded', () => {
      const shield = h('div', { class: 'frame-shield' },
        h('p', {}, 'Esta página se ve mejor abierta directamente.'),
        h('a', { class: 'btn btn-primary', href: location.href, target: '_top', rel: 'noopener' }, 'Abrir el portafolio'));
      document.body.appendChild(shield);
    });
  }

  // Crea elementos de forma segura: los textos siempre van como texto.
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  // Solo links https o rutas dentro del propio sitio (nada de javascript:, data:, etc.)
  function safeUrl(u) {
    if (!u) return null;
    try {
      const url = new URL(u, location.href);
      if (url.protocol === 'https:' || url.origin === location.origin) return url.href;
      if (location.protocol === 'file:' && url.protocol === 'file:') return url.href; // pruebas locales
    } catch (e) {}
    return null;
  }
  const safeColor = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#2A3550');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // ====== Editá tus proyectos acá ======
  // demo y code: URL https o ruta del sitio ('' = "próximamente")
  const REPO = 'https://github.com/Bygastin/Bygastin/tree/main/demos/';
  const projects = [
    { num:'01', title:'Micelio', bg:'#1E4D3A', status:'Demo jugable', cats:['web'],
      desc:'Juego incremental en HTML: un hongo que crece, suelta esporas y se expande. Mejoras, prestigio y niveles para seguir avanzando.',
      feats:['Mejoras para crecer más rápido','Sistema de prestigio','Niveles de progreso'],
      tags:['HTML','JavaScript','Idle'], demo:'demos/micelio/', code:REPO+'micelio' },
    { num:'02', title:'APEX RUSH', bg:'#6B2A1F', status:'Demo jugable', cats:['web'],
      desc:'Juego de carreras en 3D con gráficos en HD y multijugador por red local. Cada auto tiene su propio sonido y varias skins para elegir.',
      feats:['Carreras en 3D','Sonido distinto para cada auto','Skins para personalizar','Multijugador en red local'],
      tags:['3D','Multijugador','Carreras'], demo:'demos/apex-rush/', code:REPO+'apex-rush' },
    { num:'03', title:'Strike 3D', bg:'#2A3550', status:'Demo jugable', cats:['web'],
      desc:'Shooter en primera persona hecho en HTML, de estilo táctico: modelos 3D y armas con disparo y daño.',
      feats:['Modelos 3D','Armas con disparo y daño','Se juega en el navegador','Las salas online solo funcionan dentro de Claude'],
      tags:['3D','FPS','Three.js'], demo:'demos/strike-3d/', code:REPO+'strike-3d' },
    { num:'04', title:'Polvo Estelar', bg:'#4A2F63', status:'Demo jugable', cats:['movil','web'],
      desc:'Juego incremental inactivo pensado para Android, con mecánicas propias que no vas a encontrar en otros idle. La demo se juega en el navegador.',
      feats:['Progreso mientras no jugás','Funciones únicas','Pensado para pantalla de celular'],
      tags:['Android','Idle','Móvil'], demo:'demos/polvo-estelar/', code:REPO+'polvo-estelar' },
    { num:'05', title:'El faro de Marea', bg:'#5A4A16', status:'Demo jugable', cats:['web'],
      desc:'Un juego que enseña conceptos de programación a través de una historia, para aprender sin sentir que es una clase.',
      feats:['Conceptos de programación contados como historia','Visual e interactivo'],
      tags:['Narrativa','Educativo'], demo:'demos/faro-de-marea/', code:REPO+'faro-de-marea' },
    { num:'06', title:'La Banda del Barrio', bg:'#1F4E5C', status:'Serie en curso', cats:['video'],
      desc:'Serie de videos para YouTube creada con prompts, con Toño, Camperita, Pika y Javier como protagonistas.',
      feats:['Personajes: Toño, Camperita, Pika y Javier','Historias armadas con prompts'],
      tags:['YouTube','Prompts','Historias'], demo:'', code:'' }
  ];
  const filters = [
    { id:'todos', label:'Todos' },
    { id:'web', label:'Navegador' },
    { id:'movil', label:'Android' },
    { id:'video', label:'Video' }
  ];
  const skills = [
    { area:'Juegos web', items:['HTML, CSS y JavaScript','Escenas 3D en el navegador','Sistemas incrementales'] },
    { area:'Multijugador', items:['Partidas por red local (LAN)','Sincronización de jugadores','Sonido por vehículo'] },
    { area:'Móvil', items:['Juegos para Android','Progreso inactivo','Diseño de mejoras y prestigio'] },
    { area:'Historias', items:['Guiones con prompts','Personajes propios','Narrativa educativa'] }
  ];
  const rotatorWords = ['en el navegador','en el celu','en la red de tu casa'];
  // Email partido en piezas: no aparece entero en el HTML ni en el código
  const MAIL = ['gastonroman41', 'gmail.com'];
  // =====================================

  const $ = id => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- Tema claro / oscuro ---------- */
  function paintTheme() {
    const light = document.documentElement.dataset.theme === 'light';
    // En SVG se usa el atributo (la propiedad .hidden no existe en SVG)
    $('icon-sun').toggleAttribute('hidden', light);
    $('icon-moon').toggleAttribute('hidden', !light);
    $('theme').setAttribute('aria-label', light ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  }
  $('theme').addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next; store.set('gr-theme', next);
    if (next === 'light') root.style.removeProperty('--accent-ink');
    else root.style.setProperty('--accent-ink', getComputedStyle(root).getPropertyValue('--accent'));
    paintTheme();
  });
  paintTheme();

  /* ---------- Texto que escribe solo ---------- */
  (function () {
    const el = $('rotator'); if (reduced) return;
    let w = 0, i = rotatorWords[0].length, deleting = true;
    setTimeout(function tick() {
      if (deleting) { i--; if (i <= 0) { deleting = false; w = (w + 1) % rotatorWords.length; } }
      else { i++; if (i >= rotatorWords[w].length) { deleting = true; el.textContent = rotatorWords[w]; return setTimeout(tick, 2200); } }
      el.textContent = rotatorWords[w].slice(0, Math.max(i, 0)) || ' ';
      setTimeout(tick, deleting ? 45 : 80);
    }, 2200);
  })();

  /* ---------- Proyectos: filtro, búsqueda y detalle ---------- */
  let current = 'todos', query = '';
  $('proj-count').textContent = projects.length + ' en marcha';

  const tagList = tags => h('span', { class: 'tags' }, tags.map(t => h('span', { class: 'tag' }, t)));

  function renderFilters() {
    $('filters').replaceChildren(...filters.map(f =>
      h('button', { type: 'button', class: 'pill', 'aria-pressed': String(f.id === current),
        onclick: () => { current = f.id; renderFilters(); renderProjects(); } }, f.label)));
  }

  function renderProjects() {
    const q = query.trim().toLowerCase().slice(0, 60);
    const list = projects
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => current === 'todos' || p.cats.includes(current))
      .filter(({ p }) => !q || (p.title + ' ' + p.desc + ' ' + p.tags.join(' ')).toLowerCase().includes(q));
    if (!list.length) {
      $('projects').replaceChildren(h('div', { class: 'empty' }, 'No hay proyectos que coincidan con “' + query.slice(0, 60) + '”.'));
      return;
    }
    $('projects').replaceChildren(...list.map(({ p, idx }) =>
      h('button', { type: 'button', class: 'card', 'aria-label': 'Ver detalles de ' + p.title, onclick: () => openProject(idx) },
        h('span', { class: 'thumb', style: { background: safeColor(p.bg) } },
          h('span', { class: 'num' }, p.num),
          h('span', { class: 'status' }, p.status)),
        h('span', { class: 'card-body' },
          h('span', { class: 'c-title' }, p.title),
          h('span', { class: 'c-desc' }, p.desc),
          tagList(p.tags),
          h('span', { class: 'more' }, safeUrl(p.demo) ? '▶ Ver detalles y jugar →' : 'Ver detalles →')))));
  }
  $('q').addEventListener('input', e => { query = e.target.value; renderProjects(); });

  const modal = $('modal');
  function openProject(i) {
    const p = projects[i];
    $('m-thumb').style.background = safeColor(p.bg);
    $('m-num').textContent = p.num; $('m-status').textContent = p.status;
    $('m-title').textContent = p.title; $('m-desc').textContent = p.desc;
    $('m-feats').replaceChildren(...p.feats.map(f => h('li', {}, f)));
    $('m-tags').replaceChildren(...p.tags.map(t => h('span', { class: 'tag' }, t)));
    const link = (url, label, primary) => {
      const safe = safeUrl(url);
      return safe
        ? h('a', { class: 'btn ' + (primary ? 'btn-primary' : 'btn-ghost') + ' btn-sm', href: safe, target: '_blank', rel: 'noopener noreferrer' }, label)
        : h('span', { class: 'btn btn-ghost btn-sm', style: { cursor: 'default', color: 'var(--muted)' } }, label + ': próximamente');
    };
    $('m-links').replaceChildren(link(p.demo, 'Jugar demo', true), link(p.code, 'Ver código', false));
    if (modal.showModal) modal.showModal(); else modal.setAttribute('open', '');
  }
  $('m-close').addEventListener('click', () => (modal.close ? modal.close() : modal.removeAttribute('open')));
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

  /* ---------- Mini Micelio (idle) ---------- */
  const MAX = 1e15; // tope para que nadie rompa el juego editando el guardado
  const fresh = () => ({ spores: 0, hifas: 0, dobles: 0, total: 0 });
  const clampNum = v => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), MAX) : 0);
  function loadGame() {
    const g = fresh();
    try {
      const raw = store.get('gr-micelio');
      if (!raw || raw.length > 500) return g;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const k of Object.keys(g)) g[k] = clampNum(Number(data[k])); // solo claves conocidas
      }
    } catch (e) {}
    g.hifas = Math.min(g.hifas, 500); g.dobles = Math.min(g.dobles, 500);
    return g;
  }
  let g = loadGame();
  const upgrades = [
    { id: 'hifas', name: 'Hifas', info: '+1 espora por segundo', base: 10, mult: 1.5 },
    { id: 'dobles', name: 'Esporas dobles', info: '+1 espora por toque', base: 40, mult: 2.2 }
  ];
  const cost = u => Math.floor(u.base * Math.pow(u.mult, g[u.id]));
  const perClick = () => 1 + g.dobles;
  const perSec = () => g.hifas;
  const fmt = n => Math.floor(n).toLocaleString('es-AR');
  const save = () => store.set('gr-micelio', JSON.stringify(g));

  function renderGame() {
    $('spores').textContent = fmt(g.spores);
    $('rate').textContent = `esporas · ${perClick()} por toque · ${perSec()} por segundo`;
    $('upgrades').replaceChildren(
      ...upgrades.map(u => h('div', { class: 'upgrade' },
        h('div', {},
          h('h3', {}, u.name + ' ', h('span', { class: 'mono', style: { fontSize: '13px', color: 'var(--muted)' } }, '× ' + g[u.id])),
          h('p', {}, u.info)),
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', disabled: g.spores < cost(u),
          onclick: () => { if (g.spores >= cost(u)) { g.spores -= cost(u); g[u.id]++; renderGame(); save(); } } },
          'Comprar · ' + fmt(cost(u))))),
      h('p', { class: 'rate', style: { margin: '4px 0 0' } }, 'Esporas juntadas en total: ' + fmt(g.total)));
  }
  function gain(n) {
    const before = Math.floor(g.total / 100);
    g.spores = Math.min(g.spores + n, MAX); g.total = Math.min(g.total + n, MAX);
    if (Math.floor(g.total / 100) > before) toast('¡' + fmt(Math.floor(g.total / 100) * 100) + ' esporas juntadas!');
  }
  $('shroom').addEventListener('click', e => {
    gain(perClick()); renderGame(); save();
    if (!reduced) {
      const r = e.currentTarget.getBoundingClientRect();
      const s = h('span', { class: 'pop' }, '+' + perClick());
      s.style.left = (e.clientX || r.left + r.width / 2) - 10 + 'px';
      s.style.top = (e.clientY || r.top + r.height / 2) - 20 + 'px';
      document.body.appendChild(s); setTimeout(() => s.remove(), 700);
    }
  });
  $('reset').addEventListener('click', () => { g = fresh(); renderGame(); save(); toast('Micelio reiniciado'); });
  setInterval(() => { if (perSec()) { gain(perSec()); renderGame(); save(); } }, 1000);

  /* ---------- Habilidades ---------- */
  $('skills').replaceChildren(...skills.map(s =>
    h('div', { class: 'skill' }, h('h3', {}, s.area), h('ul', {}, s.items.map(i => h('li', {}, i))))));

  /* ---------- Email (armado al cargar) ---------- */
  const email = MAIL.join('@');
  $('mail').href = 'mailto:' + email;
  $('mail-text').textContent = email;
  $('copy').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(email); e.target.textContent = 'Copiado ✓'; }
    catch (err) { e.target.textContent = 'Copialo a mano'; }
  });

  /* ---------- Animación al hacer scroll + menú activo ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    const links = document.querySelectorAll('nav .navlink');
    const spy = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) links.forEach(l => l.setAttribute('aria-current', l.dataset.sec === en.target.id ? 'true' : 'false'));
    }), { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(s => spy.observe(s));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ---------- Botón volver arriba ---------- */
  const toTopBtn = $('to-top');
  addEventListener('scroll', () => toTopBtn.classList.toggle('show', scrollY > 600), { passive: true });
  toTopBtn.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));

  /* ---------- Código secreto (Konami) ---------- */
  const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  const palette = ['#C6F432','#5EEAD4','#FDBA74','#A5B4FC','#F9A8D4'];
  let kpos = 0, pidx = 0;
  addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = (k === konami[kpos]) ? kpos + 1 : (k === konami[0] ? 1 : 0);
    if (kpos === konami.length) {
      kpos = 0; pidx = (pidx + 1) % palette.length;
      const root = document.documentElement;
      root.style.setProperty('--accent', palette[pidx]);
      if (root.dataset.theme !== 'light') root.style.setProperty('--accent-ink', palette[pidx]);
      gain(500); renderGame(); save();
      toast('¡Código secreto! Nuevo color y +500 esporas');
    }
  });

  $('year').textContent = new Date().getFullYear();
  renderFilters(); renderProjects(); renderGame();
})();
