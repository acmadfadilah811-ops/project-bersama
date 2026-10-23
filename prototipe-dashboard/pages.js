// Isi halaman. PAGES[slug](judul) -> HTML; PAGE_INIT[slug]() dijalankan setelah HTML terpasang (grafik, interaksi).
// Semua angka = DATA CONTOH.

const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const TODAY = '16 Oktober 2026';
let charts = [];
const killCharts = () => { charts.forEach(c => c.destroy()); charts = []; };

const head = (title, right = '', sub = '') => `
  <div class="flex items-center gap-3 flex-wrap">
    <h1 class="text-[20px] font-semibold leading-7">${title}</h1>
    <i data-lucide="help-circle" class="text-brand" style="width:22px;height:22px"></i>
    <i data-lucide="star" class="text-ink-4" style="width:22px;height:22px"></i>
    <div class="ml-auto flex gap-2">${right}</div>
  </div>${sub}`;

const btnPrimary = (label, icon) => `<button class="h-9 px-4 rounded-md bg-brand text-white text-[14px] font-semibold flex items-center gap-2">${icon ? `<i data-lucide="${icon}" class="ic-sm"></i>` : ''}${label}</button>`;
const btnOutline = label => `<button class="h-9 px-3 rounded-md border border-brand text-brand text-[14px] font-semibold">${label}</button>`;
const search = (w = 'w-[222px]') => `<label class="input ${w} h-9 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..."></label>`;
const dateBtn = (txt = '01 Okt 2026 - 31 Okt 2026') => `<button class="input h-9 flex items-center gap-2 px-4 text-ink"><i data-lucide="calendar" class="ic-sm"></i>${txt}</button>`;
const select = (txt, w = 'w-[200px]') => `<button class="input ${w} h-9 flex items-center justify-between text-ink">${txt}<span class="text-[10px]">&#9660;</span></button>`;
const empty = (txt = 'Belum Ada Data') => `
  <div class="flex flex-col items-center py-14">
    <svg viewBox="0 0 200 150" class="w-[190px]" aria-hidden="true">
      <ellipse cx="100" cy="85" rx="78" ry="58" fill="#DDF7EF"/>
      <rect x="50" y="30" width="96" height="78" rx="6" fill="#04C99E"/><rect x="58" y="40" width="80" height="60" rx="3" fill="#BDF1E2"/>
      <path d="M58 58h80M58 76h80M88 40v60M113 40v60" stroke="#04C99E" stroke-width="2"/>
      <path d="M40 60h46l8 12h52v52H40z" fill="#10AF8C"/>
      <circle cx="118" cy="104" r="17" fill="none" stroke="#0E7C64" stroke-width="6"/><path d="M130 116l14 14" stroke="#0E7C64" stroke-width="7" stroke-linecap="round"/>
    </svg>
    <p class="text-[14px] text-ink-3 mt-4">${txt}</p>
  </div>`;
const cardWrap = inner => `<section class="card p-4 lg:p-5">${inner}</section>`;
const hr = '<hr class="border-line my-4">';

function genericPage(title) {
  killCharts();
  return cardWrap(`${head(title)}${hr}
    <div class="flex flex-wrap gap-3">${search()}${dateBtn()}</div>${hr}
    ${empty()}`);
}

// ---------------- Dashboard Penjualan ----------------
const RANGE = {
  harian: { label: '16 Okt 26 - 16 Okt 26', title: TODAY, x: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00'),
    now: [0,0,0,0,0,0,0,85,240,410,520,690,1240,1380,760,540,610,880,1150,1320,960,520,180,0].map(v => v * 1000),
    prev: [0,0,0,0,0,0,0,60,180,350,600,540,1100,1210,820,470,520,760,980,1260,1010,480,150,0].map(v => v * 1000) },
  mingguan: { label: '12 Okt 26 - 18 Okt 26', title: '12 - 18 Oktober 2026', x: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
    now: [9.2, 8.4, 10.1, 9.8, 13.5, 16.2, 14.9].map(v => v * 1e6), prev: [8.1, 8.8, 9.0, 9.4, 12.2, 15.1, 15.4].map(v => v * 1e6) },
  bulan: { label: 'Okt 2026', title: 'Oktober 2026', x: Array.from({ length: 31 }, (_, i) => String(i + 1)),
    now: Array.from({ length: 31 }, (_, i) => (9 + 4 * Math.sin(i / 2.2) + (i % 7 > 4 ? 5 : 0)) * 1e6),
    prev: Array.from({ length: 31 }, (_, i) => (8.5 + 3.5 * Math.sin(i / 2.4 + 1) + (i % 7 > 4 ? 4.5 : 0)) * 1e6) }
};
const sum = a => a.reduce((s, v) => s + v, 0);

function widget(title, body) {
  return `<div class="card flex flex-col min-h-[300px] min-w-0">
    <h3 class="text-[16px] font-semibold px-5 pt-6">${title}</h3>
    <div class="flex-1 px-5 py-4">${body}</div>
    <div class="flex items-center justify-between px-5 pb-4"><i data-lucide="more-horizontal" class="text-ink-2"></i>
      <a class="text-brand text-[12px] font-semibold flex items-center gap-1">Lihat Semua <i data-lucide="chevron-right" class="ic-sm"></i></a></div>
  </div>`;
}
const rows = (data, fmt = v => v) => `<ul class="space-y-3">${data.map(([k, v, extra]) => `
  <li class="flex items-center justify-between text-[13px]"><span class="text-ink-2 truncate pr-2">${k}</span><span class="font-semibold ${extra || ''}">${fmt(v)}</span></li>`).join('')}</ul>`;
const bars = data => { const max = Math.max(...data.map(d => d[1])); return `<ul class="space-y-3">${data.map(([k, v]) => `
  <li><div class="flex justify-between text-[13px]"><span class="text-ink-2">${k}</span><span class="font-semibold">${rp(v)}</span></div>
  <div class="h-1.5 bg-[#EDEFEF] rounded mt-1.5"><div class="h-1.5 rounded bg-brand" style="width:${(v / max) * 100}%"></div></div></li>`).join('')}</ul>`; };
const donut = (id, legend) => `<div class="h-[120px] relative"><canvas id="${id}"></canvas></div>
  <ul class="mt-3 space-y-1.5">${legend.map(([k, v, c]) => `<li class="flex items-center gap-2 text-[12px]"><span class="w-2 h-2 rounded-full" style="background:${c}"></span><span class="flex-1 text-ink-2">${k}</span><span class="font-semibold">${v}%</span></li>`).join('')}</ul>`;

const PAY = [['Tunai', 46, '#04C99E'], ['QRIS', 38, '#1890FF'], ['Debit/Kredit', 16, '#F5A623']];
const ORDER = [['Dine In', 58, '#04C99E'], ['Take Away', 30, '#7B61FF'], ['Order Online', 12, '#F5A623']];

function dashboardPage() {
  killCharts();
  const r = RANGE.harian;
  return `
  <section class="card overflow-hidden mb-8">
    <div class="relative px-5 pt-5 pb-16" style="background:linear-gradient(100deg,#04C99E 0%,#3ED598 100%)">
      <div class="flex items-center gap-4">
        <h2 class="text-white text-[20px] font-semibold">Langkah Mudah Buka Outlet</h2>
        <span class="ml-auto text-white text-[14px] font-semibold">1/3</span>
        <div class="w-[250px] h-3 rounded-full bg-white hidden sm:block"><div class="h-3 rounded-full bg-accent" style="width:33%"></div></div>
        <button id="btnOnb" class="w-6 h-6 rounded-full bg-white/30 text-white flex items-center justify-center"><i data-lucide="chevron-up" class="ic-sm"></i></button>
      </div>
    </div>
    <div id="onbSteps" class="grid md:grid-cols-3 gap-4 px-5 -mt-12 pb-5 relative">
      ${[['package-open', 'Siapkan Produk', false], ['check-circle-2', 'Informasi Karyawan', true], ['store', 'Lengkapi Data Outlet', false]].map(([ic, t, done]) => `
        <a class="bg-white rounded-md h-14 px-4 flex items-center gap-3 shadow-sm" style="background:linear-gradient(100deg,#EFFBF6 0%,#fff 40%)">
          <i data-lucide="${ic}" class="${done ? 'text-ink-2' : 'text-brand'}"></i><span class="text-[14px] flex-1 ${done ? 'text-[#A0A6A6]' : ''}">${t}</span><i data-lucide="chevron-right" class="ic-sm ${done ? 'text-[#C4C8C8]' : ''}"></i></a>`).join('')}
    </div>
  </section>

  <section class="card p-5">
    ${head('Dashboard Penjualan', '', `<p class="text-[12px] text-ink-4 mt-1">Diperbarui ${TODAY}, 23:00:17</p>`)}
    ${hr}
    <div class="flex flex-wrap items-center gap-2">
      <div class="seg flex border border-line rounded-lg overflow-hidden">
        <button data-range="harian" class="active">Harian</button><button data-range="mingguan">Mingguan</button><button data-range="bulan">Bulan</button>
      </div>
      <div class="flex items-center border border-line rounded-lg overflow-hidden bg-[#FAFAFA] h-[37px]">
        <button class="px-3 h-full"><i data-lucide="chevron-left" class="ic-sm"></i></button>
        <span id="rangeLabel" class="px-3 text-[14px] text-ink-2 bg-white h-full flex items-center">${r.label}</span>
        <button class="px-3 h-full"><i data-lucide="chevron-right" class="ic-sm"></i></button>
      </div>
    </div>
    ${hr}
    <div class="grid lg:grid-cols-[283px_220px_1fr] gap-y-4">
      <div class="p-2.5 flex flex-col justify-center">
        <p class="text-[12px] text-ink-4">Total Penjualan</p>
        <p id="kTotal" class="text-[24px] font-semibold leading-8">${rp(sum(r.now))}</p>
        <p class="text-[12px] text-ink-4 leading-[22px]">Akumulasi dari Awal Bulan ${rp(184520000)}</p>
        <p class="text-[12px] text-ink-4 leading-[22px]">Proyeksi Bulan Ini ${rp(357500000)}</p>
      </div>
      <div class="p-2.5 space-y-5">
        <div><p class="text-[12px] text-ink-4">Penjualan Belum Dibayar</p><p class="text-[16px] font-semibold mt-1">${rp(420000)}</p></div>
        <div><p class="text-[12px] text-ink-4">Penjualan Terbayar</p><p id="kPaid" class="text-[16px] font-semibold mt-1">${rp(sum(r.now) - 420000)}</p></div>
      </div>
      <div class="grid grid-cols-2 bg-[#FAFAFA] border border-line rounded-lg">
        ${[['Transaksi', '142'], ['Penjualan per Transaksi', rp(sum(r.now) / 142)], ['Produk Terjual', '386'], ['Produk per Transaksi', '2,7']].map(([k, v], i) => `
          <div class="p-2.5 px-3 ${i < 2 ? 'border-b border-line' : ''}"><p class="text-[12px] text-ink-4">${k}</p><p class="text-[14px] font-semibold mt-1.5">${v}</p></div>`).join('')}
      </div>
    </div>
    ${hr}
    <div class="px-2.5">
      <h3 class="text-[16px] font-semibold">Penjualan <span id="chartTitle" class="text-[12px] font-normal text-ink-4">${r.title}</span></h3>
      <div class="flex justify-end gap-4 text-[12px] font-medium mt-6">
        <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[#BDBDBD]"></span>Periode Sebelumnya</span>
        <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-brand"></span>Total Penjualan</span>
      </div>
      <div class="h-[320px] mt-2"><canvas id="salesChart"></canvas></div>
    </div>
  </section>

  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
    ${widget('Kontrol Fraud', rows([['Void', 3, 'text-danger'], ['Refund', 1, 'text-danger'], ['Diskon Manual', 6], ['Ubah Harga', 2], ['Hapus Item', 4]]))}
    ${widget('Metode Pembayaran', donut('payChart', PAY))}
    ${widget('Jenis Order', donut('orderChart', ORDER))}
    ${widget('Penjualan per Kategori', bars([['Kopi', 4120000], ['Non Kopi', 2380000], ['Makanan', 2950000], ['Snack', 1240000]]))}
    ${widget('Produk Terlaris', rows([['Es Kopi Susu', '96 pcs'], ['Americano', '54 pcs'], ['Croissant', '41 pcs'], ['Matcha Latte', '38 pcs'], ['Nasi Goreng', '27 pcs']]))}
    ${widget('Komisi per Kasir', rows([['Bayu', 184000], ['Sinta', 152000], ['Raka', 96000]], rp))}
    ${widget('Penjualan per Kasir', rows([['Bayu', 5240000], ['Sinta', 4310000], ['Raka', 2140000]], rp))}
    ${widget('Stok Terendah', rows([['Susu UHT 1L', '2 pcs', 'text-danger'], ['Biji Kopi Arabika', '0,4 kg', 'text-danger'], ['Gula Aren', '1 kg'], ['Cup 16oz', '35 pcs']]))}
  </div>`;
}

function drawSales(key) {
  const r = RANGE[key];
  const ctx = document.getElementById('salesChart');
  if (!ctx) return;
  const old = charts.find(c => c.canvas === ctx); if (old) { old.destroy(); charts = charts.filter(c => c !== old); }
  charts.push(new Chart(ctx, {
    type: 'line',
    data: { labels: r.x, datasets: [
      { label: 'Total Penjualan', data: r.now, borderColor: '#04C99E', backgroundColor: 'rgba(4,201,158,.08)', fill: true, tension: .35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2.5 },
      { label: 'Periode Sebelumnya', data: r.prev, borderColor: '#BDBDBD', borderDash: [5, 4], tension: .35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }
    ] },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', titleColor: '#272A2A', bodyColor: '#404545', borderColor: '#EEEEEE', borderWidth: 1, padding: 10, callbacks: { label: c => ` ${c.dataset.label}: ${rp(c.raw)}` } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#272A2A', font: { size: 12 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 13 } },
        y: { border: { display: false }, grid: { color: '#E0E0E0' }, ticks: { color: '#404545', font: { size: 12 }, maxTicksLimit: 5, callback: v => v >= 1e6 ? (v / 1e6).toLocaleString('id-ID') + ' jt' : v >= 1e3 ? (v / 1e3).toLocaleString('id-ID') + ' rb' : v } }
      }
    }
  }));
  document.getElementById('rangeLabel').textContent = r.label;
  document.getElementById('chartTitle').textContent = r.title;
  document.getElementById('kTotal').textContent = rp(sum(r.now));
  document.getElementById('kPaid').textContent = rp(sum(r.now) - 420000);
}

function drawDonut(id, data) {
  const el = document.getElementById(id);
  charts.push(new Chart(el, { type: 'doughnut', data: { labels: data.map(d => d[0]), datasets: [{ data: data.map(d => d[1]), backgroundColor: data.map(d => d[2]), borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } } }));
}

// ---------------- Pesanan (Order Online) ----------------
function pesananPage() {
  killCharts();
  const st = [['Pesanan Masuk', 2, '#1890FF'], ['Pesanan Diproses', 1, '#6CB8F0'], ['Pesanan Dikirim', 0, '#7B2FD0'], ['Pesanan Selesai', 14, '#3ED0A8']];
  const orders = [['ORD-20261016-0012', 'GrabFood', 'Rina', 'Es Kopi Susu x2, Croissant', 86000, 'Pesanan Masuk'], ['ORD-20261016-0011', 'Shopee', 'Dimas', 'Biji Kopi Arabika 250gr', 120000, 'Pesanan Masuk']];
  return cardWrap(`
    ${head('Pesanan')}${hr}
    <div class="flex flex-wrap gap-2">${search('w-[230px]')}${dateBtn()}${select('Semua Channel')}${select('Semua Outlet')}</div>${hr}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${st.map(([k, v, c]) => `<div class="card flex flex-col"><div class="px-6 pt-3 pb-3"><p class="text-[14px] font-medium">${k}</p><p class="text-[18px] font-semibold mt-2">${v}</p></div><div class="kpi-bar" style="background:${c}"></div></div>`).join('')}
    </div>
    <div class="flex gap-6 border-b border-line mt-6 text-[14px] overflow-x-auto" id="ordTabs">
      ${['Pesanan Masuk', 'Diproses', 'Dikirim', 'Diterima', 'Selesai', 'Batal/Refund'].map((t, i) => `<button class="pb-2 px-2.5 whitespace-nowrap ${i ? 'text-[#A0A6A6]' : 'text-brand font-medium border-b-2 border-brand'}">${t}</button>`).join('')}
    </div>
    <div class="overflow-x-auto"><table class="tbl w-full mt-2"><thead><tr><th>No. Pesanan</th><th>Channel</th><th>Pelanggan</th><th>Item</th><th>Total</th><th></th></tr></thead><tbody>
      ${orders.map(o => `<tr><td class="font-medium">${o[0]}</td><td>${o[1]}</td><td>${o[2]}</td><td class="text-ink-3">${o[3]}</td><td class="font-semibold">${rp(o[4])}</td><td class="text-right"><button class="h-8 px-3 rounded-md bg-brand text-white text-[12px] font-semibold">Terima</button></td></tr>`).join('')}
    </tbody></table></div>`);
}

// ---------------- Daftar Karyawan ----------------
function karyawanPage() {
  killCharts();
  const kuota = (t, a) => `<div class="card flex flex-col"><div class="px-4 pt-3 pb-3"><p class="text-[12px] text-ink-3">${t}</p><p class="text-[14px] mt-1"><b class="text-[18px]">${a}</b> <span class="text-ink-4 text-[12px]">(${a} Default dan 0 Berbayar)</span></p></div><div class="kpi-bar" style="background:${t === 'Total Kuota' ? '#1890FF' : '#3ED0A8'}"></div></div>`;
  const emp = [['Bayu Pratama', 'Owner', 'Semua Outlet', 'Aktif'], ['Sinta Maharani', 'Kasir', 'Outlet Utama', 'Aktif'], ['Raka Aditya', 'Barista', 'Outlet Utama', 'Nonaktif']];
  return `
    <div class="flex items-center gap-3 border border-[#91CAFF] bg-[#E6F4FF] rounded-md px-4 py-2.5 mb-6 text-[14px]">
      <i data-lucide="info" class="ic-sm" style="fill:#404545;color:#fff"></i>
      <p class="flex-1">Akses <b>Data Karyawan</b> kini melalui <b>Menu Karyawan</b>. Kelola data dan hak akses karyawan lebih mudah disini.</p><i data-lucide="x" class="ic-sm text-ink-4"></i>
    </div>
    ${cardWrap(`
      ${head('Daftar Karyawan', btnOutline('Ringkasan Outlet') + btnPrimary('Tambah Karyawan', 'plus'))}${hr}
      <div class="flex flex-wrap gap-2">${search('w-[258px]')}${select('Semua Status', 'w-[258px]')}</div>${hr}
      <div class="grid md:grid-cols-2 gap-8">
        <div><p class="text-[14px] font-medium text-ink-3 mb-3">Kuota Karyawan</p><div class="grid grid-cols-2 gap-3">${kuota('Total Kuota', 3)}${kuota('Kuota Tersisa', 0)}</div></div>
        <div class="md:border-l md:border-line md:pl-8"><p class="text-[14px] font-medium text-ink-3 mb-3">Kuota Admin</p><div class="grid grid-cols-2 gap-3">${kuota('Total Kuota', 1)}${kuota('Kuota Tersisa', 1)}</div></div>
      </div>
      <div class="overflow-x-auto mt-6"><table class="tbl w-full"><thead><tr><th>Nama</th><th>Jabatan</th><th>Outlet</th><th>Status</th><th></th></tr></thead><tbody>
        ${emp.map(e => `<tr><td class="font-medium">${e[0]}</td><td>${e[1]}</td><td>${e[2]}</td><td><span class="text-[12px] font-semibold px-2 py-1 rounded ${e[3] === 'Aktif' ? 'bg-brand-soft text-brand-dark' : 'bg-[#F2F2F2] text-ink-4'}">${e[3]}</span></td><td class="text-right"><i data-lucide="more-vertical" class="ic-sm"></i></td></tr>`).join('')}
      </tbody></table></div>`)}`;
}

// ---------------- Daftar Pesan (Pengaturan) ----------------
function pesanPage() {
  killCharts();
  return cardWrap(`
    ${head('Daftar Pesan')}${hr}
    <div class="flex flex-wrap gap-2">${search('w-[275px]')}${dateBtn()}</div>${hr}
    <div class="overflow-x-auto"><table class="tbl w-full"><thead><tr><th class="w-8"><input type="checkbox"></th><th>Subjek</th><th>Pengirim</th><th>Tanggal</th><th>Prioritas</th><th></th></tr></thead><tbody>
      <tr><td><input type="checkbox"></td><td class="font-semibold">Syarat dan ketentuan yang diberikan…</td><td class="font-semibold">Admin</td><td class="font-semibold">${TODAY}, 19:13</td>
      <td><span class="text-[12px] font-semibold bg-[#FFFBE6] px-2 py-1 rounded inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-accent"></span>Sedang</span></td><td class="text-right"><i data-lucide="eye" class="ic-sm"></i></td></tr>
    </tbody></table></div>
    <div class="flex flex-wrap items-center justify-between gap-3 mt-4 text-[12px] text-ink-3">
      <span>Tampilkan: <b class="text-ink">10</b> &#709; &nbsp; Ditampilkan 1 - 1 dari 1 data</span>
      <span class="flex items-center gap-2"><i data-lucide="arrow-left" class="ic-sm"></i> Sebelumnya <span class="w-7 h-7 rounded bg-brand text-white font-semibold flex items-center justify-center">1</span> Selanjutnya <i data-lucide="arrow-right" class="ic-sm"></i></span>
    </div>`);
}

// ---------------- Produk dan Inventori (Pengaturan) ----------------
function produkInvPage() {
  killCharts();
  const it = [['bell', 'Pengaturan Notifikasi Stok', 'Atur notifikasi jumlah stok tersedia di outlet', 'Atur Notifikasi'], ['boxes', 'Pengaturan Limitasi Stok Keluar', 'Atur limitasi stok keluar saat stok habis', 'Atur Limitasi'], ['package-check', 'Pengaturan Permintaan Stok', 'Tentukan daftar outlet pengirim untuk permintaan stok', 'Atur Permintaan Stok']];
  return cardWrap(`${head('Produk Dan Inventori')}${hr}<div class="space-y-4">${it.map(([ic, t, d, a]) => `
    <div class="card flex items-center gap-4 p-4"><span class="w-11 h-11 rounded-full bg-page flex items-center justify-center"><i data-lucide="${ic}"></i></span>
    <div class="flex-1"><p class="text-[16px] font-semibold">${t}</p><p class="text-[12px] text-ink-4">${d}</p></div><a class="text-brand text-[14px] font-semibold">${a}</a></div>`).join('')}</div>`);
}

// ---------------- Bantuan ----------------
function bantuanPage() {
  killCharts();
  return `<section class="card overflow-hidden">
    <div class="relative h-[104px] flex items-center px-10" style="background:linear-gradient(100deg,#04C99E,#3ED598)">
      <span class="text-white text-[26px] font-semibold flex items-center gap-1"><span class="w-6 h-6 rounded-full bg-white text-brand text-[13px] font-bold flex items-center justify-center">c</span>Care</span>
      <h2 class="flex-1 text-center text-white text-[26px] font-semibold">Halo, ada yang bisa kami bantu?</h2>
      <span class="text-white flex gap-4"><i data-lucide="book-open"></i><i data-lucide="monitor-play"></i></span>
      <label class="absolute left-1/2 -translate-x-1/2 -bottom-4 w-[480px] max-w-[80%] h-8 bg-white rounded-md shadow flex items-center gap-2 px-4 text-ink-4"><i data-lucide="search" class="ic-sm"></i><input class="flex-1 outline-none text-[14px]" placeholder="Cari ..."></label>
    </div>
    <div class="p-6 pt-16">
      <div class="relative rounded-lg h-[220px] flex items-center px-16" style="background:linear-gradient(110deg,#E6F9F4 0%,#04C99E 55%,#10AF8C 100%)">
        <p class="ml-auto text-white text-[34px] font-bold leading-tight max-w-[480px]">Atur Tampilan Navigasi di Dashboard Sesuai Kebutuhan Tokomu</p>
        <button class="absolute left-3 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"><i data-lucide="chevron-left"></i></button>
        <button class="absolute right-3 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"><i data-lucide="chevron-right"></i></button>
      </div>
      <div class="grid sm:grid-cols-3 gap-4 mt-6">${['Memulai Kasir', 'Kelola Produk & Stok', 'Laporan & Keuangan'].map(t => `<div class="card p-4"><p class="font-semibold text-[14px]">${t}</p><p class="text-[12px] text-ink-4 mt-1">Panduan langkah demi langkah</p></div>`).join('')}</div>
    </div></section>`;
}

// ---------------- QRIS (Layanan) ----------------
function qrisPage() {
  killCharts();
  return cardWrap(`${head('QRIS')}${hr}<p class="flex items-center gap-2 text-[14px]"><i data-lucide="info" class="ic-sm" style="fill:#585F5F;color:#fff"></i>Pelajari fungsi QRIS Statis &amp; Dinamis <a class="text-brand underline">di sini</a></p>${hr}${empty('Belum Ada Pengajuan QRIS')}`);
}

// ---------------- Supplies ----------------
function suppliesPage() {
  killCharts();
  return `<div class="card overflow-hidden mb-4 h-[110px] flex items-center px-8 gap-6" style="background:linear-gradient(100deg,#0E7C64,#04C99E 45%,#fff 45.2%)">
      <span class="text-white text-[24px] font-semibold">Capital</span>
      <div class="ml-auto"><p class="text-[22px] font-bold">BISNIS JALAN, KEBUTUHAN MODAL TERPENUHI</p><p class="text-[14px]">Modal hingga 280jt* untuk bantu penuhi kebutuhan bisnismu</p></div></div>
    ${cardWrap(`<div class="flex flex-wrap items-end gap-3"><div><p class="text-[12px] text-ink-3">Jangkauan Area:</p><p class="text-[14px] font-medium">Semua Area &#9662;</p></div>
      <label class="input flex-1 h-9 flex items-center"><input class="flex-1 outline-none" placeholder="Cari ..."></label><button class="h-9 w-10 rounded-md bg-brand text-white flex items-center justify-center"><i data-lucide="search" class="ic-sm"></i></button><i data-lucide="shopping-cart" class="ml-3"></i></div>
      <div class="mt-5 rounded-md border border-[#FFE58F] bg-[#FFFBE6] p-4"><p class="font-semibold text-[14px] flex items-center gap-2"><i data-lucide="info" class="ic-sm" style="fill:#404545;color:#fff"></i>Atur Titik Lokasi</p><p class="text-[13px] text-ink-3 mt-1 ml-6">Untuk melanjutkan proses transaksi, silakan atur titik lokasi pengiriman pada maps</p><p class="text-right text-[13px] underline">Atur Pin Point</p></div>
      <h3 class="text-[16px] font-semibold mt-6 mb-3">Kategori Pilihan</h3>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">${['Kemasan', 'Bahan Kopi', 'Susu & Krimer', 'Sirup', 'Peralatan'].map(t => `<div class="card p-4 text-center text-[13px] font-medium"><div class="w-12 h-12 rounded-full bg-brand-soft mx-auto mb-2"></div>${t}</div>`).join('')}</div>`)}`;
}

const PAGES = {
  'dashboard': dashboardPage,
  'pesanan': pesananPage,
  'daftar-karyawan': karyawanPage,
  'daftar-pesan': pesanPage,
  'produk-dan-inventori': produkInvPage,
  'panduan-penggunaan': bantuanPage,
  'qris': qrisPage,
  'supplies': suppliesPage
};

const PAGE_INIT = {
  'dashboard': () => {
    drawSales('harian');
    drawDonut('payChart', PAY);
    drawDonut('orderChart', ORDER);
    document.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-range]').forEach(x => x.classList.toggle('active', x === b));
      drawSales(b.dataset.range);
    }));
    document.getElementById('btnOnb').addEventListener('click', e => {
      const s = document.getElementById('onbSteps');
      s.classList.toggle('hidden');
      e.currentTarget.innerHTML = `<i data-lucide="chevron-${s.classList.contains('hidden') ? 'down' : 'up'}" class="ic-sm"></i>`;
      lucide.createIcons();
    });
  }
};
