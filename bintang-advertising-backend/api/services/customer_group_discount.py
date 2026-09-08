"""Resolusi Diskon Khusus Tipe Pelanggan (CustomerGroup.hitung_diskon) --
satu-satunya jalur dipakai bareng oleh checkout POS (api/pos_services.py)
dan Order (api/models.py Order.save()/update_totals()), supaya kriteria
"pelanggan mana dapat diskon berapa" konsisten di semua kanal transaksi
(bug ditemukan audit 2026-09-08: field ini sebelumnya tidak pernah dipakai
sama sekali)."""


def resolve_customer_group_by_nomor_wa(nomor_wa):
    """CustomerGroup aktif milik pelanggan dari nomor WA-nya (via Contact ->
    Customer), atau None kalau tidak tertaut/tidak ada grup. Dipakai Order
    (WA/Antrean Online & Offline/staff-assisted), yang cuma menyimpan
    nomor_wa, bukan FK Contact langsung."""
    if not nomor_wa:
        return None
    from ..models import Contact

    contact = Contact.objects.filter(nomor_wa=nomor_wa).select_related('customer__customer_group').first()
    if not contact or not contact.customer_id:
        return None
    group = contact.customer.customer_group
    if not group or not group.is_active:
        return None
    return group


def resolve_customer_group_by_contact(contact):
    """CustomerGroup aktif milik `contact` (instance Contact, bisa None),
    lewat Customer yang tertaut. Dipakai POS yang sudah punya instance
    Contact di tangan (tidak perlu query nomor_wa lagi)."""
    if not contact or not contact.customer_id:
        return None
    group = contact.customer.customer_group
    if not group or not group.is_active:
        return None
    return group
