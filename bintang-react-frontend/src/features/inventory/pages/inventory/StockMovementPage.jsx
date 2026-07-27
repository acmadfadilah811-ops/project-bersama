import { useState, useEffect } from 'react';
import { Calendar, Download, ChevronsUpDown, ChevronDown } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

export function StockMovementPage() {
  const [startDate, setStartDate] = useState('2026-06-25');
  const [endDate, setEndDate] = useState('2026-06-25');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [searchVal, setSearchVal] = useState('');
  const [isAutocomplete, setIsAutocomplete] = useState(true);

  // Pagination & Sorting States
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Stock Movement Data with API integration
  const [movementList, setMovementList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setListLoading(true);
      setFetchError('');
      try {
        const res = await apiClient.get('/product-stock-movements/summary/', {
          params: {
            start_date: startDate,
            end_date: endDate
          }
        });
        if (isMounted) {
          setMovementList(res.data);
        }
      } catch (err) {
        console.error('Error fetching stock movements:', err);
        if (isMounted) {
          setFetchError('Gagal memuat data pergerakan stok');
        }
      } finally {
        if (isMounted) {
          setListLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [startDate, endDate]);

  // Reset page number on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchVal, pageSize]);

  const handleDownloadExcel = async () => {
    try {
      const response = await apiClient.get(`/export/stock-movement/`, {
        params: {
          start_date: startDate,
          end_date: endDate
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `summary-${startDate}__${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Gagal mendownload Excel:', err);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Sort list
  let sortedList = [...movementList];
  if (sortKey) {
    sortedList.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Date Range Picker helpers
  const getFormattedRange = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const parse = (dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = months[d.getMonth()];
      const year = String(d.getFullYear()).slice(-2);
      return `${day} ${month} ${year}`;
    };
    return `${parse(startDate)} - ${parse(endDate)}`;
  };

  const handleShiftDate = (direction) => {
    setSelectedPreset('custom');
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setDate(start.getDate() + direction);
    end.setDate(end.getDate() + direction);
    const toISO = (d) => d.toISOString().split('T')[0];
    setStartDate(toISO(start));
    setEndDate(toISO(end));
  };

  const handlePresetSelect = (preset) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    switch (preset) {
      case 'today':
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case 'last7':
        start.setDate(today.getDate() - 6);
        break;
      case 'last30':
        start.setDate(today.getDate() - 29);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      case 'lastYear':
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }
    
    const toISO = (d) => d.toISOString().split('T')[0];
    setStartDate(toISO(start));
    setEndDate(toISO(end));
    setSelectedPreset(preset);
    
    if (preset !== 'custom') {
      setShowDateDropdown(false);
    }
  };

  // Filter list
  const filteredList = sortedList.filter(row => {
    const q = searchVal.toLowerCase();
    return row.product.toLowerCase().includes(q) || row.group.toLowerCase().includes(q);
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = filteredList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      {/* Row 1: Title & Date Range Picker & Download Excel matching Olsera screenshot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Pergerakan Stok</h2>
          <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'block' }}>{filteredList.length} Item</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Date range picker with arrows */}
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', height: '34px', position: 'relative' }}>
            <button 
              type="button"
              onClick={() => handleShiftDate(-1)}
              style={{ border: 0, borderRight: '1px solid #cbd5e1', background: 'transparent', width: '28px', height: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px', fontWeight: 'bold', borderTopLeftRadius: '6px', borderBottomLeftRadius: '6px' }}
            >
              &lt;
            </button>
            <div 
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', fontSize: '13px', color: '#334155', fontWeight: '500', height: '100%', cursor: 'pointer', userSelect: 'none' }}
            >
              <Calendar size={14} style={{ color: '#94a3b8' }} />
              <span>{getFormattedRange()}</span>
              <ChevronDown size={12} style={{ color: '#64748b' }} />
            </div>
            <button 
              type="button"
              onClick={() => handleShiftDate(1)}
              style={{ border: 0, borderLeft: '1px solid #cbd5e1', background: 'transparent', width: '28px', height: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px', fontWeight: 'bold', borderTopRightRadius: '6px', borderBottomRightRadius: '6px' }}
            >
              &gt;
            </button>

            {showDateDropdown && (
              <div style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                padding: '8px 0',
                zIndex: 1000,
                width: '200px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'last7', label: 'Last 7 Days' },
                  { id: 'last30', label: 'Last 30 Days' },
                  { id: 'thisMonth', label: 'This Month' },
                  { id: 'lastMonth', label: 'Last Month' },
                  { id: 'thisYear', label: 'This Year' },
                  { id: 'lastYear', label: 'Last Year' },
                  { id: 'custom', label: 'Custom Range' }
                ].map((item) => {
                  const isSelected = selectedPreset === item.id;
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.id === 'custom') {
                            setSelectedPreset('custom');
                          } else {
                            handlePresetSelect(item.id);
                          }
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border: 0,
                          background: isSelected ? '#16a34a' : 'transparent',
                          color: isSelected ? '#ffffff' : '#334155',
                          padding: '8px 16px',
                          fontSize: '13px',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          cursor: 'pointer',
                          transition: 'background 0.2s, color 0.2s',
                          display: 'block'
                        }}
                        onMouseOver={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = '#f1f5f9';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {item.label}
                      </button>
                      
                      {item.id === 'custom' && selectedPreset === 'custom' && (
                        <div style={{
                          padding: '12px 16px',
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          background: '#f8fafc'
                        }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>Mulai Dari</label>
                            <input 
                              type="date" 
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 6px', fontSize: '12px', outline: 'none' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>Sampai Dengan</label>
                            <input 
                              type="date" 
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 6px', fontSize: '12px', outline: 'none' }}
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => setShowDateDropdown(false)}
                            style={{ background: '#16a34a', color: '#ffffff', border: 0, borderRadius: '4px', padding: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s', marginTop: '4px', width: '100%' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
                          >
                            Terapkan
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button 
            type="button"
            onClick={handleDownloadExcel}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: '#16a34a', // green matching screenshot
              border: 0, 
              padding: '0 16px', 
              borderRadius: '6px', 
              fontSize: '13px', 
              fontWeight: 'bold', 
              color: '#ffffff', 
              cursor: 'pointer',
              height: '34px',
              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.15)'
            }}
          >
            <Download size={14} />
            <span>Download Excel</span>
          </button>
        </div>
      </div>

      {/* Row 2: Rows select and Autocomplete Filter matching Olsera screenshot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div>
          <select 
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', outline: 'none', background: '#ffffff', height: '34px', minWidth: '110px' }}
          >
            <option value={10}>10 Baris</option>
            <option value={25}>25 Baris</option>
            <option value={50}>50 Baris</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input 
            type="text"
            placeholder="Masukkan nama produk (autocomplete)"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            style={{ 
              width: '260px', 
              border: '1px solid #cbd5e1', 
              borderRadius: '6px', 
              padding: '7px 12px', 
              fontSize: '13px', 
              outline: 'none', 
              boxSizing: 'border-box',
              height: '34px'
            }}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>General</span>
            <div 
              onClick={() => setIsAutocomplete(!isAutocomplete)}
              style={{ 
                width: '36px', 
                height: '20px', 
                borderRadius: '10px', 
                background: isAutocomplete ? '#0085cd' : '#cbd5e1', // blue matching screenshot
                position: 'relative', 
                cursor: 'pointer', 
                transition: 'background 0.2s' 
              }}
            >
              <div style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '50%', 
                background: '#ffffff', 
                position: 'absolute', 
                top: '2px', 
                left: isAutocomplete ? '18px' : '2px', 
                transition: 'left 0.2s' 
              }}></div>
            </div>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Autocomplete</span>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="pi-table-card" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <table className="pi-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th onClick={() => handleSort('group')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Grup</span>
                  <ChevronsUpDown size={14} style={{ color: sortKey === 'group' ? '#0085ca' : '#94a3b8' }} />
                </div>
              </th>
              <th onClick={() => handleSort('product')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Produk</span>
                  <ChevronsUpDown size={14} style={{ color: sortKey === 'product' ? '#0085ca' : '#94a3b8' }} />
                </div>
              </th>
              <th onClick={() => handleSort('initial')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Awal</span>
                  <ChevronsUpDown size={14} style={{ color: sortKey === 'initial' ? '#0085ca' : '#94a3b8' }} />
                </div>
              </th>
              <th onClick={() => handleSort('in')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Masuk</span>
                  <ChevronsUpDown size={14} style={{ color: sortKey === 'in' ? '#0085ca' : '#94a3b8' }} />
                </div>
              </th>
              <th onClick={() => handleSort('returnStock')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Pengembalian</span>
                  <ChevronsUpDown size={14} style={{ color: sortKey === 'returnStock' ? '#0085ca' : '#94a3b8' }} />
                </div>
              </th>
              <th onClick={() => handleSort('sales')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Penjualan</span>
                  <ChevronsUpDown size={14} style={{ color: sortKey === 'sales' ? '#0085ca' : '#94a3b8' }} />
                </div>
              </th>
              <th onClick={() => handleSort('out')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Keluar</span>
                  <ChevronsUpDown size={14} style={{ color: sortKey === 'out' ? '#0085ca' : '#94a3b8' }} />
                </div>
              </th>
              <th onClick={() => handleSort('sisa')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Sisa</span>
                  <ChevronsUpDown size={14} style={{ color: sortKey === 'sisa' ? '#0085ca' : '#94a3b8' }} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>Memuat data...</span>
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#dc2626', fontWeight: 'bold' }}>{fetchError}</span>
                </td>
              </tr>
            ) : paginatedList.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#64748b', marginTop: '16px', fontWeight: 'bold' }}>No Data</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedList.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569', fontWeight: '500' }}>{row.group}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#1e293b', fontWeight: 'bold' }}>{row.product}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#334155', textAlign: 'left' }}>{row.initial}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#16a34a', fontWeight: '500' }}>{row.in > 0 ? `+${row.in}` : 0}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#334155' }}>{row.returnStock}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#dc2626', fontWeight: '500' }}>{row.sales > 0 ? `-${row.sales}` : 0}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#dc2626', fontWeight: '500' }}>{row.out > 0 ? `-${row.out}` : 0}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#0f172a', fontWeight: 'bold' }}>{row.sisa}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer matching bottom left of Olsera screenshot */}
      {filteredList.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-start', 
          alignItems: 'center', 
          gap: '16px', 
          marginTop: '16px', 
          fontSize: '13px', 
          color: '#64748b',
          padding: '8px 4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1} 
              style={{ 
                border: 0, 
                background: 'none', 
                color: currentPage === 1 ? '#cbd5e1' : '#64748b', 
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                padding: '4px 8px',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                style={{
                  border: 0,
                  background: 'none',
                  color: currentPage === page ? '#0085ca' : '#64748b',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: currentPage === page ? '#e4f8ff' : 'transparent'
                }}
              >
                {page}
              </button>
            ))}
            <button 
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages} 
              style={{ 
                border: 0, 
                background: 'none', 
                color: currentPage === totalPages ? '#cbd5e1' : '#64748b', 
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                padding: '4px 8px',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              &gt;
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Go to</span>
            <input 
              type="number" 
              min={1}
              max={totalPages}
              value={currentPage} 
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1 && val <= totalPages) {
                  setCurrentPage(val);
                }
              }}
              style={{ 
                width: '45px', 
                height: '28px', 
                border: '1px solid #cbd5e1', 
                borderRadius: '6px', 
                textAlign: 'center', 
                outline: 'none',
                fontSize: '13px'
              }} 
            />
          </div>
        </div>
      )}
    </>
  );
}
