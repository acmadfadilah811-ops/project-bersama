export const POS_ACCOUNT_FIELDS = [
  { key: 'pos_sales_revenue_account', label: 'Pendapatan Penjualan POS', required: true },
  { key: 'pos_cogs_expense_account', label: 'Harga Pokok Penjualan (HPP)', required: true },
  { key: 'pos_inventory_account', label: 'Persediaan', required: true },
  { key: 'pos_marketplace_admin_fee_account', label: 'Admin Fee Market Place' },
  { key: 'pos_deposit_income_difference_account', label: 'Pendapatan dari selisih deposit' },
  { key: 'pos_deposit_expense_difference_account', label: 'Pengeluaran dari selisih deposit' },
  { key: 'pos_purchase_tax_account', label: 'Pajak Pembelian' },
  { key: 'pos_sales_total_minus_account', label: 'Total penjualan minus' },
  { key: 'pos_ppn_output_account', label: 'Pajak Penjualan' },
  { key: 'pos_sales_delivery_account', label: 'Pengiriman Penjualan' },
  { key: 'pos_sales_rounding_account', label: 'Pembulatan penjualan' },
  { key: 'pos_sales_unique_payment_account', label: 'Pembayaran unik penjualan' },
];

export const POS_DEFAULT_ACCOUNT_CODES = {
  pos_sales_revenue_account: '40000',
  pos_cogs_expense_account: '51000',
  pos_inventory_account: '11400',
  pos_marketplace_admin_fee_account: '42000',
  pos_deposit_income_difference_account: '70001',
  pos_deposit_expense_difference_account: '80000',
  pos_purchase_tax_account: '11750',
  pos_sales_total_minus_account: '11750',
  pos_ppn_output_account: '23500',
  pos_sales_delivery_account: '44000',
  pos_sales_rounding_account: '70001',
  pos_sales_unique_payment_account: '70002',
};
