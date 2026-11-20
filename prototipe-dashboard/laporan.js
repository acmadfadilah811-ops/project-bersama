// Halaman Laporan & Analisa Laporan (Penjualan > Laporan) dihitung dari data prototipe:
// pesanan kasir (db().pesanan), shift dan kas kasir, mutasi stok. Judul, tombol, KPI dan kolom tetap dari SPEC (penjualan.js),
// angka contoh diganti hasil hitung. Periode, filter, pencarian, halaman tabel, detail transaksi dan Ekspor Laporan (CSV) berfungsi.

// ---------- periode & filter ----------
const LP = { slug: '', awal: null, akhir: null, q: '', pg: 1, f: {}, ekspor: null };
function lpBulanIni() {
  const d = new Date();
  LP.awal = new Date(d.getFullYear(), d.getMonth(), 1);
  LP.akhir = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
const isoDate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const tglL = d => `${pad2(d.getDate())} ${BULAN_P[d.getMonth()]} ${d.getFullYear()}`;
const tglS = d => `${pad2(d.getDate())} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
const lpLabel = () => `${tglL(LP.awal)} - ${tglL(LP.akhir)}`;
const inPer = iso => { const t = new Date(iso); return t >= LP.awal && t <= LP.akhir; };

// pilihan dropdown filter; nilai pertama = bawaan
const LSEL = {
  grp: () => ['Hari', 'Minggu', 'Bulan'],
  metrik: () => ['Penjualan', 'Jumlah'],
  waktu: () => ['Waktu Order', 'Waktu Bayar'],
  jenis: () => ['Semua Jenis Order', 'Makan di Tempat', 'Bawa Pulang', ...db().ojek.map(o => o.nama)],
  kat: () => ['Semua Kategori', ...db().kategori.map(k => k.nama)],
  dept: () => ['Semua Departemen', ...db().departemen.map(k => k.nama)],
  kasir: () => ['Semua Kasir', ...new Set(db().pesanan.map(o => o.kasir).filter(Boolean))],
  jstok: () => ['Semua Jenis', 'Produk', 'Bahan'],
  item: () => ['Pilih Produk', ...stokItems().map(i => i.nama)],
  poin: () => ['Poin Didapatkan', 'Transaksi Dapat Poin'],
  hari: () => ['Semua Hari', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
};
const fv = k => LP.f[k] || LSEL[k]()[0];
const semua = k => fv(k) === LSEL[k]()[0];
// SPEC lama memakai filter statis; diganti kontrol yang berfungsi (filterEl 'x:<kunci>' memanggil lapSel)
const XMAP = { s: 'x:q', 'sel:Hari': 'x:grp', Hari: 'x:grp', Penjualan: 'x:metrik', 'sel:Waktu Order': 'x:waktu', 'sel:Semua Jenis Order': 'x:jenis', 'in:Pilih Jenis Order': 'x:jenis',
  'sel:Semua Kategori': 'x:kat', 'sel:Semua Departemen': 'x:dept', 'sel:Kasir Bayar': 'x:kasir', 'sel:Semua Jenis': 'x:jstok', 'in:Pilih Produk': 'x:item', 'Poin Didapatkan': 'x:poin' };
const xf = f => (f === 'd' || f.startsWith('d:') ? 'x:tgl' : XMAP[f] || f);

function lapSel(key, w = 'w-[200px]') {
  if (key === 'tgl') return `<button data-lptgl class="input h-9 flex items-center gap-2 px-4 text-ink"><i data-lucide="calendar" class="ic-sm"></i>${tglS(LP.awal)} - ${tglS(LP.akhir)}</button>`;
  if (key === 'q') return `<label class="input w-[200px] h-9 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-lpq class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..." value="${esc(LP.q)}"></label>`;
  return `<button data-lpsel="${key}" class="input ${w} h-9 flex items-center justify-between gap-2 text-ink"><span class="truncate">${esc(fv(key))}</span><span class="text-[10px]">&#9660;</span></button>`;
}

// ---------- sumber data ----------
const waktuBayar = o => o.bayar?.waktu || (o.pembayaran || []).at(-1)?.waktu || o.dibuat;
const jenisOrder = o => (o.tipe === 'meja' ? 'Makan di Tempat' : o.tipe === 'ojek' ? (byId('ojek', o.ojek)?.nama || 'Ojek Online') : 'Bawa Pulang');
const namaMeja = o => (o.tipe === 'meja' ? byId('meja', o.meja)?.nama || '-' : '-');
const namaPel = o => byId('pelanggan', o.pelanggan)?.nama || '-';
const cocok = o => (semua('jenis') || jenisOrder(o) === fv('jenis')) && (semua('kasir') || o.kasir === fv('kasir'));
const lunas = (basis = waktuBayar) => db().pesanan.filter(o => o.status === 'lunas' && inPer(basis(o)) && cocok(o)).sort((a, b) => (basis(a) < basis(b) ? 1 : -1));
const voids = () => db().pesanan.filter(o => o.status === 'batal' && inPer(o.waktuVoid || o.dibuat) && cocok(o));
const produkOf = i => byId('produk', i.produk);
const eksSatu = i => (i.ekstra || []).reduce((s, x) => s + x.harga * x.qty, 0);
const hppItem = i => (produkOf(i)?.hargaModal || 0) * i.qty;
// penjualan = subtotal - promo (tanpa pajak); laba kotor = penjualan - HPP
function nilai(o) { const t = hitung(o), hpp = o.items.reduce((s, i) => s + hppItem(i), 0); return { ...t, hpp, jual: t.sub - t.diskon, laba: t.sub - t.diskon - hpp }; }
// pesanan lama (sebelum ada pisah bayar) hanya punya ringkasan o.bayar
const bayarOf = o => (o.pembayaran && o.pembayaran.length ? o.pembayaran : o.status === 'lunas' && o.bayar ? [{ metode: o.bayar.metode, jumlah: hitung(o).total, waktu: o.bayar.waktu }] : []);
const komplimen = o => bayarOf(o).filter(p => p.metode === 'Komplimen').reduce((s, p) => s + p.jumlah, 0);
// baris produk terjual (harga produk tanpa ekstra), mengikuti filter kategori/departemen
function baris(list = lunas()) {
  return list.flatMap(o => o.items.map(i => {
    const p = produkOf(i), kat = p ? byId('kategori', p.kategori) : null, dept = kat ? byId('departemen', kat.departemen) : null;
    return { o, i, p, kat: kat?.nama || '-', dept: dept?.nama || '-', jual: (i.harga - eksSatu(i)) * i.qty, eks: eksSatu(i) * i.qty, hpp: hppItem(i) };
  })).filter(b => (semua('kat') || b.kat === fv('kat')) && (semua('dept') || b.dept === fv('dept')));
}

// ---------- angka & pengelompokan ----------
const jumlahkan = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
const pct = (a, b) => (b ? a / b * 100 : 0).toFixed(2).replace('.', ',') + '%';
const num = n => Number(n || 0).toLocaleString('id-ID');
const kv = (label, v) => `${label}|=${v}`;
const durasi = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`; };
function grupkan(list, keyFn) {
  const m = new Map();
  list.forEach(x => { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return [...m.entries()];
}
function bucketOf(t) {
  const d = new Date(t), g = fv('grp');
  if (g === 'Bulan') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  if (g === 'Minggu') return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
  return isoDate(d);
}
function buckets() {
  const out = [];
  for (const d = new Date(LP.awal); d <= LP.akhir; d.setDate(d.getDate() + 1)) { const k = bucketOf(d); if (out.at(-1) !== k) out.push(k); }
  return out;
}
function bucketLabel(k, pendek) {
  const [y, m, d] = k.split('-').map(Number);
  if (!d) return `${pendek ? BULAN[m - 1] : BULAN_P[m - 1]} ${y}`;
  const t = `${pad2(d)} ${BULAN[m - 1]}`;
  return fv('grp') === 'Minggu' ? `${pendek ? '' : 'Minggu '}${t}${pendek ? '' : ' ' + y}` : pendek ? t : `${t} ${y}`;
}
// grafik per periode; splitFn memisah garis per kelompok (jenis bayar, kategori, kasir, ...)
function seri(list, timeFn, valFn, splitFn, uang = true) {
  const bs = buckets(), keys = splitFn ? [...new Set(list.map(splitFn))] : [''];
  const sets = keys.map(k => ({ label: k, data: bs.map(b => jumlahkan(list.filter(x => bucketOf(timeFn(x)) === b && (!splitFn || splitFn(x) === k)), valFn)) }));
  return { labels: bs.map(b => bucketLabel(b, true)), sets: sets.length ? sets : [{ label: '', data: bs.map(() => 0) }], uang };
}
// grafik mengikuti pilihan "Penjualan" / "Jumlah" di atas grafik
const pilihMetrik = (jual, jumlah) => (fv('metrik') === 'Jumlah' ? [jumlah, false] : [jual, true]);
const bkHari = (list, waktu = waktuBayar) => grupkan(list, o => bucketOf(waktu(o)));

// ---------- definisi laporan: slug -> () => { k, k2, rows, attrs, series, ... } ----------
const nol = kind => (kind === 'Rp' ? 'Rp 0' : kind === 'Rp,00' ? 'Rp 0,00' : kind === '%' ? '0,00%' : kind === 'Produk' ? '0 Produk' : '0');
const kosong = slug => ({ k: SPEC[slug].k && SPEC[slug].k.map(k => kv(k.split('|')[0], nol(k.split('|')[1]))), k2: SPEC[slug].k2 && SPEC[slug].k2.map(k => kv(k.split('|')[0], nol(k.split('|')[1]))), rows: [] });
const trxAttr = o => `data-trx="${o.id}" class="cursor-pointer hover:bg-page"`;

const LAP = {
  'detail-penjualan': () => {
    const basis = fv('waktu') === 'Waktu Bayar' ? waktuBayar : o => o.dibuat, list = lunas(basis);
    const piutang = db().pesanan.filter(o => OPEN_STATUS.includes(o.status) && inPer(o.dibuat) && cocok(o));
    const rows = [], attrs = [];
    list.forEach(o => o.items.forEach(i => {
      rows.push([o.id, nowText(new Date(o.dibuat)), nowText(new Date(waktuBayar(o))), OUTLET_UTAMA, esc(namaPel(o)), jenisOrder(o), esc(namaMeja(o)), esc(i.nama),
        esc(produkOf(i) ? katName(produkOf(i).kategori) : '-'), esc((i.ekstra || []).map(x => x.nama).join(', ') || '-'), num(i.qty), rp(i.harga), rp(i.harga * i.qty),
        esc(o.bayar?.metode || '-'), esc(o.kasir), { badge: 'Lunas' }]);
      attrs.push(trxAttr(o));
    }));
    return {
      k: [kv('Total Penjualan', rp(jumlahkan(list, o => hitung(o).total))), kv('Total Transaksi', num(list.length)), kv('Penjualan Bersih', rp(jumlahkan(list, o => nilai(o).jual))),
        kv('Total Pembayaran', rp(jumlahkan(list, o => jumlahkan(bayarOf(o), p => p.jumlah)))), kv('Total Piutang', rp(jumlahkan(piutang, sisaOf)))],
      cols: ['No Transaksi', 'Waktu Order', 'Waktu Bayar', 'Outlet', 'Pelanggan', 'Jenis Order', 'Nama Meja', 'Nama Produk', 'Kategori', 'Ekstra', 'Quantity', 'Harga (Rp)', 'Subtotal (Rp)', 'Metode Pembayaran', 'Kasir', 'Bayar'],
      hide: ['Waktu Bayar', 'Outlet', 'Kasir'], rows, attrs
    };
  },
  'penjualan-per-periode': () => {
    const list = lunas(), g = new Map(bkHari(list));
    const rows = buckets().map(b => {
      const x = g.get(b) || [], jual = jumlahkan(x, o => hitung(o).total), qty = jumlahkan(x, o => hitung(o).qty);
      return [bucketLabel(b), rp(jual), rp(jumlahkan(x, o => nilai(o).laba)), num(qty), num(x.length), 'Rp 0', 'Rp 0', rp(x.length ? jual / x.length : 0), num(x.length ? (qty / x.length).toFixed(1) : 0)];
    });
    const [val, uang] = pilihMetrik(o => hitung(o).total, () => 1);
    return {
      k: [kv('Total Penjualan', rp(jumlahkan(list, o => hitung(o).total))), kv('Total Laba Kotor', rp(jumlahkan(list, o => nilai(o).laba))), kv('Total Transaksi', num(list.length)), kv('Total Produk', num(jumlahkan(list, o => hitung(o).qty)))],
      ctl: ['x:metrik'], rows, series: seri(list, waktuBayar, val, null, uang)
    };
  },
  'laporan-jenis-bayar': () => {
    const list = lunas(), bayar = list.flatMap(o => bayarOf(o).map(p => ({ ...p, o })));
    const tot = jumlahkan(bayar, p => p.jumlah), dep = bayar.filter(p => p.metode === 'Deposit');
    const rows = grupkan(bayar, p => p.metode).sort((a, b) => jumlahkan(b[1], p => p.jumlah) - jumlahkan(a[1], p => p.jumlah)).map(([m, x]) => {
      const n = new Set(x.map(p => p.o.id)).size, v = jumlahkan(x, p => p.jumlah);
      return [esc(m), num(n), pct(n, list.length), num(m === 'Deposit' ? n : 0), '0', rp(v), pct(v, tot), rp(m === 'Deposit' ? v : 0), 'Rp 0'];
    });
    const [val, uang] = pilihMetrik(p => p.jumlah, () => 1);
    return {
      k: [kv('Total Transaksi Terbayar', num(list.length)), kv('Total Penjualan Terbayar', rp(tot)), kv('Total Jenis Pembayaran', num(rows.length))],
      k2: [kv('Total Transaksi Deposit', num(new Set(dep.map(p => p.o.id)).size)), kv('Total Transaksi Uang Muka', '0'), kv('Total Penjualan Deposit', rp(jumlahkan(dep, p => p.jumlah))), kv('Total Penerimaan Uang Muka', 'Rp 0')],
      ctl: ['x:grp', 'x:metrik'], rows, series: seri(bayar, p => p.waktu, val, p => p.metode, uang)
    };
  },
  'laporan-jenis-order': () => {
    const list = lunas(), tot = jumlahkan(list, o => hitung(o).total);
    const rows = grupkan(list, jenisOrder).map(([j, x]) => [esc(j), num(x.length), pct(x.length, list.length), rp(jumlahkan(x, o => hitung(o).total)), pct(jumlahkan(x, o => hitung(o).total), tot)]);
    const [val, uang] = pilihMetrik(o => hitung(o).total, () => 1);
    return { k: [kv('Total Transaksi', num(list.length)), kv('Total Penjualan', rp(tot) + ',00')], ctl: ['x:grp', 'x:metrik'], rows, series: seri(list, waktuBayar, val, jenisOrder, uang) };
  },
  'laporan-void': () => {
    const list = voids().sort((a, b) => ((a.waktuVoid || a.dibuat) < (b.waktuVoid || b.dibuat) ? 1 : -1));
    return {
      k: [kv('Total Void', rp(jumlahkan(list, o => hitung(o).total))), kv('Total Transaksi', num(list.length))],
      rows: list.map(o => [o.id, nowText(new Date(o.waktuVoid || o.dibuat)), nowText(new Date(o.dibuat)), esc(o.kasir), esc(o.voidOleh || '-'),
        esc(o.items[0]?.nama || '-') + (o.items.length > 1 ? `, +${o.items.length - 1}` : ''), rp(hitung(o).total), jenisOrder(o), esc(namaMeja(o))]),
      attrs: list.map(trxAttr)
    };
  },
  'laporan-refund': () => kosong('laporan-refund'),
  'laporan-proses-order': () => {
    const list = lunas().filter(o => o.dapur);
    return {
      rows: list.map(o => {
        const t0 = new Date(o.dibuat), t1 = new Date(o.dapur.proses), t2 = new Date(o.dapur.selesai);
        return [o.id, tglPendek(o.dibuat), esc(o.items.map(i => i.nama).join(', ')), num(jumlahkan(o.items, i => i.qty)), durasi(t1 - t0), durasi(t2 - t1), durasi(t2 - t0), durasi(t1 - t0), durasi(t2 - t1), durasi(t2 - t0)];
      }),
      attrs: list.map(trxAttr)
    };
  },
  'laporan-proses-produk': () => {
    const b = lunas().filter(o => o.dapur).flatMap(o => o.items.map(i => ({ nama: i.nama, qty: i.qty, a: new Date(o.dapur.proses) - new Date(o.dibuat), p: new Date(o.dapur.selesai) - new Date(o.dapur.proses) })));
    return {
      rows: grupkan(b, x => x.nama).sort((x, y) => jumlahkan(y[1], z => z.qty) - jumlahkan(x[1], z => z.qty)).map(([n, x]) => {
        const avg = f => durasi(jumlahkan(x, f) / x.length), tot = x.map(z => z.a + z.p);
        return [esc(n), num(jumlahkan(x, z => z.qty)), avg(z => z.a), avg(z => z.p), avg(z => z.a + z.p), durasi(Math.min(...tot)), durasi(Math.max(...tot))];
      })
    };
  },
  'penjualan-produk': () => {
    const b = baris(), tot = jumlahkan(b, x => x.jual), qty = jumlahkan(b, x => x.i.qty);
    const rows = grupkan(b, x => x.i.produk + '|' + (x.i.varian || '')).map(([, x]) => {
      const p = x[0].p, v = jumlahkan(x, z => z.jual), q = jumlahkan(x, z => z.i.qty), h = jumlahkan(x, z => z.hpp);
      return { v, r: [esc(p?.nama || x[0].i.nama) + (x[0].i.varian ? ` <span class="text-[11px] font-semibold text-brand">${esc(x[0].i.varian)}</span>` : ''), esc(p?.sku || '-'), esc(x[0].dept), esc(x[0].kat), 'Produk Barang',
        num(q), rp(v), '0', 'Rp 0', pct(q, qty), pct(v, tot), rp(h), 'Rp 0', rp(v - h)] };
    }).sort((a, c) => c.v - a.v).map(x => x.r);
    const [val, uang] = pilihMetrik(x => x.jual, x => x.i.qty);
    return {
      f2: ['x:kat', 'x:dept', 'x:jenis'], hint: '',
      k: [kv('Total Penjualan Per Produk', rp(tot)), kv('Total Produk Terjual', num(qty) + ' Produk'), kv('Total Laba Kotor Per Produk', rp(tot - jumlahkan(b, x => x.hpp)))],
      ctl: ['x:grp', 'x:metrik'], rows, series: seri(b, x => waktuBayar(x.o), val, null, uang)
    };
  },
  'penjualan-departemen': () => {
    const b = baris(), tot = jumlahkan(b, x => x.jual), qty = jumlahkan(b, x => x.i.qty);
    const rows = grupkan(b, x => x.dept).map(([d, x]) => [esc(d), num(jumlahkan(x, z => z.i.qty)), pct(jumlahkan(x, z => z.i.qty), qty), rp(jumlahkan(x, z => z.jual)), pct(jumlahkan(x, z => z.jual), tot)]);
    return { k: [kv('Total Departemen', num(rows.length)), kv('Total Penjualan Departemen', rp(tot))], rows };
  },
  'penjualan-kategori': () => {
    const b = baris(), tot = jumlahkan(b, x => x.jual), qty = jumlahkan(b, x => x.i.qty);
    const rows = grupkan(b, x => x.kat).map(([k, x]) => [esc(k), num(jumlahkan(x, z => z.i.qty)), pct(jumlahkan(x, z => z.i.qty), qty), rp(jumlahkan(x, z => z.jual)), pct(jumlahkan(x, z => z.jual), tot), rp(jumlahkan(x, z => z.hpp))]);
    const [val, uang] = pilihMetrik(x => x.jual, x => x.i.qty);
    return { k: [kv('Total Kategori', num(rows.length)), kv('Total Penjualan Kategori', rp(tot))], ctl: ['x:grp', 'x:metrik'], rows, series: seri(b, x => waktuBayar(x.o), val, x => x.kat, uang) };
  },
  'penjualan-ekstra': () => {
    const e = baris().flatMap(b => (b.i.ekstra || []).map(x => ({ o: b.o, grup: byId('ekstra', x.grup)?.nama || x.grup, nama: x.nama, qty: x.qty * b.i.qty, v: x.harga * x.qty * b.i.qty })));
    const tot = jumlahkan(e, x => x.v), qty = jumlahkan(e, x => x.qty);
    const rows = grupkan(e, x => x.grup).map(([g, x]) => [esc(g), num(jumlahkan(x, z => z.qty)), pct(jumlahkan(x, z => z.qty), qty), rp(jumlahkan(x, z => z.v)), pct(jumlahkan(x, z => z.v), tot), rp(jumlahkan(x, z => z.v)), pct(jumlahkan(x, z => z.v), tot), '0', 'Rp 0']);
    const [val, uang] = pilihMetrik(x => x.v, x => x.qty);
    return { k: [kv('Total Ekstra', num(rows.length)), kv('Total Item Ekstra', num(qty)), kv('Total Penjualan Ekstra', rp(tot)), kv('Total Refund Ekstra', 'Rp 0')], ctl: ['x:grp', 'x:metrik'], rows, series: seri(e, x => waktuBayar(x.o), val, x => x.grup, uang) };
  },
  'penjualan-sub-ekstra': () => {
    const e = baris().flatMap(b => (b.i.ekstra || []).map(x => ({ o: b.o, grup: byId('ekstra', x.grup)?.nama || x.grup, nama: x.nama, qty: x.qty * b.i.qty, v: x.harga * x.qty * b.i.qty })));
    const tot = jumlahkan(e, x => x.v), qty = jumlahkan(e, x => x.qty);
    const rows = grupkan(e, x => x.grup + '|' + x.nama).map(([, x]) => [esc(x[0].nama), esc(x[0].grup), num(jumlahkan(x, z => z.qty)), pct(jumlahkan(x, z => z.qty), qty), rp(jumlahkan(x, z => z.v)), pct(jumlahkan(x, z => z.v), tot), rp(jumlahkan(x, z => z.v)), pct(jumlahkan(x, z => z.v), tot), '0', 'Rp 0']);
    const [val, uang] = pilihMetrik(x => x.v, x => x.qty);
    return { k: [kv('Total Sub Ekstra', num(rows.length)), kv('Total Penjualan', rp(tot)), kv('Total Refund Sub Ekstra', 'Rp 0')], ctl: ['x:grp', 'x:metrik'], rows, series: seri(e, x => waktuBayar(x.o), val, x => x.nama, uang) };
  },
  'laporan-jasa-detail': () => kosong('laporan-jasa-detail'),
  'laporan-reservasi': () => kosong('laporan-reservasi'),
  'laporan-reservasi-dan-utilisasi': () => ({ ...kosong('laporan-reservasi-dan-utilisasi'), series: seri([], waktuBayar, () => 0, null, false) }),
  'laporan-promo': () => {
    const list = lunas().filter(o => hitung(o).daftarPromo.length);
    // satu baris per tanggal + promo; satu transaksi bisa memakai promo total pembelian dan promo produk sekaligus
    const pakai = list.flatMap(o => hitung(o).daftarPromo.map(x => ({ o, p: x.p, nilai: x.nilai })));
    const rows = grupkan(pakai, x => isoDate(new Date(waktuBayar(x.o))) + '|' + x.p.id).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([, x]) => {
      const p = x[0].p;
      return [tglPendek(waktuBayar(x[0].o)), esc(p.nama), p.jenis === 'produk' ? 'Promo Produk' : 'Promo Total Pembelian', OUTLET_UTAMA, num(x.length), rp(jumlahkan(x, y => y.nilai))];
    });
    return {
      k: [kv('Total Transaksi dengan Promo', num(list.length)), kv('Nilai Promo', rp(jumlahkan(list, o => hitung(o).diskon))), kv('Total Penjualan dengan Promo', rp(jumlahkan(list, o => hitung(o).total)))],
      ctl: ['x:grp'], rows, series: seri(list, waktuBayar, o => hitung(o).diskon)
    };
  },
  'laporan-poin': () => {
    // poin pelanggan: 1 poin tiap Rp 10.000 (aturan kasir)
    const list = lunas().filter(o => o.pelanggan), poin = o => Math.floor(hitung(o).total / 10000), g = new Map(bkHari(list));
    const rows = buckets().filter(b => g.has(b)).map(b => { const x = g.get(b); return [bucketLabel(b), num(jumlahkan(x, poin)), num(x.length), rp(jumlahkan(x, o => hitung(o).total)), rp(jumlahkan(x, o => hitung(o).sub)), '0', '0', 'Rp 0', 'Rp 0', '0', '0']; });
    return {
      k: [kv('Total Poin Didapatkan', num(jumlahkan(list, poin))), kv('Total Poin Ditukar', '0'), kv('Total Poin Dibatalkan', '0')],
      rows, series: seri(list, waktuBayar, fv('poin') === 'Poin Didapatkan' ? poin : () => 1, null, false)
    };
  },
  'laporan-komplimen': () => {
    const list = lunas().filter(komplimen);
    return {
      k: [kv('Jumlah Komplimen Digunakan', num(list.length)), kv('Total Transaksi Komplimen', rp(jumlahkan(list, komplimen)))],
      rows: list.map(o => [o.id, nowText(new Date(waktuBayar(o))), esc(o.kasir), num(hitung(o).qty), esc(o.kasir), rp(komplimen(o))]), attrs: list.map(trxAttr)
    };
  },
  'laporan-pajak-detail': () => {
    const list = lunas(), dpp = jumlahkan(list, o => nilai(o).jual), pajak = jumlahkan(list, o => hitung(o).pajak);
    return { k: [kv('Total Transaksi', num(list.length)), kv('Total DPP', rp(dpp)), kv('Total Pajak', rp(pajak))], rows: list.length ? [['PB1 10%', num(list.length), rp(dpp), rp(pajak)]] : [], foot: 'Terakhir Diperbarui: beberapa detik yang lalu' };
  },
  'laporan-service-charge': () => {
    const list = lunas(), g = new Map(bkHari(list));
    return {
      k: [kv('Total Transaksi', num(list.length)), kv('Total Penjualan', rp(jumlahkan(list, o => hitung(o).total))), kv('Total Service Charge', 'Rp 0')],
      rows: buckets().filter(b => g.has(b)).map(b => [bucketLabel(b), num(g.get(b).length), rp(jumlahkan(g.get(b), o => hitung(o).total)), 'Rp 0']), foot: 'Terakhir Diperbarui: beberapa detik yang lalu'
    };
  },
  'laporan-kas-kasir': () => {
    const kas = db().kasKasir.filter(k => inPer(k.waktu) && (semua('kasir') || k.kasir === fv('kasir'))).sort((a, b) => (a.waktu < b.waktu ? 1 : -1));
    const masuk = jumlahkan(kas.filter(k => k.jenis === 'masuk'), k => k.nominal), keluar = jumlahkan(kas.filter(k => k.jenis === 'keluar'), k => k.nominal);
    return {
      k: [kv('Total Kas Kasir', rp(masuk - keluar)), kv('Total Uang Masuk', rp(masuk)), kv('Total Uang Keluar', rp(keluar))],
      rows: kas.map(k => [esc(k.nama), nowText(new Date(k.waktu)), OUTLET_UTAMA, k.jenis === 'masuk' ? rp(k.nominal) : 'Rp 0', k.jenis === 'keluar' ? rp(k.nominal) : 'Rp 0', esc(k.kategori), esc(k.kasir || '-'), 'Kasir-01'])
    };
  },
  'penjualan-per-kasir': () => {
    const list = lunas(), tot = jumlahkan(list, o => hitung(o).total), laba = jumlahkan(list, o => nilai(o).laba), qty = jumlahkan(list, o => hitung(o).qty);
    const rows = grupkan(list, o => o.kasir).map(([k, x]) => {
      const v = jumlahkan(x, o => hitung(o).total), l = jumlahkan(x, o => nilai(o).laba), q = jumlahkan(x, o => hitung(o).qty);
      return [esc(k), OUTLET_UTAMA, rp(v), pct(v, tot), rp(l), pct(l, laba), num(x.length), pct(x.length, list.length), num(q), pct(q, qty), 'Rp 0'];
    });
    const [val, uang] = pilihMetrik(o => hitung(o).total, () => 1);
    return { ctl: ['x:grp', 'x:metrik'], rows, series: seri(list, waktuBayar, val, o => o.kasir, uang) };
  },
  'penjualan-per-terminal': () => {
    const list = lunas();
    return { rows: list.length ? [['Kasir-01', OUTLET_UTAMA, rp(jumlahkan(list, o => hitung(o).total)), rp(jumlahkan(list, o => nilai(o).laba)), num(list.length), num(jumlahkan(list, o => hitung(o).qty)), 'Rp 0']] : [] };
  },
  'laporan-tutup-kasir': () => {
    const shifts = db().shift.filter(s => inPer(s.buka) && (semua('kasir') || s.kasir === fv('kasir'))).sort((a, b) => (a.buka < b.buka ? 1 : -1));
    return {
      rows: shifts.map(s => {
        const akhir = s.tutup || new Date().toISOString();
        const bayar = db().pesanan.filter(o => o.status === 'lunas').flatMap(bayarOf).filter(p => p.waktu >= s.buka && p.waktu <= akhir);
        const kas = db().kasKasir.filter(k => k.waktu >= s.buka && k.waktu <= akhir && k.nama !== 'Modal Awal');
        const tunai = jumlahkan(bayar.filter(p => p.metode === 'Tunai'), p => p.jumlah), non = jumlahkan(bayar.filter(p => p.metode !== 'Tunai'), p => p.jumlah);
        const masuk = jumlahkan(kas.filter(k => k.jenis === 'masuk'), k => k.nominal), keluar = jumlahkan(kas.filter(k => k.jenis === 'keluar'), k => k.nominal);
        const saldo = s.modal + tunai + masuk - keluar;
        return [`<b>Buka:</b> ${tglPanjang(s.buka)}<br><b>Tutup:</b> ${s.tutup ? tglPanjang(s.tutup) : '-'}`, esc(s.kasir), OUTLET_UTAMA, rp(s.modal), rp(masuk), rp(keluar), rp(tunai), rp(non), rp(tunai + non), 'Rp 0', 'Rp 0', rp(tunai + non),
          'Rp 0', 'Rp 0', rp(saldo), s.tutup ? rp(saldo) : '-', rp(saldo), 'Rp 0'];
      })
    };
  },
  'penjualan-deposit': () => kosong('penjualan-deposit'),
  'deposit-kadaluarsa': () => kosong('deposit-kadaluarsa'),
  'sisa-deposit': () => ({ rows: db().pelanggan.filter(c => c.deposit > 0).map(c => [esc(c.nama), rp(c.deposit)]) }),
  'laporan-pelanggan-detail': () => {
    const list = lunas(), bulan = Math.max(1, (LP.akhir - LP.awal) / (30 * 864e5));
    return {
      rows: db().pelanggan.map(c => {
        const x = list.filter(o => o.pelanggan === c.id), v = jumlahkan(x, o => hitung(o).total);
        return { n: x.length, r: [esc(c.nama), esc(c.alamat || '-'), telp(c), c.dibuat ? tglPendek(c.dibuat) : '-', OUTLET_UTAMA, num(x.length), rp(v), x.length ? tglPendek(waktuBayar(x[0])) : '-', num((x.length / bulan).toFixed(1)), rp(v / bulan)] };
      }).sort((a, b) => b.n - a.n).map(x => x.r)
    };
  },
  'absensi': () => kosong('absensi'),
  'lap-ringkasan-persediaan': () => {
    const at = new Date(LP.akhir.getTime() + 1).toISOString();
    const items = stokItems().filter(i => (semua('jstok') || i.jenis === fv('jstok')) && (semua('kat') || katName(i.kategori) === fv('kat')));
    const rows = items.map(i => { const q = stokOf(i.key, at); return { v: q * i.hargaBeli, r: [esc(i.nama), esc(i.sku), i.jenis, i.kategori ? esc(katName(i.kategori)) : '-', fmtN(q), esc(i.satuan), rp(i.hargaBeli), rp(q * i.hargaBeli)] }; });
    return { k: [kv('Total Nilai Persediaan', rp(jumlahkan(rows, x => x.v)))], rows: rows.map(x => x.r) };
  },
  'lap-detail-persediaan': () => {
    const it = semua('item') ? null : stokItems().find(i => i.nama === fv('item'));
    if (!it) return { rows: [] };
    const JENIS = { opname: 'Stok Opname', terbuang: 'Stok Terbuang', beli: 'Pembelian', terjual: 'Penjualan', produksi: 'Produksi Stok', terproduksi: 'Hasil Produksi' };
    let stok = stokOf(it.key, LP.awal.toISOString());
    const ms = db().mutasi.filter(m => m.item === it.key && inPer(m.waktu)).sort((a, b) => (a.waktu < b.waktu ? -1 : 1));
    return {
      note: '', rows: ms.map(m => {
        stok += m.qty;
        return [OUTLET_UTAMA, tglPanjang(m.waktu), JENIS[m.jenis] || m.jenis, esc(m.ref || '-'), fmtN(m.qty), esc(it.satuan), rp(m.jenis === 'terjual' ? it.hargaJual : it.hargaBeli), fmtN(stok), rp(it.hargaBeli), rp(stok * it.hargaBeli)];
      })
    };
  },
  'laporan-batch-number': () => kosong('laporan-batch-number'),
  'settlement-qris': () => kosong('settlement-qris'),
  'waktu-teramai-produk': () => {
    const b = baris().filter(x => semua('hari') || LSEL.hari()[((new Date(waktuBayar(x.o)).getDay() + 6) % 7) + 1] === fv('hari'));
    const jam = x => new Date(x.o.dibuat).getHours(), tq = jumlahkan(b, x => x.i.qty), tv = jumlahkan(b, x => x.jual), tt = new Set(b.map(x => x.o.id)).size;
    const rows = grupkan(b, x => x.i.nama + '|' + jam(x)).map(([, x]) => {
      const h = jam(x[0]), q = jumlahkan(x, z => z.i.qty), t = new Set(x.map(z => z.o.id)).size, v = jumlahkan(x, z => z.jual);
      return { q, r: [esc(x[0].i.nama), `${pad2(h)}:00 - ${pad2(h + 1)}:00`, num(q), pct(q, tq), num(t), pct(t, tt), rp(v), pct(v, tv)] };
    }).sort((a, c) => c.q - a.q).map(x => x.r);
    const hours = Array.from({ length: 17 }, (_, i) => i + 6);
    return { f: ['s', 'd', 'x:hari'], rows, series: { labels: hours.map(h => pad2(h) + ':00'), sets: [{ label: 'Produk Terjual', data: hours.map(h => jumlahkan(b.filter(x => jam(x) === h), x => x.i.qty)) }], uang: false } };
  },
  'perputaran-stok': () => {
    const hari = Math.max(1, Math.round((LP.akhir - LP.awal) / 864e5));
    const items = stokItems().filter(i => semua('jstok') || i.jenis === fv('jstok')).map(i => {
      const ms = db().mutasi.filter(m => m.item === i.key && inPer(m.waktu)), terjual = -jumlahkan(ms.filter(m => m.jenis === 'terjual'), m => m.qty);
      const awal = stokOf(i.key, LP.awal.toISOString()), akhir = stokOf(i.key, new Date(LP.akhir.getTime() + 1).toISOString()), rata = (awal + akhir) / 2;
      const putar = rata > 0 ? terjual / rata : 0;
      return { putar, hariJual: putar ? hari / putar : 0, r: [esc(i.nama), i.jenis, fmtN(terjual), fmtN(akhir)] };
    });
    return {
      f: ['s', 'd', 'x:jstok'],
      k: [kv('Jumlah', num(items.length)), kv('Perputaran Stok', fmtN(items.length ? jumlahkan(items, x => x.putar) / items.length : 0)), kv('Hari Terjual', fmtN(items.length ? jumlahkan(items, x => x.hariJual) / items.length : 0))],
      rows: items.map(x => [...x.r, fmtN(x.putar), fmtN(x.hariJual)])
    };
  }
};

// ---------- halaman ----------
function lapPage(slug) {
  if (LP.slug !== slug) Object.assign(LP, { slug, q: '', pg: 1, f: {} });
  if (!LP.awal) lpBulanIni();
  const base = SPEC[slug], x = LAP[slug]();
  const map = a => a && a.map(xf);
  const per = base.per === null ? null : base.per && !base.per.includes(' - ') ? tglL(LP.akhir) : lpLabel();
  const s = { ...base, ...x, per, f: map(x.f || base.f), f2: map(x.f2 || base.f2), ctl: map(x.ctl || base.ctl), ctlRight: base.ctlRight && xf(base.ctlRight) };
  // pencarian di semua kolom, lalu 10 baris per halaman
  let rows = x.rows || [], attrs = x.attrs;
  if (LP.q) {
    const q = LP.q.toLowerCase(), keep = rows.map(r => r.map(c => String(c?.badge ?? c).replace(/<[^>]+>/g, ' ')).join(' ').toLowerCase().includes(q));
    rows = rows.filter((_, i) => keep[i]); attrs = attrs && attrs.filter((_, i) => keep[i]);
  }
  LP.ekspor = { title: s.title, cols: s.cols, rows };
  const max = Math.max(1, Math.ceil(rows.length / 10));
  LP.pg = Math.min(LP.pg, max);
  Object.assign(s, { rows: rows.slice((LP.pg - 1) * 10, LP.pg * 10), attrs: attrs && attrs.slice((LP.pg - 1) * 10, LP.pg * 10), pagerHtml: lpPager(rows.length, max) });
  return reportPage(s, slug);
}
function lpPager(n, max) {
  const a = (LP.pg - 1) * 10 + 1, b = Math.min(n, LP.pg * 10);
  const nums = Array.from({ length: max }, (_, i) => i + 1).filter(p => max <= 7 || p === 1 || p === max || Math.abs(p - LP.pg) <= 1);
  const nav = (p, on, html) => `<button data-lppg="${p}" ${on ? '' : 'disabled'} class="flex items-center gap-1 ${on ? 'text-ink' : 'text-[#A0A6A6]'}">${html}</button>`;
  return `<div class="flex flex-wrap items-center justify-between gap-3 mt-4 text-[12px] text-ink-3">
    <span>Tampilkan: <b class="text-ink">10</b> &#709; &nbsp; Ditampilkan ${a} - ${b} dari ${n} data</span>
    <span class="flex items-center gap-2">${nav(LP.pg - 1, LP.pg > 1, '<i data-lucide="arrow-left" class="ic-sm"></i> Sebelumnya')}
      ${nums.map((p, i) => `${i && p - nums[i - 1] > 1 ? '<span>...</span>' : ''}<button data-lppg="${p}" class="w-7 h-7 rounded ${p === LP.pg ? 'bg-brand text-white font-semibold' : 'text-ink hover:bg-page'}">${p}</button>`).join('')}
      ${nav(LP.pg + 1, LP.pg < max, 'Selanjutnya <i data-lucide="arrow-right" class="ic-sm"></i>')}</span></div>`;
}

// Ringkasan Penjualan (tata letak sama dengan versi contoh di penjualan.js, angka dari data)
function ringkasanReal() {
  killCharts();
  if (LP.slug !== 'ringkasan-penjualan') Object.assign(LP, { slug: 'ringkasan-penjualan', q: '', pg: 1, f: {} });
  if (!LP.awal) lpBulanIni();
  const list = lunas(), v = f => jumlahkan(list, f);
  const kotor = v(o => hitung(o).sub), pajak = v(o => hitung(o).pajak), promoBeli = v(o => hitung(o).diskonTotal), promoProduk = v(o => hitung(o).diskonProduk), kompl = v(komplimen);
  const pend = [['Penjualan Kotor', kotor], ['Ongkos Kirim', 0], ['Biaya Pelayanan', 0], ['Biaya Layanan Transaksi', 0], ['Pembulatan', 0], ['Pajak', pajak], ['Asuransi', 0], ['Platform', 0], ['Lainnya', 0]];
  const promo = [['Promo Pembelian', promoBeli], ['Promo Produk', promoProduk], ['Komplimen', kompl]];
  const tot = a => a.reduce((s, x) => s + x[1], 0);
  const totPend = tot(pend), totPromo = tot(promo), admin = 0, retur = 0;
  const totJual = totPend - totPromo, bersih = totJual - admin - retur;
  const laba = [['Biaya Transaksi', 0], ['HPP', v(o => nilai(o).hpp)], ['Komisi', 0], ['Biaya Ongkos Kirim', 0, 1], ['Biaya Asuransi', 0, 1]];
  const totLaba = bersih - tot(laba);
  const neg = n => `( ${rp(n)} )`;
  const box = (title, tint, rows, total, totalNeg) => `
    <div class="border border-line rounded-lg overflow-hidden">
      <div class="px-4 py-4 text-[12px] font-semibold" style="background:${tint}">${title}</div>
      ${rows.map(([k, val, info, isNeg]) => `<div class="flex justify-between px-4 py-[17px] border-t border-line text-[14px]"><span class="flex items-center gap-2">${k}${info ? '<i data-lucide="info" class="ic-sm"></i>' : ''}</span><span>${isNeg ? neg(val) : rp(val)}</span></div>`).join('')}
      <div class="flex justify-between px-4 py-[17px] border-t border-line text-[14px] font-semibold"><span>${total[0]}</span><span>${totalNeg ? neg(total[1]) : rp(total[1])}</span></div>
    </div>`;
  const kpi = [['Total Pendapatan', totPend, '#3ED0A8'], ['Biaya Promosi', totPromo, '#F5D90A'], ['Total Penjualan', totJual, '#1890FF'], ['Penjualan Bersih', bersih, '#6CB8F0'], ['Total Laba Kotor', totLaba, '#7B2FD0']];
  LP.ekspor = { title: 'Ringkasan Penjualan', cols: ['Rincian', 'Nilai (Rp)'], rows: [...pend, ['TOTAL PENDAPATAN', totPend], ...promo, ['TOTAL BIAYA PROMOSI', totPromo], ['TOTAL PENJUALAN BERSIH', bersih], ...laba.map(x => [x[0], x[1]]), ['TOTAL LABA KOTOR', totLaba]].map(([k, n]) => [k, rp(n)]) };
  return cardWrap(`
    ${pageHead('Ringkasan Penjualan', { help: 1, per: null, a: [EXP] })}${hr}
    ${lapSel('tgl')}${hr}
    <p class="text-right text-[12px] italic text-ink-4">Terakhir Diperbarui: beberapa detik yang lalu</p>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3">
      ${kpi.map(([k, val, c]) => `<div class="card flex flex-col"><div class="px-4 pt-3 pb-3 flex-1"><p class="text-[14px] font-medium flex items-center gap-1.5">${k}<i data-lucide="info" class="ic-sm"></i></p><p class="text-[16px] font-semibold mt-2">${rp(val)}</p></div><div class="kpi-bar" style="background:${c}"></div></div>`).join('')}
    </div>
    <h2 class="text-[20px] font-semibold mt-8 mb-5">Rincian Ringkasan Penjualan</h2>
    <div class="grid md:grid-cols-2 gap-4 items-start">
      ${box('PENDAPATAN', '#EAF8F0', pend, ['TOTAL PENDAPATAN', totPend])}
      ${box('BIAYA PROMOSI', '#FFFBE6', promo.map(x => [x[0], x[1], 0, 1]), ['TOTAL BIAYA PROMOSI', totPromo], true)}
      ${box('BIAYA ADMINISTRASI', '#FDECEC', [['Biaya Administrasi', admin, 1, 1]], ['TOTAL BIAYA ADMINISTRASI', admin], true)}
      ${box('PENJUALAN BERSIH', '#E6F4FF', [['Total Penjualan', totJual, 1], ['Pengembalian', retur, 0, 1]], ['TOTAL PENJUALAN BERSIH', bersih])}
    </div>
    <div class="mt-4">${box('LABA KOTOR', '#F3EEFA', [['Penjualan Bersih', bersih, 1], ...laba.map(x => [x[0], x[1], x[2], 1])], ['TOTAL LABA KOTOR', totLaba])}</div>`);
}

// Penjualan Outlet (satu outlet di prototipe)
function outletReal() {
  killCharts();
  if (LP.slug !== 'penjualan-outlet') Object.assign(LP, { slug: 'penjualan-outlet', q: '', pg: 1, f: {} });
  if (!LP.awal) lpBulanIni();
  const list = lunas(), jual = jumlahkan(list, o => hitung(o).total), laba = jumlahkan(list, o => nilai(o).laba), qty = jumlahkan(list, o => hitung(o).qty);
  const cols = ['Outlet', 'Penjualan (Rp)', 'Laba Kotor (Rp)', 'Jumlah Produk', 'Jumlah Transaksi', 'Penjualan %', 'Laba Kotor %', 'Produk %', 'Transaksi (%)', 'Penjualan/Transaksi (Rp)', 'Produk/Transaksi'];
  const rows = list.length ? [[OUTLET_UTAMA, rp(jual), rp(laba), num(qty), num(list.length), '100,00%', '100,00%', '100,00%', '100,00%', rp(jual / list.length), num((qty / list.length).toFixed(1))]] : [];
  LP.ekspor = { title: 'Penjualan Outlet', cols, rows };
  const [val, uang] = pilihMetrik(o => hitung(o).total, () => 1);
  const series = seri(list, waktuBayar, val, null, uang);
  const mini = (v, label) => `<div><p class="text-[18px] font-semibold">${v}</p><p class="text-[14px] font-semibold text-ink-2 mt-0.5">${label}</p></div>`;
  window.PENDING_INIT = () => { drawReportChart('outlet', series); bindChartToggle(); };
  return `<section class="card p-5">
    ${pageHead('Penjualan Outlet', { a: [EXP], per: lpLabel() })}${hr}
    ${filterRow(['x:tgl', 'x:jenis'])}${hr}
    <div class="grid md:grid-cols-[1fr_2fr] gap-6 items-center">
      <div><p class="text-[32px] font-semibold leading-10">${rp(jual)},00</p><p class="text-[14px] font-semibold text-ink-2 mt-1">Total Penjualan</p></div>
      <div class="md:border-l md:border-line md:pl-6 grid grid-cols-2 gap-y-5">${mini(rp(laba) + ',00', 'Laba Kotor')}${mini(num(list.length), 'Transaksi')}${mini(num(qty), 'Produk Terjual')}</div>
    </div>
    ${chartBlock({ chart: 'Grafik Penjualan Outlet', ctl: ['x:grp', 'x:metrik'] })}
    ${tableHtml({ cols, rows }, 'Penjualan Outlet')}
  </section>`;
}

// ---------- detail transaksi (klik baris) ----------
function detailTrx(id) {
  const o = db().pesanan.find(x => x.id === id);
  if (!o) return;
  const t = hitung(o), st = { lunas: 'Lunas', batal: 'Void', draft: 'Belum Bayar', tagih: 'Ditagih' }[o.status] || o.status;
  const kvRow2 = (k, v) => `<div class="flex justify-between gap-4 py-2 text-[14px]"><span class="text-ink-3">${k}</span><span class="text-right">${v}</span></div>`;
  openSheet({
    title: 'Detail Transaksi',
    body: `<div class="max-w-[880px] mx-auto p-6 grid md:grid-cols-[1fr_1fr] gap-6">
      <section class="card p-5"><h3 class="text-[16px] font-semibold mb-2">Informasi Transaksi</h3>
        ${kvRow2('No Transaksi', o.id)}${kvRow2('Status', badge(st))}${kvRow2('Waktu Order', tglPanjang(o.dibuat))}${o.status === 'lunas' ? kvRow2('Waktu Bayar', tglPanjang(waktuBayar(o))) : ''}
        ${kvRow2('Outlet', OUTLET_UTAMA)}${kvRow2('Kasir', esc(o.kasir))}${kvRow2('Jenis Order', jenisOrder(o))}${kvRow2('Nama Meja', esc(namaMeja(o)))}${kvRow2('Pelanggan', esc(namaPel(o)))}
        ${o.status === 'batal' ? kvRow2('Alasan Void', esc(o.alasanBatal || '-')) + kvRow2('Otorisasi', esc(o.voidOleh || '-')) : ''}</section>
      <section class="card p-5"><h3 class="text-[16px] font-semibold mb-2">Pembayaran</h3>
        ${bayarOf(o).map((p, n, a) => kvRow2(`${(a.length > 1 ? `Pembayaran ${n + 1} · ` : '') + esc(p.metode)}`, rp(p.jumlah))).join('') || '<p class="text-[14px] text-ink-3 py-2">Belum ada pembayaran</p>'}
        ${o.bayar ? kvRow2('Diterima', rp(o.bayar.diterima)) + kvRow2('Kembalian', rp(o.bayar.kembalian)) : ''}</section>
      <section class="card p-5 md:col-span-2"><h3 class="text-[16px] font-semibold mb-3">Produk</h3>
        <table class="tbl w-full"><thead><tr><th>Produk</th><th class="text-right">Jumlah</th><th class="text-right">Harga</th><th class="text-right">Subtotal</th></tr></thead><tbody>
        ${o.items.map(i => `<tr><td>${esc(i.nama)}${(i.ekstra || []).map(x => `<p class="text-[12px] text-ink-3">+ ${esc(x.nama)}${x.harga ? ` (${rp(x.harga)})` : ''}</p>`).join('')}${i.catatan ? `<p class="text-[12px] text-ink-3 italic">${esc(i.catatan)}</p>` : ''}</td><td class="text-right">${i.qty}</td><td class="text-right">${rp(i.harga)}</td><td class="text-right">${rp(i.harga * i.qty)}</td></tr>`).join('')}</tbody></table>
        <div class="ml-auto max-w-[320px] mt-3">${kvRow2('Subtotal', rp(t.sub))}${t.daftarPromo.map(x => kvRow2(`Promo ${esc(x.p.nama)}`, `( ${rp(x.nilai)} )`)).join('')}${kvRow2('PB1 10%', rp(t.pajak))}
          <div class="flex justify-between py-2 text-[16px] font-semibold border-t border-line mt-1"><span>Total</span><span>${rp(t.total)}</span></div></div></section></div>`,
    footer: `<span class="ml-auto"></span>${fBtn.primary('Tutup', 'data-tutup')}`,
    onMount: sh => sh.root.addEventListener('click', e => { if (e.target.closest('[data-tutup]')) sh.close(); })
  });
}

// ---------- pilih periode ----------
function pilihPeriode(anchor) {
  const old = document.querySelector('.lp-date');
  if (old) return old.remove();
  const t = new Date(), y = t.getFullYear(), m = t.getMonth(), hari = n => new Date(y, m, t.getDate() + n);
  const PRESET = [['Hari Ini', hari(0), hari(0)], ['Kemarin', hari(-1), hari(-1)], ['7 Hari Terakhir', hari(-6), hari(0)], ['30 Hari Terakhir', hari(-29), hari(0)],
    ['Bulan Ini', new Date(y, m, 1), new Date(y, m + 1, 0)], ['Bulan Lalu', new Date(y, m - 1, 1), new Date(y, m, 0)]];
  const p = nodeOf(`<div class="lp-date dropdown fixed z-[55] w-[420px] max-w-[calc(100vw-32px)] p-4">
    <div class="grid grid-cols-[140px_1fr] gap-4">
      <div class="flex flex-col border-r border-line pr-3">${PRESET.map((x, i) => `<button data-pre="${i}" class="text-left px-3 py-2 rounded text-[13px] hover:bg-page">${x[0]}</button>`).join('')}</div>
      <div><label class="block text-[12px] font-medium text-ink-2 mb-1">Dari Tanggal</label><input type="date" data-dari class="fin" value="${isoDate(LP.awal)}">
        <label class="block text-[12px] font-medium text-ink-2 mb-1 mt-3">Sampai Tanggal</label><input type="date" data-sampai class="fin" value="${isoDate(LP.akhir)}">
        <p data-err class="text-[12px] text-danger mt-2 hidden">Tanggal awal tidak boleh melebihi tanggal akhir</p></div></div>
    <div class="flex justify-end items-center gap-6 mt-4 pt-3 border-t border-line">${fBtn.text('Batal', 'data-x')}${fBtn.primary('Terapkan', 'data-ok')}</div></div>`);
  document.body.appendChild(p);
  const r = anchor.getBoundingClientRect();
  p.style.top = Math.min(r.bottom + 4, window.innerHeight - p.offsetHeight - 8) + 'px';
  p.style.left = Math.max(8, Math.min(r.left, window.innerWidth - p.offsetWidth - 8)) + 'px';
  const close = () => { p.remove(); document.removeEventListener('click', off, true); };
  const off = e => { if (!p.contains(e.target) && !e.target.closest('[data-lptgl]')) close(); };
  setTimeout(() => document.addEventListener('click', off, true), 0);
  p.addEventListener('click', e => {
    const pre = e.target.closest('[data-pre]');
    if (pre) { const [, a, b] = PRESET[+pre.dataset.pre]; p.querySelector('[data-dari]').value = isoDate(a); p.querySelector('[data-sampai]').value = isoDate(b); return; }
    if (e.target.closest('[data-x]')) return close();
    if (!e.target.closest('[data-ok]')) return;
    const a = p.querySelector('[data-dari]').value, b = p.querySelector('[data-sampai]').value;
    if (!a || !b || a > b) return p.querySelector('[data-err]').classList.remove('hidden');
    LP.awal = new Date(a + 'T00:00:00'); LP.akhir = new Date(b + 'T23:59:59.999'); LP.pg = 1;
    close(); render();
  });
}

// ---------- Ekspor Laporan (CSV) ----------
async function eksporLaporan() {
  const x = LP.ekspor;
  if (!x) return;
  if (!(await confirmDialog({ title: 'Ekspor Laporan', html: `${esc(x.title)} pada periode ${lpLabel()} akan diekspor dan disimpan di perangkat yang digunakan. Lanjutkan?` }))) return;
  const teks = c => String(c?.badge ?? c ?? '').replace(/<br\s*\/?>/g, ' / ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  const sel = c => `"${teks(c).replace(/"/g, '""')}"`;
  const csv = [x.cols, ...x.rows].map(r => r.map(sel).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${x.title.replace(/[^\w]+/g, '-')}_${isoDate(LP.awal)}_${isoDate(LP.akhir)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Berhasil!', `${esc(x.title)} berhasil diekspor`);
}

// ---------- event ----------
let lpTimer = null;
document.addEventListener('click', e => {
  const t = e.target;
  if (!t.closest('#page')) return;
  const tg = t.closest('[data-lptgl]');
  if (tg) return pilihPeriode(tg);
  const sl = t.closest('[data-lpsel]');
  if (sl) { const k = sl.dataset.lpsel; return rowMenu(sl, LSEL[k]().map(o => [o, () => { LP.f[k] = o; LP.pg = 1; render(); }])); }
  const pg = t.closest('[data-lppg]');
  if (pg && !pg.disabled) { LP.pg = +pg.dataset.lppg; return render(); }
  const tr = t.closest('[data-trx]');
  if (tr) return detailTrx(tr.dataset.trx);
  if (t.closest('[data-tool="Ekspor Laporan"]') && LP.ekspor && LP.slug === state.page) eksporLaporan();
});
document.addEventListener('input', e => {
  if (!e.target.matches('#page [data-lpq]')) return;
  clearTimeout(lpTimer);
  lpTimer = setTimeout(() => {
    LP.q = e.target.value.trim(); LP.pg = 1; render();
    const i = document.querySelector('#page [data-lpq]');
    if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }, 300);
});

// ---------- daftarkan ke router ----------
Object.keys(LAP).forEach(slug => { PAGES[slug] = () => lapPage(slug); });
Object.assign(PAGES, { 'ringkasan-penjualan': ringkasanReal, 'penjualan-outlet': outletReal });
