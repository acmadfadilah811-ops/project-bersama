// Lonceng di header: tab Notifikasi / Pesan Masuk (bisa digeser seperti referensi, direkam 22 Okt 2026),
// halaman Daftar Pesan, dan Detail Pesan. Notifikasi berisi peringatan stok minim dari data Inventori.

let bellTab = 0;
const pesanBaru = () => db().pesan.filter(p => !p.dibaca).length;
const stokMinim = () => stokItems().filter(i => i.stokMin > 0 && stokOf(i.key) <= i.stokMin);
function waktuLalu(iso) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} Menit yang lalu`;
  if (m < 1440) return `${Math.floor(m / 60)} Jam yang lalu`;
  return `${Math.floor(m / 1440)} Hari yang lalu`;
}

// angka di menu Pengaturan > Pesan Masuk ikut jumlah pesan belum dibaca
const grupPesan = MENUS.pengaturan.items.find(it => it.label === 'Pesan Masuk');
if (grupPesan) Object.defineProperty(grupPesan, 'badge', { get: () => pesanBaru() || null });

function updateBellDot() {
  const dot = document.getElementById('bellDot');
  if (dot) dot.classList.toggle('hidden', !(pesanBaru() || stokMinim().length));
}
function renderBell() {
  const dd = document.getElementById('ddBell');
  if (!dd) return;
  const n = pesanBaru(), notif = stokMinim();
  const tab = (i, label, extra) => `<button data-bt="${i}" class="flex-1 py-3 flex items-center justify-center gap-2 border-b-2 ${bellTab === i ? 'text-brand font-semibold border-brand' : 'text-ink-2 border-transparent'}">${label}${extra}</button>`;
  const isi = bellTab === 0
    ? (notif.length ? notif.slice(0, 4).map(i => `<a href="#/penjualan/daftar-stok" data-bellgo class="block px-6 py-3 border-b border-line last:border-0 hover:bg-page">
        <span class="flex items-center justify-between gap-3"><b class="text-[14px] truncate">Stok minim: ${esc(i.nama)}</b></span>
        <span class="block text-[12px] text-ink-3 mt-1">Sisa stok ${fmtN(stokOf(i.key))} ${esc(i.satuan)}, di bawah pengingat stok minimum ${fmtN(i.stokMin)} ${esc(i.satuan)}.</span></a>`).join('')
      : '<p class="text-center text-[14px] text-ink-3 py-3">Tidak ada notifikasi</p>')
    : (db().pesan.length ? [...db().pesan].sort((a, b) => (b.waktu > a.waktu ? 1 : -1)).slice(0, 4).map(p => `<button data-msg="${p.id}" class="block w-full text-left px-6 py-3 border-b border-line hover:bg-page">
        <span class="flex items-center justify-between gap-3"><span class="text-[14px] truncate ${p.dibaca ? 'font-medium' : 'font-semibold'}">${esc(p.subjek)}</span><span class="text-[12px] text-ink-3 whitespace-nowrap">${waktuLalu(p.waktu)}</span></span>
        <span class="text-[12px] text-ink-3 mt-1 line-clamp-2">${esc(p.isi.slice(1).join(' '))}</span></button>`).join('')
      : '<p class="text-center text-[14px] text-ink-3 py-3">Tidak ada pesan</p>');
  dd.innerHTML = `<div class="flex text-[14px] border-b border-line">${tab(0, 'Notifikasi', notif.length ? `<span class="text-[11px] text-white bg-danger rounded-full px-1.5">${notif.length}</span>` : '')}${tab(1, 'Pesan Masuk', n ? `<span class="text-[11px] text-white bg-danger rounded-full px-1.5">${n}</span>` : '')}</div>
    <div class="max-h-[320px] overflow-y-auto">${isi}</div>
    <div class="text-right px-6 py-3"><a href="${bellTab ? '#/pengaturan/daftar-pesan' : '#/pengaturan/daftar-notifikasi'}" data-bellgo class="text-[12px] text-brand font-semibold">Lihat Semua</a></div>`;
  updateBellDot();
}

// ---------- Detail Pesan ----------
function detailPesan(p) {
  if (!p.dibaca) { p.dibaca = true; saveDB(); }
  const sh = openSheet({ title: 'Detail Pesan', body: `<div class="px-4 py-10"><section class="bg-white rounded-lg p-6 max-w-[918px] mx-auto" style="box-shadow:rgba(0,0,0,.05) 0 1px 3px">
    <h2 class="flex items-center justify-center gap-2 text-[20px] font-semibold"><span class="w-6 h-6 rounded-md bg-brand text-white text-[13px] font-extrabold flex items-center justify-center">k</span>Detail Pesan</h2>
    <div class="rounded-lg mt-6 px-6 py-8 text-white text-[16px] font-semibold" style="background:linear-gradient(110deg,#04C99E 0%,#10B897 55%,#3ED0A8 100%)">${esc(p.subjek)}</div>
    <p class="text-[14px] text-ink-3 mt-5">Pengirim: <b class="text-ink">${esc(p.pengirim)}</b><br>Tanggal: <b class="text-ink">${tglPanjang(p.waktu)}</b></p>
    <hr class="border-line my-4"><div class="space-y-3 text-[14px]">${p.isi.map(x => `<p>${esc(x)}</p>`).join('')}</div>
    <div class="flex justify-end gap-3 mt-12">${fBtn.outline('Tutup', 'data-tutup').replace('px-6', 'px-4')}${p.tombol ? fBtn.primary(esc(p.tombol), 'data-aksi') : ''}</div></section></div>` });
  sh.root.querySelector('[data-foot]').classList.add('hidden');
  sh.root.addEventListener('click', e => {
    if (e.target.closest('[data-tutup]')) return sh.close();
    if (e.target.closest('[data-aksi]')) confirmDialog({ title: 'Syarat dan Ketentuan', html: `Syarat dan ketentuan layanan kasirku sudah disetujui pada <b>${tglPanjang(p.waktu)}</b>.`, ok: 'Tutup', cancel: null });
  });
  const tutup = sh.close; sh.close = () => { tutup(); render(); };
  updateBellDot();
}

// ---------- Daftar Pesan (Pengaturan > Pesan Masuk) ----------
let pesanQ = '';
function daftarPesanPage() {
  killCharts();
  const list = [...db().pesan].sort((a, b) => (b.waktu > a.waktu ? 1 : -1)).filter(p => !pesanQ || (p.subjek + p.pengirim).toLowerCase().includes(pesanQ));
  return `<section class="card p-5"><div class="flex items-center gap-3"><h1 class="text-[20px] font-semibold leading-7">Daftar Pesan</h1><i data-lucide="help-circle" class="text-brand" style="width:22px;height:22px"></i><i data-lucide="star" class="text-ink-4" style="width:22px;height:22px"></i></div>${hr}
    <div class="flex flex-wrap gap-2"><label class="input w-[275px] h-9 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-pesanq class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..." value="${esc(pesanQ)}"></label>${dateBtn(invPeriode().btn)}</div>${hr}
    <div class="overflow-x-auto"><table class="tbl w-full"><thead><tr><th class="w-8"><input type="checkbox" class="accent-[#04C99E]" aria-label="Pilih semua"></th><th>Subjek</th><th>Pengirim</th><th>Tanggal</th><th>Prioritas</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr class="${p.dibaca ? '' : 'font-semibold'}"><td><input type="checkbox" class="accent-[#04C99E]" aria-label="Pilih pesan"></td><td class="max-w-[360px] truncate">${esc(p.subjek)}</td><td>${esc(p.pengirim)}</td><td class="whitespace-nowrap">${tglPanjang(p.waktu)}</td>
        <td><span class="text-[12px] font-semibold bg-[#FFFBE6] px-2 py-1 rounded inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-accent"></span>${esc(p.prioritas)}</span></td><td class="text-right"><button data-msg="${p.id}" aria-label="Lihat pesan"><i data-lucide="eye" class="ic-sm"></i></button></td></tr>`).join('')}
    </tbody></table></div>${list.length ? pager(list.length) : emptyTable()}</section>`;
}
PAGES['daftar-pesan'] = daftarPesanPage;

document.addEventListener('input', e => {
  if (state.page === 'daftar-pesan' && e.target.matches('[data-pesanq]')) { pesanQ = e.target.value.toLowerCase(); render(); const i = document.querySelector('[data-pesanq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
});
document.addEventListener('click', e => {
  const t = e.target;
  // app.js sudah membuka/menutup dropdown; isinya digambar di sini
  if (t.closest('#btnBell')) return renderBell();
  const bt = t.closest('[data-bt]');
  // listener app.js berjalan sesudah ini; tombol tab sudah diganti, jadi hentikan agar dropdown tidak tertutup
  if (bt) { e.stopImmediatePropagation(); bellTab = +bt.dataset.bt; return renderBell(); }
  if (t.closest('[data-bellgo]')) return toggleDD(null);
  const m = t.closest('[data-msg]');
  if (m) { toggleDD(null); detailPesan(byId('pesan', m.dataset.msg)); }
});
window.addEventListener('hashchange', updateBellDot);
window.addEventListener('DOMContentLoaded', updateBellDot);
