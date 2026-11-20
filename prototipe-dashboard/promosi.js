// Promosi > Promo Per Total Pembelian / Per Produk, direkam dari referensi 23 Okt 2026
// (daftar, form 2 langkah Informasi Promo + Ketentuan Promo, modal Pilih Produk, Log Aktivitas).
// Data di db().promo (format & perhitungan di store.js); kasir memakai promo yang sedang berjalan.

const PR_PLATFORM = ['POS', 'kasirku Order', 'Consumer Apps', 'Kiosk', 'Invoice'];
const PR_HARI = [[1, 'Senin'], [2, 'Selasa'], [3, 'Rabu'], [4, 'Kamis'], [5, 'Jumat'], [6, 'Sabtu'], [0, 'Minggu']];
const PR_STATUS = ['Aktif', 'Inaktif', 'Kadaluarsa', 'Draf'];
const prTgl = d => tglPendek(d + 'T00:00:00');
const prTglP = d => tglPanjang(d + 'T00:00').split(',')[0].replace(/^(d) /, '0$1 ');
const prDurasi = p => `${prTgl(p.mulai)} - ${prTgl(p.akhir)}`;
const prProduk = ids => ids.map(id => byId('produk', id)?.nama).filter(Boolean);
function prPill(txt) {
  const t = { Aktif: ['#E6F9F4', '#10AF8C', '#04C99E'], Kadaluarsa: ['#FFF1F0', '#CF1322', '#E5333F'] }[txt] || ['#F2F2F2', '#777777', '#A0A6A6'];
  return `<span class="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-1 rounded whitespace-nowrap" style="background:${t[0]};color:${t[1]}"><span class="w-1.5 h-1.5 rounded-full" style="background:${t[2]}"></span>${txt}</span>`;
}
const logPromo = (nama, aktivitas, status = 'Berhasil') => db().logPromo.unshift({ waktu: nowText(), nama, aktivitas, status, user: 'Bayu' });

// ---------- filter status (dropdown centang + chip di bawahnya) ----------
const PR_FILTER = {};
const prFilter = slug => (PR_FILTER[slug] = PR_FILTER[slug] || new Set(['Aktif']));
const prStatusFilter = slug => `<div class="relative ${prFilter(slug).size ? 'mb-9' : ''}"><button type="button" data-act="pstatus" class="fin fsel w-[258px] min-h-0 h-9 text-left text-[#A0A6A6]">Pilih Status</button>
  <div class="absolute top-full mt-2 left-0 w-[420px] flex flex-wrap gap-2">${[...prFilter(slug)].map(v => `<span class="inline-flex items-center gap-2 bg-[#F2F2F2] rounded px-2 py-1 text-[12px] font-medium">${v}<button type="button" data-act="pchip" data-v="${v}" aria-label="Hapus filter ${v}"><i data-lucide="x" class="ic-sm text-ink-3"></i></button></span>`).join('')}</div></div>`;
function prStatusMenu(slug, anchor) {
  document.querySelectorAll('.prmenu').forEach(m => m.remove());
  const sel = prFilter(slug), r = anchor.getBoundingClientRect();
  const m = nodeOf(`<div class="prmenu dropdown fixed z-[55] py-1" style="width:${r.width}px;top:${r.bottom + 4}px;left:${r.left}px"></div>`);
  const paint = () => {
    m.innerHTML = [['*', 'Pilih Semua', sel.size === PR_STATUS.length], ...PR_STATUS.map(v => [v, v, sel.has(v)])].map(([v, l, on], i) => `<label class="flex items-center gap-3 px-4 py-2.5 text-[14px] cursor-pointer hover:bg-page ${i ? 'border-t border-line' : ''}"><input type="checkbox" data-pv="${v}" class="w-4 h-4 accent-[#04C99E]" ${on ? 'checked' : ''}>${l}</label>`).join('');
  };
  m.addEventListener('change', e => {
    const v = e.target.dataset.pv;
    if (v === '*') { if (e.target.checked) PR_STATUS.forEach(x => sel.add(x)); else sel.clear(); } else e.target.checked ? sel.add(v) : sel.delete(v);
    paint(); repaintSel(slug);
  });
  paint(); document.body.appendChild(m);
  setTimeout(() => document.addEventListener('click', function off(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', off); } }), 0);
}

// ---------- modal Pilih Produk ----------
function pilihProdukPromo(selected = []) {
  return new Promise(resolve => {
    const sel = new Set(selected);
    let q = '', kat = '', tab = 'Produk';
    const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${layer += 2}">
      <div class="bg-white rounded-lg w-[760px] max-w-full max-h-[92vh] flex flex-col">
        <div class="flex items-center justify-between px-6 py-4"><h3 class="text-[20px] font-semibold">Pilih Produk</h3><button data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
        <div class="flex-1 min-h-0 overflow-y-auto px-6">
          <div class="rounded-md border border-[#FFD591] bg-[#FFF7E6] px-4 py-3 text-[14px] text-ink-2 flex gap-3"><i data-lucide="alert-circle" class="ic-sm mt-0.5 shrink-0" style="fill:#404545;color:#fff"></i>
            <div><p class="font-semibold text-ink text-[16px]">Perhatian!</p><ol class="list-decimal pl-5 mt-1 leading-6"><li>Bonus/promo produk satuan tidak berlaku jika pelanggan membeli produk paket</li><li>Saat ini produk paket hanya dapat diintegrasikan ke POS</li></ol></div></div>
          <div class="flex flex-wrap items-center gap-3 mt-3"><label class="input w-[164px] h-8 flex items-center gap-2 text-ink-4"><i data-lucide="search" class="ic-sm shrink-0"></i><input data-q class="flex-1 min-w-0 outline-none text-ink" placeholder="Cari ..."></label>
            <select data-kat class="fin fsel w-[178px] min-h-0 h-8"><option value="">Semua Kategori</option>${db().kategori.map(k => `<option value="${k.id}">${esc(k.nama)}</option>`).join('')}</select>
            <div class="seg seg-sm flex border border-line rounded-lg overflow-hidden ml-auto">${['Produk', 'Fasilitas', 'Paket'].map(x => `<button data-tab="${x}" class="${x === tab ? 'active' : ''}">${x}</button>`).join('')}</div></div>
          <div data-list class="mt-3 min-h-[200px]"></div></div>
        <div class="flex justify-end items-center gap-8 px-6 py-4">${fBtn.text('Batal', 'data-x')}<button data-ok class="h-10 px-3 rounded-md bg-brand disabled:bg-[#D6D9D9] text-white text-[14px] font-semibold">Simpan</button></div></div></div>`);
    const paint = () => {
      const items = tab === 'Produk' ? db().produk.filter(p => (!q || (p.nama + p.sku).toLowerCase().includes(q)) && (!kat || p.kategori === kat)) : [];
      const all = items.length && items.every(p => sel.has(p.id));
      d.querySelector('[data-list]').innerHTML = `<table class="tbl w-full"><thead><tr><th class="w-8"><input type="checkbox" data-all class="accent-[#04C99E]" ${all ? 'checked' : ''}></th><th>SKU</th><th>Produk</th><th>Kategori</th><th>Stok</th><th>Harga</th></tr></thead><tbody>
        ${items.map(p => `<tr><td><input type="checkbox" data-pick="${p.id}" class="accent-[#04C99E]" ${sel.has(p.id) ? 'checked' : ''}></td><td>${esc(p.sku || '-')}</td><td>${esc(p.nama)}</td><td>${esc(katName(p.kategori))}</td><td>${p.monitor ? fmtN(stokOf('p:' + p.id)) : '-'}</td><td class="whitespace-nowrap">${rp(p.hargaJual)},00</td></tr>`).join('')}</tbody></table>${items.length ? '' : emptyTable()}`;
      d.querySelector('[data-ok]').disabled = !sel.size;
      lucide.createIcons();
    };
    const close = v => { d.remove(); layer -= 2; resolve(v); };
    d.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) return close(null);
      if (e.target.closest('[data-ok]')) return close(db().produk.filter(p => sel.has(p.id)).map(p => p.id));
      const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; d.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === tb)); paint(); }
    });
    d.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-pick]')) t.checked ? sel.add(t.dataset.pick) : sel.delete(t.dataset.pick);
      if (t.matches('[data-all]')) d.querySelectorAll('[data-pick]').forEach(c => { c.checked = t.checked; t.checked ? sel.add(c.dataset.pick) : sel.delete(c.dataset.pick); });
      if (t.matches('[data-kat]')) { kat = t.value; return paint(); }
      d.querySelector('[data-ok]').disabled = !sel.size;
    });
    d.addEventListener('input', e => { if (e.target.matches('[data-q]')) { q = e.target.value.toLowerCase(); paint(); } });
    document.body.appendChild(d); paint();
  });
}

// ---------- form Tambah / Ubah Promosi ----------
const prChips = (key, ids) => `<div data-chips="${key}">${chipsHtml(ids.map(id => [id, byId('produk', id)?.nama || '-']))}</div>`;
const prRadios = (name, list, val) => `<div class="grid gap-3" style="grid-template-columns:repeat(${list.length},minmax(0,1fr))">${list.map(([v, l, dis]) => fRadioCard(name, v, l, val === v, { disabled: dis })).join('')}</div>`;
const prMoney = (name, ph, val) => `<div data-field="${name}"><input name="${name}" data-money inputmode="numeric" class="fin" placeholder="${ph}" value="${val ? toNum(val).toLocaleString('id-ID') : ''}"></div>`;
const prSub = t => `<p class="text-[12px] text-ink-2 mb-1">${t}</p>`;

function promoForm(jenis, item) {
  const isEdit = !!item && !item.draf;
  const n0 = new Date();
  const o = item ? JSON.parse(JSON.stringify(item)) : { ...JSON.parse(JSON.stringify(PROMO_DEF)), jenis, nama: '', aktivasi: 'otomatis', platform: [], mulai: tglIso(n0), akhir: tglIso(n0) };
  let step = 0;
  const produkJenis = jenis === 'produk';

  const step1 = () => card(`<h2 class="text-[20px] font-semibold mb-2">Informasi Promosi</h2>
    ${fRow('Outlet', `${fSelect('outlet', OUTLETS, '', 'Pilih')}${fChip(OUTLET_UTAMA)}`, { required: true })}
    ${fRow('Status Promo', `<div class="pt-2">${fSwitch('aktif', o.aktif)}</div>`)}
    ${fRow('Nama Promo', fInput('nama', 'Promo Meriah', o.nama, { counter: 45, req: 'Mohon isi nama promo' }), { required: true })}
    ${fRow('Deskripsi Promo', fInput('deskripsi', 'Diskon untuk pembelian produk tertentu', o.deskripsi, { area: true, req: 'Mohon isi deskripsi promo' }), { required: true })}
    ${fRow('Aktivasi Promo', `<div class="flex flex-wrap gap-4">${radioCard('aktivasi', 'otomatis', 'Otomatis', 'Promo akan otomatis aktif saat pembayaran', o.aktivasi === 'otomatis')}${radioCard('aktivasi', 'manual', 'Manual', 'Kasir perlu mengaktifkan promo secara manual', o.aktivasi === 'manual')}</div>`, { required: true })}
    ${fRow('Platform', `<div data-field="platform" class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 pt-1">${PR_PLATFORM.map((x, i) => fCheck('pf' + i, o.platform.includes(x), x)).join('')}</div>`, { required: true })}
    <hr class="border-line my-3">
    ${fRow('Durasi Promo', `<div class="grid sm:grid-cols-2 gap-4">
      <div>${prSub('Tanggal Mulai')}<input type="date" name="mulai" class="fin" value="${o.mulai}"></div><div>${prSub('Tanggal Berakhir')}<input type="date" name="akhir" class="fin" value="${o.akhir}"></div>
      <div>${prSub('Jam Mulai')}<input type="time" name="jamMulai" class="fin" value="${o.jamMulai}"></div><div>${prSub('Jam Selesai')}<input type="time" name="jamSelesai" class="fin" value="${o.jamSelesai}"></div></div>`, { required: true })}
    ${fRow('Pilih Hari', `<div class="pt-1">${fCheck('semuaHari', o.hari.length === 7, 'Pilih Semua Hari')}<div class="flex flex-wrap gap-x-6">${PR_HARI.map(([d, l]) => fCheck('hr' + d, o.hari.includes(d), l)).join('')}</div></div>`, { required: true })}
    <hr class="border-line my-3">
    ${fRow('Unggah Banner', fUpload(), { help: 'Format gambar .jpg .jpeg .png dengan rekomendasi ukuran 480px x 180px' })}`);

  const potonganHtml = () => {
    const opts = [['pct', 'Potongan (%)'], ['rp', 'Potongan (Rp)'], ['bonus', 'Bonus Produk'], ...(produkJenis ? [['coret', 'Harga Coret']] : [])];
    let h = fRow('Jenis Potongan', prRadios('potongan', opts, o.potongan), { required: true });
    if (o.potongan === 'pct' || o.potongan === 'rp') {
      const nilaiEl = o.potongan === 'pct' ? `<div data-field="nilai"><input name="nilai" inputmode="decimal" class="fin" placeholder="Besaran Potongan (%)" value="${o.nilai || ''}"></div>` : prMoney('nilai', 'Besaran Potongan (Rp)', o.nilai);
      const maksEl = `<div class="flex flex-wrap items-center gap-4 mt-2">${fCheck('pakaiMaks', !!o.maks, 'Maksimal Potongan')}${o.maks || o.pakaiMaks ? `<div class="w-[218px]">${prMoney('maks', 'Besaran Potongan (Rp)', o.maks)}</div>` : ''}</div>`;
      h += produkJenis
        ? fRow('Besaran Potongan', `${nilaiEl}<div class="mt-2 ${o.potongan === 'pct' ? '' : 'text-[#A0A6A6]'}"><label class="flex items-center gap-3 py-1 text-[14px]"><input type="checkbox" name="ubahKasir" class="w-4 h-4 accent-[#04C99E]" ${o.ubahKasir ? 'checked' : ''} ${o.potongan === 'pct' ? '' : 'disabled'}>Izinkan Kasir Ubah Potongan (Khusus potongan %)</label></div>${maksEl.replace('mt-2', 'mt-0')}`, { required: true })
        : fRow('', `${nilaiEl}${o.potongan === 'pct' ? maksEl : ''}`);
    }
    return h;
  };
  const dasarHtml = () => fRow('Promo Berdasarkan', `${prRadios('dasar', [['rp', 'Min Pembelian (Rp)'], ['qty', 'Min Kuantitas (jumlah)']], o.dasar)}<div class="mt-2">${o.dasar === 'rp' ? prMoney('minimal', 'Min Pembelian (Rp)', o.minimal) : `<div data-field="minimal"><input name="minimal" inputmode="numeric" class="fin" placeholder="Min Kuantitas (jumlah)" value="${o.minimal || ''}"></div>`}</div>`, { required: true });
  const bonusHtml = () => {
    const sub = [['salah', 'Dapat salah satu produk bonus'], ['semua', 'Dapat semua produk bonus'], ['kombinasi', 'Dapat kombinasi produk bonus (hanya jika “Berlaku Kelipatan” diaktifkan)', !o.kelipatan]];
    const bebas = o.bonusMode !== 'sesuai';
    return `${fRow('', fCheck('kelipatan', o.kelipatan, 'Berlaku Kelipatan')).replace('py-3', 'py-0 -mt-2')}
      ${fRow('Ketentuan Bonus Produk', `<div class="space-y-3">${fRadioCard('bonusTop', 'sesuai', 'Bonus produk sesuai produk terjual', !bebas, { disabled: !produkJenis })}
        <div class="border rounded-md ${bebas ? 'border-brand' : 'border-[#D6D9D9]'}"><label class="flex items-center gap-3 px-4 h-10 text-[14px] border-b border-line"><input type="radio" name="bonusTop" value="bebas" class="w-4 h-4 accent-[#04C99E]" ${bebas ? 'checked' : ''}>Bebas pilih produk apa saja</label>
          <div class="px-8 py-2">${sub.map(([v, l, dis]) => `<label class="flex items-center gap-3 py-1.5 text-[14px] ${dis || !bebas ? 'text-[#A0A6A6]' : ''}"><input type="radio" name="bonusMode" value="${v}" class="w-4 h-4 accent-[#04C99E]" ${o.bonusMode === v ? 'checked' : ''} ${dis || !bebas ? 'disabled' : ''}>${l}<i data-lucide="info" class="ic-sm"></i></label>`).join('')}</div></div>
        ${bebas ? `${outlineAdd('Pilih Bonus Produk', 'data-pick="bonus"')}${prChips('bonus', o.bonus)}` : ''}</div>`, { required: true })}`;
  };
  const coretAtas = () => fRow('', `<div class="space-y-1">${fCheck('coretBatas', !!o.coretMaks || o.coretBatas, 'Jumlah maksimal pembelian tiap transaksi')}${o.coretMaks || o.coretBatas ? `<div class="w-[218px] pl-7"><input name="coretMaks" inputmode="numeric" class="fin" placeholder="Jumlah maksimal" value="${o.coretMaks || ''}"></div>` : ''}${fCheck('coretSpesial', o.coretSpesial, 'Terapkan promo harga coret untuk group harga spesial dan harga ojek online')}</div>`).replace('py-3', 'py-0');
  const coretKartu = () => {
    const rows = o.coret.map((r, i) => { const p = byId('produk', r.produk); if (!p) return ''; const d = Math.max(0, p.hargaJual - r.harga);
      return `<tr><td>${esc(p.nama)}</td><td class="whitespace-nowrap">${rp(p.hargaJual)}</td><td><div class="fin flex items-center gap-2 w-[150px]"><span class="text-ink-3">Rp</span><input data-coret="${i}" data-money inputmode="numeric" class="flex-1 min-w-0 outline-none" value="${r.harga ? r.harga.toLocaleString('id-ID') : ''}"></div></td>
        <td data-cpct="${i}">${p.hargaJual ? Math.round(d / p.hargaJual * 100) : 0}%</td><td data-crp="${i}" class="whitespace-nowrap">${rp(d)}</td><td>${delBtn('coret', i)}</td></tr>`; }).join('');
    return card(`<div class="flex flex-wrap items-center gap-3"><p class="text-[14px] font-semibold">Pilih Produk</p><div class="ml-auto flex gap-3"><button type="button" data-preset ${o.coret.length ? '' : 'disabled'} class="h-9 px-3 rounded-md bg-brand disabled:bg-[#D6D9D9] text-white text-[14px] font-semibold">Preset Harga Promo</button>${btnPrimary('Pilih Produk', 'plus').replace('<button', '<button type="button" data-pick="coret"')}</div></div>
        <div class="overflow-x-auto mt-4"><table class="tbl w-full"><thead><tr style="background:#FAFAFA"><th>Nama Produk</th><th>Harga Jual</th><th>Harga Promo</th><th>Diskon (%)</th><th>Nominal Diskon</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        ${o.coret.length ? '' : '<p class="text-center text-[14px] text-ink-3 py-8">Belum ada produk yang dipilih</p>'}
        <div class="flex items-center gap-3 text-[12px] text-ink-3 mt-3">Tampilkan: <span class="fin min-h-0 h-8 w-[64px] flex items-center">10</span><span>Ditampilkan 1 - ${o.coret.length} dari ${o.coret.length} data</span></div>`);
  };
  const step2 = () => {
    let h = '<h2 class="text-[20px] font-semibold mb-4">Ketentuan Promo</h2>', bawah = '';
    if (produkJenis) {
      h += infoBox('Informasi', 'Izinkan kasir ubah potongan hanya terdapat di POS') + '<div class="mt-3"></div>' + potonganHtml();
      if (o.potongan !== 'coret') {
        h += dasarHtml();
        h += fRow('Produk Promo', `${outlineAdd('Pilih Produk', 'data-pick="produk"')}${prChips('produk', o.produk)}`, { required: true });
        const satu = o.produk.length < 2;
        h += fRow('Jenis Promo <i data-lucide="info" class="ic-sm inline align-[-3px]"></i>', `<div class="flex flex-wrap gap-4">${radioCard('jenisPromo', 'bundling', 'Promo Bundling', 'Pelanggan diharuskan membeli seluruh produk yang telah ditentukan', !satu && o.jenisPromo === 'bundling', satu)}${radioCard('jenisPromo', 'satuan', 'Promo Satuan', 'Pelanggan boleh memilih salah satu produk yang telah ditentukan', satu || o.jenisPromo === 'satuan', satu)}</div>`);
        if (o.potongan === 'bonus') h += bonusHtml();
      } else { h += coretAtas(); bawah = coretKartu(); }
    } else {
      h += `<div class="rounded-md border border-[#69C0E6] bg-[#E6F6FC] px-4 py-3 text-[14px] text-ink-2 flex gap-3 mb-3"><i data-lucide="info" class="ic-sm mt-0.5 shrink-0" style="fill:#404545;color:#fff"></i><span>Promo berdasarkan minimum kuantitas dan bonus kombinasi hanya berlaku pada POS versi 3.2.23000 ke atas.</span></div>`;
      h += dasarHtml();
      if (o.dasar === 'qty') h += fRow('Produk Syarat Promo', `${outlineAdd('Pilih Produk', 'data-pick="syarat"')}${prChips('syarat', o.syarat)}`, { required: true });
      h += potonganHtml();
      if (o.potongan === 'bonus') h += bonusHtml();
    }
    return card(h) + bawah;
  };

  const footer = () => `<div class="w-full flex items-center gap-8 lg:pl-[284px]">${fBtn.outline('Simpan Draf', 'data-draf').replace('px-6', 'px-3')}<div class="ml-auto flex items-center gap-8">${step ? fBtn.text('Kembali', 'data-back') + fBtn.primary('Simpan', 'data-save') : fBtn.text('Batal', 'data-batal') + fBtn.primary('Selanjutnya', 'data-next')}</div></div>`;
  const sh = navSheet({ title: isEdit ? 'Ubah Promosi' : 'Tambah Promosi', navs: ['Informasi Promo', 'Ketentuan Promo'] });
  const R = sh.root, main = () => R.querySelector('[data-main]');
  const show = () => { sh.setNav(step, step ? [0] : []); sh.setMain(step ? step2() : step1()); sh.setFooter(footer()); };
  const repaint = () => { const y = R.querySelector('[data-body]').scrollTop; sh.setMain(step ? step2() : step1()); R.querySelector('[data-body]').scrollTop = y; };

  const baca = () => {
    const v = formValues(main()), num = x => parseFloat(String(x || '').replace(',', '.')) || 0;
    if (step === 0) {
      Object.assign(o, { aktif: v.aktif, nama: v.nama, deskripsi: v.deskripsi, aktivasi: v.aktivasi || o.aktivasi, mulai: v.mulai, akhir: v.akhir, jamMulai: v.jamMulai, jamSelesai: v.jamSelesai });
      o.platform = PR_PLATFORM.filter((_, i) => v['pf' + i]);
      o.hari = PR_HARI.map(h => h[0]).filter(d => v['hr' + d]);
      return;
    }
    if (v.potongan) o.potongan = v.potongan;
    if (v.dasar) o.dasar = v.dasar;
    if ('minimal' in v) o.minimal = toNum(v.minimal);
    if ('nilai' in v) o.nilai = o.potongan === 'pct' ? num(v.nilai) : toNum(v.nilai);
    if ('pakaiMaks' in v) { o.pakaiMaks = v.pakaiMaks; o.maks = v.pakaiMaks ? toNum(v.maks) : 0; }
    if ('ubahKasir' in v) o.ubahKasir = v.ubahKasir;
    if (v.jenisPromo) o.jenisPromo = v.jenisPromo;
    if ('kelipatan' in v) { o.kelipatan = v.kelipatan; if (!o.kelipatan && o.bonusMode === 'kombinasi') o.bonusMode = 'semua'; }
    if (v.bonusTop === 'sesuai') o.bonusMode = 'sesuai'; else if (v.bonusTop === 'bebas') o.bonusMode = v.bonusMode || (o.bonusMode === 'sesuai' ? 'semua' : o.bonusMode);
    if ('coretBatas' in v) { o.coretBatas = v.coretBatas; o.coretMaks = v.coretBatas ? Math.floor(num(v.coretMaks)) : 0; }
    if ('coretSpesial' in v) o.coretSpesial = v.coretSpesial;
    main().querySelectorAll('[data-coret]').forEach(el => { o.coret[+el.dataset.coret].harga = toNum(el.value); });
    if (o.produk.length < 2) o.jenisPromo = 'satuan';
  };
  const gagal = msg => { toast('Gagal!', msg, 'error'); return false; };
  const cek1 = () => {
    if (!validate(main())) return false;
    if (!o.platform.length) return gagal('Pilih minimal satu platform');
    if (!o.mulai || !o.akhir || o.akhir < o.mulai) return gagal('Tanggal berakhir tidak boleh sebelum tanggal mulai');
    if (o.jamSelesai < o.jamMulai) return gagal('Jam selesai tidak boleh sebelum jam mulai');
    if (!o.hari.length) return gagal('Pilih minimal satu hari');
    return true;
  };
  const cek2 = () => {
    if (o.potongan === 'coret') {
      if (!o.coret.length) return gagal('Pilih produk untuk harga coret');
      if (o.coret.some(r => !r.harga || r.harga >= (byId('produk', r.produk)?.hargaJual || 0))) return gagal('Harga promo harus lebih kecil dari harga jual');
      return true;
    }
    if (!(o.minimal > 0)) return gagal(o.dasar === 'qty' ? 'Mohon isi minimal kuantitas' : 'Mohon isi minimal pembelian');
    if (!produkJenis && o.dasar === 'qty' && !o.syarat.length) return gagal('Pilih produk syarat promo');
    if (produkJenis && !o.produk.length) return gagal('Pilih produk promo');
    if ((o.potongan === 'pct' || o.potongan === 'rp') && !(o.nilai > 0)) return gagal('Mohon isi besaran potongan');
    if (o.potongan === 'pct' && o.nilai > 100) return gagal('Potongan tidak boleh lebih dari 100%');
    if (o.potongan === 'bonus' && o.bonusMode !== 'sesuai' && !o.bonus.length) return gagal('Pilih bonus produk');
    return true;
  };
  const simpan = draf => {
    const lama = item && byId('promo', item.id);
    const doc = { ...o, id: item?.id || uid(), draf, dibuat: o.dibuat || new Date().toISOString() };
    delete doc.pakaiMaks; delete doc.coretBatas;
    // pesanan yang sudah memakai versi lama tetap dihitung dengan versi lama
    if (lama && !lama.draf) db().pesanan.forEach(x => { if ((x.promo === lama.id || (x.promoProduk || []).includes(lama.id)) && !OPEN_STATUS.includes(x.status) && !x.promoSnap?.[lama.id]) x.promoSnap = { ...x.promoSnap, [lama.id]: JSON.parse(JSON.stringify(lama)) }; });
    db().promo = db().promo.filter(x => x.id !== doc.id);
    db().promo.unshift(doc);
    logPromo(doc.nama, draf ? 'Simpan Draf Promo' : isEdit ? 'Ubah Promo' : 'Tambah Promo');
    saveDB(); sh.close(); render();
  };
  const batal = async () => {
    if (await confirmDialog({ title: isEdit ? 'Batal Ubah Promo' : 'Batal Tambah Promo', html: `Membatalkan ${isEdit ? 'Ubah' : 'Tambah'} Promo akan menghapus seluruh data yang telah diinput dan tidak dapat dibatalkan. Lanjutkan?`, danger: true })) sh.close();
  };
  sh.onClose = batal;

  R.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'semuaHari') return main().querySelectorAll('[name^="hr"]').forEach(c => { c.checked = t.checked; });
    if (/^hr\d$/.test(t.name)) { main().querySelector('[name="semuaHari"]').checked = [...main().querySelectorAll('[name^="hr"]')].every(c => c.checked); return; }
    if (t.type === 'radio' || ['pakaiMaks', 'kelipatan', 'coretBatas'].includes(t.name)) { baca(); if (t.name === 'potongan') { o.nilai = 0; o.maks = 0; o.pakaiMaks = false; } repaint(); }
  });
  R.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-coret]')) {
      const i = +t.dataset.coret, p = byId('produk', o.coret[i].produk), d = Math.max(0, p.hargaJual - toNum(t.value));
      o.coret[i].harga = toNum(t.value);
      R.querySelector(`[data-cpct="${i}"]`).textContent = (p.hargaJual ? Math.round(d / p.hargaJual * 100) : 0) + '%';
      R.querySelector(`[data-crp="${i}"]`).textContent = rp(d);
    }
  });
  R.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-batal]')) return batal();
    if (t.closest('[data-next]') || (t.closest('[data-navi="1"]') && step === 0)) { baca(); if (!cek1()) return; step = 1; return show(); }
    if (t.closest('[data-back]') || (t.closest('[data-navi="0"]') && step === 1)) { baca(); step = 0; return show(); }
    const un = t.closest('[data-unpick]');
    if (un) { baca(); const key = un.closest('[data-chips]').dataset.chips; o[key] = o[key].filter(id => id !== un.dataset.unpick); return repaint(); }
    const del = t.closest('[data-del^="coret:"]');
    if (del) { baca(); o.coret.splice(+del.dataset.del.split(':')[1], 1); return repaint(); }
    const pk = t.closest('[data-pick]');
    if (pk) {
      baca();
      const key = pk.dataset.pick, cur = key === 'coret' ? o.coret.map(r => r.produk) : o[key];
      const ids = await pilihProdukPromo(cur);
      if (!ids) return;
      if (key === 'coret') o.coret = ids.map(id => o.coret.find(r => r.produk === id) || { produk: id, harga: 0 });
      else o[key] = ids;
      if (key === 'produk' && o.produk.length < 2) o.jenisPromo = 'satuan';
      return repaint();
    }
    if (t.closest('[data-preset]')) {
      baca();
      const wait = confirmDialog({ title: 'Preset Harga Promo', html: `<p class="mb-3">Turunkan harga jual semua produk terpilih sebesar:</p><div class="fin flex items-center gap-3"><input id="prPreset" class="flex-1 outline-none" value="10" inputmode="numeric"><span>%</span></div>`, ok: 'Terapkan' });
      let pct = 10;
      const inp = document.getElementById('prPreset');
      inp.addEventListener('input', () => { pct = parseFloat(inp.value.replace(',', '.')) || 0; });
      if (!(await wait)) return;
      o.coret.forEach(r => { const p = byId('produk', r.produk); if (p) r.harga = Math.max(0, Math.round(p.hargaJual * (1 - Math.min(100, pct) / 100))); });
      return repaint();
    }
    if (t.closest('[data-draf]')) {
      baca();
      if (!o.nama) return gagal('Mohon isi nama promo');
      simpan(true); return toast('Berhasil!', 'Draf promo berhasil disimpan');
    }
    if (t.closest('[data-save]')) {
      baca();
      if (!cek2()) return;
      if (!(await confirmDialog({ title: 'Simpan Promo', html: `Promo <b>${esc(o.nama)}</b> akan disimpan dan tampil di daftar promo sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?` }))) return;
      simpan(false);
      toast(isEdit ? 'Sedang Mengubah Promo!' : 'Sedang Menambahkan Promo!', `Promo <b>${esc(o.nama)}</b> sedang ${isEdit ? 'diubah' : 'ditambahkan'} ke outlet ${OUTLET_UTAMA}. Silakan periksa log aktivitas promo`, 'warn');
    }
  });
  show();
}

// ---------- Log Aktivitas promo ----------
function logPromoModal() {
  const rows = db().logPromo;
  const d = nodeOf(`<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style="z-index:${layer += 2}">
    <div class="bg-white rounded-lg ${rows.length ? 'w-[760px]' : 'w-[448px]'} max-w-full max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-5 border-b border-line"><h3 class="text-[20px] font-semibold">Log Aktivitas</h3><button data-x aria-label="Tutup"><i data-lucide="x" style="width:24px;height:24px"></i></button></div>
      <div class="px-6 py-6 overflow-auto">${rows.length ? `<table class="tbl w-full"><thead><tr><th>Tanggal</th><th>Nama Promo</th><th>Aktivitas</th><th>Status</th><th>User</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td class="whitespace-nowrap">${r.waktu}</td><td>${esc(r.nama)}</td><td>${r.aktivitas}</td><td>${prPill(r.status === 'Berhasil' ? 'Aktif' : r.status).replace('>Aktif<', '>Berhasil<')}</td><td>${r.user}</td></tr>`).join('')}</tbody></table>`
        : '<p class="text-center"><span class="inline-block bg-[#F2F2F2] rounded px-2 py-1 text-[12px] text-ink-2">Tidak ada data</span></p>'}</div></div></div>`);
  d.querySelector('[data-x]').onclick = () => { d.remove(); layer -= 2; };
  document.body.appendChild(d); lucide.createIcons();
}

// ---------- halaman daftar ----------
async function hapusPromo(p) {
  if (!(await confirmDialog({ title: 'Hapus Promo', html: `Promo <b>${esc(p.nama)}</b> akan dihapus dan tidak dapat digunakan lagi di kasir. Lanjutkan?`, danger: true }))) return;
  // tidak dihapus dari data supaya laporan transaksi lama tetap memakai promonya
  p.dihapus = true; p.aktif = false;
  logPromo(p.nama, 'Hapus Promo'); saveDB(); render();
  toast('Berhasil!', `Promo <b>${esc(p.nama)}</b> berhasil dihapus`);
}
function ubahStatusPromo(p) {
  p.aktif = !p.aktif;
  logPromo(p.nama, p.aktif ? 'Aktifkan Promo' : 'Nonaktifkan Promo'); saveDB(); render();
  toast('Berhasil!', `Promo <b>${esc(p.nama)}</b> berhasil ${p.aktif ? 'diaktifkan' : 'dinonaktifkan'}`);
}
function promoList(jenis, slug) {
  const bulanIni = () => { const d = new Date(); return [tglIso(new Date(d.getFullYear(), d.getMonth(), 1)), tglIso(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; };
  return {
    title: jenis === 'total' ? 'Promosi Per Total Pembelian' : 'Promosi Per Produk', colPick: true,
    sub: () => { const [a, b] = bulanIni(); return `<span class="flex items-center gap-2 font-medium text-ink-2"><i data-lucide="calendar" class="ic-sm"></i>${prTglP(a)} - ${prTglP(b)}</span>`; },
    links: '<button data-act="plog" class="w-9 h-9 flex items-center justify-center text-brand" aria-label="Log Aktivitas"><i data-lucide="history"></i></button>',
    add: ['Tambah Promosi', () => promoForm(jenis)],
    acts: { plog: () => logPromoModal(), pstatus: el => prStatusMenu(slug, el), pchip: el => { prFilter(slug).delete(el.dataset.v); repaintSel(slug); } },
    extraFilters: () => dateBtn(invPeriode().btn) + prStatusFilter(slug),
    items: s => { const [a, b] = bulanIni(); return db().promo.filter(p => p.jenis === jenis && !p.dihapus && textQ(s, p.nama) && prFilter(slug).has(promoStatus(p)) && p.mulai <= b && p.akhir >= a); },
    cols: jenis === 'total' ? ['Nama', 'Tipe', 'Kriteria', 'Bonus', 'Durasi', 'Outlet', 'Status'] : ['Nama', 'Tipe', 'Produk', 'Kriteria', 'Bonus', 'Durasi', 'Outlet', 'Status'],
    row: p => [esc(p.nama), p.aktivasi === 'manual' ? 'Manual' : 'Otomatis',
      ...(jenis === 'produk' ? [esc(prProduk(p.potongan === 'coret' ? p.coret.map(r => r.produk) : p.produk).join(', ') || '-')] : []),
      promoKriteria(p), promoHadiah(p), prDurasi(p), OUTLET_UTAMA, prPill(promoStatus(p))],
    menu: p => [['Ubah', () => promoForm(jenis, p)], ...(p.draf ? [] : [[p.aktif ? 'Nonaktifkan' : 'Aktifkan', () => ubahStatusPromo(p)]]), ['Hapus', () => hapusPromo(p), 'danger']]
  };
}
Object.assign(LISTS, { 'promo-per-total-pembelian': promoList('total', 'promo-per-total-pembelian'), 'promo-per-produk': promoList('produk', 'promo-per-produk') });
['promo-per-total-pembelian', 'promo-per-produk'].forEach(slug => { PAGES[slug] = () => listPage(slug); });
