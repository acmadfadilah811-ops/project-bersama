import { useState, useEffect } from 'react';

export default function DataTable({ columns, rows, getRowKey, emptyText = 'Tidak ada data' }) {
  const [widths, setWidths] = useState({});

  useEffect(() => {
    const initialWidths = {};
    columns.forEach((col) => {
      initialWidths[col.key] = col.width || (col.key === 'select' ? 50 : 150);
    });
    setWidths(initialWidths);
  }, [columns]);

  const handleResizeStart = (e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widths[colKey] || 150;

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

  return (
    <div className="pi-table-card">
      <table className="pi-table" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
        <thead>
          <tr>
            {columns.map((column) => {
              const w = widths[column.key] || (column.key === 'select' ? 50 : 150);
              return (
                <th
                  key={column.key}
                  style={{
                    width: w,
                    minWidth: w,
                    maxWidth: w,
                    position: 'relative',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {column.label}
                  {column.key !== 'select' && (
                    <div
                      onMouseDown={(e) => handleResizeStart(e, column.key)}
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
                  const w = widths[column.key] || (column.key === 'select' ? 50 : 150);
                  return (
                    <td
                      key={column.key}
                      style={{
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
