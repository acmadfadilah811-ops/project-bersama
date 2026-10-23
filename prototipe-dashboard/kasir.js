// Aplikasi Kasir (POS) prototipe.
// Tampilan & alur mengikuti video kasir referensi (catatan-video-kasir.md): layar PIN karyawan, buka kasir,
// tiga kolom kategori–produk–keranjang, Detail Produk + ekstra, promo, Daftar/Detail Order, void, pembayaran
// (termasuk Pisah Bayar per jumlah atau per produk), struk, laporan, tutup kasir.
// Fitur meja dari URY POS (ury-erp/pos, ditulis ulang dari nol): daftar meja + status, pindah meja/pelayan, tagih.
// Data produk, kategori, meja, pesanan, pelanggan, promo memakai store.js (sama dengan dashboard).

const rp = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const ATTENTION_MIN = 30;          // meja ditandai "Perlu Perhatian" setelah 30 menit
const STAF = ['Bayu', 'Sinta', 'Raka', 'Dewi'];
const PIN_CONTOH = '123456';       // PIN contoh semua karyawan di prototipe
const $k = id => document.getElementById(id);

// keadaan layar
const K = {
  user: null, pinUser: '', pin: '', pinErr: '',
  view: 'kasir',                   // kasir | meja | order | detail | bayar | sukses | penjualan | laporan
  kat: '', q: '', mode: 'meja', area: 'Semua',
  cart: null,                      // { id?, tipe:'meja'|'bawa'|'ojek', meja, ojek, pelanggan, items:[], promo, pelayan, catatan }
  sel: null, okat: 'semua', oq: '', pq: '', lap: 'ringkasan',
  pay: null                        // { id, mode:'penuh'|'jumlah'|'produk', orang, pilih:{idx:qty}, metode, terima, catatan }
};
try { K.user = sessionStorage.getItem('kasirUser') || null; } catch (e) { /* tanpa storage: login ulang */ }

// ---------- util ----------
const elapsed = iso => { const s = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000)); return [s / 3600, (s % 3600) / 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':'); };
const minutesSince = iso => (Date.now() - new Date(iso)) / 60000;
const nextNo = () => 'ORD-' + String(db().pesanan.reduce((m, o) => Math.max(m, /^ORD-\d+$/.test(o.id) ? +o.id.slice(4) : 0), 0) + 1).padStart(4, '0');
const pelName = id => byId('pelanggan', id)?.nama || '';
const mejaName = id => byId('meja', id)?.nama || '-';
const ojekName = id => byId('ojek', id)?.nama || 'Ojek Online';
const orderPlace = o => (o.tipe === 'meja' ? mejaName(o.meja) : o.tipe === 'ojek' ? ojekName(o.ojek) : 'Bawa Pulang');
const jenisLabel = o => (o.tipe === 'meja' ? 'Makan di Tempat' : o.tipe === 'ojek' ? ojekName(o.ojek) : 'Bawa Pulang');
const openShift = () => db().shift.find(s => !s.tutup);
const initials = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
const upper = s => String(s || '').toUpperCase();

// hitung(), dibayar(), sisaOf() ada di store.js (dipakai juga halaman Laporan)

const STATUS = {
  draft: ['Belum Bayar', '#FFF7E6', '#AD6800'], tagih: ['Ditagih', '#E6F4FF', '#0958D9'],
  lunas: ['Lunas', '#E6F9F4', '#10AF8C'], batal: ['Void', '#F2F2F2', '#777777']
};
const pill = (txt, bg, fg) => `<span class="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-0.5 rounded whitespace-nowrap" style="background:${bg};color:${fg}"><span class="w-1.5 h-1.5 rounded-full" style="background:${fg}"></span>${txt}</span>`;
const statusPill = o => pill(...(o.status === 'draft' && dibayar(o) ? ['Sebagian Dibayar', '#E6F4FF', '#0958D9'] : STATUS[o.status]));

function mejaState(m) {
  if (K.cart && K.cart.tipe === 'meja' && K.cart.meja === m.id && !K.cart.id) return ['Aktif', '#E6F4FF', '#0958D9'];
  const o = mejaOrder(m.id);
  if (!o) return ['Kosong', '#E6F9F4', '#10AF8C'];
  return minutesSince(o.dibuat) > ATTENTION_MIN ? ['Perlu Perhatian', '#FDECEC', '#CF1322'] : ['Terisi', '#FFF7E6', '#AD6800'];
}

// pesan singkat gelap di tengah bawah (mis. "Berhasil simpan order!")
function snack(msg) {
  document.querySelectorAll('.snack').forEach(s => s.remove());
  const s = nodeOf(`<div class="snack fixed left-1/2 -translate-x-1/2 bottom-24 z-[300] bg-[#272A2A] text-white text-[13px] font-medium px-4 py-2.5 rounded-md shadow-lg">${msg}</div>`);
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 2200);
}

// ---------- panel samping kiri (gaya referensi) ----------
function sideSheet({ title, body, actions = '', width = 'w-[520px]', onMount }) {
  const z = (layer += 2);
  const d = nodeOf(`<div class="fixed inset-0 bg-black/40" style="z-index:${z}">
    <aside class="absolute left-0 inset-y-0 ${width} max-w-full bg-white flex flex-col shadow-xl">
      <div class="h-[52px] shrink-0 flex items-center gap-3 px-4 border-b border-line"><button data-sx aria-label="Tutup"><i data-lucide="x"></i></button>
        <h2 data-st class="text-[16px] font-semibold flex-1 min-w-0 truncate">${title}</h2><div data-sa class="flex items-center gap-2">${actions}</div></div>
      <div data-sb class="flex-1 overflow-y-auto">${body}</div></aside></div>`);
  const api = {
    el: d,
    close() { d.remove(); layer -= 2; },
    setBody(h) { d.querySelector('[data-sb]').innerHTML = h; lucide.createIcons(); },
    setActions(h) { d.querySelector('[data-sa]').innerHTML = h; lucide.createIcons(); },
    onClose: null
  };
  d.querySelector('[data-sx]').onclick = () => (api.onClose ? api.onClose() : api.close());
  d.addEventListener('click', e => { if (e.target === d) (api.onClose ? api.onClose() : api.close()); });
  document.body.appendChild(d); lucide.createIcons();
  if (onMount) onMount(api);
  return api;
}
const hBtn = (label, attr, primary = true) => `<button ${attr} class="h-9 px-4 rounded-md text-[14px] font-semibold ${primary ? 'bg-brand text-white disabled:bg-[#D6D9D9]' : 'text-brand'}">${label}</button>`;

// ---------- modal isian kecil ----------
function promptModal({ title, body, ok = 'Simpan', danger = false, width = 'w-[440px]', onMount }) {
  return new Promise(resolve => {
    const z = (layer += 2);
    const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${z}">
      <form class="bg-white rounded-lg ${width} max-w-full max-h-[92vh] flex flex-col" novalidate>
        <div class="flex items-center justify-between px-6 py-4 border-b border-line"><h3 class="text-[20px] font-semibold">${title}</h3><button type="button" data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
        <div class="px-6 py-5 overflow-y-auto">${body}</div>
        <div class="flex justify-end items-center gap-6 px-6 py-4 border-t border-line"><button type="button" data-x class="text-brand text-[14px] font-semibold">Batal</button>
          <button type="submit" data-ok class="h-10 px-4 rounded-md text-white text-[14px] font-semibold" style="background:${danger ? '#E5333F' : '#04C99E'}">${ok}</button></div>
      </form></div>`);
    const close = v => { d.remove(); layer -= 2; resolve(v); };
    d.querySelectorAll('[data-x]').forEach(b => b.onclick = () => close(null));
    d.querySelector('form').onsubmit = e => { e.preventDefault(); if (!validate(d)) return; close(formValues(d)); };
    document.body.appendChild(d); lucide.createIcons();
    if (onMount) onMount(d);
    d.querySelector('input:not([disabled]),select,textarea')?.focus();
  });
}
const lblK = (t, r) => `<p class="text-[12px] font-medium mb-2">${t}${r ? '<span class="text-danger">*</span>' : ''}</p>`;

// ---------- struk ----------
function strukHtml(o, judul) {
  const t = hitung(o);
  const line = (a, b) => `<div class="flex justify-between gap-2"><span>${a}</span><span>${b}</span></div>`;
  return `<div id="printArea" class="struk w-[280px] mx-auto bg-white p-4 border border-dashed border-[#D6D9D9]">
    <p class="text-center font-bold text-[14px]">by cafe</p><p class="text-center">Jl. Contoh No. 1</p>
    <p class="text-center mt-1">${judul}</p><hr class="border-dashed border-ink-4 my-2">
    ${line('No', o.id)}${line('Waktu', nowText(new Date(o.dibuat)))}${line('Kasir', o.kasir)}${line(o.tipe === 'meja' ? 'Meja' : 'Jenis Order', esc(orderPlace(o)))}${o.pelanggan ? line('Pelanggan', esc(pelName(o.pelanggan))) : ''}
    <hr class="border-dashed border-ink-4 my-2">
    ${o.items.map(i => `<div>${esc(i.nama)}</div>${(i.ekstra || []).map(x => `<div>&nbsp;&nbsp;+ ${esc(x.nama)}</div>`).join('')}${line(`&nbsp;&nbsp;${i.qty} x ${i.harga.toLocaleString('id-ID')}`, (i.qty * i.harga).toLocaleString('id-ID'))}${i.catatan ? `<div>&nbsp;&nbsp;* ${esc(i.catatan)}</div>` : ''}`).join('')}
    <hr class="border-dashed border-ink-4 my-2">
    ${line('Subtotal', t.sub.toLocaleString('id-ID'))}${t.daftarPromo.map(x => line(esc(promoLabel(x.p)), '(' + x.nilai.toLocaleString('id-ID') + ')')).join('')}${line('PB1 10%', t.pajak.toLocaleString('id-ID'))}<div class="font-bold">${line('TOTAL', t.total.toLocaleString('id-ID'))}</div>
    ${(o.pembayaran || []).length ? `<hr class="border-dashed border-ink-4 my-2">${o.pembayaran.map((p, n) => `${line(`${o.pembayaran.length > 1 ? `Bayar ${n + 1} · ` : ''}${esc(p.metode)}`, p.diterima.toLocaleString('id-ID'))}${p.kembalian ? line('&nbsp;&nbsp;Kembali', p.kembalian.toLocaleString('id-ID')) : ''}`).join('')}` : ''}
    <hr class="border-dashed border-ink-4 my-2"><p class="text-center">${o.status === 'lunas' ? 'Terima kasih atas kunjungan Anda' : `Sisa tagihan ${sisaOf(o).toLocaleString('id-ID')}`}</p></div>`;
}
function showStruk(o, judul) {
  const z = (layer += 2);
  const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${z}">
    <div class="bg-white rounded-lg w-[360px] max-w-full max-h-[92vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-line"><h3 class="text-[20px] font-semibold">${judul}</h3><button data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
      <div class="p-4 overflow-y-auto bg-page">${strukHtml(o, judul)}</div>
      <div class="flex justify-end gap-6 px-6 py-4 border-t border-line">${fBtn.text('Tutup', 'data-x')}${fBtn.primary('<span class="flex items-center gap-2"><i data-lucide="printer" class="ic-sm"></i>Cetak</span>', 'data-print')}</div></div></div>`);
  d.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { d.remove(); layer -= 2; });
  d.querySelector('[data-print]').onclick = () => window.print();
  document.body.appendChild(d); lucide.createIcons();
}

// ---------- keranjang ----------
const newCart = () => ({ tipe: 'bawa', meja: null, ojek: null, pelanggan: null, items: [], promo: null, promoProduk: [], pelayan: K.user || 'Bayu', catatan: '' });
const cart = () => (K.cart = K.cart || newCart());
function hargaDasar(p, c) {
  // ojek online memakai daftar harga ojek bila produk terdaftar, selain itu harga grup pelanggan
  if (c.tipe === 'ojek') { const x = byId('ojek', c.ojek)?.produk.find(r => r.id === p.id); if (x) return x.harga; }
  return hargaUntuk(p, c.pelanggan);
}
const repriceCart = () => cart().items.forEach(i => { const p = i.produk && byId('produk', i.produk); if (!p) return; const v = i.varian && p.varian?.items.find(x => x.nama === i.varian); i.harga = (v ? v.hargaJual : hargaDasar(p, K.cart)) + (i.ekstra || []).reduce((s, x) => s + x.harga * x.qty, 0); });
const sig = l => `${l.produk}|${l.varian || ''}|${(l.ekstra || []).map(x => x.nama + x.qty).join(',')}|${l.catatan || ''}|${l.bonus || ''}`;
function addLine(line) {
  const c = cart(), same = c.items.find(i => sig(i) === sig(line));
  if (same) same.qty += line.qty; else c.items.push(line);
}
function loadOrder(o) {
  K.cart = { id: o.id, tipe: o.tipe, meja: o.meja, ojek: o.ojek || null, pelanggan: o.pelanggan, items: o.items.map(i => ({ ...i, ekstra: (i.ekstra || []).map(x => ({ ...x })) })), promo: o.promo || null, promoProduk: [...(o.promoProduk || [])], pelayan: o.pelayan, catatan: o.catatan || '' };
}
function saveCart(status) {
  const c = K.cart;
  terapkanPromo(c);
  let o = c.id ? db().pesanan.find(x => x.id === c.id) : null;
  if (!o) { o = { id: nextNo(), dibuat: new Date().toISOString(), kasir: K.user || 'Bayu', dicetak: false, pembayaran: [] }; db().pesanan.unshift(o); }
  Object.assign(o, { tipe: c.tipe, meja: c.meja, ojek: c.ojek, pelanggan: c.pelanggan, items: c.items.map(i => ({ ...i })), promo: c.promo, promoProduk: c.promoProduk || [], pelayan: c.pelayan, catatan: c.catatan, status: status || (o.status === 'tagih' ? 'tagih' : 'draft') });
  c.id = o.id;
  saveDB();
  return o;
}
const cartDirty = () => K.cart && K.cart.items.length && (!K.cart.id || JSON.stringify(K.cart.items) !== JSON.stringify(db().pesanan.find(o => o.id === K.cart.id)?.items));

// Detail Produk: varian, jumlah, satuan, ekstra (bisa beberapa grup), catatan (produk baru atau ubah baris keranjang)
const ekstraProduk = p => (p.ekstra ? (p.ekstraIds || (p.ekstraId ? [p.ekstraId] : [])) : []).map(id => byId('ekstra', id)).filter(Boolean);
const varianAktif = p => (p.varian?.aktif ? p.varian.items.filter(i => i.aktif) : []);
const perluDetail = p => ekstraProduk(p).length > 0 || varianAktif(p).length > 0;
function detailProduk(p, line) {
  const groups = ekstraProduk(p), vars = varianAktif(p);
  const key = (g, s) => `${g.id}|${s}`;
  const st = { qty: line ? line.qty : 1, varian: line?.varian || (vars.length === 1 ? vars[0].nama : ''), catatan: line?.catatan || '',
    pilih: Object.fromEntries((line?.ekstra || []).map(x => [key({ id: x.grup }, x.nama), x.qty])) };
  const dasar = () => (st.varian ? vars.find(v => v.nama === st.varian)?.hargaJual || 0 : hargaDasar(p, cart()));
  const hargaSatu = () => dasar() + groups.reduce((s, g) => s + g.sub.reduce((t, x) => t + x.harga * (st.pilih[key(g, x.nama)] || 0), 0), 0);
  const jumlahGrup = g => g.sub.reduce((n, x) => n + (st.pilih[key(g, x.nama)] || 0), 0);
  const body = () => `<div class="p-5">
    <div class="flex items-center gap-3">${p.foto?.length ? `<img src="${p.foto[0]}" alt="" class="w-16 h-16 rounded-md object-cover">` : `<span class="w-16 h-16 rounded-md bg-[#EDEFEF] text-[18px] font-semibold text-ink-3 flex items-center justify-center">${esc(initials(p.nama))}</span>`}
      <div><p class="text-[14px] font-semibold">${esc(upper(p.nama))}${st.varian ? ` <span class="text-ink-3 font-normal">(${esc(st.varian)})</span>` : ''}</p><p class="text-[14px] text-ink-3 mt-1">${rp(hargaSatu())}</p></div></div>
    ${vars.length ? `<p class="text-[13px] mt-6"><b>Varian</b> <span class="text-danger">(Harus dipilih)</span></p><div class="grid grid-cols-2 gap-3 mt-3">${vars.map(v => `<button type="button" data-v="${esc(v.nama)}" class="rounded-md border p-3 text-left ${st.varian === v.nama ? 'border-brand bg-brand-soft' : 'border-[#D6D9D9]'}"><p class="text-[13px] font-medium">${esc(v.nama)}</p><p class="text-[12px] text-ink-3">${rp(v.hargaJual)}</p></button>`).join('')}</div>` : ''}
    <div class="grid grid-cols-2 gap-4 mt-5"><div>${lblK('Kuantitas')}<div class="flex h-10 border border-[#D6D9D9] rounded-md overflow-hidden"><button type="button" data-q="-1" class="w-12 text-[20px] text-brand">−</button><span class="flex-1 flex items-center justify-center font-semibold">${st.qty}</span><button type="button" data-q="1" class="w-12 text-[20px] text-brand">+</button></div></div>
      <div>${lblK('Satuan')}<select class="fin fsel"><option>${esc(p.satuan || 'pcs')}</option></select></div></div>
    ${groups.length ? `<p class="text-[16px] font-semibold mt-6">Ekstra</p>${groups.map(g => { const wajib = g.jenis === 'Mandatory', single = g.cara !== 'Many', maks = single ? 1 : (g.maks || 99); return `
      <p class="text-[13px] mt-4"><b>${esc(g.nama)}</b> <span class="${wajib ? 'text-danger' : 'text-ink-3'}">(${wajib ? 'Harus dipilih' : 'Opsional'}, ${single ? 'Hanya bisa pilih 1' : `Bisa pilih maks. ${maks}`})</span></p>
      <div class="grid grid-cols-2 gap-3 mt-3">${g.sub.map(x => { const n = st.pilih[key(g, x.nama)] || 0; return `<div class="rounded-md border ${n ? 'border-brand bg-brand-soft' : 'border-[#D6D9D9]'} p-3">
        <p class="text-[13px] font-medium">${esc(x.nama)}</p><p class="text-[12px] text-ink-3">${rp(x.harga)}</p>
        <div class="flex items-center justify-between mt-2"><button type="button" data-e="${g.id}" data-n="${esc(x.nama)}" data-d="-1" class="text-[20px] text-brand w-8">−</button><span class="font-semibold">${n}</span><button type="button" data-e="${g.id}" data-n="${esc(x.nama)}" data-d="1" class="text-[20px] text-brand w-8">+</button></div></div>`; }).join('')}</div>`; }).join('')}` : ''}
    <div class="mt-6">${lblK('Catatan')}<textarea data-cat rows="2" class="fin" placeholder="Contoh: tanpa es, pedas sedang">${esc(st.catatan)}</textarea></div>
    ${line ? '<button type="button" data-hapus class="mt-6 text-danger text-[14px] font-semibold flex items-center gap-2"><i data-lucide="trash-2" class="ic-sm"></i>Hapus dari pesanan</button>' : ''}</div>`;
  sideSheet({ title: 'Detail Produk', body: body(), actions: hBtn('Simpan', 'data-ok'), onMount: sh => {
    const paint = () => { st.catatan = sh.el.querySelector('[data-cat]').value; sh.setBody(body()); };
    sh.el.addEventListener('click', e => {
      const q = e.target.closest('[data-q]');
      if (q) { st.qty = Math.max(1, st.qty + +q.dataset.q); return paint(); }
      const v = e.target.closest('[data-v]');
      if (v) { st.varian = v.dataset.v; return paint(); }
      const x = e.target.closest('[data-e]');
      if (x) {
        const g = groups.find(gg => gg.id === x.dataset.e), k = key(g, x.dataset.n), d = +x.dataset.d;
        const single = g.cara !== 'Many', maks = single ? 1 : (g.maks || 99);
        if (single && d > 0) { g.sub.forEach(s => { delete st.pilih[key(g, s.nama)]; }); st.pilih[k] = 1; return paint(); }
        if (d > 0 && jumlahGrup(g) >= maks) return toast('Info', `${esc(g.nama)} maksimal ${maks} pilihan`);
        st.pilih[k] = Math.max(0, (st.pilih[k] || 0) + d);
        return paint();
      }
      if (e.target.closest('[data-hapus]')) { cart().items = cart().items.filter(i => i !== line); sh.close(); return render(); }
      if (e.target.closest('[data-ok]')) {
        st.catatan = sh.el.querySelector('[data-cat]').value.trim();
        if (vars.length && !st.varian) return toast('Gagal!', 'Varian harus dipilih', 'error');
        const kurang = groups.find(g => g.jenis === 'Mandatory' && !jumlahGrup(g));
        if (kurang) return toast('Gagal!', `${esc(kurang.nama)} harus dipilih`, 'error');
        const ekstra = groups.flatMap(g => g.sub.filter(s => st.pilih[key(g, s.nama)]).map(s => ({ grup: g.id, nama: s.nama, harga: s.harga, qty: st.pilih[key(g, s.nama)] })));
        const baru = { produk: p.id, nama: st.varian ? `${p.nama} (${st.varian})` : p.nama, varian: st.varian || '', harga: hargaSatu(), qty: st.qty, catatan: st.catatan, ekstra };
        if (line) Object.assign(line, baru); else addLine(baru);
        sh.close(); render();
      }
    });
  } });
}
function tapProduk(pid) {
  const p = byId('produk', pid);
  if (perluDetail(p)) return detailProduk(p);
  addLine({ produk: p.id, nama: p.nama, harga: hargaDasar(p, cart()), qty: 1, catatan: '', ekstra: [] });
  render();
}
async function customAmount() {
  const v = await promptModal({ title: 'Custom Amount', ok: 'Tambahkan',
    body: `${lblK('Nama Item', 1)}${fInput('nama', 'Contoh: Biaya kirim', '', { req: 'Mohon isi nama item' })}<div class="mt-4">${lblK('Nominal', 1)}${fInput('nominal', '0', '', { prefix: 'Rp', money: true, req: 'Mohon isi nominal', num: true })}</div>` });
  if (!v) return;
  addLine({ produk: null, nama: v.nama, harga: toNum(v.nominal), qty: 1, catatan: '', ekstra: [] });
  render();
}

// ---------- jenis order, meja, pelanggan, promo ----------
function pilihJenis(anchor) {
  const ojek = db().ojek.filter(o => o.status);
  rowMenu(anchor, [
    ['Makan di Tempat (Meja)', () => pilihMeja()],
    ['Bawa Pulang', () => { Object.assign(cart(), { tipe: 'bawa', meja: null, ojek: null }); repriceCart(); render(); }],
    ...ojek.map(o => [o.nama, () => { Object.assign(cart(), { tipe: 'ojek', ojek: o.id, meja: null }); repriceCart(); render(); }])
  ]);
}
function mejaGrid(pick) {
  const mejas = db().meja.filter(m => m.aktif);
  return `<div class="grid grid-cols-3 gap-3 p-5">${mejas.map(m => {
    const [txt, bg, fg] = mejaState(m), dipakai = !!mejaOrder(m.id);
    return `<button ${pick && !dipakai ? `data-pm="${m.id}"` : 'disabled'} class="card p-3 text-left ${dipakai ? 'opacity-60' : 'hover:ring-2 hover:ring-brand'}">${pill(txt, bg, fg)}<p class="text-[16px] font-semibold mt-2">${esc(m.nama)}</p><p class="text-[12px] text-ink-3">${esc(m.area)} · ${m.kapasitas} kursi</p></button>`;
  }).join('')}</div>`;
}
function pilihMeja() {
  sideSheet({ title: 'Pilih Meja', body: mejaGrid(true), onMount: sh => sh.el.addEventListener('click', e => {
    const b = e.target.closest('[data-pm]');
    if (!b) return;
    Object.assign(cart(), { tipe: 'meja', meja: b.dataset.pm, ojek: null }); repriceCart();
    sh.close(); render(); snack(`Pesanan untuk ${esc(mejaName(b.dataset.pm))}`);
  }) });
}
function pilihPelanggan() {
  let grup = '';
  const body = () => {
    const grups = db().grupPelanggan;
    const list = db().pelanggan.filter(c => (!grup || (grup === '-' ? !c.grup : c.grup === grup)) && (c.nama + (c.telepon || '') + telp(c)).toLowerCase().includes(K.pq));
    return `<div class="px-5 pt-3 flex gap-6 overflow-x-auto border-b border-line text-[14px]">${[['', 'Semua'], ['-', 'Tanpa Grup'], ...grups.map(g => [g.id, upper(g.nama)])].map(([v, l]) => `<button data-g="${v}" class="pb-2 whitespace-nowrap ${grup === v ? 'text-brand font-semibold border-b-2 border-brand' : 'text-ink-3'}">${esc(l)}</button>`).join('')}</div>
      <div class="p-5"><label class="fin h-10 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-pq class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..." value="${esc(K.pq)}"></label>
      <div class="mt-3 divide-y divide-line">${list.map(c => `<div class="flex items-center gap-3 py-3"><button data-pc="${c.id}" class="flex-1 min-w-0 text-left"><p class="text-[14px] font-semibold truncate">${esc(c.nama)}</p><p class="text-[12px] text-ink-3 truncate">${esc(telp(c))} • ${esc(c.kode || '')}</p></button>
        <span class="text-[12px] text-ink-3 whitespace-nowrap">${c.poin || 0} poin</span>${cart().pelanggan === c.id ? '<span class="text-[12px] font-semibold text-brand">Dipilih</span>' : ''}</div>`).join('') || '<p class="text-center text-[14px] text-ink-3 py-10">Pelanggan tidak ditemukan</p>'}</div></div>`;
  };
  sideSheet({ title: 'Pilih Pelanggan', body: body(), actions: `${cart().pelanggan ? hBtn('Lepas', 'data-lepas', false) : ''}<button data-baru class="text-brand text-[14px] font-semibold flex items-center gap-1"><i data-lucide="plus" class="ic-sm"></i>Pelanggan Baru</button>`, onMount: sh => {
    sh.el.addEventListener('input', e => { if (e.target.matches('[data-pq]')) { K.pq = e.target.value.toLowerCase(); sh.setBody(body()); const i = sh.el.querySelector('[data-pq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
    sh.el.addEventListener('click', async e => {
      const g = e.target.closest('[data-g]'); if (g) { grup = g.dataset.g; return sh.setBody(body()); }
      const c = e.target.closest('[data-pc]');
      if (c) { cart().pelanggan = c.dataset.pc; repriceCart(); sh.close(); render(); return snack(`Pelanggan ${esc(pelName(c.dataset.pc))} dipilih`); }
      if (e.target.closest('[data-lepas]')) { cart().pelanggan = null; repriceCart(); sh.close(); return render(); }
      if (e.target.closest('[data-baru]')) { sh.close(); pelangganBaru(); }
    });
  } });
}
function pelangganBaru() {
  const kode = genKode();
  sideSheet({ title: 'Pelanggan Baru', actions: hBtn('Simpan', 'data-ok'), body: `<form class="p-5 space-y-4" novalidate>
    <div>${lblK('Kode Pelanggan', 1)}<input class="fin" name="kode" value="${kode}"></div>
    <div>${lblK('Nama Pelanggan', 1)}${fInput('nama', 'Contoh: Andi', '', { req: 'Mohon lengkapi nama pelanggan' })}</div>
    <div>${lblK('Jenis Kelamin', 1)}<div class="grid grid-cols-2 gap-3">${fRadioCard('jk', 'L', 'Laki-Laki', true)}${fRadioCard('jk', 'P', 'Perempuan', false)}</div></div>
    <div>${lblK('Grup Pelanggan <span class="text-ink-4 font-normal">opsional</span>')}${fSelect('grup', db().grupPelanggan.map(g => [g.id, g.nama]), '', 'Pilih')}</div>
    <div>${lblK('Email <span class="text-ink-4 font-normal">opsional</span>')}${fInput('email', 'Contoh: nama@email.com', '')}</div>
    <div>${lblK('No Telepon', 1)}<div class="flex gap-2"><select class="fin fsel w-[96px] shrink-0" aria-label="Kode negara"><option>+62</option></select><div class="flex-1">${fInput('telepon', 'Contoh: 81212345678', '', { req: 'Mohon lengkapi nomor telepon' })}</div></div></div>
    <div>${lblK('Tanggal Lahir <span class="text-ink-4 font-normal">opsional</span>')}<input type="date" name="lahir" class="fin"></div></form>`,
  onMount: sh => sh.el.addEventListener('click', e => {
    if (!e.target.closest('[data-ok]')) return;
    const f = sh.el.querySelector('form');
    if (!validate(f)) return;
    const v = formValues(f);
    const c = { id: uid(), kode: v.kode || kode, nama: v.nama, telepon: v.telepon.replace(/\D/g, '').replace(/^(62|0)/, ''), email: v.email, jk: v.jk, grup: v.grup, lahir: v.lahir, poin: 0, deposit: 0, dibuat: new Date().toISOString() };
    db().pelanggan.unshift(c); cart().pelanggan = c.id; repriceCart(); saveDB();
    sh.close(); render(); toast('Berhasil!', `Pelanggan <b>${esc(c.nama)}</b> berhasil ditambahkan`);
  }) });
}
function menuPromo(anchor) {
  rowMenu(anchor, [['Promo', () => listPromo()], ['Kupon', () => toast('Info', 'Belum ada kupon yang bisa dipakai')],
    ['Poin', () => (cart().pelanggan ? toast('Info', `Poin ${esc(pelName(cart().pelanggan))}: ${byId('pelanggan', cart().pelanggan).poin || 0} poin, belum cukup untuk ditukar`) : toast('Info', 'Pilih pelanggan terlebih dahulu'))],
    ['Promo Tersedia', () => listPromo()]]);
}
// promo otomatis dipasang sendiri saat syaratnya terpenuhi; promo manual pilihan kasir dilepas bila syaratnya tidak lagi terpenuhi.
// produk bonus ikut ditambah / dikurangi di keranjang
function terapkanPromo(c) {
  const now = new Date();
  const cocok = p => p && promoJalan(p, now) && (p.potongan === 'coret' ? potonganPromo(p, c) > 0 : promoSyarat(p, c).n > 0);
  const kira = p => (p.potongan === 'bonus' ? promoBonus(p, c).reduce((s, b) => s + byId('produk', b.produk).hargaJual * b.qty, 0) : potonganPromo(p, c));
  let tot = c.promo && byId('promo', c.promo);
  if (!cocok(tot)) tot = null;
  if (!tot || tot.aktivasi === 'otomatis') tot = db().promo.filter(p => p.jenis === 'total' && p.aktivasi === 'otomatis' && cocok(p)).sort((a, b) => kira(b) - kira(a))[0] || tot;
  c.promo = tot ? tot.id : null;
  const manual = c.promoProduk || [];
  c.promoProduk = db().promo.filter(p => p.jenis === 'produk' && (p.aktivasi === 'otomatis' || manual.includes(p.id)) && cocok(p)).map(p => p.id);
  const mau = [c.promo, ...c.promoProduk].map(id => byId('promo', id)).filter(p => p && p.potongan === 'bonus').flatMap(p => promoBonus(p, c).map(b => ({ ...b, bonus: p.id })));
  c.items = c.items.filter(i => !i.bonus || mau.some(b => b.bonus === i.bonus && b.produk === i.produk));
  mau.forEach(b => {
    const ada = c.items.find(i => i.bonus === b.bonus && i.produk === b.produk), p = byId('produk', b.produk);
    if (ada) ada.qty = b.qty; else c.items.push({ produk: b.produk, nama: p.nama, varian: '', harga: p.hargaJual, qty: b.qty, catatan: '', ekstra: [], bonus: b.bonus });
  });
}
function listPromo() {
  const c = cart(), now = new Date();
  let pilih = c.promo;
  const pilihP = new Set(c.promoProduk || []);
  const sisaWaktu = p => { const m = Math.max(0, Math.round((new Date(`${p.akhir}T${p.jamSelesai || '23:59'}:00`) - now) / 60000)); return m >= 1440 ? `${Math.floor(m / 1440)} hari` : `${Math.floor(m / 60)} jam ${m % 60} Menit`; };
  const poin = p => [p.potongan === 'coret' ? 'Harga coret' : `Pembelian min ${p.dasar === 'qty' ? `${p.minimal} pcs` : rp(p.minimal)}`,
    { pct: `Diskon ${p.nilai}%`, rp: `Potongan ${rp(p.nilai)}`, bonus: 'Bonus produk', coret: 'Harga promo khusus' }[p.potongan],
    ...(p.jenis === 'produk' ? [`Produk: ${(p.potongan === 'coret' ? p.coret.map(x => x.produk) : p.produk).map(id => byId('produk', id)?.nama).filter(Boolean).join(', ')}`] : [])];
  const kartu = p => {
    const total = p.jenis === 'total', oto = p.aktivasi === 'otomatis';
    const ok = p.potongan === 'coret' ? potonganPromo(p, c) > 0 : promoSyarat(p, c).n > 0;
    const on = oto ? ok : total ? pilih === p.id : pilihP.has(p.id);
    return `<button data-pp="${p.id}" ${ok && !oto ? '' : 'disabled'} class="card text-left overflow-hidden ${on ? 'ring-2 ring-brand' : ''} ${ok ? '' : 'opacity-60'}">
      <div class="p-4"><div class="flex items-start gap-2"><p class="text-[12px] text-brand font-medium flex-1">${total ? 'Promo Total Pembelian' : 'Promo Produk'}</p>${oto ? '<span class="text-[11px] bg-[#F2F2F2] text-ink-3 rounded px-1.5 py-0.5">Otomatis</span>' : `<span class="w-5 h-5 ${total ? 'rounded-full' : 'rounded'} border-2 ${on ? 'border-brand bg-brand' : 'border-[#D6D9D9]'}"></span>`}</div>
        <p class="text-[14px] font-semibold mt-1">${esc(upper(p.nama))}</p><ul class="text-[12px] text-ink-2 mt-2 list-disc pl-4">${poin(p).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <span class="inline-block text-[11px] bg-brand-soft text-brand-dark rounded px-1.5 py-0.5 mt-2">Pos</span>${ok ? '' : '<p class="text-[12px] text-danger mt-2">Syarat promo belum terpenuhi</p>'}${oto && ok ? '<p class="text-[12px] text-ink-3 mt-2">Terpasang otomatis di pesanan</p>' : ''}</div>
      <div class="flex justify-between border-t border-line px-4 py-2 text-[12px]"><span class="text-ink-3">Promo Berakhir</span><span class="text-danger">${sisaWaktu(p)}</span></div></button>`;
  };
  const body = () => { const list = db().promo.filter(p => promoJalan(p, now)); return `<div class="p-5 grid sm:grid-cols-2 gap-4">${list.map(kartu).join('') || '<p class="text-[14px] text-ink-3">Belum ada promo aktif</p>'}</div>`; };
  sideSheet({ title: 'List Promosi', width: 'w-[640px]', body: body(), actions: hBtn('Reset', 'data-reset', false) + hBtn('Simpan', 'data-ok'), onMount: sh => sh.el.addEventListener('click', e => {
    const b = e.target.closest('[data-pp]');
    if (b) { const p = byId('promo', b.dataset.pp); if (p.jenis === 'total') pilih = pilih === p.id ? null : p.id; else pilihP.has(p.id) ? pilihP.delete(p.id) : pilihP.add(p.id); return sh.setBody(body()); }
    if (e.target.closest('[data-reset]')) { pilih = null; pilihP.clear(); return sh.setBody(body()); }
    if (e.target.closest('[data-ok]')) { c.promo = pilih; c.promoProduk = [...pilihP]; sh.close(); render(); }
  }) });
}

// ---------- layar PIN ----------
function pinScreen() {
  return `<div class="h-full grid lg:grid-cols-[1fr_2fr]">
    <section class="hidden lg:flex flex-col justify-between p-8 text-white" style="background:linear-gradient(160deg,#04C99E 0%,#0E9F7E 100%)">
      <div class="flex items-center gap-3"><span class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-extrabold">k</span><div><p class="font-semibold">by cafe</p><p class="text-[12px] text-white/80">Outlet utama</p></div><span class="ml-auto text-[12px] bg-white text-ink rounded-full px-2 py-0.5 font-semibold">IND</span></div>
      <div class="text-center"><i data-lucide="monitor-smartphone" style="width:120px;height:120px;stroke-width:1.2" class="mx-auto opacity-90"></i>
        <p class="text-[13px] text-white/80 mt-8">Kasir cepat untuk usaha kuliner</p><p class="text-[28px] font-bold leading-tight mt-2">Catat pesanan, terima bayar,<br>tutup kasir rapi</p></div><span></span></section>
    <section class="bg-white flex flex-col items-center justify-center p-6">
      <span class="text-[34px] font-extrabold tracking-tight" style="background:linear-gradient(90deg,#04C99E,#1FB5C9);-webkit-background-clip:text;color:transparent">kasirku</span>
      <div class="flex gap-2 mt-6 w-full max-w-[340px]"><select data-pinuser class="fin fsel flex-1 ${K.pinUser ? '' : 'text-[#A0A6A6]'}"><option value="">Pilih Karyawan</option>${STAF.map(s => `<option ${K.pinUser === s ? 'selected' : ''}>${upper(s)}</option>`).join('')}</select>
        <button class="w-10 h-10 rounded-md border border-[#D6D9D9] flex items-center justify-center" aria-label="Pindai kartu karyawan" data-scan><i data-lucide="scan-line" class="ic-sm"></i></button></div>
      <div class="flex gap-4 mt-8">${[0, 1, 2, 3, 4, 5].map(i => `<span class="w-3 h-3 rounded-full ${i < K.pin.length ? 'bg-brand' : 'bg-[#D6D9D9]'}"></span>`).join('')}</div>
      <p class="text-[13px] mt-4 ${K.pinErr ? 'text-danger font-medium' : 'text-ink-3'}">${K.pinErr || `Masukkan PIN (PIN contoh: ${PIN_CONTOH})`}</p>
      <div class="grid grid-cols-3 gap-x-10 gap-y-2 mt-8 w-full max-w-[300px]">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(k => `<button data-pin="${k}" class="pinkey">${k === '⌫' ? '<i data-lucide="delete" class="mx-auto"></i>' : k}</button>`).join('')}</div>
    </section></div>`;
}
async function tekanPin(k) {
  if (k === 'C') { K.pin = ''; K.pinErr = ''; return render(); }
  if (k === '⌫') { K.pin = K.pin.slice(0, -1); return render(); }
  if (!K.pinUser) return confirmDialog({ title: 'Pilih', html: 'Silakan pilih karyawan terlebih dahulu', ok: 'OK', cancel: null });
  if (K.pin.length >= 6) return;
  K.pin += k; K.pinErr = '';
  render();
  if (K.pin.length < 6) return;
  if (K.pin !== PIN_CONTOH) { K.pin = ''; K.pinErr = 'PIN salah, coba lagi'; return render(); }
  K.user = STAF.find(s => upper(s) === K.pinUser) || K.pinUser; K.pin = ''; K.view = 'kasir';
  try { sessionStorage.setItem('kasirUser', K.user); } catch (e) { /* abaikan */ }
  render();
}

// ---------- buka kasir ----------
const sapaBuka = () => `<div class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"><div class="bg-white rounded-lg w-[340px] p-6 text-center">
  <span class="w-20 h-20 rounded-2xl bg-brand-soft text-brand mx-auto flex items-center justify-center"><i data-lucide="monitor-check" style="width:40px;height:40px"></i></span>
  <p class="text-[15px] mt-4">Halo ${esc(upper(K.user))}</p><p class="text-[15px]">Sudah siap menerima pesanan?</p>
  <button data-bukakasir class="mt-5 w-full h-11 rounded-md bg-brand text-white text-[14px] font-semibold flex items-center justify-center gap-2"><i data-lucide="store" class="ic-sm"></i>Buka Kasir</button></div></div>`;
function bukaKasir() {
  sideSheet({ title: 'Buka Kasir', actions: hBtn('Buka Kasir', 'data-ok'), body: `<form class="p-5" novalidate>${lblK('Kas Awal')}${fInput('modal', '0', '100000', { prefix: 'Rp', money: true })}
    <p class="text-[12px] text-ink-3 mt-2">Nominal kas awal akan dijadikan sebagai modal kembalian</p></form>`, onMount: sh => sh.el.addEventListener('click', e => {
    if (!e.target.closest('[data-ok]')) return;
    const modal = toNum(formValues(sh.el.querySelector('form')).modal);
    db().shift.push({ id: uid(), buka: new Date().toISOString(), modal, kasir: K.user });
    db().kasKasir.push({ id: uid(), waktu: new Date().toISOString(), jenis: 'masuk', nama: 'Modal Awal', kategori: 'Modal Awal', nominal: modal, catatan: '', kasir: K.user });
    saveDB(); sh.close(); render(); toast('Berhasil!', 'Kasir berhasil dibuka');
  }) });
}

// ---------- header & menu samping ----------
function header(title) {
  const openN = db().pesanan.filter(o => OPEN_STATUS.includes(o.status)).length;
  const back = title ? `<button data-go="kasir" aria-label="Kembali"><i data-lucide="arrow-left"></i></button><div class="leading-tight"><p class="text-[15px] font-semibold">${title}</p><p class="text-[11px] flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-white"></span>Status: Online</p></div>`
    : `<button data-menu aria-label="Menu"><i data-lucide="menu"></i></button><span class="w-8 h-8 rounded-full bg-white text-brand font-extrabold flex items-center justify-center">k</span>
      <div class="leading-tight min-w-0"><p class="text-[13px] font-semibold truncate">by cafe - ${esc(upper(K.user))}</p><p class="text-[11px] inline-flex items-center gap-1 bg-white/20 rounded px-1.5"><span class="w-1.5 h-1.5 rounded-full bg-white"></span>Status: Online</p></div>`;
  return `<header class="h-[52px] shrink-0 bg-brand-bar text-white flex items-stretch">
    <div class="flex-1 flex items-center gap-3 px-4 min-w-0">${back}
      <span class="hidden md:block ml-auto mr-auto text-[24px] font-extrabold tracking-tight">kasirku</span>
      ${title ? '' : `<div class="flex items-center gap-4"><button data-bell aria-label="Notifikasi" class="relative"><i data-lucide="bell"></i></button><button data-go="meja" aria-label="Daftar Meja"><i data-lucide="layout-grid"></i></button><button data-lock aria-label="Kunci layar"><i data-lucide="lock"></i></button></div>`}</div>
    ${title ? '' : `<button data-go="order" class="hidden lg:flex w-[400px] items-center justify-between px-5 bg-black/10 text-[15px] font-semibold"><span class="flex items-center gap-2">Daftar Order${openN ? ` (${openN})<span class="w-2 h-2 rounded-full bg-danger"></span>` : ''}</span><i data-lucide="chevron-right"></i></button>`}</header>`;
}
function menuSamping() {
  const item = (ic, l, attr, on) => `<button ${attr} class="w-full flex items-center gap-3 px-5 py-2.5 text-[14px] ${on ? 'text-brand font-semibold' : ''} hover:bg-page"><i data-lucide="${ic}" class="ic-sm"></i>${l}</button>`;
  const z = (layer += 2);
  const d = nodeOf(`<div class="fixed inset-0 bg-black/40" style="z-index:${z}"><aside class="absolute left-0 inset-y-0 w-[280px] bg-white flex flex-col shadow-xl">
    <div class="p-5"><div class="flex items-center gap-3"><span class="w-9 h-9 rounded-full bg-brand text-white font-extrabold flex items-center justify-center">k</span><p class="text-[15px] font-semibold">by cafe</p></div>
      <p class="text-[12px] text-ink-3 mt-3">by cafe</p><p class="text-[12px] text-ink-3">${esc(upper(K.user))}</p><p class="text-[12px] text-ink-3 flex justify-between">ID Outlet <span class="text-ink">#0001</span></p></div>
    <nav class="flex-1">${item('calculator', 'Kasir', 'data-mgo="kasir"', K.view === 'kasir')}${item('receipt', 'Penjualan', 'data-mgo="penjualan"', K.view === 'penjualan')}${item('clipboard-list', 'Laporan', 'data-mgo="laporan"', K.view === 'laporan')}
      ${item('layout-grid', 'Daftar Meja', 'data-mgo="meja"', K.view === 'meja')}${item('boxes', 'Inventori', 'data-link="index.html#/penjualan/daftar-stok"')}${item('settings', 'Pengaturan', 'data-link="index.html#/pengaturan/daftar-pesan"')}${item('store', 'Tutup Kasir', 'data-tutupkasir')}</nav>
    <div class="border-t border-line">${item('log-out', 'Keluar Kasir', 'data-keluar')}</div></aside></div>`);
  const close = () => { d.remove(); layer -= 2; };
  d.addEventListener('click', e => {
    if (e.target === d) return close();
    const g = e.target.closest('[data-mgo]'); if (g) { close(); return go(g.dataset.mgo); }
    const l = e.target.closest('[data-link]'); if (l) { close(); return window.open(l.dataset.link, '_blank'); }
    if (e.target.closest('[data-tutupkasir]')) { close(); return tutupKasir(); }
    if (e.target.closest('[data-keluar]')) { close(); return keluar(); }
  });
  document.body.appendChild(d); lucide.createIcons();
}
function keluar() { K.user = null; K.pinUser = ''; try { sessionStorage.removeItem('kasirUser'); } catch (e) { /* abaikan */ } render(); }

// ---------- layar kasir (3 kolom) ----------
function cartHtml() {
  const c = cart();
  terapkanPromo(c);
  const t = hitung(c);
  const jenis = c.tipe === 'meja' ? `Meja · ${esc(mejaName(c.meja))}` : c.tipe === 'ojek' ? esc(ojekName(c.ojek)) : 'Bawa Pulang';
  return `<div class="flex items-center justify-between px-4 h-12 border-b border-line text-[14px]">
      <button data-jenis class="text-brand font-semibold flex items-center gap-1">${jenis} <i data-lucide="chevron-down" class="ic-sm"></i></button>
      <button data-pelanggan class="text-brand font-semibold flex items-center gap-1">${c.pelanggan ? `<i data-lucide="user-check" class="ic-sm"></i>${esc(pelName(c.pelanggan))}` : '<i data-lucide="plus" class="ic-sm"></i>Pelanggan'}</button></div>
    <div class="flex-1 overflow-y-auto">${c.items.length ? `<div class="px-4 py-3"><p class="text-[12px] text-ink-3">${c.id || 'Pesanan baru'}</p><p class="text-[12px] text-ink-3 mt-1">Pesanan 1</p></div>
      ${c.items.map((i, n) => `<div class="flex items-start gap-3 px-4 py-2.5 border-t border-line"><span class="text-[13px] w-5">${i.qty}</span>
        <button ${i.bonus ? '' : `data-line="${n}"`} class="flex-1 min-w-0 text-left"><p class="text-[13px] font-medium">${esc(upper(i.nama))}</p>${i.bonus ? `<p class="text-[11px] text-brand">Bonus · ${esc(byId('promo', i.bonus)?.nama || 'Promo')}</p>` : ''}${(i.ekstra || []).map(x => `<p class="text-[11px] text-ink-3">+ ${esc(x.nama)} (${x.qty}x)</p>`).join('')}${i.catatan ? `<p class="text-[11px] text-ink-3">* ${esc(i.catatan)}</p>` : ''}</button>
        <span class="text-[13px] whitespace-nowrap">${rp(i.harga * i.qty)}</span>${i.bonus ? '<span class="w-4"></span>' : `<button data-delline="${n}" class="text-danger" aria-label="Hapus item"><i data-lucide="x-circle" class="ic-sm"></i></button>`}</div>`).join('')}
      ${t.daftarPromo.map(x => `<div class="flex items-center gap-3 px-4 py-2.5 border-t border-line text-[12px]"><span class="flex-1">${esc(upper(promoLabel(x.p)))}</span><span>(${rp(x.nilai)})</span>${x.p.aktivasi === 'manual' ? `<button data-unpromo="${x.p.id}" class="text-ink-4" aria-label="Lepas promo"><i data-lucide="x-circle" class="ic-sm"></i></button>` : '<span class="w-4"></span>'}</div>`).join('')}
      <div class="px-4 py-3 border-t border-line text-[12px] text-ink-3 space-y-1"><div class="flex"><span>Subtotal</span><span class="ml-auto">${rp(t.sub)}</span></div><div class="flex"><span>PB1 10%</span><span class="ml-auto">${rp(t.pajak)}</span></div></div>`
    : '<p class="h-full flex items-center justify-center text-[13px] text-ink-3 px-6 text-center">Silakan masukkan pesanan dari pelanggan</p>'}</div>
    <div class="flex items-center justify-around h-11 border-t border-line"><button data-clear class="text-danger" aria-label="Kosongkan pesanan"><i data-lucide="trash-2" class="ic-sm"></i></button>
      <button data-promo class="text-brand" aria-label="Promo"><i data-lucide="badge-percent" class="ic-sm"></i></button><button data-simpan class="text-brand text-[13px] font-semibold flex items-center gap-1"><i data-lucide="download" class="ic-sm"></i>Simpan</button></div>
    <button data-bayar class="h-14 shrink-0 bg-brand text-white flex items-center px-4 gap-3 text-[18px] font-semibold"><span class="relative">Bayar${t.qty ? `<span class="absolute -top-3 -left-3 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-ink text-[11px] flex items-center justify-center">${t.qty}</span>` : ''}</span><span class="ml-auto">${t.qty ? rp(t.total) : ''}</span><i data-lucide="chevron-right"></i></button>`;
}
function kasirView() {
  const kats = db().kategori.filter(k => k.tampil !== false);
  const special = [['', 'Semua Kategori'], ['fav', 'Favorit'], ['paket', 'Produk Paket']];
  let items = db().produk.filter(p => p.tampil);
  if (K.kat === 'fav') items = items.filter(p => p.favorit);
  else if (K.kat === 'paket') items = [];
  else if (K.kat) items = items.filter(p => p.kategori === K.kat);
  items = items.filter(p => p.nama.toLowerCase().includes(K.q));
  const qtyOf = pid => cart().items.filter(i => i.produk === pid).reduce((s, i) => s + i.qty, 0);
  return `<div class="h-full flex flex-col">${header()}
    <div class="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[170px_1fr] lg:grid-cols-[170px_1fr_400px]">
      <aside class="hidden md:flex flex-col bg-white border-r border-line overflow-y-auto"><div class="flex items-center justify-between px-3 h-12 text-[13px] text-ink-2">Kategori Produk<i data-lucide="sliders-horizontal" class="ic-sm"></i></div>
        ${[...special, ...kats.map(k => [k.id, upper(k.nama)])].map(([id, l]) => `<button data-kat="${id}" class="kat-btn ${K.kat === id ? 'active' : ''}">${esc(l)}</button>`).join('')}</aside>
      <section class="flex flex-col min-h-0 bg-white">
        <div class="flex items-center gap-3 px-3 h-12 border-b border-line"><label class="flex-1 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-mq class="flex-1 min-w-0 outline-none text-ink text-[14px]" placeholder="Cari ..." value="${esc(K.q)}"></label>
          <button data-custom class="text-[13px] flex items-center gap-1.5"><i data-lucide="plus-circle" class="ic-sm"></i>Custom Amount</button><button data-scan aria-label="Pindai barcode"><i data-lucide="scan-line" class="ic-sm"></i></button></div>
        <div class="md:hidden flex gap-2 overflow-x-auto px-3 py-2">${[...special, ...kats.map(k => [k.id, k.nama])].map(([id, l]) => `<button data-kat="${id}" class="chip ${K.kat === id ? 'active' : ''}">${esc(l)}</button>`).join('')}</div>
        <div class="flex-1 overflow-y-auto p-3">${items.length ? `<div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">${items.map(p => {
          const q = qtyOf(p.id), vs = varianAktif(p), h = vs.length ? Math.min(...vs.map(v => v.hargaJual)) : hargaDasar(p, cart());
          return `<button data-prod="${p.id}" class="relative text-left rounded-md border ${q ? 'border-brand' : 'border-line'} overflow-hidden bg-white">
            <div class="relative h-[92px] bg-[#EDEFEF] flex items-center justify-center">${p.foto?.length ? `<img src="${p.foto[0]}" alt="" class="w-full h-full object-cover">` : `<span class="text-[30px] font-medium text-ink-4">${esc(initials(p.nama))}</span>`}
              ${p.monitor ? `<span class="absolute left-1.5 top-1.5 text-[10px] bg-white/90 rounded px-1">${Math.max(0, stokOf('p:' + p.id))}</span>` : ''}
              ${q ? `<span class="absolute inset-0 bg-brand/80 text-white text-[28px] font-semibold flex items-center justify-center">${q}</span>` : ''}</div>
            <div class="p-2"><p class="text-[12px] leading-tight line-clamp-2 min-h-[30px]">${esc(p.nama)}</p><p class="text-[12px] text-ink-3 mt-1">${vs.length ? 'Mulai ' : ''}${rp(h)}${!vs.length && h !== p.hargaJual ? ` <s class="text-[11px]">${rp(p.hargaJual)}</s>` : ''}</p></div></button>`;
        }).join('')}</div>` : '<p class="text-center text-[14px] text-ink-3 py-20">Produk tidak ditemukan</p>'}</div>
        <button data-cartm class="lg:hidden h-14 shrink-0 bg-brand text-white flex items-center px-4 text-[16px] font-semibold">Bayar · ${hitung(cart()).qty} item<span class="ml-auto">${rp(hitung(cart()).total)}</span></button>
      </section>
      <section class="hidden lg:flex flex-col min-h-0 bg-white border-l border-line">${cartHtml()}</section>
    </div></div>${openShift() ? '' : sapaBuka()}`;
}

// ---------- Daftar Meja (URY) ----------
function mejaView() {
  const areas = ['Semua', ...new Set(db().meja.filter(m => m.aktif).map(m => m.area))];
  const legend = [['Kosong', '#10AF8C'], ['Aktif', '#0958D9'], ['Terisi', '#AD6800'], ['Perlu Perhatian', '#CF1322']];
  const mejas = db().meja.filter(m => m.aktif && (K.area === 'Semua' || m.area === K.area));
  const grid = K.mode === 'meja' ? mejas.map(m => {
    const o = mejaOrder(m.id), [txt, bg, fg] = mejaState(m);
    if (!o) return `<div class="card p-3 flex flex-col min-h-[170px]"><div>${pill(txt, bg, fg)}</div><div class="text-center mt-2"><h5 class="text-[20px] font-medium">${esc(m.nama)}</h5><p class="text-[13px] text-ink-4">${esc(m.area)} · ${m.kapasitas} kursi</p></div>
      <div class="mt-auto pt-3 flex justify-center"><button data-openmeja="${m.id}" class="h-10 px-4 rounded-md bg-brand text-white text-[14px] font-semibold flex items-center gap-2">Buka Meja <i data-lucide="arrow-right-circle" class="ic-sm"></i></button></div></div>`;
    return orderCard(o);
  }) : db().pesanan.filter(o => o.tipe !== 'meja' && OPEN_STATUS.includes(o.status)).map(orderCard);
  return `<div class="h-full flex flex-col">${header('Daftar Meja')}<div class="flex-1 overflow-y-auto p-4">
    <div class="flex flex-wrap items-center gap-3"><div class="seg flex border border-[#D6D9D9] rounded-lg overflow-hidden bg-white"><button data-mode="meja" class="${K.mode === 'meja' ? 'active' : ''}">Meja</button><button data-mode="bawa" class="${K.mode === 'bawa' ? 'active' : ''}">Bawa Pulang &amp; Ojek</button></div>
      ${K.mode === 'meja' ? `<div class="flex gap-2 overflow-x-auto">${areas.map(a => `<button data-area="${esc(a)}" class="chip ${K.area === a ? 'active' : ''}">${esc(a)}</button>`).join('')}</div>` : ''}
      <div class="ml-auto hidden lg:flex items-center gap-4 text-[12px] text-ink-3">${legend.map(([l, c]) => `<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${c}"></span>${l}</span>`).join('')}</div></div>
    ${grid.length ? `<div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mt-4">${grid.join('')}</div>` : `<p class="text-center text-[14px] text-ink-3 py-20">${K.mode === 'meja' ? 'Belum ada meja. Tambahkan meja di Dashboard → Pengaturan → Outlet → Pengaturan Denah dan Meja.' : 'Belum ada pesanan bawa pulang yang terbuka'}</p>`}</div></div>`;
}
function orderCard(o) {
  const t = hitung(o), late = minutesSince(o.dibuat) > ATTENTION_MIN;
  return `<div class="card p-3 flex flex-col min-h-[170px]">
    <div class="flex items-start justify-between">${o.tipe === 'meja' ? pill(...(late ? ['Perlu Perhatian', '#FDECEC', '#CF1322'] : ['Terisi', '#FFF7E6', '#AD6800'])) : statusPill(o)}
      <button data-kebab="${o.id}" class="p-1 text-ink-4" aria-label="Aksi"><i data-lucide="more-horizontal"></i></button></div>
    <div class="text-center mt-2"><h5 class="text-[20px] font-medium">${esc(o.tipe === 'meja' ? mejaName(o.meja) : o.id)}</h5>
      <p class="text-[13px] text-ink-4"><span data-elapsed="${o.dibuat}">${elapsed(o.dibuat)}</span> · ${rp(t.total)}</p>
      <p class="text-[12px] text-ink-3 mt-0.5 truncate">${o.pelanggan ? esc(pelName(o.pelanggan)) : `Pelayan: ${esc(o.pelayan)}`}</p></div>
    <div class="mt-auto pt-3 flex justify-center gap-2"><button data-detail="${o.id}" class="h-10 px-4 rounded-md bg-brand text-white text-[14px] font-semibold">Lihat Order</button></div></div>`;
}

// ---------- Daftar Order & Detail Order ----------
function orderView() {
  const kats = [['semua', 'Semua', () => true], ['kasir', 'Kasir', o => o.tipe !== 'meja'], ['meja', 'Meja', o => o.tipe === 'meja'], ['online', 'Order Online', () => false], ['faktur', 'Faktur Penjualan', o => o.status === 'tagih']];
  const open = db().pesanan.filter(o => OPEN_STATUS.includes(o.status));
  const f = kats.find(k => k[0] === K.okat)[2];
  const list = open.filter(f).filter(o => (o.id + orderPlace(o) + pelName(o.pelanggan)).toLowerCase().includes(K.oq)).sort((a, b) => (b.dibuat > a.dibuat ? 1 : -1));
  return `<div class="h-full flex flex-col"><header class="h-[52px] shrink-0 bg-brand-bar text-white flex items-center gap-3 px-4"><button data-go="kasir" aria-label="Kembali"><i data-lucide="arrow-left"></i></button><p class="text-[15px] font-semibold">Daftar Order</p>
      <label class="ml-auto bg-white/20 rounded-md h-8 px-2 flex items-center gap-2 w-[220px]"><i data-lucide="search" class="ic-sm"></i><input data-oq class="flex-1 min-w-0 bg-transparent outline-none placeholder:text-white/80 text-[13px]" placeholder="Cari..." value="${esc(K.oq)}"></label></header>
    <div class="flex-1 min-h-0 grid md:grid-cols-[200px_1fr]"><aside class="bg-white border-r border-line"><div class="flex items-center justify-between px-3 h-12 text-[13px] text-ink-2">Kategori Order<i data-lucide="sliders-horizontal" class="ic-sm"></i></div>
        ${kats.map(([k, l, fn]) => `<button data-okat="${k}" class="kat-btn ${K.okat === k ? 'active' : ''}">${l} (${open.filter(fn).length})</button>`).join('')}</aside>
      <section class="bg-white overflow-y-auto">${list.length ? `<table class="tbl w-full"><thead><tr><th>Jenis</th><th>Nama</th><th>No Transaksi</th><th>Tanggal</th><th>Status</th><th class="text-right">Tagihan</th></tr></thead><tbody>
        ${list.map(o => `<tr data-detail="${o.id}" class="cursor-pointer hover:bg-page"><td>${esc(jenisLabel(o))}</td><td>${esc(o.pelanggan ? pelName(o.pelanggan) : orderPlace(o))}</td><td>${o.id}</td><td>${nowText(new Date(o.dibuat))}</td><td>${statusPill(o)}</td><td class="text-right">${rp(sisaOf(o))}</td></tr>`).join('')}</tbody></table>`
        : '<div class="flex flex-col items-center justify-center py-24 text-center"><i data-lucide="file-plus-2" style="width:56px;height:56px" class="text-brand"></i><p class="text-[14px] font-semibold mt-4">Belum Ada Pesanan</p><p class="text-[13px] text-ink-3 mt-1">Saatnya tingkatkan promosimu!</p></div>'}</section></div></div>`;
}
function detailView() {
  const o = db().pesanan.find(x => x.id === K.sel);
  if (!o) { K.view = 'order'; return orderView(); }
  const t = hitung(o), open = OPEN_STATUS.includes(o.status);
  const kv = (k, v) => `<div class="flex py-1.5 text-[13px]"><span class="text-ink-3">${k}</span><span class="ml-auto">${v}</span></div>`;
  return `<div class="h-full flex flex-col"><header class="h-[52px] shrink-0 bg-brand-bar text-white flex items-center gap-3 px-4"><button data-go="${K.backTo || 'order'}" aria-label="Kembali"><i data-lucide="arrow-left"></i></button><p class="text-[15px] font-semibold">Detail Order</p>
      <button data-cetak="${o.id}" class="ml-auto text-[14px] font-semibold">Cetak</button></header>
    <div class="flex-1 min-h-0 grid lg:grid-cols-[1fr_400px] bg-white">
      <section class="overflow-y-auto p-5 lg:border-r border-line"><div class="flex items-center"><p class="text-[13px] font-semibold">PESANAN</p>${open ? '<button data-tambah class="ml-auto text-brand text-[13px] font-semibold flex items-center gap-1"><i data-lucide="plus" class="ic-sm"></i>Tambah Pesanan</button>' : ''}</div>
        <p class="text-[12px] text-ink-3 mt-4">Pesanan 1</p>
        ${o.items.map(i => `<div class="flex gap-4 py-3 border-b border-line text-[14px]"><span>${i.qty}</span><div class="flex-1"><p class="font-medium">${esc(upper(i.nama))}</p>${(i.ekstra || []).map(x => `<p class="text-[12px] text-ink-3">+ ${esc(x.nama)} (${x.qty}x)</p>`).join('')}${i.catatan ? `<p class="text-[12px] text-ink-3">* ${esc(i.catatan)}</p>` : ''}${i.dibayarQty ? `<p class="text-[12px] text-brand">${i.dibayarQty} sudah dibayar</p>` : ''}</div><span>${rp(i.harga * i.qty)}</span></div>`).join('')}
        <p class="text-[13px] font-semibold mt-8">RINCIAN PEMBAYARAN</p>
        <div class="mt-2">${kv(`Subtotal ${o.items.length} Produk`, rp(t.sub))}${t.daftarPromo.map(x => kv(esc(upper(promoLabel(x.p))), `(${rp(x.nilai)})`)).join('')}${kv('PB1 10%', rp(t.pajak))}<div class="flex py-2 text-[14px] font-semibold border-t border-line mt-1"><span>Total</span><span class="ml-auto">${rp(t.total)}</span></div>
          ${(o.pembayaran || []).map((p, n) => kv(`Pembayaran ${n + 1} · ${esc(p.metode)}`, rp(p.jumlah))).join('')}${dibayar(o) ? `<div class="flex py-2 text-[14px] font-semibold text-danger"><span>Sisa Tagihan</span><span class="ml-auto">${rp(sisaOf(o))}</span></div>` : ''}</div></section>
      <aside class="flex flex-col p-5"><div class="text-center"><p class="text-[30px] font-semibold">${rp(o.status === 'lunas' ? t.total : sisaOf(o))}</p><p class="text-[13px] text-ink-3">${nowText(new Date(o.dibuat))}</p><p class="text-[13px] text-ink-3">${esc(jenisLabel(o))}${o.tipe === 'meja' ? ' · ' + esc(mejaName(o.meja)) : ''}</p><p class="text-[13px] text-ink-3">${o.id}</p><div class="mt-2">${statusPill(o)}</div></div>
        <div class="mt-6">${kv('Kasir', esc(upper(o.kasir)))}${kv('Pelayan', esc(o.pelayan))}${kv('No Urut', db().pesanan.length - db().pesanan.indexOf(o))}${kv('Pelanggan', esc(pelName(o.pelanggan)) || '-')}${o.alasanBatal ? kv('Alasan Void', esc(o.alasanBatal)) : ''}</div>
        ${open ? `<div class="mt-auto pt-6 grid grid-cols-[auto_1fr_1fr] gap-3"><button data-kebab="${o.id}" class="w-11 h-11 rounded-md border border-[#D6D9D9] flex items-center justify-center" aria-label="Aksi lain"><i data-lucide="more-horizontal"></i></button>
          <button data-void="${o.id}" class="h-11 rounded-md border border-danger text-danger text-[14px] font-semibold">Batalkan</button><button data-bayaro="${o.id}" class="h-11 rounded-md bg-brand text-white text-[14px] font-semibold">Bayar</button></div>` : ''}</aside></div></div>`;
}
function voidOrder(o) {
  let metode = 'PIN', alasan = '';
  const body = () => `<form class="p-5 space-y-4" novalidate><div>${lblK('No Void Order')}<input class="fin" value="${o.id}" disabled></div>
    <div class="grid sm:grid-cols-[1fr_1fr_1fr] gap-3"><div>${lblK('Otorisasi Oleh', 1)}${fSelect('oleh', STAF.map(upper), '', 'Pilih', { req: 'Mohon pilih otorisasi' })}</div>
      <div>${lblK('Metode Otorisasi')}<div class="seg flex border border-[#D6D9D9] rounded-md overflow-hidden h-10">${['PIN', 'Kode'].map(m => `<button type="button" data-mo="${m}" class="flex-1 ${metode === m ? 'active' : ''}">${m}</button>`).join('')}</div></div>
      <div>${lblK(metode, 1)}${fInput('pin', metode === 'PIN' ? 'Contoh: 1234' : 'Kode otorisasi', '', { req: `Mohon isi ${metode}` })}</div></div>
    <div>${lblK('Alasan Pembatalan', 1)}<div class="grid grid-cols-3 gap-3">${['Batal Pesan', 'Salah Proses', 'Lainnya'].map(a => `<button type="button" data-al="${a}" class="h-10 rounded-md border text-[13px] ${alasan === a ? 'border-brand bg-brand-soft text-brand-dark font-semibold' : 'border-[#D6D9D9]'}">${a}</button>`).join('')}</div></div>
    <div>${lblK('Catatan <span class="text-ink-4 font-normal">opsional</span>')}<textarea name="catatan" rows="3" class="fin" placeholder="Contoh: Pengembalian untuk pesanan ABC"></textarea></div></form>`;
  sideSheet({ title: `Void - ${rp(hitung(o).total)}`, width: 'w-[640px]', body: body(), actions: hBtn('Proses', 'data-ok'), onMount: sh => sh.el.addEventListener('click', e => {
    const m = e.target.closest('[data-mo]'); if (m) { metode = m.dataset.mo; return sh.setBody(body()); }
    const a = e.target.closest('[data-al]'); if (a) { alasan = a.dataset.al; return sh.setBody(body()); }
    if (!e.target.closest('[data-ok]')) return;
    const f = sh.el.querySelector('form');
    if (!validate(f)) return;
    const v = formValues(f);
    if (!alasan) return toast('Gagal!', 'Mohon pilih alasan pembatalan', 'error');
    if (metode === 'PIN' && v.pin !== PIN_CONTOH) return toast('Gagal!', 'PIN otorisasi salah', 'error');
    Object.assign(o, { status: 'batal', alasanBatal: alasan + (v.catatan ? ` - ${v.catatan}` : ''), voidOleh: v.oleh });
    saveDB(); sh.close(); if (K.cart?.id === o.id) K.cart = null;
    K.view = 'order'; render(); toast('Berhasil!', `Order <b>${o.id}</b> berhasil di-void`);
  }) });
}
async function pindahMeja(o) {
  const kosong = db().meja.filter(m => m.aktif && !mejaOrder(m.id));
  if (!kosong.length) return toast('Info', 'Tidak ada meja kosong');
  const v = await promptModal({ title: 'Pindah Meja', ok: 'Pindahkan',
    body: `${lblK('Meja Saat Ini')}<input class="fin mb-4" value="${esc(o.tipe === 'meja' ? mejaName(o.meja) : 'Bawa Pulang')}" disabled>${lblK('Meja Baru', 1)}${fSelect('meja', kosong.map(m => [m.id, `${m.nama} · ${m.area}`]), '', 'Pilih Meja', { req: 'Mohon pilih meja baru' })}` });
  if (!v) return;
  const asal = orderPlace(o); o.tipe = 'meja'; o.meja = v.meja; saveDB();
  toast('Berhasil!', `Pesanan dipindah dari <b>${esc(asal)}</b> ke <b>${esc(mejaName(v.meja))}</b>`); render();
}
async function pindahPelayan(o) {
  const v = await promptModal({ title: 'Pindah Pelayan', ok: 'Pindahkan',
    body: `${lblK('Pelayan Saat Ini')}<input class="fin mb-4" value="${esc(o.pelayan)}" disabled>${lblK('Pelayan Baru', 1)}${fSelect('pelayan', STAF.filter(s => s !== o.pelayan), '', 'Pilih Pelayan', { req: 'Mohon pilih pelayan' })}` });
  if (!v) return;
  o.pelayan = v.pelayan; saveDB(); toast('Berhasil!', `Pelayan <b>${o.id}</b> diganti ke <b>${esc(v.pelayan)}</b>`); render();
}
const aksiOrder = (anchor, o) => rowMenu(anchor, [['Pindah Meja', () => pindahMeja(o)], ['Pindah Pelayan', () => pindahPelayan(o)],
  ['Cetak Tagihan', () => { o.status = 'tagih'; o.dicetak = true; saveDB(); showStruk(o, 'Tagihan'); render(); }], ['Batalkan Order', () => voidOrder(o), 'danger']]);

// ---------- Pembayaran (termasuk Pisah Bayar) ----------
const METODE_BAYAR = ['Tunai', 'Nontunai', 'Transfer', 'QRIS', 'Komplimen', 'Deposit'];
const NONTUNAI = ['Debit BCA', 'Debit Mandiri', 'Kartu Kredit'];
const TRANSFER = ['Transfer BCA', 'Transfer BRI', 'Transfer Mandiri'];
function mulaiBayar(o) {
  K.pay = { id: o.id, mode: 'penuh', orang: 2, pilih: {}, metode: 'Tunai', opsi: '', terima: 0, catatan: o.catatanBayar || '' };
  K.view = 'bayar'; render();
}
// nominal yang ditagih pada pembayaran kali ini
function tagihanKini(o) {
  const p = K.pay, sisa = sisaOf(o), t = hitung(o);
  if (p.mode === 'jumlah') {
    // sisa saat pisah dipilih dibagi rata; bagian terakhir mengambil sisa pembulatan
    const ke = (o.pembayaran || []).length - p.mulai;
    return ke >= p.orang - 1 ? sisa : Math.min(sisa, Math.ceil(p.basis / p.orang));
  }
  if (p.mode === 'produk') {
    const nilai = Object.entries(p.pilih).reduce((s, [i, q]) => s + o.items[+i].harga * q, 0);
    return Math.min(sisa, Math.round(nilai * (t.sub ? t.total / t.sub : 1)));
  }
  return sisa;
}
function bayarView() {
  const o = db().pesanan.find(x => x.id === K.pay.id), p = K.pay, t = hitung(o), due = tagihanKini(o);
  const kembali = p.metode === 'Tunai' ? Math.max(0, p.terima - due) : 0;
  const opsi = p.metode === 'Tunai' ? [['pas', 'Uang Pas'], ...[50000, 100000, 200000].filter(v => v > due).slice(0, 2).map(v => [String(v), rp(v)]), ['lain', 'Lainnya']]
    : p.metode === 'Nontunai' ? NONTUNAI.map(v => [v, v]) : p.metode === 'Transfer' ? TRANSFER.map(v => [v, v])
    : p.metode === 'QRIS' ? [['QRIS Statis', 'QRIS Statis'], ['QRIS Dinamis', 'QRIS Dinamis']] : p.metode === 'Komplimen' ? [['Komplimen', 'Komplimen']]
    : [['Deposit', `Saldo Deposit ${rp(byId('pelanggan', o.pelanggan)?.deposit || 0)}`]];
  const siap = due > 0 && (p.metode === 'Tunai' ? p.terima >= due : !!p.opsi);
  const sisaSetelah = sisaOf(o) - due;
  const pisahInfo = p.mode === 'jumlah' ? `Pisah Jumlah · bagian ${(o.pembayaran || []).length - p.mulai + 1} dari ${p.orang} orang`
    : p.mode === 'produk' ? 'Pisah Produk · pilih item yang dibayar di kanan' : '';
  return `<div class="h-full flex flex-col"><header class="h-[52px] shrink-0 bg-brand-bar text-white flex items-center gap-3 px-4"><button data-batalbayar aria-label="Kembali"><i data-lucide="arrow-left"></i></button>
      <div class="leading-tight"><p class="text-[15px] font-semibold">Pembayaran</p><p class="text-[11px]">• Status: Online</p></div><span class="mx-auto text-[24px] font-extrabold tracking-tight hidden md:block">kasirku</span></header>
    <div class="flex-1 min-h-0 grid lg:grid-cols-[1fr_400px] bg-white">
      <section class="flex flex-col min-h-0 lg:border-r border-line">
        <div class="grid grid-cols-3 text-center py-4 border-b border-line"><div><p class="text-[12px] text-ink-3">Total Tagihan</p><p class="text-[22px] font-semibold"><span class="text-[12px]">Rp</span> ${Math.round(t.total).toLocaleString('id-ID')}</p></div>
          <div><p class="text-[12px] text-ink-3">${p.mode === 'penuh' ? 'Sisa Tagihan' : 'Tagihan Bagian Ini'}</p><p class="text-[22px] font-semibold text-danger"><span class="text-[12px]">Rp</span> ${Math.round(p.mode === 'penuh' ? sisaOf(o) : due).toLocaleString('id-ID')}</p></div>
          <div><p class="text-[12px] text-ink-3">Kembalian</p><p class="text-[22px] font-semibold text-[#1677FF]"><span class="text-[12px]">Rp</span> ${kembali.toLocaleString('id-ID')}</p></div></div>
        <div class="grid grid-cols-3 border-b border-line text-[13px] text-brand font-semibold"><button data-pisah class="h-11 flex items-center justify-center gap-2 ${p.mode !== 'penuh' ? 'bg-brand-soft' : ''}"><i data-lucide="split" class="ic-sm"></i>Pisah Bayar</button>
          <button data-invoice class="h-11 flex items-center justify-center gap-2"><i data-lucide="file-text" class="ic-sm"></i>Jadikan Invoice</button><button data-catbayar class="h-11 flex items-center justify-center gap-2"><i data-lucide="pencil" class="ic-sm"></i>Catatan</button></div>
        ${pisahInfo ? `<div class="px-4 py-2 bg-[#E6F4FF] text-[13px] text-[#0958D9] flex items-center gap-2"><i data-lucide="info" class="ic-sm"></i>${pisahInfo}<button data-pisahoff class="ml-auto font-semibold">Batal pisah</button></div>` : ''}
        <div class="flex-1 min-h-0 grid grid-cols-[200px_1fr]"><div class="border-r border-line overflow-y-auto"><div class="flex items-center justify-between px-3 h-11 text-[13px] text-ink-2">Metode Pembayaran<i data-lucide="sliders-horizontal" class="ic-sm"></i></div>
            ${METODE_BAYAR.map(m => `<button data-metode="${m}" class="kat-btn ${p.metode === m ? 'active' : ''}">${m}</button>`).join('')}</div>
          <div class="p-4 overflow-y-auto"><div class="grid grid-cols-2 gap-3">${opsi.map(([v, l]) => `<button data-opsi="${v}" class="h-12 rounded-md border text-[14px] text-left px-4 ${p.opsi === v ? 'border-brand bg-brand-soft font-semibold' : 'border-[#D6D9D9]'}">${l}</button>`).join('')}</div>
            ${p.metode === 'Tunai' && p.opsi === 'lain' ? `<div class="mt-4 max-w-[320px]">${lblK('Uang Diterima')}<div class="fin flex items-center gap-3"><span class="text-ink-3">Rp</span><input data-terima data-money inputmode="numeric" class="flex-1 outline-none" value="${p.terima ? p.terima.toLocaleString('id-ID') : ''}" placeholder="0"></div></div>` : ''}
            ${p.metode === 'Deposit' && (byId('pelanggan', o.pelanggan)?.deposit || 0) < due ? '<p class="text-[13px] text-danger mt-3">Saldo deposit pelanggan tidak cukup atau pelanggan belum dipilih</p>' : ''}</div></div>
        <div class="flex items-center gap-3 px-4 h-12 border-t border-line text-[14px]"><span>Total ${t.qty} Produk</span><span class="ml-auto font-semibold">${rp(due)}</span></div>
        <button data-proses ${siap ? '' : 'disabled'} class="h-14 shrink-0 text-[16px] font-semibold flex items-center px-4 ${siap ? 'bg-brand text-white' : 'bg-[#EDEFEF] text-[#A0A6A6]'}">Proses Bayar${sisaSetelah > 0 && due > 0 ? ` <span class="text-[12px] font-normal ml-2">(sisa ${rp(sisaSetelah)})</span>` : ''}<i data-lucide="chevron-right" class="ml-auto"></i></button>
      </section>
      <aside class="flex flex-col min-h-0"><div class="flex items-center justify-between px-4 h-11 text-[12px] text-ink-3 border-b border-line"><span class="flex items-center gap-1"><i data-lucide="user" class="ic-sm"></i>${esc(pelName(o.pelanggan) || '-')}</span><span>${o.id}</span></div>
        <div class="flex-1 overflow-y-auto"><p class="text-[12px] text-ink-3 px-4 pt-3">Pesanan 1</p>
          ${o.items.map((i, n) => { const sisaQ = i.qty - (i.dibayarQty || 0), q = p.pilih[n] || 0; return `<div class="flex items-start gap-3 px-4 py-2.5 border-b border-line text-[13px]"><span class="w-5">${i.qty}</span><div class="flex-1 min-w-0"><p class="font-medium">${esc(upper(i.nama))}</p>${(i.ekstra || []).map(x => `<p class="text-[11px] text-ink-3">+ ${esc(x.nama)} (${x.qty}x)</p>`).join('')}${i.dibayarQty ? `<p class="text-[11px] text-brand">${i.dibayarQty} sudah dibayar</p>` : ''}
            ${p.mode === 'produk' && sisaQ > 0 ? `<div class="flex items-center gap-2 mt-2"><span class="text-[11px] text-ink-3">Bayar sekarang:</span><button data-pq2="${n}" data-d="-1" class="w-7 h-7 rounded border border-[#D6D9D9]">−</button><span class="w-6 text-center font-semibold">${q}</span><button data-pq2="${n}" data-d="1" class="w-7 h-7 rounded border border-[#D6D9D9]">+</button><span class="text-[11px] text-ink-4">/ ${sisaQ}</span></div>` : ''}</div><span>${rp(i.harga * i.qty)}</span></div>`; }).join('')}
          ${t.daftarPromo.map(x => `<div class="flex px-4 py-2.5 border-b border-line text-[12px]"><span class="flex-1">${esc(upper(promoLabel(x.p)))}</span><span>(${rp(x.nilai)})</span></div>`).join('')}
          <div class="px-4 py-3 text-[12px] text-ink-3 space-y-1"><div class="flex"><span>PB1 10%</span><span class="ml-auto">${rp(t.pajak)}</span></div>${(o.pembayaran || []).map((x, n) => `<div class="flex text-brand"><span>Pembayaran ${n + 1} · ${esc(x.metode)}</span><span class="ml-auto">${rp(x.jumlah)}</span></div>`).join('')}</div></div>
        <div class="flex items-center gap-3 px-4 h-12 border-t border-line text-[14px]"><span>Total ${t.qty} Produk</span><span class="ml-auto font-semibold">${rp(t.total)}</span></div></aside></div></div>`;
}
function pilihPisah(anchor) {
  const o = db().pesanan.find(x => x.id === K.pay.id);
  rowMenu(anchor, [
    ['Pisah Jumlah', async () => {
      const v = await promptModal({ title: 'Pisah Jumlah', ok: 'Terapkan', body: `<p class="text-[14px] text-ink-2 mb-4">Tagihan ${rp(sisaOf(o))} dibagi rata. Tiap orang membayar bagiannya satu per satu.</p>${lblK('Jumlah orang', 1)}${fInput('orang', 'Contoh: 3', '2', { req: 'Mohon isi jumlah orang', num: true })}` });
      if (!v) return;
      const n = Math.max(2, Math.min(20, parseInt(v.orang, 10) || 2));
      Object.assign(K.pay, { mode: 'jumlah', orang: n, mulai: (o.pembayaran || []).length, basis: sisaOf(o), pilih: {}, opsi: '', terima: 0 }); render();
    }],
    ['Pisah Produk', () => { Object.assign(K.pay, { mode: 'produk', pilih: {}, opsi: '', terima: 0 }); render(); }]
  ]);
}
function prosesBayar() {
  const o = db().pesanan.find(x => x.id === K.pay.id), p = K.pay, due = tagihanKini(o);
  if (p.metode === 'QRIS' && p.opsi === 'QRIS Dinamis') return qrisDinamis();
  if (p.metode === 'Deposit') {
    const c = byId('pelanggan', o.pelanggan);
    if (!c || (c.deposit || 0) < due) return toast('Gagal!', 'Saldo deposit tidak cukup', 'error');
    c.deposit -= due;
  }
  const diterima = p.metode === 'Tunai' ? p.terima : due;
  const bayar = { metode: p.metode === 'Tunai' || p.metode === 'Komplimen' || p.metode === 'Deposit' ? p.metode : p.opsi, jumlah: due, diterima, kembalian: Math.max(0, diterima - due), waktu: new Date().toISOString(), pisah: p.mode === 'penuh' ? '' : p.mode, kasir: K.user };
  if (p.mode === 'produk') { bayar.items = Object.entries(p.pilih).filter(([, q]) => q).map(([i, q]) => ({ idx: +i, qty: q })); bayar.items.forEach(x => { o.items[x.idx].dibayarQty = (o.items[x.idx].dibayarQty || 0) + x.qty; }); }
  o.pembayaran = [...(o.pembayaran || []), bayar];
  if (sisaOf(o) <= 0) {
    o.status = 'lunas'; o.dicetak = true;
    o.bayar = { metode: o.pembayaran.length > 1 ? 'Pisah Bayar' : bayar.metode, diterima: o.pembayaran.reduce((s, x) => s + x.diterima, 0), kembalian: o.pembayaran.reduce((s, x) => s + x.kembalian, 0), waktu: bayar.waktu };
    catatTerjual(o);
    if (o.pelanggan) { const c = byId('pelanggan', o.pelanggan); if (c) c.poin = (c.poin || 0) + Math.floor(hitung(o).total / 10000); }
    saveDB(); if (K.cart?.id === o.id) K.cart = null;
    K.view = 'sukses'; K.sel = o.id; K.lastPay = bayar; return render();
  }
  // masih ada sisa: lanjut bagian berikutnya
  saveDB();
  Object.assign(K.pay, { pilih: {}, opsi: '', terima: 0 });
  render();
  toast('Berhasil!', `Pembayaran ${o.pembayaran.length} (${esc(bayar.metode)}) ${rp(due)} diterima${bayar.kembalian ? `, kembalian ${rp(bayar.kembalian)}` : ''}. Sisa tagihan ${rp(sisaOf(o))}`);
}
function qrisDinamis() {
  sideSheet({ title: 'QRIS Dinamis', actions: hBtn('Cek Pembayaran', 'data-ok'), body: `<div class="flex flex-col items-center justify-center text-center py-24 px-6"><i data-lucide="wallet-cards" style="width:72px;height:72px" class="text-brand"></i>
    <p class="text-[15px] font-semibold mt-6">QRIS Dinamis Belum Aktif</p><p class="text-[13px] text-ink-3 mt-1">Aktifkan QRIS Dinamis kamu terlebih dahulu, ya!</p></div>`,
  onMount: sh => sh.el.addEventListener('click', e => { if (e.target.closest('[data-ok]')) toast('Info', 'QRIS Dinamis belum aktif. Gunakan QRIS Statis.'); }) });
}
function suksesView() {
  const o = db().pesanan.find(x => x.id === K.sel), t = hitung(o);
  return `<div class="h-full flex items-center justify-center p-4 bg-brand"><div class="bg-white rounded-lg w-[480px] max-w-full overflow-hidden">
    <div class="bg-brand-soft text-center py-3 text-[24px] font-extrabold tracking-tight text-brand">kasirku</div>
    <div class="p-6"><div class="text-center"><i data-lucide="check-circle-2" class="mx-auto text-white" style="width:28px;height:28px;fill:#04C99E"></i><p class="text-[18px] font-semibold mt-2">Sukses!</p></div>
      <div class="mt-5 space-y-2 text-[14px]"><div class="flex"><span>Total Tagihan</span><span class="ml-auto">${rp(t.total)}</span></div>
        ${o.pembayaran.map((p, n) => `<div class="flex"><span>${o.pembayaran.length > 1 ? `Pembayaran ${n + 1} · ` : ''}${esc(p.metode)}</span><span class="ml-auto">${rp(p.diterima)}</span></div>`).join('')}
        <div class="flex pt-2"><span>Kembalian</span><span class="ml-auto">${rp(o.pembayaran.reduce((s, p) => s + p.kembalian, 0))}</span></div></div>
      <div class="grid grid-cols-2 gap-3 mt-10"><button data-bagikan class="h-10 rounded-md border border-brand text-brand text-[14px] font-semibold flex items-center justify-center gap-2"><i data-lucide="share-2" class="ic-sm"></i>Bagikan Struk</button>
        <button data-cetak="${o.id}" class="h-10 rounded-md border border-brand text-brand text-[14px] font-semibold flex items-center justify-center gap-2"><i data-lucide="printer" class="ic-sm"></i>Cetak</button></div>
      <button data-selesai class="mt-3 w-full h-11 rounded-md bg-brand text-white text-[14px] font-semibold">Selesai</button></div></div></div>`;
}
async function bagikanStruk() {
  const o = db().pesanan.find(x => x.id === K.sel);
  let via = 'WhatsApp';
  const c = byId('pelanggan', o.pelanggan);
  const v = await promptModal({ title: 'Bagikan Struk', ok: 'Kirim', body: `<div class="seg flex border border-[#D6D9D9] rounded-md overflow-hidden mb-4">${['WhatsApp', 'SMS', 'Email'].map(m => `<button type="button" data-via="${m}" class="flex-1 ${m === via ? 'active' : ''}">${m}</button>`).join('')}</div>
    ${fInput('tujuan', 'Contoh: 081234567890', c ? '0' + String(c.telepon || '').replace(/^(\+?62|0)/, '') : '', { req: 'Mohon isi tujuan' })}`,
    onMount: d => d.addEventListener('click', e => { const b = e.target.closest('[data-via]'); if (!b) return; via = b.dataset.via; d.querySelectorAll('[data-via]').forEach(x => x.classList.toggle('active', x === b)); d.querySelector('[name=tujuan]').placeholder = via === 'Email' ? 'Contoh: nama@email.com' : 'Contoh: 081234567890'; }) });
  if (v) toast('Berhasil!', `Struk ${o.id} dicatat untuk dikirim lewat ${via} ke <b>${esc(v.tujuan)}</b> (prototipe tidak mengirim pesan sungguhan)`);
}

// ---------- Penjualan & Laporan (menu samping) ----------
const shiftOrders = () => { const s = openShift(); return db().pesanan.filter(o => o.status === 'lunas' && o.bayar && (!s || o.bayar.waktu >= s.buka)); };
function penjualanView() {
  const list = shiftOrders().filter(o => (o.id + pelName(o.pelanggan)).toLowerCase().includes(K.oq)).sort((a, b) => (b.bayar.waktu > a.bayar.waktu ? 1 : -1));
  const total = list.reduce((s, o) => s + hitung(o).total, 0);
  return `<div class="h-full flex flex-col"><header class="h-[52px] shrink-0 bg-brand-bar text-white flex items-center gap-3 px-4"><button data-menu aria-label="Menu"><i data-lucide="menu"></i></button><div class="leading-tight"><p class="text-[15px] font-semibold">Penjualan</p><p class="text-[11px]">• Status: Online</p></div>
      <label class="ml-auto bg-white/20 rounded-md h-8 px-2 flex items-center gap-2 w-[220px]"><i data-lucide="search" class="ic-sm"></i><input data-oq class="flex-1 min-w-0 bg-transparent outline-none placeholder:text-white/80 text-[13px]" placeholder="Cari..." value="${esc(K.oq)}"></label></header>
    <div class="flex-1 overflow-y-auto bg-white"><div class="grid grid-cols-2 gap-4 p-4"><div class="card px-4 py-3 border-b-2 border-brand"><p class="text-[12px] text-ink-3">Total Penjualan</p><p class="text-[18px] font-semibold">${rp(total)}</p></div><div class="card px-4 py-3 border-b-2 border-[#1677FF]"><p class="text-[12px] text-ink-3">Total Transaksi</p><p class="text-[18px] font-semibold">${list.length}</p></div></div>
      ${list.length ? `<table class="tbl w-full"><thead><tr><th>Jenis</th><th>Nama</th><th>No Transaksi</th><th>Waktu</th><th>Kasir</th><th>Pembayaran</th><th class="text-right">Total</th></tr></thead><tbody>${list.map(o => `<tr data-detailp="${o.id}" class="cursor-pointer hover:bg-page"><td>${esc(jenisLabel(o))}</td><td>${esc(pelName(o.pelanggan) || orderPlace(o))}</td><td>${o.id}</td><td>${nowText(new Date(o.bayar.waktu))}</td><td>${esc(upper(o.kasir))}</td><td>${esc(o.bayar.metode)}</td><td class="text-right">${rp(hitung(o).total)}</td></tr>`).join('')}</tbody></table>`
        : '<div class="flex flex-col items-center py-24 text-center"><i data-lucide="shopping-cart" style="width:56px;height:56px" class="text-brand"></i><p class="text-[14px] font-semibold mt-4">Belum Ada Penjualan</p><p class="text-[13px] text-ink-3 mt-1">Tetap semangat dan mulai buat penjualan sekarang</p></div>'}</div></div>`;
}
const LAPORAN = [['ringkasan', 'Ringkasan Penjualan'], ['teratas', '10 Laporan Teratas'], ['void', 'Void'], ['kas', 'Kas Kasir'], ['produk', 'Produk Terjual'], ['bayar', 'Jenis Bayar']];
function laporanView() {
  const orders = shiftOrders(), s = openShift();
  const kartu = list => `<div class="grid grid-cols-2 lg:grid-cols-5 gap-3 p-4">${list.map(([l, v, c]) => `<div class="card px-4 py-3 border-b-2" style="border-color:${c}"><p class="text-[12px] text-ink-3">${l}</p><p class="text-[16px] font-semibold">${v}</p></div>`).join('')}</div>`;
  const tbl = (cols, rows) => rows.length ? `<table class="tbl w-full"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="text-center text-[14px] text-ink-3 py-16">Belum ada data</p>';
  const terjual = {};
  orders.forEach(o => o.items.forEach(i => { terjual[i.nama] = (terjual[i.nama] || 0) + i.qty; }));
  let isi = '';
  if (K.lap === 'ringkasan') {
    const t = orders.reduce((a, o) => { const h = hitung(o); return [a[0] + h.sub, a[1] + h.diskon, a[2] + h.pajak, a[3] + h.total]; }, [0, 0, 0, 0]);
    isi = kartu([['Penjualan Kotor', rp(t[0]), '#3ED0A8'], ['Diskon', rp(t[1]), '#1890FF'], ['Pajak', rp(t[2]), '#7B2FD0'], ['Penjualan Bersih', rp(t[3]), '#F5813F'], ['Transaksi', orders.length, '#6CB8F0']]);
  } else if (K.lap === 'teratas' || K.lap === 'produk') {
    isi = tbl(['Produk', 'Jumlah Terjual'], Object.entries(terjual).sort((a, b) => b[1] - a[1]).slice(0, K.lap === 'teratas' ? 10 : 999).map(([n, q]) => [esc(n), q]));
  } else if (K.lap === 'void') {
    isi = tbl(['No Transaksi', 'Alasan', 'Otorisasi', 'Total'], db().pesanan.filter(o => o.status === 'batal' && (!s || o.dibuat >= s.buka)).map(o => [o.id, esc(o.alasanBatal || '-'), esc(o.voidOleh || '-'), rp(hitung(o).total)]));
  } else if (K.lap === 'bayar') {
    const per = {};
    orders.forEach(o => (o.pembayaran || []).forEach(p => { per[p.metode] = (per[p.metode] || 0) + p.jumlah; }));
    isi = tbl(['Jenis Bayar', 'Jumlah'], Object.entries(per).map(([m, v]) => [esc(m), rp(v)]));
  } else {
    const kas = db().kasKasir.filter(k => !s || k.waktu >= s.buka);
    const masuk = kas.filter(k => k.jenis === 'masuk').reduce((n, k) => n + k.nominal, 0), keluar = kas.filter(k => k.jenis === 'keluar').reduce((n, k) => n + k.nominal, 0);
    const jual = orders.reduce((n, o) => n + (o.pembayaran || []).filter(p => p.metode === 'Tunai').reduce((m, p) => m + p.jumlah, 0), 0);
    isi = kartu([['Pemasukan', rp(masuk), '#3ED0A8'], ['Pengeluaran', rp(keluar), '#7B2FD0'], ['Total Refund', rp(0), '#E5333F'], ['Total Kas Kasir', rp(masuk - keluar + jual), '#1890FF'], ['Total Penjualan', rp(jual), '#E5333F']])
      + tbl(['Nama', 'Jenis Transaksi', 'Kategori', 'Jumlah'], kas.map(k => [esc(k.nama), k.jenis === 'masuk' ? 'Uang Masuk' : 'Uang Keluar', esc(k.kategori), rp(k.nominal)]));
  }
  return `<div class="h-full flex flex-col"><header class="h-[52px] shrink-0 bg-brand-bar text-white flex items-center gap-3 px-4"><button data-menu aria-label="Menu"><i data-lucide="menu"></i></button><div class="leading-tight"><p class="text-[15px] font-semibold">Laporan - ${LAPORAN.find(l => l[0] === K.lap)[1]}</p><p class="text-[11px]">• Status: Online</p></div>
      ${K.lap === 'kas' ? '<button data-kastx class="ml-auto h-8 px-3 rounded-md bg-white/20 text-[13px] font-semibold flex items-center gap-1"><i data-lucide="plus" class="ic-sm"></i>Transaksi</button>' : ''}</header>
    <div class="flex-1 min-h-0 grid md:grid-cols-[200px_1fr] bg-white"><aside class="border-r border-line"><div class="flex items-center justify-between px-3 h-12 text-[13px] text-ink-2">Kategori Laporan<i data-lucide="sliders-horizontal" class="ic-sm"></i></div>${LAPORAN.map(([k, l]) => `<button data-lap="${k}" class="kat-btn ${K.lap === k ? 'active' : ''}">${l}</button>`).join('')}</aside>
      <section class="overflow-y-auto">${isi}</section></div></div>`;
}
function transaksiKas() {
  let jenis = 'masuk';
  const body = () => `<form class="p-5 space-y-4" novalidate><div>${lblK('Jenis Transaksi')}<div class="seg flex border border-[#D6D9D9] rounded-md overflow-hidden h-10">${[['masuk', 'Uang Masuk'], ['keluar', 'Uang Keluar']].map(([v, l]) => `<button type="button" data-jt="${v}" class="flex-1 ${jenis === v ? 'active' : ''}">${l}</button>`).join('')}</div></div>
    <div>${lblK('Nama Transaksi', 1)}${fInput('nama', 'Contoh: Modal Awal', '', { req: 'Mohon isi nama transaksi', counter: 150 })}</div>
    <div>${lblK('Nominal', 1)}${fInput('nominal', '100', '', { prefix: 'Rp', money: true, req: 'Mohon isi nominal', num: true })}</div>
    <div>${lblK('Kategori')}${fSelect('kategori', ['Lainnya', 'Operasional', 'Belanja Bahan'], 'Lainnya')}<p class="text-[12px] text-ink-3 mt-1">Tambahkan kategori kas kasir di Pengaturan Kasir</p></div>
    <div>${lblK('Catatan <span class="text-ink-4 font-normal">opsional</span>')}${fInput('catatan', 'Contoh: pemasukan tanggal 1 Januari 2026', '', { area: true, counter: 150 })}</div></form>`;
  sideSheet({ title: 'Tambah Transaksi Kas Kasir', body: body(), actions: hBtn('Simpan', 'data-ok'), onMount: sh => sh.el.addEventListener('click', e => {
    const j = e.target.closest('[data-jt]'); if (j) { jenis = j.dataset.jt; return sh.setBody(body()); }
    if (!e.target.closest('[data-ok]')) return;
    const f = sh.el.querySelector('form'); if (!validate(f)) return;
    const v = formValues(f);
    db().kasKasir.push({ id: uid(), waktu: new Date().toISOString(), jenis, nama: v.nama, kategori: v.kategori, nominal: toNum(v.nominal), catatan: v.catatan, kasir: K.user });
    saveDB(); sh.close(); render(); toast('Berhasil!', 'Transaksi kas kasir berhasil disimpan');
  }) });
}

// ---------- Tutup Kasir ----------
function tutupKasir() {
  const s = openShift(); if (!s) return toast('Info', 'Kasir belum dibuka');
  let pin = '';
  const body = () => `<div class="p-5"><div class="flex justify-between text-[12px] text-ink-3"><span>Buka Kasir</span><span>Tutup Kasir</span></div><div class="flex justify-between text-[14px] font-medium"><span>${nowText(new Date(s.buka))}</span><span>${nowText()}</span></div>
    <div class="flex justify-center gap-4 mt-10">${[0, 1, 2, 3, 4, 5].map(i => `<span class="w-3 h-3 rounded-full ${i < pin.length ? 'bg-brand' : 'bg-[#D6D9D9]'}"></span>`).join('')}</div>
    <p class="text-center text-[13px] text-ink-3 mt-4">Masukkan PIN untuk Verifikasi</p>
    <div class="grid grid-cols-3 gap-x-10 gap-y-2 mt-8 max-w-[300px] mx-auto">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(k => `<button data-tp="${k}" class="pinkey">${k === '⌫' ? '<i data-lucide="delete" class="mx-auto"></i>' : k}</button>`).join('')}</div></div>`;
  sideSheet({ title: `Tutup Kasir • ${esc(upper(K.user))}`, body: body(), onMount: sh => sh.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-tp]'); if (!b) return;
    const k = b.dataset.tp;
    pin = k === 'C' ? '' : k === '⌫' ? pin.slice(0, -1) : (pin + k).slice(0, 6);
    sh.setBody(body());
    if (pin.length < 6) return;
    if (pin !== PIN_CONTOH) { pin = ''; sh.setBody(body()); return toast('Gagal!', 'PIN salah', 'error'); }
    if (!(await confirmDialog({ title: 'Tutup Kasir', html: `Kasir ${esc(upper(K.user))} akan ditutup. Lanjutkan?` }))) { pin = ''; return sh.setBody(body()); }
    sh.close(); laporanTutup(s);
  }) });
}
function laporanTutup(s) {
  const orders = shiftOrders(), open = db().pesanan.filter(o => OPEN_STATUS.includes(o.status));
  const tunai = orders.reduce((n, o) => n + (o.pembayaran || []).filter(p => p.metode === 'Tunai').reduce((m, p) => m + p.jumlah, 0), 0);
  const terima = orders.reduce((n, o) => n + hitung(o).total, 0), pajak = orders.reduce((n, o) => n + hitung(o).pajak, 0);
  const kas = db().kasKasir.filter(k => k.waktu >= s.buka && k.nama !== 'Modal Awal').reduce((n, k) => n + (k.jenis === 'masuk' ? k.nominal : -k.nominal), 0);
  const terjual = {}, ekstra = {};
  orders.forEach(o => o.items.forEach(i => { terjual[i.nama] = (terjual[i.nama] || 0) + i.qty; (i.ekstra || []).forEach(x => { ekstra[x.nama] = (ekstra[x.nama] || 0) + x.qty * i.qty; }); }));
  const row = (k, v, b) => `<div class="flex py-2 text-[14px] ${b ? 'font-semibold' : ''}"><span>${k}</span><span class="ml-auto">${v}</span></div>`;
  sideSheet({ title: `Laporan Tutup Kasir • ${esc(upper(K.user))}`, width: 'w-[640px]', actions: hBtn('Tutup Kasir', 'data-ok'), body: `<div class="p-5">
    <div class="flex justify-between text-[12px] text-ink-3"><span>Waktu Buka Kasir</span><span>Waktu Tutup Kasir</span></div><div class="flex justify-between text-[14px] font-medium mb-4"><span>${nowText(new Date(s.buka))}</span><span>${nowText()}</span></div>
    ${row('Modal Awal', rp(s.modal), 1)}${row('Tunai', rp(tunai))}${row('Kas Masuk/Keluar', rp(kas))}${row('Total Penerimaan Kasir', rp(terima), 1)}${row('Total Penerimaan', rp(terima), 1)}${row('Saldo Akhir', rp(s.modal + tunai + kas), 1)}
    ${row('Penerimaan Pajak', rp(pajak))}${row('Penerimaan Biaya Layanan', rp(0))}${row('Transaksi Selesai', orders.length)}${row('Transaksi Belum Terbayar', open.length)}${row('Transaksi Belum Terbayar (Rp)', rp(open.reduce((n, o) => n + sisaOf(o), 0)))}${row('Total Tunai Sistem', rp(s.modal + tunai + kas))}
    <p class="text-[14px] font-semibold mt-4">Produk Terjual</p>${Object.entries(terjual).map(([n, q]) => row(esc(n), q)).join('') || '<p class="text-[13px] text-ink-3 py-2">-</p>'}
    <p class="text-[14px] font-semibold mt-4">Ekstra Terjual</p>${Object.entries(ekstra).map(([n, q]) => row(esc(n), q)).join('') || '<p class="text-[13px] text-ink-3 py-2">-</p>'}
    <div class="flex flex-wrap gap-6 mt-6 text-[13px]">${fCheck('cetak', true, 'Cetak di printer')}${fCheck('cetakProduk', true, 'Cetak produk terjual')}${fCheck('cetakEkstra', false, 'Cetak ekstra terjual')}</div></div>`,
  onMount: sh => sh.el.addEventListener('click', e => {
    if (!e.target.closest('[data-ok]')) return;
    Object.assign(s, { tutup: new Date().toISOString(), tunai, penerimaan: terima, transaksi: orders.length, saldoAkhir: s.modal + tunai + kas, ditutupOleh: K.user });
    saveDB(); sh.close(); K.cart = null; toast('Berhasil!', 'Kasir berhasil ditutup'); keluar();
  }) });
}

// ---------- render ----------
function go(view) { K.view = view; if (view !== 'detail') K.backTo = null; render(); }
function render() {
  if (!K.user) { $k('app').innerHTML = pinScreen(); document.title = 'Masuk | Kasir'; return lucide.createIcons(); }
  const views = { kasir: kasirView, meja: mejaView, order: orderView, detail: detailView, bayar: bayarView, sukses: suksesView, penjualan: penjualanView, laporan: laporanView };
  $k('app').innerHTML = (views[K.view] || kasirView)();
  document.title = 'Kasir | kasirku';
  lucide.createIcons();
}

// ---------- event ----------
document.addEventListener('click', async e => {
  const t = e.target, at = s => t.closest(s);
  const find = id => db().pesanan.find(o => o.id === id);
  // layar PIN
  if (at('[data-pin]')) return tekanPin(at('[data-pin]').dataset.pin);
  if (at('[data-scan]')) return toast('Info', 'Pemindai belum tersedia di prototipe');
  if (at('[data-bukakasir]')) return bukaKasir();
  // header & navigasi
  if (at('[data-menu]')) return menuSamping();
  if (at('[data-go]')) return go(at('[data-go]').dataset.go);
  if (at('[data-lock]')) return keluar();
  if (at('[data-bell]')) return toast('Info', 'Tidak ada notifikasi baru');
  // kasir
  if (at('[data-kat]')) { K.kat = at('[data-kat]').dataset.kat; return render(); }
  if (at('[data-prod]')) return tapProduk(at('[data-prod]').dataset.prod);
  if (at('[data-custom]')) return customAmount();
  if (at('[data-jenis]')) return pilihJenis(at('[data-jenis]'));
  if (at('[data-pelanggan]')) { K.pq = ''; return pilihPelanggan(); }
  if (at('[data-line]')) { const l = cart().items[+at('[data-line]').dataset.line]; const p = l.produk && byId('produk', l.produk); return p ? detailProduk(p, l) : null; }
  if (at('[data-delline]')) { cart().items.splice(+at('[data-delline]').dataset.delline, 1); return render(); }
  if (at('[data-unpromo]')) { const c = cart(), id = at('[data-unpromo]').dataset.unpromo; if (c.promo === id) c.promo = null; c.promoProduk = (c.promoProduk || []).filter(x => x !== id); return render(); }
  if (at('[data-promo]')) return menuPromo(at('[data-promo]'));
  if (at('[data-cartm]')) return sideSheet({ title: 'Pesanan', width: 'w-[420px]', body: `<div class="h-full flex flex-col">${cartHtml()}</div>`, onMount: sh => sh.el.addEventListener('click', ev => { if (ev.target.closest('[data-bayar],[data-simpan],[data-clear],[data-jenis],[data-pelanggan],[data-promo],[data-line]')) sh.close(); }) });
  if (at('[data-clear]')) {
    if (!cart().items.length) return;
    if (await confirmDialog({ title: 'Order Belum Disimpan', html: 'Semua produk yang belum tersimpan di dalam order ini akan dihapus. Lanjutkan?', ok: 'Lanjutkan' })) { K.cart = null; render(); }
    return;
  }
  if (at('[data-simpan]') || at('[data-bayar]')) {
    if (!cart().items.length) return toast('Info', 'Silakan masukkan pesanan dari pelanggan');
    if (!openShift()) return toast('Info', 'Buka kasir terlebih dahulu');
    const o = saveCart();
    if (at('[data-simpan]')) { K.cart = null; render(); return snack('Berhasil simpan order!'); }
    return mulaiBayar(o);
  }
  // meja
  if (at('[data-mode]')) { K.mode = at('[data-mode]').dataset.mode; return render(); }
  if (at('[data-area]')) { K.area = at('[data-area]').dataset.area; return render(); }
  if (at('[data-openmeja]')) { K.cart = { ...newCart(), tipe: 'meja', meja: at('[data-openmeja]').dataset.openmeja }; repriceCart(); return go('kasir'); }
  if (at('[data-kebab]')) return aksiOrder(at('[data-kebab]'), find(at('[data-kebab]').dataset.kebab));
  // daftar order & detail
  if (at('[data-okat]')) { K.okat = at('[data-okat]').dataset.okat; return render(); }
  if (at('[data-detail]')) { K.backTo = K.view === 'meja' ? 'meja' : 'order'; K.sel = at('[data-detail]').dataset.detail; K.view = 'detail'; return render(); }
  if (at('[data-detailp]')) { K.backTo = 'penjualan'; K.sel = at('[data-detailp]').dataset.detailp; K.view = 'detail'; return render(); }
  if (at('[data-tambah]')) { loadOrder(find(K.sel)); return go('kasir'); }
  if (at('[data-void]')) return voidOrder(find(at('[data-void]').dataset.void));
  if (at('[data-bayaro]')) return mulaiBayar(find(at('[data-bayaro]').dataset.bayaro));
  if (at('[data-cetak]')) { const o = find(at('[data-cetak]').dataset.cetak); return showStruk(o, o.status === 'lunas' ? 'Struk Pembayaran' : 'Tagihan'); }
  // pembayaran
  if (at('[data-batalbayar]')) { const o = find(K.pay.id); K.pay = null; K.sel = o.id; K.view = 'detail'; K.backTo = 'order'; return render(); }
  if (at('[data-metode]')) { Object.assign(K.pay, { metode: at('[data-metode]').dataset.metode, opsi: '', terima: 0 }); return render(); }
  if (at('[data-opsi]')) {
    const v = at('[data-opsi]').dataset.opsi, o = find(K.pay.id);
    K.pay.opsi = v;
    if (K.pay.metode === 'Tunai') K.pay.terima = v === 'pas' ? tagihanKini(o) : v === 'lain' ? 0 : +v;
    render();
    if (v === 'lain') document.querySelector('[data-terima]')?.focus();
    return;
  }
  if (at('[data-pisah]')) return pilihPisah(at('[data-pisah]'));
  if (at('[data-pisahoff]')) { Object.assign(K.pay, { mode: 'penuh', pilih: {}, opsi: '', terima: 0 }); return render(); }
  if (at('[data-pq2]')) {
    const b = at('[data-pq2]'), n = +b.dataset.pq2, o = find(K.pay.id), max = o.items[n].qty - (o.items[n].dibayarQty || 0);
    K.pay.pilih[n] = Math.max(0, Math.min(max, (K.pay.pilih[n] || 0) + +b.dataset.d));
    if (K.pay.opsi === 'pas') K.pay.terima = tagihanKini(o);
    return render();
  }
  if (at('[data-invoice]')) {
    const o = find(K.pay.id);
    if (!(await confirmDialog({ title: 'Jadikan Invoice', html: `Pesanan <b>${o.id}</b> dijadikan tagihan (invoice) dan bisa dibayar nanti. Lanjutkan?` }))) return;
    o.status = 'tagih'; o.dicetak = true; saveDB(); K.pay = null; K.view = 'order'; render(); return showStruk(o, 'Tagihan');
  }
  if (at('[data-catbayar]')) {
    const o = find(K.pay.id);
    const v = await promptModal({ title: 'Catatan', body: fInput('catatan', 'Contoh: bayar sebagian dulu', o.catatanBayar || '', { area: true }) });
    if (v) { o.catatanBayar = v.catatan; saveDB(); toast('Berhasil!', 'Catatan pembayaran disimpan'); }
    return;
  }
  if (at('[data-proses]')) return prosesBayar();
  if (at('[data-bagikan]')) return bagikanStruk();
  if (at('[data-selesai]')) { K.pay = null; K.cart = null; return go('kasir'); }
  // laporan
  if (at('[data-lap]')) { K.lap = at('[data-lap]').dataset.lap; return render(); }
  if (at('[data-kastx]')) return transaksiKas();
});
document.addEventListener('input', e => {
  const t = e.target;
  const keep = sel => { render(); const el = document.querySelector(sel); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
  if (t.matches('[data-mq]')) { K.q = t.value.toLowerCase(); keep('[data-mq]'); }
  if (t.matches('[data-oq]')) { K.oq = t.value.toLowerCase(); keep('[data-oq]'); }
  if (t.matches('[data-terima]')) { K.pay.terima = toNum(t.value); keep('[data-terima]'); }
});
document.addEventListener('change', e => { if (e.target.matches('[data-pinuser]')) { K.pinUser = e.target.value; K.pin = ''; K.pinErr = ''; render(); } });
// waktu berjalan pada kartu meja
setInterval(() => document.querySelectorAll('[data-elapsed]').forEach(el => { el.textContent = elapsed(el.dataset.elapsed); }), 1000);
// data diubah dari tab dashboard lain → muat ulang saat kembali ke tab ini
window.addEventListener('storage', e => { if (e.key === dbKey()) { _db = null; render(); } });

render();
