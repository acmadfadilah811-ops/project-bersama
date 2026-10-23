// Komponen interaktif yang direkam dari referensi (17 Okt 2026):
// form layar penuh, dialog konfirmasi, toast, menu aksi baris, tur panduan, kontrol form.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nodeOf = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
let layer = 60;

// ---------- toast "Berhasil!" kanan atas ----------
// kind 'error' = toast merah "Gagal!", 'warn' = toast kuning (proses berjalan)
function toast(title, html, kind) {
  let box = document.getElementById('toastBox');
  if (!box) { box = nodeOf('<div id="toastBox" class="fixed top-[60px] right-14 z-[200] space-y-2"></div>'); document.body.appendChild(box); }
  const [bd, bg, bar] = kind === 'error' ? ['#FFCCC7', '#FFF1F0', '#E5333F'] : kind === 'warn' ? ['#FFE58F', '#FFFBE6', '#FAAD14'] : ['#B7EBC1', '#EBFAED', '#3ED0A8'];
  const t = nodeOf(`<div class="w-[260px] rounded-md border flex overflow-hidden shadow-sm" style="border-color:${bd};background:${bg}">
    <span class="w-1 my-2 ml-2 rounded" style="background:${bar}"></span>
    <div class="flex-1 px-3 py-2"><p class="text-[16px] font-semibold">${title}</p><p class="text-[14px] text-ink-3 mt-1">${html}</p></div>
    <button class="p-2 self-start text-ink-4" aria-label="Tutup"><i data-lucide="x" class="ic-sm"></i></button></div>`);
  t.querySelector('button').onclick = () => t.remove();
  box.appendChild(t); lucide.createIcons();
  setTimeout(() => t.remove(), 4000);
}

// ---------- dialog konfirmasi (Simpan / Batal / Hapus) ----------
function confirmDialog({ title, html, ok = 'Ya, Lanjutkan', cancel = 'Batal', danger = false, extra }) {
  return new Promise(resolve => {
    const z = (layer += 2);
    const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${z}">
      <div class="bg-white rounded-lg w-[422px] max-w-full">
        <div class="flex items-center justify-between px-6 py-4 border-b border-line"><h3 class="text-[20px] font-semibold">${title}</h3>
          <button data-x class="text-ink" aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
        <div class="px-6 py-5 text-[14px] leading-6 text-justify">${html}</div>
        <div class="flex justify-end items-center gap-4 px-6 py-5 border-t border-line">
          ${extra ? `<button data-extra class="text-brand text-[14px] font-semibold">${extra}</button>` : ''}
          ${cancel ? `<button data-no class="text-brand text-[14px] font-semibold">${cancel}</button>` : ''}
          <button data-ok class="h-10 px-3 rounded-md text-white text-[14px] font-semibold" style="background:${danger ? '#E5333F' : '#04C99E'}">${ok}</button>
        </div></div></div>`);
    const done = v => { d.remove(); layer -= 2; resolve(v); };
    d.querySelector('[data-x]').onclick = () => done(false);
    if (cancel) d.querySelector('[data-no]').onclick = () => done(false);
    d.querySelector('[data-ok]').onclick = () => done(true);
    if (extra) d.querySelector('[data-extra]').onclick = () => done('extra');
    document.body.appendChild(d); lucide.createIcons();
  });
}

// ---------- halaman form layar penuh ----------
function openSheet({ title, body, footer, onMount }) {
  const z = (layer += 2);
  const s = nodeOf(`<div class="fixed inset-0 bg-[#F7F7F7] flex flex-col" style="z-index:${z}">
    <header class="h-14 shrink-0 bg-white flex items-center px-6 relative" style="box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <button data-close class="w-12 h-12 -ml-0 rounded-lg bg-[#F2F2F2] flex items-center justify-center" aria-label="Tutup"><i data-lucide="x"></i></button>
      <h1 data-title class="ml-6 text-[20px] font-semibold">${title}</h1>
      <span class="absolute left-1/2 -translate-x-1/2 text-[30px] font-extrabold tracking-tight hidden md:block" style="background:linear-gradient(90deg,#04C99E,#1FB5C9);-webkit-background-clip:text;color:transparent">kasirku</span>
    </header>
    <div data-body class="flex-1 overflow-y-auto"></div>
    <footer data-foot class="h-16 shrink-0 bg-white flex items-center gap-6 px-6 lg:px-12"></footer>
  </div>`);
  const api = {
    root: s,
    setBody(h) { s.querySelector('[data-body]').innerHTML = h; lucide.createIcons(); },
    setFooter(h) { s.querySelector('[data-foot]').innerHTML = h; lucide.createIcons(); },
    setTitle(t) { s.querySelector('[data-title]').textContent = t; },
    close() { s.remove(); layer -= 2; },
    onClose: null
  };
  s.querySelector('[data-close]').onclick = () => (api.onClose ? api.onClose() : api.close());
  document.body.appendChild(s);
  api.setBody(body || ''); api.setFooter(footer || '');
  if (onMount) onMount(api);
  return api;
}

// tombol footer standar
const fBtn = {
  text: (label, attr) => `<button ${attr} class="text-brand text-[14px] font-semibold">${label}</button>`,
  primary: (label, attr) => `<button ${attr} class="h-10 px-3 rounded-md bg-brand text-white text-[14px] font-semibold">${label}</button>`,
  outline: (label, attr) => `<button ${attr} class="h-10 px-6 rounded-md border border-brand text-brand text-[14px] font-semibold">${label}</button>`
};

// ---------- kontrol form ----------
const req = '<span class="text-danger">*</span>';
function fRow(label, control, { required, help, top = true } = {}) {
  return `<div class="grid md:grid-cols-[240px_1fr] gap-x-6 gap-y-2 py-3">
    <div class="${top ? 'pt-2.5' : ''}"><p class="text-[14px] font-semibold">${label}${required ? req : ''}</p>${help ? `<p class="text-[12px] text-[#717A7A] mt-1 leading-4">${help}</p>` : ''}</div>
    <div class="min-w-0">${control}</div></div>`;
}
// o: counter, prefix, suffix, area, rows, disabled, req (pesan wajib), money (format Rp), num (wajib > 0)
const fInput = (name, ph = '', val = '', o = {}) => {
  const attrs = `name="${name}" placeholder="${esc(ph)}" ${o.disabled ? 'disabled' : ''} ${o.req ? `data-req="${esc(o.req)}"` : ''} ${o.counter ? `maxlength="${o.counter}"` : ''} ${o.money ? 'data-money inputmode="numeric"' : ''} ${o.num ? 'data-num="1"' : ''}`;
  const v = o.money && val ? toNum(val).toLocaleString('id-ID') : val;
  return `<div data-field="${name}">
  ${o.counter ? `<p class="text-right text-[12px] text-[#A0A6A6] -mt-5 mb-1"><span data-count>${String(v).length}</span>/${o.counter}</p>` : ''}
  ${o.prefix || o.suffix ? `<div class="fin flex items-center gap-3 ${o.disabled ? 'bg-[#F2F2F2] text-[#A0A6A6]' : ''}">${o.prefix ? `<span class="text-ink-3">${o.prefix}</span>` : ''}<input ${attrs} class="flex-1 min-w-0 outline-none bg-transparent" value="${esc(v)}">${o.suffix ? `<span class="text-ink-3" data-suffix>${o.suffix}</span>` : ''}</div>`
    : o.area ? `<textarea ${attrs} rows="${o.rows || 2}" class="fin">${esc(v)}</textarea>`
    : `<input ${attrs} class="fin" value="${esc(v)}">`}
</div>`;
};
const fSelect = (name, options, val = '', ph = 'Pilih', o = {}) => `<div data-field="${name}"><select name="${name}" class="fin fsel ${val ? '' : 'text-[#A0A6A6]'}" ${o.req ? `data-req="${esc(o.req)}"` : ''} ${o.disabled ? 'disabled' : ''}>
  <option value="">${ph}</option>${options.map(op => { const [v, l] = Array.isArray(op) ? op : [op, op]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select></div>`;
const fSwitch = (name, on, label) => `<div class="flex items-center gap-3"><button type="button" class="sw shrink-0" role="switch" data-name="${name}" data-on="${on ? 1 : 0}" aria-checked="${!!on}"></button>${label ? `<span class="text-[12px] font-medium text-ink-2">${label}</span>` : ''}</div>`;
const fCheck = (name, checked, label) => `<label class="flex items-center gap-3 py-1 text-[14px]"><input type="checkbox" name="${name}" class="w-4 h-4 accent-[#04C99E]" ${checked ? 'checked' : ''}>${label}</label>`;
const fRadioCard = (name, value, label, checked, o = {}) => `<label class="rcard ${o.cls || ''}"><input type="radio" name="${name}" value="${value}" class="w-4 h-4 accent-[#04C99E]" ${checked ? 'checked' : ''} ${o.disabled ? 'disabled' : ''}>${label}${o.info ? '<i data-lucide="info" class="ic-sm text-ink-3"></i>' : ''}</label>`;
const fUpload = (text = 'Pilih atau letakkan berkas di sini', w = 'w-[140px] h-[140px]') => `<div class="${w} border border-dashed border-[#A0A6A6] rounded-lg flex flex-col items-center justify-center text-center px-3 text-[12px] text-[#A0A6A6] gap-3"><i data-lucide="upload" class="text-ink"></i>${text}</div>`;
const fChip = label => `<span class="inline-flex items-center gap-2 bg-[#F2F2F2] rounded px-2 py-1 text-[12px] font-medium mt-3">${label}<i data-lucide="x" class="ic-sm text-ink-3"></i></span>`;
const upsell = (html, link = 'Upgrade Sekarang') => `<div class="rounded-md border border-[#69C0E6] bg-[#E6F6FC] px-4 py-3 text-[14px] text-ink-2 leading-6">${html}<p class="text-right mt-1"><a class="underline text-brand">${link}</a></p></div>`;
const infoBox = (title, text, link) => `<div class="rounded-md border border-[#69C0E6] bg-[#E6F6FC] px-4 py-3 text-[14px] text-ink-2 flex gap-3"><i data-lucide="info" class="ic-sm mt-0.5 shrink-0" style="fill:#404545;color:#fff"></i><div class="flex-1">${title ? `<p class="text-[16px] font-semibold text-ink">${title}</p>` : ''}<p class="leading-6">${text}</p>${link ? `<p class="text-right"><a class="underline text-brand">${link}</a></p>` : ''}</div><i data-lucide="x" class="ic-sm text-ink-4 shrink-0"></i></div>`;
const formCard = (inner, title) => `<section class="bg-white rounded-lg p-6 mb-6" style="box-shadow:rgba(0,0,0,.05) 0 1px 3px">${title ? `<h2 class="text-[20px] font-semibold mb-4">${title}</h2>` : ''}${inner}</section>`;

// baca nilai form; switch dibaca dari data-on
function formValues(root) {
  const v = {};
  root.querySelectorAll('input[name],select[name],textarea[name]').forEach(i => {
    if (i.type === 'checkbox') v[i.name] = i.checked;
    else if (i.type === 'radio') { if (i.checked) v[i.name] = i.value; }
    else v[i.name] = i.value.trim();
  });
  root.querySelectorAll('.sw[data-name]').forEach(s => { v[s.dataset.name] = s.dataset.on === '1'; });
  return v;
}

// validasi field wajib: bingkai merah + pesan di bawahnya
function validate(root) {
  let ok = true;
  root.querySelectorAll('[data-req]').forEach(i => {
    const wrap = i.closest('[data-field]');
    wrap.querySelectorAll('.fmsg').forEach(m => m.remove());
    const box = i.closest('.fin') || i;
    const empty = !i.value.trim() || (i.dataset.num && !(+i.value.replace(/\D/g, '') > 0));
    box.classList.toggle('ferr', empty);
    if (empty) { ok = false; wrap.insertAdjacentHTML('beforeend', `<p class="fmsg">${i.dataset.req}</p>`); }
  });
  return ok;
}

// format angka rupiah saat diketik
const toNum = s => +String(s || '').replace(/\D/g, '') || 0;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-money]')) { const n = toNum(t.value); t.value = n ? n.toLocaleString('id-ID') : ''; }
  const cnt = t.closest('[data-field]')?.querySelector('[data-count]');
  if (cnt) cnt.textContent = t.value.length;
  if (t.matches('.ferr, .ferr *') || t.closest('.ferr')) { (t.closest('.fin') || t).classList.remove('ferr'); t.closest('[data-field]')?.querySelectorAll('.fmsg').forEach(m => m.remove()); }
  if (t.matches('select.fsel')) t.classList.toggle('text-[#A0A6A6]', !t.value);
});
document.addEventListener('change', e => { if (e.target.matches('select.fsel')) e.target.classList.toggle('text-[#A0A6A6]', !e.target.value); });
document.addEventListener('click', e => {
  const sw = e.target.closest('.sw');
  if (!sw || sw.disabled) return;
  const on = sw.dataset.on !== '1';
  sw.dataset.on = on ? '1' : '0';
  sw.setAttribute('aria-checked', on);
  sw.dispatchEvent(new CustomEvent('sw', { bubbles: true, detail: on }));
});

// ---------- menu aksi baris (•••) ----------
function rowMenu(anchor, items) {
  document.querySelectorAll('.rowmenu').forEach(m => m.remove());
  const r = anchor.getBoundingClientRect();
  const m = nodeOf(`<div class="rowmenu dropdown fixed z-[55] min-w-[148px] max-w-[300px] py-1">${items.map((it, i) => `<button data-i="${i}" class="block w-full text-left px-4 py-3 text-[14px] ${i ? 'border-t border-line' : ''} ${it[2] === 'danger' ? 'text-[#E5333F]' : ''} hover:bg-page">${it[0]}</button>`).join('')}</div>`);
  // selalu di atas sheet/dialog yang sedang terbuka
  m.style.zIndex = layer + 5;
  document.body.appendChild(m);
  const top = Math.min(r.bottom + 4, window.innerHeight - m.offsetHeight - 8);
  m.style.top = top + 'px'; m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
  m.addEventListener('click', ev => { const b = ev.target.closest('[data-i]'); if (b) { m.remove(); items[+b.dataset.i][1](); } });
  setTimeout(() => document.addEventListener('click', function off(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', off); } }), 0);
}

// ---------- tur panduan (popover kiri + sorotan target) ----------
function runTour(root, steps, { onDone } = {}) {
  let i = 0;
  // redup + popover ditaruh di dalam sheet supaya target bisa disorot di atas lapisan redup
  const dim = nodeOf('<div class="fixed inset-0 bg-black/50" style="z-index:50"></div>');
  const pop = nodeOf('<div class="fixed w-[295px] bg-white rounded-lg p-5 shadow-lg" style="z-index:52"></div>');
  root.append(dim, pop);
  let lit = null;
  const finish = () => { if (lit) lit.classList.remove('tour-lit'); dim.remove(); pop.remove(); onDone && onDone(); };
  const show = () => {
    const st = steps[i];
    if (lit) lit.classList.remove('tour-lit');
    if (st.before) st.before();
    lit = root.querySelector(st.target);
    if (!lit) { i++; return i < steps.length ? show() : finish(); }
    lit.scrollIntoView({ block: 'center' });
    lit.classList.add('tour-lit');
    const last = i === steps.length - 1;
    pop.innerHTML = `<p class="text-[20px] font-semibold">${st.title}</p><p class="text-[14px] mt-3 leading-5">${st.text}</p>
      <div class="flex items-center mt-4 text-[14px] font-semibold">${last ? '' : '<button data-tour-skip class="text-brand">Lewati</button>'}
      <button data-tour-next class="ml-auto text-brand">${last ? 'Oke' : `Lanjut <span class="font-normal text-ink-3">(${i + 1} / ${steps.length})</span>`}</button></div>
      <span class="absolute -right-2 top-8 w-4 h-4 bg-white rotate-45"></span>`;
    const r = lit.getBoundingClientRect();
    pop.style.left = Math.max(16, r.left - 295 - 26) + 'px';
    pop.style.top = Math.min(Math.max(70, r.top), window.innerHeight - pop.offsetHeight - 80) + 'px';
    pop.querySelector('[data-tour-next]').onclick = () => { i++; i < steps.length ? show() : finish(); };
    const sk = pop.querySelector('[data-tour-skip]'); if (sk) sk.onclick = finish;
  };
  show();
}
