// Perilaku tabel yang direkam dari referensi (22 Okt 2026):
// pilih kolom (+) di ujung header, modal Filter Laporan, Atur Tabel terkunci.
// Aksi massal saat baris dicentang ada di halaman daftar (LISTS[...].bulk, produk.js).

// ---------- pilih kolom ----------
const COL_HIDDEN = {};
// kolom tersembunyi per halaman; awalnya dari daftar nama kolom `hide` di SPEC
function colHidden(slug, cols, hide = []) {
  if (!COL_HIDDEN[slug]) COL_HIDDEN[slug] = new Set(cols.map((c, i) => (hide.includes(c) ? i : -1)).filter(i => i >= 0));
  return COL_HIDDEN[slug];
}
const colPickTh = `<th class="w-12 sticky right-0 bg-white"><button data-colpick class="w-7 h-7 ml-auto rounded-md text-ink hover:bg-page flex items-center justify-center" aria-label="Atur kolom"><i data-lucide="plus" class="ic-sm"></i></button></th>`;

function colPicker(anchor) {
  const old = document.querySelector('.colpick');
  if (old) return old.remove();
  const table = anchor.closest('table'), hid = COL_HIDDEN[state.page] || (COL_HIDDEN[state.page] = new Set());
  const cols = [...table.querySelectorAll('thead th[data-col]')].map(th => th.textContent.trim());
  // seperti referensi: tanpa judul, nama kolom huruf besar, garis pemisah antar-baris
  const m = nodeOf(`<div class="colpick dropdown fixed z-[55] w-[200px] py-1 max-h-[340px] overflow-y-auto">
    ${cols.map((c, i) => `<label class="flex items-center gap-3 mx-4 py-3 text-[13px] uppercase ${i ? 'border-t border-line cursor-pointer' : 'text-ink-4'}"><input type="checkbox" data-ci="${i}" class="w-4 h-4 accent-[#04C99E]" ${hid.has(i) ? '' : 'checked'} ${i ? '' : 'disabled'}>${esc(c)}</label>`).join('')}</div>`);
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = Math.max(8, Math.min(r.bottom + 4, window.innerHeight - m.offsetHeight - 8)) + 'px';
  m.style.left = Math.max(8, r.right - 200) + 'px';
  // kolom langsung tampil/sembunyi saat dicentang
  m.addEventListener('change', e => {
    const i = +e.target.dataset.ci;
    e.target.checked ? hid.delete(i) : hid.add(i);
    table.querySelectorAll(`[data-col="${i}"]`).forEach(c => c.classList.toggle('hidden', !e.target.checked));
  });
  setTimeout(() => document.addEventListener('click', function off(ev) {
    if (!m.isConnected) return document.removeEventListener('click', off);
    if (!m.contains(ev.target) && !ev.target.closest('[data-colpick]')) { m.remove(); document.removeEventListener('click', off); }
  }), 0);
}

// ---------- Filter Laporan ----------
const JENIS_ORDER = ['Bungkus', 'Consumer', 'Consumer Apps Delivery', 'Consumer Apps Kurir Outlet (Internal)', 'Consumer Apps Take Away', 'Delivery', 'Drive Thru', 'Free Table',
  'Go-Food', 'Gofood', 'Gofood Delivered', 'Gofood Takeaway', 'Grab Food', 'Grabfood Delivered by Grab', 'GrabFood DineIn', 'Grabfood Marketplace', 'Grabfood Take Away', 'Grabmart',
  'Invoice', 'Jasa', 'Kiosk', 'Lainnya', 'kasirku Order', 'kasirku Order (Reservasi Fasilitas)', 'kasirku Order Delivery', 'kasirku Order Dine in', 'kasirku Order Dine in di Depan',
  'kasirku Order Kurir Outlet (Internal)', 'kasirku Order Serve to Table', 'kasirku Order Take Away', 'Ojek Online', 'Parcel', 'Quick Service', 'Reservasi', 'Reservasi Fasilitas',
  'Reservasi Jasa', 'Self Order', 'Served By', 'Shopee', 'ShopeeFood Delivery', 'ShopeeFood Self PickUp', 'Supplies kurir ekspedisi', 'Supplies kurir outlet', 'Table', 'Tokopedia'];
// bagian terkunci (paket trial) tampil abu-abu dan tidak bisa dipilih
const FILTER_LAPORAN = [
  { nama: 'Status Pembayaran', all: 'Semua Status Pembayaran', ops: ['Belum Lunas', 'Lunas', 'Refund'] },
  { nama: 'Jenis Order', all: 'Pilih Semua', ops: JENIS_ORDER },
  { nama: 'Penjualan', lock: true }, { nama: 'Penjualan Kotor', lock: true }, { nama: 'Metode Pembayaran', lock: true }, { nama: 'Kasir', lock: true },
  { nama: 'Jenis Harga', all: 'Pilih Semua', ops: [] }
];
const FILTER_STATE = {};

function filterModal() {
  const slug = state.page, saved = FILTER_STATE[slug] || {};
  const sel = Object.fromEntries(FILTER_LAPORAN.map(f => [f.nama, new Set(saved[f.nama] || [])]));
  let cur = 0, open = false;
  const z = (layer += 2);
  const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${z}">
    <div class="bg-white rounded-lg w-[760px] max-w-full max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-line"><h3 class="text-[20px] font-semibold">Filter Laporan</h3>
        <button data-x class="text-ink" aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
      <div class="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[210px_minmax(0,1fr)] overflow-y-auto">
        <nav data-nav class="sm:border-r border-b sm:border-b-0 border-line py-2"></nav>
        <div data-pane class="p-6 min-h-[380px]"></div>
      </div>
      <div data-foot class="flex items-center gap-4 px-6 py-4 border-t border-line"></div>
    </div></div>`);
  const count = () => Object.values(sel).filter(s => s.size).length;   // jumlah bagian yang terisi
  const paint = () => {
    const keep = d.querySelector('[data-opts]')?.scrollTop || 0;
    d.querySelector('[data-nav]').innerHTML = FILTER_LAPORAN.map((f, i) => `<button data-sec="${i}" ${f.lock ? 'disabled' : ''} class="w-full flex items-center gap-2 text-left px-5 py-3 text-[14px] ${f.lock ? 'text-[#A0A6A6] cursor-not-allowed' : i === cur ? 'text-brand font-semibold bg-[#E6F9F4]' : 'text-ink hover:bg-page'}">
      <span class="flex-1">${f.nama}</span>${sel[f.nama].size ? '<i data-lucide="check-circle-2" class="ic-sm text-white shrink-0" style="fill:#04C99E"></i>' : ''}</button>`).join('');
    const f = FILTER_LAPORAN[cur], s = sel[f.nama];
    const allOn = f.ops.length > 0 && s.size === f.ops.length;
    const label = !s.size ? `Pilih ${f.nama}` : allOn ? f.all : s.size === 1 ? [...s][0] : `${s.size} ${f.nama} dipilih`;
    const opt = (attr, text, on) => `<label class="flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-page cursor-pointer"><input type="checkbox" ${attr} class="w-4 h-4 shrink-0 accent-[#04C99E]" ${on ? 'checked' : ''}>${esc(text)}</label>`;
    d.querySelector('[data-pane]').innerHTML = `<p class="text-[14px] font-semibold mb-2">${f.nama}</p>
      <div class="relative"><button data-field class="fin fsel w-full text-left ${s.size ? '' : 'text-[#A0A6A6]'}">${esc(label)}</button>
      ${open ? `<div data-opts class="dropdown absolute left-0 right-0 top-full mt-1 z-10 py-1 max-h-[260px] overflow-y-auto">
        ${opt('data-opt-all', f.all, allOn)}${f.ops.map((o, i) => opt(`data-opt="${i}"`, o, s.has(o))).join('')}</div>` : ''}</div>`;
    const all = d.querySelector('[data-opt-all]');
    if (all) { all.indeterminate = s.size > 0 && !allOn; d.querySelector('[data-opts]').scrollTop = keep; }
    const n = count();
    d.querySelector('[data-foot]').innerHTML = `${n ? '<button data-reset class="h-10 px-4 rounded-md border border-[#E5333F] text-[#E5333F] text-[14px] font-semibold">Reset</button>' : ''}
      <button data-no class="ml-auto text-brand text-[14px] font-semibold">Batal</button>${fBtn.primary(n ? `Atur (${n})` : 'Atur', 'data-ok')}`;
    lucide.createIcons();
  };
  const done = () => { d.remove(); layer -= 2; };
  d.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-x]') || t.closest('[data-no]')) return done();
    if (t.closest('[data-ok]')) { FILTER_STATE[slug] = Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, [...v]])); return done(); }
    if (t.closest('[data-reset]')) { Object.values(sel).forEach(s => s.clear()); open = false; return paint(); }
    const sec = t.closest('[data-sec]');
    if (sec) { if (!sec.disabled) { cur = +sec.dataset.sec; open = false; paint(); } return; }
    if (t.closest('[data-field]')) { open = !open; return paint(); }
    if (open && !t.closest('[data-opts]')) { open = false; paint(); }
  });
  d.addEventListener('change', e => {
    const f = FILTER_LAPORAN[cur], s = sel[f.nama];
    if (e.target.matches('[data-opt-all]')) { if (e.target.checked) f.ops.forEach(o => s.add(o)); else s.clear(); }
    else if (e.target.matches('[data-opt]')) { const o = f.ops[+e.target.dataset.opt]; e.target.checked ? s.add(o) : s.delete(o); }
    else return;
    paint();
  });
  document.body.appendChild(d);
  paint();
}

// ---------- centang semua baris tabel laporan ----------
document.addEventListener('change', e => {
  const t = e.target, p = document.getElementById('page');
  if (!p || !p.contains(t)) return;
  const all = p.querySelector('[data-rall]'), boxes = [...p.querySelectorAll('[data-rchk]')];
  if (t.matches('[data-rall]')) boxes.forEach(c => { c.checked = t.checked; });
  else if (!t.matches('[data-rchk]')) return;
  const n = boxes.filter(b => b.checked).length;
  if (all) { all.checked = n > 0 && n === boxes.length; all.indeterminate = n > 0 && n < boxes.length; }
});

document.addEventListener('click', e => {
  const t = e.target;
  if (!t.closest('#page')) return;
  const cp = t.closest('[data-colpick]');
  if (cp) return colPicker(cp);
  const tool = t.closest('[data-tool]')?.dataset.tool;
  if (tool === 'Filter') return filterModal();
  if (tool === 'Atur Tabel') return showLock({ locked: ADV, lockBtn: 'Upgrade Langganan Anda' });
});
