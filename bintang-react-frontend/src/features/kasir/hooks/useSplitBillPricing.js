import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../../api/apiClient';

const toNumber = (value) => Number(value) || 0;

export default function useSplitBillPricing({
  billItems,
  discountPercent,
  taxPercent,
  selectedContact,
  selectedCoupon,
  metodeDiskon,
  selectedRedemption,
}) {
  const [autoDiscount, setAutoDiscount] = useState(0);
  const [isCheckingAutoDiscount, setIsCheckingAutoDiscount] = useState(false);

  const getUnitPrice = (item) => toNumber(item.splitUnitPrice ?? item.harga);
  const getSubtotal = (items) => Math.round(
    items.reduce((sum, item) => sum + getUnitPrice(item) * toNumber(item.qty), 0),
  );
  const getDiscountAmount = (items) => Math.round(
    (getSubtotal(items) * toNumber(discountPercent)) / 100,
  );
  const getCouponDiscount = (items) => {
    if (metodeDiskon !== 'kupon' || !selectedCoupon) return 0;
    const subtotal = getSubtotal(items);
    if (toNumber(selectedCoupon.min_total_pesanan) > subtotal) return 0;
    if (selectedCoupon.tipe_diskon === 'percent') {
      const maximum = toNumber(selectedCoupon.maksimal_jumlah_diskon);
      const amount = Math.round((subtotal * toNumber(selectedCoupon.jumlah_diskon)) / 100);
      return Math.min(amount, maximum > 0 ? maximum : amount, subtotal);
    }
    return Math.min(subtotal, toNumber(selectedCoupon.jumlah_diskon));
  };
  const getLoyaltyDiscount = (items) => {
    if (!selectedRedemption) return 0;
    const subtotal = getSubtotal(items);
    if (selectedRedemption.tipe_diskon === '%') {
      const maximum = toNumber(selectedRedemption.maksimal_jumlah_diskon);
      const amount = Math.round((subtotal * toNumber(selectedRedemption.jumlah_diskon)) / 100);
      return Math.min(amount, maximum > 0 ? maximum : amount, subtotal);
    }
    return Math.min(subtotal, toNumber(selectedRedemption.jumlah_diskon));
  };
  const getPromotionDiscount = (items) => (
    metodeDiskon === 'otomatis' ? autoDiscount : getCouponDiscount(items)
  );
  const getTaxAmount = (items) => {
    const taxable = getSubtotal(items)
      - getDiscountAmount(items)
      - getPromotionDiscount(items)
      - getLoyaltyDiscount(items);
    return Math.round((Math.max(0, taxable) * toNumber(taxPercent)) / 100);
  };
  const getTotal = (items) => Math.round(Math.max(0,
    getSubtotal(items)
      - getDiscountAmount(items)
      - getPromotionDiscount(items)
      - getLoyaltyDiscount(items)
      + getTaxAmount(items),
  ));

  const previewItems = useMemo(() => billItems.map((item) => ({
    product_id: item.isCustomPriced ? null : item.product?.id || null,
    harga: getUnitPrice(item),
    qty: item.qty,
  })), [billItems]);
  const subtotal = getSubtotal(billItems);

  useEffect(() => {
    if (metodeDiskon !== 'otomatis' || billItems.length === 0) {
      setAutoDiscount(0);
      setIsCheckingAutoDiscount(false);
      return undefined;
    }
    let cancelled = false;
    setIsCheckingAutoDiscount(true);
    const timer = setTimeout(async () => {
      try {
        const response = await apiClient.post('/sales-discounts/preview/', {
          subtotal,
          pelanggan: selectedContact?.nomor_wa || null,
          items: previewItems,
        });
        if (!cancelled) setAutoDiscount(toNumber(response.data?.diskon));
      } catch {
        if (!cancelled) setAutoDiscount(0);
      } finally {
        if (!cancelled) setIsCheckingAutoDiscount(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [billItems.length, metodeDiskon, previewItems, selectedContact?.nomor_wa, subtotal]);

  return {
    getUnitPrice,
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotal,
    isCheckingAutoDiscount,
  };
}
