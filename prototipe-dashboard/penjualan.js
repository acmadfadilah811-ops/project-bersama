// Modul Penjualan: semua halaman di sidebar Penjualan.
// Struktur tiap halaman (judul, tombol, filter, KPI, kolom tabel) direkam dari dashboard referensi 17 Okt 2026.
// Halaman umum dibangun dari SPEC lewat reportPage(); halaman dengan tata letak khusus punya fungsi sendiri.

// mode data (dataMode / isSample) ada di store.js

// angka acak yang stabil per halaman supaya tampilan tidak berubah tiap render
function seeded(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PERIOD = '01 Oktober 2026 - 31 Oktober 2026';
const DATE_BTN = '01 Okt 2026 - 31 Okt 2026';
const KPI_COLORS = ['#3ED0A8', '#1890FF', '#7B2FD0', '#6CB8F0', '#F5813F'];

// ---------- data contoh per jenis kolom ----------
const SAMPLE = {
  produk: ['Es Kopi Susu', 'Americano', 'Croissant', 'Matcha Latte', 'Nasi Goreng', 'Teh Tarik', 'Roti Bakar'],
  pelanggan: ['Rina Wulandari', 'Dimas Saputra', 'Ayu Lestari', 'Fajar Nugroho', 'Sari Putri', 'Bagus Hartono'],
  staf: ['Bayu', 'Sinta', 'Raka', 'Dewi'],
  outlet: ['by cafe', 'Outlet Utama', 'Outlet Cabang 2'],
  kategori: ['Kopi', 'Non Kopi', 'Makanan', 'Snack'],
  departemen: ['Minuman', 'Makanan'],
  pemasok: ['CV Sumber Kopi', 'PT Susu Segar', 'UD Roti Jaya'],
  order: ['Dine In', 'Take Away', 'Order Online'],
  bayar: ['Tunai', 'QRIS', 'Debit BCA', 'Transfer'],
  status: ['Aktif', 'Selesai', 'Lunas', 'Diproses']
};

function sampleCell(col, i, r, title) {
  const c = col.toUpperCase();
  const pick = a => a[Math.floor(r() * a.length)];
  const day = String(1 + ((i * 3 + 2) % 17)).padStart(2, '0');
  const time = `${String(8 + (i * 2) % 12).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`;
  const money = base => rp(Math.round((base * (0.3 + r())) / 500) * 500);
  if (c.includes('%')) return (r() * 40 + 2).toFixed(2).replace('.', ',') + '%';
  if (/PONSEL|TELEPON/.test(c)) return '08' + Math.floor(1e9 + r() * 8e9);
  if (/STATUS/.test(c)) return { badge: pick(SAMPLE.status) };
  if (c === 'BAYAR') return { badge: 'Lunas' };
  if (c === 'ORDER') return { badge: 'Selesai' };
  if (/RATA-RATA|WAKTU TER|ORDER-PROSES|PROSES-SELESAI|^TOTAL \((PRODUK|ORDER)\)/.test(c)) return `00:${String(3 + Math.floor(r() * 12)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
  if (/JAM KERJA/.test(c)) return `8 jam ${Math.floor(r() * 50)} menit`;
  if (/SISA HARI/.test(c)) return String(5 + Math.floor(r() * 60)) + ' hari';
  if (/\(RP\)|HARGA|NOMINAL|TAGIHAN|SALDO|NILAI|SUBTOTAL|MODAL|TOTAL BAYAR|TOTAL PENERIMAAN|SISA DEPOSIT|UANG MUKA|PENJUALAN DEPOSIT|MINIMAL PEMBELIAN|BESARAN|^TOTAL$/.test(c)) {
    return money(/HARGA|BESARAN/.test(c) ? 35000 : /MINIMAL/.test(c) ? 100000 : 850000);
  }
  if (/DURASI|PERIODE PENUKARAN|MASA BERLAKU/.test(c)) return '01 Okt - 31 Okt 2026';
  if (/TANGGAL|WAKTU|PERIODE|KEDALUWARSA|JATUH TEMPO|KUNJUNGAN TERAKHIR|DIJADWALKAN|ABSEN/.test(c)) {
    return /WAKTU|ABSEN/.test(c) ? `${day} Okt 2026, ${time}` : `${day} Okt 2026`;
  }
  if (/SKU/.test(c)) return 'SKU-' + String(1001 + i * 13);
  if (/BATCH/.test(c)) return 'BTH-2610-' + String(11 + i);
  if (/^(NO|NOMOR|KODE)\b|NO\.|REFERENSI/.test(c)) {
    const pre = /INVOICE/.test(c) ? 'INV' : /FAKTUR/.test(c) ? 'PI' : /PELANGGAN/.test(c) ? 'CUST' : /PEMASOK/.test(c) ? 'SUP' : /KUPON/.test(c) ? 'KPN' : /MUTASI/.test(c) ? 'MUT' : /PRODUKSI/.test(c) ? 'PRD' : /PEMESANAN/.test(c) ? 'PO' : /RESERVASI/.test(c) ? 'RSV' : 'TRX';
    return `${pre}-2610${day}-${String(101 + i * 7).padStart(4, '0')}`;
  }
  if (/STOK SUMBER|STOK HASIL|BARANG|PRODUK$|^PRODUK|NAMA PRODUK|NAMA PAKET|EKSTRA/.test(c) && !/JUMLAH|TERDAFTAR|DAPAT/.test(c)) return pick(SAMPLE.produk);
  if (/JUMLAH|^TOTAL|KUANTITAS|^STOK|POIN|URUTAN|TERJUAL|^SISA|^AWAL|^MASUK|^AKHIR|TERDAFTAR|TRANSAKSI|PERPUTARAN|HARI TERJUAL|JML/.test(c)) return String(1 + Math.floor(r() * (/STOK|AWAL|AKHIR|SISA|MASUK/.test(c) ? 120 : 60)));
  if (/OUTLET/.test(c)) return pick(SAMPLE.outlet);
  if (/KASIR|DIBUAT OLEH|NAMA LOGIN|KARYAWAN|PENYEDIA|OTORISASI/.test(c)) return pick(SAMPLE.staf);
  if (/PELANGGAN/.test(c)) return pick(SAMPLE.pelanggan);
  if (/PEMASOK/.test(c)) return pick(SAMPLE.pemasok);
  if (/KATEGORI/.test(c)) return pick(SAMPLE.kategori);
  if (/DEPARTEMEN/.test(c)) return pick(SAMPLE.departemen);
  if (/JENIS ORDER/.test(c)) return pick(SAMPLE.order);
  if (/METODE|JENIS PEMBAYARAN/.test(c)) return pick(SAMPLE.bayar);
  if (/JENIS PAJAK/.test(c)) return 'PB1 10%';
  if (/JENIS KELAMIN/.test(c)) return pick(['Laki-laki', 'Perempuan']);
  if (/ALAMAT/.test(c)) return pick(['Jl. Merdeka No. 12', 'Jl. Sudirman No. 4', 'Jl. Diponegoro No. 88']);
  if (/SATUAN/.test(c)) return pick(['pcs', 'kg', 'liter', 'gram']);
  if (/CATATAN|DESKRIPSI|KETERANGAN/.test(c)) return pick(['-', 'Stok mingguan', 'Promo akhir pekan', 'Pesanan rutin']);
  if (/TERMINAL|DEVICE/.test(c)) return 'Kasir-0' + (1 + (i % 3));
  if (/MEJA/.test(c)) return 'Meja ' + (1 + i);
  if (/MEDIA/.test(c)) return pick(['WhatsApp', 'Email', 'SMS']);
  if (/TIPE|JENIS/.test(c)) return pick(/Stok|Persediaan|Perputaran/.test(title) ? ['Produk', 'Bahan'] : ['Persentase', 'Nominal']);
  if (/PROMO|PROGRAM|REWARD|KUPON|GRUP|NAMA DEPOSIT|NAMA LAYANAN|PAKET|ORDER/.test(c)) return pick(['Promo Gajian', 'Member Hemat', 'Paket Ngopi', 'Diskon Weekday']);
  if (/KRITERIA|BONUS|SETTING/.test(c)) return pick(['Min. belanja Rp 50.000', 'Diskon 10%', 'Wajib, maks 1']);
  if (/NAMA/.test(c)) {
    if (/Pelanggan/.test(title)) return pick(SAMPLE.pelanggan);
    if (/Pemasok/.test(title)) return pick(SAMPLE.pemasok);
    if (/Absensi/.test(title)) return pick(SAMPLE.staf);
    return pick(SAMPLE.produk);
  }
  return '-';
}

function kpiValue(kind, r) {
  if (kind && kind[0] === '=') return kind.slice(1);   // nilai jadi dari data (laporan.js)
  const sample = isSample();
  switch (kind) {
    case 'Rp': return sample ? rp(Math.round(r() * 2.4e7 / 1000) * 1000) : 'Rp 0';
    case 'Rp,00': return sample ? rp(Math.round(r() * 2.4e7 / 1000) * 1000) + ',00' : 'Rp 0,00';
    case '%': return sample ? (r() * 12).toFixed(2).replace('.', ',') + '%' : '0,00%';
    case 'Produk': return (sample ? Math.floor(r() * 400) : 0) + ' Produk';
    case 'Unlimited': return 'Unlimited';
    default: return String(sample ? Math.floor(r() * 300) : 0);
  }
}

// ---------- komponen ----------
const linkBtn = (label, icon) => `<button class="h-9 px-2 text-brand text-[14px] font-semibold flex items-center gap-2 whitespace-nowrap">${icon ? `<i data-lucide="${icon}" class="ic-sm"></i>` : ''}${label}</button>`;

function actionsHtml(list = []) {
  return list.map(a => {
    const [type, label, icon] = a.split(':');
    return (type === 'P' ? btnPrimary(label, icon) : linkBtn(label, icon)).replace('<button', `<button data-tool="${label}"`);
  }).join('');
}

function pageHead(title, s = {}) {
  const period = s.per === null ? '' : `<p class="flex items-center gap-2 text-[12px] font-medium text-ink-2 mt-2"><i data-lucide="calendar" class="ic-sm"></i>${s.per || PERIOD}</p>`;
  const sub = s.sub ? `<p class="text-[12px] text-ink-3 mt-2">${s.sub}</p>` : '';
  return `
    <div class="flex flex-wrap items-start gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-3">
          <h1 class="text-[20px] font-semibold leading-7">${title}</h1>
          ${s.help ? '<i data-lucide="help-circle" class="text-brand" style="width:22px;height:22px"></i>' : ''}
          <i data-lucide="star" class="text-ink-4" style="width:22px;height:22px"></i>
        </div>${period}${sub}
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">${actionsHtml(s.a)}</div>
    </div>`;
}

function filterEl(f) {
  if (f.startsWith('x:')) return lapSel(f.slice(2));   // filter yang berfungsi (laporan.js)
  if (f === 's') return search('w-[200px]');
  if (f.startsWith('d')) return dateBtn(f.includes(':') ? f.slice(2) : DATE_BTN);
  const [type, val] = [f.slice(0, f.indexOf(':')), f.slice(f.indexOf(':') + 1)];
  if (type === 'sel') return select(val, 'w-[200px]');
  if (type === 'in') return `<button class="input w-[190px] h-9 flex items-center justify-between text-[#A0A6A6]">${val}<span class="text-[10px] text-ink">&#9660;</span></button>`;
  if (type === 'seg') {
    return `<div class="seg seg-sm flex border border-line rounded-lg overflow-hidden lg:ml-auto">${val.split('|').map((x, i) => `<button class="${i ? '' : 'active'}">${x}</button>`).join('')}</div>`;
  }
  return '';
}
const filterRow = list => list && list.length ? `<div class="flex flex-wrap items-center gap-2">${list.map(filterEl).join('')}</div>` : '';

function kpiCards(list, r) {
  return `<div class="grid grid-cols-2 md:grid-cols-${Math.min(list.length, 5)} gap-4">${list.map((k, i) => {
    const [label, kind] = k.split('|');
    const color = /Void/i.test(label) ? '#E5333F' : KPI_COLORS[i % KPI_COLORS.length];
    return `<div class="card flex flex-col"><div class="px-4 pt-3 pb-3 flex-1"><p class="text-[14px] text-ink-2">${label}</p><p class="text-[16px] font-semibold mt-1">${kpiValue(kind, r)}</p></div><div class="kpi-bar" style="background:${color}"></div></div>`;
  }).join('')}</div>`;
}

function badge(txt) {
  const tone = /Tidak|Void|Batal/.test(txt) ? ['#F2F2F2', '#777777', '#A0A6A6'] : /Proses|Belum/.test(txt) ? ['#FFFBE6', '#8A6D00', '#F5D90A'] : ['#E6F9F4', '#10AF8C', '#04C99E'];
  return `<span class="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-1 rounded whitespace-nowrap" style="background:${tone[0]};color:${tone[1]}"><span class="w-1.5 h-1.5 rounded-full" style="background:${tone[2]}"></span>${txt}</span>`;
}

const emptyTable = () => `
  <div class="flex flex-col items-center py-12">
    ${empty('').replace('<p class="text-[14px] text-ink-3 mt-4"></p>', '').replace('py-14', 'py-0')}
    <p class="text-[14px] font-semibold mt-4">Data tidak tersedia</p>
    <p class="text-[14px] text-ink-3 mt-1">Belum ada data yang dapat ditampilkan di halaman ini</p>
  </div>`;

const pager = n => `
  <div class="flex flex-wrap items-center justify-between gap-3 mt-4 text-[12px] text-ink-3">
    <span>Tampilkan: <b class="text-ink">10</b> &#709; &nbsp; Ditampilkan 1 - ${n} dari ${n} data</span>
    <span class="flex items-center gap-2 text-[#A0A6A6]"><i data-lucide="arrow-left" class="ic-sm"></i> Sebelumnya <span class="w-7 h-7 rounded bg-brand text-white font-semibold flex items-center justify-center">1</span> Selanjutnya <i data-lucide="arrow-right" class="ic-sm"></i></span>
  </div>`;

function tableHtml(s, title, r) {
  let rows = s.rows || (isSample() ? Array.from({ length: s.n || 6 }, (_, i) => s.cols.map(c => sampleCell(c, i, r, title))) : s.emptyRows || []);
  const cell = v => (v && v.badge) ? badge(v.badge) : /^(Aktif|Tidak Aktif)$/.test(v) ? badge(v) : v;
  // kolom bisa disembunyikan lewat tombol + di ujung header
  const hid = colHidden(state.page, s.cols, s.hide), vis = i => (hid.has(i) ? ' hidden' : '');
  const check = s.check ? '<th class="w-8"><input type="checkbox" autocomplete="off" data-rall class="accent-[#04C99E]"></th>' : '';
  const head = `<thead><tr>${check}${s.cols.map((c, i) => `<th data-col="${i}" class="min-w-[110px] max-w-[170px] whitespace-normal align-bottom${vis(i)}">${c}</th>`).join('')}${colPickTh}</tr></thead>`;
  const body = rows.map((row, n) => `<tr${s.attrs ? ' ' + s.attrs[n] : ''}>${s.check ? '<td><input type="checkbox" autocomplete="off" data-rchk class="accent-[#04C99E]"></td>' : ''}${row.map((v, i) => `<td data-col="${i}" class="whitespace-nowrap${vis(i)}">${cell(v)}</td>`).join('')}<td class="sticky right-0 bg-white"></td></tr>`).join('');
  return `<div class="overflow-x-auto mt-2"><table class="tbl w-full min-w-max">${head}<tbody>${body}</tbody></table></div>
    ${rows.length ? (s.pagerHtml || pager(rows.length)) : emptyTable()}`;
}

function chartBlock(s) {
  const sel = (c, w) => (c.startsWith('x:') ? lapSel(c.slice(2), w) : select(c, w));
  const ctl = (s.ctl || []).map(c => sel(c, 'w-[160px]')).join('');
  return `
    <div class="border-t border-b border-line py-4 my-4">
      <div class="flex items-center gap-3">
        <h3 class="text-[16px] font-semibold">${s.chart}</h3>
        ${s.ctlRight ? `<div class="ml-auto">${sel(s.ctlRight, 'w-[180px]')}</div>` : ''}
        ${s.noHide ? '' : `<button class="${s.ctlRight ? '' : 'ml-auto'} text-brand text-[14px] flex items-center gap-1" data-hide-chart>Sembunyikan <i data-lucide="chevron-up" class="ic-sm"></i></button>`}
      </div>
      <div data-chart-body>
        ${ctl ? `<div class="flex flex-wrap gap-2 mt-4">${ctl}</div>` : ''}
        <div class="h-[300px] mt-4"><canvas id="rptChart"></canvas></div>
      </div>
    </div>`;
}

// series dari laporan.js: { labels, sets: [{ label, data }], uang } — tanpa series memakai angka contoh
const SERI_WARNA = ['#04C99E', '#1890FF', '#7B2FD0', '#F5813F', '#F5D90A', '#E5333F', '#6CB8F0'];
function drawReportChart(seed, series) {
  const el = document.getElementById('rptChart');
  if (!el) return;
  const r = seeded(seed);
  const labels = series ? series.labels : Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0') + ' Okt');
  const sets = series ? series.sets : [{ data: labels.map((_, i) => isSample() ? Math.round((300 + 250 * Math.sin(i / 2.3) + r() * 300 + (i % 7 > 4 ? 300 : 0)) * 1000) : 0) }];
  const uang = !series || series.uang !== false;
  const fmt = v => (uang ? rp(v) : Number(v).toLocaleString('id-ID'));
  charts.push(new Chart(el, {
    type: 'line',
    data: { labels, datasets: sets.map((d, i) => ({ label: d.label || '', data: d.data, borderColor: SERI_WARNA[i % SERI_WARNA.length], backgroundColor: sets.length > 1 ? 'transparent' : 'rgba(4,201,158,.08)', fill: sets.length === 1, tension: .35, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 4, borderWidth: 2.5 })) },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: sets.length > 1, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: '#404545', font: { size: 12 } } }, tooltip: { backgroundColor: '#fff', titleColor: '#272A2A', bodyColor: '#404545', borderColor: '#EEEEEE', borderWidth: 1, callbacks: { label: c => ` ${c.dataset.label ? c.dataset.label + ': ' : ''}${fmt(c.raw)}` } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#272A2A', font: { size: 12 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 } },
        y: { suggestedMax: series || isSample() ? undefined : 200, beginAtZero: true, border: { display: false }, grid: { color: '#E0E0E0' }, ticks: { color: '#404545', font: { size: 12 }, maxTicksLimit: 5, callback: v => !uang ? v.toLocaleString('id-ID') : v >= 1e6 ? 'Rp ' + (v / 1e6).toLocaleString('id-ID') + ' jt' : v >= 1e3 ? 'Rp ' + (v / 1e3).toLocaleString('id-ID') + ' rb' : 'Rp ' + v } }
      }
    }
  }));
}

function bindChartToggle() {
  document.querySelectorAll('[data-hide-chart]').forEach(b => b.addEventListener('click', () => {
    const body = b.closest('div.border-t').querySelector('[data-chart-body]');
    body.classList.toggle('hidden');
    b.innerHTML = body.classList.contains('hidden') ? 'Tampilkan <i data-lucide="chevron-down" class="ic-sm"></i>' : 'Sembunyikan <i data-lucide="chevron-up" class="ic-sm"></i>';
    lucide.createIcons();
  }));
}

const noticeBox = n => `
  <div class="rounded-md border border-[#91CAFF] bg-[#E6F4FF] px-4 py-3 mb-5 flex flex-wrap items-end gap-3">
    <div class="flex-1 min-w-[240px]"><p class="text-[16px] font-semibold">${n.title}</p><p class="text-[14px] text-ink-2 mt-1">${n.text}</p></div>
    ${n.link ? `<a href="${n.link[1]}" class="text-brand text-[14px]">${n.link[0]}</a>` : ''}
  </div>`;

// ---------- template utama ----------
function reportPage(s, slug) {
  killCharts();
  const title = s.title;
  const r = seeded(slug);
  const tabs = s.tabs ? `<div class="flex gap-6 border-b border-line mb-4 text-[14px] overflow-x-auto">${s.tabs.map((t, i) => `<button class="pb-2 px-2.5 font-medium whitespace-nowrap ${i ? 'text-ink-2' : 'text-brand border-b-2 border-brand'}">${t}</button>`).join('')}</div>` : '';
  const tabs2 = s.tabs2 ? `<div class="grid grid-cols-${s.tabs2.length} border-b border-line mt-4 text-[14px] font-medium">${s.tabs2.map((t, i) => `<button class="pb-3 ${i ? 'text-ink-2' : 'text-brand border-b-2 border-brand'}">${t}</button>`).join('')}</div>` : '';
  const kpis = [s.k, s.k2].filter(Boolean).map(k => kpiCards(k, r)).join('<div class="h-4"></div>');
  const html = `
    ${s.topNote ? `<p class="text-[14px] text-ink-2 mb-3 px-1">${s.topNote}</p>` : ''}
    <section class="card p-5">
      ${s.notice ? noticeBox(s.notice) : ''}
      ${pageHead(title, s)}
      ${hr}
      ${tabs}
      ${s.note ? `<p class="text-[14px] text-ink-2 mb-4 flex items-center gap-2"><i data-lucide="info" class="ic-sm" style="fill:#585F5F;color:#fff"></i>${s.note}</p>` : ''}
      ${filterRow(s.f)}
      ${s.f2 ? `<div class="mt-2">${filterRow(s.f2)}</div>` : ''}
      ${s.hint ? `<p class="text-[12px] text-brand mt-2">${s.hint}</p>` : ''}
      ${tabs2}
      ${s.chart ? chartBlock(s) : (s.f ? hr : '')}
      ${kpis ? `<div class="mb-6">${kpis}</div>` : ''}
      ${s.cols ? tableHtml(s, title, r) : ''}
      ${s.foot ? `<p class="text-right text-[12px] italic text-ink-4 mt-4">${s.foot === true ? 'Terakhir diperbarui beberapa detik yang lalu' : s.foot}</p>` : ''}
    </section>`;
  window.PENDING_INIT = () => { if (s.chart) drawReportChart(slug, s.series); bindChartToggle(); };
  return html;
}

// ---------- spesifikasi halaman ----------
const EXP = 'P:Ekspor Laporan:download';
const R = (title, o) => ({ title, a: [EXP], f: ['s', 'd'], ...o });                 // halaman laporan
const D = (title, o) => ({ title, per: null, f: ['s'], ...o });                       // halaman daftar / master data
const T = (title, o) => ({ title, f: ['s', 'd'], ...o });                             // daftar transaksi berperiode

const SPEC = {
  // Laporan Penjualan
  'detail-penjualan': R('Detail Penjualan', { help: 1, a: ['L:Atur Tabel:table', 'L:Filter:filter', EXP], f: ['s', 'd', 'sel:Waktu Order'], k: ['Total Penjualan|Rp', 'Total Transaksi|#', 'Penjualan Bersih|Rp', 'Total Pembayaran|Rp', 'Total Piutang|Rp'], cols: ['No Transaksi', 'Waktu Order', 'Waktu Bayar', 'Outlet', 'Jenis Order', 'Total Penjualan (Rp)', 'Metode Pembayaran', 'Bayar', 'Order'], foot: true }),
  'penjualan-per-periode': R('Penjualan Per Periode', { f: ['s', 'd', 'sel:Hari', 'sel:Semua Jenis Order'], chart: 'Grafik Penjualan Per Periode', k: ['Total Penjualan|Rp', 'Total Laba Kotor|Rp', 'Total Transaksi|#', 'Total Produk|#'], cols: ['Periode', 'Penjualan (Rp)', 'Laba Kotor (Rp)', 'Total Produk', 'Total Transaksi', 'Pengembalian (Rp)', 'Komisi (Rp)', 'Order/Transaksi (Rp)', 'Produk/Transaksi'] }),
  'laporan-jenis-bayar': R('Laporan Jenis Bayar', { chart: 'Grafik Jenis Pembayaran', ctl: ['Hari', 'Penjualan'], k: ['Total Transaksi Terbayar|#', 'Total Penjualan Terbayar|Rp', 'Total Jenis Pembayaran|#'], k2: ['Total Transaksi Deposit|#', 'Total Transaksi Uang Muka|#', 'Total Penjualan Deposit|Rp', 'Total Penerimaan Uang Muka|Rp'], cols: ['Jenis Pembayaran', 'Jumlah Transaksi', 'Transaksi (%)', 'Jml Transaksi Deposit', 'Jml Transaksi Uang Muka', 'Penjualan (Rp)', 'Penjualan (%)', 'Penjualan Deposit', 'Penerimaan Uang Muka'], foot: 'Terakhir Diperbarui: beberapa detik yang lalu', n: 4 }),
  'laporan-jenis-order': R('Laporan Jenis Order', { chart: 'Grafik Jenis Order', ctl: ['Hari', 'Penjualan'], k: ['Total Transaksi|#', 'Total Penjualan|Rp,00'], cols: ['Jenis Order', 'Jumlah Transaksi', 'Jumlah Transaksi (%)', 'Penjualan (Rp)', 'Penjualan %'], n: 3 }),
  'laporan-void': R('Laporan Void', { per: '01 Oktober - 31 Oktober 2026', f: ['s', 'd', 'sel:Semua Jenis Order'], k: ['Total Void|Rp', 'Total Transaksi|#'], cols: ['No Nota', 'Tanggal Void', 'Tanggal Order', 'Kasir', 'Otorisasi', 'Produk', 'Subtotal Void', 'Jenis Order', 'Nama Meja'] }),
  'laporan-refund': R('Laporan Refund', { a: ['L:Atur Tabel:table', EXP], f: ['s', 'd', 'seg:Semua|Tunai|Non Tunai'], k: ['Total Transaksi Refund|#', 'Total Refund|Rp'], cols: ['No Transaksi Refund', 'Tanggal', 'Refund (Rp)', 'Metode Pembayaran', 'Nama Outlet'] }),
  // Laporan Dapur
  'laporan-proses-order': R('Laporan Waktu Proses Order', { cols: ['No Order', 'Periode', 'Produk', 'Jumlah', 'Order-Proses (Produk)', 'Proses-Selesai (Produk)', 'Total (Produk)', 'Order-Proses (Order)', 'Proses-Selesai (Order)', 'Total (Order)'] }),
  'laporan-proses-produk': R('Laporan Waktu Proses Produk', { cols: ['Produk', 'Jumlah', 'Rata-rata Order-Proses', 'Rata-rata Proses-Selesai', 'Rata-rata Total Waktu', 'Waktu Tercepat', 'Waktu Terlama'] }),
  // Laporan Produk
  'penjualan-produk': R('Penjualan Produk', { f2: ['sel:Semua Kategori', 'sel:Semua Departemen', 'in:Pilih Jenis Order', 'sel:Semua Jenis Produk'], hint: '46 jenis order terpilih', chart: 'Grafik Penjualan Produk', ctl: ['Hari', 'Penjualan'], k: ['Total Penjualan Per Produk|Rp', 'Total Produk Terjual|Produk', 'Total Laba Kotor Per Produk|Rp'], cols: ['Produk', 'SKU', 'Departemen', 'Kategori', 'Jenis Produk', 'Jumlah', 'Penjualan (Rp)', 'Jumlah Refund', 'Refund (Rp)', 'Jumlah (%)', 'Penjualan (%)', 'HPP (Rp)', 'HPP Refund (Rp)', 'Laba Kotor (Rp)'] }),
  'penjualan-departemen': R('Penjualan Departemen', { k: ['Total Departemen|#', 'Total Penjualan Departemen|Rp'], cols: ['Departemen', 'Jumlah Produk', 'Produk (%)', 'Penjualan (Rp)', 'Penjualan (%)'], n: 2 }),
  'penjualan-kategori': R('Penjualan Kategori', { f: ['s', 'd', 'sel:Semua Departemen'], chart: 'Grafik Penjualan Kategori', ctl: ['Hari', 'Penjualan'], k: ['Total Kategori|#', 'Total Penjualan Kategori|Rp'], cols: ['Kategori', 'Jumlah Produk', 'Produk (%)', 'Penjualan (Rp)', 'Penjualan (%)', 'HPP (Rp)'], n: 4 }),
  'penjualan-ekstra': R('Penjualan Ekstra', { chart: 'Grafik Penjualan Ekstra', ctl: ['Hari', 'Penjualan'], k: ['Total Ekstra|#', 'Total Item Ekstra|#', 'Total Penjualan Ekstra|Rp', 'Total Refund Ekstra|Rp'], cols: ['Nama Ekstra', 'Jumlah', 'Jumlah (%)', 'Penjualan (Rp)', 'Penjualan (%)', 'Laba Kotor (Rp)', 'Laba Kotor (%)', 'Jumlah Refund', 'Refund (Rp)'] }),
  'penjualan-sub-ekstra': R('Penjualan Sub Ekstra', { chart: 'Grafik Penjualan Sub Ekstra', ctl: ['Hari', 'Penjualan'], k: ['Total Sub Ekstra|#', 'Total Penjualan|Rp', 'Total Refund Sub Ekstra|Rp'], cols: ['Sub Ekstra', 'Ekstra', 'Jumlah', 'Jumlah %', 'Penjualan (Rp)', 'Penjualan %', 'Laba Kotor (Rp)', 'Laba Kotor %', 'Jumlah Refund', 'Refund (Rp)'] }),
  // Laporan Jasa
  'laporan-jasa-detail': R('Laporan Jasa', { cols: ['Tanggal', 'No Transaksi', 'Pelanggan', 'Order', 'Kasir', 'Status'] }),
  'laporan-reservasi': R('Laporan Reservasi', { cols: ['Tanggal Reservasi', 'No Reservasi', 'Pelanggan', 'Order', 'Tanggal Buat', 'Status Layanan'] }),
  'laporan-reservasi-dan-utilisasi': R('Laporan Reservasi & Utilisasi', { f: ['s', 'd', 'sel:Hari'], tabs2: ['Reservasi', 'Utilisasi'], chart: 'Grafik Performa Reservasi', noHide: true, k: ['Total Reservasi Dibuat|#', 'Total Reservasi Selesai|#', 'Total Reservasi Dibatalkan|#', 'Tingkat Pembatalan|%'], cols: ['Tanggal Reservasi', 'No Reservasi', 'Pelanggan', 'Nama Layanan', 'Penyedia Jasa', 'Total Tagihan', 'Status Layanan'] }),
  // Laporan Promo & Loyalti
  'laporan-promo': R('Laporan Promo', { chart: 'Grafik Promo', ctl: ['Hari'], k: ['Total Transaksi dengan Promo|#', 'Nilai Promo|Rp', 'Total Penjualan dengan Promo|Rp'], cols: ['Tanggal', 'Promo', 'Jenis', 'Outlet', 'Jumlah Transaksi', 'Nilai'] }),
  'laporan-poin': R('Laporan Poin', { f: ['d', 'sel:Hari', 'in:Tipe Mutasi'], chart: 'Grafik Poin', ctlRight: 'Poin Didapatkan', k: ['Total Poin Didapatkan|#', 'Total Poin Ditukar|#', 'Total Poin Dibatalkan|#'], cols: ['Tanggal', 'Poin Didapat', 'Transaksi Dapat Poin', 'Transaksi Dapat Poin (Rp)', 'Produk Dapat Poin (Rp)', 'Poin Ditukar', 'Transaksi Tukar Poin', 'Nilai Tukar (Rp)', 'Transaksi Tukar Poin (Rp)', 'Poin Dibatalkan', 'Transaksi Refund'] }),
  'laporan-komplimen': R('Laporan Komplimen', { per: '01 Oktober - 31 Oktober 2026', k: ['Jumlah Komplimen Digunakan|#', 'Total Transaksi Komplimen|Rp'], cols: ['No Transaksi', 'Waktu', 'Kasir', 'Jml Produk', 'Otorisasi', 'Komplimen (Rp)'] }),
  // Laporan Pajak
  'laporan-pajak-detail': R('Laporan Pajak', { notice: { title: 'Menu Baru: Laporan Service Charge', text: 'Data service charge kini tidak lagi tercatat di Laporan Pajak dan telah dipindahkan ke menu Laporan Service Charge.', link: ['Menu Laporan Service Charge', '#/penjualan/laporan-service-charge'] }, f: ['d'], k: ['Total Transaksi|#', 'Total DPP|Rp', 'Total Pajak|Rp'], cols: ['Jenis Pajak', 'Transaksi', 'DPP (Rp)', 'Total Pajak (Rp)'], n: 1, foot: 'Terakhir Diperbarui: -' }),
  'laporan-service-charge': R('Laporan Service Charge', { f: ['d', 'seg:Hari|Bulan|Tahun'], k: ['Total Transaksi|#', 'Total Penjualan|Rp', 'Total Service Charge|Rp'], cols: ['Tanggal', 'Transaksi', 'Penjualan (Rp)', 'Service Charge (Rp)'], foot: 'Terakhir Diperbarui: -' }),
  // Laporan Kasir
  'laporan-kas-kasir': R('Laporan Kas Kasir', { k: ['Total Kas Kasir|Rp', 'Total Uang Masuk|Rp', 'Total Uang Keluar|Rp'], cols: ['Transaksi', 'Tanggal', 'Outlet', 'Masuk (Rp)', 'Keluar (Rp)', 'Kategori', 'Nama Login', 'Nama Device'] }),
  'penjualan-per-kasir': R('Penjualan per Kasir', { f: ['s', 'd', 'sel:Kasir Bayar'], chart: 'Grafik per Kasir', ctl: ['Hari', 'Penjualan'], cols: ['Kasir', 'Outlet', 'Penjualan (Rp)', 'Penjualan (%)', 'Laba Kotor (Rp)', 'Laba Kotor (%)', 'Jumlah Transaksi', 'Transaksi (%)', 'Jumlah Produk', 'Produk (%)', 'Pengembalian (Rp)'], n: 3 }),
  'penjualan-per-terminal': R('Penjualan per Terminal', { cols: ['Terminal', 'Outlet', 'Penjualan (Rp)', 'Laba Kotor (Rp)', 'Jumlah Transaksi', 'Jumlah Produk', 'Pengembalian (Rp)'], n: 3 }),
  'laporan-tutup-kasir': R('Laporan Tutup Kasir', { cols: ['Waktu Buka / Tutup Kasir', 'Kasir', 'Outlet', 'Modal Awal (Rp)', 'Kas Masuk (Rp)', 'Kas Keluar (Rp)', 'Total Penerimaan Tunai (Rp)', 'Total Penerimaan Non Tunai (Rp)', 'Total Penerimaan Kasir (Rp)', 'Total Penerimaan Online (Rp)', 'Total Penerimaan E-Commerce (Rp)', 'Total Penerimaan (Rp)', 'Refund Tunai (Rp)', 'Refund Non Tunai (Rp)', 'Saldo Akhir (Rp)', 'Total Tunai Aktual (Rp)', 'Total Tunai Sistem (Rp)', 'Selisih (Rp)'], emptyRows: [['<b>Buka:</b> 16 Oktober 2026, 21:38<br><b>Tutup:</b> -', 'Bayu', 'by cafe', ...Array(15).fill('Rp 0')]] }),
  // Laporan Deposit
  'penjualan-deposit': R('Penjualan Deposit', { per: '01 Oktober - 31 Oktober 2026', k: ['Jumlah Transaksi Deposit|#', 'Total Deposit Diterima Pelanggan|Rp', 'Total Penjualan Deposit|Rp'], cols: ['No. Transaksi', 'Tanggal Transaksi', 'Kasir', 'Pelanggan', 'Nama Deposit', 'Jenis Deposit', 'Nilai Deposit', 'Kedaluwarsa', 'Total Pembayaran', 'Metode Pembayaran'] }),
  'deposit-kadaluarsa': R('Deposit Kedaluwarsa', { k: ['Total Deposit Kedaluwarsa|#', 'Total Nominal Kedaluwarsa|Rp'], cols: ['No Transaksi', 'Tanggal', 'Pelanggan', 'Nama Paket', 'Tanggal Kedaluwarsa', 'Nominal Kedaluwarsa', 'Outlet'] }),
  'sisa-deposit': R('Laporan Sisa Deposit', { per: '17 Oktober 2026', cols: ['Pelanggan', 'Sisa Deposit'] }),
  // Laporan Pelanggan & Karyawan
  'laporan-pelanggan-detail': R('Laporan Pelanggan', { per: '01 Oktober - 31 Oktober 2026', cols: ['Nama', 'Alamat', 'No Ponsel', 'Tanggal Registrasi', 'Outlet Registrasi', 'Total Transaksi', 'Total Penjualan (Rp)', 'Kunjungan Terakhir', 'Rata-rata Kunjungan/Bulan', 'Rata-rata Penjualan/Bulan'] }),
  'absensi': R('Absensi', { cols: ['Nama', 'Tanggal', 'Absen Masuk', 'Absen Keluar', 'Total Jam Kerja Aktual', 'Outlet', 'Status', 'Catatan'] }),
  // Laporan Persediaan
  'lap-ringkasan-persediaan': R('Laporan Ringkasan Persediaan', { per: '17 Oktober 2026', f: ['s', 'd:17 Okt 2026', 'sel:Semua Kategori', 'sel:Semua Jenis'], k: ['Total Nilai Persediaan|Rp'], cols: ['Nama Produk', 'SKU', 'Jenis', 'Kategori', 'Kuantitas', 'Satuan', 'Harga Modal', 'Total Nilai Persediaan'] }),
  'lap-detail-persediaan': R('Laporan Detail Persediaan', { note: 'Harap pilih outlet dan produk terlebih dahulu untuk menampilkan data pada Laporan Detail Persediaan', f: ['d', 'in:Pilih Outlet', 'in:Pilih Produk', 'sel:Semua Jenis'], cols: ['Outlet', 'Tanggal Transaksi', 'Transaksi', 'No Transaksi', 'Kuantitas', 'Satuan', 'Harga Jual/Beli', 'Stok', 'Harga Modal', 'Total Nilai Persediaan'] }),
  'laporan-batch-number': R('Laporan Batch Number', { note: 'Harap pilih outlet dan produk terlebih dahulu untuk menampilkan data pada Laporan Batch Number', f: ['d', 'in:Pilih Produk', 'in:Pilih Outlet', 'in:Pilih Widget'], hint: '9 Widget dipilih', cols: ['Outlet', 'Batch Number', 'Tanggal Kedaluwarsa', 'Sisa Hari Kedaluwarsa', 'Jenis Transaksi', 'No Transaksi', 'Tanggal', 'Stok', 'Stok Akhir'] }),
  // Laporan Settlement
  'settlement-qris': R('Laporan Settlement QRIS', { per: '17 Oktober 2026 - 17 Oktober 2026', tabs: ['Transaksi Berhasil', 'Transaksi Gagal', 'Settlement Diproses', 'Settlement Tertunda', 'Settlement Berhasil'], f: ['s', 'd:17 Okt 2026 - 17 Okt 2026', 'sel:Semua Tipe', 'sel:Semua Status'], k: ['Total Penjualan|Rp', 'Total Biaya Transaksi|Rp', 'Total Settlement|Rp', 'Settlement Tertunda|Rp'], cols: ['No Transaksi', 'Tanggal Transaksi', 'Tipe QRIS', 'Nomor Referensi', 'Total', 'Status Settlement', 'Tanggal Settlement'] }),
  // Analisa Laporan
  'waktu-teramai-produk': R('Waktu Teramai Produk', { f: ['s', 'd', 'sel:Hari'], chart: 'Grafik Waktu Teramai Produk', cols: ['Produk', 'Waktu', 'Jumlah Produk', 'Produk (%)', 'Jumlah Transaksi', 'Transaksi (%)', 'Penjualan (Rp)', 'Penjualan (%)'], foot: true }),
  'perputaran-stok': R('Perputaran Stok', { f: ['s', 'd', 'sel:Semua Jenis', 'sel:Pilih'], k: ['Jumlah|#', 'Perputaran Stok|#', 'Hari Terjual|#'], cols: ['Nama', 'Jenis', 'Terjual', 'Sisa', 'Perputaran Stok', 'Hari Terjual'] }),
  // Produk
  'daftar-departemen': D('Daftar Departemen', { a: ['P:Tambah Departemen:plus'], cols: ['Departemen', 'Urutan Tampilan', 'Jumlah Kategori'], n: 2 }),
  'daftar-kategori': D('Daftar Kategori', { a: ['P:Tambah Kategori:plus'], f: ['s', 'seg:Semua|Tampil di Menu|Tidak Tampil di Menu'], cols: ['Nama Kategori', 'Urutan', 'Jumlah Produk', 'Departemen', 'Status'], n: 4 }),
  'produk-barang': D('Produk Barang', { a: ['L:Impor Data:upload', 'L:Ekspor Data:download', 'P:Tambah Produk:plus'], sub: '<b class="text-ink">by cafe</b> - 0 Produk barang', f: ['s', 'in:Pilih Kategori', 'seg:Semua|Tampil di Menu|Tidak Tampil di Menu'], check: true, cols: ['Nama Produk', 'SKU', 'Kategori', 'Harga Modal', 'Harga Beli', 'Harga Jual', 'Status'] }),
  'produk-ekstra': D('Produk Ekstra', { a: ['L:Ekspor Data:download', 'P:Tambah Ekstra:plus'], cols: ['Nama Ekstra', 'Setting Pilihan Ekstra'], n: 3 }),
  'produk-paket': D('Produk Paket', { a: ['L:Ekspor Data:download', 'P:Tambah Produk Paket:plus'], sub: 'by cafe - 0 Produk', f: ['s', 'seg:Semua|Tampil di Menu|Tidak Tampil di Menu'], cols: ['Nama Paket', 'Produk', 'Kategori', 'Harga', 'Status'], n: 3 }),
  'deposit': D('Daftar Deposit', { a: ['P:Tambah Deposit:plus'], f: ['s', 'seg:Semua|Aktif|Tidak Aktif'], cols: ['Nama Deposit', 'Harga', 'Masa Berlaku', 'Outlet', 'Status'], n: 3 }),
  'daftar-harga-ojek-online': D('Daftar Harga Ojek Online', { a: ['P:Tambah Ojek Online:plus'], f: ['s', 'sel:Tampilkan Semua Status'], cols: ['Nama Ojek Online', 'Deskripsi', 'Produk Terdaftar', 'Status'], rows: [['Grab', 'grab', '0', 'Tidak Aktif'], ['Go-Jek', 'Go-Jek', '0', 'Tidak Aktif']] }),
  // Inventori: Mutasi Antar Outlet (halaman Inventori lain ada di inventori.js)
  'stok-harus-dikirim': T('Stok Harus Dikirim', { a: ['P:Tambah Kirim Stok:plus'], cols: ['Nomor Permintaan', 'Tanggal Permintaan', 'Outlet Pengirim', 'Outlet Penerima', 'Barang Diminta', 'Catatan', 'Dibuat Oleh', 'Dijadwalkan'], n: 3 }),
  'kirim-stok': T('Kirim Stok', { a: ['L:Ekspor Data:download', 'P:Tambah Kirim Stok:plus'], cols: ['Tanggal', 'No Mutasi', 'Outlet Asal', 'Outlet Tujuan', 'Catatan', 'Dibuat Oleh', 'Status'], n: 3 }),
  'terima-mutasi-stok': T('Terima Mutasi Stok', { a: ['L:Ekspor Data:download', 'P:Tambah Terima Mutasi Stok:plus'], cols: ['Tanggal', 'No. Faktur', 'Produk', 'Jumlah', 'Dibuat Oleh', 'Status'], n: 3 }),
  'stok-transit': T('Stok Transit', { a: ['L:Ekspor Data:download'], cols: ['No Mutasi', 'Tanggal', 'Outlet Asal', 'Outlet Tujuan', 'Deskripsi', 'Dibuat Oleh', 'Status'], n: 2 }),
  // Promosi
  'promo-per-total-pembelian': T('Promosi Per Total Pembelian', { a: ['P:Tambah Promosi:plus'], f: ['s', 'd', 'in:Pilih Status'], hint: 'Aktif', cols: ['Nama', 'Tipe', 'Kriteria', 'Bonus', 'Durasi', 'Outlet', 'Status'], n: 3 }),
  'promo-per-produk': T('Promosi Per Produk', { a: ['P:Tambah Promosi:plus'], f: ['s', 'd', 'in:Pilih Status'], hint: 'Aktif', cols: ['Nama', 'Tipe', 'Produk', 'Kriteria', 'Bonus', 'Durasi', 'Outlet', 'Status'], n: 3 }),
  'tambah-kupon': T('Tambah Kupon', { a: ['P:Tambah Kupon:plus'], cols: ['Nama Kupon', 'Deskripsi', 'Besaran', 'Durasi', 'Outlet', 'Status'], n: 3 }),
  'daftar-kupon': T('Daftar Kupon', { a: ['P:Ekspor Excel:download'], f: ['s', 'd', 'sel:Semua'], cols: ['Kode Kupon', 'Nama Kupon', 'Besaran', 'Durasi', 'Outlet', 'Status'], n: 4 }),
  'poin-per-total-pembelian': T('Poin Reward Per Total Pembelian', { a: ['P:Tambah Poin Reward:plus'], cols: ['Nama Reward', 'Poin', 'Minimal Pembelian', 'Durasi', 'Outlet', 'Status'], n: 3 }),
  'poin-per-produk': T('Poin Reward Per Produk', { a: ['P:Tambah Poin Reward:plus'], cols: ['Nama Reward', 'Produk', 'Poin', 'Minimal Pembelian', 'Durasi', 'Outlet', 'Status'], n: 3 }),
  'pengaturan-penukaran': D('Daftar Penukaran Poin', { cols: ['Jenis Penukaran', 'Keterangan', 'Periode Penukaran', 'Status'], rows: [['Gratis Produk', '<span class="text-brand">Gratis Produk</span><br>0 Poin untuk<br>Max Rp 0 Poin', '-', 'Tidak Aktif'], ['Potongan Pembayaran', '<span class="text-brand">Gratis Produk</span><br>0 Poin untuk Potongan 0%<br>Max Rp 0', '-', 'Tidak Aktif']] }),
  // Komisi
  'daftar-grup-komisi': D('Daftar Grup Komisi', { a: ['P:Tambah Grup Komisi:plus'], f: ['s', 'sel:Semua Tipe Komisi', 'sel:Semua Status'], cols: ['Nama Grup Komisi', 'Tipe Komisi', 'Komisi Berdasarkan', 'Outlet', 'Karyawan', 'Status'], n: 3 }),
  // Invoice
  'daftar-penawaran-penjualan': T('Daftar Penawaran Penjualan', { a: ['P:Tambah Penawaran Penjualan:plus'], f: ['s', 'd', 'sel:Semua Status'], k: ['Total Penawaran Penjualan|Rp', 'Total Belum Diproses|Rp', 'Total Selesai|Rp', 'Total Void|Rp'], cols: ['Nomor Transaksi', 'Tanggal Transaksi', 'Nama Pelanggan', 'Nominal (Rp)', 'Outlet', 'Status'] }),
  'daftar-pesanan-penjualan': T('Daftar Pesanan Penjualan', { a: ['P:Tambah Pesanan Penjualan:plus'], f: ['s', 'd', 'sel:Semua Status'], k: ['Total Pesanan Penjualan|Rp', 'Total Belum Diproses|Rp', 'Total Selesai|Rp', 'Total Void|Rp'], cols: ['Nomor Transaksi', 'Tanggal Transaksi', 'Nama Pelanggan', 'Tagihan (Rp)', 'Uang Muka (Rp)', 'Sisa Tagihan (Rp)', 'Outlet', 'Status'] }),
  'daftar-pengiriman-penjualan': T('Daftar Pengiriman Penjualan', { a: ['P:Tambah Pengiriman Penjualan:plus'], f: ['s', 'd', 'sel:Semua Status'], k: ['Total Transaksi|#', 'Total Belum Diproses|#', 'Total Selesai|#', 'Total Void|#'], cols: ['Nomor Transaksi', 'Tanggal Transaksi', 'Nama Pelanggan', 'Outlet', 'Status'] }),
  'daftar-invoice': T('Daftar Invoice', { a: ['L:Impor Invoice:upload', 'L:Ekspor Invoice:download', 'P:Tambah Invoice:plus'], f: ['s', 'd', 'sel:Semua Status'], k: ['Invoice|Rp', 'Void|Rp', 'Lunas|Rp', 'Belum Lunas|Rp'], cols: ['No Invoice', 'Pelanggan', 'Outlet', 'Tanggal', 'Total Tagihan (Rp)', 'Sisa Tagihan (Rp)', 'Status'] }),
  'daftar-penerimaan-penjualan': T('Daftar Penerimaan Penjualan', { per: '01 September 2026 - 31 Oktober 2026', a: ['L:Ekspor Penerimaan:download', 'P:Tambah Penerimaan Penjualan:plus'], f: ['s', 'd:01 Sep 2026 - 31 Okt 2026', 'sel:Semua Status'], cols: ['No Penerimaan Penjualan', 'No Invoice Penjualan', 'Tanggal Penerimaan', 'Outlet', 'Pelanggan', 'Total Penerimaan', 'Status'] }),
  // Marketing
  'kirim-kampanye-marketing': T('Daftar Kampanye Marketing', { per: '1 Oktober 2026 - 31 Oktober 2026', a: ['L:Ekspor Laporan:download', 'P:Tambah Kampanye Marketing:plus'], f: ['s', 'd', 'sel:Semua Status'], k: ['Reguler|#', 'Email|#', 'Telkomsel LBA|#', 'Media Sosial|#'], k2: ['Consumer App|Unlimited'], cols: ['Nama Program', 'Jumlah', 'Media', 'Tanggal Transaksi', 'Tanggal Dibuat', 'Status'], n: 3 }),
  'beli-kampanye-marketing': T('Daftar Paket Kampanye Marketing', { per: '1 Oktober 2026 - 31 Oktober 2026', a: ['P:Beli Paket Kampanye:plus'], f: ['s', 'sel:Semua Status', 'd'], cols: ['No. Transaksi', 'Paket', 'Tanggal Transaksi', 'Sisa Saldo', 'Kedaluwarsa', 'Status', 'Outlet'], n: 2 })
};

// ---------- halaman terkunci (paket trial) ----------
const PRIME = 'Sayang sekali, fitur ini hanya bisa diakses oleh pengguna <b>PRIME+</b> dan <b>PRIME.</b>';
const ADV = 'Sayang sekali, fitur ini hanya bisa diakses oleh pengguna <b>ADVANCE, PRIME+, PRIME.</b>';
const PLUS = 'Sayang sekali, fitur ini hanya bisa diakses oleh pengguna <b>PRIME+.</b>';
const LOYAL = 'Loyalty Pelanggan belum tersedia di paket Trial. Upgrade ke paket Advance, Prime, atau Prime+, lalu beli Add-on Loyalty Pelanggan untuk mengakses menu ini.';
const LOCKED_PAGES = {
  'laporan-uang-muka': PRIME, 'laporan-kembalikan-status': PRIME, 'laporan-reservasi-meja': PRIME,
  'laporan-reservasi-fasilitas': PRIME, 'laporan-utilisasi-ruangan': PRIME, 'laporan-kupon': ADV, 'laporan-tutup-toko': ADV,
  'komisi-bertingkat': PLUS, 'komisi-tetap': ADV, 'laporan-stok-kedaluwarsa': PRIME, 'laporan-serial-number': PRIME,
  'waktu-teramai-penjualan': ADV, 'produk-layanan': PRIME, 'produk-fasilitas': PRIME, 'penjadwalan-perubahan-resep': ADV,
  'penjadwalan-harga': ADV, 'harga-berdasarkan-waktu': PLUS, 'cetak-barcode': ADV, 'daftar-kategori-catatan': ADV, 'master-resep': ADV,
  'kustom-data-pelanggan': PLUS, 'pengaturan-data-pelanggan': PRIME,
  'permintaan-barang': PRIME, 'pengiriman-pembelian': PRIME, 'retur': PRIME, 'permintaan-stok': PRIME,
  'loyalty-program': LOYAL, 'loyalty-ulang-tahun': LOYAL, 'daftar-loyalty': LOYAL, 'group-loyalty-pelanggan': LOYAL
};

// ---------- halaman khusus ----------
// Ringkasan Penjualan dan Penjualan Outlet dihitung dari data di laporan.js

function kepuasanPage() {
  killCharts();
  const r = seeded('kepuasan');
  const counts = isSample() ? [42, 18, 6, 2, 1] : [0, 0, 0, 0, 0];
  const total = counts.reduce((a, b) => a + b, 0);
  const avg = total ? (counts.reduce((s, c, i) => s + c * (5 - i), 0) / total).toFixed(1).replace('.', ',') : '0';
  const colors = ['#3ED0A8', '#1890FF', '#F5D90A', '#F5813F', '#E5333F'];
  const labels = ['Sangat Puas', 'Puas', 'Cukup Puas', 'Tidak Puas', 'Sangat Tidak Puas'];
  const reviews = isSample() ? [['Rina Wulandari', 5, 'Kopinya enak, pelayanan cepat.'], ['Dimas Saputra', 4, 'Tempat nyaman, croissant mantap.'], ['Ayu Lestari', 5, 'Matcha latte favorit!']] : [];
  window.PENDING_INIT = () => {
    const el = document.getElementById('rateChart');
    if (el) charts.push(new Chart(el, { type: 'doughnut', data: { labels, datasets: [{ data: total ? counts : [1], backgroundColor: total ? colors : ['#EFEFEF'], borderWidth: 0 }] }, options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { enabled: !!total } } } }));
  };
  return `<section class="card p-5">
    ${pageHead('Analisa Kepuasan Pelanggan', { per: '01 Oktober - 31 Oktober 2026' })}${hr}
    ${filterRow(['d'])}${hr}
    ${kpiCards(['Total Transaksi|#', 'Total Rating Masuk|#'], r)}
    <h2 class="text-[20px] font-semibold mt-8">Kepuasan Terhadap Kualitas Produk</h2>
    <div class="grid md:grid-cols-[220px_1fr_200px_200px] gap-6 items-center mt-6">
      <div class="relative h-[160px]"><canvas id="rateChart"></canvas><span class="absolute inset-0 m-auto w-11 h-11 rounded-full bg-[#F2F2F2] text-[14px] font-semibold flex items-center justify-center">bc</span></div>
      <ul class="space-y-3">${labels.map((l, i) => `<li class="flex items-center gap-2 text-[12px] font-medium"><span class="w-3 h-3 rounded-full" style="background:${colors[i]}"></span>${l}</li>`).join('')}</ul>
      <div class="text-center"><p class="text-[20px] font-semibold">Rating</p><p class="text-[40px] font-bold leading-[48px]">${avg}</p><p class="text-[#E0E0E0] text-[18px] tracking-widest">${'&#9733;'.repeat(5)}</p></div>
      <ul class="space-y-2.5">${counts.map((c, i) => `<li class="flex items-center gap-2 text-[12px]"><span class="text-accent text-[16px]">&#9733;</span>${5 - i} <span class="ml-1">${c} User</span><span class="ml-2">${total ? Math.round(c / total * 100) : 0}%</span></li>`).join('')}</ul>
    </div>
    <h2 class="text-[20px] font-semibold mt-10 mb-2">Ulasan Pelanggan</h2>
    ${reviews.length ? `<div class="divide-y divide-line">${reviews.map(([n, s, t]) => `<div class="py-4"><div class="flex items-center gap-2"><span class="font-semibold text-[14px]">${n}</span><span class="text-accent">${'&#9733;'.repeat(s)}</span><span class="ml-auto text-[12px] text-ink-4">16 Okt 2026</span></div><p class="text-[14px] text-ink-2 mt-1">${t}</p></div>`).join('')}</div>` : emptyTable()}
  </section>`;
}

function saldoPage() {
  killCharts();
  const r = seeded('saldo');
  const amt = n => isSample() ? rp(Math.round(n * (0.5 + r()) / 1000) * 1000) : 'Rp 0';
  const spec = T('Riwayat Saldo', { f: ['s', 'd', 'sel:by cafe', 'sel:Semua Jenis Transaksi'], k: ['Pemasukan|Rp', 'Penarikan|Rp'], cols: ['Outlet', 'Tanggal', 'Jenis Transaksi', 'Nomor', 'Total', 'Keterangan'], n: 4 });
  return `<section class="card p-5">
      <div class="flex items-center gap-3"><h1 class="text-[20px] font-semibold">Order Online</h1><i data-lucide="star" class="text-ink-4" style="width:22px;height:22px"></i></div>${hr}
      <p class="text-[14px] flex items-center gap-2">Total Saldo Merchant <i data-lucide="info" class="ic-sm"></i></p>
      <div class="flex flex-wrap items-center gap-3 mt-2">
        <p class="text-[20px] font-semibold w-[240px]">${amt(2.4e6)}</p>${linkBtn('Detail Saldo')}
        <div class="ml-auto flex gap-2">${linkBtn('Info Penarikan Saldo')}${btnPrimary('Tarik Saldo')}</div>
      </div>
      <div class="grid md:grid-cols-2 gap-4 mt-4">
        ${[['Saldo Ditahan', 'Lihat Mutasi', 3.5e5], ['Saldo Pelanggan', 'Detail Saldo', 1.2e5]].map(([l, b, n]) => `<div class="card border border-line p-4"><p class="text-[20px] font-semibold">${amt(n)}</p><div class="flex items-center mt-2"><span class="text-[14px] text-ink-2">${l}</span><span class="ml-auto">${linkBtn(b)}</span></div></div>`).join('')}
      </div>
    </section>
    <section class="card p-5 mt-6">
      <h2 class="text-[16px] font-semibold">Riwayat Saldo</h2>
      <p class="flex items-center gap-2 text-[12px] font-medium text-ink-2 mt-2"><i data-lucide="calendar" class="ic-sm"></i>01 Oktober - 31 Oktober 2026</p>${hr}
      ${filterRow(spec.f)}${hr}
      <div class="mb-6">${kpiCards(spec.k, r)}</div>
      ${tableHtml(spec, 'Riwayat Saldo', r)}
    </section>`;
}

function basicPromoPage() {
  killCharts();
  const row = (label, body) => `<div class="grid md:grid-cols-[280px_1fr] gap-4 py-6 border-b border-line"><h3 class="text-[16px] font-semibold">${label}</h3><div class="max-w-[680px]">${body}</div></div>`;
  const field = (label, html) => `<label class="block text-[12px] font-medium text-ink-2 mb-2">${label}</label>${html}`;
  return `<section class="card p-5">
    <div class="flex items-center gap-3"><h1 class="text-[20px] font-semibold">Promo</h1><i data-lucide="star" class="text-ink-4" style="width:22px;height:22px"></i></div>
    ${row('Basic Promo', `
      ${select('by cafe', 'w-full')}
      <div class="flex items-center justify-between py-4 border-b border-line mt-2"><span class="text-[12px] font-medium">Status Promo</span>
        <button class="w-14 h-6 rounded-full bg-[#D6D9D9] text-white text-[11px] font-semibold flex items-center px-1" data-toggle-promo><span class="w-4 h-4 rounded-full bg-white"></span><span class="ml-1">OFF</span></button></div>
      <div class="mt-4">${field('Nama Promosi', '<input class="input w-full h-10 bg-[#F2F2F2]" value="Basic Promo">')}</div>
      <div class="mt-4">${field('Deskripsi', '<textarea class="input w-full h-[72px] py-2 bg-[#F2F2F2] text-ink-4" readonly>Fitur Basic Promo digunakan untuk memberikan potongan harga pada setiap transaksi tanpa batasan waktu, namun fitur ini dapat diaktifkan atau dinon-aktifkan kapanpun.</textarea>')}</div>`)}
    ${row('Jenis Bonus', `
      <div class="input h-10 flex items-center"><input class="flex-1 outline-none" placeholder="Nilai Potongan (%)" value="5"><span class="text-ink-4">%</span></div>
      <p class="text-[12px] font-semibold mt-6 mb-3">PROMO BERLAKU UNTUK</p>
      ${['POS', 'Toko Online', 'Consumer Apps', 'Kiosk', 'Invoice'].map(x => `<label class="flex items-center gap-3 py-1.5 text-[14px]"><input type="checkbox" class="w-4 h-4 accent-[#04C99E]">${x}</label>`).join('')}`)}
    ${row('Upload Banner', `
      <div class="border-2 border-dashed border-[#D6D9D9] rounded-lg h-[170px] flex flex-col items-center justify-center text-ink-4 text-[12px]"><i data-lucide="upload" class="mb-3"></i>Pilih atau letakkan berkas di sini</div>
      <p class="text-[12px] mt-3">Format gambar .jpg .jpeg. png dengan rekomendasi ukuran 480px x 180px</p>`)}
    <div class="flex justify-end pt-5">${btnPrimary('Simpan')}</div>
  </section>`;
}

// ---------- daftarkan ke router ----------
Object.entries(SPEC).forEach(([slug, spec]) => { PAGES[slug] = () => reportPage(spec, slug); });
Object.assign(PAGES, {
  'kepuasan-pelanggan': kepuasanPage,
  'settlement-order-online': saldoPage,
  'basic-promo': basicPromoPage
});
PAGE_INIT['basic-promo'] = () => {
  const b = document.querySelector('[data-toggle-promo]');
  b.addEventListener('click', () => {
    const on = b.classList.toggle('bg-brand');
    b.classList.toggle('bg-[#D6D9D9]', !on);
    b.classList.toggle('flex-row-reverse', on);
    b.lastElementChild.textContent = on ? 'ON' : 'OFF';
    b.lastElementChild.className = on ? 'mr-1' : 'ml-1';
  });
};
