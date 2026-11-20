// Shell: topbar, sidebar, router hash (#/<konteks>/<halaman>), dropdown, modal terkunci.

const MAIN_TABS = ['penjualan', 'order', 'appointment', 'karyawan', 'keuangan'];
const MORE_TABS = Object.keys(MENUS).filter(k => MENUS[k].more);

const state = { ctx: 'penjualan', page: 'dashboard', open: new Set(), collapsed: false };
const $ = id => document.getElementById(id);
const icons = () => window.lucide && lucide.createIcons();

// ---------- routing ----------
function parseHash() {
  const [, ctx, page] = (location.hash || '').split('/');
  return { ctx: MENUS[ctx] ? ctx : 'penjualan', page };
}

function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function openCtx(key) {
  const m = MENUS[key];
  if (m.locked) return showLock(m);
  if (m.redirect) return go(m.redirect);
  go(`#/${key}/${m.home}`);
}

// cari item + jalur leluhurnya untuk slug tertentu
function findPath(items, slug, trail = []) {
  for (const it of items) {
    const here = [...trail, it];
    if (it.children) {
      const hit = findPath(it.children, slug, here);
      if (hit) return hit;
    } else if (slugOf(it) === slug) return here;
  }
  return null;
}

// jalur aktif diambil dari lokasi asli menu, bukan dari salinan di Menu Favorit
const activePath = m => findPath(m.items.slice(1), state.page) || findPath(m.items, state.page) || [];

// ---------- topbar ----------
function renderTopnav() {
  const tabs = MAIN_TABS.map(k => `<button class="nav-btn ${state.ctx === k ? 'active' : ''}" data-ctx="${k}">${MENUS[k].label}</button>`).join('');
  const cur = MENUS[state.ctx];
  const moreActive = !!cur.more;
  const moreLabel = moreActive ? cur.label : 'Lainnya';
  const list = MORE_TABS.filter(k => k !== state.ctx)
    .map(k => `<button data-ctx="${k}" class="block w-full text-left px-4 py-3.5 text-[14px] text-ink-2 border-b border-line last:border-0 hover:bg-page">${MENUS[k].label.replace('Pendanaan ', 'Pendanaan<br>')}</button>`).join('');
  $('topnav').innerHTML = `${tabs}
    <div class="relative">
      <div class="flex items-center rounded-lg h-9 pl-3 pr-1 ${moreActive ? 'bg-brand text-white' : 'text-ink-2'}">
        <button id="btnMore" class="text-[14px] font-medium whitespace-nowrap">${moreLabel}</button>
        <span class="mx-2 opacity-70">|</span>
        <button data-ctx="pendanaan" class="flex items-center gap-2 text-[14px] font-medium whitespace-nowrap">
          <span class="w-6 h-6 rounded-full bg-[#4A4F4F] text-white text-[10px] font-semibold flex items-center justify-center">Rp</span>Dana Siap Pakai
        </button>
        <button id="btnMore2" class="ml-2 p-1" aria-label="Menu lainnya"><i data-lucide="more-vertical"></i></button>
      </div>
      <div id="ddMore" class="dropdown absolute left-0 top-11 w-[200px] hidden z-50">${list}</div>
    </div>`;
}

// ---------- sidebar ----------
function renderItem(it, depth, activePath) {
  const slug = slugOf(it);
  if (!it.children) {
    const active = activePath.includes(it);
    if (depth === 0) {
      return `<a href="#/${state.ctx}/${slug}" class="sb-item ${active ? 'active' : ''}" title="${it.label}">
        <i data-lucide="${it.icon || 'circle'}" class="shrink-0"></i><span class="sb-label ml-3 flex-1">${it.label}</span></a>`;
    }
    // menu terkunci paket trial: klik memunculkan popup, tidak pindah halaman
    if (LOCKED_PAGES[slug]) return `<button data-lock="${slug}" class="sb-sub ${depth === 2 ? 'lv3' : ''}">${it.label}</button>`;
    return `<a href="#/${state.ctx}/${slug}" class="sb-sub ${depth === 2 ? 'lv3' : ''} ${active ? 'active font-medium' : ''}">${it.label}</a>`;
  }
  const key = `${depth}:${it.label}`;
  const open = state.open.has(key);
  const chev = `<i data-lucide="chevron-${open ? 'up' : 'down'}" class="ic-sm sb-chev shrink-0"></i>`;
  const kids = open ? it.children.map(c => renderItem(c, depth + 1, activePath)).join('') : '';
  if (depth === 0) {
    const badge = it.badge ? `<span class="sb-label mr-3 text-[11px] font-semibold bg-[#0E7C64] rounded-full w-5 h-5 flex items-center justify-center">${it.badge}</span>` : '';
    return `<div class="sb-group ${open ? 'open' : ''}">
      <button class="sb-item" data-group="${key}" title="${it.label}"><i data-lucide="${it.icon || 'circle'}" class="shrink-0"></i>
      <span class="sb-label ml-3 flex-1">${it.label}</span>${badge}${chev}</button>
      ${open ? `<div class="sb-hide pb-1">${kids}</div>` : ''}</div>`;
  }
  return `<div><button class="sb-sub flex items-center ${depth === 2 ? 'lv3' : ''} ${open ? 'font-semibold' : ''}" data-group="${key}">
    <span class="flex-1">${it.label}</span>${chev}</button>${kids}</div>`;
}

function renderSidebar(activePath) {
  const m = MENUS[state.ctx];
  $('sbMenu').innerHTML = m.items.map(it => renderItem(it, 0, activePath)).join('');
  // di layar kecil topbar disembunyikan; modul dipilih dari sini
  $('sbModules').innerHTML = [...MAIN_TABS, ...MORE_TABS.filter(k => k !== 'pendanaan')].map(k =>
    `<button data-ctx="${k}" class="shrink-0 h-8 px-3 rounded-full text-[13px] font-medium ${k === state.ctx ? 'bg-white text-brand' : 'bg-white/20 text-white'}">${MENUS[k].label}</button>`).join('');
  $('sbExtra').innerHTML = m.extra === 'saldo' ? `
    <div class="mx-4 mb-4 rounded-lg p-4" style="background:#E6F9F4">
      <div class="bg-white rounded-md flex items-center px-2 py-1.5 gap-2">
        <span class="text-brand text-[14px] font-medium truncate flex-1">by-cafe-4696.tokoku.id</span>
        <i data-lucide="copy" class="ic-sm text-brand"></i><i data-lucide="more-horizontal" class="ic-sm text-brand"></i>
      </div>
      <div class="flex justify-between items-center mt-3"><span class="text-[14px] font-medium">Saldo Order Online</span><a class="text-brand text-[14px] font-semibold">Detail</a></div>
      <div class="text-[18px] font-semibold mt-1">Rp 0</div>
    </div>` : '';
}

// ---------- render ----------
function render() {
  const { ctx, page } = parseHash();
  const m = MENUS[ctx];
  if (m.locked || m.redirect || !m.items) return openCtx(ctx);
  if (LOCKED_PAGES[page]) { showLock({ locked: LOCKED_PAGES[page], lockBtn: 'Upgrade Langganan Anda' }); return go(`#/${ctx}/${m.home}`); }
  state.ctx = ctx;
  state.page = page || m.home;
  const path = activePath(m);
  // buka grup leluhur halaman aktif (hanya saat pindah halaman)
  if (state.lastPage !== `${ctx}/${state.page}`) {
    state.open = new Set();
    path.slice(0, -1).forEach((g, i) => state.open.add(`${i}:${g.label}`));
    state.lastPage = `${ctx}/${state.page}`;
  }
  const leaf = path[path.length - 1];
  renderTopnav();
  renderSidebar(path);
  const title = leaf ? leaf.label : 'Halaman';
  const fn = PAGES[state.page] || (() => genericPage(title));
  window.PENDING_INIT = null;
  $('page').innerHTML = fn(title);
  document.title = `${title} | kasirku`;
  window.scrollTo(0, 0);
  icons();
  (PAGE_INIT[state.page] || (() => {}))();
  // halaman dari template (penjualan.js) mendaftarkan grafik/interaksinya di sini
  if (window.PENDING_INIT) window.PENDING_INIT();
  renderDataMode();
  closeMobileSidebar();
}

// ---------- saklar data contoh / kosong ----------
function renderDataMode() {
  const on = isSample();
  $('btnDataMode').style.background = on ? '#04C99E' : '#D6D9D9';
  $('btnDataMode').style.justifyContent = on ? 'flex-end' : 'flex-start';
}
function toggleDataMode() {
  try { localStorage.setItem('dataMode', isSample() ? 'kosong' : 'contoh'); } catch (e) { /* tanpa storage: tetap mode default */ }
  render();
}

// ---------- modal terkunci ----------
function showLock(m) {
  $('lockText').innerHTML = m.locked;
  $('lockBtn').textContent = m.lockBtn;
  $('lockModal').classList.replace('hidden', 'flex');
}
const hideLock = () => $('lockModal').classList.replace('flex', 'hidden');

// ---------- dropdown ----------
const DROPDOWNS = ['ddMore', 'ddBell', 'ddProfile', 'ddOutlet'];
function toggleDD(id) {
  DROPDOWNS.forEach(d => { const el = $(d); if (el && d !== id) el.classList.add('hidden'); });
  $(id) && $(id).classList.toggle('hidden');
}

// ---------- sidebar collapse / mobile ----------
function setCollapsed(v) {
  state.collapsed = v;
  $('sidebar').classList.toggle('collapsed', v);
  $('sidebar').classList.toggle('w-[280px]', !v);
  $('sidebar').classList.toggle('w-[72px]', v);
  $('main').classList.toggle('lg:ml-[280px]', !v);
  $('main').classList.toggle('lg:ml-[72px]', v);
  $('trialBar').classList.toggle('lg:left-[280px]', !v);
  $('trialBar').classList.toggle('lg:left-[72px]', v);
  window.dispatchEvent(new Event('resize'));
}
function openMobileSidebar() { $('sidebar').classList.remove('-translate-x-full'); $('sbBackdrop').classList.remove('hidden'); }
function closeMobileSidebar() { if (window.innerWidth < 1024) { $('sidebar').classList.add('-translate-x-full'); $('sbBackdrop').classList.add('hidden'); } }

// ---------- events ----------
document.addEventListener('click', e => {
  const t = e.target;
  const ctxBtn = t.closest('[data-ctx]');
  if (ctxBtn) { toggleDD(null); return openCtx(ctxBtn.dataset.ctx); }
  if (t.closest('#btnMore') || t.closest('#btnMore2')) return toggleDD('ddMore');
  if (t.closest('#btnBell')) return toggleDD('ddBell');
  if (t.closest('#btnProfile')) return toggleDD('ddProfile');
  if (t.closest('#btnOutlet')) return toggleDD('ddOutlet');
  const outlet = t.closest('[data-outlet]');
  if (outlet) { $('outletName').textContent = outlet.dataset.outlet; return toggleDD(null); }
  const lock = t.closest('[data-lock]');
  if (lock) return showLock({ locked: LOCKED_PAGES[lock.dataset.lock], lockBtn: 'Upgrade Langganan Anda' });
  if (t.closest('#btnDataMode')) return toggleDataMode();
  const grp = t.closest('[data-group]');
  if (grp) {
    if (state.collapsed) setCollapsed(false);
    const key = grp.dataset.group;
    const depth = key.split(':')[0];
    const wasOpen = state.open.has(key);
    // akordeon: tutup saudara di tingkat yang sama (dan turunannya)
    [...state.open].forEach(k => { if (k.split(':')[0] >= depth) state.open.delete(k); });
    if (!wasOpen) {
      state.open.add(key);
      // pertahankan leluhur yang sedang terbuka
      let el = grp.parentElement;
      while (el && el !== $('sbMenu')) {
        const b = el.querySelector(':scope > [data-group]');
        if (b && b !== grp) state.open.add(b.dataset.group);
        el = el.parentElement;
      }
    }
    renderSidebar(activePath(MENUS[state.ctx]));
    return icons();
  }
  if (t.closest('#btnCollapse')) return setCollapsed(!state.collapsed);
  if (t.closest('#btnBurger')) return openMobileSidebar();
  if (t.closest('#sbBackdrop')) return closeMobileSidebar();
  if (t.closest('#lockClose') || t.closest('#lockBtn') || t === $('lockModal')) return hideLock();
  if (!t.closest('.dropdown')) toggleDD(null);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggleDD(null); hideLock(); } });
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => { if (!location.hash) location.hash = '#/penjualan/dashboard'; render(); });
