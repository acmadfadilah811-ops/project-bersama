import { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import PerubahanModalReport from '../components/PerubahanModalReport';
import PerubahanModalToolbar from '../components/PerubahanModalToolbar';

export default function PerubahanModal() {
  const [dateMode, setDateMode] = useState('Bulan');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pickerDecade, setPickerDecade] = useState(2020);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    const closeCalendar = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) setIsCalendarOpen(false);
    };
    document.addEventListener('mousedown', closeCalendar);
    return () => document.removeEventListener('mousedown', closeCalendar);
  }, []);

  const getPeriodRange = useCallback(() => {
    if (dateMode === 'Tahun') {
      return {
        from: currentDate.startOf('year').format('YYYY-MM-DD'),
        to: currentDate.endOf('year').format('YYYY-MM-DD'),
      };
    }
    return {
      from: currentDate.startOf('month').format('YYYY-MM-DD'),
      to: currentDate.endOf('month').format('YYYY-MM-DD'),
    };
  }, [currentDate, dateMode]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getPeriodRange();
      const response = await apiClient.get('/accounting/reports/changes-in-equity/', {
        params: { date_from: from, date_to: to },
      });
      setReportData(response.data);
    } catch (error) {
      setReportData(null);
      notifyApiError(error, 'Gagal memuat laporan Perubahan Modal');
    } finally {
      setLoading(false);
    }
  }, [getPeriodRange]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const formatRupiah = (value) => Number(value || 0).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-3 font-sans text-slate-800">
      <PerubahanModalToolbar
        dateMode={dateMode}
        setDateMode={setDateMode}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        isCalendarOpen={isCalendarOpen}
        setIsCalendarOpen={setIsCalendarOpen}
        pickerDecade={pickerDecade}
        setPickerDecade={setPickerDecade}
        calendarRef={calendarRef}
        onPrevDate={() => setCurrentDate((value) => value.subtract(1, dateMode === 'Bulan' ? 'month' : 'year'))}
        onNextDate={() => setCurrentDate((value) => value.add(1, dateMode === 'Bulan' ? 'month' : 'year'))}
        onExportPdf={() => window.print()}
      />
      <PerubahanModalReport loading={loading} reportData={reportData} formatRupiah={formatRupiah} />
    </div>
  );
}
