/**
 * Helper to serialize and deserialize order metadata (T-209 Revisi 2).
 * Reads directly from native database columns on the Order model.
 */

export const defaultMetadata = {
  customerEmail: '',
  customerAddress: '',
  shippingCourier: '-',
  shippingService: '-',
  shippingDate: '-',
  dropshipStore: '-',
  dropshipSender: '-',
  dropshipPhone: '-',
  posStaff: '-',
  dueDate: '-',
  invoiceFooter: 'Terima kasih atas pesanan Anda',
  catatan: ''
};

export const parseOrderMetadata = (orderOrCatatan) => {
  if (!orderOrCatatan) return { ...defaultMetadata };

  // If passed an Order object
  if (typeof orderOrCatatan === 'object') {
    const o = orderOrCatatan;
    const staffName = o.dilayani_oleh_nama || o.dilayani_oleh || '-';

    return {
      customerEmail: o.email_pelanggan || '',
      customerAddress: o.alamat_pelanggan || '',
      shippingCourier: o.kurir_pengiriman || '-',
      shippingService: o.layanan_pengiriman || '-',
      shippingDate: o.tanggal_pengiriman || '-',
      dropshipStore: o.toko_dropship || '-',
      dropshipSender: o.pengirim_dropship || '-',
      dropshipPhone: o.telepon_dropship || '-',
      posStaff: staffName,
      dueDate: o.jatuh_tempo || '-',
      invoiceFooter: o.catatan_footer || 'Terima kasih atas pesanan Anda',
      catatan: o.catatan_pelanggan || 'Tidak ada'
    };
  }

  // Fallback string parser if raw catatan_pelanggan string is passed
  const match = String(orderOrCatatan).match(/\[METADATA:\s*({.*?})\]/s);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      const cleanNotes = String(orderOrCatatan).replace(/\[METADATA:\s*({.*?})\]\n?/s, '').trim();
      return {
        ...defaultMetadata,
        ...parsed,
        catatan: cleanNotes || 'Tidak ada'
      };
    } catch (e) {
      // ignore
    }
  }

  return {
    ...defaultMetadata,
    catatan: String(orderOrCatatan).trim() || 'Tidak ada'
  };
};

export const serializeOrderMetadata = (meta, cleanNotesText) => {
  // Provided for backward compatibility if any legacy code calls it
  const payload = {};
  if (meta.customerEmail !== undefined) payload.email_pelanggan = meta.customerEmail;
  if (meta.customerAddress !== undefined) payload.alamat_pelanggan = meta.customerAddress;
  if (meta.shippingCourier !== undefined) payload.kurir_pengiriman = meta.shippingCourier;
  if (meta.shippingService !== undefined) payload.layanan_pengiriman = meta.shippingService;
  if (meta.shippingDate !== undefined) payload.tanggal_pengiriman = meta.shippingDate === '-' ? null : meta.shippingDate;
  if (meta.dropshipStore !== undefined) payload.toko_dropship = meta.dropshipStore;
  if (meta.dropshipSender !== undefined) payload.pengirim_dropship = meta.dropshipSender;
  if (meta.dropshipPhone !== undefined) payload.telepon_dropship = meta.dropshipPhone;
  if (meta.dueDate !== undefined) payload.jatuh_tempo = meta.dueDate === '-' ? null : meta.dueDate;
  if (meta.invoiceFooter !== undefined) payload.catatan_footer = meta.invoiceFooter;
  if (cleanNotesText !== undefined) payload.catatan_pelanggan = cleanNotesText;
  return payload;
};
