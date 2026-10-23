// Grup Produk interaktif (Penjualan > Produk): daftar + form tambah/ubah/hapus, alur popup sesuai referensi.
// Data disimpan di localStorage per mode data ("contoh"/"kosong") — hanya untuk prototipe di browser ini.

// penyimpanan data (db, saveDB, logAct, byId, ...) ada di store.js — dipakai bersama halaman Kasir

// ---------- alur popup standar ----------
const confirmSave = (noun, nama, html) => confirmDialog({ title: `Simpan ${noun}`, html: html || `${noun} <b>${esc(nama)}</b> akan disimpan dan tampil di daftar ${noun.toLowerCase()} sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?` });
const confirmCancel = (what, html) => confirmDialog({ title: `Batal ${what}`, html: html || `Membatalkan <b>${what}</b> akan menghapus seluruh data yang telah diinput dan tidak dapat dibatalkan. Lanjutkan?`, danger: true });
const confirmDelete = (noun, nama, tail = 'secara permanen dan tidak dapat dibatalkan') => confirmDialog({ title: `Hapus ${noun}`, html: `Menghapus ${noun.toLowerCase()} <b>${esc(nama)}</b> akan menghilangkan ${noun.toLowerCase()} tersebut ${tail}. Lanjutkan?`, danger: true });

async function deleteFlow(coll, item, noun, extra, tail) {
  if (!(await confirmDelete(noun, item.nama, tail))) return;
  db()[coll] = db()[coll].filter(x => x !== item);
  if (extra) extra();
  logAct(item.nama, `Hapus ${noun}`, 'Berhasil Dihapus');
  saveDB(); render();
  toast('Berhasil!', `${noun} <b>${esc(item.nama)}</b> berhasil dihapus`);
}

// form satu kartu (Departemen, Kategori, Ekstra) dengan footer Batal + Simpan
function cardForm({ title, noun, listName, cardTitle, body, onMount, collect, onSave, toastText, confirmHtml, width = 'max-w-[982px]' }) {
  const sh = openSheet({
    title,
    body: `<div class="px-4 py-10"><div class="${width} mx-auto">${formCard(body, cardTitle)}</div></div>`,
    footer: `<div class="ml-auto flex items-center gap-8">${fBtn.text('Batal', 'data-cancel')}${fBtn.primary('Simpan', 'data-save')}</div>`
  });
  const cancel = async () => { if (await confirmCancel(title)) sh.close(); };
  sh.onClose = cancel;
  sh.root.querySelector('[data-cancel]').onclick = cancel;
  sh.root.querySelector('[data-save]').onclick = async () => {
    if (!validate(sh.root)) return;
    const v = collect ? collect(sh) : formValues(sh.root);
    if (v === false) return;
    const html = confirmHtml ? confirmHtml(v) : listName ? `${noun} <b>${esc(v.nama)}</b> akan disimpan dan tampil di daftar ${listName} sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?` : null;
    if (!(await confirmSave(noun, v.nama, html))) return;
    onSave(v); saveDB(); sh.close(); render();
    toast('Berhasil!', toastText(v));
  };
  if (onMount) onMount(sh);
  return sh;
}

// ---------- Departemen ----------
function departemenForm(item) {
  const isEdit = !!item;
  const kats = db().kategori;
  const list = kats.length
    ? kats.map(k => `<label class="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 text-[14px]"><input type="checkbox" name="kat_${k.id}" class="w-4 h-4 accent-[#04C99E]" ${isEdit && k.departemen === item.id ? 'checked' : ''}>${esc(k.nama)}</label>`).join('')
    : '<p class="text-center text-[14px] text-ink-2 py-4">Tidak ada data</p>';
  cardForm({
    title: `${isEdit ? 'Ubah' : 'Tambah'} Departemen`, noun: 'Departemen', cardTitle: 'Informasi Departemen',
    body: fRow('Nama Departemen', fInput('nama', 'Contoh: Makanan', item?.nama || '', { req: 'Mohon lengkapi nama departemen' }), { required: true })
      + fRow('Urutan Tampilan', fInput('urutan', 'Contoh: 1', item?.urutan ?? '', { req: 'Mohon lengkapi urutan tampilan' }), { required: true })
      + fRow('Daftar Kategori', `${search('w-full h-10')}<div class="border border-[#D6D9D9] rounded-md mt-2 max-h-[220px] overflow-auto">${list}</div>`, { help: 'Silakan pilih kategori yang sesuai untuk departemen yang akan dibuat' }),
    toastText: () => 'Data berhasil diperbarui',
    onSave: v => {
      const rec = item || { id: uid() };
      rec.nama = v.nama; rec.urutan = v.urutan;
      if (!isEdit) db().departemen.push(rec);
      kats.forEach(k => { if (v['kat_' + k.id]) k.departemen = rec.id; else if (k.departemen === rec.id) k.departemen = ''; });
      logAct(rec.nama, isEdit ? 'Ubah Departemen' : 'Tambah Departemen', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
    }
  });
}

// ---------- Kategori ----------
function kategoriForm(item, onSaved) {
  const isEdit = !!item;
  cardForm({
    title: `${isEdit ? 'Ubah' : 'Tambah'} Kategori`, noun: 'Kategori',
    body: fRow('Atur Outlet', fSelect('outlet', OUTLETS) + fChip('by cafe'), { required: true })
      + fRow('Nama Kategori', fInput('nama', 'Contoh: Snack', item?.nama || '', { req: 'Mohon lengkapi nama kategori' }), { required: true })
      + fRow('Ikon Kategori', fUpload(), { help: 'Gunakan rasio gambar 1:1 dengan ukuran 10Kb dan maksimal 100Kb, Format foto .jpg .jpeg .png ukuran minimum 100px x 100px (Untuk gambar optimal gunakan ukuran maksimum 512px x 512px)' })
      + fRow('Urutan', fInput('urutan', 'Contoh: 1', item?.urutan ?? '', { req: 'Mohon lengkapi urutan' }), { required: true })
      + fRow('Departemen', fSelect('departemen', db().departemen.map(d => [d.id, d.nama]), item?.departemen || '', 'Pilih'))
      + fRow('Tampil di Menu', fSwitch('tampil', item ? item.tampil : true, 'Tampilkan kategori pada aplikasi kasir')),
    toastText: v => isEdit ? 'Data berhasil diperbarui' : `Kategori <b>${esc(v.nama)}</b> berhasil ditambahkan`,
    onSave: v => {
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, urutan: v.urutan, departemen: v.departemen, tampil: v.tampil });
      if (!isEdit) db().kategori.push(rec);
      logAct(rec.nama, isEdit ? 'Ubah Kategori' : 'Tambah Kategori', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
      if (onSaved) onSaved(rec);
    }
  });
}

// popup kecil "Tambah Kategori" dari form produk (Buat Kategori Baru)
function kategoriCepat(onSaved) {
  const z = (layer += 2);
  const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${z}">
    <form class="bg-white rounded-lg w-[400px] max-w-full" novalidate><div class="flex items-center justify-between px-6 py-4"><h3 class="text-[18px] font-semibold">Tambah Kategori</h3><button type="button" data-x aria-label="Tutup"><i data-lucide="x"></i></button></div>
      <div class="px-6 pb-2 space-y-4"><div>${lbl('Nama Kategori', 1)}${fInput('nama', 'Contoh: Makanan', '', { req: 'Mohon lengkapi nama kategori' })}</div><div>${lbl('Urutan')}${fInput('urutan', '0', String(db().kategori.length + 1))}</div></div>
      <div class="flex justify-end items-center gap-6 px-6 py-4">${fBtn.text('Batal', 'type="button" data-x')}${fBtn.primary('Simpan', 'type="submit"')}</div></form></div>`);
  const close = () => { d.remove(); layer -= 2; };
  d.querySelectorAll('[data-x]').forEach(b => { b.onclick = close; });
  d.querySelector('form').onsubmit = ev => {
    ev.preventDefault();
    if (!validate(d)) return;
    const v = formValues(d), k = { id: uid(), nama: v.nama, urutan: +v.urutan || 0, departemen: '', tampil: true };
    db().kategori.push(k); logAct(k.nama, 'Tambah Kategori', 'Berhasil Ditambahkan'); saveDB();
    close(); onSaved(k); toast('Berhasil!', `Kategori <b>${esc(k.nama)}</b> berhasil ditambahkan`);
  };
  document.body.appendChild(d); lucide.createIcons(); d.querySelector('[name=nama]').focus();
}

// ---------- Produk: wizard 5 langkah ----------
const STEPS = ['Informasi Produk', 'Varian', 'Ekstra', 'Resep', 'Toko Online'];
const lbl = (t, r) => `<p class="text-[12px] font-medium mb-2">${t}${r ? req : ''}</p>`;
const tour = (key, html) => `<div data-tour="${key}">${html}</div>`;

function stepper(steps, cur, done, o = {}) {
  return `<nav class="bg-white rounded-lg py-5 px-6" style="box-shadow:rgba(0,0,0,.05) 0 1px 3px"><ul class="border-l-2 border-[#EEEEEE] space-y-1">${steps.map((s, i) => {
    const soon = (o.soon || []).includes(s);
    const active = i === cur, ok = done.has(i) && !active;
    return `<li><button data-step="${i}" ${soon ? 'disabled' : ''} class="relative -ml-0.5 flex items-center gap-2 w-full text-left py-2 pl-5 text-[14px] font-semibold ${active ? 'text-brand border-l-4 border-brand' : ok ? 'text-ink' : 'text-[#A0A6A6]'}">
      ${ok ? '<i data-lucide="check-circle-2" class="ic-sm text-white" style="fill:#04C99E"></i>' : ''}${s}${soon ? '<span class="text-[12px] font-medium text-[#DF2A36] bg-[#FDECEC] rounded px-1.5 py-0.5">Coming Soon</span>' : ''}</button></li>`;
  }).join('')}</ul></nav>`;
}

// baris resep: bahan dari Daftar Bahan Baku (Inventori); harga modal & satuan ikut satuan dasar bahan
const bahanInfo = id => { const b = byId('bahan', id); return b ? { harga: b.satuan[0]?.hargaBeli || 0, satuan: b.satuan[0]?.nama || '' } : { harga: 0, satuan: '' }; };
function bahanRow(b = {}) {
  const inf = bahanInfo(b.bahan);
  return `<div data-bahan class="grid sm:grid-cols-[1fr_1fr_32px] gap-x-3 gap-y-3 items-end pb-4 mb-4 border-b border-line">
    <div>${lbl('Bahan Baku')}${fSelect('bahan_nama', db().bahan.map(x => [x.id, x.nama]), b.bahan || '', 'Pilih')}</div>
    <div>${lbl('Harga Modal')}<div class="fin flex items-center gap-3 bg-[#F2F2F2] text-[#A0A6A6]"><span>Rp</span><span data-bahan-modal>${inf.harga.toLocaleString('id-ID')}</span></div></div>
    <button type="button" data-del-bahan class="pb-2 text-ink-2" aria-label="Hapus bahan"><i data-lucide="trash-2"></i></button>
    <div>${lbl('Takaran')}${fInput('bahan_takaran', '0', b.takaran ?? '')}</div>
    <div>${lbl('Satuan')}<div class="fin flex items-center bg-[#F2F2F2] text-[#A0A6A6]" data-bahan-satuan>${esc(inf.satuan) || 'Satuan'}</div></div></div>`;
}
// ---------- varian produk: tipe (mis. Ukuran) x nilai (mis. Regular, Large) → daftar kombinasi ----------
function varianCombos(tipe) {
  return tipe.filter(t => t.nilai.length).reduce((acc, t) => acc.flatMap(a => t.nilai.map(n => [...a, n])), [[]]).filter(c => c.length).map(c => c.join(' / '));
}
function varianBody(v) {
  const chip = (i, j, n) => `<span class="inline-flex items-center gap-1.5 bg-brand-soft text-brand-dark rounded px-2 py-1 text-[12px] font-medium">${esc(n)}<button type="button" data-vt-del="${i}:${j}" aria-label="Hapus ${esc(n)}"><i data-lucide="x" class="ic-sm"></i></button></span>`;
  const tipe = v.tipe.map((t, i) => `<div class="rounded-md bg-[#F7F7F7] p-4 mb-3">
      <div class="grid sm:grid-cols-[200px_1fr_32px] gap-3 items-start"><div>${lbl('Tipe Varian', 1)}<input data-vt-nama="${i}" class="fin" placeholder="Contoh: Ukuran" value="${esc(t.nama)}"></div>
        <div>${lbl('Pilihan Varian', 1)}<div class="fin flex flex-wrap items-center gap-2 py-1.5 min-h-[40px]">${t.nilai.map((n, j) => chip(i, j, n)).join('')}<input data-vt-nilai="${i}" class="flex-1 min-w-[140px] outline-none text-[14px]" placeholder="Ketik lalu tekan Enter"></div></div>
        <button type="button" data-vt-rm="${i}" class="mt-8 text-ink-2" aria-label="Hapus tipe varian"><i data-lucide="trash-2"></i></button></div></div>`).join('');
  const rows = v.items.map((it, i) => `<tr><td class="whitespace-nowrap font-medium">${esc(it.nama)}</td>
      <td><input data-vi="${i}:sku" class="fin min-w-[110px]" value="${esc(it.sku)}" placeholder="SKU"></td>
      <td><div class="fin flex items-center gap-2 min-w-[140px]"><span class="text-ink-3">Rp</span><input data-vi="${i}:hargaJual" data-money inputmode="numeric" class="flex-1 min-w-0 outline-none" value="${it.hargaJual ? toNum(it.hargaJual).toLocaleString('id-ID') : ''}" placeholder="0"></div></td>
      <td><button type="button" class="sw" data-vi-sw="${i}" data-on="${it.aktif ? 1 : 0}" aria-checked="${!!it.aktif}" role="switch"></button></td></tr>`).join('');
  return fRow('Produk Memiliki Varian', fSwitch('varian', v.aktif, 'Aktifkan bila produk punya pilihan ukuran, rasa, warna, dll'), { top: false })
    + `<div data-if="varian" class="${v.aktif ? '' : 'hidden'}">
      ${fRow('Atur Varian', `${tipe}${v.tipe.length < 2 ? '<button type="button" data-vt-add class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold">Tambah Tipe Varian</button>' : ''}<p class="text-[12px] text-ink-3 mt-2">Maksimal 2 tipe varian, mis. Ukuran dan Rasa</p>`)}
      ${fRow('Daftar Varian', v.items.length ? `<div class="overflow-x-auto"><table class="tbl w-full"><thead><tr style="background:#FAFAFA"><th>Varian</th><th>SKU</th><th>Harga Jual</th><th>Tampil</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<p class="text-[14px] text-ink-3 pt-2.5">Isi tipe dan pilihan varian untuk membuat daftar varian</p>')}</div>`;
}
// ---------- ekstra produk: bisa lebih dari satu grup ekstra ----------
function ekstraRows(ids) {
  return ids.map((id, i) => {
    const e = byId('ekstra', id);
    return `<div class="pb-4 mb-4 border-b border-line"><div class="grid grid-cols-[1fr_32px] gap-3 items-end"><div>${lbl('Nama Ekstra')}<select data-eks-sel="${i}" class="fin fsel ${id ? '' : 'text-[#A0A6A6]'}"><option value="">Pilih Ekstra</option>${db().ekstra.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''} ${x.id !== id && ids.includes(x.id) ? 'disabled' : ''}>${esc(x.nama)}</option>`).join('')}</select></div>
      <button type="button" data-del-eks="${i}" class="pb-2 text-ink-2" aria-label="Hapus ekstra"><i data-lucide="trash-2"></i></button></div>
      ${e ? `<p class="text-[12px] text-ink-3 mt-2">${e.jenis === 'Mandatory' ? 'Wajib' : 'Opsional'} · ${e.cara === 'Many' ? `Pilih beberapa${e.maks ? ` (maks. ${e.maks})` : ''}` : 'Pilih salah satu'}</p>
        ${e.sub.map(s => `<div class="grid grid-cols-2 gap-3 mt-3"><div>${lbl('Nama Pilihan Ekstra')}<div class="fin flex items-center bg-[#F2F2F2] text-ink-3">${esc(s.nama)}</div></div><div>${lbl('Harga Jual')}<div class="fin flex items-center gap-3 bg-[#F2F2F2] text-ink-3"><span>Rp.</span>${s.harga.toLocaleString('id-ID')}</div></div></div>`).join('')}` : ''}</div>`;
  }).join('');
}

// ---------- foto produk ----------
const MAX_FOTO = 5;
// foto diperkecil ke sisi terpanjang 480px (JPEG) supaya muat di localStorage
function fileToFoto(file, max = 480) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png)$/.test(file.type)) return reject(new Error('Format foto harus .jpg, .jpeg, atau .png'));
    if (file.size > 1024 * 1024) return reject(new Error('Ukuran foto maksimal 1Mb'));
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Berkas tidak dapat dibaca sebagai gambar'));
    img.src = URL.createObjectURL(file);
  });
}
function fotoField(fotos) {
  return `<div class="flex flex-wrap gap-3">
    ${fotos.map((f, i) => `<div class="relative w-[140px] h-[140px] rounded-lg overflow-hidden border border-line">
      <img src="${f}" alt="Foto produk ${i + 1}" class="w-full h-full object-cover">
      ${i === 0 ? '<span class="absolute left-2 bottom-2 text-[11px] font-semibold bg-brand text-white rounded px-1.5 py-0.5">Utama</span>' : ''}
      <button type="button" data-foto-del="${i}" class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center" aria-label="Hapus foto"><i data-lucide="x" class="ic-sm"></i></button></div>`).join('')}
    ${fotos.length < MAX_FOTO ? `<label class="w-[140px] h-[140px] border border-dashed border-[#A0A6A6] rounded-lg flex flex-col items-center justify-center text-center px-3 text-[12px] text-[#A0A6A6] gap-3 cursor-pointer hover:border-brand">
      <i data-lucide="upload" class="text-ink"></i>Pilih atau letakkan berkas di sini (${fotos.length} dari ${MAX_FOTO} berkas)
      <input type="file" accept="image/jpeg,image/png" multiple class="hidden" data-foto-input></label>` : ''}
  </div><p data-foto-msg class="fmsg hidden"></p>`;
}

function produkSteps(p) {
  const kats = db().kategori.map(k => [k.id, k.nama]);
  const info = formCard(
    tour('outlet', fRow('Daftar Outlet', fSelect('outlet', OUTLETS) + fChip('by cafe'), { required: true }))
    + tour('nama', fRow('Nama Produk', fInput('nama', 'Contoh: nasi padang', p.nama, { area: true, counter: 255, req: 'Mohon lengkapi nama produk' }), { required: true })
      + fRow('Deskripsi Produk', fInput('deskripsi', 'Contoh: yang best seller', p.deskripsi, { area: true, rows: 3 }))
      + fRow('Foto Produk', `<div data-foto-field>${fotoField(p.foto || [])}</div>`, { help: 'Gunakan rasio foto 1:1 dengan ukuran 10Kb dan maksimal 1Mb, Format foto .jpg .jpeg .png ukuran minimum 100px x 100px (Untuk gambar optimal gunakan ukuran maksimum 1000px x 1000px). Maksimal 5 foto' }))
    + tour('kategori', fRow('Kategori Produk', fSelect('kategori', kats, p.kategori, 'Pilih Kategori', { req: 'Mohon pilih kategori produk' })
      + `<p class="text-[12px] mt-3">Kategori belum tersedia?<button type="button" data-newkat class="text-brand text-[14px] font-semibold ml-6">Buat Kategori Baru</button></p>`, { required: true }))
    + tour('opsi', fRow('Opsi Lanjutan', fCheck('favorit', p.favorit, 'Produk Favorit') + fCheck('tampil', p.tampil, 'Tampil di Menu')))
    + tour('monitor', fRow('Monitor Persediaan', fSwitch('monitor', p.monitor, 'Aktifkan Monitor Persediaan')
      + `<p class="text-[12px] font-medium mt-5 mb-2 flex items-center gap-1">Stok Minimum Produk <i data-lucide="info" class="ic-sm text-ink-3"></i></p>` + fInput('stokMin', 'Contoh: 20', p.stokMin, { disabled: !p.monitor })))
    + fRow('Serial Number', upsell('Fitur Serial Number hanya tersedia pada paket prime. Silahkan upgrade ke paket <b>Prime</b> untuk menggunakan fitur ini.'), { help: 'Kasir wajib memilih manual serial number saat penjualan' })
    + fRow('Batch Number <i data-lucide="info" class="ic-sm inline text-brand"></i>', upsell('Fitur Batch Number hanya tersedia pada paket prime. Silahkan upgrade ke paket <b>Prime</b> untuk menggunakan fitur ini.'))
    + fRow('Grup', fSelect('grup', [], '', 'Pilih') + `<div class="mt-3">${fCheck('induk', false, 'Tetapkan sebagai Induk')}</div>`)
    + fRow('Izinkan Ubah Produk Tidak Dijual', fSwitch('ubahTidakDijual', false, 'Izinkan kasir mengubah produk menjadi tidak tersedia/tidak dapat dijual di POS/Order Online')),
    'Informasi Produk')
  + formCard(
    tour('satuan', fRow('Satuan', `<div class="grid sm:grid-cols-2 gap-4">
        <div>${lbl('Satuan', 1)}${fInput('satuan', 'Pilih Satuan', p.satuan, { req: 'Mohon lengkapi satuan' })}</div>
        <div>${lbl('SKU', 1)}${fInput('sku', 'Contoh: S001', p.sku, { req: 'Mohon lengkapi SKU' })}</div>
        <div>${lbl('Konversi')}${fInput('konversi', '', '1', { disabled: true, suffix: esc(p.satuan) || '&nbsp;' })}</div>
        <div>${lbl('Min. Pembelian', 1)}${fInput('minBeli', 'Min. Pembelian', p.minBeli || 1)}</div></div>`, { required: true }))
    + tour('harga', fRow('Harga', `<div class="grid sm:grid-cols-2 gap-4">
        <div>${lbl('Harga Jual', 1)}${fInput('hargaJual', '0', p.hargaJual || '', { prefix: 'Rp', money: true, num: true, req: 'Mohon lengkapi harga jual' })}</div>
        <div>${lbl('Harga Beli')}${fInput('hargaBeli', '0', '', { prefix: 'Rp', disabled: true })}</div></div>`, { required: true }))
    + tour('dimensi', fRow('Dimensi Produk', `<div class="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-4 sm:gap-x-10 items-end">
        <div>${lbl('Volume (dalam Panjang x Lebar x Tinggi) <i data-lucide="info" class="ic-sm inline text-brand"></i>')}<div class="flex items-center gap-3">${p.dimensi.map((d, i) => `<input name="dim${i}" class="fin text-center" style="width:98px" value="${d}">`).join('')}<span class="text-[14px]">cm</span></div></div>
        <div>${lbl('Berat <i data-lucide="info" class="ic-sm inline text-brand"></i>')}${fInput('berat', '', p.berat, { suffix: 'gram' })}</div></div>`, { required: true }))
    + fRow('', `<button type="button" data-addunit class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold">Tambah Satuan</button>`)
    + '<hr class="border-line my-3">'
    + fRow('Ubah Harga Jual', fSwitch('ubahHarga', p.ubahHarga, 'Izinkan kasir untuk mengubah harga jual')
      + `<div class="mt-3">${fInput('maksUbah', 'Harga jual dalam %', '0%', { prefix: 'Maks.', disabled: !p.ubahHarga })}</div>`
      + `<p class="text-[12px] mt-2 flex items-center gap-2"><i data-lucide="info" class="ic-sm text-ink-3"></i>Pastikan harga jual lebih tinggi dari harga beli</p>`)
    + fRow('Harga Grosir', upsell('Fitur Harga Grosir memudahkan untuk memberikan harga lebih rendah kepada pelanggan yang melakukan pembelian dalam jumlah tertentu (semakin besar kuantitas pembelian, semakin rendah harga jual).'), { help: 'Maksimal 5 harga grosir' }),
    'Harga dan Satuan');
  const varian = formCard(`<div data-varian-body>${varianBody(p.varian)}</div>`, 'Varian Produk');
  const ekstra = formCard(
    fRow('Produk Memiliki Ekstra', `<div class="flex items-center gap-4">${fSwitch('ekstra', p.ekstra)}<i data-lucide="info" class="ic-sm text-ink-3"></i></div>`, { top: false })
    + `<div data-if="ekstra" class="${p.ekstra ? '' : 'hidden'}">
      ${fRow('Ubah Data Ekstra', `<div class="flex items-center gap-4">${fSwitch('ubahEkstra', false)}<i data-lucide="info" class="ic-sm text-ink-3"></i></div>`, { top: false })}
      ${fRow('Atur Ekstra', `<div data-eks-list>${ekstraRows(p.ekstraIds)}</div><button type="button" data-add-eks class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold">Tambah Ekstra</button>`)}</div>`, 'Ekstra');
  const resep = formCard(
    infoBox('Baru!', 'Gunakan Master resep untuk memilih resep yang sudah tersedia, khusus pengguna paket Advance, Prime dan Prime+', 'Pengaturan Resep')
    + '<div class="h-3"></div>' + fRow('Resep Produk', fSwitch('resep', p.resep, 'Aktifkan untuk menambahkan resep pada produk'), { top: false })
    + `<div data-if="resep" class="${p.resep ? '' : 'hidden'}">
      ${fRow('Pengaturan Master Resep', `<div class="grid sm:grid-cols-2 gap-4">${[['manual', 'Resep Manual Bahan Baku', 'Pada resep manual bahan baku, Anda akan dapat menentukan sendiri resep dengan bahan baku yang ada'], ['master', 'Resep Menggunakan Master Resep', 'Pada resep menggunakan master resep, Anda akan dapat memilih resep yang sudah tersedia pada master resep']].map(([v, t, d]) => `<label class="block border rounded-md p-3 cursor-pointer has-[:checked]:border-brand border-[#D6D9D9]"><span class="flex items-center gap-3 text-[14px]"><input type="radio" name="resepMode" value="${v}" class="w-4 h-4 accent-[#04C99E]" ${(p.resepMode || 'manual') === v ? 'checked' : ''}>${t}</span><span class="block text-[12px] text-ink-3 mt-1.5 pl-7">${d}</span></label>`).join('')}</div>`)}
      <div data-resep-manual class="${p.resepMode === 'master' ? 'hidden' : ''}">${fRow('Atur Bahan Baku', `<div data-bahan-list>${(p.bahan || []).filter(b => b.bahan).map(bahanRow).join('')}</div>
        <button type="button" data-add-bahan class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold">Tambah Bahan Baku</button>
        <p class="text-[13px] mt-3">Harga modal dari resep: <b data-resep-modal>Rp 0</b></p>`)}</div>
      <div data-resep-master class="${p.resepMode === 'master' ? '' : 'hidden'}">${fRow('Master Resep', fSelect('masterResep', [], '', 'Pilih Master Resep') + '<p class="text-[12px] text-ink-3 mt-2">Belum ada master resep. Master resep dibuat di menu Produk &gt; Master Resep.</p>')}</div></div>`, 'Resep');
  const online = formCard(`<div class="flex flex-col items-center py-10 text-center">
      <svg viewBox="0 0 200 150" class="w-[220px]" aria-hidden="true"><ellipse cx="110" cy="70" rx="80" ry="60" fill="#DDF7EF"/><rect x="40" y="30" width="120" height="78" rx="8" fill="#04C99E"/><rect x="48" y="52" width="104" height="48" rx="3" fill="#BDF1E2"/><path d="M40 38h120v14H40z" fill="#10AF8C"/><circle cx="75" cy="76" r="10" fill="none" stroke="#04C99E" stroke-width="5"/><circle cx="100" cy="76" r="10" fill="none" stroke="#04C99E" stroke-width="5"/><circle cx="125" cy="76" r="10" fill="none" stroke="#04C99E" stroke-width="5"/><rect x="88" y="108" width="24" height="14" fill="#10AF8C"/><rect x="70" y="120" width="60" height="8" rx="4" fill="#04C99E"/></svg>
      <p class="text-[14px] mt-6 max-w-[480px]">Outlet ini belum terintegrasi dengan marketplace, silakan lakukan proses integrasi terlebih dahulu untuk menggunakan fitur ini</p>
      <button type="button" class="mt-6 h-10 px-6 rounded-md bg-brand text-white text-[14px] font-semibold">Integrasikan Sekarang</button></div>`, 'Toko Online');
  return [info, varian, ekstra, resep, online];
}

const TOUR_PRODUK = [
  { target: '[data-tour=outlet]', title: 'Daftar Outlet', text: 'Tambahkan produk pada outlet yang diinginkan' },
  { target: '[data-tour=nama]', title: 'Informasi Produk', text: '<b>Tips:</b> Gunakan nama produk yang berbeda untuk setiap produk' },
  { target: '[data-tour=kategori]', title: 'Kategori Produk', text: 'Buat kategori untuk mengelompokan produk-produk yang serupa' },
  { target: '[data-tour=opsi]', title: 'Opsi Lanjutan', text: '<b>Produk Favorit:</b> Aktifkan untuk menjadikan produk menjadi produk favorit<br><br><b>Tampil di menu:</b> Aktifkan untuk menampilkan produk di halaman kasir' },
  { target: '[data-tour=monitor]', title: 'Monitor Persediaan', text: 'Aktifkan monitor persediaan untuk memantau kuantitas produk' },
  { target: '[data-tour=satuan]', title: 'Satuan &amp; Konversi', text: 'Sesuaikan satuan produk untuk memudahkan pembelian berdasarkan ukuran/jumlah<br><br>Contoh: Pieces, Kg, Gram, dll' },
  { target: '[data-tour=harga]', title: 'Harga Jual', text: 'Harga Jual adalah harga yang akan dibayar oleh pembeli dan akan tampil pada menu di kasir' },
  { target: '[data-tour=dimensi]', title: 'Dimensi Produk', text: 'Atur dimensi untuk produk yang dapat dikirim menggunakan jasa ekspedisi' }
];
const tourSeen = () => { try { return localStorage.getItem('tour-produk') === '1'; } catch (e) { return true; } };
const markTour = () => { try { localStorage.setItem('tour-produk', '1'); } catch (e) { /* abaikan */ } };

function produkWizard(item) {
  const isEdit = !!item;
  const p = item ? JSON.parse(JSON.stringify(item)) : { nama: '', deskripsi: '', kategori: '', satuan: '', sku: '', minBeli: 1, hargaJual: '', favorit: false, tampil: true, monitor: false, stokMin: 0, ekstra: false, ekstraId: '', resep: false, bahan: [], dimensi: [1, 1, 1], berat: 100, ubahHarga: false };
  // data lama: satu ekstraId → daftar ekstraIds; varian kosong
  p.ekstraIds = p.ekstraIds || (p.ekstraId ? [p.ekstraId] : []);
  if (p.ekstra && !p.ekstraIds.length) p.ekstraIds = [''];
  p.varian = p.varian || { aktif: false, tipe: [{ nama: '', nilai: [] }], items: [] };
  const title = isEdit ? 'Ubah Produk' : 'Tambahkan Produk';
  let cur = 0; const done = new Set();
  const panes = produkSteps(p);
  const sh = openSheet({
    title,
    body: `<div class="grid lg:grid-cols-[311px_1fr] gap-6 px-6 py-10 items-start"><div data-stepper class="lg:sticky lg:top-0"></div>
      <div>${panes.map((h, i) => `<div data-pane="${i}" class="${i ? 'hidden' : ''}">${h}</div>`).join('')}</div></div>`
  });
  const R = sh.root;
  const paint = () => {
    R.querySelector('[data-stepper]').innerHTML = stepper(STEPS, cur, done);
    R.querySelectorAll('[data-pane]').forEach(el => el.classList.toggle('hidden', +el.dataset.pane !== cur));
    sh.setFooter(`<div class="hidden lg:flex w-[311px] shrink-0 justify-end">${isEdit ? '<button data-hapus-produk class="w-12 h-10 rounded-md border border-danger text-danger flex items-center justify-center" aria-label="Hapus produk"><i data-lucide="trash-2" class="ic-sm"></i></button>' : ''}</div>${fBtn.text('Batal', 'data-cancel')}
      <div class="ml-auto flex items-center gap-6">${cur ? fBtn.text('Kembali', 'data-prev') : ''}${cur < STEPS.length - 1 ? fBtn.text('Selanjutnya', 'data-next') : ''}${fBtn.primary('Simpan', 'data-save')}</div>`);
    R.querySelector('[data-body]').scrollTop = 0;
    lucide.createIcons();
  };
  const go = i => { done.add(cur); cur = i; paint(); };
  const cancel = async () => { if (await confirmCancel(title)) sh.close(); };
  sh.onClose = cancel;

  R.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-step]')) return go(+t.closest('[data-step]').dataset.step);
    if (t.closest('[data-next]')) return go(cur + 1);
    if (t.closest('[data-prev]')) return go(cur - 1);
    if (t.closest('[data-cancel]')) return cancel();
    if (t.closest('[data-newkat]')) return kategoriCepat(k => {
      const sel = R.querySelector('select[name=kategori]');
      sel.insertAdjacentHTML('beforeend', `<option value="${k.id}">${esc(k.nama)}</option>`);
      sel.value = k.id; sel.classList.remove('text-[#A0A6A6]');
      sel.closest('[data-field]')?.querySelectorAll('.fmsg').forEach(m => m.remove()); sel.classList.remove('ferr');
    });
    if (t.closest('[data-hapus-produk]')) {
      if (!(await confirmDelete('Produk', item.nama))) return;
      db().produk = db().produk.filter(x => x !== item);
      logAct(item.nama, 'Hapus Produk', 'Berhasil Dihapus'); saveDB(); sh.close(); render();
      return toast('Berhasil!', `Produk <b>${esc(item.nama)}</b> berhasil dihapus`);
    }
    if (t.closest('[data-vt-add]')) { readVarian(); p.varian.tipe.push({ nama: '', nilai: [] }); return paintVarian(); }
    if (t.closest('[data-vt-rm]')) { readVarian(); p.varian.tipe.splice(+t.closest('[data-vt-rm]').dataset.vtRm, 1); if (!p.varian.tipe.length) p.varian.tipe.push({ nama: '', nilai: [] }); syncVarian(); return paintVarian(); }
    if (t.closest('[data-vt-del]')) { readVarian(); const [i, j] = t.closest('[data-vt-del]').dataset.vtDel.split(':').map(Number); p.varian.tipe[i].nilai.splice(j, 1); syncVarian(); return paintVarian(); }
    if (t.closest('[data-add-eks]')) { p.ekstraIds.push(''); return paintEks(); }
    if (t.closest('[data-del-eks]')) { p.ekstraIds.splice(+t.closest('[data-del-eks]').dataset.delEks, 1); return paintEks(); }
    if (t.closest('[data-addunit]')) return toast('Info', 'Multi satuan tidak tersedia pada paket starter');
    if (t.closest('[data-add-bahan]')) { R.querySelector('[data-bahan-list]').insertAdjacentHTML('beforeend', bahanRow()); return lucide.createIcons(); }
    if (t.closest('[data-del-bahan]')) { t.closest('[data-bahan]').remove(); return paintModal(); }
    if (t.closest('[data-save]')) {
      if (!validate(R.querySelector('[data-pane="0"]'))) { if (cur) go(0); return; }
      const v = formValues(R);
      Object.assign(p, {
        nama: v.nama, deskripsi: v.deskripsi, kategori: v.kategori, satuan: v.satuan, sku: v.sku, minBeli: +v.minBeli || 1,
        hargaJual: toNum(v.hargaJual), favorit: v.favorit, tampil: v.tampil, monitor: v.monitor, stokMin: +v.stokMin || 0,
        resep: v.resep, resepMode: v.resepMode || 'manual', dimensi: [v.dim0, v.dim1, v.dim2].map(x => +x || 1), berat: +v.berat || 0, ubahHarga: v.ubahHarga,
        bahan: v.resep ? resepRows() : []
      });
      p.ekstraIds = v.ekstra ? p.ekstraIds.filter(Boolean) : [];
      Object.assign(p, { ekstra: p.ekstraIds.length > 0, ekstraId: p.ekstraIds[0] || '' });
      readVarian();
      if (p.varian.aktif) {
        if (!p.varian.items.length) { go(1); return toast('Gagal!', 'Lengkapi tipe dan pilihan varian', 'error'); }
        if (p.varian.items.some(it => !(toNum(it.hargaJual) > 0))) { go(1); return toast('Gagal!', 'Harga jual setiap varian wajib diisi', 'error'); }
        p.varian.items.forEach(it => { it.hargaJual = toNum(it.hargaJual); });
      }
      // harga modal ikut resep bila resep aktif
      if (p.resep && p.bahan.length) p.hargaModal = p.bahan.reduce((n, b) => n + b.takaran * bahanInfo(b.bahan).harga, 0);
      reviewProduk(p, { onSave: async rv => {
        const ok = await confirmDialog({ title: 'Simpan', html: `Produk <b>${esc(p.nama)}</b> akan disimpan dan tampil di daftar produk (termasuk POS, Order Online, Outlet, dll) sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?` });
        if (!ok) return;
        if (isEdit) Object.assign(item, p); else db().produk.push({ hargaModal: 0, hargaBeli: 0, ...p, id: uid() });
        logAct(p.nama, isEdit ? 'Ubah Produk' : 'Tambah Produk', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
        saveDB(); rv.close(); sh.close(); render();
        toast('Berhasil!', `Produk <b>${esc(p.nama)}</b> berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}`);
      } });
    }
  });
  // field yang bergantung pada saklar
  R.addEventListener('sw', e => {
    const n = e.target.dataset.name, on = e.detail;
    if (n === 'monitor') R.querySelector('[name=stokMin]').disabled = !on;
    if (n === 'ubahHarga') { const i = R.querySelector('[name=maksUbah]'); i.disabled = !on; i.closest('.fin').classList.toggle('bg-[#F2F2F2]', !on); }
    if (n === 'ekstra' || n === 'resep' || n === 'varian') R.querySelector(`[data-if=${n}]`).classList.toggle('hidden', !on);
    if (n === 'varian') p.varian.aktif = on;
    if (n === 'ekstra' && on && !p.ekstraIds.length) { p.ekstraIds.push(''); paintEks(); }
    if (e.target.dataset.viSw !== undefined) p.varian.items[+e.target.dataset.viSw].aktif = on;
  });
  // ---- varian ----
  const readVarian = () => {
    R.querySelectorAll('[data-vt-nama]').forEach(el => { p.varian.tipe[+el.dataset.vtNama].nama = el.value.trim(); });
    R.querySelectorAll('[data-vi]').forEach(el => { const [i, f] = el.dataset.vi.split(':'); p.varian.items[+i][f] = f === 'hargaJual' ? toNum(el.value) : el.value.trim(); });
  };
  // daftar varian dibuat ulang dari kombinasi pilihan; harga/SKU yang sudah diisi dipertahankan
  const syncVarian = () => {
    const lama = Object.fromEntries(p.varian.items.map(it => [it.nama, it]));
    const sku = R.querySelector('[name=sku]').value.trim() || 'VAR', harga = toNum(R.querySelector('[name=hargaJual]').value);
    p.varian.items = varianCombos(p.varian.tipe).map((nama, i) => lama[nama] || { nama, sku: `${sku}-${i + 1}`, hargaJual: harga, aktif: true });
  };
  const paintVarian = () => { R.querySelector('[data-varian-body]').innerHTML = varianBody(p.varian); lucide.createIcons(); };
  R.addEventListener('keydown', e => {
    if (!e.target.matches('[data-vt-nilai]') || (e.key !== 'Enter' && e.key !== ',')) return;
    e.preventDefault();
    const i = +e.target.dataset.vtNilai, val = e.target.value.trim();
    if (!val) return;
    readVarian();
    if (!p.varian.tipe[i].nilai.includes(val)) p.varian.tipe[i].nilai.push(val);
    syncVarian(); paintVarian();
    R.querySelector(`[data-vt-nilai="${i}"]`)?.focus();
  });
  // ---- ekstra ----
  const paintEks = () => { R.querySelector('[data-eks-list]').innerHTML = ekstraRows(p.ekstraIds); lucide.createIcons(); };
  R.addEventListener('change', e => { if (e.target.matches('[data-eks-sel]')) { p.ekstraIds[+e.target.dataset.eksSel] = e.target.value; paintEks(); } });
  // ---- resep ----
  const resepRows = () => [...R.querySelectorAll('[data-bahan]')].map(b => ({ bahan: b.querySelector('select').value, takaran: parseFloat(String(b.querySelector('[name=bahan_takaran]').value).replace(',', '.')) || 0 })).filter(b => b.bahan);
  const paintModal = () => { const el = R.querySelector('[data-resep-modal]'); if (el) el.textContent = rp(resepRows().reduce((n, b) => n + b.takaran * bahanInfo(b.bahan).harga, 0)); };
  R.addEventListener('change', e => {
    if (e.target.name === 'resepMode') { R.querySelector('[data-resep-manual]').classList.toggle('hidden', e.target.value !== 'manual'); R.querySelector('[data-resep-master]').classList.toggle('hidden', e.target.value === 'manual'); }
    if (e.target.name === 'bahan_nama') { const row = e.target.closest('[data-bahan]'), inf = bahanInfo(e.target.value); row.querySelector('[data-bahan-modal]').textContent = inf.harga.toLocaleString('id-ID'); row.querySelector('[data-bahan-satuan]').textContent = inf.satuan || 'Satuan'; paintModal(); }
  });
  R.addEventListener('input', e => { if (e.target.name === 'bahan_takaran') paintModal(); });
  R.addEventListener('input', e => { if (e.target.name === 'satuan') R.querySelector('[name=konversi]').closest('.fin').querySelector('[data-suffix]').textContent = e.target.value; });
  // foto produk: unggah, perkecil, hapus; foto pertama jadi foto utama di kasir
  p.foto = p.foto || [];
  const paintFoto = (msg = '') => {
    const f = R.querySelector('[data-foto-field]');
    f.innerHTML = fotoField(p.foto);
    const m = f.querySelector('[data-foto-msg]'); m.textContent = msg; m.classList.toggle('hidden', !msg);
    lucide.createIcons();
  };
  R.addEventListener('change', async e => {
    if (!e.target.matches('[data-foto-input]')) return;
    const files = [...e.target.files].slice(0, MAX_FOTO - p.foto.length);
    let msg = e.target.files.length > files.length ? `Maksimal ${MAX_FOTO} foto` : '';
    for (const f of files) { try { p.foto.push(await fileToFoto(f)); } catch (err) { msg = err.message; } }
    paintFoto(msg);
  });
  R.addEventListener('click', e => { const d = e.target.closest('[data-foto-del]'); if (d) { p.foto.splice(+d.dataset.fotoDel, 1); paintFoto(); } });
  paint(); paintModal();

  if (!isEdit && !tourSeen()) {
    const start = () => runTour(R, TOUR_PRODUK, { onDone: async () => {
      markTour();
      const r = await confirmDialog({ title: 'Panduan Selesai!', html: 'Anda telah menyelesaikan panduan pembuatan produk. Sudah siap untuk menambahkan produk anda sendiri?', ok: 'Oke', cancel: '', extra: 'Ulangi Panduan' });
      if (r === 'extra') start();
      R.querySelector('[data-body]').scrollTop = 0;
    } });
    setTimeout(start, 300);
  }
}

// ringkasan produk (dipakai untuk konfirmasi sebelum simpan dan menu Detail)
function produkDetailHtml(p) {
  const kv = (k, v) => `<div class="grid grid-cols-[180px_1fr] gap-1"><span class="bg-[#F7F7F7] px-2 py-2.5 text-[14px] font-semibold">${k}</span><span class="bg-[#F7F7F7] px-2 py-2.5 text-[14px]">${v || ''}</span></div>`;
  const tbl = (cols, rows) => `<div class="overflow-x-auto"><table class="tbl w-full"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length ? pager(rows.length) : emptyTable()}`;
  const eksList = (p.ekstraIds || (p.ekstraId ? [p.ekstraId] : [])).map(id => byId('ekstra', id)).filter(Boolean);
  return `<section class="bg-white rounded-lg p-6 max-w-[982px] mx-auto" style="box-shadow:rgba(0,0,0,.05) 0 1px 3px">
    <h2 class="text-[20px] font-semibold mb-8">Detail Produk</h2>
    <p class="text-[14px] font-semibold mb-3">Informasi Produk:</p>
    <div class="space-y-1">${kv('Daftar Outlet', 'by cafe')}${kv('Nama Produk', esc(p.nama))}${kv('Deskripsi', esc(p.deskripsi))}${kv('Kategori', esc(katName(p.kategori)))}${kv('Foto Produk', (p.foto || []).map(f => `<img src="${f}" alt="" class="inline-block w-14 h-14 object-cover rounded mr-2">`).join(''))}${kv('Grup Induk', '')}</div>
    <p class="text-[14px] font-semibold mt-8 mb-2">Harga dan Satuan:</p>
    ${tbl(['Satuan', 'Harga Beli', 'Harga Jual', 'SKU', 'Min. Pembelian'], [[esc(p.satuan), rp(p.hargaBeli || 0), rp(p.hargaJual) + ',00', esc(p.sku), p.minBeli]])}
    <p class="text-[14px] font-semibold mt-10 mb-2">Harga Grosir</p>${tbl(['Jumlah Minimal', 'Harga Satuan'], [])}
    <p class="text-[14px] font-semibold mt-10 mb-2">Varian</p>${tbl(['Varian', 'Harga Modal', 'Harga Beli', 'Harga Jual', 'SKU', 'Status'], p.varian?.aktif ? p.varian.items.map(it => [esc(it.nama), rp(0), rp(0), rp(toNum(it.hargaJual)), esc(it.sku), it.aktif ? 'Tampil' : 'Tidak Tampil']) : [])}
    <p class="text-[14px] font-semibold mt-10 mb-2">Ekstra</p>${eksList.length ? eksList.map(e => `<p class="text-[14px]">${esc(e.nama)}: ${e.sub.map(s => esc(s.nama)).join(', ')}</p>`).join('') : '<p class="text-[14px] text-ink-3">-</p>'}
    <p class="text-[14px] font-semibold mt-10 mb-2">Resep</p>${tbl(['Bahan Baku', 'Takaran', 'Satuan', 'Harga Modal'], (p.bahan || []).filter(b => b.bahan).map(b => [esc(byId('bahan', b.bahan)?.nama || '-'), esc(b.takaran), esc(bahanInfo(b.bahan).satuan), rp(b.takaran * bahanInfo(b.bahan).harga)]))}
    <p class="text-[14px] font-semibold mt-10 mb-3">Toko Online:</p>
    <div class="space-y-1">${kv('Status', 'Tidak Aktif')}${kv('Spesifikasi Produk', '')}</div>
  </section>`;
}
function reviewProduk(p, { onSave }) {
  const rv = openSheet({ title: 'Detail Produk', body: `<div class="px-4 py-10">${produkDetailHtml(p)}</div>`,
    footer: `<div class="ml-auto flex items-center gap-6">${fBtn.text('Kembali', 'data-back')}${fBtn.primary('Simpan', 'data-ok')}</div>` });
  rv.root.querySelector('[data-back]').onclick = () => rv.close();
  rv.root.querySelector('[data-ok]').onclick = () => onSave(rv);
}
function detailProduk(p) {
  const d = openSheet({ title: 'Detail Produk', body: `<div class="px-4 py-10">${produkDetailHtml(p)}</div>`,
    footer: `<div class="ml-auto flex items-center gap-6">${fBtn.text('Kembali', 'data-back')}${fBtn.primary('Ubah Produk', 'data-edit')}</div>` });
  d.root.querySelector('[data-back]').onclick = () => d.close();
  d.root.querySelector('[data-edit]').onclick = () => { d.close(); produkWizard(p); };
}

// ---------- Atur Per Outlet ----------
function aturPerOutlet(p) {
  const steps = ['Harga dan Satuan', 'Varian', 'Resep', 'Opsi Lanjutan', 'Harga Grosir', 'Ekstra'];
  let cur = 0; const done = new Set();
  const kv = (k, v) => `<div class="grid grid-cols-[160px_1fr] gap-1"><span class="bg-[#F7F7F7] px-2 py-2.5 text-[14px] font-semibold">${k}</span><span class="bg-[#F7F7F7] px-2 py-2.5 text-[14px]">${v || ''}</span></div>`;
  const panes = [
    formCard(`<div class="space-y-1">${kv('Nama Produk', esc(p.nama))}${kv('Deskripsi', esc(p.deskripsi))}${kv('Kategori', esc(katName(p.kategori)))}${kv('Grup Induk', '')}</div>`, 'Informasi Produk')
    + formCard(`<div class="flex items-center justify-between -mt-12 mb-6"><span></span>${fBtn.outline('<span class="flex items-center gap-2"><i data-lucide="plus" class="ic-sm"></i>Tambah Satuan</span>', 'type="button"')}</div>
      <div class="border-b border-line"><span class="inline-block px-5 py-3 text-[14px] font-medium border-b-2 border-brand">${esc(p.satuan)}</span></div>
      <table class="tbl w-full mt-2"><thead><tr><th>Outlet</th><th>Harga Jual</th><th>Min. Pembelian</th></tr></thead><tbody><tr><td>by cafe</td><td>${rp(p.hargaJual)}</td><td>${p.minBeli}</td></tr></tbody></table>`, 'Harga dan Satuan'),
    formCard(infoBox('', "Tipe varian diambil dari detail produk. Gunakan menu 'Ubah Produk' jika ingin mengubah tipe varian") + emptyTable(), 'Varian'),
    formCard(infoBox('', "Data resep diambil dari detail produk. Gunakan menu 'Ubah Produk' jika ingin memilih Resep Dengan Manual Bahan Baku") + emptyTable(), 'Resep'),
    formCard(infoBox('Baru!', 'Buat Grup Outlet untuk mempermudah pengaturan multi-outlet secara terpusat', 'Atur Grup Outlet') + `<div class="mt-4">${search('w-[300px]')}</div>
      <div class="overflow-x-auto"><table class="tbl w-full mt-2"><thead><tr><th class="w-8"><input type="checkbox"></th><th>Outlet/Grup Outlet</th><th>Tampil di Menu</th><th>Favorit</th><th>Ubah Harga Jual</th><th>Maksimal Perubahan</th></tr></thead>
      <tbody><tr><td><input type="checkbox"></td><td>by cafe</td><td>${fSwitch('o_tampil', p.tampil)}</td><td>${fSwitch('o_fav', p.favorit)}</td><td>${fSwitch('o_ubah', p.ubahHarga)}</td><td><input class="fin w-[200px] bg-[#F2F2F2]" value="0%" disabled></td></tr></tbody></table></div>`, 'Opsi Lanjutan')
  ];
  const sh = openSheet({ title: 'Pengaturan Per Outlet', body: `<div class="grid lg:grid-cols-[311px_1fr] gap-6 px-6 py-10 items-start"><div data-stepper></div><div>${panes.map((h, i) => `<div data-pane="${i}" class="${i ? 'hidden' : ''}">${h}</div>`).join('')}</div></div>` });
  const R = sh.root;
  const paint = () => {
    R.querySelector('[data-stepper]').innerHTML = stepper(steps, cur, done, { soon: ['Harga Grosir', 'Ekstra'] });
    R.querySelectorAll('[data-pane]').forEach(el => el.classList.toggle('hidden', +el.dataset.pane !== cur));
    sh.setFooter(`<div class="hidden lg:block w-[311px] shrink-0"></div>${fBtn.outline('Batal', 'data-cancel')}<div class="ml-auto flex items-center gap-6">${cur ? fBtn.text('Kembali', 'data-prev') : ''}${cur < 3 ? fBtn.text('Selanjutnya', 'data-next') : ''}${fBtn.primary('Simpan', 'data-save')}</div>`);
  };
  const cancel = async () => { if (await confirmDialog({ title: 'Atur Per Outlet', html: 'Membatalkan <b>Atur Per Outlet</b> akan menghapus seluruh data yang telah diinput dan tidak dapat dibatalkan. Lanjutkan?', danger: true, cancel: 'Kembali' })) sh.close(); };
  sh.onClose = cancel;
  R.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-step]')) { done.add(cur); cur = +t.closest('[data-step]').dataset.step; return paint(); }
    if (t.closest('[data-next]')) { done.add(cur); cur++; return paint(); }
    if (t.closest('[data-prev]')) { cur--; return paint(); }
    if (t.closest('[data-cancel]')) return cancel();
    if (t.closest('[data-save]')) {
      const v = formValues(R); Object.assign(p, { tampil: v.o_tampil, favorit: v.o_fav, ubahHarga: v.o_ubah });
      logAct(p.nama, 'Atur Per Outlet', 'Berhasil Diubah'); saveDB(); sh.close(); render(); toast('Berhasil!', 'Data berhasil diperbarui');
    }
  });
  paint();
}

// ---------- Impor produk (wizard 2 langkah) ----------
function imporWizard(kind) {
  let cur = 0;
  const panes = [
    formCard(fRow('Pilih Outlet', fSelect('outlet', OUTLETS) + fChip('by cafe'), { required: true, help: 'Pilih outlet yang akan dilakukan Impor Produk' })
      + '<hr class="border-line my-3">'
      + fRow('Template', `<label class="block border border-[#D6D9D9] rounded-md p-3 has-[:checked]:border-brand"><span class="flex items-center gap-3 text-[14px]"><input type="radio" name="tpl" value="baru" checked class="w-4 h-4 accent-[#04C99E]">Belum memiliki Template</span>
          <span class="block text-[12px] font-medium mt-3">Gunakan template yang telah disediakan di bawah ini</span>
          <button type="button" data-tpl class="mt-3 w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold flex items-center justify-center gap-2"><i data-lucide="download" class="ic-sm"></i>Ekspor Template</button></label>
        <label class="block border border-[#D6D9D9] rounded-md p-3 mt-4 has-[:checked]:border-brand"><span class="flex items-center gap-3 text-[14px]"><input type="radio" name="tpl" value="ada" class="w-4 h-4 accent-[#04C99E]">Sudah memiliki Template</span>
          <span class="block text-[12px] font-medium mt-3">Pastikan telah menggunakan template yang disediakan</span></label>`, { required: true, help: 'Tentukan template berkas yang akan digunakan' }), 'Ekspor Template')
    + formCard(`<ul class="list-disc pl-6 space-y-2 text-[14px] font-medium">${['Lengkapi setiap kolom yang memiliki tanda bintang (*) karena bersifat wajib diisi',
      'Untuk kolom lain yang bersifat opsional tanpa tanda bintang (*), Anda dapat melengkapi atau mengosongkannya sesuai kebutuhan',
      'Jika Anda mengisi kolom Harga Beli Satuan #1 dan QTY Stok Awal, maka secara otomatis akan membentuk transaksi stok awal',
      'Kolom QTY Stok Awal diisi dengan angka tanpa pemisahan ribuan (contoh: 1000)',
      'Apabila bilangan desimal, gunakan tanda koma (,) sebagai pemisah dengan maksimal 2 angka dibelakangnya (contoh: 10,25)',
      'Pastikan mengimpor berkas dalam format Microsoft Excel (.xls atau .xlsx)',
      'Multi satuan tidak tersedia pada paket starter',
      'Produk varian tidak dapat diubah pada template Impor Ubah Produk',
      'Data Resep dan Ekstra tidak dapat diubah pada template Impor Ubah Produk'].map(x => `<li>${x}</li>`).join('')}</ul>`, 'Perhatikan'),
    formCard(`<p class="text-[14px] mb-4">Saat mengimpor data produk, pastikan format sesuai dengan file template yang disediakan.</p>`
      + fRow('Outlet', fSelect('outlet2', OUTLETS, '', 'Pilih', { disabled: true }) + fChip('by cafe'))
      + `<div data-field="berkas" class="mt-4"><label class="block border border-dashed border-[#A0A6A6] rounded-lg h-[140px] flex flex-col items-center justify-center gap-3 text-[12px] text-[#A0A6A6] cursor-pointer"><i data-lucide="upload" class="text-ink"></i><span data-fname>Pilih dan letakkan template disini</span><input type="file" accept=".xls,.xlsx" class="hidden" name="berkas"></label></div>`, 'Impor Data')
  ];
  const sh = openSheet({ title: kind, body: `<div class="grid lg:grid-cols-[311px_1fr] gap-6 px-6 py-10 items-start"><div data-stepper></div><div>${panes.map((h, i) => `<div data-pane="${i}" class="${i ? 'hidden' : ''}">${h}</div>`).join('')}</div></div>` });
  const R = sh.root;
  const paint = () => {
    R.querySelector('[data-stepper]').innerHTML = stepper(['Ekspor Template', 'Impor Template'], cur, new Set(cur ? [0] : []));
    R.querySelectorAll('[data-pane]').forEach(el => el.classList.toggle('hidden', +el.dataset.pane !== cur));
    sh.setFooter(`<div class="ml-auto flex items-center gap-6">${cur ? fBtn.text('Kembali', 'data-prev') + fBtn.primary('Simpan', 'data-save') : fBtn.text('Batal', 'data-cancel') + fBtn.primary('Selanjutnya', 'data-next')}</div>`);
  };
  const cancel = async () => { if (await confirmCancel(kind)) sh.close(); };
  sh.onClose = cancel;
  R.addEventListener('change', e => { if (e.target.name === 'berkas') R.querySelector('[data-fname]').textContent = e.target.files[0]?.name || 'Pilih dan letakkan template disini'; });
  R.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-tpl]')) return toast('Berhasil!', 'Template sedang diunduh');
    if (t.closest('[data-next]')) { cur = 1; return paint(); }
    if (t.closest('[data-prev]')) { cur = 0; return paint(); }
    if (t.closest('[data-cancel]')) return cancel();
    if (t.closest('[data-save]')) {
      const f = R.querySelector('[name=berkas]');
      R.querySelectorAll('[data-field=berkas] .fmsg').forEach(m => m.remove());
      if (!f.files.length) return R.querySelector('[data-field=berkas]').insertAdjacentHTML('beforeend', '<p class="fmsg">Mohon pilih berkas template terlebih dahulu</p>');
      sh.close(); toast('Berhasil!', 'Berkas sedang diproses. Hasil impor dapat dilihat pada Log Aktivitas');
    }
  });
  paint();
}

// ---------- Log Aktivitas ----------
function logModal() {
  const rows = db().log;
  const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${layer += 2}">
    <div class="bg-white rounded-lg w-[1000px] max-w-full max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-5 border-b border-line"><h3 class="text-[20px] font-semibold">Log Aktivitas</h3><button data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
      <div class="px-6 py-4 overflow-auto">
        <div class="flex flex-wrap items-center gap-3"><p class="text-[14px] text-ink-2 flex items-center gap-2"><i data-lucide="info" class="ic-sm"></i>Menampilkan seluruh aktivitas yang dilakukan dalam 14 hari terakhir</p><div class="ml-auto">${search('w-[240px]')}</div></div>
        <div class="overflow-x-auto"><table class="tbl w-full mt-3"><thead><tr><th>Tanggal</th><th>Nama Produk</th><th>Jenis Perubahan</th><th>Sebelum</th><th>Sesudah</th><th>User</th><th>Aksi</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.waktu}</td><td>${esc(r.nama)}</td><td>${r.jenis}</td><td>${r.sebelum}</td><td>${r.sesudah}</td><td>${r.user}</td><td><i data-lucide="eye" class="ic-sm"></i></td></tr>`).join('')}</tbody></table></div>
        ${rows.length ? pager(rows.length) : emptyTable()}
      </div>
      <div class="flex justify-end px-6 py-5 border-t border-line">${fBtn.text('Tutup', 'data-x')}</div></div></div>`);
  d.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { d.remove(); layer -= 2; });
  document.body.appendChild(d); lucide.createIcons();
}

// ---------- Ekstra ----------
function subRow(s = {}) {
  const inv = s.mode === 'inv';
  const name = 'mode_' + uid();
  return `<div data-sub class="pb-4 mb-4 border-b border-line">
    <div class="grid grid-cols-[1fr_1fr_32px] gap-4 items-center">${fRadioCard(name, 'new', 'Buat Baru', !inv, { info: true })}${fRadioCard(name, 'inv', 'Pilih Dari Inventori', inv, { info: true })}<button type="button" data-del-sub aria-label="Hapus sub ekstra"><i data-lucide="trash-2"></i></button></div>
    <p class="text-[14px] font-semibold mt-5 mb-3">Sub Ekstra</p>
    <div class="grid sm:grid-cols-2 gap-4 pr-12">
      <div><p class="text-[12px] font-medium mb-2">Nama Sub Ekstra</p><div data-sub-name>${inv ? fSelect('sub_nama', db().produk.map(p => [p.nama, p.nama]), s.nama) : fInput('sub_nama', 'Contoh: Small', s.nama || '', { counter: 50 })}</div></div>
      <div><p class="text-[12px] font-medium mb-2">Harga Jual</p>${fInput('sub_harga', '0', s.harga || '', { prefix: 'Rp', money: true })}</div></div></div>`;
}
function ekstraForm(item) {
  const isEdit = !!item;
  const e = item || { nama: '', jenis: '', cara: '', maks: '', sub: [] };
  const help = { Optional: 'Pelanggan tidak wajib memilih sub ekstra yang tersedia', Mandatory: 'Pelanggan wajib memilih sub ekstra yang tersedia', Single: 'Pelanggan hanya dapat memilih satu produk sub ekstra yang tersedia', Many: 'Pelanggan dapat memilih beberapa produk sub ekstra yang tersedia' };
  cardForm({
    title: `${isEdit ? 'Ubah' : 'Tambah'} Ekstra`, noun: 'Ekstra', listName: 'produk ekstra',
    body: `<div class="pt-4">${fRow('Nama Produk Ekstra', fInput('nama', 'Contoh: Ukuran', e.nama, { counter: 50, req: 'Mohon lengkapi nama produk ekstra' }), { required: true })}</div>`
      + fRow('Jenis Ekstra', `<div data-field="jenis"><div class="grid grid-cols-2 gap-4">${fRadioCard('jenis', 'Optional', 'Opsional', e.jenis === 'Optional')}${fRadioCard('jenis', 'Mandatory', 'Wajib', e.jenis === 'Mandatory')}</div><p data-help="jenis" class="text-[12px] mt-2">${help[e.jenis] || ''}</p></div>`, { required: true })
      + fRow('Cara Pilih Ekstra', `<div data-field="cara"><div class="grid grid-cols-2 gap-4">${fRadioCard('cara', 'Single', 'Pilih Salah Satu', e.cara === 'Single')}${fRadioCard('cara', 'Many', 'Pilih Beberapa', e.cara === 'Many')}</div><p data-help="cara" class="text-[12px] mt-2">${help[e.cara] || ''}</p></div>`, { required: true })
      + `<div data-maks class="${e.cara === 'Many' ? '' : 'hidden'}">${fRow('Maks. Pilih Ekstra', fInput('maks', 'Contoh: 2', e.maks || '', { num: true }), { required: true, help: 'Atur jumlah maksimal ekstra yang dapat dipilih pelanggan' })}</div>`
      + `<div data-subsec class="${e.cara ? '' : 'hidden'} border-t border-line mt-3 pt-3">${fRow('Tambah Produk Sub Ekstra', `<div class="bg-[#F7F7F7] rounded-md p-4"><div data-sublist>${e.sub.map(subRow).join('')}</div><button type="button" data-add-sub class="w-full h-10 rounded-md border border-brand text-brand bg-white text-[14px] font-semibold">Tambah Sub Ekstra</button></div>`, { required: true })}</div>`,
    onMount: sh => {
      const R = sh.root;
      R.addEventListener('change', ev => {
        const t = ev.target;
        if (t.name === 'jenis' || t.name === 'cara') {
          R.querySelector(`[data-help=${t.name}]`).textContent = help[t.value];
          R.querySelector(`[data-field=${t.name}]`).querySelectorAll('.fmsg').forEach(m => m.remove());
          if (t.name === 'cara') { R.querySelector('[data-subsec]').classList.remove('hidden'); R.querySelector('[data-maks]').classList.toggle('hidden', t.value !== 'Many'); }
        }
        if (t.name.startsWith('mode_')) {
          const row = t.closest('[data-sub]');
          row.querySelector('[data-sub-name]').innerHTML = t.value === 'inv' ? fSelect('sub_nama', db().produk.map(p => [p.nama, p.nama])) : fInput('sub_nama', 'Contoh: Small', '', { counter: 50 });
        }
      });
      R.addEventListener('click', ev => {
        if (ev.target.closest('[data-add-sub]')) { R.querySelector('[data-sublist]').insertAdjacentHTML('beforeend', subRow()); lucide.createIcons(); }
        if (ev.target.closest('[data-del-sub]')) ev.target.closest('[data-sub]').remove();
      });
      if (!e.sub.length) R.querySelector('[data-sublist]').innerHTML = '';
    },
    collect: sh => {
      const R = sh.root; const v = formValues(R); let ok = true;
      ['jenis', 'cara'].forEach(n => { const f = R.querySelector(`[data-field=${n}]`); f.querySelectorAll('.fmsg').forEach(m => m.remove()); if (!v[n]) { ok = false; f.insertAdjacentHTML('beforeend', `<p class="fmsg">Mohon pilih ${n === 'jenis' ? 'jenis ekstra' : 'cara pilih ekstra'}</p>`); } });
      v.sub = [...R.querySelectorAll('[data-sub]')].map(r => ({ nama: r.querySelector('[name=sub_nama]').value.trim(), harga: toNum(r.querySelector('[name=sub_harga]').value) })).filter(s => s.nama);
      if (v.cara && !v.sub.length) { ok = false; toast('Info', 'Tambahkan minimal satu sub ekstra'); }
      if (v.cara === 'Many' && !(parseInt(v.maks, 10) > 0)) { ok = false; toast('Gagal!', 'Mohon isi maks. pilih ekstra', 'error'); }
      return ok ? v : false;
    },
    toastText: v => isEdit ? 'Data berhasil diperbarui' : `Ekstra <b>${esc(v.nama)}</b> berhasil ditambahkan`,
    onSave: v => {
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, jenis: v.jenis, cara: v.cara, maks: v.cara === 'Many' ? parseInt(v.maks, 10) : 1, sub: v.sub });
      if (!isEdit) db().ekstra.push(rec);
      logAct(rec.nama, isEdit ? 'Ubah Ekstra' : 'Tambah Ekstra', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
    }
  });
}

// ---------- pemilih produk (modal) ----------
function pickProducts(selected = []) {
  return new Promise(resolve => {
    const sel = new Set(selected);
    let tab = 'produk', q = '';
    const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${layer += 2}">
      <div class="bg-white rounded-lg w-[838px] max-w-full h-[545px] max-h-[92vh] flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-line"><h3 class="text-[20px] font-semibold">Pilih Produk</h3><button data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
        <div class="px-6 pt-4 flex flex-wrap gap-3 items-center"><label class="input w-[185px] h-8 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-q class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..."></label>
          <select data-kat class="fin fsel w-[185px] min-h-0 h-8">${['<option value="">Semua Kategori</option>', ...db().kategori.map(k => `<option value="${k.id}">${esc(k.nama)}</option>`)].join('')}</select>
          <div class="seg seg-sm flex border border-line rounded-lg overflow-hidden ml-auto"><button data-tab="produk" class="active">Produk</button><button data-tab="paket">Paket</button></div></div>
        <div data-list class="flex-1 overflow-auto px-6 pt-4"></div>
        <div class="flex justify-end items-center gap-6 px-6 py-4 border-t border-line">${fBtn.text('Batal', 'data-x')}<button data-ok class="h-10 px-3 rounded-md text-white text-[14px] font-semibold"></button></div></div></div>`);
    const paint = () => {
      const kat = d.querySelector('[data-kat]').value;
      const items = (tab === 'produk' ? db().produk : db().paket).filter(p => (!q || p.nama.toLowerCase().includes(q)) && (!kat || p.kategori === kat));
      d.querySelector('[data-list]').innerHTML = `<table class="tbl w-full"><thead><tr><th class="w-8"><input type="checkbox" data-all></th><th>Produk</th><th>Kategori</th><th>Harga</th></tr></thead><tbody>
        ${items.map(p => `<tr><td><input type="checkbox" data-pick="${p.id}" ${sel.has(p.id) ? 'checked' : ''}></td><td>${esc(p.nama)}</td><td>${esc(katName(p.kategori))}</td><td>${rp(p.hargaJual ?? p.harga)}</td></tr>`).join('')}</tbody></table>${items.length ? '' : emptyTable()}`;
      const ok = d.querySelector('[data-ok]'); ok.textContent = 'Simpan'; ok.disabled = !sel.size; ok.style.background = sel.size ? '#04C99E' : '#D6D9D9';
    };
    const close = v => { d.remove(); layer -= 2; resolve(v); };
    d.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) return close(null);
      if (e.target.closest('[data-ok]') && sel.size) return close([...sel]);
      const tb = e.target.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; d.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === tb)); paint(); }
    });
    d.addEventListener('change', e => {
      if (e.target.matches('[data-pick]')) { e.target.checked ? sel.add(e.target.dataset.pick) : sel.delete(e.target.dataset.pick); paint(); }
      if (e.target.matches('[data-all]')) { d.querySelectorAll('[data-pick]').forEach(c => { e.target.checked ? sel.add(c.dataset.pick) : sel.delete(c.dataset.pick); }); paint(); }
      if (e.target.matches('[data-kat]')) paint();
    });
    d.addEventListener('input', e => { if (e.target.matches('[data-q]')) { q = e.target.value.toLowerCase(); paint(); } });
    document.body.appendChild(d); paint(); lucide.createIcons();
  });
}

// ---------- Paket ----------
function isiRow(i, it = {}) {
  return `<div data-isi class="grid md:grid-cols-[160px_1fr] gap-x-6 py-3"><p class="text-[14px] font-semibold pt-8">Produk ${i}</p>
    <div class="grid grid-cols-[2fr_1fr_1fr_32px] gap-3 items-end">
      <div>${lbl('Nama Produk', 1)}${fSelect('isi_produk', db().produk.map(p => [p.id, p.nama]), it.produk || '', 'Pilih')}</div>
      <div>${lbl('Jumlah', 1)}<input name="isi_jumlah" class="fin" placeholder="0" value="${it.jumlah || ''}"></div>
      <div>${lbl('Satuan', 1)}<input class="fin" placeholder="Pilih" value="${it.produk ? 'pcs' : ''}" disabled></div>
      <button type="button" data-del-isi class="pb-2 text-ink-2" aria-label="Hapus produk"><i data-lucide="trash-2"></i></button></div></div>`;
}
function paketForm(item) {
  const isEdit = !!item;
  const k = item || { nama: '', kode: `BC-${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\D/g, '')}-${String(Math.floor(10000 + Math.random() * 89999))}`, kategori: '', harga: '', minBeli: '', tampil: false, favorit: false, isi: [] };
  cardForm({
    title: `${isEdit ? 'Ubah' : 'Tambah'} Produk Paket`, noun: 'Produk Paket',
    body: fRow('Daftar Outlet', fSelect('outlet', OUTLETS, 'by cafe', 'Pilih', { req: 'Mohon pilih outlet' }), { required: true })
      + fRow('Nama Produk Paket', fInput('nama', 'contoh: paket makan siang', k.nama, { req: 'Mohon lengkapi nama produk paket' }), { required: true })
      + fRow('Kode Paket', fInput('kode', '', k.kode, { req: 'Mohon lengkapi kode paket' }), { required: true })
      + fRow('Foto Produk', fUpload('Pilih atau letakkan berkas di sini (0 dari 5 berkas)'), { help: 'Rasio foto 1:1, ukuran min. 10Kb dan maks. 1Mb. Format .jpg .jpeg .png, ukuran min. 100px x 100px (untuk gambar optimal gunakan ukuran maks. 1000px x 1000px). Maks 5 foto' })
      + fRow('Kategori Produk', fSelect('kategori', db().kategori.map(x => [x.id, x.nama]), k.kategori, 'Kategori Produk', { req: 'Mohon pilih kategori produk' }) + `<p class="text-[12px] mt-3">Kategori belum tersedia?<button type="button" data-newkat class="text-brand text-[14px] font-semibold ml-6">Buat Kategori Baru</button></p>`, { required: true })
      + fRow('Harga Produk Paket', fInput('harga', 'Rp 0', k.harga, { money: true, num: true, req: 'Mohon lengkapi harga produk paket' }), { required: true })
      + fRow('Min. Pembelian', fInput('minBeli', '0', k.minBeli, { req: 'Mohon lengkapi min. pembelian' }), { required: true })
      + fRow('Opsi Lanjutan', fCheck('tampil', k.tampil, 'Tampil di Menu') + fCheck('favorit', k.favorit, 'Produk Favorit'))
      + `<div class="pt-4"><p class="text-[14px] font-semibold">Isi Paket Produk</p><p class="text-[12px] mt-2">Pilih beberapa produk yang ingin dikemas menjadi satu paket</p></div>
         <div data-isilist>${k.isi.map((it, i) => isiRow(i + 1, it)).join('')}</div>
         <div class="border-t border-line mt-4 pt-6 md:pl-[184px]"><button type="button" data-add-isi class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold">Tambah Produk</button></div>`,
    width: 'max-w-[982px]',
    onMount: sh => {
      const R = sh.root;
      const renumber = () => R.querySelectorAll('[data-isi]').forEach((r, i) => { r.querySelector('p').textContent = `Produk ${i + 1}`; });
      R.addEventListener('click', ev => {
        if (ev.target.closest('[data-add-isi]')) { R.querySelector('[data-isilist]').insertAdjacentHTML('beforeend', isiRow(R.querySelectorAll('[data-isi]').length + 1)); lucide.createIcons(); }
        if (ev.target.closest('[data-del-isi]')) { ev.target.closest('[data-isi]').remove(); renumber(); }
        if (ev.target.closest('[data-newkat]')) kategoriForm(null, kat => { const s = R.querySelector('select[name=kategori]'); s.insertAdjacentHTML('beforeend', `<option value="${kat.id}">${esc(kat.nama)}</option>`); s.value = kat.id; s.classList.remove('text-[#A0A6A6]'); });
      });
      R.addEventListener('change', ev => { if (ev.target.name === 'isi_produk') ev.target.closest('[data-isi]').querySelector('input[disabled]').value = ev.target.value ? 'pcs' : ''; });
    },
    collect: sh => {
      const v = formValues(sh.root);
      v.isi = [...sh.root.querySelectorAll('[data-isi]')].map(r => ({ produk: r.querySelector('select').value, jumlah: +r.querySelector('[name=isi_jumlah]').value || 0 })).filter(x => x.produk);
      if (!v.isi.length) { toast('Info', 'Tambahkan minimal satu produk ke dalam paket'); return false; }
      return v;
    },
    toastText: v => isEdit ? 'Data berhasil diperbarui' : `Produk Paket <b>${esc(v.nama)}</b> berhasil ditambahkan`,
    onSave: v => {
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, kode: v.kode, kategori: v.kategori, harga: toNum(v.harga), minBeli: +v.minBeli || 1, tampil: v.tampil, favorit: v.favorit, isi: v.isi });
      if (!isEdit) db().paket.push(rec);
      logAct(rec.nama, isEdit ? 'Ubah Paket' : 'Tambah Paket', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
    }
  });
}

// ---------- Deposit ----------
function depositForm(item) {
  const isEdit = !!item;
  const d = item || { nama: '', harga: '', saldo: '', status: true, tampil: true, masa: false, hari: 30, produk: [] };
  let picked = [...d.produk];
  const title = `${isEdit ? 'Ubah' : 'Tambah'} Deposit`;
  const pickedHtml = () => picked.length ? `<table class="tbl w-full mt-3"><thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th></th></tr></thead><tbody>${picked.map(id => { const p = byId('produk', id) || byId('paket', id); return p ? `<tr><td>${esc(p.nama)}</td><td>${esc(katName(p.kategori))}</td><td>${rp(p.hargaJual ?? p.harga)}</td><td class="text-right"><button type="button" data-unpick="${id}" aria-label="Hapus"><i data-lucide="trash-2" class="ic-sm"></i></button></td></tr>` : ''; }).join('')}</tbody></table>` : '';
  const sh = openSheet({
    title,
    body: `<div class="px-6 py-10 space-y-6">
      ${formCard(`<div class="rounded-md border border-[#F5A3A9] bg-[#FDECEC] px-4 py-2.5 text-[14px] text-ink-2 flex items-center mb-6">Penjualan deposit di kasir harus dalam transaksi terpisah dan tidak dapat digabungkan dengan penjualan produk lain<i data-lucide="x" class="ic-sm ml-auto text-ink-4"></i></div>
        <h2 class="text-[20px] font-semibold mb-4">Pengaturan Deposit</h2>
        ${fRow('Daftar Outlet', fSelect('outlet', OUTLETS, isEdit ? 'by cafe' : '', 'Pilih', { req: 'Mohon pilih outlet' }), { required: true })}
        ${fRow('Status', fSwitch('status', d.status, 'Produk deposit tersedia untuk dijual'), { top: false })}
        ${fRow('Tampil di Menu', fSwitch('tampil', d.tampil, 'Produk deposit ditampilkan di menu kasir'), { top: false })}
        ${fRow('Masa Berlaku', `<div data-masa-label>${fSwitch('masa', d.masa, d.masa ? 'Masa berlaku deposit yang dibeli terbatas' : 'Pemakaian deposit yang sudah dibeli tidak terbatas')}</div>`, { top: false })}
        <div data-if="masa" class="${d.masa ? '' : 'hidden'}">${fRow('Batasan Hari', `<label class="flex items-center gap-3 text-[14px] py-2"><input type="radio" name="batas" value="30" class="w-4 h-4 accent-[#04C99E]" ${d.hari === 30 ? 'checked' : ''}>1 Bulan (30 hari)</label>
          <label class="flex items-center gap-3 text-[14px] py-2"><input type="radio" name="batas" value="kustom" class="w-4 h-4 accent-[#04C99E]" ${d.hari !== 30 ? 'checked' : ''}>Kustom</label>
          <div class="mt-2">${fInput('hari', 'Tulis jumlah hari', d.hari, { suffix: 'Hari', disabled: d.hari === 30 })}</div>`)}</div>`)}
      ${formCard(fRow('Foto', fUpload(), { help: 'Format gambar .jpg .jpeg .png dan ukuran minimum 360 × 300px (Untuk gambar optimal gunakan ukuran minimum 800 x 700 px).' })
        + fRow('Nama Deposit', fInput('nama', 'Contoh: Depo Burger', d.nama, { req: 'Mohon lengkapi nama deposit' }), { required: true })
        + fRow('Harga Jual Deposit', fInput('harga', '100.000', d.harga, { money: true, num: true, req: 'Mohon lengkapi harga jual deposit' }), { required: true })
        + fRow('Saldo Deposit', fInput('saldo', '100.000', d.saldo, { money: true, num: true, req: 'Mohon lengkapi saldo deposit' }), { required: true, help: 'Besaran nominal deposit yang didapat saat melakukan pembelian deposit' }), 'Informasi Deposit')}
      <div class="rounded-md border border-[#69C0E6] bg-[#E6F6FC] px-4 py-2.5 text-[14px] text-ink-2">Produk layanan Anda telah disesuaikan ke struktur terbaru agar lebih mudah dikelola.</div>
      ${formCard(`<p class="text-[12px] mb-4">Deposit yang dibeli pelanggan akan digunakan untuk melakukan pembelian pada produk pilihan di bawah ini.</p>`
        + fRow('Pilihan Produk', `<button type="button" data-pick class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold flex items-center justify-center gap-2"><i data-lucide="plus" class="ic-sm"></i>Pilih Produk</button><div data-field="produk"></div><div data-picked>${pickedHtml()}</div>`, { required: true }), 'Produk Pilihan')}
    </div>`,
    footer: `<div class="ml-auto flex items-center gap-8">${fBtn.text('Batal', 'data-cancel')}${fBtn.primary('Simpan', 'data-save')}</div>`
  });
  const R = sh.root;
  const cancel = async () => { if (await confirmCancel(title, `Membatalkan proses <b>${title}</b> akan menghapus seluruh data yang telah diinput. Lanjutkan?`)) sh.close(); };
  sh.onClose = cancel;
  const repaintPicked = () => { R.querySelector('[data-picked]').innerHTML = pickedHtml(); lucide.createIcons(); };
  R.addEventListener('sw', e => {
    if (e.target.dataset.name === 'masa') {
      R.querySelector('[data-if=masa]').classList.toggle('hidden', !e.detail);
      R.querySelector('[data-masa-label] span').textContent = e.detail ? 'Masa berlaku deposit yang dibeli terbatas' : 'Pemakaian deposit yang sudah dibeli tidak terbatas';
    }
  });
  R.addEventListener('change', e => { if (e.target.name === 'batas') { const h = R.querySelector('[name=hari]'); h.disabled = e.target.value === '30'; if (h.disabled) h.value = 30; h.closest('.fin').classList.toggle('bg-[#F2F2F2]', h.disabled); } });
  R.addEventListener('click', async e => {
    if (e.target.closest('[data-cancel]')) return cancel();
    if (e.target.closest('[data-pick]')) { const r = await pickProducts(picked); if (r) { picked = r; repaintPicked(); R.querySelectorAll('[data-field=produk] .fmsg').forEach(m => m.remove()); } return; }
    const un = e.target.closest('[data-unpick]'); if (un) { picked = picked.filter(x => x !== un.dataset.unpick); return repaintPicked(); }
    if (e.target.closest('[data-save]')) {
      let ok = validate(R);
      R.querySelectorAll('[data-field=produk] .fmsg').forEach(m => m.remove());
      if (!picked.length) { ok = false; R.querySelector('[data-field=produk]').innerHTML = '<p class="fmsg">Mohon pilih produk</p>'; }
      if (!ok) return;
      const v = formValues(R);
      if (!(await confirmSave('Deposit', v.nama))) return;
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, harga: toNum(v.harga), saldo: toNum(v.saldo), status: v.status, tampil: v.tampil, masa: v.masa, hari: +v.hari || 30, produk: picked });
      if (!isEdit) db().deposit.push(rec);
      logAct(rec.nama, isEdit ? 'Ubah Deposit' : 'Tambah Deposit', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
      saveDB(); sh.close(); render();
      toast('Berhasil!', isEdit ? 'Data berhasil diperbarui' : `Deposit <b>${esc(rec.nama)}</b> berhasil ditambahkan`);
    }
  });
}

// ---------- Ojek Online ----------
function ojekForm(item) {
  const isEdit = !!item;
  const o = item ? JSON.parse(JSON.stringify(item)) : { nama: '', deskripsi: '', status: false, produk: [], ekstra: [] };
  const title = `${isEdit ? 'Ubah' : 'Tambah'} Ojek Online`;
  const navs = ['Informasi Ojek Online', 'Produk &amp; Harga', 'Ekstra &amp; Harga'];
  const prodTable = () => `<div class="overflow-x-auto"><table class="tbl w-full"><thead><tr style="background:#FAFAFA"><th>Produk</th><th>Satuan</th><th>Harga Awal</th><th>Harga Jual</th></tr></thead><tbody>
    ${o.produk.map(x => { const p = byId('produk', x.id); return p ? `<tr><td>${esc(p.nama)}</td><td>${esc(p.satuan)}</td><td>${rp(p.hargaJual)}</td><td>${fInput('oj_' + x.id, '0', x.harga, { prefix: 'Rp', money: true })}</td></tr>` : ''; }).join('')}</tbody></table></div>${o.produk.length ? '' : emptyTable()}`;
  const eksTable = () => `<div class="overflow-x-auto"><table class="tbl w-full"><thead><tr style="background:#FAFAFA"><th>Sub Ekstra</th><th>Produk Ekstra</th><th>Harga Awal <i data-lucide="info" class="ic-sm inline"></i></th><th>Harga Jual</th></tr></thead><tbody>
    ${o.ekstra.map(x => `<tr><td>${esc(x.sub)}</td><td>${esc(x.ekstra)}</td><td>${rp(x.awal)}</td><td>${fInput('oje_' + x.key, '0', x.harga, { prefix: 'Rp', money: true })}</td></tr>`).join('')}</tbody></table></div>${o.ekstra.length ? '' : emptyTable()}`;
  const presetBtn = (label, attr, on) => `<button type="button" ${attr} ${on ? '' : 'disabled'} class="h-10 px-3 rounded-md text-white text-[14px] font-semibold" style="background:${on ? '#04C99E' : '#D6D9D9'}">${label}</button>`;
  const sh = openSheet({
    title,
    body: `<div class="grid lg:grid-cols-[239px_1fr] gap-6 px-6 py-10 items-start">
      <nav class="bg-white rounded-lg py-5 px-6 lg:sticky lg:top-0" style="box-shadow:rgba(0,0,0,.05) 0 1px 3px"><ul class="border-l-2 border-[#EEEEEE] space-y-3">${navs.map((n, i) => `<li><button data-sec="${i}" class="-ml-0.5 pl-5 py-1 text-[14px] font-semibold ${i ? 'text-ink-3' : 'text-brand border-l-4 border-brand'}">${n}</button></li>`).join('')}</ul></nav>
      <div>
        <section id="sec0" class="bg-white rounded-lg p-6 mb-6">${'<h2 class="text-[20px] font-semibold mb-4">Informasi Ojek Online</h2>'
          + fRow('Daftar Outlet', fSelect('outlet', OUTLETS, isEdit ? 'by cafe' : '', 'Pilih', { req: 'Mohon pilih outlet' }), { required: true })
          + fRow('Nama Ojek Online', fInput('nama', 'Contoh: GoFood', o.nama, { req: 'Mohon lengkapi nama ojek online' }), { required: true })
          + fRow('Deskripsi', fInput('deskripsi', 'Contoh: Daftar harga online GoFood', o.deskripsi, { area: true }))
          + fRow('Status', fSwitch('status', o.status, 'Aktifkan untuk menampilkan nama ojek online pada aplikasi kasir'), { top: false })}</section>
        <section id="sec1" class="bg-white rounded-lg p-6 mb-6"><h2 class="text-[20px] font-semibold">Atur Produk &amp; Harga</h2><p class="text-[12px] text-ink-3 mt-1">Atur dan sesuaikan harga khusus ojek online untuk produk yang dipilih</p>
          <div class="flex items-center justify-between mt-6"><p class="text-[14px] font-semibold">Pilih Produk${req}</p>${fBtn.primary('Tambah Produk', 'type="button" data-oj-prod')}</div>
          <div class="flex items-center justify-between mt-4 mb-4"><p class="text-[14px] font-semibold">Atur Harga</p><span data-preset-prod>${presetBtn('Preset Harga Produk', 'data-preset="produk"', o.produk.length)}</span></div><div data-prod-table>${prodTable()}</div></section>
        <section id="sec2" class="bg-white rounded-lg p-6"><h2 class="text-[20px] font-semibold">Atur Ekstra &amp; Harga</h2><p class="text-[12px] text-ink-3 mt-1">Atur dan sesuaikan harga khusus ojek online untuk produk yang dipilih</p>
          <div class="flex items-center justify-between mt-6"><p class="text-[14px] font-semibold">Pilih Ekstra</p>${fBtn.primary('Tambah Ekstra', 'type="button" data-oj-eks')}</div>
          <div class="flex items-center justify-between mt-4 mb-4"><p class="text-[14px] font-semibold">Atur Harga</p><span data-preset-eks>${presetBtn('Preset Harga Ekstra', 'data-preset="ekstra"', o.ekstra.length)}</span></div><div data-eks-table>${eksTable()}</div></section>
      </div></div>`,
    footer: `<div class="ml-auto flex items-center gap-8">${fBtn.text('Batal', 'data-cancel')}${fBtn.primary('Simpan', 'data-save')}</div>`
  });
  const R = sh.root;
  const body = R.querySelector('[data-body]');
  const readPrices = () => { o.produk.forEach(x => { const i = R.querySelector(`[name="oj_${x.id}"]`); if (i) x.harga = toNum(i.value); }); o.ekstra.forEach(x => { const i = R.querySelector(`[name="oje_${x.key}"]`); if (i) x.harga = toNum(i.value); }); };
  // harga yang sedang diketik dibaca lewat readPrices() sebelum data diubah, bukan di sini
  const repaint = () => {
    R.querySelector('[data-prod-table]').innerHTML = prodTable(); R.querySelector('[data-eks-table]').innerHTML = eksTable();
    R.querySelector('[data-preset-prod]').innerHTML = presetBtn('Preset Harga Produk', 'data-preset="produk"', o.produk.length);
    R.querySelector('[data-preset-eks]').innerHTML = presetBtn('Preset Harga Ekstra', 'data-preset="ekstra"', o.ekstra.length);
    lucide.createIcons();
  };
  const cancel = async () => { if (await confirmCancel(title, `Membatalkan proses <b>${title}</b> akan menghapus seluruh data yang telah diinput. Lanjutkan?`)) sh.close(); };
  sh.onClose = cancel;
  body.addEventListener('scroll', () => {
    const idx = [0, 1, 2].filter(i => R.querySelector('#sec' + i).getBoundingClientRect().top < 200).pop() || 0;
    R.querySelectorAll('[data-sec]').forEach((b, i) => { b.className = `-ml-0.5 pl-5 py-1 text-[14px] font-semibold ${i === idx ? 'text-brand border-l-4 border-brand' : 'text-ink-3'}`; });
  });
  R.addEventListener('click', async e => {
    const t = e.target;
    const sec = t.closest('[data-sec]'); if (sec) return R.querySelector('#sec' + sec.dataset.sec).scrollIntoView({ behavior: 'smooth' });
    if (t.closest('[data-cancel]')) return cancel();
    if (t.closest('[data-oj-prod]')) { readPrices(); const r = await pickProducts(o.produk.map(x => x.id)); if (r) { o.produk = r.filter(id => byId('produk', id)).map(id => o.produk.find(x => x.id === id) || { id, harga: byId('produk', id).hargaJual }); repaint(); } return; }
    if (t.closest('[data-oj-eks]')) {
      readPrices();
      o.ekstra = db().ekstra.flatMap(ek => ek.sub.map((s, i) => { const key = ek.id + '_' + i; return o.ekstra.find(x => x.key === key) || { key, sub: s.nama, ekstra: ek.nama, awal: s.harga, harga: s.harga }; }));
      if (!o.ekstra.length) toast('Info', 'Belum ada produk ekstra'); return repaint();
    }
    const pr = t.closest('[data-preset]');
    if (pr && !pr.disabled) {
      const wait = confirmDialog({ title: pr.dataset.preset === 'produk' ? 'Preset Harga Produk' : 'Preset Harga Ekstra', html: `<p class="mb-3">Naikkan harga jual dari harga awal sebesar:</p><div class="fin flex items-center gap-3"><input id="presetPct" class="flex-1 outline-none" value="20" inputmode="numeric"><span>%</span></div>`, ok: 'Terapkan' });
      // dialog dilepas dari DOM saat ditutup, jadi nilai persen dibaca selama dialog masih terbuka
      let pct = 20;
      const pctInput = document.getElementById('presetPct');
      pctInput.addEventListener('input', () => { pct = toNum(pctInput.value); });
      if (await wait) {
        readPrices();
        if (pr.dataset.preset === 'produk') o.produk.forEach(x => { x.harga = Math.round(byId('produk', x.id).hargaJual * (1 + pct / 100) / 500) * 500; });
        else o.ekstra.forEach(x => { x.harga = Math.round(x.awal * (1 + pct / 100) / 500) * 500; });
        repaint();
      }
      return;
    }
    if (t.closest('[data-save]')) {
      if (!validate(R.querySelector('#sec0'))) return R.querySelector('#sec0').scrollIntoView();
      readPrices();
      const v = formValues(R.querySelector('#sec0'));
      if (!(await confirmSave('Ojek Online', v.nama))) return;
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, deskripsi: v.deskripsi, status: v.status, produk: o.produk, ekstra: o.ekstra });
      if (!isEdit) db().ojek.push(rec);
      saveDB(); sh.close(); render();
      toast('Berhasil!', isEdit ? 'Data berhasil diperbarui' : `Ojek Online <b>${esc(rec.nama)}</b> berhasil ditambahkan`);
    }
  });
}

// ---------- Meja (dipakai aplikasi Kasir) ----------
function mejaForm(item) {
  const isEdit = !!item;
  cardForm({
    title: `${isEdit ? 'Ubah' : 'Tambah'} Meja`, noun: 'Meja', cardTitle: 'Informasi Meja',
    body: fRow('Nama Meja', fInput('nama', 'Contoh: Meja 1', item?.nama || '', { req: 'Mohon lengkapi nama meja' }), { required: true })
      + fRow('Area', fSelect('area', AREAS, item?.area || '', 'Pilih Area', { req: 'Mohon pilih area' }), { required: true })
      + fRow('Kapasitas', fInput('kapasitas', 'Contoh: 4', item?.kapasitas ?? '', { suffix: 'Orang', req: 'Mohon lengkapi kapasitas', num: true }), { required: true })
      + fRow('Status', fSwitch('aktif', item ? item.aktif : true, 'Tampilkan meja pada aplikasi kasir'), { top: false }),
    toastText: v => isEdit ? 'Data berhasil diperbarui' : `Meja <b>${esc(v.nama)}</b> berhasil ditambahkan`,
    onSave: v => {
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, area: v.area, kapasitas: +v.kapasitas || 1, aktif: v.aktif });
      if (!isEdit) db().meja.push(rec);
    }
  });
}

// ---------- halaman daftar (data dari DB) ----------
const LIST_STATE = {};
const st = slug => (LIST_STATE[slug] = LIST_STATE[slug] || { q: '', seg: 0, kat: '', status: '', open: new Set(), sel: new Set(), bop: '' });
const segFilter = (s, labels, flag) => s.seg === 0 || (s.seg === 1 ? flag : !flag);
const statusBadge = (on, yes, no) => badge(on ? yes : no);

const LISTS = {
  'daftar-departemen': {
    title: 'Daftar Departemen', help: true, add: ['Tambah Departemen', () => departemenForm()],
    items: s => db().departemen.filter(d => d.nama.toLowerCase().includes(s.q)),
    cols: ['Departemen', 'Urutan Tampilan', 'Jumlah Kategori'],
    row: d => [esc(d.nama), esc(d.urutan), db().kategori.filter(k => k.departemen === d.id).length],
    menu: d => [['Ubah', () => departemenForm(d)], ['Hapus', () => deleteFlow('departemen', d, 'Departemen', () => db().kategori.forEach(k => { if (k.departemen === d.id) k.departemen = ''; }))]]
  },
  'daftar-kategori': {
    title: 'Daftar Kategori', help: true, add: ['Tambah Kategori', () => kategoriForm()], seg: ['Semua', 'Tampil di Menu', 'Tidak Tampil di Menu'],
    items: s => db().kategori.filter(k => k.nama.toLowerCase().includes(s.q) && segFilter(s, 0, k.tampil)),
    cols: ['Nama Kategori', 'Urutan', 'Jumlah Produk', 'Departemen', 'Status'],
    row: k => [esc(k.nama), esc(k.urutan), db().produk.filter(p => p.kategori === k.id).length + ' item', esc(byId('departemen', k.departemen)?.nama || '-'), statusBadge(k.tampil, 'Tampil di Menu', 'Tidak Tampil di Menu')],
    menu: k => [['Ubah', () => kategoriForm(k)], ['Lihat Produk', () => { st('produk-barang').kat = k.id; go('#/penjualan/produk-barang'); }], ['Hapus', () => deleteFlow('kategori', k, 'Kategori', null)]]
  },
  'produk-barang': {
    title: 'Produk Barang', add: ['Tambah Produk', () => produkWizard()], seg: ['Semua', 'Tampil di Menu', 'Tidak Tampil di Menu'], katFilter: true, check: true, expand: true,
    links: `<button data-act="log" class="w-9 h-9 flex items-center justify-center text-brand" aria-label="Log Aktivitas"><i data-lucide="history"></i></button>
      <div class="relative"><button data-act="impor" class="h-9 px-2 text-brand text-[14px] font-semibold">Impor Data</button></div>${linkBtn('Ekspor Data').replace('<button', '<button data-act="ekspor"')}`,
    sub: () => `<b class="text-ink text-[14px]">by cafe</b> - ${db().produk.length} Produk barang`,
    items: s => db().produk.filter(p => p.nama.toLowerCase().includes(s.q) && (!s.kat || p.kategori === s.kat) && segFilter(s, 0, p.tampil)),
    cols: ['Nama Produk', 'SKU', 'Kategori', 'Harga Modal', 'Harga Beli', 'Harga Jual', 'Status'],
    row: p => [`${esc(p.nama)}${p.varian?.aktif ? '<span class="block text-[12px] text-brand">Varian</span>' : ''}${p.resep && (p.bahan || []).some(b => b.bahan) ? '<span class="block text-[12px] text-brand">Resep</span>' : ''}`, esc(p.sku), esc(katName(p.kategori)), rp(p.hargaModal || 0), rp(p.hargaBeli || 0), p.varian?.aktif ? `Mulai ${rp(Math.min(...p.varian.items.map(i => i.hargaJual)))}` : rp(p.hargaJual), statusBadge(p.tampil, 'Tampil di Menu', 'Tidak Tampil di Menu')],
    // aksi massal saat baris dicentang: tab status diganti Pilih Status + Terapkan + Hapus
    bulk: {
      noun: 'produk', ph: 'Pilih Status', coll: 'produk', diubah: 'Produk berhasil diubah',
      ops: [['Tampil di Menu', p => { p.tampil = true; }], ['Tidak Tampil di Menu', p => { p.tampil = false; }], ['Favorit', p => { p.favorit = true; }], ['Bukan Favorit', p => { p.favorit = false; }],
        ['Aktifkan Monitor Persediaan', p => { p.monitor = true; }], ['Nonaktifkan Monitor Persediaan', p => { p.monitor = false; }]],
      log: 'Produk', hapus: () => ({ title: 'Hapus Produk', html: 'Menghapus produk akan menghilangkan produk tersebut secara permanen dan tidak dapat dibatalkan. Lanjutkan?' })
    },
    detail: p => `<div class="grid grid-cols-[160px_1fr] gap-y-4 text-[14px] py-2"><b>Grup</b><span>-</span><b>Monitor Persediaan</b><span>${statusBadge(p.monitor, 'Aktif', 'Tidak Aktif')}</span>
      ${p.varian?.aktif ? `<b>Varian</b><span>${p.varian.items.map(it => `${esc(it.nama)} · ${rp(it.hargaJual)}${it.aktif ? '' : ' (tidak tampil)'}`).join('<br>')}</span>` : ''}</div>`,
    menu: p => [['Detail', () => detailProduk(p)], ['Ubah', () => produkWizard(p)], ['Atur Per Outlet', () => aturPerOutlet(p)], ['Hapus', () => deleteFlow('produk', p, 'Produk', null)]]
  },
  'produk-ekstra': {
    title: 'Produk Ekstra', add: ['Tambah Ekstra', () => ekstraForm()], links: linkBtn('Ekspor Data').replace('<button', '<button data-act="ekspor"'),
    items: s => db().ekstra.filter(e => e.nama.toLowerCase().includes(s.q)),
    cols: ['Nama Ekstra', 'Setting Pilihan Ekstra'],
    row: e => [esc(e.nama), esc(e.sub.map(x => x.nama).join(', '))],
    menu: e => [['Ubah', () => ekstraForm(e)], ['Hapus', () => deleteFlow('ekstra', e, 'Ekstra', null, 'secara permanen dari daftar & tidak dapat dibatalkan')]]
  },
  'produk-paket': {
    title: 'Produk Paket', add: ['Tambah Produk Paket', () => paketForm()], seg: ['Semua', 'Tampil di Menu', 'Tidak Tampil di Menu'], links: linkBtn('Ekspor Data').replace('<button', '<button data-act="ekspor"'),
    sub: () => `by cafe - ${db().paket.length} Produk`,
    items: s => db().paket.filter(k => k.nama.toLowerCase().includes(s.q) && segFilter(s, 0, k.tampil)),
    cols: ['Nama Paket', 'Produk', 'Kategori', 'Harga', 'Status'],
    row: k => [esc(k.nama), esc(k.isi.map(i => `${byId('produk', i.produk)?.nama || '-'} x${i.jumlah}`).join(', ')), esc(katName(k.kategori)), rp(k.harga), statusBadge(k.tampil, 'Tampil di Menu', 'Tidak Tampil di Menu')],
    menu: k => [['Ubah', () => paketForm(k)], ['Hapus', () => deleteFlow('paket', k, 'Produk Paket', null)]]
  },
  'deposit': {
    title: 'Daftar Deposit', add: ['Tambah Deposit', () => depositForm()], seg: ['Semua', 'Aktif', 'Tidak Aktif'],
    items: s => db().deposit.filter(d => d.nama.toLowerCase().includes(s.q) && segFilter(s, 0, d.status)),
    cols: ['Nama Deposit', 'Harga', 'Masa Berlaku', 'Outlet', 'Status'],
    row: d => [esc(d.nama), rp(d.harga), d.masa ? `${d.hari} hari` : 'Tidak terbatas', 'by cafe', statusBadge(d.status, 'Aktif', 'Tidak Aktif')],
    menu: d => [['Ubah', () => depositForm(d)], ['Hapus', () => deleteFlow('deposit', d, 'Deposit', null)]]
  },
  'daftar-harga-ojek-online': {
    title: 'Daftar Harga Ojek Online', add: ['Tambah Ojek Online', () => ojekForm()], statusFilter: true,
    items: s => db().ojek.filter(o => o.nama.toLowerCase().includes(s.q) && (!s.status || (s.status === 'aktif') === o.status)),
    cols: ['Nama Ojek Online', 'Deskripsi', 'Produk Terdaftar', 'Status'],
    row: o => [esc(o.nama), esc(o.deskripsi), o.produk.length, statusBadge(o.status, 'Aktif', 'Tidak Aktif')],
    menu: o => [['Ubah', () => ojekForm(o)], ['Hapus', () => deleteFlow('ojek', o, 'Ojek Online', null)]]
  },
  'pengaturan-denah-dan-meja': {
    title: 'Daftar Meja', add: ['Tambah Meja', () => mejaForm()], seg: ['Semua', ...AREAS], segArea: true,
    links: `<a href="kasir.html" target="_blank" class="h-9 px-2 text-brand text-[14px] font-semibold flex items-center gap-2"><i data-lucide="monitor-smartphone" class="ic-sm"></i>Buka Kasir</a>`,
    sub: () => `by cafe - ${db().meja.length} Meja`,
    items: s => db().meja.filter(m => m.nama.toLowerCase().includes(s.q) && (s.seg === 0 || m.area === AREAS[s.seg - 1])),
    cols: ['Nama Meja', 'Area', 'Kapasitas', 'Status Pemakaian', 'Status'],
    row: m => [esc(m.nama), esc(m.area), `${m.kapasitas} orang`, mejaOrder(m.id) ? '<span class="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-1 rounded bg-[#FFF7E6] text-[#AD6800]"><span class="w-1.5 h-1.5 rounded-full bg-[#AD6800]"></span>Terisi</span>' : badge('Kosong'), statusBadge(m.aktif, 'Aktif', 'Tidak Aktif')],
    menu: m => [['Ubah', () => mejaForm(m)], ['Hapus', () => mejaOrder(m.id) ? toast('Info', `Meja <b>${esc(m.nama)}</b> masih memiliki pesanan aktif`) : deleteFlow('meja', m, 'Meja', null)]]
  }
};

function listTableHtml(slug) {
  const c = LISTS[slug], s = st(slug), items = c.items(s);
  const all = items.length > 0 && items.every(it => s.sel.has(it.id));
  // kolom bisa disembunyikan lewat tombol + (colPick), awalnya sesuai daftar `hide`
  const hid = c.colPick ? colHidden(slug, c.cols, c.hide) : new Set(), vis = i => (hid.has(i) ? ' hidden' : '');
  const head = `<tr>${c.expand ? '<th class="w-8"></th>' : ''}${c.check ? `<th class="w-8"><input type="checkbox" autocomplete="off" data-lall class="accent-[#04C99E]" ${all ? 'checked' : ''}></th>` : ''}${c.cols.map((h, i) => `<th data-col="${i}" class="${i === 0 && c.expand ? 'sticky left-0 bg-white z-[1] border-r border-line' : ''}${vis(i)}">${h}</th>`).join('')}${c.colPick ? colPickTh : '<th class="w-10"></th>'}</tr>`;
  const body = items.map(it => {
    const open = s.open.has(it.id);
    const cells = c.row(it).map((v, i) => `<td data-col="${i}" class="${i === 0 && c.expand ? 'sticky left-0 bg-white z-[1] border-r border-line' : ''} ${i === 0 ? '' : 'whitespace-nowrap'}${vis(i)}">${v}</td>`).join('');
    return `<tr>${c.expand ? `<td><button data-expand="${it.id}" aria-label="Rincian"><i data-lucide="chevron-${open ? 'down' : 'right'}" class="ic-sm"></i></button></td>` : ''}${c.check ? `<td><input type="checkbox" autocomplete="off" class="accent-[#04C99E]" data-lchk="${it.id}" ${s.sel.has(it.id) ? 'checked' : ''}></td>` : ''}${cells}
      <td class="text-right">${c.view ? `<button data-rview="${it.id}" aria-label="Lihat detail"><i data-lucide="eye" class="ic-sm"></i></button>` : c.edit ? `<button data-redit="${it.id}" aria-label="Ubah"><i data-lucide="square-pen" class="ic-sm"></i></button>` : `<button data-rmenu="${it.id}" aria-label="Aksi"><i data-lucide="more-horizontal"></i></button>`}</td></tr>
      ${open && c.detail ? `<tr class="bg-[#FAFAFA]"><td></td><td colspan="${c.cols.length + 2}">${c.detail(it)}</td></tr>` : ''}`;
  }).join('');
  return `<div class="overflow-x-auto"><table class="tbl w-full min-w-max"><thead>${head}</thead><tbody>${body}</tbody></table></div>${items.length ? pager(items.length) : emptyTable()}`;
}

function listFilters(slug) {
  const c = LISTS[slug], s = st(slug), n = s.sel.size, b = c.bulk;
  const bulk = b && n ? `<div class="flex flex-wrap items-center gap-2 lg:ml-auto">
      ${b.ops ? `<select data-lbulk class="fin fsel w-[165px] min-h-0 h-9 ${s.bop === '' ? 'text-[#A0A6A6]' : ''}"><option value="">${b.ph}</option>${bulkOps(b).map((o, i) => `<option value="${i}" ${s.bop === String(i) ? 'selected' : ''}>${esc(o[0])}</option>`).join('')}</select>
      <button data-act="bterap" ${s.bop === '' ? 'disabled' : ''} class="h-9 px-3 rounded-md bg-brand disabled:bg-[#D6D9D9] text-white text-[14px] font-semibold whitespace-nowrap">${b.terapLabel ? b.terapLabel(n) : `Terapkan ${n} ${b.noun}`}</button>` : ''}
      <button data-act="bhapus" class="h-9 px-3 rounded-md bg-[#E5333F] text-white text-[14px] font-semibold whitespace-nowrap">${b.hapusLabel ? b.hapusLabel(n) : `Hapus ${n} ${b.noun}`}</button></div>` : '';
  return [
    `<label class="input w-[220px] h-9 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-lq class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..." value="${esc(s.q)}"></label>`,
    c.katFilter ? `<select data-lkat class="fin fsel w-[220px] min-h-0 h-9"><option value="">Semua Kategori</option>${db().kategori.map(k => `<option value="${k.id}" ${s.kat === k.id ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select>` : '',
    c.extraFilters ? c.extraFilters() : '',
    c.statusFilter ? `<select data-lstatus class="fin fsel w-[230px] min-h-0 h-9 ${s.status ? '' : 'text-[#A0A6A6]'}"><option value="">Tampilkan Semua Status</option><option value="aktif" ${s.status === 'aktif' ? 'selected' : ''}>Aktif</option><option value="non" ${s.status === 'non' ? 'selected' : ''}>Tidak Aktif</option></select>` : '',
    bulk || (c.seg ? `<div class="seg seg-sm flex border border-line rounded-lg overflow-hidden lg:ml-auto">${c.seg.map((x, i) => `<button data-lseg="${i}" class="${s.seg === i ? 'active' : ''}">${x}</button>`).join('')}</div>` : '')
  ].join('');
}

function listPage(slug) {
  killCharts();
  const c = LISTS[slug], s = st(slug);
  s.sel.clear(); s.bop = '';
  return `${c.above ? c.above() : ''}<section class="card p-5">
    <div class="flex flex-wrap items-start gap-3">
      <div><div class="flex items-center gap-3"><h1 class="text-[20px] font-semibold leading-7">${c.title}</h1>${c.help ? '<i data-lucide="help-circle" class="text-brand" style="width:22px;height:22px"></i>' : ''}<i data-lucide="star" class="text-ink-4" style="width:22px;height:22px"></i></div>
        ${c.sub ? `<p class="text-[12px] text-ink-3 mt-2">${c.sub()}</p>` : ''}</div>
      <div class="ml-auto flex flex-wrap items-center gap-2">${c.links || ''}${btnPrimary(c.add[0], 'plus').replace('<button', '<button data-act="add"')}</div>
    </div>${hr}
    <div data-lfilters class="flex flex-wrap items-center gap-2">${listFilters(slug)}</div>${hr}
    ${c.top ? c.top() : ''}<div data-ltable>${listTableHtml(slug)}</div>
  </section>`;
}

Object.keys(LISTS).forEach(slug => { PAGES[slug] = () => listPage(slug); });

// interaksi halaman daftar
const curList = () => LISTS[state.page] ? state.page : null;
const repaintTable = slug => {
  const el = document.querySelector('[data-ltable]');
  if (!el) return;
  el.innerHTML = listTableHtml(slug); lucide.createIcons();
  const all = el.querySelector('[data-lall]'), s = st(slug);
  if (all) all.indeterminate = !all.checked && [...el.querySelectorAll('[data-lchk]')].some(b => s.sel.has(b.dataset.lchk));
};
// centang baris mengganti baris filter (aksi massal), jadi baris filter ikut digambar ulang
const repaintSel = slug => { const f = document.querySelector('[data-lfilters]'); if (f) f.innerHTML = listFilters(slug); repaintTable(slug); };
document.addEventListener('input', e => { const slug = curList(); if (slug && e.target.matches('[data-lq]')) { st(slug).q = e.target.value.toLowerCase(); repaintTable(slug); } });
document.addEventListener('change', e => {
  const slug = curList(); if (!slug) return;
  if (e.target.matches('[data-lkat]')) { st(slug).kat = e.target.value; repaintTable(slug); }
  if (e.target.matches('[data-lstatus]')) { st(slug).status = e.target.value; repaintTable(slug); }
  const s = st(slug);
  if (e.target.matches('[data-lchk]')) { e.target.checked ? s.sel.add(e.target.dataset.lchk) : s.sel.delete(e.target.dataset.lchk); repaintSel(slug); }
  if (e.target.matches('[data-lall]')) { LISTS[slug].items(s).forEach(it => (e.target.checked ? s.sel.add(it.id) : s.sel.delete(it.id))); repaintSel(slug); }
  if (e.target.matches('[data-lbulk]')) { s.bop = e.target.value; repaintSel(slug); }
});
document.addEventListener('click', e => {
  const slug = curList(); if (!slug || !e.target.closest('#page')) return;
  const c = LISTS[slug], s = st(slug), t = e.target;
  const seg = t.closest('[data-lseg]');
  if (seg) { s.seg = +seg.dataset.lseg; document.querySelectorAll('[data-lseg]').forEach(b => b.classList.toggle('active', b === seg)); return repaintTable(slug); }
  const ex = t.closest('[data-expand]');
  if (ex) { s.open.has(ex.dataset.expand) ? s.open.delete(ex.dataset.expand) : s.open.add(ex.dataset.expand); return repaintTable(slug); }
  const rm = t.closest('[data-rmenu]');
  if (rm) { const it = c.items({ ...s, q: '', seg: 0, kat: '', status: '' }).find(x => x.id === rm.dataset.rmenu); return rowMenu(rm, c.menu(it)); }
  const vw = t.closest('[data-rview]');
  if (vw) return c.view(c.items({ ...s, q: '', seg: 0, kat: '', status: '' }).find(x => x.id === vw.dataset.rview));
  const ed = t.closest('[data-redit]');
  if (ed) return c.edit(c.items({ ...s, q: '', seg: 0, kat: '', status: '' }).find(x => x.id === ed.dataset.redit));
  const act = t.closest('[data-act]')?.dataset.act;
  if (c.acts?.[act]) return c.acts[act](t.closest('[data-act]'));
  if (act === 'add') return c.add[1]();
  if (act === 'log') return logModal();
  if (act === 'ekspor') return toast('Berhasil!', 'Data sedang diekspor. Berkas dapat diunduh di menu <b>Daftar Ekspor</b>');
  if (act === 'bterap') return bulkApply(slug);
  if (act === 'bhapus') return bulkDelete(slug);
  if (act === 'impor') return rowMenu(t.closest('[data-act]'), ['Impor Produk Baru', 'Impor Ubah Produk', 'Impor Ubah Resep'].map(k => [k, () => imporWizard(k)]));
});

// aksi massal: terapkan status langsung tanpa konfirmasi; hapus lewat konfirmasi merah
const bulkOps = b => (typeof b.ops === 'function' ? b.ops() : b.ops);
function bulkApply(slug) {
  const b = LISTS[slug].bulk, s = st(slug), [label, fn] = bulkOps(b)[+s.bop];
  db()[b.coll].filter(x => s.sel.has(x.id)).forEach(x => { fn(x); logAct(x.nama, `Ubah ${b.log}`, label); });
  saveDB(); render();
  toast('Berhasil!', b.diubah);
}
async function bulkDelete(slug) {
  const b = LISTS[slug].bulk, s = st(slug), n = s.sel.size;
  if (!(await confirmDialog({ ...b.hapus(n), danger: true }))) return;
  db()[b.coll].filter(x => s.sel.has(x.id)).forEach(x => logAct(x.nama, `Hapus ${b.log}`, 'Berhasil Dihapus'));
  db()[b.coll] = db()[b.coll].filter(x => !s.sel.has(x.id));
  if (b.afterDelete) b.afterDelete(s.sel);
  saveDB(); render();
  toast('Berhasil!', b.dihapus ? b.dihapus(n) : `${n} ${b.noun} berhasil dihapus`);
}
