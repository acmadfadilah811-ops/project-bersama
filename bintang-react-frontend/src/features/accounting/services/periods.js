import apiClient from '../../../api/apiClient';

export async function fetchAccountingPeriods(fiscalYear) {
  const { data } = await apiClient.get('/accounting/periods/', {
    params: { fiscal_year: fiscalYear },
  });
  return Array.isArray(data) ? data : (data.results || []);
}

export async function fetchAccountingPeriodDetail(periodId) {
  const { data } = await apiClient.get(`/accounting/periods/${periodId}/detail/`, {
    params: { page: 1, page_size: 1000 },
  });
  return Array.isArray(data) ? data : (data.results || []);
}

export async function closeAccountingPeriod(startDate, endDate) {
  const { data } = await apiClient.post('/accounting/close-period/', {
    start_date: startDate,
    end_date: endDate,
    confirm: true,
  });
  return data;
}

export async function closeAllAccountingPeriods(fiscalYear) {
  const { data } = await apiClient.post('/accounting/periods/close-all/', {
    confirm: true,
    fiscal_year: fiscalYear,
  });
  return data;
}
