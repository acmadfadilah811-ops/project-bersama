import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Dropdown from './Dropdown';

export default function Pagination({
  rowsPerPage,
  onRowsPerPageChange,
  showRows = true,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) {
  const [jumpVal, setJumpVal] = useState(String(currentPage));

  useEffect(() => {
    setJumpVal(String(currentPage));
  }, [currentPage]);

  const handleJump = (e) => {
    if (e.key === 'Enter') {
      const page = parseInt(jumpVal);
      if (page >= 1 && page <= totalPages) {
        onPageChange?.(page);
      } else {
        setJumpVal(String(currentPage));
      }
    }
  };

  return (
    <div
      className={`flex items-center gap-5 px-1 py-4 text-sm text-slate-500 ${
        showRows ? 'justify-between' : ''
      }`}
    >
      {showRows && (
        <Dropdown
          options={['10 Baris', '20 Baris', '50 Baris', '100 Baris']}
          value={rowsPerPage}
          onChange={onRowsPerPageChange}
          minW="min-w-[140px]"
          placement="up"
        />
      )}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange?.(currentPage - 1)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-slate-600 font-semibold px-2">
            Halaman {currentPage} dari {totalPages || 1}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange?.(currentPage + 1)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span>Go to</span>
          <input
            value={jumpVal}
            onChange={(e) => setJumpVal(e.target.value)}
            onKeyDown={handleJump}
            className="w-12 text-center border border-slate-200 rounded-md py-1 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
