// Grup Pelanggan interaktif (Penjualan > Pelanggan), direkam dari referensi 22 Okt 2026:
// Daftar Pelanggan (+ detail & aktivitas), Grup Pelanggan, Grup Harga Spesial.
// Data pelanggan sama dengan yang dipakai halaman Kasir (store.js).

const KOTA = ['Bandung', 'Bekasi', 'Bogor', 'Depok', 'Jakarta Barat', 'Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Timur', 'Jakarta Utara', 'Surabaya', 'Tangerang', 'Yogyakarta'];
const grupName = id => byId('grupPelanggan', id)?.nama || '-';
const jkText = c => (c.jk === 'P' ? 'Perempuan' : 'Laki-Laki');
const tglText = iso => { const d = new Date(iso + 'T00:00:00'); return `${String(d.getDate()).padStart(2, '0')} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
function usia(iso) {
  const d = new Date(iso + 'T00:00:00'), n = new Date();
  let u = n.getFullYear() - d.getFullYear();
  if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) u--;
  return Math.max(0, u);
}
const pesananPelanggan = c => db().pesanan.filter(o => o.pelanggan === c.id);
// pelanggan yang grupnya memakai grup harga spesial ini
const pelangganHarga = h => db().pelanggan.filter(c => c.grup && byId('grupPelanggan', c.grup)?.harga === h.id);

// ---------- modal pilih (pelanggan / grup / ekstra) ----------
function pickFrom({ title, items, selected = [], ok = 'Tambahkan' }) {
  return new Promise(resolve => {
    const sel = new Set(selected);
    let q = '';
    const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${layer += 2}">
      <div class="bg-white rounded-lg w-[660px] max-w-full max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-line"><h3 class="text-[20px] font-semibold">${title}</h3><button data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
        <div class="px-10 py-6 flex-1 min-h-0 flex flex-col">
          <label class="input h-10 flex items-center gap-3 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-q class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari..."></label>
          <div data-list class="border border-line rounded-md mt-2 py-1 overflow-y-auto max-h-[300px]"></div></div>
        <div class="flex justify-end items-center gap-8 px-6 py-4 border-t border-line">${fBtn.text('Batal', 'data-x')}${fBtn.primary(ok, 'data-ok')}</div></div></div>`);
    const paint = () => {
      const list = items.filter(([, label]) => label.toLowerCase().includes(q));
      d.querySelector('[data-list]').innerHTML = list.length
        ? list.map(([id, label]) => `<label class="flex items-center gap-3 px-4 py-1.5 text-[14px] cursor-pointer hover:bg-page"><input type="checkbox" data-pick="${id}" class="w-4 h-4 accent-[#04C99E]" ${sel.has(id) ? 'checked' : ''}>${esc(label)}</label>`).join('')
        : '<p class="text-center text-[14px] text-ink-3 py-4">Tidak ada data</p>';
    };
    const close = v => { d.remove(); layer -= 2; resolve(v); };
    d.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) return close(null);
      if (e.target.closest('[data-ok]')) close([...sel]);
    });
    d.addEventListener('change', e => { if (e.target.matches('[data-pick]')) e.target.checked ? sel.add(e.target.dataset.pick) : sel.delete(e.target.dataset.pick); });
    d.addEventListener('input', e => { if (e.target.matches('[data-q]')) { q = e.target.value.toLowerCase(); paint(); } });
    document.body.appendChild(d); paint(); lucide.createIcons();
  });
}
const chipsHtml = list => list.map(([id, label]) => `<span class="inline-flex items-center gap-2 bg-[#F2F2F2] rounded px-2 py-1 text-[12px] font-medium mt-3 mr-2 max-w-[140px]"><span class="truncate">${esc(label)}</span><button type="button" data-unpick="${id}" aria-label="Hapus ${esc(label)}"><i data-lucide="x" class="ic-sm text-ink-3"></i></button></span>`).join('');
const outlineAdd = (label, attr) => `<button type="button" ${attr} class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold flex items-center justify-center gap-2"><i data-lucide="plus" class="ic-sm"></i>${label}</button>`;

// ---------- form pelanggan ----------
function pelangganForm(item) {
  const isEdit = !!item;
  const c = item ? { ...item } : { kode: genKode(), nama: '', telepon: '', email: '', jk: 'L', lahir: '', grup: '', kota: '', alamat: '', catatan: '', foto: '' };
  const fotoBox = () => (c.foto
    ? `<div class="relative w-[140px] h-[140px] rounded-lg overflow-hidden border border-line"><img src="${c.foto}" alt="Foto pelanggan" class="w-full h-full object-cover">
        <button type="button" data-pfoto-del class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center" aria-label="Hapus foto"><i data-lucide="x" class="ic-sm"></i></button></div>`
    : `<label class="w-[140px] h-[140px] border border-dashed border-[#A0A6A6] rounded-lg flex flex-col items-center justify-center text-center px-3 text-[12px] text-[#A0A6A6] gap-3 cursor-pointer hover:border-brand">
        <i data-lucide="upload" class="text-ink"></i>Pilih atau letakkan berkas di sini<input type="file" accept="image/jpeg,image/png" class="hidden" data-pfoto></label>`)
    + '<p data-pfoto-msg class="fmsg hidden"></p>';
  const nomor = String(c.telepon || '').replace(/^(\+?62|0)/, '');
  const telpField = `<div data-field="telepon"><p class="text-right text-[12px] text-[#A0A6A6] -mt-5 mb-1"><span data-count>${nomor.length}</span>/17</p>
    <div class="flex gap-2"><select class="fin fsel w-[96px] shrink-0" aria-label="Kode negara"><option>+62</option></select>
    <input name="telepon" class="fin flex-1 min-w-0" placeholder="Contoh: 812345678901" maxlength="17" inputmode="numeric" data-req="Mohon lengkapi nomor telepon" value="${esc(nomor)}"></div></div>`;
  const grups = db().grupPelanggan.filter(g => g.status || g.id === c.grup).map(g => [g.id, g.nama]);
  cardForm({
    title: `${isEdit ? 'Ubah' : 'Tambah'} Pelanggan`, noun: 'Pelanggan',
    body: fRow('Kode Pelanggan', fInput('kode', 'Contoh: PLG111', c.kode, { counter: 25, req: 'Mohon lengkapi kode pelanggan' }), { required: true })
      + fRow('Nama Pelanggan', fInput('nama', 'Contoh: Surya', c.nama, { counter: 50, req: 'Mohon lengkapi nama pelanggan' }), { required: true })
      + fRow('Nomor Telepon', telpField, { required: true })
      + fRow('Email', fInput('email', 'Contoh: sd@gmail.com', c.email || '', { counter: 50 }))
      + fRow('Jenis Kelamin', `<div class="grid grid-cols-2 gap-4">${fRadioCard('jk', 'L', 'Laki-Laki', c.jk !== 'P')}${fRadioCard('jk', 'P', 'Perempuan', c.jk === 'P')}</div>`)
      + fRow('Tanggal Lahir', `<div class="fin flex items-center"><input type="date" name="lahir" aria-label="Pilih Tanggal" class="flex-1 min-w-0 outline-none bg-transparent" value="${esc(c.lahir || '')}"></div>`)
      + fRow('Grup Pelanggan', fSelect('grup', grups, c.grup || '', 'Pilih'))
      + fRow('Kota', fSelect('kota', KOTA, c.kota || '', 'Pilih Kota'))
      + fRow('Alamat', fInput('alamat', 'Contoh: Jl Karya Agung Bersama No. 15A,Ruko Permata - Pamulang', c.alamat || '', { area: true, counter: 100 }))
      + fRow('Catatan', fInput('catatan', 'Masukkan Catatan', c.catatan || '', { area: true }))
      + fRow('Foto Pelanggan', `<div data-pfoto-field>${fotoBox()}</div>`, { help: 'Format gambar .jpg .jpeg .png dan ukuran minimum 100 x 100 (Untuk gambar optimal gunakan ukuran minimum 1000 x 1000 px).' }),
    // kode pelanggan harus unik
    collect: sh => {
      const v = formValues(sh.root);
      if (db().pelanggan.some(x => x !== item && x.kode === v.kode)) {
        const wrap = sh.root.querySelector('[data-field="kode"]');
        wrap.querySelector('.fin, input').classList.add('ferr');
        wrap.insertAdjacentHTML('beforeend', '<p class="fmsg">Kode pelanggan sudah digunakan</p>');
        return false;
      }
      return v;
    },
    confirmHtml: v => `Pelanggan <b>${esc(v.kode)}</b> akan disimpan dan tampil di daftar pelanggan sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?`,
    toastText: v => (isEdit ? 'Data berhasil diperbarui' : `Pelanggan ${esc(v.kode)} berhasil ditambahkan`),
    onSave: v => {
      const rec = item || { id: uid(), poin: 0, deposit: 0, saldo: 0, dibuat: new Date().toISOString() };
      Object.assign(rec, { kode: v.kode, nama: v.nama, telepon: v.telepon.replace(/\D/g, '').replace(/^(62|0)/, ''), email: v.email, jk: v.jk, lahir: v.lahir, grup: v.grup, kota: v.kota, alamat: v.alamat, catatan: v.catatan, foto: c.foto });
      if (!isEdit) db().pelanggan.unshift(rec);
      logAct(rec.nama, isEdit ? 'Ubah Pelanggan' : 'Tambah Pelanggan', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
    },
    onMount: sh => {
      const R = sh.root;
      const paintFoto = (msg = '') => {
        const f = R.querySelector('[data-pfoto-field]');
        f.innerHTML = fotoBox();
        const m = f.querySelector('[data-pfoto-msg]'); m.textContent = msg; m.classList.toggle('hidden', !msg);
        lucide.createIcons();
      };
      R.addEventListener('change', async e => {
        if (!e.target.matches('[data-pfoto]')) return;
        try { c.foto = await fileToFoto(e.target.files[0]); paintFoto(); } catch (err) { paintFoto(err.message); }
      });
      R.addEventListener('click', e => { if (e.target.closest('[data-pfoto-del]')) { c.foto = ''; paintFoto(); } });
    }
  });
}

async function hapusPelanggan(c) {
  if (!(await confirmDialog({ title: 'Hapus Pelanggan', html: `Menghapus <b>${esc(c.nama)}</b> akan secara permanen menghilangkan semua data yang terintegrasi termasuk kepemilikan dan riwayat rekam data. Proses ini tidak dapat dibatalkan. Lanjutkan?`, danger: true }))) return;
  db().pelanggan = db().pelanggan.filter(x => x !== c);
  logAct(c.nama, 'Hapus Pelanggan', 'Berhasil Dihapus');
  saveDB(); render();
  toast('Berhasil!', `Pelanggan <b>${esc(c.nama)}</b> berhasil dihapus`);
}

// ---------- detail & aktivitas pelanggan ----------
const AKTIVITAS = [
  ['Riwayat Transaksi', ['No Order', 'Produk', 'Tanggal', 'Total Transaksi (Rp)']],
  ['Transaksi Deposit', ['No Transaksi', 'Nama Deposit', 'Jenis Deposit', 'Nilai Deposit', 'Kedaluwarsa']],
  ['Transaksi Poin', ['Tanggal', 'No Transaksi', 'Referensi Asal', 'Tipe Mutasi', 'Penjualan (Rp)', 'Nilai Tukar (Rp)', 'Poin Didapat', 'Poin Ditukar', 'Poin Dibatalkan', 'Saldo Poin']],
  ['Riwayat Saldo', ['Nomor Transaksi', 'Tanggal', 'Outlet', 'Metode Bayar', 'Tipe Transaksi', 'Nominal']]
];
function detailPelanggan(c, aktivitas = false) {
  let tab = 0;
  const kv = (k, v) => `<div class="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)] gap-1"><span class="bg-[#F7F7F7] px-3 py-2.5 text-[14px] font-semibold">${k}</span><span class="bg-[#F7F7F7] px-3 py-2.5 text-[14px] break-words">${v || '-'}</span></div>`;
  const card = inner => `<div class="px-4 py-10"><section class="bg-white rounded-lg p-6 max-w-[1220px] mx-auto" style="box-shadow:rgba(0,0,0,.05) 0 1px 3px">${inner}</section></div>`;
  const info = () => {
    const last = pesananPelanggan(c).map(o => o.dibuat).sort().pop();
    return card(`<div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-[20px] font-semibold">Detail Pelanggan</h2>
        <button data-akt class="h-9 px-3 rounded-md border border-brand text-brand text-[14px] font-semibold">Lihat Aktivitas Pelanggan</button></div>
      <div class="flex flex-col items-center mt-2">
        ${c.foto ? `<img src="${c.foto}" alt="Foto ${esc(c.nama)}" class="w-[150px] h-[150px] rounded-lg object-cover">` : '<div class="w-[150px] h-[150px] border border-dashed border-[#A0A6A6] rounded-lg flex items-center justify-center text-[12px] text-[#A0A6A6]">Tidak ada foto</div>'}
        <p class="text-[12px] italic text-ink-3 mt-3">Terakhir aktif ${last ? nowText(new Date(last)) : '-'}</p>
        <p class="text-[12px] text-ink-3 mt-2">${c.poin || 0} Poin</p>
        <p class="text-[14px] font-semibold text-brand mt-5">Informasi</p></div>
      <div class="border-t-2 border-brand mt-3 pt-6 px-0 sm:px-4"><p class="text-[16px] font-semibold mb-4">Informasi Dasar</p>
        <div class="space-y-1">${kv('Kode Pelanggan', esc(c.kode))}${kv('Nama Pelanggan', esc(c.nama))}${kv('Tanggal Lahir', c.lahir ? `${tglText(c.lahir)} (Usia: ${usia(c.lahir)} Tahun)` : '- (Usia: 0 Tahun)')}
          ${kv('Jenis Kelamin', jkText(c))}${kv('Kota', esc(c.kota))}${kv('Alamat', esc(c.alamat))}${kv('Nomor Telepon', esc(telp(c)))}${kv('Email', esc(c.email))}${kv('Grup Pelanggan', c.grup ? esc(grupName(c.grup)) : '-')}</div></div>`);
  };
  const akt = () => {
    const [, cols] = AKTIVITAS[tab];
    const rows = tab ? [] : pesananPelanggan(c).filter(o => o.status === 'lunas').map(o => [o.id, esc(o.items.map(i => `${i.nama} x${i.qty}`).join(', ')), nowText(new Date(o.bayar?.waktu || o.dibuat)),
      rp(o.bayar ? o.bayar.diterima - o.bayar.kembalian : o.items.reduce((n, i) => n + i.harga * i.qty, 0))]);
    return card(`<button data-back class="text-brand text-[14px] font-semibold flex items-center gap-1"><i data-lucide="chevron-left" class="ic-sm"></i>Kembali</button>
      <h2 class="text-[20px] font-semibold mt-4">Aktivitas Pelanggan</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 mt-4 text-[14px]">${AKTIVITAS.map(([t], i) => `<button data-atab="${i}" class="py-3 border-b-2 ${i === tab ? 'border-brand text-brand font-semibold' : 'border-transparent text-ink-2'}">${t}</button>`).join('')}</div>
      <div class="flex flex-wrap items-center gap-2 mt-4">${tab === 3 ? '' : search('w-[200px]')}${dateBtn()}${tab === 3 ? `<div class="ml-auto">${linkBtn('Ekspor Data', 'download')}</div>` : ''}</div>
      <div class="overflow-x-auto mt-2"><table class="tbl w-full min-w-max"><thead><tr>${cols.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${rows.length ? pager(rows.length) : emptyTable()}`);
  };
  const sh = openSheet({ title: 'Detail Pelanggan', body: aktivitas ? akt() : info() });
  sh.root.querySelector('[data-foot]').classList.add('hidden');
  sh.root.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-akt]')) return sh.setBody(akt());
    if (t.closest('[data-back]')) return sh.setBody(info());
    const at = t.closest('[data-atab]');
    if (at) { tab = +at.dataset.atab; sh.setBody(akt()); }
  });
}

// ---------- Grup Pelanggan ----------
function grupForm(item) {
  const isEdit = !!item;
  const anggota = new Set(item ? db().pelanggan.filter(c => c.grup === item.id).map(c => c.id) : []);
  const chips = () => chipsHtml([...anggota].map(id => byId('pelanggan', id)).filter(Boolean).map(c => [c.id, c.nama]));
  cardForm({
    title: `${isEdit ? 'Ubah' : 'Tambah'} Grup Pelanggan`, noun: 'Grup Pelanggan', listName: 'pelanggan', cardTitle: 'Informasi Grup Pelanggan',
    body: fRow('Nama Grup', fInput('nama', 'Contoh: Grup Pelanggan Lama', item?.nama || '', { req: 'Mohon lengkapi nama grup' }), { required: true })
      + fRow('Status', fSwitch('status', item ? item.status : true), { top: false })
      + fRow('Deskripsi', fInput('deskripsi', 'Contoh: Grup ini berdomisili di Surabaya', item?.deskripsi || '', { area: true, rows: 3 }))
      + fRow('Urutan', fInput('urutan', 'Contoh: 10', item?.urutan ?? ''))
      + fRow('Atur Pelanggan', outlineAdd('Atur Pelanggan', 'data-pickcust') + `<div data-chips>${chips()}</div>`)
      + fRow('Atur Harga', fSelect('harga', db().hargaSpesial.map(h => [h.id, h.nama]), item?.harga || '', 'Pilih')),
    toastText: v => (isEdit ? 'Data berhasil diperbarui' : `Grup Pelanggan <b>${esc(v.nama)}</b> berhasil ditambahkan`),
    onSave: v => {
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, status: v.status, deskripsi: v.deskripsi, urutan: v.urutan, harga: v.harga });
      if (!isEdit) db().grupPelanggan.push(rec);
      // satu pelanggan hanya punya satu grup
      db().pelanggan.forEach(c => { if (anggota.has(c.id)) c.grup = rec.id; else if (c.grup === rec.id) c.grup = ''; });
      logAct(rec.nama, isEdit ? 'Ubah Grup Pelanggan' : 'Tambah Grup Pelanggan', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
    },
    onMount: sh => sh.root.addEventListener('click', async e => {
      const paint = () => { sh.root.querySelector('[data-chips]').innerHTML = chips(); lucide.createIcons(); };
      const un = e.target.closest('[data-unpick]');
      if (un) { anggota.delete(un.dataset.unpick); return paint(); }
      if (!e.target.closest('[data-pickcust]')) return;
      const r = await pickFrom({ title: 'Pilih Pelanggan', items: db().pelanggan.map(c => [c.id, c.nama]), selected: [...anggota] });
      if (r) { anggota.clear(); r.forEach(id => anggota.add(id)); paint(); }
    })
  });
}

// ---------- Grup Harga Spesial ----------
function presetPct(title) {
  const wait = confirmDialog({ title, html: `<p class="mb-3">Naikkan harga jual dari harga normal sebesar:</p><div class="fin flex items-center gap-3"><input id="presetPct" class="flex-1 outline-none" value="0" inputmode="numeric"><span>%</span></div><p class="text-[12px] text-ink-3 mt-2">Isi angka minus untuk menurunkan harga, mis. -10</p>`, ok: 'Terapkan' });
  // dialog dilepas dari DOM saat ditutup, jadi nilai dibaca selama dialog masih terbuka
  let pct = 0;
  const inp = document.getElementById('presetPct');
  inp.addEventListener('input', () => { pct = parseFloat(inp.value.replace(',', '.')) || 0; });
  return wait.then(ok => (ok ? pct : null));
}
function hargaSpesialForm(item) {
  const isEdit = !!item;
  const o = item ? JSON.parse(JSON.stringify(item)) : { nama: '', deskripsi: '', status: true, cabang: '', produk: [], ekstra: [] };
  const grup = new Set(item ? db().grupPelanggan.filter(g => g.harga === item.id).map(g => g.id) : []);
  const title = `${isEdit ? 'Ubah' : 'Tambah'} Grup Harga Spesial`;
  const head = '<tr style="background:#FAFAFA">';
  const prodTable = () => `<div class="overflow-x-auto"><table class="tbl w-full"><thead>${head}<th>Produk</th><th>Satuan</th><th>Harga Normal</th><th>Atur Harga</th></tr></thead><tbody>
    ${o.produk.map(x => { const p = byId('produk', x.id); return p ? `<tr><td>${esc(p.nama)}</td><td>${esc(p.satuan)}</td><td>${rp(p.hargaJual)}</td><td class="min-w-[180px]">${fInput('hs_' + x.id, '0', x.harga, { prefix: 'Rp', money: true })}</td></tr>` : ''; }).join('')}</tbody></table></div>${o.produk.length ? pager(o.produk.length) : emptyTable()}`;
  const eksTable = () => `<div class="overflow-x-auto"><table class="tbl w-full"><thead>${head}<th>Sub Ekstra</th><th>Produk Ekstra</th><th>Harga Awal</th><th>Harga Jual</th></tr></thead><tbody>
    ${o.ekstra.map(x => `<tr><td>${esc(x.sub)}</td><td>${esc(x.ekstra)}</td><td>${rp(x.awal)}</td><td class="min-w-[180px]">${fInput('hse_' + x.key, '0', x.harga, { prefix: 'Rp', money: true })}</td></tr>`).join('')}</tbody></table></div>${o.ekstra.length ? pager(o.ekstra.length) : emptyTable()}`;
  const chips = () => chipsHtml([...grup].map(id => byId('grupPelanggan', id)).filter(Boolean).map(g => [g.id, g.nama]));
  const section = (h, sub, rows) => `<section class="bg-white rounded-lg p-6 mb-6"><h2 class="text-[20px] font-semibold">${h}</h2><p class="text-[12px] text-ink-3 mt-1">${sub}</p>${rows}</section>`;
  const btnRow = (label, btn) => `<div class="flex items-center justify-between gap-3 mt-6"><p class="text-[14px] font-semibold">${label}</p>${btn}</div>`;
  const sh = openSheet({
    title,
    body: `<div class="px-4 py-10"><div class="max-w-[982px] mx-auto">
      <section data-info class="bg-white rounded-lg p-6 mb-6">
        ${fRow('Pilih Cabang', fSelect('cabang', OUTLETS, o.cabang, 'Silahkan pilih cabang'))}
        ${fRow('Status', fSwitch('status', o.status, 'Tampilkan harga spesial pada aplikasi kasir'), { top: false })}
        ${fRow('Nama Tipe', fInput('nama', 'Contoh: Grup Pelanggan Lama', o.nama, { counter: 100, req: 'Mohon lengkapi nama tipe' }), { required: true })}
        ${fRow('Deskripsi', fInput('deskripsi', 'Contoh: Harga ini khusus pelanggan lama', o.deskripsi, { area: true }))}
        ${fRow('Grup Pelanggan', outlineAdd('Pilih Grup Pelanggan', 'data-pickgrup') + `<div data-chips>${chips()}</div>`)}</section>
      ${section('Atur Produk &amp; Harga', 'Atur dan sesuaikan harga spesial produk untuk grup pelanggan yang dipilih',
        btnRow('Daftar Produk', fBtn.primary('<span class="flex items-center gap-2"><i data-lucide="plus" class="ic-sm"></i>Pilih Produk</span>', 'type="button" data-hs-prod'))
        + btnRow('Atur Harga', fBtn.outline('Preset Harga Produk', 'type="button" data-hs-preset="produk"').replace('px-6', 'px-3')) + `<div data-prod-table class="mt-4">${prodTable()}</div>`)}
      ${section('Atur Ekstra &amp; Harga', 'Atur dan sesuaikan harga spesial produk ekstra untuk grup pelanggan yang dipilih',
        btnRow('Daftar Ekstra', fBtn.primary('<span class="flex items-center gap-2"><i data-lucide="plus" class="ic-sm"></i>Pilih Ekstra</span>', 'type="button" data-hs-eks'))
        + btnRow('Atur Harga', fBtn.outline('Preset Harga Ekstra', 'type="button" data-hs-preset="ekstra"').replace('px-6', 'px-3')) + `<div data-eks-table class="mt-4">${eksTable()}</div>`)}
    </div></div>`,
    footer: `<div class="ml-auto flex items-center gap-8">${fBtn.text('Batal', 'data-cancel')}${fBtn.primary('Simpan', 'data-save')}</div>`
  });
  const R = sh.root;
  // harga yang sedang diketik dibaca dulu sebelum tabel digambar ulang
  const readPrices = () => {
    o.produk.forEach(x => { const i = R.querySelector(`[name="hs_${x.id}"]`); if (i) x.harga = toNum(i.value); });
    o.ekstra.forEach(x => { const i = R.querySelector(`[name="hse_${x.key}"]`); if (i) x.harga = toNum(i.value); });
  };
  const repaint = () => { R.querySelector('[data-prod-table]').innerHTML = prodTable(); R.querySelector('[data-eks-table]').innerHTML = eksTable(); R.querySelector('[data-chips]').innerHTML = chips(); lucide.createIcons(); };
  const cancel = async () => { if (await confirmCancel(title)) sh.close(); };
  sh.onClose = cancel;
  R.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-cancel]')) return cancel();
    const un = t.closest('[data-unpick]');
    if (un) { readPrices(); grup.delete(un.dataset.unpick); return repaint(); }
    if (t.closest('[data-pickgrup]')) {
      const r = await pickFrom({ title: 'Pilih Grup Pelanggan', items: db().grupPelanggan.map(g => [g.id, g.nama]), selected: [...grup] });
      if (r) { readPrices(); grup.clear(); r.forEach(id => grup.add(id)); repaint(); }
      return;
    }
    if (t.closest('[data-hs-prod]')) {
      readPrices();
      const r = await pickProducts(o.produk.map(x => x.id));
      if (r) { o.produk = r.filter(id => byId('produk', id)).map(id => o.produk.find(x => x.id === id) || { id, harga: byId('produk', id).hargaJual }); repaint(); }
      return;
    }
    if (t.closest('[data-hs-eks]')) {
      readPrices();
      const r = await pickFrom({ title: 'Pilih Ekstra', items: db().ekstra.map(ek => [ek.id, ek.nama]), selected: [...new Set(o.ekstra.map(x => x.key.split('_')[0]))], ok: 'Simpan' });
      if (r) {
        o.ekstra = db().ekstra.filter(ek => r.includes(ek.id)).flatMap(ek => ek.sub.map((s, i) => { const key = ek.id + '_' + i; return o.ekstra.find(x => x.key === key) || { key, sub: s.nama, ekstra: ek.nama, awal: s.harga, harga: s.harga }; }));
        repaint();
      }
      return;
    }
    const pr = t.closest('[data-hs-preset]');
    if (pr) {
      const kind = pr.dataset.hsPreset;
      if (!(kind === 'produk' ? o.produk : o.ekstra).length) return toast('Info', `Pilih ${kind} terlebih dahulu`);
      const pct = await presetPct(kind === 'produk' ? 'Preset Harga Produk' : 'Preset Harga Ekstra');
      if (pct === null) return;
      readPrices();
      const adj = n => Math.max(0, Math.round(n * (1 + pct / 100) / 500) * 500);
      if (kind === 'produk') o.produk.forEach(x => { x.harga = adj(byId('produk', x.id).hargaJual); });
      else o.ekstra.forEach(x => { x.harga = adj(x.awal); });
      return repaint();
    }
    if (t.closest('[data-save]')) {
      const info = R.querySelector('[data-info]');
      if (!validate(info)) return info.scrollIntoView();
      readPrices();
      const v = formValues(info);
      if (!(await confirmSave('Grup Harga Spesial', v.nama))) return;
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, deskripsi: v.deskripsi, status: v.status, cabang: v.cabang, produk: o.produk, ekstra: o.ekstra });
      if (!isEdit) db().hargaSpesial.push(rec);
      db().grupPelanggan.forEach(g => { if (grup.has(g.id)) g.harga = rec.id; else if (g.harga === rec.id) g.harga = ''; });
      logAct(rec.nama, isEdit ? 'Ubah Grup Harga Spesial' : 'Tambah Grup Harga Spesial', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
      saveDB(); sh.close(); render();
      toast('Berhasil!', isEdit ? 'Data berhasil diperbarui' : `Grup Harga Spesial <b>${esc(rec.nama)}</b> berhasil ditambahkan`);
    }
  });
}

// ---------- halaman daftar ----------
Object.assign(LISTS, {
  'daftar-pelanggan': {
    title: 'Daftar Pelanggan', help: true, add: ['Tambah Pelanggan', () => pelangganForm()], check: true, colPick: true,
    links: `<button data-act="ekspor-pel" class="h-9 px-2 text-brand text-[14px] font-semibold flex items-center gap-2 whitespace-nowrap"><i data-lucide="download" class="ic-sm"></i>Ekspor Data<i data-lucide="chevron-down" class="ic-sm"></i></button>${linkBtn('Impor Data', 'upload')}`,
    acts: { 'ekspor-pel': el => rowMenu(el, [['Informasi Utama', () => toast('Berhasil!', 'Data sedang diekspor. Berkas dapat diunduh di menu <b>Daftar Ekspor</b>')]]) },
    extraFilters: () => `<select class="fin fsel w-[200px] min-h-0 h-9" aria-label="Data"><option>Semua Data</option></select>
      <select disabled class="fin fsel w-[160px] min-h-0 h-9 bg-[#F2F2F2] text-[#A0A6A6] cursor-not-allowed" aria-label="Data field"><option>Pilih Data Field</option></select>`,
    items: s => db().pelanggan.filter(c => (c.nama + c.kode + telp(c)).toLowerCase().includes(s.q)),
    cols: ['Nama', 'Kode Pelanggan', 'Alamat', 'Telepon', 'Jenis Kelamin', 'Email', 'Tanggal Lahir', 'Poin', 'Saldo Deposit', 'Saldo', 'Grup Pelanggan', 'Kepemilikan'],
    hide: ['Email', 'Tanggal Lahir', 'Saldo', 'Grup Pelanggan', 'Kepemilikan'],
    row: c => [esc(c.nama), esc(c.kode), esc(c.alamat || ''), esc(telp(c)), jkText(c), esc(c.email || ''), c.lahir ? tglText(c.lahir) : '', c.poin || 0, rp(c.deposit || 0), rp(c.saldo || 0), c.grup ? esc(grupName(c.grup)) : '', OUTLETS[0]],
    menu: c => [['Ubah', () => pelangganForm(c)], ['Lihat Daftar Transaksi Pelanggan', () => detailPelanggan(c, true)], ['Lihat Detail Pelanggan', () => detailPelanggan(c)], ['Hapus', () => hapusPelanggan(c)]],
    // centang baris: Pilih Grup + Ubah Grup(n) + Hapus(n)
    bulk: {
      noun: 'pelanggan', coll: 'pelanggan', log: 'Pelanggan', ph: 'Pilih Grup', diubah: 'Grup pelanggan berhasil diubah',
      ops: () => db().grupPelanggan.map(g => [g.nama, c => { c.grup = g.id; }]),
      terapLabel: n => `Ubah Grup(${n})`, hapusLabel: n => `Hapus(${n})`,
      hapus: n => ({ title: 'Hapus Pelanggan', html: `Menghapus <b>${n} pelanggan</b> akan secara permanen menghilangkan semua data yang terintegrasi termasuk kepemilikan dan riwayat rekam data. Proses ini tidak dapat dibatalkan. Lanjutkan?` })
    }
  },
  'grup-pelanggan': {
    title: 'Grup Pelanggan', help: true, add: ['Tambah Grup Pelanggan', () => grupForm()], edit: g => grupForm(g),
    items: s => db().grupPelanggan.filter(g => g.nama.toLowerCase().includes(s.q)).sort((a, b) => (+a.urutan || 0) - (+b.urutan || 0)),
    cols: ['Urutan', 'Nama Grup', 'Deskripsi', 'Pelanggan Terdaftar', 'Status'],
    row: g => [esc(g.urutan || ''), esc(g.nama), esc(g.deskripsi || ''), db().pelanggan.filter(c => c.grup === g.id).length, statusBadge(g.status, 'Aktif', 'Tidak Aktif')]
  },
  'grup-harga-spesial': {
    title: 'Grup Harga Spesial', help: true, add: ['Tambah Grup Harga Spesial', () => hargaSpesialForm()], edit: h => hargaSpesialForm(h),
    items: s => db().hargaSpesial.filter(h => h.nama.toLowerCase().includes(s.q)),
    cols: ['Tipe', 'Deskripsi', 'Produk Terdaftar', 'Pelanggan Terdaftar', 'Status'],
    row: h => [esc(h.nama), esc(h.deskripsi || ''), h.produk.length, pelangganHarga(h).length, statusBadge(h.status, 'Aktif', 'Tidak Aktif')]
  }
});
['daftar-pelanggan', 'grup-pelanggan', 'grup-harga-spesial'].forEach(slug => { PAGES[slug] = () => listPage(slug); });
