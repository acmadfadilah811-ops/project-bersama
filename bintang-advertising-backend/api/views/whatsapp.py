import logging
import os
import uuid
import re as _re
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from django.utils.crypto import constant_time_compare
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache

from ..models import (
    Contact, Order, OrderItem, JobBoard, TahapProses, SystemConfig, CustomUser
)
from ..permissions import (
    IsOwnerOrManager, IsOwnerManagerAdminOrKasir
)
from ..whatsapp_client import whatsapp_client

logger = logging.getLogger(__name__)


def update_desain_dari_form_data(detail):
    """
    Parse teks FORM KONSEP DESAIN -> update ke DB pada OrderItem yang cocok.
    Kembalikan (order_id, success_boolean, error_message).
    """
    def ambil_field(teks, *keys):
        keys_all = [
            'ID Pesanan', 'ID Order',
            'Tulisan yang dimuat', 'Tulisan',
            'Dominan Warna', 'Warna',
            'Logo / Foto (Ada/Tidak)', 'Logo / Foto', 'Logo',
            'Bentuk (Vertikal / Horizontal)', 'Bentuk',
            'Request Tambahan', 'Keterangan',
            'desain sudah sesuai', 'data sudah sesuai',
            'File Desain'
        ]
        escaped_keys = []
        for k in keys_all:
            pat = _re.escape(k).replace('\\ ', ' ').replace(' ', '[ \t\xa0]+')
            escaped_keys.append(pat)
        
        # Add footers manually
        escaped_keys.append(r'===?\s*AKHIR\s*TEMPLATE\s*===?')
        escaped_keys.append(r'⚠️\s*\*?PENTING:\*?')
        
        lookahead_keys_pat = "|".join(escaped_keys)

        for key in keys:
            key_pat = _re.escape(key).replace('\\ ', ' ').replace(' ', '[ \t\xa0]+')
            # Lookahead check for next field header or footer keywords
            pattern = rf'(?:[-*••]|\d+\.)?[ \t\xa0]*{key_pat}[ \t\xa0]*[:=][ \t\xa0]*(.*?)(?=\r?\n[ \t\xa0]*(?:[-*••]|\d+\.)?[ \t\xa0]*(?:{lookahead_keys_pat})[ \t\xa0]*[:=]|\r?\n[ \t\xa0]*(?:{lookahead_keys_pat})|$)'
            match = _re.search(pattern, teks, _re.IGNORECASE | _re.DOTALL)
            if match:
                val = match.group(1).strip().strip('*_')
                if val and val not in ('-', 'sudah ada / belum ada', '*sudah ada* / *belum ada*'):
                    return val
        return ''

    order_id = ambil_field(detail, 'ID Pesanan', 'ID Order').upper()
    if not order_id:
        # Fallback search menggunakan regex untuk ORD-...
        match = _re.search(r'(ord-[\w-]+)', detail, _re.IGNORECASE)
        if match:
            order_id = match.group(1).upper()

    if not order_id:
        return None, False, "ID Pesanan tidak ditemukan dalam form konsep desain Kakak."

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return order_id, False, f"Pesanan dengan ID *{order_id}* tidak ditemukan di sistem kami."

    # Ekstrak field konsep desain
    tulisan = ambil_field(detail, 'Tulisan yang dimuat', 'Tulisan')
    warna = ambil_field(detail, 'Dominan Warna', 'Warna')
    logo = ambil_field(detail, 'Logo / Foto (Ada/Tidak)', 'Logo / Foto', 'Logo')
    bentuk = ambil_field(detail, 'Bentuk (Vertikal / Horizontal)', 'Bentuk')
    req_tambahan = ambil_field(detail, 'Request Tambahan', 'Keterangan')

    # Update OrderItem milik order ini
    item = order.items.first()
    if not item:
        return order_id, False, f"Pesanan *{order_id}* tidak memiliki item produk."

    with transaction.atomic():
        # Bentuk detail_desain dalam JSON
        detail_json = []
        if isinstance(item.detail, list):
            detail_json = item.detail
        elif isinstance(item.detail, str) and item.detail:
            detail_json = [{"key": "Spesifikasi", "value": item.detail}]

        # Ganti info konsep desain lama jika ada
        detail_json = [d for d in detail_json if d.get('key') != 'Konsep Desain']
        detail_json.append({
            "key": "Konsep Desain",
            "value": {
                "tulisan": tulisan,
                "warna_dominan": warna,
                "logo_foto": logo,
                "bentuk": bentuk,
                "request_tambahan": req_tambahan
            }
        })
        item.detail = detail_json
        
        # Update keterangan_detail
        keterangan_gabung = (
            f"Konsep Desain:\n"
            f"- Tulisan yang dimuat: {tulisan}\n"
            f"- Dominan Warna: {warna}\n"
            f"- Logo / Foto (Ada/Tidak): {logo}\n"
            f"- Bentuk (Vertikal / Horizontal): {bentuk}\n"
            f"- Request Tambahan: {req_tambahan}"
        )
        item.keterangan_detail = keterangan_gabung
        item.save()

        # Pindahkan job board to tahap desain jika ada
        jobs = JobBoard.objects.filter(order_item=item)
        for job in jobs:
            if job.tahap and 'desain' in job.tahap.nama.lower():
                # Jika status pekerjaan tertahan di antrean, aktifkan kembali
                job.status_pekerjaan = 'antrean'
                job.save()

    return order_id, True, ""



class BaseWhatsAppWebhookView(APIView):
    """
    Base class untuk menangani pemrosesan pesan masuk WhatsApp, parsing order/desain,
    pemeriksaan absensi staff, tracking pesanan, FAQ, dan AI Assistant auto-reply.
    """
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def _kirim_balas_async(self, number, text):
        """
        Kirim balasan dengan simulasi mengetik secara asinkron di thread terpisah.
        Tracks task status in Django cache.
        """
        import threading
        import time
        import uuid
        from django.core.cache import cache

        task_id = f"async_task_{uuid.uuid4().hex}"
        cache.set(task_id, {"status": "pending", "number": number, "text": text[:50], "timestamp": time.time()}, timeout=3600)

        def worker():
            cache.set(task_id, {"status": "running", "number": number, "text": text[:50], "timestamp": time.time()}, timeout=3600)
            
            # Hitung delay berdasarkan panjang karakter (misal 30 karakter per detik)
            char_delay = len(text) / 30.0
            total_delay = min(max(2.0, char_delay), 15.0)

            # Tampilkan status sedang mengetik
            try:
                whatsapp_client.send_presence(number, "composing")
            except Exception as e:
                logger.warning(f"Failed to send presence composing: {e}")
                
            time.sleep(total_delay)
            
            # Kirim pesan dan matikan presence dengan retry
            success = False
            error_msg = ""
            for attempt in range(3):
                try:
                    res = whatsapp_client.send_text_message(number, text)
                    if res:
                        success = True
                        break
                    else:
                        error_msg = "WhatsApp client returned empty response"
                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Attempt {attempt+1} failed to send WA message: {e}")
                time.sleep(2)
            
            try:
                whatsapp_client.send_presence(number, "paused")
            except Exception as e:
                logger.warning(f"Failed to send presence paused: {e}")

            if success:
                cache.set(task_id, {"status": "success", "number": number, "timestamp": time.time()}, timeout=3600)
            else:
                logger.critical(f"[WA_SEND_FAILURE] Failed to send message to {number} after 3 attempts. Error: {error_msg}. Text: {text}")
                cache.set(task_id, {"status": "failed", "number": number, "error": error_msg, "timestamp": time.time()}, timeout=86400)

        threading.Thread(target=worker, daemon=True).start()
        return task_id

    def _kirim_tombol_atau_teks(self, number, text, tombol_list, fallback_opsi_teks=None):
        """
        Kirim `text` sebagai pesan WhatsApp ke pelanggan.

        DULU fungsi ini coba kirim Quick Reply Buttons (native flow) lewat
        Evolution API dulu, baru fallback ke teks kalau gagal — tapi
        "gagal" cuma dideteksi dari HTTP status Evolution (200/201), bukan
        dari status pengiriman WhatsApp yang sebenarnya. Ditemukan nyata di
        log produksi 2026-08-12: Evolution balas 200 dengan `status:
        PENDING` yang dibungkus `viewOnceMessage`/`nativeFlowMessage` (hack
        Baileys utk tombol interaktif) — pesannya TIDAK PERNAH sampai ke HP
        pelanggan (Ahmad, 628313... tanya katalog 2x, tidak ada balasan sama
        sekali), padahal kode menganggap sukses dan skip fallback teks.
        Karena tidak ada cara reliabel memverifikasi delivery tombol lewat
        Evolution di sini, sekarang SELALU kirim sebagai teks polos —
        `fallback_opsi_teks` (opsi ketik manual) sudah selalu disiapkan tiap
        caller untuk kasus ini, jadi tidak kehilangan opsi bagi pelanggan.
        """
        import threading
        import time

        def worker():
            try:
                whatsapp_client.send_presence(number, "composing")
            except Exception as e:
                logger.warning(f"Failed to send presence composing (tombol): {e}")

            time.sleep(min(max(2.0, len(text) / 30.0), 15.0))

            full_text = text + "\n\n" + (fallback_opsi_teks or "")
            for attempt in range(3):
                try:
                    if whatsapp_client.send_text_message(number, full_text):
                        break
                except Exception as e:
                    logger.error(f"Kirim teks (pengganti tombol) gagal (percobaan {attempt+1}): {e}")
                time.sleep(2)
            else:
                logger.critical(f"[WA_SEND_FAILURE] Gagal kirim pesan ke {number} setelah 3 percobaan.")

            try:
                whatsapp_client.send_presence(number, "paused")
            except Exception as e:
                logger.warning(f"Failed to send presence paused (tombol): {e}")

        threading.Thread(target=worker, daemon=True).start()

    def _parse_form_order(self, nomor, nama_kontak, detail):
        """Parse teks form WA jadi struktur data — TANPA simpan ke DB.
        Beda dari _buat_order_dari_data di bawah: status_global 'draft'
        [bukan 'review'], gdrive_customer_link diambil dari link di pesan
        kalau ada, dan validasi 'Jumlah' lebih ketat [wajib angka >0])."""

        def ambil_field(teks, *keys, max_len=1000):
            keys_all = [
                'Nama Pemesan', 'Nama', 'No. WA', 'No WA',
                'Jenis Produk', 'Jumlah', 'Ukuran',
                'Bahan/Material', 'Bahan / Material', 'Bahan',
                'Finishing', 'File Desain', 'Keterangan',
                'data sudah sesuai', 'desain sudah sesuai',
                # Field FORM KONSEP DESAIN — muncul kalau form order & form
                # desain dikirim BARENGAN (status desain 'belum', order belum
                # dibuat jadi belum ada ID Pesanan utk dipisah via
                # update_desain_dari_form_data). Wajib ada di lookahead spy
                # field 'File Desain' tidak menelan seluruh teks di
                # bawahnya (bug ditemukan user 2026-08-15).
                'Tulisan yang dimuat', 'Tulisan',
                'Dominan Warna',
                'Logo / Foto (Ada/Tidak)', 'Logo / Foto',
                'Bentuk (Vertikal / Horizontal)',
                'Request Tambahan',
            ]
            escaped_keys = []
            for k in keys_all:
                pat = _re.escape(k).replace('\\ ', ' ').replace(' ', '[ \t\xa0]+')
                escaped_keys.append(pat)

            escaped_keys.append(r'===?\s*AKHIR\s*TEMPLATE\s*===?')
            escaped_keys.append(r'⚠️\s*\*?PENTING:\*?')
            lookahead_keys_pat = "|".join(escaped_keys)

            for key in keys:
                key_pat = _re.escape(key).replace('\\ ', ' ').replace(' ', '[ \t\xa0]+')
                pattern = rf'(?:[-*••]|\d+\.)?[ \t\xa0]*{key_pat}[ \t\xa0]*[:=][ \t\xa0]*(.*?)(?=\r?\n[ \t\xa0]*(?:[-*••]|\d+\.)?[ \t\xa0]*(?:{lookahead_keys_pat})[ \t\xa0]*[:=]|\r?\n[ \t\xa0]*(?:{lookahead_keys_pat})|$)'
                match = _re.search(pattern, teks, _re.IGNORECASE | _re.DOTALL)
                if match:
                    val = match.group(1).strip().strip('*_')
                    if val and val not in ('-', 'sudah ada / belum ada', '*sudah ada* / *belum ada*'):
                        val = _re.sub(r'<[^>]*>', '', val)
                        return val[:max_len].strip()
            return ''

        nama_dari_form = (
            ambil_field(detail, 'Nama Pemesan', 'Nama') or nama_kontak or '-'
        )

        blok_items = _re.split(r'(?im)^[ \t]*[-*•\[\*_]*\s*(?:📦\s*)?[\*_]*item\s+\d+[\*_\]:]*[ \t]*[\*_]*[^\r\n]*$', detail)
        blok_items = [b.strip() for b in blok_items if b.strip()]

        if len(blok_items) <= 1:
            blok_items = [detail]

        items = []
        is_desain_ready = False
        field_kurang_list = []
        for blok in blok_items:
            if not blok.strip():
                continue

            jenis_produk = ambil_field(blok, 'Jenis Produk', max_len=100) or 'Umum'
            jumlah_str   = ambil_field(blok, 'Jumlah', max_len=50)
            ukuran       = ambil_field(blok, 'Ukuran', max_len=100)
            bahan        = ambil_field(blok, 'Bahan/Material', 'Bahan / Material', 'Bahan', max_len=100)
            finishing    = ambil_field(blok, 'Finishing', max_len=250)
            file_desain  = ambil_field(blok, 'File Desain', max_len=250).lower()
            if file_desain and 'belum' not in file_desain:
                is_desain_ready = True
            keterangan   = ambil_field(blok, 'Keterangan', max_len=1000)

            # Field FORM KONSEP DESAIN yang dikirim BARENGAN form order (status
            # desain 'belum', lihat STEP 1d) — order belum ada jadi tidak bisa
            # lewat update_desain_dari_form_data (butuh ID Pesanan). Simpan ke
            # Keterangan supaya tidak hilang begitu saja (bug ditemukan user
            # 2026-08-15: sebelumnya malah gagal total dgn error "ID Pesanan
            # tidak ditemukan" krn form gabungan ini disangka desain-update).
            brief_desain = []
            _tulisan = ambil_field(blok, 'Tulisan yang dimuat', 'Tulisan', max_len=300)
            _warna = ambil_field(blok, 'Dominan Warna', max_len=100)
            _logo = ambil_field(blok, 'Logo / Foto (Ada/Tidak)', 'Logo / Foto', max_len=50)
            _bentuk = ambil_field(blok, 'Bentuk (Vertikal / Horizontal)', max_len=50)
            _request = ambil_field(blok, 'Request Tambahan', max_len=300)
            if _tulisan: brief_desain.append(f"Tulisan: {_tulisan}")
            if _warna: brief_desain.append(f"Warna: {_warna}")
            if _logo: brief_desain.append(f"Logo/Foto: {_logo}")
            if _bentuk: brief_desain.append(f"Bentuk: {_bentuk}")
            if _request: brief_desain.append(f"Request: {_request}")
            if brief_desain:
                teks_brief = "Konsep desain — " + "; ".join(brief_desain)
                keterangan = f"{keterangan}\n{teks_brief}".strip() if keterangan else teks_brief

            if jenis_produk == 'Umum' and not ukuran and not bahan:
                continue

            from ..wa_logic import cek_bahan_finishing_kurang
            kurang = cek_bahan_finishing_kurang(jenis_produk, bahan, finishing)
            if kurang:
                field_kurang_list.append((len(items) + 1, jenis_produk, kurang))

            if not jumlah_str or not jumlah_str.strip():
                raise ValueError(f"Kolom 'Jumlah' pada Item {len(items)+1} tidak boleh kosong.")

            match_qty = _re.search(r'\d+', jumlah_str)
            digits_only = match_qty.group(0) if match_qty else ''

            if not digits_only:
                raise ValueError(f"Jumlah '{jumlah_str}' pada Item {len(items)+1} tidak mengandung angka yang valid.")

            try:
                qty = int(digits_only)
                if qty <= 0:
                    raise ValueError(f"Jumlah '{qty}' pada Item {len(items)+1} harus lebih dari nol.")
            except ValueError:
                raise ValueError(f"Jumlah '{jumlah_str}' pada Item {len(items)+1} bukan angka yang valid.")

            # Parse panjang & lebar
            panjang = 0.0
            lebar = 0.0
            if ukuran:
                dimensi_match = _re.search(r'([\d.,]+)\s*[xX*]\s*([\d.,]+)', ukuran)
                if dimensi_match:
                    try:
                        panjang = float(dimensi_match.group(1).replace(',', '.'))
                        lebar = float(dimensi_match.group(2).replace(',', '.'))
                    except ValueError:
                        pass

            detail_json = []
            if ukuran: detail_json.append({"key": "Ukuran", "value": ukuran})
            if finishing: detail_json.append({"key": "Finishing", "value": finishing})
            if bahan: detail_json.append({"key": "Bahan", "value": bahan})

            gdrive_link = ''
            link_match = _re.search(r'(https?://\S+)', blok)
            if link_match:
                gdrive_link = link_match.group(1)

            items.append({
                'jenis_produk': jenis_produk,
                'qty': qty,
                'panjang': panjang,
                'lebar': lebar,
                'bahan': bahan,
                'finishing': finishing,
                'keterangan': keterangan,
                'detail_json': detail_json,
                'gdrive_link': gdrive_link,
                'file_desain_belum': bool(file_desain and 'belum' in file_desain),
            })

        if field_kurang_list:
            from ..wa_logic import format_pesan_field_kurang
            raise ValueError(format_pesan_field_kurang(field_kurang_list))

        return {
            'nomor': nomor,
            'nama_kontak': nama_kontak,
            'nama_order': nama_dari_form,
            'raw_detail': detail,
            'items': items,
            'is_desain_ready': is_desain_ready,
        }

    def _buat_order_dari_data(self, parsed):
        """Simpan hasil _parse_form_order() ke DB — dipanggil setelah pelanggan
        konfirmasi 'sesuai' atas rekap. Logic sama persis dengan
        _simpan_order_dari_form() versi lama (status_global 'draft', gdrive
        link dari pesan, fallback 'Format tidak terurai')."""
        nomor = parsed['nomor']
        nama_kontak = parsed['nama_kontak']
        detail = parsed['raw_detail']

        with transaction.atomic():
            contact, _ = Contact.objects.get_or_create(
                nomor_wa=nomor, defaults={'nama': nama_kontak}
            )
            existing_orders = Order.objects.filter(nomor_wa=nomor)
            contact.total_order = existing_orders.count() + 1
            contact.total_spent = sum(
                item.harga_jual
                for o in existing_orders.prefetch_related('items')
                for item in o.items.all()
            )
            contact.last_order = timezone.localdate()
            contact.save()

            order_id = f"ORD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
            order = Order.objects.create(
                id=order_id,
                nomor_wa=contact.nomor_wa,
                nama=parsed['nama_order'],
                status_global='draft',
                sumber='wa',
                catatan_pelanggan=detail,  # Store the full raw form message
            )

            items_dibuat = 0
            for item_data in parsed['items']:
                order_item = OrderItem.objects.create(
                    order=order,
                    jenis_produk=item_data['jenis_produk'],
                    qty=item_data['qty'],
                    panjang=item_data['panjang'],
                    lebar=item_data['lebar'],
                    bahan=item_data['bahan'] or '',
                    harga_jual=0,
                    detail=item_data['detail_json'],
                    keterangan_detail=item_data['keterangan'] or '',
                    gdrive_customer_link=item_data['gdrive_link'],
                )

                # Tentukan tahap awal
                if item_data['file_desain_belum']:
                    tahap_awal = TahapProses.objects.filter(
                        nama__icontains='desain'
                    ).order_by('urutan').first()
                else:
                    tahap_awal = TahapProses.objects.order_by('urutan').first()

                if tahap_awal:
                    JobBoard.objects.create(
                        order_item=order_item,
                        tahap=tahap_awal,
                        status_pekerjaan='antrean'
                    )
                items_dibuat += 1

            if items_dibuat == 0:
                order_item = OrderItem.objects.create(
                    order=order,
                    jenis_produk='Umum',
                    qty=1,
                    harga_jual=0,
                    detail=[{"key": "Info", "value": "Format tidak terurai"}],
                    keterangan_detail=detail[:200],
                )
                tahap_awal = TahapProses.objects.order_by('urutan').first()
                if tahap_awal:
                    JobBoard.objects.create(
                        order_item=order_item,
                        tahap=tahap_awal,
                        status_pekerjaan='antrean'
                    )

        return order_id, parsed['is_desain_ready']

    def _bangun_balasan_rekap_order(self, parsed, panggilan):
        """Rekap form order yang sudah diparse — pelanggan cek dulu sebelum
        ketik 'sesuai' (gerbang sebelum Order benar-benar dibuat)."""
        baris = []
        for i, item in enumerate(parsed['items'], start=1):
            baris.append(f"*Item {i}: {item['jenis_produk']}*")
            baris.append(f"- Jumlah: {item['qty']}")
            if item['panjang'] and item['lebar']:
                baris.append(f"- Ukuran: {item['panjang']:.1f}x{item['lebar']:.1f}m")
            if item['bahan']:
                baris.append(f"- Bahan/Material: {item['bahan']}")
            if item['finishing']:
                baris.append(f"- Finishing: {item['finishing']}")
            baris.append(f"- File Desain: {'belum ada' if item['file_desain_belum'] else 'sudah ada'}")
            if item['keterangan']:
                baris.append(f"- Keterangan: {item['keterangan']}")
            baris.append("")
        return (
            f"Baik {panggilan}, ini rekap pesanan Kakak:\n\n"
            + "\n".join(baris).strip()
            + "\n\n✅ Kalau sudah benar, balas *sesuai* ya Kak supaya kami proses. "
            "Kalau ada yang mau dikoreksi, kirim ulang form-nya dengan data yang benar 🙏"
        )

    def _bangun_balasan_konfirmasi_order(self, order_id, panggilan, is_desain_ready):
        """Pesan konfirmasi setelah Order benar-benar dibuat (setelah pelanggan
        ketik 'sesuai')."""
        order_instance = Order.objects.prefetch_related('items').get(id=order_id)
        label = "Pesanan Anda telah masuk ke sistem kami"

        item_lines = []
        total_estimasi = 0
        for item in order_instance.items.all():
            spec_parts = []
            if item.panjang > 0 and item.lebar > 0:
                spec_parts.append(f"{item.panjang:.1f}x{item.lebar:.1f}m")
            if item.bahan:
                spec_parts.append(item.bahan)
            spec_str = f" ({', '.join(spec_parts)})" if spec_parts else ""

            price_val = item.harga_jual or 0
            price_display = f"Rp {price_val:,}" if price_val > 0 else "Hubungi Admin"
            price_display = price_display.replace(',', '.')
            item_lines.append(f"• *{item.jenis_produk}*{spec_str} - {item.qty}x")
            item_lines.append(f"  └─ Est. Harga: *{price_display}*")
            total_estimasi += price_val

        total_display = f"Rp {total_estimasi:,}" if total_estimasi > 0 else "Hubungi Admin"
        total_display = total_display.replace(',', '.')

        jawaban = (
            f"Terima kasih {panggilan}! {label} ✅\n\n"
            f"🎫 *ID PESANAN: {order_id}*\n"
            f"_Simpan ID ini untuk melacak status pesanan Kakak._\n\n"
            f"📝 *RINCIAN PESANAN:*\n"
            + "\n".join(item_lines) + "\n\n"
            f"💰 *TOTAL ESTIMASI: {total_display}*\n\n"
            f"Tim kami akan segera memverifikasi pesanan Kakak. Mohon ditunggu 🙏"
        )
        from django.db.models import Q
        has_no_design = order_instance.items.filter(Q(gdrive_customer_link__isnull=True) | Q(gdrive_customer_link='')).exists()
        if has_no_design:
            if is_desain_ready:
                jawaban += (
                    f"\n\nSilakan kirimkan file desain Kakak langsung ke chat ini (sebagai Gambar atau Dokumen) "
                    f"dengan mencantumkan keterangan/caption ID Pesanan: *{order_id}* pada file tersebut ya Kak! 😊"
                )
            else:
                jawaban += (
                    f"\n\nSilakan *copy-paste* dan isi **Form Konsep Desain** di bawah ini agar tim desainer kami bisa langsung memprosesnya:\n\n"
                    f"📋 *FORM KONSEP DESAIN*\n"
                    f"- ID Pesanan: {order_id}\n"
                    f"- Tulisan yang dimuat:\n"
                    f"- Dominan Warna:\n"
                    f"- Logo / Foto (Ada/Tidak):\n"
                    f"- Bentuk (Vertikal / Horizontal):\n"
                    f"- Request Tambahan:\n\n"
                    f"⚠️ *PENTING:* Setelah form diisi lengkap, tambahkan di baris paling bawah:\n"
                    f"*DESAIN SUDAH SESUAI*\n"
                    f"agar konsep desain otomatis masuk ke sistem kami. 👇"
                )
        return jawaban

    def _proses_pesan_masuk(self, sender_raw, message_text, media_url="", push_name=""):
        from ..wa_logic import (
            menunggu_nama, menunggu_pilihan_produk, menunggu_status_desain, pending_order_form,
            simpan_ke_memori, cek_tracking, cek_harga, cek_rules_awal,
            cek_database_faq, tanya_ai_finishing, ekstrak_nama_dari_pesan,
            proses_kirim_desain, MENU_TOMBOL, TOMBOL_MARKER,
            TOMBOL_PRODUK, TOMBOL_MARKER_2, get_form_order,
            cocok_status_desain, cocok_konfirmasi_sesuai,
            get_pricelist_kategori, ekstrak_produk_pilihan,
            _pesan_konfirmasi_tanpa_produk,
        )

        sender_number = str(sender_raw).split('@')[0].replace('+', '').replace(' ', '').replace('-', '')
        if not sender_number:
            return "", {'error': 'No sender number found'}, status.HTTP_400_BAD_REQUEST

        if not message_text:
            return "", {'status': 'ignored_empty_message'}, status.HTTP_200_OK

        # 1. Cek jika pengirim adalah staff yang sedang mengisi alasan absensi
        cleaned_sender = sender_number.lstrip('+').lstrip('0')
        if cleaned_sender.startswith('62'):
            cleaned_sender = cleaned_sender[2:]
            
        staff_user = None
        for u in CustomUser.objects.filter(is_active=True, role='staff'):
            if u.no_hp:
                u_wa = u.no_hp.replace('+', '').replace(' ', '').replace('-', '').lstrip('0')
                if u_wa.startswith('62'):
                    u_wa = u_wa[2:]
                if u_wa == cleaned_sender:
                    staff_user = u
                    break

        if staff_user:
            from hr.models import DailyAttendanceSession, UnlockRequest
            today = timezone.localdate()
            sesi = DailyAttendanceSession.objects.filter(tanggal=today).first()
            if sesi:
                unlock_req = UnlockRequest.objects.filter(staff=staff_user, sesi=sesi).order_by('-waktu_request').first()
                if unlock_req:
                    unlock_req.alasan = message_text
                    unlock_req.save()
                    
                    confirm_msg = (
                        f"Terima kasih {staff_user.get_full_name() or staff_user.username}.\n\n"
                        f"Alasan Anda:\n"
                        f"*\"{message_text}\"*\n\n"
                        f"Telah berhasil dicatat dan diteruskan ke Manager untuk ditinjau. "
                        f"Anda akan menerima notifikasi jika akses Anda disetujui."
                    )
                    self._kirim_balas_async(sender_number, confirm_msg)
                    
                    try:
                        manager_user = sesi.dihidupkan_oleh or CustomUser.objects.filter(role__in=['manager', 'owner'], is_active=True).first()
                        if manager_user and manager_user.no_hp:
                            mgr_wa = manager_user.no_hp.replace('+', '').replace(' ', '').replace('-', '')
                            mgr_msg = (
                                f"🚨 *PEMBERITAHUAN ABSENSI STAFF* 🚨\n\n"
                                f"Staff *{staff_user.get_full_name() or staff_user.username}* memberikan alasan absensi masuk hari ini:\n"
                                f"💬 *\"{message_text}\"*\n\n"
                                f"Silakan periksa halaman dashboard HR CRM untuk menyetujui (Approve) atau menolak (Reject) permintaan buka kunci."
                            )
                            self._kirim_balas_async(mgr_wa, mgr_msg)
                    except Exception as e:
                        logger.error(f"Gagal mengirim notifikasi alasan staff ke manager: {e}")
                        
                    return confirm_msg, {'status': 'staff_attendance_reason_captured'}, status.HTTP_200_OK

        # Ambil kontak
        contact_obj = Contact.objects.filter(nomor_wa=sender_number).first()
        nama_pelanggan = contact_obj.nama if contact_obj else ""
        p_kecil = message_text.lower()
        panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"

        # Cek status Human Handover
        if cache.get(f"wa_handover_{sender_number}") or (contact_obj and getattr(contact_obj, 'handover_to_staff', False)):
            logger.info(f"Chat dengan {sender_number} sedang dalam mode Human Handover. Bot diabaikan.")
            return "", {'status': 'handover_mode_active'}, status.HTTP_200_OK

        # Cek custom welcome / override response
        try:
            custom_response = SystemConfig.objects.get(key='custom_bot_response').value
            if custom_response and custom_response.strip():
                is_new_contact = (
                    not contact_obj or 
                    not contact_obj.nama or 
                    contact_obj.nama.strip() == "" or 
                    contact_obj.nama == "Pelanggan"
                )
                if is_new_contact:
                    greeted_cache_key = f"wa_greeted_{sender_number}"
                    if not cache.get(greeted_cache_key):
                        if not contact_obj:
                            contact_obj, _ = Contact.objects.get_or_create(
                                nomor_wa=sender_number,
                                defaults={'nama': push_name or "Pelanggan"}
                            )
                        elif not contact_obj.nama or contact_obj.nama == "Pelanggan":
                            if push_name:
                                contact_obj.nama = push_name
                                contact_obj.save()
                        
                        nama_pelanggan = contact_obj.nama
                        panggilan = f"Kak {nama_pelanggan}" if nama_pelanggan else "Kak"
                        cache.set(greeted_cache_key, True, timeout=86400)
                        self._kirim_balas_async(sender_number, custom_response.strip())
                        return custom_response.strip(), {'status': 'custom_welcome_sent'}, status.HTTP_200_OK
        except Exception as e:
            logger.warning(f"Gagal memproses custom_bot_response: {e}")

        jawaban = ""

        # Step 1: Tanya nama jika kontak baru
        if not nama_pelanggan and sender_number not in menunggu_nama:
            menunggu_nama.add(sender_number)
            try:
                biz_name = SystemConfig.objects.get(key='bisnis_nama').value or 'Brandy'
            except Exception as e:
                logger.warning(f"Gagal mengambil nama bisnis: {e}")
                biz_name = 'Brandy'
            jawaban = (
                f"Halo Kak! 👋 Selamat datang di *{biz_name}*.\n\n"
                "Saya adalah *Asisten Virtual* Bintang Advertising yang siap membantu Kakak secara otomatis 24/7. 🤖\n\n"
                "Sebelum kita mulai, boleh tahu dengan Kakak siapa ini biar lebih enak ngobrolnya? 😊"
            )
            self._kirim_balas_async(sender_number, jawaban)
            return jawaban, {'status': 'waiting_for_name_triggered'}, status.HTTP_200_OK

        elif sender_number in menunggu_nama:
            nama_baru = ekstrak_nama_dari_pesan(message_text)
            contact_obj, _ = Contact.objects.get_or_create(
                nomor_wa=sender_number, defaults={'nama': nama_baru}
            )
            if not contact_obj.nama:
                contact_obj.nama = nama_baru
                contact_obj.save()
            elif contact_obj.nama != nama_baru:
                contact_obj.nama = nama_baru
                contact_obj.save()
            menunggu_nama.discard(sender_number)
            nama_pelanggan = nama_baru
            panggilan = f"Kak {nama_pelanggan}"
            jawaban = (
                f"Salam kenal {panggilan}! ✨\n"
                f"Ada yang bisa kami bantu hari ini? Mau cetak apa nih Kak?"
            )
            self._kirim_balas_async(sender_number, jawaban)
            return jawaban, {'status': 'name_registered'}, status.HTTP_200_OK

        # ── Konfirmasi 'sesuai' utk form order yang sudah direkap ──
        # Gerbang sebelum Order benar-benar dibuat (instruksi user 2026-08-15).
        parsed_pending = pending_order_form.get(sender_number)
        if parsed_pending and cocok_konfirmasi_sesuai(message_text):
            pending_order_form.discard(sender_number)
            order_id, is_desain_ready = self._buat_order_dari_data(parsed_pending)
            jawaban = self._bangun_balasan_konfirmasi_order(order_id, panggilan, is_desain_ready)
            simpan_ke_memori(sender_number, "assistant", jawaban, nama_pelanggan)
            self._kirim_balas_async(sender_number, jawaban)
            return jawaban, {'status': 'order_confirmed'}, status.HTTP_200_OK

        # ── Jawaban PILIHAN PRODUK setelah info kategori/harga ──
        # (dikirim Trigger 2 cek_rules_awal — lihat wa_logic.py). Pelanggan
        # bebas ketik nama produk yang dipilih dari daftar; teksnya dipakai
        # apa adanya (pre-fill kolom Jenis Produk di form nanti) & lanjut
        # tanya status desain utk produk itu (instruksi user 2026-08-15).
        if sender_number in menunggu_pilihan_produk:
            # Sebelum anggap pesan ini = nama produk yang dipilih, cek dulu
            # apakah pelanggan malah nyeletuk hal lain di tengah alur (mis.
            # nanya harga produk lain dgn ukuran spesifik) — coba jalur
            # kalkulator/pencarian harga yang SUDAH deterministik dulu (bukan
            # nebak). Kalau ketemu jawaban, balas itu & JANGAN discard state
            # ini, biar pelanggan masih bisa lanjut milih produk setelahnya
            # (bug ditemukan user 2026-08-15: pesan di luar alur kepaksa
            # masuk step ini & bikin jawaban ngaco).
            jawaban_diluar_alur = cek_harga(message_text, nama_pelanggan, nomor=sender_number)
            if jawaban_diluar_alur:
                simpan_ke_memori(sender_number, "assistant", jawaban_diluar_alur, nama_pelanggan)
                self._kirim_balas_async(sender_number, jawaban_diluar_alur)
                return jawaban_diluar_alur, {'status': 'diluar_alur_pilihan_produk'}, status.HTTP_200_OK

            if _pesan_konfirmasi_tanpa_produk(message_text):
                # Pelanggan cuma konfirmasi niat ("mau order", "oke", "siap",
                # dst) TANPA menyebut produk konkret — tanya lagi lebih sopan,
                # JANGAN pakai teks itu sbg nama produk & JANGAN discard state
                # (bug ditemukan user 2026-08-15 lewat log VPS: "Okey saya mau
                # order" kepakai jadi nama produk & masuk ke form apa adanya).
                jawaban = f"Baik {panggilan} 🙏 Boleh disebutkan dulu produk yang mana ya, Kak? 😊"
                simpan_ke_memori(sender_number, "assistant", jawaban, nama_pelanggan)
                self._kirim_balas_async(sender_number, jawaban)
                return jawaban, {'status': 'pilihan_produk_belum_jelas'}, status.HTTP_200_OK

            kategori_slug = menunggu_pilihan_produk.get(sender_number)
            menunggu_pilihan_produk.discard(sender_number)
            info_konteks = get_pricelist_kategori(kategori_slug) if kategori_slug else ''
            nama_produk_dipilih = ekstrak_produk_pilihan(message_text, info_konteks)
            menunggu_status_desain.set(sender_number, nama_produk_dipilih)
            jawaban = (
                f"Baik {panggilan}! Untuk *{nama_produk_dipilih}* — apakah sudah punya "
                f"file desainnya, atau belum ada, nih? 😊"
            )
            simpan_ke_memori(sender_number, "assistant", jawaban, nama_pelanggan)
            self._kirim_balas_async(sender_number, jawaban)
            return jawaban, {'status': 'product_choice_captured'}, status.HTTP_200_OK

        # ── Jawaban status desain utk produk yang sudah dipilih ──
        produk_dipilih = menunggu_status_desain.get(sender_number)
        if produk_dipilih:
            status_desain = cocok_status_desain(message_text)
            if status_desain is None:
                # Belum jelas sudah/belum desain — cek dulu apakah pelanggan
                # sebenarnya nanya hal lain (harga produk lain, ukuran lain,
                # dll.) sebelum ditebak sbg jawaban. Kalau ketemu, balas &
                # JANGAN discard state, tanya lagi status desainnya nanti
                # (bug ditemukan user 2026-08-15: pertanyaan estimasi harga
                # kepaksa dianggap jawaban "sudah", langsung kirim form).
                jawaban_diluar_alur = cek_harga(message_text, nama_pelanggan, nomor=sender_number)
                if jawaban_diluar_alur:
                    jawaban = (
                        f"{jawaban_diluar_alur}\n\n"
                        f"Btw {panggilan}, utk *{produk_dipilih}* yang tadi — sudah ada "
                        f"file desainnya atau belum ya? 😊"
                    )
                    simpan_ke_memori(sender_number, "assistant", jawaban, nama_pelanggan)
                    self._kirim_balas_async(sender_number, jawaban)
                    return jawaban, {'status': 'diluar_alur_status_desain'}, status.HTTP_200_OK

            menunggu_status_desain.discard(sender_number)
            form = get_form_order(nama_pelanggan, jenis_produk=produk_dipilih)
            if status_desain == 'belum':
                jawaban = (
                    f"Baik {panggilan}, tidak masalah 😊 Silakan *copy* dan isi form order berikut "
                    f"(isi *File Desain: belum ada*), lalu lengkapi juga *Form Konsep Desain* di "
                    f"bawahnya biar tim desainer kami langsung bisa proses:\n\n{form}\n\n"
                    f"📋 *FORM KONSEP DESAIN*\n"
                    f"- Tulisan yang dimuat:\n"
                    f"- Dominan Warna:\n"
                    f"- Logo / Foto (Ada/Tidak):\n"
                    f"- Bentuk (Vertikal / Horizontal):\n"
                    f"- Request Tambahan:\n"
                )
            else:
                jawaban = f"Siap {panggilan}! Silakan *copy* dan isi form order berikut:\n\n{form}"
            simpan_ke_memori(sender_number, "assistant", jawaban, nama_pelanggan)
            self._kirim_balas_async(sender_number, jawaban)
            return jawaban, {'status': 'design_status_answered'}, status.HTTP_200_OK

        # Simpan pesan masuk ke memori AI
        simpan_ke_memori(sender_number, "user", message_text, nama_pelanggan)

        # Step 2: Cek tracking / Kirim Desain pesanan
        is_form_order = (
            ('jenis produk' in p_kecil and ('no. wa' in p_kecil or 'item 1' in p_kecil or 'no wa' in p_kecil))
            or
            ('nama pemesan' in p_kecil and 'jenis produk' in p_kecil)
        )
        # WAJIB ada penanda ID Pesanan — form konsep desain gabungan (dikirim
        # bareng form order utk order yang BELUM dibuat, lihat STEP 1d/status
        # desain 'belum') sengaja TIDAK punya ID Pesanan (order-nya belum ada),
        # beda dari form desain BERDIRI SENDIRI utk order yang SUDAH ada (selalu
        # ada baris "ID Pesanan: ORD-..."). Tanpa syarat ini, form gabungan tsb
        # kena sini duluan & gagal dgn "ID Pesanan tidak ditemukan" (bug
        # ditemukan user 2026-08-15 lewat log VPS).
        is_form_desain = ('tulisan yang dimuat' in p_kecil or 'dominan warna' in p_kecil) and (
            'id pesanan' in p_kecil or 'id order' in p_kecil or 'ord-' in p_kecil
        )

        if not (is_form_order or is_form_desain):
            jawaban = proses_kirim_desain(message_text, sender_number, nama_pelanggan, media_url=media_url)
            if not jawaban:
                jawaban = cek_tracking(message_text, sender_number, nama_pelanggan)
            if jawaban:
                simpan_ke_memori(sender_number, "assistant", jawaban, nama_pelanggan)
                self._kirim_balas_async(sender_number, jawaban)
                return jawaban, {'status': 'tracking_replied'}, status.HTTP_200_OK

        # Step 3: Deteksi form order / desain
        if is_form_order or is_form_desain:
            detail_bersih = _re.split(r'(?i)===?\s*AKHIR\s*TEMPLATE\s*===?|⚠️\s*\*?PENTING:\*?|data\s+sudah\s+sesuai|desain\s+sudah\s+sesuai', message_text)[0].strip()
            try:
                if is_form_desain:
                    order_id, success, err_msg = update_desain_dari_form_data(detail_bersih)
                    if success:
                        jawaban = (
                            f"Terima kasih {panggilan}! Konsep desain sudah masuk ke Antrean Desain ✅\n\n"
                            f"🎫 *ID PESANAN: {order_id}*\n"
                            f"Tim desain kami akan segera memproses konsep Kakak. Mohon ditunggu ya! 🙏"
                        )
                    else:
                        jawaban = (
                            f"Maaf {panggilan}, gagal memproses konsep desain Kakak:\n"
                            f"⚠️ {err_msg}\n\n"
                            f"Mohon periksa kembali ID Pesanan Kakak dan kirimkan ulang dengan benar ya Kak. 🙏"
                        )
                else:
                    # Parse dulu, JANGAN langsung buat Order — tampilkan rekap,
                    # tunggu pelanggan ketik 'sesuai' (gerbang konfirmasi,
                    # instruksi user 2026-08-15). Order baru benar-benar dibuat
                    # di blok cek pending_order_form di atas (dekat cek nama).
                    parsed = self._parse_form_order(sender_number, nama_pelanggan, detail_bersih)
                    pending_order_form.set(sender_number, parsed)
                    jawaban = self._bangun_balasan_rekap_order(parsed, panggilan)
            except ValueError as ve:
                jawaban = (
                    f"Maaf {panggilan}, format pengisian form pesanan Kakak belum lengkap / ada yang salah:\n\n"
                    f"⚠️ {str(ve)}\n\n"
                    f"Mohon perbaiki dan kirimkan ulang dengan format yang benar ya Kak. 🙏😊"
                )

        # Step 3b: Deteksi form pembatalan pesanan (ID Pesanan + Alasan
        # Pembatalan) — order belum selesai diproses otomatis, order selesai
        # diteruskan ke admin (lihat proses_form_pembatalan di wa_logic.py).
        if not jawaban:
            from ..wa_logic import FORM_PEMBATALAN_PENANDA, proses_form_pembatalan
            if all(penanda in p_kecil for penanda in FORM_PEMBATALAN_PENANDA):
                jawaban, admin_notify = proses_form_pembatalan(message_text, nama_pelanggan)
                if admin_notify:
                    manager_user = CustomUser.objects.filter(role__in=['manager', 'owner'], is_active=True).first()
                    if manager_user and manager_user.no_hp:
                        mgr_wa = manager_user.no_hp.replace('+', '').replace(' ', '').replace('-', '')
                        self._kirim_balas_async(mgr_wa, admin_notify)

        # Step 4: Cek tanya harga (jawab dari Product nyata, TANPA form)
        if not jawaban:
            jawaban = cek_harga(message_text, nama_pelanggan, nomor=sender_number)

        # Step 5: Cek rules awal (sapaan, katalog nyata, minta form)
        if not jawaban:
            jawaban = cek_rules_awal(message_text, sender_number, nama_pelanggan)

        # Step 6: AI — percakapan kontekstual/di luar keyword. Diletakkan
        # SEBELUM FAQ database supaya jawabannya tidak kaku.
        if not jawaban:
            jawaban = tanya_ai_finishing(sender_number, nama_pelanggan)

        # Step 7: FAQ dari database — jaring pengaman terakhir kalau AI
        # gagal total dan sempat mengembalikan jawaban kosong.
        if not jawaban:
            jawaban = cek_database_faq(message_text, nama_pelanggan)

        if jawaban:
            if jawaban.startswith(TOMBOL_MARKER):
                teks_bersih = jawaban[len(TOMBOL_MARKER):]
                simpan_ke_memori(sender_number, "assistant", teks_bersih, nama_pelanggan)
                self._kirim_tombol_atau_teks(
                    sender_number, teks_bersih, MENU_TOMBOL,
                    fallback_opsi_teks="1. 📋 Order\n2. 💰 Tanya Produk\n3. 📦 Cek Status\n_Balas dengan angkanya ya Kak_",
                )
                jawaban = teks_bersih
            elif jawaban.startswith(TOMBOL_MARKER_2):
                teks_bersih = jawaban[len(TOMBOL_MARKER_2):]
                simpan_ke_memori(sender_number, "assistant", teks_bersih, nama_pelanggan)
                self._kirim_tombol_atau_teks(
                    sender_number, teks_bersih, TOMBOL_PRODUK,
                    fallback_opsi_teks="Ketik *harga <nama produk>* untuk cek harga, atau *order* untuk langsung pesan ya Kak 🙏",
                )
                jawaban = teks_bersih
            else:
                simpan_ke_memori(sender_number, "assistant", jawaban, nama_pelanggan)
                self._kirim_balas_async(sender_number, jawaban)

        return jawaban, {'status': 'processed'}, status.HTTP_200_OK


class EvolutionWebhookView(BaseWhatsAppWebhookView):
    """
    Webhook endpoint untuk Evolution API. AllowAny.
    Memproses pesan masuk, mendeteksi anti-duplikasi, mengeksekusi logika wa_logic,
    dan mengirim balasan asinkron via REST API Client.
    """
    def post(self, request, *args, **kwargs):
        data = request.data

        # 1. Validasi API Key (fail-closed jika tidak dikonfigurasi)
        expected_key = os.getenv("EVOLUTION_API_KEY")
        if not expected_key:
            logger.error("EVOLUTION_API_KEY is not configured. Webhook is closed.")
            return Response({'error': 'Evolution API key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        from django.utils.crypto import constant_time_compare
        auth_key = (
            request.headers.get("apikey") or 
            request.headers.get("Authorization", "") or 
            request.query_params.get("apikey") or 
            request.query_params.get("token") or 
            request.query_params.get("secret") or 
            ""
        )
        
        is_valid = False
        if auth_key:
            if constant_time_compare(auth_key, expected_key):
                is_valid = True
            elif auth_key.startswith("Bearer ") and constant_time_compare(auth_key, f"Bearer {expected_key}"):
                is_valid = True

        if not is_valid:
            logger.warning(f"Unauthorized Webhook request dengan apikey: {auth_key}")
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        # Proses event messages.upsert / MESSAGES_UPSERT
        event_raw = str(data.get('event', '')).lower().replace('_', '.')
        if event_raw and event_raw not in ("messages.upsert", "messages", "message.upsert"):
            return Response({'status': 'ignored_event_type', 'event': event_raw}, status=status.HTTP_200_OK)

        event_data = data.get('data', {}) if isinstance(data.get('data'), dict) else data
        if not event_data:
            return Response({'error': 'No data payload found'}, status=status.HTTP_400_BAD_REQUEST)

        key = event_data.get('key', {})
        from_me = key.get('fromMe', False)
        if from_me:
            sender = key.get('remoteJid', '')
            if sender and '@g.us' not in sender:
                sender_number = sender.split('@')[0].replace('+', '').replace(' ', '').replace('-', '')
                if sender_number:
                    try:
                        # SENGAJA cuma set cache 15 menit, BUKAN Contact.handover_to_staff
                        # (flag DB permanen) — itu direservasi khusus utk toggle manual
                        # "Ambil Alih Chat" di dashboard (lihat views/contacts.py
                        # perform_update). Sebelum perbaikan ini, tiap staff balas
                        # manual SEKALI lewat WA langsung, flag DB permanen ikut
                        # kenyalain & bot MATI SELAMANYA sampai ada yang matiin manual
                        # lewat dashboard — walau cache 15 menitnya sendiri sudah
                        # kadaluarsa (bug dilaporkan user 2026-08-15, kasir lupa
                        # nyalain lagi = bot mati permanen tanpa disadari). Sekarang:
                        # auto-detect cuma pause 15 menit & OTOMATIS nyala lagi kalau
                        # tidak ada balasan manual susulan (cache di-refresh 15 menit
                        # lagi tiap kali ada balasan manual baru, persis instruksi
                        # user); toggle manual dashboard tetap bisa matiin bot lebih
                        # lama/permanen lewat flag DB kalau kasir memang sengaja mau.
                        Contact.objects.get_or_create(nomor_wa=sender_number, defaults={'nama': 'Pelanggan'})
                        cache.set(f"wa_handover_{sender_number}", True, timeout=900)
                        logger.info(f"Human takeover detected (auto-pause 15 menit) untuk {sender_number}.")
                    except Exception as e:
                        logger.error(f"Gagal mengeset handover pada human takeover: {e}")
            return Response({'status': 'ignored_from_me'}, status=status.HTTP_200_OK)

        sender = key.get('remoteJid', '') or event_data.get('sender', '')
        if not sender or '@g.us' in sender:
            logger.info(f"Group message from {sender} ignored.")
            return Response({'status': 'ignored_group_message'}, status=status.HTTP_200_OK)

        # 2. Inbound Deduplication (Anti-Duplikasi Masuk)
        message_id = key.get('id', '')
        if message_id:
            inbound_cache_key = f"evo_inbound_{message_id}"
            if cache.get(inbound_cache_key):
                logger.info(f"Duplicate inbound message ID {message_id} diabaikan.")
                return Response({'status': 'duplicate_ignored'}, status=status.HTTP_200_OK)
            cache.set(inbound_cache_key, True, timeout=300) # 5 menit TTL

        # Ekstrak konten pesan
        from ..wa_logic import BUTTON_ID_KE_TEKS

        msg_content = event_data.get('message', {})
        message_text = ""
        media_url = ""
        if isinstance(msg_content, dict):
            # Balasan tap tombol (Quick Reply Buttons) — datang sebagai
            # buttonsResponseMessage (Evolution/Baileys) atau
            # templateButtonReplyMessage (varian versi lama). Di-map ke
            # padanan teks ('1'/'2'/'3') supaya routing di cek_rules_awal()
            # tidak perlu tahu bedanya tap tombol vs ketik manual.
            tombol_id = (
                msg_content.get('buttonsResponseMessage', {}).get('selectedButtonId') or
                msg_content.get('templateButtonReplyMessage', {}).get('selectedId') or
                ''
            )
            if tombol_id and tombol_id in BUTTON_ID_KE_TEKS:
                message_text = BUTTON_ID_KE_TEKS[tombol_id]
            elif tombol_id in ('produk_harga', 'produk_order'):
                # Tombol produk (dikirim dari Trigger 3 cek_rules_awal) —
                # produk yang dimaksud disimpan di cache saat tombol dikirim,
                # bukan di ID tombolnya sendiri.
                nomor_bersih = sender.split('@')[0].replace('+', '').replace(' ', '').replace('-', '')
                if tombol_id == 'produk_order':
                    message_text = 'mau order'
                else:
                    produk_terakhir = cache.get(f"wa_last_produk_{nomor_bersih}")
                    if produk_terakhir:
                        message_text = f"harga {produk_terakhir}"
                    else:
                        # Cache konteks produk sudah kedaluwarsa (>10 menit) —
                        # jangan suntikkan pesan palsu ke pipeline, cukup
                        # balas jujur & selesai di sini.
                        self._kirim_balas_async(nomor_bersih, "Boleh sebutkan lagi nama produknya Kak? 🙏")
                        return Response({'status': 'produk_context_expired'}, status=status.HTTP_200_OK)

            message_text = message_text or (
                msg_content.get('conversation', '') or
                msg_content.get('extendedTextMessage', {}).get('text', '') or
                msg_content.get('imageMessage', {}).get('caption', '') or
                msg_content.get('videoMessage', {}).get('caption', '') or
                msg_content.get('documentMessage', {}).get('caption', '') or
                ''
            ).strip()
            
            # Extract media URL/filename
            if 'imageMessage' in msg_content:
                media_url = msg_content['imageMessage'].get('url', '')
            elif 'videoMessage' in msg_content:
                media_url = msg_content['videoMessage'].get('url', '')
            elif 'documentMessage' in msg_content:
                media_url = msg_content['documentMessage'].get('url', '')
        elif isinstance(msg_content, str):
            message_text = msg_content.strip()

        push_name = event_data.get('pushName', '')
        _, res_data, http_code = self._proses_pesan_masuk(
            sender_raw=sender,
            message_text=message_text,
            media_url=media_url,
            push_name=push_name
        )
        return Response(res_data, status=http_code)


class WhatsAppStatusView(APIView):
    """
    GET /api/whatsapp/status/
    Returns the current connection state of the WhatsApp instance
    and a QR code (base64) for scanning if not yet connected.
    Owner/Manager only.
    """
    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        from ..whatsapp_client import whatsapp_client
        if whatsapp_client._is_offline():
            return Response({
                "state": "offline",
                "connected": False,
                "owner_jid": None,
                "qr_base64": None,
                "pairing_code": None,
                "instance_name": os.getenv("EVOLUTION_INSTANCE_NAME", "bintang_instance"),
                "detail": "WhatsApp integration is offline or disabled."
            })

        import requests as req_lib
        base_url = os.getenv("EVOLUTION_API_URL", "http://localhost:8080").rstrip('/')
        api_key  = os.getenv("EVOLUTION_API_KEY", "LocalTestingApiKey123")
        instance = os.getenv("EVOLUTION_INSTANCE_NAME", "bintang_instance")
        headers  = {"apikey": api_key}

        # 1. Get connection state
        state = "unknown"
        owner_jid = None
        try:
            r = req_lib.get(f"{base_url}/instance/connectionState/{instance}", headers=headers, timeout=5)
            if r.ok:
                data = r.json()
                state = data.get("instance", {}).get("state", "unknown")
        except Exception as e:
            logger.warning(f"Could not fetch WA connection state: {e}")

        # 2. If not connected, get QR code
        qr_base64 = None
        pairing_code = None
        if state in ("connecting", "close", "unknown"):
            try:
                r = req_lib.get(f"{base_url}/instance/connect/{instance}", headers=headers, timeout=10)
                if r.ok:
                    data = r.json()
                    qr_base64 = data.get("base64")
                    pairing_code = data.get("pairingCode")
            except Exception as e:
                logger.warning(f"Could not fetch WA QR code: {e}")

        # 3. Get instance info (message/chat count etc)
        instance_info = {}
        try:
            r = req_lib.get(f"{base_url}/instance/fetchInstances", headers=headers, timeout=5)
            if r.ok:
                instances = r.json()
                for inst in (instances if isinstance(instances, list) else []):
                    if inst.get("name") == instance:
                        instance_info = {
                            "ownerJid":    inst.get("ownerJid"),
                            "profileName": inst.get("profileName"),
                            "messageCount": inst.get("_count", {}).get("Message", 0),
                            "chatCount":    inst.get("_count", {}).get("Chat", 0),
                        }
                        owner_jid = inst.get("ownerJid")
                        break
        except Exception as e:
            logger.warning(f"Could not fetch WA instance info: {e}")

        return Response({
            "state":        state,
            "connected":    state == "open",
            "owner_jid":    owner_jid,
            "qr_base64":    qr_base64,
            "pairing_code": pairing_code,
            "instance_name": instance,
            **instance_info,
        })


class WhatsAppChatsView(APIView):
    """
    GET /api/whatsapp/chats/
    Retrieves all active chats from the WhatsApp Gateway (Evolution API).
    """
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def get(self, request):
        chats = whatsapp_client.get_chats()
        return Response(chats)


class WhatsAppMessagesView(APIView):
    """
    GET /api/whatsapp/messages/?number=628xx
    Retrieves message history for a specific number from Evolution API.
    """
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def get(self, request):
        number = request.query_params.get('number')
        if not number:
            return Response({"error": "Query parameter 'number' is required"}, status=400)
        
        limit = int(request.query_params.get('limit', 50))
        messages = whatsapp_client.get_messages(number, limit=limit)
        return Response(messages)


class WhatsAppSendMessageView(APIView):
    """
    POST /api/whatsapp/send/
    Sends a WhatsApp message manually to a contact.
    """
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def post(self, request):
        number = request.data.get('number')
        text = request.data.get('text')
        if not number or not text:
            return Response({"error": "Fields 'number' and 'text' are required"}, status=400)
        
        result = whatsapp_client.send_text_message(number, text)
        if result:
            try:
                clean_num = number.replace('+', '').replace(' ', '').replace('-', '').split('@')[0]
                cache.set(f"wa_handover_{clean_num}", True, timeout=900)
                logger.info(f"Staff manually sent message to {clean_num}. Handover enabled for 15 mins.")
            except Exception as e:
                logger.error(f"Failed to set handover cache on manual send: {e}")
            return Response(result)
        return Response({"error": "Failed to send message via WhatsApp Gateway"}, status=500)


class WhatsAppSendMediaView(APIView):
    """
    POST /api/whatsapp/send-media/
    Uploads a file to Cloudflare R2 / Django storage, then sends it via WhatsApp.
    Accepts:
      - file: multipart file
      - number: string
      - caption: string (optional)
    """
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def post(self, request):
        import mimetypes
        from django.core.files.storage import default_storage
        from django.utils.text import get_valid_filename

        number = request.data.get('number')
        caption = request.data.get('caption', '')
        file_obj = request.FILES.get('file')

        if not number or not file_obj:
            return Response({"error": "Fields 'number' and 'file' are required"}, status=400)

        # 1. Clean file name
        cleaned_filename = get_valid_filename(file_obj.name)
        
        # Save to storage (R2 in production, local in dev)
        unique_name = f"whatsapp_media/{uuid.uuid4().hex}_{cleaned_filename}"
        
        try:
            saved_path = default_storage.save(unique_name, file_obj)
            relative_url = default_storage.url(saved_path)
            
            # Make sure we have an absolute URL
            if relative_url.startswith('/'):
                media_url = request.build_absolute_uri(relative_url)
            else:
                media_url = relative_url

            # 2. Detect mime type & media type
            mime_type, _ = mimetypes.guess_type(cleaned_filename)
            if not mime_type:
                mime_type = "application/octet-stream"

            media_type = "document"
            if mime_type.startswith("image/"):
                media_type = "image"
            elif mime_type.startswith("video/"):
                media_type = "video"
            elif mime_type.startswith("audio/"):
                media_type = "audio"

            # 3. Send via Evolution API
            result = whatsapp_client.send_media_message(
                number=number,
                media_url=media_url,
                media_type=media_type,
                mime_type=mime_type,
                file_name=cleaned_filename,
                caption=caption
            )

            if result:
                try:
                    clean_num = number.replace('+', '').replace(' ', '').replace('-', '').split('@')[0]
                    cache.set(f"wa_handover_{clean_num}", True, timeout=900)
                    logger.info(f"Staff manually sent media to {clean_num}. Handover enabled for 15 mins.")
                except Exception as e:
                    logger.error(f"Failed to set handover cache on manual media send: {e}")
                return Response({
                    "status": "success",
                    "media_url": media_url,
                    "result": result
                })
            
            return Response({"error": "Failed to send media via WhatsApp Gateway"}, status=500)

        except Exception as e:
            logger.error(f"Error handling WhatsApp send media upload: {e}", exc_info=True)
            return Response({"error": str(e)}, status=500)


class WAWebhookView(BaseWhatsAppWebhookView):
    """
    Webhook endpoint untuk menerima pesan WhatsApp dari local Baileys Gateway (wa-gateway).
    Memproses auto-reply, sapaan, tracking, form pesanan/desain, dan integrasi AI Assistant.
    """
    def post(self, request, *args, **kwargs):
        sender = request.data.get('sender', '')
        message = request.data.get('message', '')
        raw = request.data.get('raw', {}) or {}

        logger.info(f"[WA WEBHOOK BAILEYS] Pesan dari {sender}: {message}")

        if not sender or not message:
            return Response({'status': 'ignored_empty_payload'}, status=status.HTTP_200_OK)

        # Abaikan pesan grup WhatsApp
        if '@g.us' in str(sender):
            return Response({'status': 'ignored_group_message'}, status=status.HTTP_200_OK)

        # Inbound deduplication
        msg_id = raw.get('key', {}).get('id', '') if isinstance(raw, dict) else ''
        if msg_id:
            dedup_key = f"wa_baileys_inbound_{msg_id}"
            if cache.get(dedup_key):
                logger.info(f"Duplicate local inbound message ID {msg_id} diabaikan.")
                return Response({'status': 'duplicate_ignored'}, status=status.HTTP_200_OK)
            cache.set(dedup_key, True, timeout=300)

        push_name = raw.get('pushName', '') if isinstance(raw, dict) else ''
        media_url = raw.get('url', '') or raw.get('filename', '') if isinstance(raw, dict) else ''

        _, res_data, http_status = self._proses_pesan_masuk(
            sender_raw=str(sender),
            message_text=str(message),
            media_url=media_url,
            push_name=push_name
        )
        return Response(res_data, status=http_status)
