import { useState } from 'react';

const lebarBawaan = (column) => column.width || (column.key === 'select' ? 50 : 150);

export default function DataTable({ columns, rows, getRowKey, emptyText = 'Tidak ada data' }) {
  // Hanya lebar yang diubah pengguna (tarik tepi judul) yang disimpan; sisanya
  // langsung dari column.width. Dulu lebar diisi lewat useEffect setiap kali
  // `columns` berganti identitas (= setiap render induk): render pertama memakai
  // 150 px untuk semua kolom lalu tabel digambar ulang & "melompat", dan lebar
  // hasil tarikan pengguna ter-reset.
  const [widths, setWidths] = useState({});
  const lebar = (column) => widths[column.key] ?? lebarBawaan(column);

  const handleResizeStart = (e, column) => {
    e.preventDefault();
    e.stopPropagation();
    const colKey = column.key;
    const startX = e.clientX;
    const startWidth = lebar(column);

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setWidths((prev) => ({
        ...prev,
        [colKey]: Math.max(50, startWidth + deltaX),
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Kolom `sticky: true` di AWAL daftar kolom tetap terlihat saat tabel digeser ke
  // samping (mis. Nama Produk saat mengubah harga di kolom kanan). Hanya kolom
  // sticky yang berurutan dari kiri yang dikunci.
  const posisiKunci = {};
  let kiri = 0;
  for (const column of columns) {
    if (!column.sticky) break;
    posisiKunci[column.key] = kiri;
    kiri += lebar(column);
  }
  const kunciTerakhir = Object.keys(posisiKunci).pop();
  const kelasKunci = (key) =>
    key in posisiKunci ? `pi-sticky${key === kunciTerakhir ? ' pi-sticky-akhir' : ''}` : undefined;

  return (
    <div className="pi-table-card">
      <table className="pi-table" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
        <thead>
          <tr>
            {columns.map((column) => {
              const w = lebar(column);
              return (
                <th
                  key={column.key}
                  className={kelasKunci(column.key)}
                  style={{
                    width: w,
                    minWidth: w,
                    maxWidth: w,
                    position: column.key in posisiKunci ? 'sticky' : 'relative',
                    left: posisiKunci[column.key],
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {column.label}
                  {column.key !== 'select' && (
                    <div
                      onMouseDown={(e) => handleResizeStart(e, column)}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '6px',
                        cursor: 'col-resize',
                        zIndex: 20,
                      }}
                      className="pi-resize-handle"
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="pi-table-empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={getRowKey ? getRowKey(row) : row.id || index}>
                {columns.map((column) => {
                  const w = lebar(column);
                  return (
                    <td
                      key={column.key}
                      className={kelasKunci(column.key)}
                      style={{
                        left: posisiKunci[column.key],
                        width: w,
                        minWidth: w,
                        maxWidth: w,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
