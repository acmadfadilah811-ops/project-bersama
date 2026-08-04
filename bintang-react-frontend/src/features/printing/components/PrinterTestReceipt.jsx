export default function PrinterTestReceipt({ printerName, paperSize }) {
  const width = paperSize === '58mm' ? '48mm' : '72mm';

  return (
    <div
      className="print-area hidden bg-white p-3 font-mono text-[11px] text-black print:block"
      style={{ width, maxWidth: width }}
    >
      <div className="border-b border-dashed border-black pb-2 text-center font-bold">
        <p>BINTANG ADVERTISING</p>
        <p>UJI CETAK PRINTER</p>
      </div>
      <div className="space-y-1 py-2 text-[9px]">
        <p>Printer: {printerName || 'Belum diberi nama'}</p>
        <p>Kertas: {paperSize === '58mm' ? 'Thermal 58 mm' : 'Thermal 80 mm'}</p>
        <p>Waktu: {new Date().toLocaleString('id-ID')}</p>
      </div>
      <div className="border-t border-dashed border-black pt-2 text-center text-[9px]">
        Jika teks ini terbaca, dialog cetak browser siap dipakai.
      </div>
    </div>
  );
}
