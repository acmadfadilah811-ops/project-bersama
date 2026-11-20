// Penyimpanan data prototipe (localStorage, per mode data). Dipakai dashboard (produk.js) dan Kasir (kasir.js).

// mode data: "contoh" (angka contoh) / "kosong" (seperti akun baru di referensi)
const dataMode = () => { try { return localStorage.getItem('dataMode') || 'contoh'; } catch (e) { return 'contoh'; } };
const isSample = () => dataMode() === 'contoh';

let _db = null;
const dbKey = () => 'proto-db-' + dataMode();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// kode pelanggan otomatis 15 karakter, mis. KSRX7Q2M9TB4CZ1
const genKode = () => 'KSR' + Array.from({ length: 12 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
const OUTLETS = ['by cafe'];
const AREAS = ['Indoor', 'Outdoor', 'Lantai 2'];

// ilustrasi bawaan untuk produk contoh (img/produk/*.svg, gambar buatan sendiri)
const FOTO_CONTOH = {
  p1: 'es-kopi-susu', p2: 'americano', p6: 'cappuccino', p3: 'matcha-latte', p7: 'teh-tarik', p8: 'coklat-panas',
  p5: 'nasi-goreng', p9: 'mie-goreng', p10: 'ayam-geprek', p4: 'croissant', p11: 'kentang-goreng', p12: 'roti-bakar'
};
const fotoContoh = id => FOTO_CONTOH[id] ? [`img/produk/${FOTO_CONTOH[id]}.svg`] : [];

function seedDB() {
  const ojek = [{ id: 'oj1', nama: 'Grab', deskripsi: 'grab', status: false, produk: [], ekstra: [] }, { id: 'oj2', nama: 'Go-Jek', deskripsi: 'Go-Jek', status: false, produk: [], ekstra: [] }];
  const meja = [
    ...Array.from({ length: 8 }, (_, i) => ({ id: 'm' + (i + 1), nama: 'Meja ' + (i + 1), area: 'Indoor', kapasitas: i < 4 ? 2 : 4, aktif: true })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: 'o' + (i + 1), nama: 'Outdoor ' + (i + 1), area: 'Outdoor', kapasitas: 4, aktif: true }))
  ];
  const base = { meja, pesanan: [], pelanggan: [], grupPelanggan: [], hargaSpesial: [], shift: [], log: [], ojek,
    pemasok: [], bahan: [], mutasi: [], opname: [], terbuang: [], po: [], faktur: [], bayarFaktur: [], produksi: [], templateProduksi: [], promo: [], logPromo: [], kasKasir: [],
    // pesan masuk dari kasirku untuk pemilik akun (lonceng > Pesan Masuk)
    pesan: [{ id: 'msg1', subjek: 'Syarat dan ketentuan yang diberikan telah disetujui', pengirim: 'kasirku', waktu: '2026-10-16T19:13:00', prioritas: 'Sedang', dibaca: false, tombol: 'Detail SnK',
      isi: ['Syarat dan ketentuan yang diberikan telah disetujui', 'Hi kasirkupreneurs!,', 'Syarat dan Ketentuan yang diberikan telah disetujui oleh user, silakan klik Detail SnK untuk membaca kembali', 'Terima Kasih.'] }] };
  if (!isSample()) return { departemen: [{ id: 'd0', nama: 'root', urutan: 1 }], kategori: [], produk: [], ekstra: [], paket: [], deposit: [], ...base };

  const P = (id, nama, kategori, hargaJual, sku, hargaModal) => ({ id, nama, deskripsi: '', kategori, satuan: 'pcs', sku, minBeli: 1, hargaJual, hargaBeli: 0, hargaModal, favorit: false, tampil: true, monitor: false, stokMin: 0, ekstra: false, ekstraId: '', resep: false, bahan: [], dimensi: [1, 1, 1], berat: 100, ubahHarga: false, foto: fotoContoh(id) });
  const produk = [
    P('p1', 'Es Kopi Susu', 'k1', 18000, 'KP-001', 7500), P('p2', 'Americano', 'k1', 15000, 'KP-002', 5000), P('p6', 'Cappuccino', 'k1', 22000, 'KP-003', 8000),
    P('p3', 'Matcha Latte', 'k2', 22000, 'NK-001', 9000), P('p7', 'Teh Tarik', 'k2', 15000, 'NK-002', 5000), P('p8', 'Coklat Panas', 'k2', 20000, 'NK-003', 8000),
    P('p5', 'Nasi Goreng', 'k3', 25000, 'MK-001', 12000), P('p9', 'Mie Goreng', 'k3', 23000, 'MK-002', 10000), P('p10', 'Ayam Geprek', 'k3', 27000, 'MK-003', 13000),
    P('p4', 'Croissant', 'k4', 20000, 'SN-001', 11000), P('p11', 'Kentang Goreng', 'k4', 18000, 'SN-002', 7000), P('p12', 'Roti Bakar', 'k4', 17000, 'SN-003', 6000)
  ];
  const ago = min => new Date(Date.now() - min * 60000).toISOString();
  const it = (pid, qty, catatan = '') => { const p = produk.find(x => x.id === pid); return { produk: pid, nama: p.nama, harga: p.hargaJual, qty, catatan }; };
  return {
    departemen: [{ id: 'd1', nama: 'Minuman', urutan: 1 }, { id: 'd2', nama: 'Makanan', urutan: 2 }],
    kategori: [
      { id: 'k1', nama: 'Kopi', urutan: 1, departemen: 'd1', tampil: true }, { id: 'k2', nama: 'Non Kopi', urutan: 2, departemen: 'd1', tampil: true },
      { id: 'k3', nama: 'Makanan', urutan: 3, departemen: 'd2', tampil: true }, { id: 'k4', nama: 'Snack', urutan: 4, departemen: 'd2', tampil: true }],
    produk,
    ekstra: [
      { id: 'e1', nama: 'Topping', jenis: 'Optional', cara: 'Many', sub: [{ nama: 'Extra Shot', harga: 5000 }, { nama: 'Oat Milk', harga: 6000 }] },
      { id: 'e2', nama: 'Level Gula', jenis: 'Optional', cara: 'Single', sub: [{ nama: 'Normal', harga: 0 }, { nama: 'Less Sugar', harga: 0 }] }],
    paket: [{ id: 'pk1', nama: 'Paket Ngopi Pagi', kode: 'BC-17102026-10001', kategori: 'k1', harga: 35000, minBeli: 1, tampil: true, favorit: false, isi: [{ produk: 'p1', jumlah: 1 }, { produk: 'p4', jumlah: 1 }] }],
    deposit: [{ id: 'dp1', nama: 'Depo Kopi 100rb', harga: 90000, saldo: 100000, status: true, tampil: true, masa: true, hari: 30, produk: ['p1', 'p2', 'p3'] }],
    ...base,
    pelanggan: [
      { id: 'c1', kode: 'KSR7Q2M9TB4CZ1A', nama: 'Rina Wulandari', telepon: '81234567801', email: 'rina.w@mail.com', jk: 'P', lahir: '1994-03-12', grup: 'g1', kota: 'Bandung', alamat: 'Jl. Merdeka No. 12', catatan: '', poin: 24, deposit: 100000 },
      { id: 'c2', kode: 'KSR4HD8KW2NP6RB', nama: 'Dimas Saputra', telepon: '81234567802', email: '', jk: 'L', lahir: '1990-11-02', grup: '', kota: 'Bandung', alamat: 'Jl. Sudirman No. 4', catatan: '', poin: 8, deposit: 0 },
      { id: 'c3', kode: 'KSR9MX3VC7YT5GE', nama: 'Ayu Lestari', telepon: '81234567803', email: 'ayu.l@mail.com', jk: 'P', lahir: '', grup: 'g1', kota: '', alamat: '', catatan: 'Suka less sugar', poin: 0, deposit: 0 }],
    grupPelanggan: [{ id: 'g1', nama: 'Member', status: true, deskripsi: 'Pelanggan terdaftar member', urutan: 1, harga: '' }],
    // promo contoh: per total pembelian (dipilih manual di kasir) dan per produk (otomatis)
    promo: promoContoh(),
    pemasok: [
      { id: 's1', kode: 'SUP7KD2M9Q', nama: 'CV Biji Kopi Nusantara', email: 'order@bijikopi.co.id', telepon: '081311110001', alamat: 'Jl. Braga No. 21', provinsi: 'Jawa Barat', kota: 'Bandung', rekening: [], ket: 'Kirim tiap Senin' },
      { id: 's2', kode: 'SUP4HX8WRT', nama: 'Toko Susu Segar', email: 'susu@segar.id', telepon: '081311110002', alamat: 'Jl. Pasteur No. 5', provinsi: 'Jawa Barat', kota: 'Bandung', rekening: [], ket: '' }],
    bahan: [
      { id: 'b1', nama: 'Biji Kopi Arabika', monitor: true, stokMin: 500, satuan: [{ nama: 'gram', konversi: 1, hargaBeli: 220, sku: 'BB-001' }, { nama: 'kg', konversi: 1000, hargaBeli: 220000, sku: 'BB-001K' }] },
      { id: 'b2', nama: 'Susu UHT', monitor: true, stokMin: 2000, satuan: [{ nama: 'ml', konversi: 1, hargaBeli: 18, sku: 'BB-002' }] },
      { id: 'b3', nama: 'Gula Aren Cair', monitor: true, stokMin: 300, satuan: [{ nama: 'ml', konversi: 1, hargaBeli: 40, sku: 'BB-003' }] }],
    mutasi: [
      { id: 'mt1', item: 'b:b1', qty: 3000, jenis: 'opname', ref: 'SO/261001/0001', waktu: ago(30 * 1440) },
      { id: 'mt2', item: 'b:b2', qty: 10000, jenis: 'opname', ref: 'SO/261001/0001', waktu: ago(30 * 1440) },
      { id: 'mt3', item: 'b:b3', qty: 250, jenis: 'opname', ref: 'SO/261001/0001', waktu: ago(30 * 1440) }],
    opname: [{ id: 'so1', nomor: 'SO/261001/0001', waktu: ago(30 * 1440), catatan: 'Stok awal', status: 'Berhasil', dibuat: 'Bayu',
      items: [{ item: 'b:b1', sistem: 0, aktual: 3000, harga: 220, catatan: '' }, { item: 'b:b2', sistem: 0, aktual: 10000, harga: 18, catatan: '' }, { item: 'b:b3', sistem: 0, aktual: 250, harga: 40, catatan: '' }] }],
    pesanan: [
      { id: 'ORD-0001', tipe: 'meja', meja: 'm2', pelanggan: 'c1', items: [it('p1', 2), it('p4', 1)], status: 'draft', dibuat: ago(14), kasir: 'Bayu', pelayan: 'Sinta', catatan: '', dicetak: false },
      { id: 'ORD-0002', tipe: 'meja', meja: 'm5', pelanggan: null, items: [it('p5', 2), it('p7', 2, 'Kurang manis')], status: 'tagih', dibuat: ago(48), kasir: 'Bayu', pelayan: 'Raka', catatan: '', dicetak: true },
      { id: 'ORD-0003', tipe: 'bawa', meja: null, pelanggan: 'c2', items: [it('p2', 1), it('p12', 1)], status: 'draft', dibuat: ago(6), kasir: 'Bayu', pelayan: 'Bayu', catatan: '', dicetak: false },
      { id: 'ORD-0004', tipe: 'meja', meja: 'm1', pelanggan: null, items: [it('p3', 1), it('p11', 1)], status: 'lunas', dibuat: ago(95), kasir: 'Bayu', pelayan: 'Sinta', catatan: '', dicetak: true, bayar: { metode: 'QRIS', diterima: 44000, kembalian: 0, waktu: ago(80) } }
    ]
  };
}

function db() {
  if (_db && _db.__k === dbKey()) return _db;
  try { _db = JSON.parse(localStorage.getItem(dbKey())); } catch (e) { _db = null; }
  if (!_db) _db = seedDB();
  // data lama (sebelum ada fitur kasir) dilengkapi koleksi yang belum ada
  const seed = seedDB();
  Object.keys(seed).forEach(k => { if (!(k in _db)) _db[k] = seed[k]; });
  // sekali saja: minuman contoh diberi produk ekstra (Topping / Level Gula) untuk layar Detail Produk di kasir
  if (isSample() && !_db.ekstraContoh) {
    const pasang = { p1: 'e1', p2: 'e1', p6: 'e1', p3: 'e2', p7: 'e2', p8: 'e2' };
    _db.produk.forEach(p => { if (pasang[p.id] && !p.ekstraId && byIdRaw(_db.ekstra, pasang[p.id])) { p.ekstra = true; p.ekstraId = pasang[p.id]; } });
    _db.ekstraContoh = true; _db.__k = dbKey(); saveDB();
  }
  // sekali saja: produk contoh yang belum berfoto diberi ilustrasi bawaan (foto yang dihapus user tidak dipasang lagi)
  if (!_db.fotoContohTerpasang) {
    _db.produk.forEach(p => { if (!(p.foto && p.foto.length)) p.foto = fotoContoh(p.id); });
    _db.fotoContohTerpasang = true;
    _db.__k = dbKey(); saveDB();
  }
  // pelanggan lama (dibuat sebelum ada kode pelanggan) diberi kode otomatis
  if (_db.pelanggan.some(c => !c.kode)) { _db.pelanggan.forEach(c => { if (!c.kode) c.kode = genKode(); }); _db.__k = dbKey(); saveDB(); }
  // sekali saja (mode contoh): riwayat transaksi sejak awal bulan lalu supaya halaman Laporan berisi data
  if (isSample() && !_db.riwayatContoh) { isiRiwayatContoh(_db); _db.riwayatContoh = true; _db.__k = dbKey(); saveDB(); }
  // sekali saja: promo format lama (hanya per total pembelian) diubah ke format lengkap; mode contoh dapat promo per produk
  if (!_db.promoV2) {
    _db.promo = _db.promo.map(p => (p.jenis ? p : { ...PROMO_DEF, id: p.id, jenis: 'total', nama: p.nama, deskripsi: 'Promo pembukaan outlet', aktif: p.aktif !== false, aktivasi: 'manual',
      mulai: tglIso(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)), akhir: (p.sampai || '2026-12-31').slice(0, 10), minimal: p.minBeli || 0, potongan: 'pct', nilai: p.diskon || 0, dibuat: new Date().toISOString() }));
    if (isSample() && !byIdRaw(_db.promo, 'pr2')) _db.promo.push(promoContoh()[1]);
    _db.promoV2 = true; _db.__k = dbKey(); saveDB();
  }
  _db.__k = dbKey();
  return _db;
}
const byIdRaw = (arr, id) => (arr || []).find(x => x.id === id);

// riwayat contoh: pesanan lunas/void, shift kasir dan kas kasir per hari (angka acak tetap, bukan data nyata)
function isiRiwayatContoh(d) {
  let s = 20261001;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const staf = ['Bayu', 'Sinta', 'Raka', 'Dewi'], meja = d.meja.map(m => m.id);
  const prod = d.produk.filter(p => /^p\d+$/.test(p.id)), minum = ['k1', 'k2'];
  const metode = ['Tunai', 'Tunai', 'Tunai', 'Tunai', 'QRIS Statis', 'QRIS Statis', 'QRIS Statis', 'Debit BCA', 'Transfer BCA', 'Debit Mandiri'];
  const pr = byIdRaw(d.promo, 'pr1');
  const now = new Date(), hari = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const iso = (base, menit) => new Date(base.getTime() + menit * 60000).toISOString();
  const riwayat = [];
  for (; hari < new Date(now.getFullYear(), now.getMonth(), now.getDate()); hari.setDate(hari.getDate() + 1)) {
    const tag = `${String(hari.getFullYear()).slice(2)}${String(hari.getMonth() + 1).padStart(2, '0')}${String(hari.getDate()).padStart(2, '0')}`;
    const kasirHari = pick(staf), buka = new Date(hari.getFullYear(), hari.getMonth(), hari.getDate(), 7, 45);
    d.shift.push({ id: 'sh' + tag, buka: buka.toISOString(), modal: 100000, kasir: kasirHari, tutup: iso(buka, 14 * 60 + 30), ditutupOleh: kasirHari });
    d.kasKasir.push({ id: 'kk' + tag, waktu: buka.toISOString(), jenis: 'masuk', nama: 'Modal Awal', kategori: 'Modal Awal', nominal: 100000, catatan: '', kasir: kasirHari });
    const keluar = rnd() < 0.3 ? pick([15000, 25000, 40000]) : 0;
    if (keluar) d.kasKasir.push({ id: 'kx' + tag, waktu: iso(buka, 180), jenis: 'keluar', nama: pick(['Beli Es Batu', 'Beli Gas', 'Parkir Kurir']), kategori: 'Operasional', nominal: keluar, catatan: '', kasir: kasirHari });
    const n = 3 + Math.floor(rnd() * 4) + ([0, 6].includes(hari.getDay()) ? 3 : 0);
    let tunai = 0, terima = 0;
    for (let k = 0; k < n; k++) {
      const jam = pick([8, 9, 11, 12, 12, 13, 15, 17, 18, 19, 19, 20]);
      const dibuat = new Date(hari.getFullYear(), hari.getMonth(), hari.getDate(), jam, Math.floor(rnd() * 60));
      const items = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => {
        const p = pick(prod), ekstra = [];
        if (minum.includes(p.kategori) && rnd() < 0.3) ekstra.push(rnd() < 0.6 ? { grup: 'e1', nama: 'Extra Shot', harga: 5000, qty: 1 } : { grup: 'e2', nama: 'Less Sugar', harga: 0, qty: 1 });
        return { produk: p.id, nama: p.nama, varian: '', harga: p.hargaJual + ekstra.reduce((t, x) => t + x.harga, 0), qty: 1 + Math.floor(rnd() * 2), catatan: '', ekstra };
      });
      const sub = items.reduce((t, i) => t + i.harga * i.qty, 0), promo = pr && sub >= pr.minimal && rnd() < 0.15 ? pr.id : null;
      const diskon = promo ? Math.round(sub * pr.nilai / 100) : 0, total = sub - diskon + Math.round((sub - diskon) * 0.1);
      const tipe = rnd() < 0.55 ? 'meja' : 'bawa', id = `TRX-${tag}${String(k + 1).padStart(3, '0')}`;
      const o = { id, tipe, meja: tipe === 'meja' ? pick(meja) : null, ojek: null, pelanggan: rnd() < 0.3 ? pick(['c1', 'c2', 'c3']) : null, items, promo, dibuat: dibuat.toISOString(),
        kasir: kasirHari, pelayan: pick(staf), catatan: '', dicetak: true, dapur: { proses: iso(dibuat, 1 + rnd() * 4), selesai: iso(dibuat, 6 + rnd() * 12) } };
      if (rnd() < 0.04) { Object.assign(o, { status: 'batal', alasanBatal: pick(['Batal Pesan', 'Salah Proses']), voidOleh: 'BAYU', waktuVoid: iso(dibuat, 5), pembayaran: [] }); riwayat.push(o); continue; }
      const m = rnd() < 0.02 ? 'Komplimen' : pick(metode), diterima = m === 'Tunai' ? Math.ceil(total / 50000) * 50000 : total, waktu = iso(dibuat, 15 + rnd() * 40);
      o.pembayaran = [{ metode: m, jumlah: total, diterima, kembalian: diterima - total, waktu, pisah: '', kasir: kasirHari }];
      Object.assign(o, { status: 'lunas', bayar: { metode: m, diterima, kembalian: diterima - total, waktu } });
      if (m === 'Tunai') tunai += total;
      terima += total;
      riwayat.push(o);
    }
    Object.assign(d.shift[d.shift.length - 1], { tunai, penerimaan: terima, transaksi: riwayat.filter(o => o.id.includes(tag) && o.status === 'lunas').length, saldoAkhir: 100000 + tunai - keluar });
  }
  d.pesanan.push(...riwayat.reverse());
}
function saveDB() {
  try { localStorage.setItem(dbKey(), JSON.stringify(_db)); return true; } catch (e) {
    // penyimpanan penuh (biasanya karena foto) atau diblokir: data hanya bertahan sampai halaman dimuat ulang
    if (typeof toast === 'function') toast('Gagal menyimpan', 'Penyimpanan browser penuh. Kurangi jumlah foto produk.');
    return false;
  }
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const nowText = (d = new Date()) => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function logAct(nama, jenis, sebelum, sesudah = '-') { db().log.unshift({ waktu: nowText(), nama, jenis, sebelum, sesudah, user: 'Bayu' }); }
const byId = (coll, id) => db()[coll].find(x => x.id === id);
const katName = id => byId('kategori', id)?.nama || '-';
// nomor telepon pelanggan disimpan tanpa awalan 0/+62, ditampilkan dengan +62
const telp = c => (c.telepon ? '+62' + String(c.telepon).replace(/^(\+?62|0)/, '') : '-');

// harga jual untuk pelanggan: memakai Grup Harga Spesial aktif dari grup pelanggannya bila produk terdaftar di sana
function hargaUntuk(p, pelangganId) {
  const g = pelangganId && byId('grupPelanggan', byId('pelanggan', pelangganId)?.grup);
  const h = g && g.status && byId('hargaSpesial', g.harga);
  const x = h && h.status && h.produk.find(i => i.id === p.id);
  return x ? x.harga : p.hargaJual;
}

// stok = jumlah semua mutasi barang ('b:<id bahan>' atau 'p:<id produk>')
const stokOf = (key, sebelum) => db().mutasi.filter(m => m.item === key && (!sebelum || m.waktu < sebelum)).reduce((n, m) => n + m.qty, 0);
const addMutasi = (item, qty, jenis, ref, waktu = new Date().toISOString()) => { if (qty) db().mutasi.push({ id: uid(), item, qty, jenis, ref, waktu }); };
// pesanan lunas mengurangi stok produk yang memakai monitor persediaan
function catatTerjual(o) {
  o.items.forEach(i => {
    const p = byId('produk', i.produk);
    if (!p) return;
    if (p.monitor) addMutasi('p:' + i.produk, -i.qty, 'terjual', o.id);
    if (p.resep && p.resepMode !== 'master') (p.bahan || []).forEach(b => { if (b.bahan && b.takaran) addMutasi('b:' + b.bahan, -b.takaran * i.qty, 'terjual', o.id); });
  });
}

// ---------- promo (Promosi > Promo Per Total Pembelian / Per Produk) ----------
// jenis 'total' | 'produk'; dasar 'rp' | 'qty' + minimal; potongan 'pct' | 'rp' | 'bonus' | 'coret'
const PROMO_DEF = { deskripsi: '', aktif: true, aktivasi: 'otomatis', platform: ['POS'], jamMulai: '00:00', jamSelesai: '23:59', hari: [0, 1, 2, 3, 4, 5, 6],
  dasar: 'rp', minimal: 0, syarat: [], produk: [], jenisPromo: 'satuan', potongan: 'pct', nilai: 0, maks: 0, ubahKasir: false,
  kelipatan: false, bonusMode: 'semua', bonus: [], coret: [], coretMaks: 0, coretSpesial: false, draf: false };
const tglIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function promoContoh() {
  const n = new Date(), awal = tglIso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), akhir = tglIso(new Date(n.getFullYear(), n.getMonth() + 3, 0)), dibuat = new Date().toISOString();
  return [
    { ...PROMO_DEF, id: 'pr1', jenis: 'total', nama: 'PROMO OPENING', deskripsi: 'Promo pembukaan outlet', aktivasi: 'manual', mulai: awal, akhir, minimal: 20000, potongan: 'pct', nilai: 10, dibuat },
    { ...PROMO_DEF, id: 'pr2', jenis: 'produk', nama: 'HEMAT NGOPI', deskripsi: 'Beli 2 kopi potong Rp 5.000', aktivasi: 'otomatis', mulai: awal, akhir, dasar: 'qty', minimal: 2, produk: ['p1', 'p2', 'p6'], potongan: 'rp', nilai: 5000, dibuat }
  ];
}
function promoStatus(p, now = new Date()) {
  if (p.dihapus) return 'Dihapus';
  if (p.draf) return 'Draf';
  if (p.akhir && p.akhir < tglIso(now)) return 'Kadaluarsa';
  return p.aktif ? 'Aktif' : 'Inaktif';
}
// promo sedang berjalan di kasir (POS): status aktif, tanggal, hari dan jam cocok
function promoJalan(p, now = new Date()) {
  const jam = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return promoStatus(p, now) === 'Aktif' && (!p.mulai || p.mulai <= tglIso(now)) && (p.platform || []).includes('POS')
    && (p.hari || []).includes(now.getDay()) && (p.jamMulai || '00:00') <= jam && jam <= (p.jamSelesai || '23:59');
}
// baris yang dihitung untuk syarat promo (produk bonus tidak ikut)
const promoBaris = (p, c) => c.items.filter(i => !i.bonus && (p.jenis === 'produk' ? p.produk.includes(i.produk) : !(p.dasar === 'qty' && p.syarat.length) || p.syarat.includes(i.produk)));
// n = berapa kali syarat terpenuhi (untuk kelipatan); 0 = belum memenuhi
function promoSyarat(p, c) {
  const rel = promoBaris(p, c);
  if (p.jenis === 'produk' && (!rel.length || (p.jenisPromo === 'bundling' && !p.produk.every(id => rel.some(i => i.produk === id))))) return { n: 0, rel };
  const basis = rel.reduce((s, i) => s + (p.dasar === 'qty' ? i.qty : i.harga * i.qty), 0);
  return { n: p.minimal ? Math.floor(basis / p.minimal) : basis > 0 ? 1 : 0, rel };
}
// produk bonus yang didapat: [{ produk, qty }]
function promoBonus(p, c) {
  const { n, rel } = promoSyarat(p, c);
  if (!n || p.potongan !== 'bonus') return [];
  const kali = p.kelipatan ? n : 1;
  const ids = p.bonusMode === 'sesuai' ? [...new Set(rel.map(i => i.produk))] : p.bonusMode === 'salah' ? p.bonus.slice(0, 1) : p.bonus;
  return ids.filter(id => byId('produk', id)).map(produk => ({ produk, qty: kali }));
}
function potonganPromo(p, c) {
  if (p.potongan === 'coret') return c.items.filter(i => !i.bonus).reduce((s, i) => {
    const x = p.coret.find(r => r.produk === i.produk);
    return s + (x ? Math.max(0, i.harga - x.harga) * Math.min(i.qty, p.coretMaks || i.qty) : 0);
  }, 0);
  // produk bonus masuk pesanan dengan harga normal, lalu dipotong senilai harganya
  if (p.potongan === 'bonus') return c.items.filter(i => i.bonus === p.id).reduce((s, i) => s + i.harga * i.qty, 0);
  const { n, rel } = promoSyarat(p, c);
  if (!n) return 0;
  const basis = (p.jenis === 'produk' ? rel : c.items.filter(i => !i.bonus)).reduce((s, i) => s + i.harga * i.qty, 0);
  const v = p.potongan === 'pct' ? Math.round(basis * p.nilai / 100) : p.nilai;
  return Math.min(basis, p.maks ? Math.min(v, p.maks) : v);
}
const promoLabel = p => p.nama + (p.potongan === 'pct' ? ` ${p.nilai}%` : '');
const promoKriteria = p => (p.potongan === 'coret' ? 'Harga Coret' : `Min Pembelian : ${p.dasar === 'qty' ? `${p.minimal} pcs` : rp(p.minimal)}`);
const promoHadiah = p => ({ pct: `${p.nilai} %`, rp: rp(p.nilai), bonus: 'Bonus Produk', coret: 'Harga Coret' }[p.potongan]);

const PAJAK = 0.1;                 // PB1 10%
// subtotal, promo, pajak dan total satu pesanan (kasir dan laporan)
// promo: c.promo (per total pembelian) + c.promoProduk (per produk); nilainya dihitung ulang dari isi pesanan
function hitung(c) {
  const sub = c.items.reduce((s, i) => s + i.harga * i.qty, 0);
  // promo yang diubah setelah dipakai: pesanan lama memakai salinan promo saat transaksi (promoSnap)
  const daftarPromo = [c.promo, ...(c.promoProduk || [])].filter(Boolean).map(id => c.promoSnap?.[id] || byId('promo', id)).filter(Boolean)
    .map(p => ({ p, nilai: potonganPromo(p, c) })).filter(x => x.nilai > 0);
  const jumlah = f => daftarPromo.filter(f).reduce((s, x) => s + x.nilai, 0);
  const diskon = Math.min(sub, jumlah(() => true)), pajak = Math.round((sub - diskon) * PAJAK);
  return { sub, diskon, diskonTotal: jumlah(x => x.p.jenis !== 'produk'), diskonProduk: jumlah(x => x.p.jenis === 'produk'), daftarPromo,
    pajak, total: sub - diskon + pajak, qty: c.items.reduce((s, i) => s + i.qty, 0), promo: daftarPromo.find(x => x.p.jenis !== 'produk')?.p || null };
}
const dibayar = o => (o.pembayaran || []).reduce((s, p) => s + p.jumlah, 0);
const sisaOf = o => Math.max(0, hitung(o).total - dibayar(o));

// pesanan yang masih menempati meja
const OPEN_STATUS = ['draft', 'tagih'];
const mejaOrder = mejaId => db().pesanan.find(o => o.meja === mejaId && OPEN_STATUS.includes(o.status));
