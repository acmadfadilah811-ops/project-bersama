import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import ArusKasDetail from '../components/ArusKasDetail';
import ArusKasReport from '../components/ArusKasReport';

export default function ArusKas() {
  const [dateMode, setDateMode] = useState('Bulan');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [viewingCategory, setViewingCategory] = useState(null);

  const getPeriodRange = useCallback(() => {
    if (dateMode === 'Sesuaikan') return { from: startDate, to: endDate };
    if (dateMode === 'Tahun') {
      return { from: currentDate.startOf('year').format('YYYY-MM-DD'), to: currentDate.endOf('year').format('YYYY-MM-DD') };
    }
    return { from: currentDate.startOf('month').format('YYYY-MM-DD'), to: currentDate.endOf('month').format('YYYY-MM-DD') };
  }, [currentDate, dateMode, endDate, startDate]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getPeriodRange();
      const response = await apiClient.get('/accounting/reports/cash-flow/', { params: { date_from: from, date_to: to } });
      setReportData(response.data);
    } catch (error) {
      setReportData(null);
      notifyApiError(error, 'Gagal memuat laporan Arus Kas');
    } finally {
      setLoading(false);
    }
  }, [getPeriodRange]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const setMode = (mode) => {
    setDateMode(mode);
    if (mode === 'Bulan') {
      setStartDate(currentDate.startOf('month').format('YYYY-MM-DD'));
      setEndDate(currentDate.endOf('month').format('YYYY-MM-DD'));
    } else if (mode === 'Tahun') {
      setStartDate(currentDate.startOf('year').format('YYYY-MM-DD'));
      setEndDate(currentDate.endOf('year').format('YYYY-MM-DD'));
    }
  };
  const formatRupiah = (value) => Number(value || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const label = dateMode === 'Bulan' ? currentDate.format('MMMM YYYY') : dateMode === 'Tahun' ? currentDate.format('YYYY') : `${dayjs(startDate).format('DD MMM YYYY')} - ${dayjs(endDate).format('DD MMM YYYY')}`;

  if (viewingCategory) {
    const { from, to } = getPeriodRange();
    return <ArusKasDetail category={viewingCategory} dateFrom={from} dateTo={to} onBack={() => setViewingCategory(null)} />;
  }

  return (
    <div className="space-y-3 font-sans text-slate-800">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            {dateMode !== 'Sesuaikan' && <button type="button" onClick={() => setCurrentDate((value) => value.subtract(1, dateMode === 'Bulan' ? 'month' : 'year'))} className="p-1 rounded-md hover:bg-white text-slate-500"><ChevronLeft size={14} /></button>}
            <span className="flex items-center gap-2 px-3 text-xs font-bold text-slate-800 min-w-[150px] justify-center"><CalendarDays size={13} className="text-slate-400" />{label}</span>
            {dateMode !== 'Sesuaikan' && <button type="button" onClick={() => setCurrentDate((value) => value.add(1, dateMode === 'Bulan' ? 'month' : 'year'))} className="p-1 rounded-md hover:bg-white text-slate-500"><ChevronRight size={14} /></button>}
          </div>
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white text-xs font-bold shadow-2xs">
            {['Sesuaikan', 'Bulan', 'Tahun'].map((mode) => <button key={mode} type="button" onClick={() => setMode(mode)} className={`px-3.5 py-1.5 border-r last:border-r-0 border-slate-300 ${dateMode === mode ? 'bg-[#3B82F6] text-white' : 'hover:bg-slate-50 text-slate-700'}`}>{mode}</button>)}
          </div>
          {dateMode === 'Sesuaikan' && <div className="flex items-center gap-2 text-xs"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5" /><span>s/d</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5" /></div>}
        </div>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs"><FileText size={13} /><span>PDF</span></button>
      </div>
      <ArusKasReport loading={loading} reportData={reportData} formatRupiah={formatRupiah} onViewCategory={setViewingCategory} />
    </div>
  );
}
