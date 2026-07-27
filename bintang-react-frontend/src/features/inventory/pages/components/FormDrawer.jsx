import { X } from 'lucide-react';
import { Button } from './PageShell';

export default function FormDrawer({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="pi-modal-backdrop" role="presentation">
      <section className="pi-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pi-drawer-header">
          <h2>{title}</h2>
          <button className="pi-icon-button" type="button" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="pi-drawer-body">{children}</div>
        <div className="pi-drawer-footer">
          <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
          <Button type="button" onClick={onClose}>Simpan</Button>
        </div>
      </section>
    </div>
  );
}
