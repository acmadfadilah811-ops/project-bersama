// Grup Inventori interaktif (Penjualan > Inventori), direkam dari referensi 22 Okt 2026
// (catatan lengkap: catatan-rekaman-inventori.md). Stok dihitung dari db().mutasi (store.js),
// jadi penjualan di Kasir ikut mengurangi stok produk yang memakai monitor persediaan.

const BULAN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const OUTLET_UTAMA = OUTLETS[0];
const pad2 = n => String(n).padStart(2, '0');
const tglPanjang = iso => { const d = new Date(iso); return `${d.getDate()} ${BULAN_P[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const tglPendek = iso => { const d = new Date(iso); return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
const isoLocal = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtN = n => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
function invPeriode() {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), last = new Date(y, m + 1, 0).getDate();
  return { awal: new Date(y, m, 1).toISOString(), label: `01 ${BULAN_P[m]} - ${last} ${BULAN_P[m]} ${y}`, btn: `01 ${BULAN[m]} ${y} - ${last} ${BULAN[m]} ${y}` };
}
const periodeSub = () => `<span class="flex items-center gap-2 font-medium text-ink-2"><i data-lucide="calendar" class="ic-sm"></i>${invPeriode().label}</span>`;
// nomor dokumen otomatis, mis. SO/261022/0001
function nomorDoc(prefix, coll) {
  const d = new Date(), tag = `${prefix}/${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}/`;
  const n = db()[coll].filter(x => (x.nomor || '').startsWith(tag)).length + 1;
  return tag + String(n).padStart(4, '0');
}
// status bertitik seperti referensi: Menunggu/Belum Lunas biru, Draf abu, Void merah, lainnya hijau
function stPill(txt) {
  const t = /Menunggu|Belum|Sebagian/.test(txt) ? ['#E6F4FF', '#0958D9', '#1677FF'] : /Draf/.test(txt) ? ['#F2F2F2', '#777777', '#A0A6A6'] : /Void/.test(txt) ? ['#FFF1F0', '#CF1322', '#E5333F'] : ['#E6F9F4', '#10AF8C', '#04C99E'];
  return `<span class="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-1 rounded whitespace-nowrap" style="background:${t[0]};color:${t[1]}"><span class="w-1.5 h-1.5 rounded-full" style="background:${t[2]}"></span>${txt}</span>`;
}
const infoBar = html => `<div class="rounded-md border border-[#91CAFF] bg-[#E6F4FF] px-4 py-2.5 mb-4 text-[14px] text-ink-2 flex items-center gap-3"><i data-lucide="info" class="ic-sm shrink-0" style="fill:#404545;color:#fff"></i><span>${html}</span></div>`;

// ---------- barang stok (bahan baku + produk dengan monitor persediaan) ----------
function stokItems() {
  return [
    ...db().bahan.map(b => itemOf('b:' + b.id)),
    ...db().produk.filter(p => p.monitor).map(p => itemOf('p:' + p.id))
  ];
}
function itemOf(key) {
  const [t, id] = key.split(':');
  if (t === 'b') {
    const b = byId('bahan', id);
    if (b) return { key, jenis: 'Bahan', nama: b.nama, sku: b.satuan[0]?.sku || '-', satuan: b.satuan[0]?.nama || '', satuans: b.satuan, hargaBeli: b.satuan[0]?.hargaBeli || 0, hargaJual: 0, kategori: '', stokMin: +b.stokMin || 0 };
  } else {
    const p = byId('produk', id);
    if (p) return { key, jenis: 'Produk', nama: p.nama, sku: p.sku || '-', satuan: p.satuan, satuans: [{ nama: p.satuan, konversi: 1 }], hargaBeli: p.hargaBeli || p.hargaModal || 0, hargaJual: p.hargaJual, kategori: p.kategori, stokMin: +p.stokMin || 0 };
  }
  return { key, jenis: '-', nama: '(barang dihapus)', sku: '-', satuan: '', satuans: [{ nama: '', konversi: 1 }], hargaBeli: 0, hargaJual: 0, kategori: '', stokMin: 0 };
}
const konv = (it, sat) => it.satuans.find(s => s.nama === sat)?.konversi || 1;
const satOpts = it => it.satuans.map(s => s.nama);

// modal "Pilih Produk" untuk semua form stok
function pickItems(selected = []) {
  return new Promise(resolve => {
    const sel = new Set(selected);
    let q = '', jenis = '', kat = '';
    const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${layer += 2}">
      <div class="bg-white rounded-lg w-[1094px] max-w-full max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-line"><h3 class="text-[20px] font-semibold">Pilih Produk</h3><button data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
        <div class="px-6 pt-4 flex flex-wrap gap-3"><label class="input w-[244px] h-8 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-q class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..."></label>
          <select data-jenis class="fin fsel w-[244px] min-h-0 h-8"><option value="">Semua</option><option>Produk</option><option>Bahan</option></select>
          <select data-kat class="fin fsel w-[244px] min-h-0 h-8"><option value="">Semua Kategori</option>${db().kategori.map(k => `<option value="${k.id}">${esc(k.nama)}</option>`).join('')}</select></div>
        <div data-list class="flex-1 overflow-auto px-6 pt-4 min-h-[240px]"></div>
        <div class="flex justify-end items-center gap-8 px-6 py-4 border-t border-line">${fBtn.text('Batal', 'data-x')}${fBtn.primary('Simpan', 'data-ok')}</div></div></div>`);
    const paint = () => {
      const items = stokItems().filter(i => (!q || (i.nama + i.sku).toLowerCase().includes(q)) && (!jenis || i.jenis === jenis) && (!kat || i.kategori === kat));
      d.querySelector('[data-list]').innerHTML = `<table class="tbl w-full"><thead><tr><th class="w-8"><input type="checkbox" data-all class="accent-[#04C99E]"></th><th>SKU</th><th>Produk</th><th>Kategori</th><th>Jenis</th><th>Stok</th><th>Harga Beli</th><th>Harga Jual</th></tr></thead><tbody>
        ${items.map(i => `<tr><td><input type="checkbox" data-pick="${i.key}" class="accent-[#04C99E]" ${sel.has(i.key) ? 'checked' : ''}></td><td>${esc(i.sku)}</td><td>${esc(i.nama)}</td><td>${i.kategori ? esc(katName(i.kategori)) : ''}</td><td>${i.jenis}</td><td>${fmtN(stokOf(i.key))}</td><td>${rp(i.hargaBeli)}</td><td>${rp(i.hargaJual)}</td></tr>`).join('')}</tbody></table>
        ${items.length ? '' : '<p class="text-center text-[14px] text-ink-3 py-10">Belum ada bahan baku atau produk dengan monitor persediaan</p>'}`;
    };
    const close = v => { d.remove(); layer -= 2; resolve(v); };
    d.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) return close(null);
      if (e.target.closest('[data-ok]')) close([...sel]);
    });
    d.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-pick]')) t.checked ? sel.add(t.dataset.pick) : sel.delete(t.dataset.pick);
      if (t.matches('[data-all]')) d.querySelectorAll('[data-pick]').forEach(c => { c.checked = t.checked; t.checked ? sel.add(c.dataset.pick) : sel.delete(c.dataset.pick); });
      if (t.matches('[data-jenis]')) { jenis = t.value; paint(); }
      if (t.matches('[data-kat]')) { kat = t.value; paint(); }
    });
    d.addEventListener('input', e => { if (e.target.matches('[data-q]')) { q = e.target.value.toLowerCase(); paint(); } });
    document.body.appendChild(d); paint(); lucide.createIcons();
  });
}

// ---------- isian di dalam tabel: data-t (tabel), data-i (baris), data-f (kolom) ----------
const ref = (t, i, f) => `data-t="${t}" data-i="${i}" data-f="${f}"`;
function cell(t, i, f, val, o = {}) {
  const off = o.disabled ? 'disabled' : '', grey = o.disabled ? 'bg-[#F2F2F2] text-[#A0A6A6]' : '';
  if (o.money) return `<div class="fin flex items-center gap-2 min-w-[130px] ${grey}"><span class="text-ink-3">Rp</span><input ${ref(t, i, f)} data-money inputmode="numeric" class="flex-1 min-w-0 outline-none bg-transparent" value="${val ? toNum(val).toLocaleString('id-ID') : '0'}" ${off}></div>`;
  if (o.select) return `<select ${ref(t, i, f)} class="fin fsel min-w-[110px] ${grey}" ${off}>${o.select.map(v => `<option ${v === val ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  if (o.area) return `<textarea ${ref(t, i, f)} rows="2" maxlength="${o.max || 200}" class="fin" placeholder="${esc(o.ph || '')}">${esc(val || '')}</textarea>`;
  if (o.sw) return `<button type="button" class="sw" role="switch" ${ref(t, i, f)} data-on="${val ? 1 : 0}" aria-checked="${!!val}"></button>`;
  return `<div class="relative ${o.suffix ? 'min-w-[130px]' : ''}"><input ${ref(t, i, f)} ${o.num ? 'data-numf inputmode="decimal"' : ''} class="fin ${o.w || 'min-w-[80px]'} ${grey} ${o.suffix ? 'pr-14' : ''}" value="${esc(val ?? '')}" placeholder="${esc(o.ph || '')}" ${off}>${o.suffix ? `<span class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 text-[14px]">${o.suffix}</span>` : ''}</div>`;
}
function readCells(root, tables) {
  root.querySelectorAll('[data-t][data-i][data-f]').forEach(el => {
    const row = tables[el.dataset.t]?.[+el.dataset.i];
    if (!row) return;
    row[el.dataset.f] = el.classList.contains('sw') ? el.dataset.on === '1'
      : 'money' in el.dataset ? toNum(el.value)
      : 'numf' in el.dataset ? (parseFloat(el.value.replace(/\./g, '').replace(',', '.')) || 0)
      : el.value;
  });
}
const invTbl = (cols, rows) => `<div class="overflow-x-auto"><table class="tbl w-full"><thead><tr style="background:#FAFAFA">${cols.map(c => `<th class="whitespace-nowrap">${c}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>${rows.length ? '' : emptyTable()}`;
const delBtn = (t, i) => `<button type="button" data-del="${t}:${i}" class="text-ink-3" aria-label="Hapus baris"><i data-lucide="trash-2" class="ic-sm"></i></button>`;
const kvRow = (k, v) => `<div class="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)] gap-1"><span class="bg-[#F7F7F7] px-3 py-2.5 text-[14px]">${k}</span><span class="bg-[#F7F7F7] px-3 py-2.5 text-[14px] break-words">${v ?? '-'}</span></div>`;
const card = (inner, cls = '') => `<section class="bg-white rounded-lg p-6 mb-6 ${cls}" style="box-shadow:rgba(0,0,0,.05) 0 1px 3px">${inner}</section>`;
const radioCard = (name, value, title, sub, on, disabled) => `<label class="flex-1 min-w-[220px] block border rounded-md p-3 ${disabled ? 'border-[#D6D9D9] text-[#A0A6A6]' : on ? 'border-brand' : 'border-[#D6D9D9] cursor-pointer'}">
  <span class="flex items-center gap-3 text-[14px]"><input type="radio" name="${name}" value="${value}" class="w-4 h-4 accent-[#04C99E]" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}>${title}</span><span class="block text-[12px] mt-1.5 ${disabled ? '' : 'text-ink-3'}">${sub}</span></label>`;
const dtInput = (name, iso, disabled) => `<input type="datetime-local" name="${name}" class="fin ${disabled ? 'bg-[#F2F2F2] text-[#A0A6A6]' : ''}" value="${isoLocal(new Date(iso))}" ${disabled ? 'disabled' : ''}>`;
const uploadCard = () => card(`<h2 class="text-[20px] font-semibold mb-4">Unggah File</h2>
  <div class="grid md:grid-cols-[200px_1fr] gap-4"><p class="text-[14px] font-semibold">Pilih File</p><div>${fUpload('Pilih atau letakkan berkas di sini', 'w-full h-[120px]')}
  <p class="text-[12px] text-ink-3 mt-3 leading-5">1. File dapat berupa Excel, Word, PDF, JPG, PNG, atau ZIP<br>2. Maksimal 5 File<br>3. Maksimal 2 MB per file</p></div></div>`);

// sheet dengan navigasi kiri (wizard atau bagian form)
function navSheet({ title, navs, body, footer }) {
  const sh = openSheet({ title, body: `<div class="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6 px-4 lg:px-6 py-10 items-start">
    <nav data-nav class="bg-white rounded-lg py-5 px-6 lg:sticky lg:top-0" style="box-shadow:rgba(0,0,0,.05) 0 1px 3px"></nav><div data-main class="min-w-0"></div></div>`, footer });
  sh.setNav = (active, done = []) => {
    sh.root.querySelector('[data-nav]').innerHTML = `<ul class="border-l-2 border-[#EEEEEE] space-y-4">${navs.map((n, i) => `<li><button type="button" data-navi="${i}" class="-ml-0.5 pl-5 py-0.5 text-[14px] font-semibold flex items-center gap-2 ${i === active ? 'text-brand border-l-4 border-brand' : done.includes(i) ? 'text-ink' : 'text-ink-3'}">${done.includes(i) ? '<i data-lucide="check-circle-2" class="ic-sm text-white" style="fill:#04C99E"></i>' : ''}${n}</button></li>`).join('')}</ul>`;
    lucide.createIcons();
  };
  sh.setMain = html => { sh.root.querySelector('[data-main]').innerHTML = html; lucide.createIcons(); };
  if (body) sh.setMain(body);
  return sh;
}

// ---------- jurnal (Lihat Jurnal) ----------
function jurnalModal(judul, nomor, waktu, baris) {
  const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${layer += 2}">
    <div class="bg-white rounded-lg w-[1096px] max-w-full max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-line"><h3 class="text-[20px] font-semibold">Detail Jurnal</h3><button data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
      <div class="overflow-auto p-6"><table class="tbl w-full"><thead><tr><th>No Transaksi</th><th>Deskripsi</th><th>Kode Akun</th><th>Nama Akun</th><th>Debit</th><th>Kredit</th></tr></thead><tbody>
        <tr class="bg-[#FAFAFA] font-semibold"><td>${OUTLET_UTAMA}</td><td colspan="4">${judul} - ${esc(nomor)}</td><td class="text-right">${tglPendek(waktu)}</td></tr>
        ${baris.map(b => `<tr><td>${esc(nomor.replace(/\/.*\//, '-'))}</td><td>${judul} - ${esc(nomor)}</td><td>${b[0]}</td><td>${b[1]}</td><td>${rp(b[2])}</td><td>${rp(b[3])}</td></tr>`).join('')}</tbody></table></div></div></div>`);
  d.addEventListener('click', e => { if (e.target.closest('[data-x]') || e.target === d) { d.remove(); layer -= 2; } });
  document.body.appendChild(d); lucide.createIcons();
}

// ---------- Stok Opname & Stok Terbuang ----------
const DOC = {
  opname: { coll: 'opname', prefix: 'SO', noun: 'Stok Opname', judul: 'Informasi Stok Opname', catatan: 'Contoh: Barang Hilang', status: 'Berhasil', toast: 'Stok opname berhasil ditambahkan',
    confirm: ['Simpan Stok Opname', 'Menyimpan stok opname akan mengubah stok barang saat ini &amp; tidak dapat dibatalkan. Lanjutkan?'] },
  terbuang: { coll: 'terbuang', prefix: 'ST', noun: 'Stok Terbuang', catatan: 'Contoh: Sudah Kadaluwarsa', status: 'Selesai', toast: 'Stok terbuang berhasil ditambahkan',
    confirm: ['Simpan Stok terbuang', 'Menyimpan stok terbuang akan mengubah stok barang saat ini dan tidak dapat dibatalkan. Lanjutkan?'] }
};
function stokDocForm(kind) {
  const C = DOC[kind], opn = kind === 'opname';
  const o = { outlet: opn ? '' : OUTLET_UTAMA, rows: [], jenis: '', kat: '', q: '' };
  const T = { r: o.rows };
  const rowsHtml = () => {
    const vis = o.rows.map((r, i) => [r, i]).filter(([r]) => { const it = itemOf(r.item); return (!o.jenis || it.jenis === o.jenis) && (!o.kat || it.kategori === o.kat) && (!o.q || it.nama.toLowerCase().includes(o.q)); });
    const cols = opn ? ['SKU', 'Barang', 'Stok Sistem', 'Stok Aktual', 'Satuan', 'Selisih', 'Harga Modal', ''] : ['SKU', 'Barang', 'Stok', 'Stok Terbuang', 'Satuan', 'Harga Modal', ''];
    return invTbl(cols, vis.map(([r, i]) => {
      const it = itemOf(r.item), stok = stokOf(r.item);
      const main = opn
        ? `<td>${cell('r', i, 'x', fmtN(stok), { disabled: true })}</td><td>${cell('r', i, 'aktual', r.aktual, { num: true })}</td><td>${cell('r', i, 'satuan', r.satuan, { select: satOpts(it) })}</td>
           <td class="whitespace-nowrap" data-selisih="${i}">${fmtN(r.aktual * konv(it, r.satuan) - stok)} ${esc(it.satuan)}</td><td>${cell('r', i, 'y', fmtN(it.hargaBeli), { disabled: true })}</td>`
        : `<td>${cell('r', i, 'x', fmtN(stok), { disabled: true, suffix: esc(it.satuan) })}</td><td>${cell('r', i, 'qty', r.qty, { num: true })}<p class="text-[12px] text-ink-3 mt-1">Stok tersedia: ${fmtN(stok)}</p></td>
           <td>${cell('r', i, 'satuan', r.satuan, { select: satOpts(it) })}</td><td class="whitespace-nowrap">${rp(it.hargaBeli)},00</td>`;
      return `<tr><td>${esc(it.sku)}</td><td>${esc(it.nama)}</td>${main}<td>${delBtn('r', i)}</td></tr>
        <tr><td colspan="2" class="font-semibold">Catatan</td><td colspan="${opn ? 6 : 5}">${cell('r', i, 'catatan', r.catatan, { area: true, max: 50, ph: C.catatan })}</td></tr>`;
    }));
  };
  const body = () => card(`${C.judul ? `<h2 class="text-[20px] font-semibold mb-4">${C.judul}</h2>` : ''}
      ${fRow('Daftar Outlet', fSelect('outlet', OUTLETS, o.outlet, 'Pilih Outlet', { req: 'Mohon pilih outlet' }), { required: true })}
      ${fRow(`Nomor ${C.noun}`, fInput('nomor', `Contoh: ${nomorDoc(C.prefix, C.coll)}`, '') + '<p class="text-[12px] text-ink-3 mt-1">Jika kosong akan diisi otomatis oleh sistem</p>')}
      ${fRow('Tanggal Transaksi', dtInput('waktu', new Date().toISOString()))}
      ${fRow('Catatan', fInput('catatan', C.catatan, '', { area: true }))}
      <div class="flex items-center justify-between mt-4"><p class="text-[14px] font-semibold">Rincian Barang</p>${fBtn.outline('Atur Barang', 'type="button" data-atur')}</div>
      <div class="flex flex-wrap items-center gap-3 mt-4"><select data-fkat class="fin fsel w-[226px] min-h-0 h-9"><option value="">${opn ? 'Semua Kategori' : 'Pilih Kategori'}</option>${db().kategori.map(k => `<option value="${k.id}">${esc(k.nama)}</option>`).join('')}</select>
        <div class="seg seg-sm flex border border-line rounded-lg overflow-hidden ml-auto">${['', 'Produk', 'Bahan'].map(j => `<button type="button" data-fj="${j}" class="${o.jenis === j ? 'active' : ''}">${j || 'Semua'}</button>`).join('')}</div></div>
      <label class="input h-9 flex items-center gap-2 text-ink-4 mt-3"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-fq class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..."></label>
      <div data-rows class="mt-3">${rowsHtml()}</div>`);
  const sh = openSheet({ title: `Tambah ${C.noun}`, body: `<div class="px-4 py-10"><div class="max-w-[982px] mx-auto">${body()}</div></div>`,
    footer: `<div class="w-full max-w-[982px] mx-auto flex items-center gap-8">${fBtn.outline('Simpan Draf', 'data-draf').replace('px-6', 'px-3')}<div class="ml-auto flex items-center gap-8">${fBtn.text('Batal', 'data-cancel')}${fBtn.primary('Simpan', 'data-save')}</div></div>` });
  const R = sh.root;
  const repaint = () => { readCells(R, T); R.querySelector('[data-rows]').innerHTML = rowsHtml(); lucide.createIcons(); };
  const cancel = async () => { if (await confirmCancel(`Tambah ${C.noun}`)) sh.close(); };
  sh.onClose = cancel;
  const collect = status => {
    readCells(R, T);
    const v = formValues(R.querySelector('[data-body]'));
    return { id: uid(), nomor: v.nomor || nomorDoc(C.prefix, C.coll), outlet: v.outlet, waktu: new Date(v.waktu || Date.now()).toISOString(), catatan: v.catatan, status, dibuat: 'Bayu',
      items: o.rows.map(r => { const it = itemOf(r.item), k = konv(it, r.satuan); return opn ? { item: r.item, satuan: r.satuan, sistem: stokOf(r.item), aktual: r.aktual * k, harga: it.hargaBeli, catatan: r.catatan } : { item: r.item, satuan: r.satuan, qty: r.qty * k, harga: it.hargaBeli, catatan: r.catatan }; }) };
  };
  R.addEventListener('change', e => {
    if (e.target.matches('[name="outlet"]')) o.outlet = e.target.value;
    if (e.target.matches('[data-fkat]')) { o.kat = e.target.value; repaint(); }
    if (e.target.matches('[data-f="satuan"]')) repaint();
  });
  R.addEventListener('input', e => {
    if (e.target.matches('[data-fq]')) { o.q = e.target.value.toLowerCase(); repaint(); e.target.focus(); }
    // selisih opname ikut berubah saat stok aktual diketik
    if (opn && e.target.matches('[data-f="aktual"]')) {
      readCells(R, T);
      const i = +e.target.dataset.i, r = o.rows[i], it = itemOf(r.item);
      R.querySelector(`[data-selisih="${i}"]`).textContent = `${fmtN(r.aktual * konv(it, r.satuan) - stokOf(r.item))} ${it.satuan}`;
    }
  });
  R.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-cancel]')) return cancel();
    const fj = t.closest('[data-fj]');
    if (fj) { o.jenis = fj.dataset.fj; R.querySelectorAll('[data-fj]').forEach(b => b.classList.toggle('active', b === fj)); return repaint(); }
    const del = t.closest('[data-del]');
    if (del) { readCells(R, T); o.rows.splice(+del.dataset.del.split(':')[1], 1); return repaint(); }
    if (t.closest('[data-atur]')) {
      if (!R.querySelector('[name="outlet"]').value) return toast('Gagal!', 'Silahkan Pilih outlet terlebih dahulu', 'error');
      readCells(R, T);
      const keys = await pickItems(o.rows.map(r => r.item));
      if (!keys) return;
      const keep = o.rows.filter(r => keys.includes(r.item));
      o.rows.length = 0;
      keys.forEach(k => o.rows.push(keep.find(r => r.item === k) || { item: k, satuan: itemOf(k).satuan, aktual: 0, qty: 0, catatan: '' }));
      return repaint();
    }
    if (t.closest('[data-draf]')) {
      const doc = collect('Draf'); db()[C.coll].unshift(doc); saveDB(); sh.close(); render();
      return toast('Berhasil!', `Draf ${C.noun.toLowerCase()} berhasil disimpan`);
    }
    if (t.closest('[data-save]')) {
      if (!validate(R.querySelector('[data-body]'))) return;
      readCells(R, T);
      if (!o.rows.length) return toast('Gagal!', 'Rincian barang tidak boleh kosong', 'error');
      if (!opn) {
        if (o.rows.some(r => !(r.qty > 0))) return toast('Gagal!', 'Stok terbuang tidak boleh kosong', 'error');
        if (o.rows.some(r => r.qty * konv(itemOf(r.item), r.satuan) > stokOf(r.item))) return toast('Gagal!', 'Stok terbuang melebihi stok tersedia', 'error');
      }
      if (!(await confirmDialog({ title: C.confirm[0], html: C.confirm[1] }))) return;
      const doc = collect(C.status);
      doc.items.forEach(r => addMutasi(r.item, opn ? r.aktual - r.sistem : -r.qty, kind, doc.nomor, doc.waktu));
      db()[C.coll].unshift(doc);
      logAct(doc.nomor, `Tambah ${C.noun}`, 'Berhasil Ditambahkan');
      saveDB(); sh.close(); render();
      toast('Berhasil!', C.toast);
    }
  });
}
function stokDocDetail(kind, doc) {
  const C = DOC[kind], opn = kind === 'opname';
  const ro = (label, val) => fRow(label, `<input class="fin bg-[#F2F2F2] text-[#A0A6A6]" value="${esc(val)}" disabled>`);
  const nilai = doc.items.reduce((n, r) => n + Math.abs(opn ? r.aktual - r.sistem : r.qty) * r.harga, 0);
  const sh = openSheet({ title: `Detail ${C.noun}`,
    body: `<div class="grid lg:grid-cols-[312px_minmax(0,1fr)] gap-6 px-4 lg:px-10 py-10 items-start"><div>
      ${card(`<p class="flex items-center gap-3 text-[16px] font-semibold">Status ${stPill(doc.status)}</p><p class="text-[14px] text-ink-3 mt-3">Terakhir diperbarui ${tglPanjang(doc.waktu)} oleh ${esc(doc.dibuat)}</p>`)}
      ${doc.status === 'Draf' ? '' : card(`<p class="text-[16px] font-semibold">Lihat Detail Jurnal</p><p class="text-[12px] text-ink-2 mt-2">Klik untuk melihat jurnal yang terbentuk dari transaksi ini.</p><div class="mt-3">${fBtn.outline('Lihat Jurnal', 'data-jurnal').replace('px-6', 'px-3')}</div>`)}</div>
      ${card(`${C.judul ? `<h2 class="text-[20px] font-semibold mb-4">${C.judul}</h2>` : ''}${ro('Outlet', doc.outlet || OUTLET_UTAMA)}${ro(`Nomor ${C.noun}`, doc.nomor)}${ro('Tanggal Dibuat', tglPanjang(doc.waktu))}${ro('Dibuat Oleh', doc.dibuat)}${ro('Tanggal Transaksi', tglPanjang(doc.waktu))}${ro('Catatan', doc.catatan || '')}
        <p class="text-[14px] font-semibold mt-4 mb-3">Rincian Barang</p>
        ${invTbl(opn ? ['SKU', 'Barang', 'Stok Sistem', 'Stok Aktual', 'Satuan', 'Selisih', 'Harga Modal'] : ['SKU', 'Barang', 'Stok Terbuang', 'Satuan', 'Harga Modal'], doc.items.map(r => {
          const it = itemOf(r.item);
          return `<tr><td>${esc(it.sku)}</td><td>${esc(it.nama)}</td>${opn ? `<td>${fmtN(r.sistem)}</td><td>${fmtN(r.aktual)}</td><td>${esc(it.satuan)}</td><td>${fmtN(r.aktual - r.sistem)} ${esc(it.satuan)}</td>` : `<td>${fmtN(r.qty)}</td><td>${esc(it.satuan)}</td>`}<td>${rp(r.harga)}</td></tr>${r.catatan ? `<tr><td class="font-semibold">Catatan</td><td colspan="6">${esc(r.catatan)}</td></tr>` : ''}`;
        }))}`)}</div>`,
    footer: `<div class="ml-auto flex items-center gap-8">${fBtn.text('Cetak', 'data-print')}${fBtn.text('Tutup', 'data-tutup')}</div>` });
  sh.root.addEventListener('click', e => {
    if (e.target.closest('[data-tutup]')) return sh.close();
    if (e.target.closest('[data-print]')) return window.print();
    // opname menambah persediaan (debit), stok terbuang mengurangi persediaan (kredit)
    if (e.target.closest('[data-jurnal]')) jurnalModal(C.noun, doc.nomor, doc.waktu, opn
      ? [['1-10202', 'Persediaan Barang Mentah', nilai, 0], ['8-80100', 'Penyesuaian Persediaan', 0, nilai]]
      : [['8-80100', 'Penyesuaian Persediaan', nilai, 0], ['1-10202', 'Persediaan Barang Mentah', 0, nilai]]);
  });
}

// ---------- perhitungan harga pembelian (pemesanan & faktur) ----------
const PAJAK_OPS = [['', 'Tanpa Pajak'], ['p10', 'Pajak (10%)'], ['i10', 'Harga Termasuk Pajak (10%)'], ['p11', 'Pajak (11%)'], ['i11', 'Harga Termasuk Pajak (11%)'], ['p12', 'Pajak (12%)'], ['i12', 'Harga Termasuk Pajak (12%)']];
function hitungBeli(o, qtyField = 'qty') {
  const lines = o.items.map(r => (r[qtyField] || 0) * (r.harga || 0) * (1 - (r.diskon || 0) / 100));
  const sub = lines.reduce((a, b) => a + b, 0);
  const disk = Math.min(sub, o.diskonJenis === 'pct' ? sub * (o.diskonNilai || 0) / 100 : (o.diskonNilai || 0));
  const dpp = sub - disk, rate = o.pajak ? +o.pajak.slice(1) / 100 : 0, incl = (o.pajak || '')[0] === 'i';
  const pajak = incl ? dpp - dpp / (1 + rate) : dpp * rate;
  const biaya = (o.biaya || []).reduce((a, b) => a + (b.nominal || 0), 0);
  return { lines, sub, disk, pajak, biaya, total: dpp + (incl ? 0 : pajak) + biaya, pajakLabel: (PAJAK_OPS.find(p => p[0] === (o.pajak || '')) || PAJAK_OPS[0])[1] };
}
const sumRow = (k, v, bold) => `<div class="flex justify-between py-2 text-[14px] ${bold ? 'font-semibold border-t border-line mt-1 pt-3' : ''}"><span>${k}</span><span>${v}</span></div>`;

// ---------- Pemesanan Stok (wizard 2 langkah) ----------
function poForm(draft) {
  const o = draft ? JSON.parse(JSON.stringify(draft)) : { pemasok: '', nomor: '', waktu: new Date().toISOString(), items: [], diskonJenis: 'rp', diskonNilai: 0, pajak: '', biaya: [], uangMuka: false, uangMukaNilai: 0 };
  const T = { r: o.items, b: o.biaya };
  let step = 0;
  const pem = () => byId('pemasok', o.pemasok);
  const step1 = () => `${infoBar('Permintaan Aset hanya Tersedia pada Paket Prime+')}
    ${card(`<h2 class="text-[20px] font-semibold mb-4">Jenis Pemesanan</h2><div class="flex flex-wrap gap-3">${radioCard('jenis', 'jual', 'Pemesanan Barang Jual', 'Pilih opsi ini untuk membuat pemesanan barang jual', true)}${radioCard('jenis', 'aset', 'Pemesanan Aset', 'Pilih opsi ini untuk membuat pemesanan aset', false, true)}</div>`)}
    ${card(`<h2 class="text-[20px] font-semibold mb-4">Sumber Stok</h2>${fRow('Pilih Sumber', `<div class="space-y-3">${radioCard('sumber', 'tanpa', 'Tanpa Referensi', 'Kirim pemesanan form yang tersedia', true)}${radioCard('sumber', 'pb', 'Referensikan Permintaan Barang', 'Tambahkan stok melalui permintaan barang', false, true)}</div>`)}`)}
    ${card(`<h2 class="text-[20px] font-semibold mb-4">Informasi Pemesanan Stok</h2>
      ${fRow('Daftar Outlet', fSelect('outlet', OUTLETS, OUTLET_UTAMA), { required: true })}
      ${fRow('Pemasok', fSelect('pemasok', db().pemasok.map(p => [p.id, p.nama]), o.pemasok, 'Pilih Pemasok', { req: 'Mohon pilih pemasok' }), { required: true })}
      ${fRow('Alamat', `<p data-alamat class="text-[14px] text-ink-2 pt-2.5">${pem() ? esc(pem().alamat) : '(Pilih pemasok terlebih dahulu)'}</p>`, { required: true })}
      ${fRow('Nomor Pemesanan Stok', fInput('nomor', `Contoh: ${nomorDoc('PO', 'po')}`, o.nomor) + '<p class="text-[12px] text-ink-3 mt-1">Jika kosong akan diisi otomatis oleh sistem</p>')}
      ${fRow('Tanggal Pemesanan Stok', dtInput('waktu', o.waktu), { required: true })}`)}`;
  const totalsHtml = () => {
    const h = hitungBeli(o);
    return `${sumRow('Subtotal Barang', rp(h.sub) + ',00')}${sumRow(o.diskonJenis === 'pct' ? 'Diskon (%)' : 'Diskon (Rp)', rp(h.disk))}${sumRow(h.pajakLabel, rp(h.pajak))}${h.biaya ? sumRow('Biaya Lainnya', rp(h.biaya)) : ''}${o.uangMuka ? sumRow('Uang Muka', rp(o.uangMukaNilai)) : ''}${sumRow('Total Harga', rp(h.total), true)}`;
  };
  const itemsHtml = () => invTbl(['Barang', 'Jumlah', 'Satuan', 'Harga Satuan', 'Diskon', 'Total', ''], o.items.map((r, i) => {
    const it = itemOf(r.item);
    return `<tr><td class="whitespace-nowrap">${esc(it.nama)}</td><td>${cell('r', i, 'qty', r.qty, { num: true, w: 'w-[72px]' })}</td><td>${cell('r', i, 'satuan', r.satuan, { select: satOpts(it) })}</td><td>${cell('r', i, 'harga', r.harga, { money: true })}</td>
      <td>${cell('r', i, 'diskon', r.diskon, { num: true, w: 'w-[90px]', suffix: '%' })}</td><td><input data-rowtotal="${i}" class="fin bg-[#F2F2F2] text-[#A0A6A6] min-w-[120px]" value="${rp(hitungBeli(o).lines[i])}" disabled></td><td>${delBtn('r', i)}</td></tr>
      <tr><td class="font-semibold">CATATAN</td><td colspan="6">${cell('r', i, 'catatan', r.catatan, { area: true, ph: `Keterangan (${it.nama})` })}</td></tr>`;
  }));
  const step2 = () => card(`<h2 class="text-[20px] font-semibold">Detail Pemesanan Stok</h2>
    <div class="flex items-center justify-between mt-6 mb-4"><p class="text-[14px] font-semibold">Rincian Barang</p>${fBtn.outline('Atur Barang', 'type="button" data-atur')}</div>
    <div data-items>${itemsHtml()}</div>
    <div class="divide-y divide-line mt-6">
      <div class="grid md:grid-cols-[240px_1fr] gap-4 py-4"><p class="text-[14px] font-semibold">Diskon</p><div class="grid sm:grid-cols-2 gap-3">
        <div><p class="text-[12px] mb-1">Jenis Diskon</p><select data-o="diskonJenis" class="fin fsel"><option value="rp" ${o.diskonJenis === 'rp' ? 'selected' : ''}>Diskon (Rp)</option><option value="pct" ${o.diskonJenis === 'pct' ? 'selected' : ''}>Diskon (%)</option></select></div>
        <div><p class="text-[12px] mb-1">Nominal Diskon</p><input data-o="diskonNilai" ${o.diskonJenis === 'rp' ? 'data-money' : ''} inputmode="numeric" class="fin" value="${o.diskonJenis === 'rp' ? toNum(o.diskonNilai).toLocaleString('id-ID') : o.diskonNilai}"></div></div></div>
      <div class="grid md:grid-cols-[240px_1fr] gap-4 py-4"><p class="text-[14px] font-semibold">Pajak</p><div class="grid sm:grid-cols-2 gap-3">
        <div><p class="text-[12px] mb-1">Jenis Pajak</p><select data-o="pajak" class="fin fsel">${PAJAK_OPS.map(p => `<option value="${p[0]}" ${o.pajak === p[0] ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></div>
        <div><p class="text-[12px] mb-1">Nominal pajak</p><input data-pajak class="fin bg-[#F2F2F2] text-[#A0A6A6]" value="${rp(hitungBeli(o).pajak)}" disabled></div></div></div>
      <div class="grid md:grid-cols-[240px_1fr] gap-4 py-4"><p class="text-[14px] font-semibold">Biaya Lainnya</p><div class="space-y-3">
        ${o.biaya.map((b, i) => `<div class="flex gap-3 items-center">${cell('b', i, 'nama', b.nama, { ph: 'Contoh: Ongkos kirim', w: 'w-full' })}${cell('b', i, 'nominal', b.nominal, { money: true })}${delBtn('b', i)}</div>`).join('')}
        <button type="button" data-biaya class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold">Tambah Biaya Lainnya</button></div></div>
      <div class="grid md:grid-cols-[240px_1fr] gap-4 py-4"><p class="text-[14px] font-semibold">Uang Muka</p><div>${fSwitch('uangMuka', o.uangMuka)}
        ${o.uangMuka ? `<div class="mt-3 max-w-[320px]"><p class="text-[12px] mb-1">Nominal Uang Muka</p><input data-o="uangMukaNilai" data-money inputmode="numeric" class="fin" value="${toNum(o.uangMukaNilai).toLocaleString('id-ID')}"></div>` : ''}</div></div>
      <div class="grid md:grid-cols-[240px_1fr] gap-4 py-4"><p class="text-[14px] font-semibold">Total Harga</p><div data-totals>${totalsHtml()}</div></div>
    </div>`);
  const footer = () => step === 0
    ? `<div class="ml-auto flex items-center gap-8">${fBtn.text('Kembali', 'data-back')}${fBtn.primary('Selanjutnya', 'data-next')}</div>`
    : `<div class="w-full flex items-center gap-8 lg:pl-[284px]">${fBtn.outline('Simpan Draf', 'data-draf').replace('px-6', 'px-3')}<div class="ml-auto flex items-center gap-8">${fBtn.text('Kembali', 'data-back')}${fBtn.primary('Simpan', 'data-save')}</div></div>`;
  const sh = navSheet({ title: 'Tambah Pemesanan Stok', navs: ['Informasi Pemesanan Stok', 'Detail Pemesanan Stok'] });
  const R = sh.root;
  const show = () => { sh.setNav(step, step ? [0] : []); sh.setMain(step ? step2() : step1()); sh.setFooter(footer()); };
  const readStep1 = () => { const v = formValues(R.querySelector('[data-main]')); o.pemasok = v.pemasok; o.nomor = v.nomor; o.waktu = new Date(v.waktu || Date.now()).toISOString(); };
  const readStep2 = () => {
    readCells(R, T);
    R.querySelectorAll('[data-o]').forEach(el => { const f = el.dataset.o; o[f] = 'money' in el.dataset ? toNum(el.value) : f === 'diskonNilai' ? (parseFloat(el.value.replace(',', '.')) || 0) : el.value; });
    const sw = R.querySelector('.sw[data-name="uangMuka"]'); if (sw) o.uangMuka = sw.dataset.on === '1';
  };
  const refreshNums = () => {
    const h = hitungBeli(o);
    h.lines.forEach((v, i) => { const el = R.querySelector(`[data-rowtotal="${i}"]`); if (el) el.value = rp(v); });
    R.querySelector('[data-pajak]').value = rp(h.pajak);
    R.querySelector('[data-totals]').innerHTML = totalsHtml();
  };
  const save = async status => {
    readStep2();
    const doc = { ...o, id: draft?.id || uid(), nomor: o.nomor || nomorDoc('PO', 'po'), outlet: OUTLET_UTAMA, jenis: 'Pemesanan Barang Jual', status, dibuat: 'Bayu', items: o.items.map(r => ({ ...r, diterima: r.diterima || 0 })) };
    db().po = db().po.filter(x => x.id !== doc.id);
    db().po.unshift(doc);
    logAct(doc.nomor, 'Tambah Pemesanan Stok', status === 'Draf' ? 'Draf' : 'Berhasil Ditambahkan');
    saveDB(); sh.close(); render();
    return doc;
  };
  const cancel = async () => {
    const r = await confirmDialog({ title: 'Batal Tambah Pemesanan Stok', html: 'Membatalkan proses ini akan menghapus seluruh data yang telah diinput. Lanjutkan?', ok: 'Simpan Draf', cancel: null, extra: 'Ya, Lanjutkan' });
    if (r === 'extra') sh.close();
    else if (r === true) { if (step === 0) readStep1(); else readStep2(); await save('Draf'); toast('Berhasil!', 'Draf pemesanan stok berhasil disimpan'); }
  };
  sh.onClose = cancel;
  R.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[name="pemasok"]')) { const p = byId('pemasok', t.value); R.querySelector('[data-alamat]').textContent = p ? p.alamat : '(Pilih pemasok terlebih dahulu)'; }
    if (t.matches('[data-f="satuan"]')) { readStep2(); const r = o.items[+t.dataset.i], it = itemOf(r.item); r.harga = it.hargaBeli * konv(it, r.satuan); R.querySelector('[data-items]').innerHTML = itemsHtml(); lucide.createIcons(); refreshNums(); }
    if (t.matches('[data-o="diskonJenis"]')) { readStep2(); o.diskonNilai = 0; sh.setMain(step2()); }
    if (t.matches('[data-o="pajak"]')) { readStep2(); refreshNums(); }
  });
  R.addEventListener('input', e => { if (step === 1 && e.target.closest('[data-main]') && !e.target.matches('textarea')) { readStep2(); refreshNums(); } });
  R.addEventListener('sw', () => { if (step === 1) { readStep2(); sh.setMain(step2()); } });
  R.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-back]')) { if (step === 1) { readStep2(); step = 0; return show(); } return cancel(); }
    if (t.closest('[data-next]') || (t.closest('[data-navi="1"]') && step === 0)) {
      if (!validate(R.querySelector('[data-main]'))) return;
      readStep1(); step = 1; return show();
    }
    if (t.closest('[data-navi="0"]') && step === 1) { readStep2(); step = 0; return show(); }
    const del = t.closest('[data-del]');
    if (del) { readStep2(); const [tb, i] = del.dataset.del.split(':'); T[tb].splice(+i, 1); return sh.setMain(step2()); }
    if (t.closest('[data-biaya]')) { readStep2(); o.biaya.push({ nama: '', nominal: 0 }); return sh.setMain(step2()); }
    if (t.closest('[data-atur]')) {
      readStep2();
      const keys = await pickItems(o.items.map(r => r.item));
      if (!keys) return;
      const keep = o.items.filter(r => keys.includes(r.item));
      o.items.length = 0;
      keys.forEach(k => { const it = itemOf(k); o.items.push(keep.find(r => r.item === k) || { item: k, qty: 1, satuan: it.satuan, harga: it.hargaBeli, diskon: 0, catatan: '' }); });
      return sh.setMain(step2());
    }
    if (t.closest('[data-draf]')) { await save('Draf'); return toast('Berhasil!', 'Draf pemesanan stok berhasil disimpan'); }
    if (t.closest('[data-save]')) {
      readStep2();
      if (!o.items.length) return toast('Gagal!', 'Rincian barang tidak boleh kosong', 'error');
      if (o.items.some(r => !(r.qty > 0))) return toast('Gagal!', 'Jumlah barang tidak boleh kosong', 'error');
      if (!(await confirmDialog({ title: 'Simpan Pemesanan Stok', html: 'Pemesanan Stok akan disimpan dan tampil di daftar pembelian stok sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?' }))) return;
      const doc = await save('Menunggu');
      toast('Berhasil!', 'Pemesanan Stok berhasil ditambahkan');
      poPreview(doc);
    }
  });
  show();
}
const sisaPO = r => Math.max(0, (r.qty || 0) - (r.diterima || 0));
function poPreview(po) {
  const h = hitungBeli(po), pm = byId('pemasok', po.pemasok);
  const sh = openSheet({ title: 'Preview Pemesanan Stok',
    body: `<div class="px-4 py-10"><div class="max-w-[934px] mx-auto">${card(`<p class="text-[16px] font-semibold mb-3">Informasi Pemesanan Stok:</p>
      <div class="space-y-1">${kvRow('Jenis Pemesanan', po.jenis)}${kvRow('Outlet', po.outlet)}${kvRow('Nomor Pemesanan Stok', esc(po.nomor))}${kvRow('Pemasok', esc(pm?.nama || '-'))}${kvRow('Tanggal Pemesanan Stok', tglPanjang(po.waktu))}${kvRow('Dibuat Oleh', po.dibuat)}${kvRow('Status', stPill(po.status))}</div>
      <p class="text-[16px] font-semibold mt-8 mb-3">Detail Pemesanan Stok:</p>
      ${invTbl(['Barang', 'Jumlah', 'Satuan', 'Harga Satuan', 'Diskon', 'Total'], po.items.map((r, i) => `<tr><td>${esc(itemOf(r.item).nama)}</td><td>${fmtN(r.qty)}</td><td>${esc(r.satuan)}</td><td>${rp(r.harga)}</td><td>${r.diskon || 0}%</td><td>${rp(h.lines[i])}</td></tr>`))}${pager(po.items.length)}
      <div class="md:ml-auto md:w-[420px] mt-6"><p class="text-[16px] font-semibold mb-2">Total Harga</p>${sumRow('Subtotal Barang', rp(h.sub))}${sumRow(po.diskonJenis === 'pct' ? 'Diskon (%)' : 'Diskon (Rp)', rp(h.disk))}${sumRow(h.pajakLabel, rp(h.pajak))}${h.biaya ? sumRow('Biaya Lainnya', rp(h.biaya)) : ''}${po.uangMuka ? sumRow('Uang Muka', rp(po.uangMukaNilai)) : ''}${sumRow('Total Harga', rp(h.total), true)}</div>`)}</div></div>`,
    footer: `<div class="w-full max-w-[934px] mx-auto flex items-center gap-8">${po.status === 'Menunggu' ? '<button data-void class="h-10 px-5 rounded-md bg-[#E5333F] text-white text-[14px] font-semibold">Void</button>' : ''}
      <div class="ml-auto flex items-center gap-8">${po.status === 'Void' ? '' : '<button data-tindakan class="text-brand text-[14px] font-semibold flex items-center gap-1">Tindakan <i data-lucide="chevron-up" class="ic-sm"></i></button>'}${fBtn.primary('Tutup', 'data-tutup')}</div></div>` });
  sh.root.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-tutup]')) return sh.close();
    if (t.closest('[data-void]')) {
      if (!(await confirmDialog({ title: 'Void Pemesanan Stok', html: `Pemesanan stok <b>${esc(po.nomor)}</b> akan dibatalkan dan tidak dapat diubah kembali. Lanjutkan?`, danger: true }))) return;
      po.status = 'Void'; logAct(po.nomor, 'Void Pemesanan Stok', 'Void'); saveDB(); sh.close(); render();
      return toast('Berhasil!', `Pemesanan Stok <b>${esc(po.nomor)}</b> berhasil di-void`);
    }
    const tb = t.closest('[data-tindakan]');
    if (tb) rowMenu(tb, [
      ['Cetak Pemesanan Stok', () => window.print()],
      ['Kirim Email', () => toast('Berhasil!', `Pemesanan stok dikirim ke <b>${esc(pm?.email || '-')}</b>`)],
      ['Buat Faktur Pembelian', async () => {
        if (!po.items.some(sisaPO)) return toast('Info', 'Semua barang pada pemesanan ini sudah diterima');
        if (await confirmDialog({ title: 'Buat Faktur Pembelian', html: 'Anda akan dialihkan ke halaman Tambah Faktur Pembelian. Lanjutkan?' })) { sh.close(); fakturForm({ po }); }
      }],
      ['Buat Pengiriman Pembelian', () => showLock({ locked: PRIME, lockBtn: 'Upgrade Langganan Anda' })]
    ]);
  });
}

// ---------- Faktur Pembelian ----------
const TERMIN = [7, 14, 30, 45, 60];
function fakturForm({ po } = {}) {
  const o = { sumber: po ? 'po' : 'tanpa', po: po?.id || '', pemasok: po?.pemasok || '', waktu: new Date().toISOString(), termin: '7', manual: '', ket: '', rows: [] };
  const fromPO = p => {
    o.po = p?.id || ''; o.pemasok = p?.pemasok || '';
    o.rows = p ? p.items.map((r, idx) => ({ idx, item: r.item, satuan: r.satuan, harga: r.harga, diskon: r.diskon || 0, sisa: sisaPO(r), qty: 0, terima: true })).filter(r => r.sisa > 0) : [];
  };
  fromPO(po);
  const T = { r: o.rows };
  const curPO = () => byId('po', o.po);
  const calc = () => { const p = curPO(); return hitungBeli({ items: o.rows, diskonJenis: p?.diskonJenis, diskonNilai: p ? p.diskonNilai : 0, pajak: p?.pajak || '', biaya: p?.biaya || [] }); };
  const jatuh = () => o.manual ? new Date(o.manual).toISOString() : new Date(new Date(o.waktu).getTime() + +o.termin * 864e5).toISOString();
  const uangMuka = () => { const p = curPO(); return p?.uangMuka && !db().faktur.some(f => f.po === p.id) ? p.uangMukaNilai : 0; };
  const totalsHtml = () => { const h = calc(); return `${sumRow('Subtotal Barang', rp(h.sub))}${sumRow('Diskon (Rp)', rp(h.disk))}${sumRow(h.pajakLabel, rp(h.pajak))}${sumRow('Biaya Lainnya', rp(h.biaya))}${sumRow('Total Harga', rp(h.total), true)}${sumRow('Sisa Tagihan', rp(Math.max(0, h.total - uangMuka())), true)}`; };
  const rowsHtml = () => invTbl(['Produk', 'Harga Beli (Rp)', 'Satuan', 'Diterima', 'Sisa', 'Diskon', 'Total (Rp)'], o.rows.map((r, i) => {
    const it = itemOf(r.item), viaPO = o.sumber === 'po';
    return `<tr><td class="whitespace-nowrap">${esc(it.nama)}</td><td>${cell('r', i, 'harga', r.harga, { money: true, disabled: viaPO })}</td><td>${cell('r', i, 'satuan', r.satuan, { select: viaPO ? [r.satuan] : satOpts(it), disabled: viaPO })}</td>
      <td>${cell('r', i, 'qty', r.qty, { num: true, w: 'w-[80px]' })}</td><td>${viaPO ? `<input class="fin bg-[#F2F2F2] text-[#A0A6A6] w-[80px]" value="${fmtN(r.sisa - (r.qty || 0))}" data-sisa="${i}" disabled>` : '-'}</td>
      <td>${cell('r', i, 'diskon', r.diskon, { num: true, w: 'w-[90px]', suffix: '%', disabled: viaPO })}</td><td><input data-rowtotal="${i}" class="fin bg-[#F2F2F2] text-[#A0A6A6] min-w-[110px]" value="${fmtN(calc().lines[i])}" disabled></td></tr>
      <tr><td class="font-semibold">Terima Stok</td><td colspan="5">${cell('r', i, 'terima', r.terima, { sw: true })}</td><td class="text-right">${viaPO ? '' : delBtn('r', i)}</td></tr>`;
  }));
  const pm = () => byId('pemasok', o.pemasok);
  const poOpts = db().po.filter(p => ['Menunggu', 'Sebagian'].includes(p.status) && p.items.some(sisaPO)).map(p => [p.id, p.nomor]);
  const main = () => `${infoBar('Permintaan Asset hanya tersedia pada paket Prime+')}
    <div id="fk0">${card(`<h2 class="text-[20px] font-semibold mb-4">Jenis Pembelian</h2><div class="flex flex-wrap gap-3">${radioCard('jenisB', 'jual', 'Pembelian Barang Jual', 'Pilih opsi ini untuk membuat pembelian barang jual', true)}${radioCard('jenisB', 'aset', 'Pembelian Aset', 'Pilih opsi ini untuk membuat pembelian aset', false, true)}</div>`)}
    ${card(`<h2 class="text-[20px] font-semibold mb-4">Sumber Stok</h2>${fRow('Pilih Sumber', `<div class="space-y-3">${radioCard('sumber', 'tanpa', 'Tanpa Nomor Referensi', 'Tambahkan stok masuk manual melalui form yang tersedia', o.sumber === 'tanpa', !!po)}${radioCard('sumber', 'po', 'Referensikan Pemesanan Stok', 'Tambahkan stok melalui pemesanan stok (PO)', o.sumber === 'po')}</div>`)}`)}</div>
    <div id="fk1">${card(`<h2 class="text-[20px] font-semibold mb-4">Detail Stok</h2>
      ${o.sumber === 'po' ? fRow('No. Pemesanan Stok', po ? `<input class="fin bg-[#F2F2F2] text-[#A0A6A6]" value="${esc(po.nomor)}" disabled>` : fSelect('poRef', poOpts, o.po, 'Pilih Pemesanan Stok', { req: 'Mohon pilih pemesanan stok' }), { required: true })
        + fRow('Referensikan Pengiriman Pembelian', `<button type="button" data-kirim class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold flex items-center justify-center gap-2"><i data-lucide="plus" class="ic-sm"></i>Pilih Pengiriman Pembelian</button>`) : ''}
      ${fRow('No. Faktur', fInput('nomor', `Contoh: ${nomorDoc('FA', 'faktur')}`, '', { counter: 25 }) + '<p class="text-[12px] text-ink-3 mt-1">Jika kosong akan diisi otomatis oleh sistem</p>')}
      ${fRow('Distribusi', `<div class="grid sm:grid-cols-2 gap-3"><div><p class="text-[12px] mb-1">Pemasok</p>${o.sumber === 'po' ? `<input class="fin bg-[#F2F2F2] text-[#A0A6A6]" value="${esc(pm()?.nama || '')}" disabled>` : fSelect('pemasok', db().pemasok.map(p => [p.id, p.nama]), o.pemasok, 'Pilih Pemasok', { req: 'Mohon pilih pemasok' })}</div>
        <div><p class="text-[12px] mb-1">Outlet Tujuan</p><input class="fin bg-[#F2F2F2] text-[#A0A6A6]" value="${OUTLET_UTAMA}" disabled></div></div>
        <div data-kontak class="grid grid-cols-[90px_1fr] gap-y-1 text-[14px] mt-3">${pm() ? `<span>Alamat</span><span>: ${esc(pm().alamat)}</span><span>No Ponsel</span><span>: ${esc(pm().telepon)}</span><span>Email</span><span>: ${esc(pm().email)}</span>` : ''}</div>`)}
      ${fRow('Tanggal', `<div class="grid sm:grid-cols-2 gap-3"><div><p class="text-[12px] mb-1">Tanggal Pesan</p><input class="fin bg-[#F2F2F2] text-[#A0A6A6]" value="${curPO() ? tglPanjang(curPO().waktu) : '-'}" disabled></div><div><p class="text-[12px] mb-1">Tanggal Faktur</p>${dtInput('waktu', o.waktu)}</div></div>`)}
      ${fRow('Termin Pembayaran', `<label class="flex items-center gap-3 text-[14px]"><input type="radio" name="terminMode" value="jangka" class="w-4 h-4 accent-[#04C99E]" ${o.manual ? '' : 'checked'}>Pilih Jangka Waktu</label>
        <div class="grid sm:grid-cols-2 gap-3 mt-2 pl-7"><select name="termin" class="fin fsel" ${o.manual ? 'disabled' : ''}>${TERMIN.map(n => `<option value="${n}" ${+o.termin === n ? 'selected' : ''}>${n} Hari</option>`).join('')}</select><input data-jatuh class="fin bg-[#F2F2F2] text-[#A0A6A6]" value="${tglPanjang(jatuh())}" disabled></div>
        <label class="flex items-center gap-3 text-[14px] mt-3"><input type="radio" name="terminMode" value="manual" class="w-4 h-4 accent-[#04C99E]" ${o.manual ? 'checked' : ''}>Pilih Tanggal (Manual)</label>
        ${o.manual ? `<div class="mt-2 pl-7 max-w-[320px]"><input type="date" name="manual" class="fin" value="${o.manual.slice(0, 10)}"></div>` : ''}`, { required: true })}
      <div class="flex items-center justify-between mt-4 mb-4"><p class="text-[14px] font-semibold">Barang</p>${fBtn.outline('Atur Barang Diterima', 'type="button" data-atur').replace('px-6', 'px-3')}</div>
      <div data-rows>${rowsHtml()}</div>
      <div class="md:ml-auto md:w-[420px] mt-6" data-totals>${totalsHtml()}</div>
      ${fRow('Keterangan', `<textarea name="ket" rows="3" class="fin" placeholder="Keterangan">${esc(o.ket)}</textarea>`)}`)}
    ${uploadCard()}</div>`;
  const sh = navSheet({ title: 'Tambah Faktur Pembelian', navs: ['Sumber Stok', 'Detail Stok'],
    footer: `<div class="w-full flex items-center gap-8 lg:pl-[284px]">${fBtn.outline('Simpan Draf', 'data-draf').replace('px-6', 'px-3')}<div class="ml-auto flex items-center gap-8">${fBtn.text('Batal', 'data-cancel')}${fBtn.primary('Simpan', 'data-save')}</div></div>` });
  const R = sh.root;
  const readAll = () => {
    readCells(R, T);
    const v = formValues(R.querySelector('[data-main]'));
    if (v.waktu) o.waktu = new Date(v.waktu).toISOString();
    if (v.termin) o.termin = v.termin;
    o.manual = v.terminMode === 'manual' ? (v.manual || isoLocal().slice(0, 10)) : '';
    if (v.pemasok !== undefined && o.sumber === 'tanpa') o.pemasok = v.pemasok;
    o.ket = v.ket || ''; o.nomor = v.nomor || '';
  };
  const show = () => { sh.setMain(main()); sh.setNav(0); };
  const refreshNums = () => {
    const h = calc();
    h.lines.forEach((v, i) => { const el = R.querySelector(`[data-rowtotal="${i}"]`); if (el) el.value = fmtN(v); const s = R.querySelector(`[data-sisa="${i}"]`); if (s) s.value = fmtN(o.rows[i].sisa - (o.rows[i].qty || 0)); });
    R.querySelector('[data-totals]').innerHTML = totalsHtml();
  };
  const cancel = async () => { if (await confirmCancel('Tambah Faktur Pembelian', 'Membatalkan proses ini akan menghapus seluruh data yang telah diinput. Lanjutkan?')) sh.close(); };
  sh.onClose = cancel;
  const simpan = status => {
    const h = calc(), um = uangMuka(), p = curPO();
    const f = { id: uid(), nomor: o.nomor || nomorDoc('FA', 'faktur'), po: o.po, pemasok: o.pemasok, outlet: OUTLET_UTAMA, waktu: o.waktu, jatuhTempo: jatuh(), jenis: o.sumber === 'po' ? 'Referensikan Pemesanan Stok' : 'Tanpa Nomor Referensi',
      items: o.rows.map(r => ({ item: r.item, satuan: r.satuan, harga: r.harga, diskon: r.diskon, qty: r.qty || 0, terima: r.terima })), diskonJenis: p?.diskonJenis, diskonNilai: p ? p.diskonNilai : 0, pajak: p?.pajak || '', biaya: p?.biaya || [],
      total: h.total, dibayar: Math.min(um, h.total), ket: o.ket, dibuat: 'Bayu', status };
    if (status !== 'Draf') {
      f.status = f.dibayar >= f.total ? 'Lunas' : f.dibayar > 0 ? 'Sebagian' : 'Belum Lunas';
      // barang yang diterima masuk stok; pemesanan stok ikut tercatat diterima
      o.rows.forEach(r => {
        const it = itemOf(r.item);
        if (r.terima && r.qty > 0) addMutasi(r.item, r.qty * konv(it, r.satuan), 'beli', f.nomor, f.waktu);
        if (p) p.items[r.idx].diterima = (p.items[r.idx].diterima || 0) + (r.qty || 0);
      });
      if (p) p.status = p.items.some(sisaPO) ? 'Sebagian' : 'Selesai';
    }
    db().faktur.unshift(f);
    logAct(f.nomor, 'Tambah Faktur Pembelian', status === 'Draf' ? 'Draf' : 'Berhasil Ditambahkan');
    saveDB(); sh.close(); render();
    return f;
  };
  R.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[name="sumber"]')) { readAll(); o.sumber = t.value; fromPO(null); T.r = o.rows; return show(); }
    if (t.matches('[name="poRef"]')) { readAll(); fromPO(byId('po', t.value)); T.r = o.rows; return show(); }
    if (t.matches('[name="pemasok"]') || t.matches('[name="terminMode"]')) { readAll(); return show(); }
    if (t.matches('[name="termin"]') || t.matches('[name="waktu"]') || t.matches('[name="manual"]')) { readAll(); const j = R.querySelector('[data-jatuh]'); if (j) j.value = tglPanjang(jatuh()); }
  });
  R.addEventListener('input', e => { if (e.target.matches('[data-t="r"]')) { readCells(R, T); refreshNums(); } });
  R.addEventListener('click', async e => {
    const t = e.target;
    const nv = t.closest('[data-navi]');
    if (nv) { R.querySelector('#fk' + nv.dataset.navi).scrollIntoView({ behavior: 'smooth' }); return sh.setNav(+nv.dataset.navi); }
    if (t.closest('[data-cancel]')) return cancel();
    if (t.closest('[data-kirim]')) return showLock({ locked: PRIME, lockBtn: 'Upgrade Langganan Anda' });
    const del = t.closest('[data-del]');
    if (del) { readAll(); o.rows.splice(+del.dataset.del.split(':')[1], 1); return show(); }
    if (t.closest('[data-atur]')) {
      readAll();
      if (o.sumber === 'po') return toast('Info', 'Barang mengikuti pemesanan stok. Isi jumlah diterima pada tabel.');
      const keys = await pickItems(o.rows.map(r => r.item));
      if (!keys) return;
      const keep = o.rows.filter(r => keys.includes(r.item));
      o.rows.length = 0;
      keys.forEach(k => { const it = itemOf(k); o.rows.push(keep.find(r => r.item === k) || { item: k, satuan: it.satuan, harga: it.hargaBeli, diskon: 0, qty: 1, terima: true }); });
      return show();
    }
    if (t.closest('[data-draf]')) { readAll(); simpan('Draf'); return toast('Berhasil!', 'Draf faktur pembelian berhasil disimpan'); }
    if (t.closest('[data-save]')) {
      if (!validate(R.querySelector('[data-main]'))) return;
      readAll();
      if (!o.rows.some(r => r.qty > 0)) return toast('Gagal!', 'Jumlah barang diterima tidak boleh kosong', 'error');
      if (o.sumber === 'po' && o.rows.some(r => r.qty > r.sisa)) return toast('Gagal!', 'Jumlah diterima melebihi sisa pemesanan', 'error');
      if (!(await confirmDialog({ title: 'Simpan Faktur Pembelian', html: 'Faktur Pembelian akan disimpan dan tampil di daftar Faktur Pembelian. Lanjutkan?' }))) return;
      const f = simpan('Belum Lunas');
      toast('Berhasil!', '<b>Faktur Pembelian</b> berhasil disimpan');
      fakturPreview(f);
    }
  });
  show();
}
const sisaTagihan = f => Math.max(0, (f.total || 0) - (f.dibayar || 0));
function fakturPreview(f) {
  const h = hitungBeli(f), pm = byId('pemasok', f.pemasok), p = byId('po', f.po);
  const sh = openSheet({ title: 'Preview Faktur Pembelian',
    body: `<div class="px-4 py-10"><div class="max-w-[982px] mx-auto">
      ${card(`<div class="flex flex-wrap items-center gap-3"><p class="text-[16px] font-semibold">Status</p>${stPill(f.status)}<p class="ml-auto text-[14px] text-ink-3">Terakhir diperbarui ${f.diubah ? tglPanjang(f.diubah) : '-'}</p></div>`)}
      ${card(`<p class="text-[16px] font-semibold mb-3">Detail Faktur Pembelian</p>
        <div class="space-y-1">${kvRow('Jenis Pembelian', 'Pembelian Barang Jual')}${kvRow('Nomor Faktur Pembelian', esc(f.nomor))}${kvRow('Tanggal Dibuat', tglPanjang(f.waktu))}${kvRow('Dibuat Oleh', f.dibuat)}${kvRow('Nomor Pemesanan Stok', esc(p?.nomor || '-'))}${kvRow('Tanggal Pesan', p ? tglPanjang(p.waktu) : '-')}${kvRow('Jatuh Tempo', tglPanjang(f.jatuhTempo))}${kvRow('Outlet Tujuan', `Nama Outlet : <b>${f.outlet}</b>`)}</div>
        <p class="text-[16px] font-semibold mt-8 mb-3">Kepada</p>
        <div class="space-y-1">${kvRow('Nama Pemasok', esc(pm?.nama || '-'))}${kvRow('Alamat', esc(pm?.alamat || '-'))}${kvRow('No Ponsel', esc(pm?.telepon || '-'))}${kvRow('Email', esc(pm?.email || '-'))}</div>
        <p class="text-[16px] font-semibold mt-8 mb-3">Detail Produk:</p>
        ${invTbl(['Nama Barang', 'Jumlah', 'Satuan', 'Harga Beli', 'Diskon', 'Total'], f.items.map((r, i) => `<tr><td>${esc(itemOf(r.item).nama)}</td><td>${fmtN(r.qty)}</td><td>${esc(r.satuan)}</td><td>${rp(r.harga)},00</td><td>${r.diskon || 0}%</td><td>${rp(h.lines[i])},00</td></tr>`))}
        <div class="md:ml-auto md:w-[420px] mt-6">${sumRow(`Subtotal ${f.items.length} Produk`, rp(h.sub) + ',00')}${sumRow('Diskon', '- ' + rp(h.disk))}${sumRow('Pajak', rp(h.pajak))}${sumRow('Total Harga', rp(f.total) + ',00', true)}${sumRow('Sisa Tagihan', rp(sisaTagihan(f)) + ',00', true)}</div>
        <p class="text-[14px] font-semibold mt-6">Keterangan</p><p class="text-[14px] text-ink-2 mt-1">${esc(f.ket || '-')}</p>`)}</div></div>`,
    footer: `<div class="w-full max-w-[982px] mx-auto flex items-center gap-8"><button data-ubah class="h-10 px-4 rounded-md border border-brand text-brand text-[14px] font-semibold flex items-center gap-2"><i data-lucide="pencil" class="ic-sm"></i>Ubah</button>
      <div class="ml-auto flex items-center gap-8"><button data-tindakan class="text-brand text-[14px] font-semibold flex items-center gap-1">Tindakan <i data-lucide="chevron-up" class="ic-sm"></i></button>${fBtn.primary('Tutup', 'data-tutup')}</div></div>` });
  sh.root.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-tutup]')) return sh.close();
    if (t.closest('[data-ubah]')) return fakturUbah(f, sh);
    const tb = t.closest('[data-tindakan]');
    if (tb) rowMenu(tb, [['Cetak', () => window.print()], ['Kirim Email', () => toast('Berhasil!', `Faktur pembelian dikirim ke <b>${esc(pm?.email || '-')}</b>`)],
      ['Bayar Faktur', async () => {
        if (!sisaTagihan(f)) return toast('Info', 'Faktur ini sudah lunas');
        if (await confirmDialog({ title: 'Bayar Faktur', html: 'Anda akan dialihkan ke halaman Pembayaran Faktur. Lanjutkan?' })) { sh.close(); bayarForm({ pemasok: f.pemasok, faktur: f.id }); }
      }]]);
  });
}
// ubah faktur: hanya data kepala (barang yang sudah masuk stok tidak diubah)
function fakturUbah(f, preview) {
  cardForm({ title: 'Ubah Faktur Pembelian', noun: 'Faktur Pembelian', cardTitle: 'Informasi Faktur Pembelian',
    body: fRow('No. Faktur', fInput('nomor', 'Contoh: FA/261022/0001', f.nomor, { counter: 25, req: 'Mohon lengkapi nomor faktur' }), { required: true })
      + fRow('Jatuh Tempo', `<input type="date" name="jatuh" class="fin" value="${isoLocal(new Date(f.jatuhTempo)).slice(0, 10)}">`)
      + fRow('Keterangan', fInput('ket', 'Keterangan', f.ket || '', { area: true, rows: 3 })),
    confirmHtml: () => 'Perubahan faktur pembelian akan disimpan. Lanjutkan?',
    toastText: () => 'Data berhasil diperbarui',
    onSave: v => { f.nomor = v.nomor; if (v.jatuh) f.jatuhTempo = new Date(v.jatuh + 'T00:00').toISOString(); f.ket = v.ket; f.diubah = new Date().toISOString(); preview.close(); setTimeout(() => fakturPreview(f)); }
  });
}

// ---------- Pembayaran Faktur ----------
const AKUN_BAYAR = ['1-10001 - Kas Outlet', '1-10002 - Rekening Bank', '1-10003 - Kas Kasir Outlet', '1-10004 - Giro', '1-19001 - Ayat Silang Kas & Bank', '1-19002 - Ayat Silang Buka / Tutup Kasir'];
function bayarForm({ pemasok = '', faktur = '' } = {}) {
  const o = { jenis: 'po', pemasok, rows: [], semua: false };
  const T = { r: o.rows };
  const fill = () => {
    o.rows.length = 0;
    db().faktur.filter(f => f.pemasok === o.pemasok && f.status !== 'Draf' && sisaTagihan(f) > 0 && (o.jenis === 'po' ? !!f.po : !f.po))
      .forEach(f => o.rows.push({ id: f.id, potongan: 0, bayar: f.id === faktur ? sisaTagihan(f) : 0 }));
  };
  fill();
  const rowsHtml = () => {
    const tot = o.rows.reduce((a, r) => { const f = byId('faktur', r.id); return [a[0] + sisaTagihan(f), a[1] + (r.potongan || 0), a[2] + (r.bayar || 0)]; }, [0, 0, 0]);
    return invTbl(['Tanggal Pembelian', 'No Faktur', 'Jatuh Tempo', 'Tagihan', 'Potongan', 'Pembayaran', 'Sisa Tagihan'], [
      ...o.rows.map((r, i) => { const f = byId('faktur', r.id); return `<tr><td>${tglPanjang(f.waktu)}</td><td>${esc(f.nomor)}</td><td>${tglPendek(f.jatuhTempo)}</td><td>${rp(sisaTagihan(f))},00</td><td>${cell('r', i, 'potongan', r.potongan, { money: true })}</td><td>${cell('r', i, 'bayar', r.bayar, { money: true })}</td><td data-sisa="${i}">${rp(sisaTagihan(f) - (r.potongan || 0) - (r.bayar || 0))},00</td></tr>`; }),
      ...(o.rows.length ? [`<tr class="font-semibold"><td colspan="3">Total</td><td>${rp(tot[0])},00</td><td>- ${rp(tot[1])}</td><td>${rp(tot[2])}</td><td>${rp(tot[0] - tot[1] - tot[2])},00</td></tr>`] : [])]);
  };
  const main = () => card(`<h2 class="text-[20px] font-semibold mb-4">Informasi Pembayaran Faktur</h2>
      ${fRow('Pilih Outlet', fSelect('outlet', OUTLETS, OUTLET_UTAMA), { required: true })}
      ${fRow('Jenis Pembayaran', fSelect('akun', AKUN_BAYAR, '', 'Pilih', { req: 'Mohon pilih jenis pembayaran' }), { required: true })}
      ${fRow('Jenis Transaksi', `<div class="grid sm:grid-cols-2 gap-3">${fRadioCard('jenisT', 'po', 'Pemesanan Stok', o.jenis === 'po')}${fRadioCard('jenisT', 'tanpa', 'Tanpa Nomor Referensi', o.jenis === 'tanpa')}</div>`)}
      ${fRow('Pemasok', fSelect('pemasok', db().pemasok.map(p => [p.id, p.nama]), o.pemasok, 'Pilih Pemasok', { req: 'Mohon pilih pemasok' }))}
      ${fRow('Tanggal Transaksi', dtInput('waktu', new Date().toISOString()))}
      ${fRow('No Transaksi', fInput('nomor', `Contoh: ${nomorDoc('PFA', 'bayarFaktur')}`, '') + '<p class="text-[12px] text-ink-3 mt-1">Nomor transaksi akan terisi otomatis jika dikosongkan</p>')}
      <p class="text-[16px] font-semibold mt-6">Daftar Pembelian</p>
      <div class="flex items-center gap-6 border-b border-line mt-3"><span class="pb-2 px-2 text-[14px] font-semibold text-brand border-b-2 border-brand">Faktur Pembelian</span>
        <label class="ml-auto pb-2 flex items-center gap-2 text-[14px]"><input type="checkbox" data-semua class="w-4 h-4 accent-[#04C99E]" ${o.semua ? 'checked' : ''}>Bayar Semua</label></div>
      <div data-rows class="mt-3">${rowsHtml()}</div>`) + uploadCard();
  const sh = openSheet({ title: 'Tambah Pembayaran Faktur', body: `<div class="px-4 py-10"><div class="max-w-[982px] mx-auto" data-main>${main()}</div></div>`,
    footer: `<div class="ml-auto flex items-center gap-8">${fBtn.text('Batal', 'data-cancel')}${fBtn.primary('Simpan', 'data-save')}</div>` });
  const R = sh.root;
  const repaintRows = () => { R.querySelector('[data-rows]').innerHTML = rowsHtml(); lucide.createIcons(); };
  const keepForm = () => { const v = formValues(R.querySelector('[data-main]')); R.querySelector('[data-main]').innerHTML = main(); lucide.createIcons(); ['akun', 'nomor'].forEach(n => { const el = R.querySelector(`[name="${n}"]`); if (el && v[n]) { el.value = v[n]; el.classList.remove('text-[#A0A6A6]'); } }); };
  const cancel = async () => { if (await confirmCancel('Tambah Pembayaran Faktur')) sh.close(); };
  sh.onClose = cancel;
  R.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[name="pemasok"]')) { o.pemasok = t.value; fill(); return keepForm(); }
    if (t.matches('[name="jenisT"]')) { o.jenis = t.value; fill(); return keepForm(); }
    if (t.matches('[data-semua]')) { readCells(R, T); o.semua = t.checked; o.rows.forEach(r => { r.bayar = t.checked ? Math.max(0, sisaTagihan(byId('faktur', r.id)) - (r.potongan || 0)) : 0; }); return repaintRows(); }
  });
  R.addEventListener('input', e => {
    if (!e.target.matches('[data-t="r"]')) return;
    readCells(R, T);
    o.rows.forEach((r, i) => { const el = R.querySelector(`[data-sisa="${i}"]`); if (el) el.textContent = rp(sisaTagihan(byId('faktur', r.id)) - (r.potongan || 0) - (r.bayar || 0)) + ',00'; });
  });
  R.addEventListener('click', async e => {
    if (e.target.closest('[data-cancel]')) return cancel();
    if (!e.target.closest('[data-save]')) return;
    if (!validate(R.querySelector('[data-main]'))) return;
    readCells(R, T);
    const v = formValues(R.querySelector('[data-main]'));
    const total = o.rows.reduce((n, r) => n + (r.bayar || 0) + (r.potongan || 0), 0);
    if (!total) return toast('Gagal!', '<b>Pembayaran Faktur</b> tidak ada yang dibayarkan', 'error');
    if (o.rows.some(r => (r.bayar || 0) + (r.potongan || 0) > sisaTagihan(byId('faktur', r.id)))) return toast('Gagal!', 'Pembayaran melebihi sisa tagihan', 'error');
    if (!(await confirmDialog({ title: 'Simpan Pembayaran Faktur', html: 'Pembayaran Faktur akan disimpan dan tampil di daftar pembelian sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?' }))) return;
    const rinci = o.rows.filter(r => r.bayar || r.potongan).map(r => ({ faktur: r.id, potongan: r.potongan || 0, bayar: r.bayar || 0 }));
    rinci.forEach(r => { const f = byId('faktur', r.faktur); f.dibayar = (f.dibayar || 0) + r.bayar + r.potongan; f.status = sisaTagihan(f) ? 'Sebagian' : 'Lunas'; });
    const doc = { id: uid(), nomor: v.nomor || nomorDoc('PFA', 'bayarFaktur'), outlet: v.outlet, akun: v.akun, pemasok: o.pemasok, waktu: new Date(v.waktu || Date.now()).toISOString(), rincian: rinci, total: rinci.reduce((n, r) => n + r.bayar, 0), status: 'Berhasil', dibuat: 'Bayu' };
    db().bayarFaktur.unshift(doc);
    logAct(doc.nomor, 'Tambah Pembayaran Faktur', 'Berhasil Ditambahkan');
    saveDB(); sh.close(); render();
    toast('Berhasil!', '<b>Pembayaran Faktur</b> berhasil disimpan');
  });
}
function bayarDetail(b) {
  const sh = openSheet({ title: 'Detail Pembayaran Faktur',
    body: `<div class="px-4 py-10"><div class="max-w-[982px] mx-auto">${card(`<p class="text-[16px] font-semibold mb-3">Informasi Pembayaran Faktur</p>
      <div class="space-y-1">${kvRow('No Pembayaran', esc(b.nomor))}${kvRow('Outlet', b.outlet)}${kvRow('Jenis Pembayaran', esc(b.akun))}${kvRow('Pemasok', esc(byId('pemasok', b.pemasok)?.nama || '-'))}${kvRow('Tanggal Transaksi', tglPanjang(b.waktu))}${kvRow('Dibuat Oleh', b.dibuat)}${kvRow('Status', stPill(b.status))}</div>
      <p class="text-[16px] font-semibold mt-8 mb-3">Rincian Pembayaran</p>
      ${invTbl(['No Faktur', 'Potongan', 'Pembayaran'], b.rincian.map(r => `<tr><td>${esc(byId('faktur', r.faktur)?.nomor || '-')}</td><td>${rp(r.potongan)}</td><td>${rp(r.bayar)}</td></tr>`))}
      <div class="md:ml-auto md:w-[360px] mt-4">${sumRow('Total Bayar', rp(b.total), true)}</div>`)}</div></div>`,
    footer: `<div class="ml-auto">${fBtn.primary('Tutup', 'data-tutup')}</div>` });
  sh.root.querySelector('[data-tutup]').onclick = () => sh.close();
}

// ---------- Produksi Stok ----------
function produksiRowsHtml(o, readonlyStok) {
  const sumber = invTbl(['SKU', 'Nama Barang', ...(readonlyStok ? [] : ['Stok Tersedia']), `Jumlah${req}`, 'Satuan', ...(readonlyStok ? [] : ['Harga Modal']), ''], o.sumber.map((r, i) => {
    const it = itemOf(r.item);
    return `<tr><td>${esc(it.sku)}</td><td>${esc(it.nama)}</td>${readonlyStok ? '' : `<td>${fmtN(stokOf(r.item))} ${esc(it.satuan)}</td>`}<td>${cell('s', i, 'qty', r.qty, { num: true, w: 'w-[90px]' })}</td><td>${cell('s', i, 'satuan', r.satuan, { select: satOpts(it) })}</td>${readonlyStok ? '' : `<td>${rp(it.hargaBeli)}</td>`}<td>${delBtn('s', i)}</td></tr>`;
  }));
  const hasil = invTbl(['SKU', 'Nama Barang', `Jumlah${req}`, 'Satuan', ...(readonlyStok ? [] : ['Harga', 'Total']), ''], o.hasil.map((r, i) => {
    const it = itemOf(r.item);
    return `<tr><td>${esc(it.sku)}</td><td>${esc(it.nama)}</td><td>${cell('h', i, 'qty', r.qty, { num: true, w: 'w-[90px]' })}</td><td>${cell('h', i, 'satuan', r.satuan, { select: satOpts(it) })}</td>${readonlyStok ? '' : `<td>${cell('h', i, 'harga', r.harga, { money: true })}</td><td>${rp((r.qty || 0) * (r.harga || 0))}</td>`}<td>${delBtn('h', i)}</td></tr>`;
  }));
  return `<p class="text-[16px] font-semibold mt-6 mb-3">Stok Sumber</p>${sumber}<div class="mt-3">${fBtn.outline('<span class="flex items-center gap-2"><i data-lucide="plus" class="ic-sm"></i>Tambah Sumber</span>', 'type="button" data-add="s"').replace('px-6', 'px-3')}</div>
    <p class="text-[16px] font-semibold mt-8 mb-3">Stok Hasil</p>${hasil}<div class="mt-3">${fBtn.outline('<span class="flex items-center gap-2"><i data-lucide="plus" class="ic-sm"></i>Tambah Hasil</span>', 'type="button" data-add="h"').replace('px-6', 'px-3')}</div>`;
}
async function produksiPick(o, T, tb) {
  const list = tb === 's' ? o.sumber : o.hasil;
  const keys = await pickItems(list.map(r => r.item));
  if (!keys) return false;
  const keep = list.filter(r => keys.includes(r.item));
  list.length = 0;
  keys.forEach(k => { const it = itemOf(k); list.push(keep.find(r => r.item === k) || { item: k, qty: 1, satuan: it.satuan, harga: it.hargaBeli }); });
  return true;
}
function produksiForm() {
  const o = { nomor: '', waktu: new Date().toISOString(), sumberData: '', template: '', sumber: [], hasil: [], catatan: '', simpanTpl: false, namaTpl: '' };
  const T = { s: o.sumber, h: o.hasil };
  let step = 0;
  const step1 = () => card(`<h2 class="text-[20px] font-semibold mb-4">Informasi Produksi Stok</h2>
    ${fRow('Outlet', fSelect('outlet', OUTLETS, OUTLET_UTAMA))}
    ${fRow('No Produksi Stok', fInput('nomor', `Contoh: ${nomorDoc('SP', 'produksi')}`, o.nomor) + '<p class="text-[12px] text-ink-3 mt-1">Jika kosong akan diisi otomatis oleh sistem</p>')}
    ${fRow('Tanggal Produksi', dtInput('waktu', o.waktu))}`);
  const step2 = () => card(`<h2 class="text-[20px] font-semibold mb-4">Stok Sumber &amp; Hasil</h2>
    ${fRow('Sumber Data', `<div class="flex flex-wrap gap-3">${radioCard('sumberData', 'baru', 'Buat Data Baru', 'Tambah data baru sesuai dengan kebutuhan', o.sumberData === 'baru')}${radioCard('sumberData', 'template', 'Gunakan Template', 'Gunakan data dari template produksi yang pernah dibuat', o.sumberData === 'template')}</div>`, { required: true })}
    ${o.sumberData === 'template' ? fRow('Template', `<select data-tpl class="fin fsel ${o.template ? '' : 'text-[#A0A6A6]'}"><option value="">Pilih Template</option>${db().templateProduksi.map(t => `<option value="${t.id}" ${o.template === t.id ? 'selected' : ''}>${esc(t.nama)}</option>`).join('')}</select>`) : ''}
    ${o.sumberData ? `${produksiRowsHtml(o)}
      ${fRow('Catatan', `<textarea data-cat rows="2" class="fin" placeholder="Contoh: Produksi sebagian">${esc(o.catatan)}</textarea>`)}
      ${fRow('Simpan Template', `<label class="flex items-center gap-3 text-[14px] py-2"><input type="checkbox" data-stpl class="w-4 h-4 accent-[#04C99E]" ${o.simpanTpl ? 'checked' : ''}>Simpan ke Template Produksi Stok</label>
        ${o.simpanTpl ? `<p class="text-[12px] mt-2 mb-1">Nama Template</p><input data-ntpl class="fin" placeholder="Contoh: Template produksi kopi" value="${esc(o.namaTpl)}">` : ''}`)}` : ''}`);
  const footer = () => step === 0
    ? `<div class="w-full flex items-center gap-8 lg:pl-[284px]"><button disabled class="h-10 px-3 rounded-md bg-[#D6D9D9] text-[#A0A6A6] text-[14px] font-semibold">Simpan Draf</button><div class="ml-auto">${fBtn.primary('Lanjutkan', 'data-next')}</div></div>`
    : `<div class="w-full flex items-center gap-8 lg:pl-[284px]"><button disabled class="h-10 px-3 rounded-md bg-[#D6D9D9] text-[#A0A6A6] text-[14px] font-semibold">Simpan Draf</button><div class="ml-auto flex items-center gap-8">${fBtn.text('Kembali', 'data-back')}<button data-save ${o.sumberData ? '' : 'disabled'} class="h-10 px-3 rounded-md text-[14px] font-semibold ${o.sumberData ? 'bg-brand text-white' : 'bg-[#D6D9D9] text-[#A0A6A6]'}">Simpan</button></div></div>`;
  const sh = navSheet({ title: 'Tambah Produksi Stok', navs: ['Informasi Produksi Stok', 'Stok Sumber &amp; Hasil'] });
  const R = sh.root;
  const show = () => { sh.setNav(step, step ? [0] : []); sh.setMain(step ? step2() : step1()); sh.setFooter(footer()); };
  const read2 = () => { readCells(R, T); const c = R.querySelector('[data-cat]'); if (c) o.catatan = c.value; const n = R.querySelector('[data-ntpl]'); if (n) o.namaTpl = n.value; };
  const cancel = async () => { if (await confirmCancel('Tambah Produksi Stok', 'Membatalkan proses ini akan menghapus seluruh data yang telah diinput. Lanjutkan?')) sh.close(); };
  sh.onClose = cancel;
  R.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[name="sumberData"]')) { read2(); o.sumberData = t.value; if (t.value === 'baru') { o.template = ''; } return show(); }
    if (t.matches('[data-tpl]')) {
      o.template = t.value; const tp = byId('templateProduksi', t.value);
      o.sumber.length = 0; o.hasil.length = 0;
      if (tp) { tp.sumber.forEach(r => o.sumber.push({ ...r })); tp.hasil.forEach(r => o.hasil.push({ ...r, harga: itemOf(r.item).hargaBeli })); }
      return show();
    }
    if (t.matches('[data-stpl]')) { read2(); o.simpanTpl = t.checked; return show(); }
  });
  R.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-next]') || (t.closest('[data-navi="1"]') && step === 0)) {
      const v = formValues(R.querySelector('[data-main]')); o.nomor = v.nomor; o.waktu = new Date(v.waktu || Date.now()).toISOString();
      step = 1; return show();
    }
    if (t.closest('[data-back]') || (t.closest('[data-navi="0"]') && step === 1)) { read2(); step = 0; return show(); }
    const del = t.closest('[data-del]');
    if (del) { read2(); const [tb, i] = del.dataset.del.split(':'); T[tb].splice(+i, 1); return show(); }
    const add = t.closest('[data-add]');
    if (add) { read2(); if (await produksiPick(o, T, add.dataset.add)) show(); return; }
    if (t.closest('[data-save]')) {
      read2();
      if (!o.sumber.some(r => r.qty > 0) || !o.hasil.some(r => r.qty > 0)) return toast('Gagal!', 'Stok sumber dan stok hasil wajib diisi', 'error');
      if (o.sumber.some(r => r.qty * konv(itemOf(r.item), r.satuan) > stokOf(r.item))) return toast('Gagal!', 'Jumlah stok sumber melebihi stok tersedia', 'error');
      if (o.simpanTpl && !o.namaTpl.trim()) return toast('Gagal!', 'Nama template wajib diisi', 'error');
      if (!(await confirmDialog({ title: 'Simpan Produksi Stok', html: 'Menyimpan produksi stok akan mengubah stok barang saat ini dan tidak dapat dibatalkan. Lanjutkan?' }))) return;
      const doc = { id: uid(), nomor: o.nomor || nomorDoc('SP', 'produksi'), outlet: OUTLET_UTAMA, waktu: o.waktu, catatan: o.catatan, status: 'Selesai', dibuat: 'Bayu',
        sumber: o.sumber.map(r => ({ item: r.item, satuan: r.satuan, qty: r.qty })), hasil: o.hasil.map(r => ({ item: r.item, satuan: r.satuan, qty: r.qty, harga: r.harga || 0 })) };
      // sumber berkurang (keluar), hasil bertambah (terproduksi)
      doc.sumber.forEach(r => addMutasi(r.item, -r.qty * konv(itemOf(r.item), r.satuan), 'produksi', doc.nomor, doc.waktu));
      doc.hasil.forEach(r => addMutasi(r.item, r.qty * konv(itemOf(r.item), r.satuan), 'terproduksi', doc.nomor, doc.waktu));
      db().produksi.unshift(doc);
      if (o.simpanTpl) db().templateProduksi.unshift({ id: uid(), nama: o.namaTpl.trim(), outlet: OUTLET_UTAMA, sumber: doc.sumber.map(r => ({ ...r })), hasil: doc.hasil.map(({ harga, ...r }) => r) });
      logAct(doc.nomor, 'Tambah Produksi Stok', 'Berhasil Ditambahkan');
      saveDB(); sh.close(); render();
      toast('Berhasil!', 'Produksi stok berhasil ditambahkan');
    }
  });
  show();
}
function produksiDetail(p) {
  const sh = openSheet({ title: 'Detail Produksi Stok',
    body: `<div class="px-4 py-10"><div class="max-w-[982px] mx-auto">${card(`<p class="text-[16px] font-semibold mb-3">Informasi Produksi Stok</p>
      <div class="space-y-1">${kvRow('Outlet', p.outlet)}${kvRow('No Produksi Stok', esc(p.nomor))}${kvRow('Tanggal Produksi', tglPanjang(p.waktu))}${kvRow('Dibuat Oleh', p.dibuat)}${kvRow('Status', stPill(p.status))}${kvRow('Catatan', esc(p.catatan || '-'))}</div>
      <p class="text-[16px] font-semibold mt-8 mb-3">Stok Sumber</p>${invTbl(['SKU', 'Nama Barang', 'Jumlah', 'Satuan'], p.sumber.map(r => `<tr><td>${esc(itemOf(r.item).sku)}</td><td>${esc(itemOf(r.item).nama)}</td><td>${fmtN(r.qty)}</td><td>${esc(r.satuan)}</td></tr>`))}
      <p class="text-[16px] font-semibold mt-8 mb-3">Stok Hasil</p>${invTbl(['SKU', 'Nama Barang', 'Jumlah', 'Satuan', 'Harga', 'Total'], p.hasil.map(r => `<tr><td>${esc(itemOf(r.item).sku)}</td><td>${esc(itemOf(r.item).nama)}</td><td>${fmtN(r.qty)}</td><td>${esc(r.satuan)}</td><td>${rp(r.harga)}</td><td>${rp(r.qty * r.harga)}</td></tr>`))}`)}
</div></div>`,
    footer: `<div class="ml-auto">${fBtn.primary('Tutup', 'data-tutup')}</div>` });
  sh.root.querySelector('[data-tutup]').onclick = () => sh.close();
}
function templateForm(item) {
  const isEdit = !!item;
  const o = { sumber: (item?.sumber || []).map(r => ({ ...r })), hasil: (item?.hasil || []).map(r => ({ ...r })) };
  const T = { s: o.sumber, h: o.hasil };
  cardForm({ title: `${isEdit ? 'Ubah' : 'Tambah'} Template Produksi Stok`, noun: 'Template Produksi Stok', cardTitle: 'Informasi Template Produksi Stok',
    body: fRow('Nama Template', fInput('nama', 'Contoh: Template produksi kopi', item?.nama || '', { req: 'Mohon lengkapi nama template' }), { required: true })
      + fRow('Outlet', fSelect('outlet', OUTLETS, OUTLET_UTAMA)) + `<div data-tplrows>${produksiRowsHtml(o, true)}</div>`,
    collect: sh => {
      readCells(sh.root, T);
      if (!o.sumber.length || !o.hasil.length) { toast('Gagal!', 'Stok sumber dan stok hasil wajib diisi', 'error'); return false; }
      return formValues(sh.root);
    },
    toastText: v => (isEdit ? 'Data berhasil diperbarui' : `Template Produksi Stok <b>${esc(v.nama)}</b> berhasil ditambahkan`),
    onSave: v => {
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, outlet: v.outlet || OUTLET_UTAMA, sumber: o.sumber, hasil: o.hasil.map(({ harga, ...r }) => r) });
      if (!isEdit) db().templateProduksi.unshift(rec);
    },
    onMount: sh => sh.root.addEventListener('click', async e => {
      const paint = () => { sh.root.querySelector('[data-tplrows]').innerHTML = produksiRowsHtml(o, true); lucide.createIcons(); };
      const del = e.target.closest('[data-del]');
      if (del) { readCells(sh.root, T); const [tb, i] = del.dataset.del.split(':'); T[tb].splice(+i, 1); return paint(); }
      const add = e.target.closest('[data-add]');
      if (add) { readCells(sh.root, T); if (await produksiPick(o, T, add.dataset.add)) paint(); }
    })
  });
}

// ---------- Pemasok ----------
const PROVINSI = ['Banten', 'DI Yogyakarta', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur'];
const BANK = ['BCA', 'BNI', 'BRI', 'Mandiri', 'CIMB Niaga', 'Permata', 'BSI'];
function pemasokForm(item) {
  const isEdit = !!item;
  const o = { rek: (item?.rekening?.length ? item.rekening : [{ pemilik: '', bank: '', nomor: '' }]).map(r => ({ ...r })) };
  const T = { k: o.rek };
  const col = (label, ctl, reqd) => `<div><p class="text-[12px] font-semibold mb-2">${label}${reqd ? req : ''}</p>${ctl}</div>`;
  const rekHtml = () => o.rek.map((r, i) => `<div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center mb-3">${cell('k', i, 'pemilik', r.pemilik, { ph: 'Contoh: Sari Darapah', w: 'w-full' })}
    <select ${ref('k', i, 'bank')} class="fin fsel ${r.bank ? '' : 'text-[#A0A6A6]'}"><option value="">Pilih</option>${BANK.map(b => `<option ${b === r.bank ? 'selected' : ''}>${b}</option>`).join('')}</select>${cell('k', i, 'nomor', r.nomor, { ph: 'Contoh: 7867383333', w: 'w-full' })}${delBtn('k', i)}</div>`).join('');
  cardForm({ title: `${isEdit ? 'Ubah' : 'Tambah'} Pemasok`, noun: 'Data Pemasok',
    body: `<div class="grid md:grid-cols-[200px_minmax(0,1fr)] gap-4"><p class="text-[16px] font-semibold">Info Pemasok</p><div class="grid sm:grid-cols-2 gap-x-4 gap-y-4">
      ${col('Kode Pemasok', fInput('kode', 'Contoh: ABC123', item?.kode || genKode().slice(3, 13), { req: 'Kode Pemasok tidak boleh kosong' }), true)}
      ${col('Nama Pemasok', fInput('nama', 'Contoh: Agen Telur', item?.nama || '', { req: 'Nama Pemasok tidak boleh kosong' }), true)}
      ${col('Email', fInput('email', 'Contoh: sd@gmail.com', item?.email || '', { req: 'Email tidak boleh kosong' }), true)}
      ${col('No. Telepon', fInput('telepon', 'Contoh: 08122222222', item?.telepon || '', { req: 'No. Telepon Pemasok tidak boleh kosong' }), true)}
      <div class="sm:col-span-2">${col('Alamat', fInput('alamat', 'Contoh: Jl Karya Agung Bersama No. 15A,Ruko Permata - Pamulang', item?.alamat || '', { area: true, req: 'Alamat tidak boleh kosong' }), true)}</div>
      <div class="sm:col-span-2">${col('Negara', '<select class="fin fsel bg-[#F2F2F2] text-[#A0A6A6]" disabled><option>Indonesia</option></select>')}</div>
      ${col('Provinsi', fSelect('provinsi', PROVINSI, item?.provinsi || '', 'Pilih'))}${col('Kota', fSelect('kota', KOTA, item?.kota || '', 'Pilih'))}</div></div>
      <hr class="border-line my-6"><p class="text-[16px] font-semibold mb-4">Informasi Rekening</p>
      <div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 text-[12px] font-semibold mb-2"><span>Nama Pemilik Rekening</span><span>Bank</span><span>Nomor Rekening</span><span class="w-4"></span></div>
      <div data-rek>${rekHtml()}</div>
      <button type="button" data-addrek class="w-full h-10 rounded-md border border-brand text-brand text-[14px] font-semibold flex items-center justify-center gap-2"><i data-lucide="plus" class="ic-sm"></i>Tambah Rekening</button>
      <hr class="border-line my-6"><div class="grid md:grid-cols-[200px_minmax(0,1fr)] gap-4"><p class="text-[16px] font-semibold">Keterangan</p>${fInput('ket', 'Contoh: Pesan bulanan 10 krat', item?.ket || '', { area: true })}</div>`,
    collect: sh => { readCells(sh.root, T); return formValues(sh.root); },
    confirmHtml: v => `Pemasok <b>${esc(v.kode)}</b> akan disimpan dan tampil di daftar pemasok sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?`,
    toastText: () => (isEdit ? 'Data Pemasok berhasil diperbarui' : 'Data Pemasok berhasil ditambahkan'),
    onSave: v => {
      const rec = item || { id: uid() };
      Object.assign(rec, { kode: v.kode, nama: v.nama, email: v.email, telepon: v.telepon, alamat: v.alamat, provinsi: v.provinsi, kota: v.kota, ket: v.ket, rekening: o.rek.filter(r => r.pemilik || r.nomor) });
      if (!isEdit) db().pemasok.unshift(rec);
      logAct(rec.nama, isEdit ? 'Ubah Pemasok' : 'Tambah Pemasok', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
    },
    onMount: sh => sh.root.addEventListener('click', e => {
      const paint = () => { sh.root.querySelector('[data-rek]').innerHTML = rekHtml(); lucide.createIcons(); };
      if (e.target.closest('[data-addrek]')) { readCells(sh.root, T); o.rek.push({ pemilik: '', bank: '', nomor: '' }); return paint(); }
      const del = e.target.closest('[data-del]');
      if (del) { readCells(sh.root, T); o.rek.splice(+del.dataset.del.split(':')[1], 1); paint(); }
    })
  });
}

// ---------- Bahan Baku ----------
function bahanForm(item) {
  const isEdit = !!item;
  const o = { monitor: item ? item.monitor : false, sat: (item?.satuan || [{ nama: '', konversi: 1, hargaBeli: 0, sku: '' }]).map(s => ({ ...s })) };
  const T = { u: o.sat };
  const satHtml = () => {
    const multi = o.sat.length > 1;
    return invTbl([`Satuan${req}`, ...(multi ? ['Konversi'] : []), 'Harga Beli', `SKU${req}`, ''], o.sat.map((s, i) => `<tr><td>${cell('u', i, 'nama', s.nama, { ph: 'Contoh: Botol', w: 'w-full' })}</td>${multi ? `<td>${cell('u', i, 'konversi', i ? s.konversi : 1, { num: true, disabled: !i, w: 'w-full' })}</td>` : ''}
      <td>${cell('u', i, 'hargaBeli', s.hargaBeli, { money: true, disabled: !o.monitor })}</td><td>${cell('u', i, 'sku', s.sku, { ph: 'Contoh: BB001', w: 'w-full' })}</td><td>${i ? delBtn('u', i) : ''}</td></tr>`)) + '<div data-satmsg></div>';
  };
  cardForm({ title: `${isEdit ? 'Ubah' : 'Tambah'} Bahan`, noun: 'Bahan Baku',
    body: fRow('Daftar Outlet', fSelect('outlet', OUTLETS) + fChip(OUTLET_UTAMA), { required: true })
      + fRow('Nama Bahan Baku', fInput('nama', 'Contoh: Tepung', item?.nama || '', { req: 'Nama bahan baku harus diisi' }), { required: true })
      + fRow('Monitor Persediaan', fSwitch('monitor', o.monitor, 'Aktifkan monitor persediaan'), { top: false })
      + fRow('Pengingat Stok Minimum', fInput('stokMin', '0', item?.stokMin ?? 0, { disabled: !o.monitor }))
      + `<div class="flex items-center justify-between mt-3 mb-4"><p class="text-[14px] font-semibold">Informasi Satuan</p>${fBtn.outline('Tambah Satuan', 'type="button" data-addsat')}</div><div data-sat>${satHtml()}</div>`,
    collect: sh => {
      readCells(sh.root, T);
      const msg = [o.sat.some(s => !s.nama.trim()) && 'Mohon lengkapi nama satuan', o.sat.some(s => !s.sku.trim()) && 'Mohon lengkapi SKU'].filter(Boolean);
      sh.root.querySelector('[data-satmsg]').innerHTML = msg.map(m => `<p class="fmsg">${m}</p>`).join('');
      return msg.length ? false : formValues(sh.root);
    },
    confirmHtml: v => `Bahan Baku <b>${esc(v.nama)}</b> akan disimpan dan tampil di daftar stok. Lanjutkan?`,
    toastText: v => (isEdit ? 'Data berhasil diperbarui' : `Bahan baku <b>${esc(v.nama)}</b> berhasil ditambahkan`),
    onSave: v => {
      const rec = item || { id: uid() };
      Object.assign(rec, { nama: v.nama, monitor: v.monitor, stokMin: v.monitor ? toNum(v.stokMin) : 0, satuan: o.sat.map((s, i) => ({ nama: s.nama.trim(), konversi: i ? (+s.konversi || 1) : 1, hargaBeli: s.hargaBeli || 0, sku: s.sku.trim() })) });
      if (!isEdit) db().bahan.unshift(rec);
      logAct(rec.nama, isEdit ? 'Ubah Bahan Baku' : 'Tambah Bahan Baku', isEdit ? 'Berhasil Diubah' : 'Berhasil Ditambahkan');
    },
    onMount: sh => {
      const R = sh.root, paint = () => { R.querySelector('[data-sat]').innerHTML = satHtml(); lucide.createIcons(); };
      R.addEventListener('sw', e => {
        if (e.target.dataset.name !== 'monitor') return;
        readCells(R, T); o.monitor = e.detail;
        const min = R.querySelector('[name="stokMin"]'); min.disabled = !o.monitor; min.classList.toggle('bg-[#F2F2F2]', !o.monitor);
        paint();
      });
      R.addEventListener('click', e => {
        if (e.target.closest('[data-addsat]')) { readCells(R, T); o.sat.push({ nama: '', konversi: 2, hargaBeli: 0, sku: '' }); return paint(); }
        const del = e.target.closest('[data-del]');
        if (del) { readCells(R, T); o.sat.splice(+del.dataset.del.split(':')[1], 1); paint(); }
      });
    }
  });
}
async function hapusBahan(b) {
  if (!(await confirmDelete('Bahan Baku', b.nama))) return;
  db().bahan = db().bahan.filter(x => x !== b);
  db().mutasi = db().mutasi.filter(m => m.item !== 'b:' + b.id);
  logAct(b.nama, 'Hapus Bahan Baku', 'Berhasil Dihapus');
  saveDB(); render();
  toast('Berhasil!', `Bahan baku <b>${esc(b.nama)}</b> berhasil dihapus`);
}

// ---------- Daftar Stok (halaman khusus: kolom bisa ditambah lewat "Sertakan Kolom") ----------
const DS = { q: '', seg: 0, kat: '', min: '', max: '', minim: true, kolom: new Set(), pop: '' };
const DS_EXTRA = ['Keluar', 'Terbuang', 'Terproduksi', 'Transit'];
function rekapStok(key) {
  const awal = invPeriode().awal, ms = db().mutasi.filter(m => m.item === key && m.waktu >= awal);
  const sum = (f) => ms.filter(f).reduce((n, m) => n + m.qty, 0);
  return { Awal: stokOf(key, awal), Masuk: sum(m => m.qty > 0 && ['beli', 'opname'].includes(m.jenis)), Keluar: -sum(m => (m.jenis === 'opname' && m.qty < 0) || m.jenis === 'produksi'),
    Terjual: -sum(m => m.jenis === 'terjual'), Terbuang: -sum(m => m.jenis === 'terbuang'), Terproduksi: sum(m => m.jenis === 'terproduksi'), Transit: 0, Akhir: stokOf(key) };
}
const dsCols = () => ['Awal', 'Masuk', ...DS_EXTRA.slice(0, 1).filter(k => DS.kolom.has(k)), 'Terjual', ...DS_EXTRA.slice(1).filter(k => DS.kolom.has(k)), 'Akhir'];
function dsTable() {
  const cols = dsCols();
  const items = stokItems().filter(i => (!DS.q || (i.nama + i.sku).toLowerCase().includes(DS.q)) && (DS.seg === 0 || i.jenis === ['', 'Produk', 'Bahan'][DS.seg]) && (!DS.kat || i.kategori === DS.kat))
    .map(i => ({ i, r: rekapStok(i.key) })).filter(({ r }) => (DS.min === '' || r.Akhir >= +DS.min) && (DS.max === '' || r.Akhir <= +DS.max));
  return `<div class="overflow-x-auto"><table class="tbl w-full min-w-max"><thead><tr><th>SKU</th><th>Nama</th><th>Jenis</th>${cols.map(c => `<th>${c}</th>`).join('')}<th>Satuan</th><th></th></tr></thead><tbody>
    ${items.map(({ i, r }) => { const low = DS.minim && i.stokMin && r.Akhir <= i.stokMin; return `<tr><td>${esc(i.sku)}</td><td>${esc(i.nama)}${low ? ' <span class="text-[11px] font-semibold text-[#E5333F] bg-[#FFF1F0] rounded px-1.5 py-0.5 ml-1">Stok Minim</span>' : ''}</td><td>${i.jenis}</td>${cols.map(c => `<td class="${c === 'Akhir' && low ? 'text-[#E5333F] font-semibold' : ''}">${fmtN(r[c])}</td>`).join('')}<td>${esc(i.satuan)}</td><td class="text-right"><button data-dseye="${i.key}" aria-label="Detail stok"><i data-lucide="eye" class="ic-sm"></i></button></td></tr>`; }).join('')}
    </tbody></table></div>${items.length ? pager(items.length) : emptyTable()}`;
}
function dsPopover() {
  if (DS.pop === 'jumlah') return `<div class="dropdown absolute left-0 top-full mt-1 z-20 w-[300px] p-4">
    <p class="text-[14px] font-semibold mb-3">Rentang Jumlah Stok Akhir</p>
    <div class="grid grid-cols-2 gap-3"><label class="fin flex items-center gap-2"><span class="text-ink-3 text-[12px]">MIN</span><input data-dsmin class="flex-1 min-w-0 outline-none" inputmode="numeric" value="${DS.min}" placeholder="0"></label><label class="fin flex items-center gap-2"><span class="text-ink-3 text-[12px]">MAKS</span><input data-dsmax class="flex-1 min-w-0 outline-none" inputmode="numeric" value="${DS.max}" placeholder="0"></label></div>
    <hr class="border-line my-3"><label class="flex items-center gap-2 text-[14px]"><input type="checkbox" data-dsminim class="w-4 h-4 accent-[#04C99E]" ${DS.minim ? 'checked' : ''}>Tampilkan Stok Minim</label>
    <div class="flex justify-end gap-2 mt-4"><button data-dsreset class="h-8 px-3 rounded-md bg-[#D6D9D9] text-white text-[13px] font-semibold">Reset</button><button data-dsproses class="h-8 px-3 rounded-md bg-brand text-white text-[13px] font-semibold">Proses</button></div></div>`;
  if (DS.pop === 'kolom') return `<div class="dropdown absolute left-0 top-full mt-1 z-20 w-[200px] py-1">
    ${['Pilih Semua', ...DS_EXTRA].map(k => `<label class="flex items-center gap-3 px-4 py-2 text-[14px] cursor-pointer hover:bg-page"><input type="checkbox" data-dskol="${k}" class="w-4 h-4 accent-[#04C99E]" ${k === 'Pilih Semua' ? (DS.kolom.size === DS_EXTRA.length ? 'checked' : '') : DS.kolom.has(k) ? 'checked' : ''}>${k}</label>`).join('')}</div>`;
  return '';
}
function daftarStokPage() {
  killCharts();
  const ddBtn = (key, label) => `<div class="relative"><button data-dspop="${key}" class="input h-9 w-[190px] flex items-center justify-between text-ink">${label}<span class="text-[10px]">&#9660;</span></button>${DS.pop === key ? dsPopover() : ''}</div>`;
  return `${noticeBox({ title: 'Menu Baru - Tambah Bahan Baku', text: 'Tambah dan ubah bahan baku di pindahkan ke halaman khusus bahan baku', link: ['Menu Bahan Baku', '#/penjualan/daftar-bahan-baku'] })}
    <section class="card p-5">
      <div class="flex flex-wrap items-center gap-3"><div class="flex items-center gap-3"><h1 class="text-[20px] font-semibold leading-7">Daftar Stok</h1><i data-lucide="help-circle" class="text-brand" style="width:22px;height:22px"></i><i data-lucide="star" class="text-ink-4" style="width:22px;height:22px"></i></div>
        <div class="ml-auto">${btnPrimary('Ekspor Daftar Stok').replace('<button', '<button data-dsekspor')}</div></div>${hr}
      <div class="flex flex-wrap items-center gap-2"><label class="input w-[250px] h-9 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-dsq class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..." value="${esc(DS.q)}"></label>${dateBtn(invPeriode().btn)}
        <div class="seg seg-sm flex border border-line rounded-lg overflow-hidden lg:ml-auto">${['Semua', 'Produk', 'Bahan'].map((x, i) => `<button data-dsseg="${i}" class="${DS.seg === i ? 'active' : ''}">${x}</button>`).join('')}</div></div>
      <div class="flex flex-wrap items-center gap-2 mt-3">${ddBtn('jumlah', 'Jumlah Stok')}<select data-dskat class="fin fsel w-[190px] min-h-0 h-9"><option value="">Semua Kategori</option>${db().kategori.map(k => `<option value="${k.id}" ${DS.kat === k.id ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select>${ddBtn('kolom', 'Sertakan Kolom')}</div>${hr}
      <div data-dstable>${dsTable()}</div></section>`;
}
function dsModal(key) {
  const it = itemOf(key), r = rekapStok(key), cols = dsCols();
  const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${layer += 2}">
    <div class="bg-white rounded-lg w-[800px] max-w-full max-h-[90vh] flex flex-col">
      <div class="flex items-start justify-between px-6 py-4 border-b border-line"><div><h3 class="text-[20px] font-semibold">Daftar Stok Semua Outlet</h3><p class="text-[12px] text-ink-2">Detail stok dari semua outlet</p></div><button data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
      <div class="p-6 overflow-auto"><div class="flex flex-wrap gap-x-12 gap-y-1 text-[14px] text-ink-2"><span>SKU : <b class="text-ink">${esc(it.sku)}</b></span><span>Nama Produk : <b class="text-ink">${esc(it.nama)}</b></span><span>Jenis : <b class="text-ink">${it.jenis}</b></span></div>
        <label class="input w-[240px] h-9 flex items-center gap-2 text-ink-4 mt-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..."></label>
        <table class="tbl w-full mt-4"><thead><tr><th>Outlet</th>${cols.map(c => `<th>${c}</th>`).join('')}<th>Satuan</th></tr></thead><tbody><tr><td>${OUTLET_UTAMA}</td>${cols.map(c => `<td>${fmtN(r[c])}</td>`).join('')}<td>${esc(it.satuan)}</td></tr></tbody></table></div></div></div>`);
  d.addEventListener('click', e => { if (e.target.closest('[data-x]') || e.target === d) { d.remove(); layer -= 2; } });
  document.body.appendChild(d); lucide.createIcons();
}
const onDS = () => state.page === 'daftar-stok';
const dsRepaint = () => { const el = document.querySelector('[data-dstable]'); if (el) { el.innerHTML = dsTable(); lucide.createIcons(); } };
document.addEventListener('input', e => { if (onDS() && e.target.matches('[data-dsq]')) { DS.q = e.target.value.toLowerCase(); dsRepaint(); } });
document.addEventListener('change', e => {
  if (!onDS()) return;
  const t = e.target;
  if (t.matches('[data-dskat]')) { DS.kat = t.value; dsRepaint(); }
  if (t.matches('[data-dskol]')) {
    const k = t.dataset.dskol;
    if (k === 'Pilih Semua') DS_EXTRA.forEach(x => (t.checked ? DS.kolom.add(x) : DS.kolom.delete(x)));
    else t.checked ? DS.kolom.add(k) : DS.kolom.delete(k);
    render();
  }
});
document.addEventListener('click', e => {
  if (!onDS() || !e.target.closest('#page')) return;
  const t = e.target;
  const sg = t.closest('[data-dsseg]');
  if (sg) { DS.seg = +sg.dataset.dsseg; return render(); }
  const pop = t.closest('[data-dspop]');
  if (pop) { DS.pop = DS.pop === pop.dataset.dspop ? '' : pop.dataset.dspop; return render(); }
  if (t.closest('[data-dsreset]')) { DS.min = ''; DS.max = ''; DS.minim = true; DS.pop = ''; return render(); }
  if (t.closest('[data-dsproses]')) {
    const v = n => document.querySelector(`[data-ds${n}]`);
    DS.min = v('min').value.replace(/\D/g, ''); DS.max = v('max').value.replace(/\D/g, ''); DS.minim = v('minim').checked; DS.pop = '';
    return render();
  }
  const eye = t.closest('[data-dseye]');
  if (eye) return dsModal(eye.dataset.dseye);
  if (t.closest('[data-dsekspor]')) return toast('Berhasil!', 'Data sedang diekspor. Berkas dapat diunduh di menu <b>Daftar Ekspor</b>');
  if (DS.pop && !t.closest('.dropdown')) { DS.pop = ''; render(); }
});

// ---------- halaman daftar ----------
const ekspor = (label = 'Ekspor Data') => linkBtn(label, 'download').replace('<button', '<button data-act="ekspor"');
const impor = (label = 'Impor Data') => linkBtn(label, 'upload');
const byWaktu = arr => [...arr].sort((a, b) => (b.waktu > a.waktu ? 1 : -1));
const textQ = (s, ...xs) => !s.q || xs.join(' ').toLowerCase().includes(s.q);
function kpiInv(list) {
  return `<div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">${list.map(([label, v], i) => `<div class="card flex flex-col"><div class="px-4 pt-3 pb-3 flex-1"><p class="text-[14px] text-ink-2">${label}</p><p class="text-[16px] font-semibold mt-1">${rp(v)},00</p></div><div class="kpi-bar" style="background:${/Void/.test(label) ? '#E5333F' : KPI_COLORS[i % KPI_COLORS.length]}"></div></div>`).join('')}</div>`;
}
Object.assign(LISTS, {
  'daftar-pemasok': {
    title: 'Daftar Pemasok', help: true, add: ['Tambah Pemasok', () => pemasokForm()], links: ekspor('Ekspor Daftar Pemasok') + impor('Impor Daftar Pemasok'),
    items: s => db().pemasok.filter(p => textQ(s, p.kode, p.nama, p.telepon)),
    cols: ['Kode Pemasok', 'Nama', 'Keterangan', 'Alamat', 'No Telepon'],
    row: p => [esc(p.kode), esc(p.nama), esc(p.ket || ''), esc(p.alamat), esc(p.telepon)],
    menu: p => [['Ubah', () => pemasokForm(p)], ['Hapus', () => deleteFlow('pemasok', p, 'Pemasok', null)]]
  },
  'daftar-bahan-baku': {
    title: 'Daftar Bahan Baku', add: ['Tambah Bahan Baku', () => bahanForm()], check: true, colPick: true,
    above: () => infoBar('Data yang tampil berdasarkan Outlet Utama <b>(by cafe)</b>'),
    links: `<button data-act="log" class="w-9 h-9 flex items-center justify-center text-brand" aria-label="Log Aktivitas"><i data-lucide="history"></i></button>${impor('Impor Bahan Baku')}${ekspor('Ekspor Bahan Baku')}`,
    items: s => db().bahan.filter(b => textQ(s, b.nama, b.satuan[0]?.sku)),
    cols: ['SKU', 'Nama', 'Satuan'],
    row: b => [esc(b.satuan[0]?.sku || '-'), esc(b.nama), esc(b.satuan.map(x => x.nama).join(', '))],
    menu: b => [['Ubah', () => bahanForm(b)], ['Hapus', () => hapusBahan(b), 'danger']],
    bulk: { noun: 'Bahan Baku', coll: 'bahan', log: 'Bahan Baku', hapusLabel: n => `Hapus ${n} Bahan Baku`,
      hapus: n => ({ title: 'Hapus Bahan Baku', html: `Menghapus <b>${n} bahan baku</b> akan menghilangkan bahan baku tersebut secara permanen dan tidak dapat dibatalkan. Lanjutkan?` }),
      afterDelete: sel => { db().mutasi = db().mutasi.filter(m => !(m.item.startsWith('b:') && sel.has(m.item.slice(2)))); } }
  },
  'stok-opname': {
    title: 'Stok Opname', help: true, add: ['Tambah Stok Opname', () => stokDocForm('opname')], sub: periodeSub, links: impor() + ekspor(),
    extraFilters: () => dateBtn(invPeriode().btn),
    items: s => byWaktu(db().opname).filter(d => textQ(s, d.nomor)),
    cols: ['Tanggal', 'Nomor', 'Outlet', 'Dibuat Oleh', 'Status'],
    row: d => [tglPanjang(d.waktu), esc(d.nomor), d.outlet || OUTLET_UTAMA, d.dibuat, stPill(d.status)],
    view: d => stokDocDetail('opname', d)
  },
  'stok-terbuang': {
    title: 'Stok Terbuang', help: true, add: ['Tambah Stok Terbuang', () => stokDocForm('terbuang')], sub: periodeSub, links: ekspor(),
    extraFilters: () => dateBtn(invPeriode().btn),
    items: s => byWaktu(db().terbuang).filter(d => textQ(s, d.nomor)),
    cols: ['Tanggal', 'Nomor', 'Outlet', 'Dibuat Oleh', 'Status'],
    row: d => [tglPanjang(d.waktu), esc(d.nomor), d.outlet || OUTLET_UTAMA, d.dibuat, stPill(d.status)],
    view: d => stokDocDetail('terbuang', d)
  },
  'pemesanan-stok': {
    title: 'Pemesanan Stok', add: ['Tambah Pemesanan Stok', () => poForm()], sub: periodeSub, links: ekspor('Ekspor Pemesanan Stok'), colPick: true,
    extraFilters: () => `${dateBtn(invPeriode().btn)}<select class="fin fsel w-[200px] min-h-0 h-9" aria-label="Jenis pemesanan"><option>Semua Jenis Pemesanan</option><option>Pemesanan Barang Jual</option><option>Pemesanan Aset</option></select>`,
    items: s => byWaktu(db().po).filter(p => textQ(s, p.nomor, byId('pemasok', p.pemasok)?.nama)),
    cols: ['No. Pemesanan Stok', 'Jenis Pemesanan', 'Tanggal Pemesanan', 'Pemasok', 'Outlet', 'Dibuat Oleh', 'Uang Muka (Rp)', 'Tagihan (Rp)', 'Status'],
    row: p => [esc(p.nomor), p.jenis, tglPanjang(p.waktu), esc(byId('pemasok', p.pemasok)?.nama || '-'), p.outlet, p.dibuat, rp(p.uangMuka ? p.uangMukaNilai : 0), rp(hitungBeli(p).total), stPill(p.status)],
    view: p => (p.status === 'Draf' ? poForm(p) : poPreview(p))
  },
  'faktur-pembelian': {
    title: 'Faktur Pembelian', add: ['Tambah Faktur Pembelian', () => fakturForm()], sub: periodeSub, links: impor() + ekspor(),
    extraFilters: () => `${dateBtn(invPeriode().btn)}<select data-lstatus class="fin fsel w-[180px] min-h-0 h-9"><option value="">Semua Status</option>${['Belum Lunas', 'Sebagian', 'Lunas', 'Draf'].map(x => `<option ${st('faktur-pembelian').status === x ? 'selected' : ''}>${x}</option>`).join('')}</select><select class="fin fsel w-[200px] min-h-0 h-9" aria-label="Jenis pembelian"><option>Semua Jenis Pembelian</option><option>Barang Jual</option><option>Aset</option></select>`,
    top: () => { const fs = db().faktur.filter(f => f.status !== 'Draf'), now = new Date().toISOString(); return kpiInv([['Faktur Pembelian', fs.reduce((n, f) => n + f.total, 0)], ['Belum Dibayar', fs.reduce((n, f) => n + sisaTagihan(f), 0)], ['Sudah Dibayar', fs.reduce((n, f) => n + (f.dibayar || 0), 0)], ['Jatuh Tempo', fs.filter(f => f.jatuhTempo < now).reduce((n, f) => n + sisaTagihan(f), 0)], ['Void', 0]]); },
    items: s => byWaktu(db().faktur).filter(f => textQ(s, f.nomor, byId('pemasok', f.pemasok)?.nama) && (!s.status || f.status === s.status)),
    cols: ['Tanggal', 'Nama Pemasok', 'No Faktur', 'Jenis Pembelian', 'Produk', 'Jumlah', 'Jenis', 'Jatuh Tempo', 'Sisa Tagihan (Rp)', 'Total (Rp)', 'Outlet', 'Dibuat Oleh', 'Status'],
    row: f => [tglPanjang(f.waktu), esc(byId('pemasok', f.pemasok)?.nama || '-'), esc(f.nomor), 'Barang Jual', esc(f.items.map(r => itemOf(r.item).nama).join(', ')), fmtN(f.items.reduce((n, r) => n + r.qty, 0)), f.jenis, tglPendek(f.jatuhTempo), rp(sisaTagihan(f)), rp(f.total), f.outlet, f.dibuat, stPill(f.status)],
    view: f => fakturPreview(f)
  },
  'pembayaran-faktur': {
    title: 'Daftar Pembayaran Faktur', add: ['Tambah Pembayaran Faktur', () => bayarForm()], sub: periodeSub, links: ekspor('Ekspor Laporan'),
    extraFilters: () => `${dateBtn(invPeriode().btn)}<select class="fin fsel w-[180px] min-h-0 h-9" aria-label="Status"><option>Semua Status</option><option>Berhasil</option></select>`,
    items: s => byWaktu(db().bayarFaktur).filter(b => textQ(s, b.nomor, byId('pemasok', b.pemasok)?.nama)),
    cols: ['No Pembayaran', 'No Faktur', 'Outlet', 'Jenis Pembayaran', 'Pemasok', 'Tanggal Transaksi', 'Total Bayar (Rp)', 'Dibuat Oleh', 'Status'],
    row: b => [esc(b.nomor), esc(b.rincian.map(r => byId('faktur', r.faktur)?.nomor || '-').join(', ')), b.outlet, esc(b.akun), esc(byId('pemasok', b.pemasok)?.nama || '-'), tglPanjang(b.waktu), rp(b.total), b.dibuat, stPill(b.status)],
    view: b => bayarDetail(b)
  },
  'daftar-produksi-stok': {
    title: 'Daftar Produksi Stok', add: ['Tambah Produksi Stok', () => produksiForm()], sub: periodeSub, links: ekspor(),
    extraFilters: () => dateBtn(invPeriode().btn),
    items: s => byWaktu(db().produksi).filter(p => textQ(s, p.nomor)),
    cols: ['Tanggal', 'No Produksi', 'Stok Sumber', 'Stok Hasil', 'Catatan', 'Dibuat Oleh', 'Status'],
    row: p => [tglPanjang(p.waktu), esc(p.nomor), esc(p.sumber.map(r => itemOf(r.item).nama).join(', ')), esc(p.hasil.map(r => itemOf(r.item).nama).join(', ')), esc(p.catatan || '-'), p.dibuat, stPill(p.status)],
    view: p => produksiDetail(p)
  },
  'acuan-produksi-stok': {
    title: 'Template Produksi Stok', add: ['Template Produksi Stok', () => templateForm()],
    items: s => db().templateProduksi.filter(t => textQ(s, t.nama)),
    cols: ['Nama', 'Stok Sumber', 'Stok Hasil', 'Outlet'],
    row: t => [esc(t.nama), esc(t.sumber.map(r => itemOf(r.item).nama).join(', ')), esc(t.hasil.map(r => itemOf(r.item).nama).join(', ')), t.outlet],
    menu: t => [['Ubah', () => templateForm(t)], ['Hapus', () => deleteFlow('templateProduksi', t, 'Template Produksi Stok', null)]]
  }
});
['daftar-pemasok', 'daftar-bahan-baku', 'stok-opname', 'stok-terbuang', 'pemesanan-stok', 'faktur-pembelian', 'pembayaran-faktur', 'daftar-produksi-stok', 'acuan-produksi-stok']
  .forEach(slug => { PAGES[slug] = () => listPage(slug); });
PAGES['daftar-stok'] = daftarStokPage;
