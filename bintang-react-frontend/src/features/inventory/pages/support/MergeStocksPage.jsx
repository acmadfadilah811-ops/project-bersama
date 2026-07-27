import { Button, PageHeader, Select } from '../components/PageShell';

export function MergeStocksPage() {
  return (
    <>
      <PageHeader
        title="Gabung Stok"
        description="Gabungkan stok dari dua produk menjadi satu produk tujuan. Berguna saat ada produk duplikat."
      />
      <div className="pi-two-columns">
        <div className="pi-form-group">
          <label>Produk Sumber</label>
          <Select defaultValue="">
            <option value="" disabled>Pilih produk sumber</option>
          </Select>
        </div>
        <div className="pi-form-group">
          <label>Produk Tujuan</label>
          <Select defaultValue="">
            <option value="" disabled>Pilih produk tujuan</option>
          </Select>
        </div>
      </div>
      <div className="pi-toolbar pi-toolbar-end">
        <Button variant="warning">Gabungkan Stok</Button>
      </div>
    </>
  );
}
