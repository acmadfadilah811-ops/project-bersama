import json
import os
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.core.cache import cache

from api.models import (
    Contact, CustomUser, Order, OrderItem, ProductPrice, SystemConfig, TahapProses, Divisi
)
from api.wa_logic import (
    get_business_name,
    get_ai_client,
    ekstrak_nama_dari_pesan,
    get_system_prompt,
    get_memori_percakapan,
    simpan_ke_memori,
    format_tracking,
    cek_tracking,
    hitung_harga_item_db,
    hitung_harga_otomatis,
    cek_harga,
    get_form_order,
    cek_rules_awal,
    cek_katalog_produk,
    cek_isi_kategori,
    tanya_ai_finishing,
    proses_kirim_desain,
    menunggu_nama,
    TOMBOL_MARKER,
    TOMBOL_MARKER_2,
    BUTTON_ID_KE_TEKS,
    cek_bahan_finishing_kurang,
    cek_bahan_terlaris,
    cek_finishing_terlaris,
    format_pesan_field_kurang,
    proses_form_pembatalan,
    get_form_pembatalan,
    cek_produk_terlaris,
    jawab_produk_terlaris,
    _parse_budget,
    jawab_produk_sesuai_budget,
    get_pricelist_kategori,
    cocok_status_desain,
    cocok_konfirmasi_sesuai,
    menunggu_pilihan_produk,
    menunggu_status_desain,
    pending_order_form,
    ekstrak_produk_pilihan,
)
from api.services.order_actions import batalkan_order, BatalkanOrderError
from api.product_models import Product, ProductCategory, ProductPackage
from django.contrib.auth import get_user_model

User = get_user_model()


class WALogicUnitTestCase(TestCase):
    """
    Unit testing untuk seluruh fungsi di wa_logic.py
    termasuk konfigurasi AI KoboiLLM (Gemini 2.5 Pro),
    kalkulator harga, tracking pesanan, dan fallback AI.
    """

    def setUp(self):
        cache.clear()
        # Setup dasar data produk dan konfigurasi bisnis
        SystemConfig.objects.update_or_create(
            key='bisnis_nama', defaults={'value': 'Bintang Advertising'}
        )
        ProductPrice.objects.create(
            nama_produk='Banner Flexi 280gr',
            kategori='print_outdoor_per_m2',
            harga=25000,
            price_type='flat'
        )
        ProductPrice.objects.create(
            nama_produk='Chromo A3+',
            kategori='sticker_a3_plus',
            harga=7000,
            price_type='tiered',
            tiers={'1-10': 7000, '11-50': 6000, '>50': 5000}
        )
        ProductPrice.objects.create(
            nama_produk='1 Sisi',
            kategori='kartu_nama_ivory_260',
            harga=35000,
            price_type='flat'
        )
        # hitung_harga_otomatis() TIDAK LAGI baca ProductPrice legacy (lihat
        # catatan di wa_logic.py — tabel live Product tidak punya
        # price_type='per_m2' utk banner sama sekali, jadi kalkulator versi
        # ProductPrice sudah lama mati/tidak ke-trigger di alur bot). Data
        # kalkulator sekarang dari SystemConfig 'wa_kalkulator_bahan', diisi
        # dari sumber yang sama dengan management command seed_wa_pricelist.
        from api.management.commands.seed_wa_pricelist import KALKULATOR_BAHAN
        SystemConfig.objects.update_or_create(
            key='wa_kalkulator_bahan',
            defaults={'value': json.dumps(KALKULATOR_BAHAN, ensure_ascii=False)},
        )

    def tearDown(self):
        cache.clear()

    def test_get_business_name(self):
        self.assertEqual(get_business_name(), 'Bintang Advertising')

    def test_get_ai_client_without_key(self):
        with patch.dict(os.environ, {"KOBOI_API_KEY": "", "OPENAI_API_KEY": ""}, clear=True):
            client = get_ai_client()
            self.assertIsNone(client)

    def test_get_ai_client_with_key_and_sk_prefix(self):
        with patch.dict(os.environ, {
            "KOBOI_API_KEY": "894ae5036e38d55b31e418fa4a0ae2c14d304d3c704f1c4ccdeeca7c39a6579e",
            "KOBOI_BASE_URL": "https://api.koboillm.com/v1"
        }):
            client = get_ai_client()
            self.assertIsNotNone(client)
            self.assertEqual(client.api_key, "sk-894ae5036e38d55b31e418fa4a0ae2c14d304d3c704f1c4ccdeeca7c39a6579e")
            self.assertTrue(str(client.base_url).startswith("https://api.koboillm.com/v1"))

    def test_ekstrak_nama_dari_pesan(self):
        self.assertEqual(ekstrak_nama_dari_pesan("Halo nama saya Budi Santoso"), "Budi Santoso")
        self.assertEqual(ekstrak_nama_dari_pesan("saya fadil"), "Fadil")
        self.assertEqual(ekstrak_nama_dari_pesan("panggil saja ani"), "Ani")
        self.assertEqual(ekstrak_nama_dari_pesan("bintang advertising"), "Bintang Advertising")

    def test_get_system_prompt_and_memory(self):
        prompt = get_system_prompt("Andi")
        self.assertIn("Andi", prompt)
        self.assertIn("Bintang Advertising", prompt)
        # Harga tidak lagi di-dump statis ke prompt (ProductPrice legacy), dan
        # AI tidak lagi diarahkan memakai tool (model/proxy yang dipakai bisa
        # menolak parameter tools) — AI diarahkan mengarahkan pelanggan pakai
        # keyword yang dijawab jalur deterministik (cek_harga_produk/
        # cek_katalog_produk, lihat services/wa_ai_tools.py).
        self.assertNotIn("tool `cari_produk`", prompt)
        self.assertIn("produk apa saja", prompt)

        mem = get_memori_percakapan("62812345678", "Andi")
        self.assertIsInstance(mem, list)
        self.assertEqual(mem[0]["role"], "system")

        simpan_ke_memori("62812345678", "user", "Halo admin", "Andi")
        mem_updated = get_memori_percakapan("62812345678", "Andi")
        self.assertEqual(len(mem_updated), 2)
        self.assertEqual(mem_updated[1]["role"], "user")
        self.assertEqual(mem_updated[1]["content"], "Halo admin")

    def test_cek_rules_awal_sapaan_dan_menu(self):
        # Sapaan kontak baru -> tanya nama
        jawaban_sapa = cek_rules_awal("halo", "628999999", "")
        self.assertIn("Boleh tahu nama Kakak siapa", jawaban_sapa)

        # Sapaan kontak lama -> berikan menu tombol (Quick Reply Buttons),
        # ditandai TOMBOL_MARKER supaya caller (views/whatsapp.py) kirim
        # sebagai tombol WA asli, bukan teks nomor "1/2/3".
        jawaban_sapa_lama = cek_rules_awal("halo", "628999999", "Budi")
        self.assertTrue(jawaban_sapa_lama.startswith(TOMBOL_MARKER))
        self.assertIn("Halo Kak Budi", jawaban_sapa_lama)

        # Menu 1 -> form order
        jawaban_menu1 = cek_rules_awal("1", "628999999", "Budi")
        self.assertIn("FORM ORDER", jawaban_menu1)

        # Katalog — tidak ada Product aktif di DB test ini, jadi
        # cek_katalog_produk (lihat KatalogProdukTest) turun ke None dan
        # lanjut ke AI fallback (tanya_ai_finishing).
        jawaban_katalog = cek_rules_awal("ada produk apa saja", "628999999", "Budi")
        self.assertIsNone(jawaban_katalog)

        # Rush order / cetak cepat
        jawaban_express = cek_rules_awal("bisa jadi hari ini?", "628999999", "Budi")
        self.assertIn("cetak cepat atau jika ingin jadi hari ini", jawaban_express)

    def test_cek_rules_awal_toleransi_typo(self):
        # Sapaan typo pendek -> tetap kena sapaan, bukan lolos ke AI
        jawaban_sapa_typo = cek_rules_awal("hallo", "628999998", "Budi")
        self.assertIsNotNone(jawaban_sapa_typo)
        self.assertIn("Halo Kak Budi", jawaban_sapa_typo)

        # Niat order eksplisit dengan typo, tanpa nama produk -> ditanya dulu
        # produk yang mana (bukan langsung form kosong, instruksi user 2026-08-15)
        jawaban_order_typo = cek_rules_awal("mau pesen sekarang", "628999998", "Budi")
        self.assertIsNotNone(jawaban_order_typo)
        self.assertIn("produk yang mana", jawaban_order_typo.lower())

        # Niat cetak + nama produk, keduanya typo -> tetap dapat form order
        jawaban_niat_produk_typo = cek_rules_awal("mau cetk bnner dong", "628999998", "Budi")
        self.assertIsNotNone(jawaban_niat_produk_typo)
        self.assertIn("FORM ORDER", jawaban_niat_produk_typo)

        # Pesan tidak nyambung sama sekali -> tidak boleh ke-trigger asal-asalan
        jawaban_tidak_nyambung = cek_rules_awal("kucing saya lucu sekali", "628999998", "Budi")
        self.assertIsNone(jawaban_tidak_nyambung)

    def test_kalkulator_harga_otomatis(self):
        # Banner 2x3 meter 2 lembar -> luas 6m2 x qty 2. Bahan pertama
        # (Banner 240, Rp18.000/m2): 6 x 18.000 x 2 = Rp216.000. SEMUA bahan
        # harus muncul (tabel perbandingan, instruksi user 2026-08-15), bukan
        # cuma 1 baris.
        hasil_banner = hitung_harga_otomatis("hitung banner 2x3 meter 2 lembar", "Budi")
        self.assertIsNotNone(hasil_banner)
        self.assertIn("ESTIMASI TOTAL BIAYA - BANNER/SPANDUK", hasil_banner)
        self.assertIn("6.00 m²", hasil_banner)
        self.assertIn("Banner 240", hasil_banner)
        self.assertIn("Rp 216.000", hasil_banner)
        self.assertIn("Banner 340", hasil_banner)  # bahan lain ikut tampil

        # Stiker chromo 20 lembar -> tier 1-25lbr = Rp7.000/lbr x 20 = Rp140.000
        hasil_stiker = hitung_harga_otomatis("hitung stiker chromo 20 lembar", "Budi")
        self.assertIsNotNone(hasil_stiker)
        self.assertIn("ESTIMASI TOTAL BIAYA - STIKER A3+", hasil_stiker)
        self.assertIn("Rp 140.000", hasil_stiker)
        self.assertIn("Vinyl Glossy", hasil_stiker)  # bahan lain ikut tampil

        # Kartu nama 2 box -> tier 2-5 box, Ivory 260 1 Sisi = Rp33.000 x 2 = Rp66.000
        hasil_kartu = hitung_harga_otomatis("hitung kartu nama 2 box", "Budi")
        self.assertIsNotNone(hasil_kartu)
        self.assertIn("ESTIMASI TOTAL BIAYA - KARTU NAMA", hasil_kartu)
        self.assertIn("Rp 66.000", hasil_kartu)

    def test_kalkulator_tetap_tabel_lengkap_walau_sebut_grade_spesifik(self):
        # Bug ditemukan user 2026-08-15: "banner 240 ukuran 3x4m itu berapa
        # harganya kak?" harus tetap kasih tabel SEMUA grade banner (biar
        # bisa dibandingkan), bukan cuma 1 baris Banner 240 — dan bukan malah
        # nyasar ke kategori banner lain yang tidak disebut.
        hasil = hitung_harga_otomatis("untuk banner 240 ukuran 3x4m itu berapa harganya kak?", "Bayu")
        self.assertIsNotNone(hasil)
        self.assertIn("ESTIMASI TOTAL BIAYA - BANNER/SPANDUK", hasil)
        self.assertIn("12.00 m²", hasil)  # 3 x 4
        self.assertIn("Banner 240", hasil)
        self.assertIn("Banner 340", hasil)
        self.assertIn("Albatros", hasil)

    def test_cek_harga_umum(self):
        # cek_harga sekarang jawab dari Product nyata (bukan hardcode/legacy
        # ProductPrice). Tanpa produk yang cocok sama sekali, jawabannya
        # adalah pesan eskalasi-ke-admin yang PASTI (bukan None) — supaya
        # pesan TIDAK jatuh ke AI fallback yang dulu bisa minta pelanggan
        # mengulang pesan yang sama tanpa akhir (insiden nyata 2026-08-12,
        # lihat test_cek_harga_produk_tidak_ketemu_eskalasi_admin).
        jawaban_kosong = cek_harga("berapa harga banner?", "Budi")
        self.assertIsNotNone(jawaban_kosong)
        self.assertIn("Admin", jawaban_kosong)
        self.assertNotIn("ketik ulang", jawaban_kosong.lower())

        Product.objects.create(
            nama='Banner Flexi 280gr', price_type='flat', harga_jual_toko=25000, is_active=True,
        )
        jawaban = cek_harga("berapa harga banner?", "Budi")
        self.assertIsNotNone(jawaban)
        self.assertIn("Banner Flexi 280gr", jawaban)
        self.assertIn("Rp25.000", jawaban)

    def test_cek_harga_typo_toleran(self):
        # Root cause bug 2026-08-12: pelanggan salah eja nama produk umum
        # ("benner" alih-alih "banner") bikin pencarian produk (icontains
        # persis) selalu kosong, jatuh ke AI fallback yang minta pelanggan
        # mengulang pesan — dan karena typo-nya tidak pernah diperbaiki
        # pelanggan, ini loop tanpa akhir. cari_produk() sekarang punya
        # fallback toleransi typo, jadi kueri bertypo umum tetap ketemu.
        Product.objects.create(
            nama='Banner Flexi 280gr', price_type='flat', harga_jual_toko=25000, is_active=True,
        )
        jawaban = cek_harga("harga benner", "Ahmad")
        self.assertIsNotNone(jawaban)
        self.assertIn("Banner Flexi 280gr", jawaban)

    def test_cek_harga_banner_dengan_ukuran_lewat_kalkulator_pintar(self):
        # Bug ditemukan user 2026-08-15: "banner 240 ukuran 3x4m" salah
        # jawab info kategori banner LAIN. cek_harga() sekarang coba
        # hitung_harga_otomatis() dulu — begitu ada kategori (banner) +
        # ukuran, langsung dapat tabel perbandingan SEMUA grade (bukan cuma
        # 1 produk, ATAU malah produk yang salah).
        jawaban = cek_harga("untuk banner 240 ukuran 3x4m itu berapa harganya kak?", "Budi")
        self.assertIsNotNone(jawaban)
        self.assertIn("ESTIMASI TOTAL BIAYA - BANNER/SPANDUK", jawaban)
        self.assertIn("Banner 240", jawaban)
        self.assertIn("Banner 340", jawaban)
        self.assertIn("Rp 216.000", jawaban)  # Banner 240: 18.000/m2 x (3x4=12m2)

    def test_cek_harga_produk_angka_di_nama_tidak_terbuang(self):
        # Padanan bug yang sama ("240" jangan ikut kebuang dari query cari
        # produk) tapi utk produk DI LUAR 4 kategori kalkulator pintar (mis.
        # bukan banner/stiker/kartu nama/kertas A3+) — jalur ini tetap lewat
        # cek_harga_produk() spt sebelumnya, bukan hitung_harga_otomatis().
        Product.objects.create(
            nama='Kaos Combed 240', price_type='flat', harga_jual_toko=95000,
            is_active=True, butuh_bahan=False, butuh_finishing=False,
        )
        Product.objects.create(
            nama='Kaos Combed 340', price_type='flat', harga_jual_toko=120000,
            is_active=True, butuh_bahan=False, butuh_finishing=False,
        )
        jawaban = cek_harga("berapa harga kaos combed 240 ya kak", "Budi")
        self.assertIsNotNone(jawaban)
        self.assertIn("Kaos Combed 240", jawaban)
        self.assertNotIn("Kaos Combed 340", jawaban)

    def test_cek_harga_kategori_pricelist_dijawab_dari_pricelist_bukan_db(self):
        # Bug ditemukan user 2026-08-15: "berapa harga buku yasin" (produk yang
        # memang tidak ada sbg Product record live) balas daftar produk lain
        # yang tidak relevan sama sekali (fuzzy search DB nyasar). Begitu
        # kategorinya ada di pricelist statis, itu yang harus dijawab duluan —
        # BUKAN pencarian live Product DB.
        SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori',
            defaults={'value': '{"cetak_khusus": "Buku Yasin mulai Rp14rb/buku (min 30 buku)"}'},
        )
        # Produk lain yang TIDAK relevan tapi bisa kena fuzzy match kalau
        # jalur DB dipakai — pastikan TIDAK muncul di jawaban.
        Product.objects.create(
            nama='Stiker Glossy Tanpa Cetak', price_type='flat', harga_jual_toko=60000, is_active=True,
        )
        jawaban = cek_harga("Lah cetak buku yasin biasanya berapa", "Ahmad")
        self.assertIsNotNone(jawaban)
        self.assertIn("Rp14rb", jawaban)
        self.assertNotIn("Stiker Glossy", jawaban)

    def test_dimensi_pxl_untuk_kategori_non_banner_tidak_dipaksa_kalkulator_banner(self):
        # Bug ditemukan user 2026-08-15 lewat log VPS: "Kalo saya order plakat
        # printing ukuran 60x40cm 2 pcs berapa kak" (Acrylic/Plakat, harga per
        # cm) dijawab pakai tabel kalkulator BANNER (per m2) — krn
        # hitung_harga_otomatis() asal anggap "ada pola ukuran PxL" = banner,
        # padahal "plakat" itu kategori pricelist LAIN yang beda cara hitung.
        SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori',
            defaults={'value': '{"acrylic": "Plakat Printing 5mm: Rp460/cm"}'},
        )
        jawaban = cek_harga("Kalo saya order plakat printing ukuran 60x40cm 2 pcs berapa kak", "Ahmad")
        self.assertIsNotNone(jawaban)
        self.assertIn("Rp460/cm", jawaban)
        self.assertNotIn("ESTIMASI TOTAL BIAYA - BANNER/SPANDUK", jawaban)

    def test_cek_harga_produk_tidak_ketemu_eskalasi_admin(self):
        # Kalau produk BENAR-BENAR tidak ada (bukan cuma typo), bot tidak
        # boleh diam-diam lempar ke AI yang bisa minta pelanggan mengulang
        # pesan tanpa akhir — harus langsung kasih jawaban pasti + kirim
        # notifikasi WA ke admin. Bot TETAP AKTIF untuk nomor ini (instruksi
        # eksplisit user 2026-08-12) — TIDAK mematikan diri via
        # handover_to_staff, beda dari mekanisme "Ambil Alih Chat" manual.
        manager = CustomUser.objects.create_user(
            username='manager_eskalasi', password='pass12345', role='manager',
            no_hp='6281111222333',
        )
        with patch('api.whatsapp_client.whatsapp_client.send_text_message') as mock_kirim:
            jawaban = cek_harga("harga produk zzz yang tidak ada sama sekali", "Ahmad", nomor="6289998887776")

        self.assertIsNotNone(jawaban)
        self.assertIn("Admin", jawaban)
        self.assertNotIn("ketik ulang", jawaban.lower())

        self.assertFalse(Contact.objects.filter(nomor_wa="6289998887776", handover_to_staff=True).exists())
        mock_kirim.assert_called_once()
        self.assertEqual(mock_kirim.call_args[0][0], manager.no_hp)

    def test_tanya_ai_finishing_fallback_when_no_client(self):
        with patch("api.wa_logic.get_ai_client", return_value=None):
            jawaban = tanya_ai_finishing("6281111111", "Budi")
            self.assertIn("Bintang Advertising", jawaban)
            self.assertIn("Informasi Harga Produk", jawaban)

    def test_tanya_ai_finishing_success_with_gemini_pro(self):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "Halo Kak Budi! Spanduk 2x3 meter kami buat dengan bahan Flexi berkualitas tinggi. 😊"
        mock_choice.message.tool_calls = None  # AI tidak minta data tool pada giliran ini
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response

        with patch("api.wa_logic.get_ai_client", return_value=mock_client), \
             patch.dict(os.environ, {"KOBOI_MODEL": "gemini-2.5-pro"}):
            jawaban = tanya_ai_finishing("6281111111", "Budi")
            self.assertEqual(jawaban, "Halo Kak Budi! Spanduk 2x3 meter kami buat dengan bahan Flexi berkualitas tinggi. 😊")
            
            # Verifikasi model gemini-2.5-pro digunakan
            mock_client.chat.completions.create.assert_called_once()
            call_kwargs = mock_client.chat.completions.create.call_args.kwargs
            self.assertEqual(call_kwargs.get("model"), "gemini-2.5-pro")

    def test_tanya_ai_finishing_tidak_pernah_kirim_parameter_tools(self):
        # AI tidak lagi diberi akses tool-calling (KOBOI_MODEL bisa menolak
        # parameter `tools` sama sekali dengan 400 Bad Request) — data
        # produk/harga NYATA sudah dijawab duluan di jalur deterministik
        # (cek_harga_produk/cek_katalog_produk) sebelum AI dipanggil.
        final_choice = MagicMock()
        final_choice.message.content = "Halo Kak Budi! Ada yang bisa kami bantu? 😊"
        final_response = MagicMock()
        final_response.choices = [final_choice]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = final_response

        with patch("api.wa_logic.get_ai_client", return_value=mock_client):
            jawaban = tanya_ai_finishing("6281111111", "Budi")
            self.assertEqual(jawaban, "Halo Kak Budi! Ada yang bisa kami bantu? 😊")
            mock_client.chat.completions.create.assert_called_once()
            call_kwargs = mock_client.chat.completions.create.call_args.kwargs
            self.assertNotIn('tools', call_kwargs)

    def test_tanya_ai_finishing_retry_dan_akhirnya_berhasil(self):
        final_choice = MagicMock()
        final_choice.message.content = "Halo Kak Budi! Ada yang bisa kami bantu? 😊"
        final_response = MagicMock()
        final_response.choices = [final_choice]

        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = [
            RuntimeError("timeout sementara"),
            RuntimeError("timeout sementara"),
            final_response,
        ]

        with patch("api.wa_logic.get_ai_client", return_value=mock_client), \
             patch("time.sleep", return_value=None):
            jawaban = tanya_ai_finishing("6281111111", "Budi")
            self.assertEqual(jawaban, "Halo Kak Budi! Ada yang bisa kami bantu? 😊")
            self.assertEqual(mock_client.chat.completions.create.call_count, 3)

    def test_tanya_ai_finishing_handles_exception_gracefully(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = RuntimeError("API connection timeout")

        with patch("api.wa_logic.get_ai_client", return_value=mock_client):
            jawaban = tanya_ai_finishing("6281111111", "Budi")
            self.assertIn("Bintang Advertising", jawaban)
            self.assertIn("Admin kami akan segera membalas", jawaban)


class WhatsAppWebhookIntegrationTestCase(TestCase):
    """
    Test suite untuk pipeline WhatsApp webhook (Evolution API, Baileys)
    memastikan integrasi wa_logic dan AI auto-reply berjalan sempurna.
    """

    def setUp(self):
        cache.clear()
        SystemConfig.objects.update_or_create(
            key='bisnis_nama', defaults={'value': 'Bintang Advertising'}
        )
        ProductPrice.objects.create(
            nama_produk='Banner Flexi 280gr',
            kategori='print_outdoor_per_m2',
            harga=25000,
            price_type='flat'
        )

    def tearDown(self):
        cache.clear()

    @patch("api.wa_logic.get_ai_client")
    def test_evolution_webhook_ai_auto_reply(self, mock_get_ai):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "Untuk spanduk ukuran 3x1 meter, pengerjaannya sekitar 1 hari kerja ya Kak Budi! 😊"
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_get_ai.return_value = mock_client

        # Daftarkan kontak terlebih dahulu agar tidak masuk alur tanya nama
        Contact.objects.create(nomor_wa="628123456789", nama="Budi")

        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {
                    "remoteJid": "628123456789@s.whatsapp.net",
                    "fromMe": False,
                    "id": "MSG_TEST_AI_001"
                },
                "pushName": "Budi",
                "message": {
                    "conversation": "Bisa tolong jelaskan bahan apa yang paling awet untuk outdoor?"
                }
            }
        }

        with patch.dict(os.environ, {
            "EVOLUTION_API_KEY": "BintangEvolutionSecKey2026",
            "KOBOI_MODEL": "gemini-2.5-pro"
        }), patch("api.whatsapp_client.whatsapp_client.send_text_message") as mock_send_text:
            mock_send_text.return_value = {"status": "sent"}

            response = self.client.post(
                "/api/webhook/evolution/",
                payload,
                content_type="application/json",
                HTTP_APIKEY="BintangEvolutionSecKey2026"
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data.get("status"), "processed")


class KatalogProdukTest(TestCase):
    """Daftar awal katalog & isi kategori — sumbernya kategori pricelist
    statis (SystemConfig 'wa_pricelist_kategori', sama dgn Trigger 2 &
    kalkulator), BUKAN dump ProductCategory/Product live. Bug ditemukan
    user 2026-08-15: 'ada produk apa saja' balas dump 27+ kategori database
    yang berantakan/campur kategori internal (mis. 'Bahan Baku') — sumber
    itu memang bukan utk konsumsi pelanggan."""

    def setUp(self):
        from api.management.commands.seed_wa_pricelist import KATEGORI_PRICELIST
        SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori',
            defaults={'value': json.dumps(KATEGORI_PRICELIST, ensure_ascii=False)},
        )
        # Data ProductCategory/Product live TETAP dibuat di sini utk
        # memastikan fungsi-fungsi ini benar2 TIDAK BACA dari situ lagi
        # (kalau ke-baca tanpa sengaja, assertNotIn di bawah bakal ketahuan).
        kategori = ProductCategory.objects.create(nama='DIGITAL PRINTING', urutan=1)
        Product.objects.create(
            nama='Kartu Nama Premium Live', kategori=kategori, price_type='flat',
            harga_jual_toko=50000, is_active=True,
        )

    def test_kata_kunci_katalog_pakai_kategori_pricelist(self):
        jawaban = cek_katalog_produk("ada produk apa saja", "Budi")
        self.assertIsNotNone(jawaban)
        self.assertIn("Banner / Spanduk / MMT", jawaban)
        self.assertIn("Kaos / Apparel", jawaban)
        # Kategori/produk live DB TIDAK boleh nyasar ke sini
        self.assertNotIn("DIGITAL PRINTING", jawaban)
        self.assertNotIn("Kartu Nama Premium Live", jawaban)

    def test_typo_pada_kata_kunci_katalog_tetap_kena(self):
        jawaban = cek_katalog_produk("jenis produk apa aja yg ada", "Budi")
        self.assertIsNotNone(jawaban)
        self.assertIn("Banner / Spanduk / MMT", jawaban)

    def test_pesan_tidak_terkait_katalog_mengembalikan_none(self):
        jawaban = cek_katalog_produk("bisa jadi hari ini?", "Budi")
        self.assertIsNone(jawaban)

    def test_tanpa_pricelist_diseed_mengembalikan_none(self):
        SystemConfig.objects.filter(key='wa_pricelist_kategori').delete()
        jawaban = cek_katalog_produk("ada produk apa saja", "Budi")
        self.assertIsNone(jawaban)

    def test_tiga_opsi_katalog_dipetakan_ke_alur_rule(self):
        self.assertEqual(BUTTON_ID_KE_TEKS['produk_order'], 'mau order')
        self.assertEqual(BUTTON_ID_KE_TEKS['produk_detail'], 'tanya detail katalog')
        self.assertEqual(BUTTON_ID_KE_TEKS['produk_lainnya'], 'pertanyaan lainnya')
        # 'mau order' tanpa nama produk kini menanyakan produk yang mana dulu
        # (bukan langsung kirim form kosong — instruksi user 2026-08-15).
        self.assertIn('produk yang mana', cek_rules_awal('mau order', '6281', 'Budi').lower())
        self.assertIn('ingin ditanyakan detailnya', cek_rules_awal('tanya detail katalog', '6281', 'Budi'))
        self.assertIn('pertanyaan lainnya', cek_rules_awal('pertanyaan lainnya', '6281', 'Budi'))

    def test_mau_order_tanpa_nama_produk_tanya_dulu_bukan_kirim_form(self):
        jawaban = cek_rules_awal('mau order', '6281', 'Budi')
        self.assertIsNotNone(jawaban)
        self.assertNotIn('FORM ORDER', jawaban)
        self.assertIn('produk yang mana', jawaban.lower())
        self.assertEqual(menunggu_pilihan_produk.get('6281'), '')

    def test_mau_order_sebut_nama_produk_langsung_info_kategori(self):
        # "mau order banner" -- produk sudah disebut di pesan yg sama, jangan
        # tanya "mana" lagi & jangan kirim form kosong, langsung info kategori
        # spt Trigger 2.
        jawaban = cek_rules_awal('mau order banner', '6281', 'Budi')
        self.assertIsNotNone(jawaban)
        self.assertNotIn('FORM ORDER', jawaban)
        self.assertIn('BANNER / SPANDUK / MMT', jawaban)
        self.assertEqual(menunggu_pilihan_produk.get('6281'), 'banner')

    def test_isi_kategori_pesan_pendek_sebut_nama_kategori(self):
        # Balasan singkat setelah tap tombol "Tanya Detail" (mis. cuma
        # ketik "Banner") harus langsung dijawab info pricelist kategori
        # itu, bukan cuma daftar nama kategori kosong lagi — dan BUKAN dari
        # Product live.
        jawaban = cek_isi_kategori("Banner", "Budi")
        self.assertIsNotNone(jawaban)
        self.assertIn("Banner 240", jawaban)
        self.assertNotIn("Kartu Nama Premium Live", jawaban)

    def test_isi_kategori_frasa_tanya_eksplisit(self):
        jawaban = cek_isi_kategori("kategori banner ada apa saja", "Budi")
        self.assertIsNotNone(jawaban)
        self.assertIn("Banner 240", jawaban)

    def test_isi_kategori_kalimat_panjang_tanpa_sinyal_tidak_kena(self):
        # Kalimat panjang yang kebetulan menyebut nama kategori tapi tidak
        # ada sinyal tanya isi kategori maupun pesan pendek — jangan
        # dipaksa jadi jawaban kategori (biar alur lain / AI yang tangani).
        jawaban = cek_isi_kategori(
            "saya kemarin sempat lihat banner punya kompetitor di jalan raya bagus juga ya modelnya",
            "Budi",
        )
        self.assertIsNone(jawaban)

    def test_isi_kategori_kategori_tidak_dikenal_mengembalikan_none(self):
        # 'workshop' bukan salah satu kategori pricelist statis (beda dari
        # dulu yang bisa cocok ke ProductCategory live apa saja).
        jawaban = cek_isi_kategori("workshop dong", "Budi")
        self.assertIsNone(jawaban)

    def test_mau_cetak_produk_tetap_kirim_form_bukan_isi_kategori(self):
        # Reorder cek_rules_awal (kategori dicek sebelum katalog umum, tapi
        # SESUDAH trigger order eksplisit) tidak boleh mengubah perilaku:
        # kategori yang TIDAK dikenal pricelist statis (mis. 'poster', sengaja
        # tidak ada di PRODUK_KE_KATEGORI_PRICELIST) tetap fallback ke form
        # order langsung, bukan macet.
        jawaban = cek_rules_awal("mau cetak poster", "6281", "Budi")
        self.assertIn("FORM ORDER", jawaban)

    def test_cek_rules_awal_sebut_nama_kategori_saja_jawab_isi_kategori(self):
        jawaban = cek_rules_awal("Banner", "6281", "Budi")
        self.assertIsNotNone(jawaban)
        self.assertIn("Banner 240", jawaban)


class PricelistTriggerTest(TestCase):
    """Trigger 2 cek_rules_awal (niat + nama produk) — begitu SystemConfig
    wa_pricelist_kategori sudah di-seed (lihat management/commands/
    seed_wa_pricelist.py), balasannya info kategori + tanya PRODUK MANA yang
    dipilih (BUKAN langsung tanya status desain / langsung form order —
    instruksi user 2026-08-15). Alur lengkap (pilih produk -> tanya desain ->
    form) diuji end-to-end di FormOrderValidasiIntegrationTest lewat webhook."""

    def setUp(self):
        cache.clear()
        SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori',
            defaults={'value': '{"banner": "Info harga banner referensi Rp18.000/m2"}'},
        )

    def tearDown(self):
        cache.clear()

    def test_get_pricelist_kategori_ambil_dari_systemconfig(self):
        self.assertIn('Rp18.000', get_pricelist_kategori('banner'))
        self.assertIsNone(get_pricelist_kategori('kategori_tidak_ada'))

    def test_mau_cetak_banner_dengan_pricelist_seeded_tanya_produk_mana(self):
        jawaban = cek_rules_awal("mau cetak banner", "628999", "Budi")
        self.assertIn('Rp18.000', jawaban)
        self.assertIn('produk', jawaban.lower())
        self.assertNotIn('FORM ORDER', jawaban)
        # State disimpan supaya jawaban pilihan produk pelanggan berikutnya
        # ditangkap webhook — BELUM langsung menunggu_status_desain.
        self.assertIn('628999', menunggu_pilihan_produk)
        self.assertNotIn('628999', menunggu_status_desain)

    def test_kategori_tidak_dikenal_pricelist_tetap_fallback_form(self):
        # 'poster' sengaja tidak ada di PRODUK_KE_KATEGORI_PRICELIST — harus
        # tetap kirim form langsung, tidak macet.
        jawaban = cek_rules_awal("mau cetak poster", "628998", "Budi")
        self.assertIn("FORM ORDER", jawaban)

    def test_pertanyaan_ketersediaan_tanpa_kata_mau_tetap_kena_trigger(self):
        # Bug ditemukan user 2026-08-15: "Ada cetak buku yasin ga kak?" tidak
        # kena Trigger 2 sama sekali (kata_niat sebelumnya cuma "mau
        # cetak"/"pengen cetak" dst, bukan pola pertanyaan ketersediaan) &
        # jatuh ke AI yang malah minta pelanggan ketik ulang.
        SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori',
            defaults={'value': '{"cetak_khusus": "Buku Yasin mulai Rp14rb/buku (min 30 buku)"}'},
        )
        jawaban = cek_rules_awal("Ada cetak buku yasin ga kak?", "628997", "Budi")
        self.assertIsNotNone(jawaban)
        self.assertIn("Rp14rb", jawaban)
        self.assertIn("produk yang mana", jawaban.lower())

    def test_cocok_status_desain(self):
        self.assertEqual(cocok_status_desain("belum ada kak"), 'belum')
        self.assertEqual(cocok_status_desain("sudah ada"), 'sudah')
        self.assertIsNone(cocok_status_desain("hmm gimana ya ini"))

    def test_cocok_konfirmasi_sesuai(self):
        self.assertTrue(cocok_konfirmasi_sesuai("sesuai"))
        self.assertTrue(cocok_konfirmasi_sesuai("Data sudah sesuai kak"))
        self.assertFalse(cocok_konfirmasi_sesuai("belum sesuai nih"))

    def test_ekstrak_produk_pilihan_pakai_ai_bersihkan_kalimat(self):
        # Pelanggan sering jawab pertanyaan "produk mana yang dipilih" pakai
        # kalimat penuh — kolom Jenis Produk di form tidak boleh kebanjiran
        # teks mentah (bug ditemukan user 2026-08-15).
        mock_client = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "Banner 240"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response

        with patch("api.wa_logic.get_ai_client", return_value=mock_client):
            hasil = ekstrak_produk_pilihan("mau yang banner 240 itu aja kak", "daftar harga banner")
        self.assertEqual(hasil, "Banner 240")

    def test_ekstrak_produk_pilihan_fallback_ke_pesan_asli_kalau_ai_tidak_ada(self):
        with patch("api.wa_logic.get_ai_client", return_value=None):
            hasil = ekstrak_produk_pilihan("Banner 340", "")
        self.assertEqual(hasil, "Banner 340")

    def test_ekstrak_produk_pilihan_fallback_kalau_ai_error(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = RuntimeError("timeout")
        with patch("api.wa_logic.get_ai_client", return_value=mock_client):
            hasil = ekstrak_produk_pilihan("mau roll banner yang besar", "")
        self.assertEqual(hasil, "mau roll banner yang besar")


class TombolMenuWebhookTest(TestCase):
    """Balasan tap tombol (buttonsResponseMessage) harus di-map ke padanan
    teks '1'/'2'/'3' yang sama dipakai jalur ketik manual."""

    def setUp(self):
        cache.clear()
        Contact.objects.create(nomor_wa="628111000111", nama="Rian")
        # Lewati gerbang "AI jawab pesan pertama sesi" (T-721,
        # api/views/evolution_ai.py) supaya test ini benar-benar menguji
        # jalur rule/tombol, bukan AI.
        cache.set("wa_ai_respons_awal_628111000111", True, timeout=3600)

    def tearDown(self):
        cache.clear()

    def test_button_reply_dipetakan_ke_menu_order(self):
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"remoteJid": "628111000111@s.whatsapp.net", "fromMe": False, "id": "MSG_BTN_001"},
                "pushName": "Rian",
                "message": {
                    "buttonsResponseMessage": {"selectedButtonId": "menu_order"}
                },
            },
        }
        with patch.dict(os.environ, {"EVOLUTION_API_KEY": "TestKey123"}), \
             patch("api.whatsapp_client.whatsapp_client.send_text_message") as mock_send, \
             patch("api.whatsapp_client.whatsapp_client.send_presence", return_value=None), \
             patch("time.sleep", return_value=None):
            mock_send.return_value = {"status": "sent"}
            response = self.client.post(
                "/api/webhook/evolution/", payload, content_type="application/json",
                HTTP_APIKEY="TestKey123",
            )
            import threading
            for t in threading.enumerate():
                if t is not threading.current_thread() and t.daemon:
                    t.join(timeout=5)
        self.assertEqual(response.status_code, 200)
        # Tap tombol Order (id 'menu_order') harus di-map ke padanan teks '1'
        # dan memicu balasan FORM ORDER, sama persis dengan ketik "1" manual.
        self.assertTrue(mock_send.called)
        teks_terkirim = mock_send.call_args[0][1]
        self.assertIn("FORM ORDER", teks_terkirim)


class BahanFinishingHelperTest(TestCase):
    """Helper form order: validasi Bahan/Material & Finishing HANYA untuk
    produk yang match katalog nyata & memang butuh field itu."""

    def setUp(self):
        self.produk_butuh = Product.objects.create(
            nama='Banner Flexi', price_type='per_m2', harga_jual_toko=25000,
            is_active=True, butuh_bahan=True, butuh_finishing=True,
        )
        self.produk_tidak_butuh = Product.objects.create(
            nama='Cetak Foto 4R', price_type='flat', harga_jual_toko=5000,
            is_active=True, butuh_bahan=False, butuh_finishing=False,
        )

    def test_produk_match_dan_butuh_tapi_kosong(self):
        kurang = cek_bahan_finishing_kurang('Banner Flexi', '', '')
        self.assertEqual(set(kurang), {'Bahan/Material', 'Finishing'})

    def test_produk_match_dan_field_terisi_aman(self):
        kurang = cek_bahan_finishing_kurang('Banner Flexi', 'Flexi Korea', 'Mata Ayam')
        self.assertEqual(kurang, [])

    def test_produk_tidak_butuh_field_diabaikan(self):
        kurang = cek_bahan_finishing_kurang('Cetak Foto 4R', '', '')
        self.assertEqual(kurang, [])

    def test_produk_tidak_dikenal_tidak_diblokir(self):
        # Nama bebas yang tidak match katalog manapun -> tidak menebak, tidak blokir.
        kurang = cek_bahan_finishing_kurang('Produk Antah Berantah XYZ', '', '')
        self.assertEqual(kurang, [])

    def test_cek_bahan_terlaris_data_asli(self):
        order = Order.objects.create(id='ORD-TEST-BHN1', nomor_wa='628111', nama='Rian')
        OrderItem.objects.create(order=order, jenis_produk='Banner Flexi', bahan='Flexi Korea', qty=1)
        OrderItem.objects.create(order=order, jenis_produk='Banner Flexi', bahan='Flexi Korea', qty=1)
        OrderItem.objects.create(order=order, jenis_produk='Banner Flexi', bahan='Vinyl', qty=1)
        terlaris = cek_bahan_terlaris('Banner Flexi')
        self.assertEqual(terlaris[0], 'Flexi Korea')
        self.assertIn('Vinyl', terlaris)

    def test_cek_bahan_terlaris_kosong_kalau_belum_ada_histori(self):
        self.assertEqual(cek_bahan_terlaris('Produk Baru Belum Pernah Order'), [])

    def test_format_pesan_field_kurang_sertakan_saran_bahan(self):
        order = Order.objects.create(id='ORD-TEST-BHN2', nomor_wa='628111', nama='Rian')
        OrderItem.objects.create(order=order, jenis_produk='Banner Flexi', bahan='Flexi Korea', qty=1)
        pesan = format_pesan_field_kurang([(1, 'Banner Flexi', ['Bahan/Material', 'Finishing'])])
        self.assertIn('Item 1 (Banner Flexi)', pesan)
        self.assertIn('Bahan/Material, Finishing', pesan)
        self.assertIn('Flexi Korea', pesan)  # saran bahan terlaris

    def test_cek_finishing_terlaris_data_asli(self):
        # Finishing tersimpan di OrderItem.detail (JSON), bukan kolom
        # terpisah spt bahan — lihat _ambil_finishing() di
        # services/order_invoice_whatsapp.py.
        order = Order.objects.create(id='ORD-TEST-FIN1', nomor_wa='628111', nama='Rian')
        OrderItem.objects.create(
            order=order, jenis_produk='Banner Flexi', qty=1,
            detail=[{"key": "Finishing", "value": "Mata Ayam"}],
        )
        OrderItem.objects.create(
            order=order, jenis_produk='Banner Flexi', qty=1,
            detail=[{"key": "Finishing", "value": "Mata Ayam"}],
        )
        OrderItem.objects.create(
            order=order, jenis_produk='Banner Flexi', qty=1,
            detail=[{"key": "Finishing", "value": "Lipat"}],
        )
        terlaris = cek_finishing_terlaris('Banner Flexi')
        self.assertEqual(terlaris[0], 'Mata Ayam')
        self.assertIn('Lipat', terlaris)

    def test_cek_finishing_terlaris_kosong_kalau_belum_ada_histori(self):
        self.assertEqual(cek_finishing_terlaris('Produk Baru Belum Pernah Order'), [])

    def test_format_pesan_field_kurang_sertakan_saran_finishing(self):
        order = Order.objects.create(id='ORD-TEST-FIN2', nomor_wa='628111', nama='Rian')
        OrderItem.objects.create(
            order=order, jenis_produk='Banner Flexi', qty=1,
            detail=[{"key": "Finishing", "value": "Mata Ayam"}],
        )
        pesan = format_pesan_field_kurang([(1, 'Banner Flexi', ['Finishing'])])
        self.assertIn('Mata Ayam', pesan)


class FormOrderValidasiIntegrationTest(TestCase):
    """Kirim form order lengkap via webhook Evolution — pastikan validasi
    Bahan/Finishing benar-benar menahan penyimpanan Order kalau kurang, dan
    tidak menghalangi produk yang tidak butuh field itu."""

    def setUp(self):
        cache.clear()
        Contact.objects.create(nomor_wa="628222000222", nama="Sari")
        Product.objects.create(
            nama='Banner Flexi', price_type='per_m2', harga_jual_toko=25000,
            is_active=True, butuh_bahan=True, butuh_finishing=True,
        )
        # Lewati gerbang AI-jawab-pesan-pertama (T-721) — test ini menguji
        # jalur form/validasi, bukan AI.
        cache.set("wa_ai_respons_awal_628222000222", True, timeout=3600)

    def tearDown(self):
        cache.clear()

    def _kirim_form(self, isi_form, msg_id=None):
        # msg_id WAJIB unik antar panggilan dalam 1 test kalau mengirim >1
        # pesan (mis. form lalu 'sesuai') — ada anti-duplikasi inbound
        # berbasis message id di webhook (lihat views/whatsapp.py "Inbound
        # Deduplication"), pesan kedua dengan id sama akan diabaikan diam-diam.
        import uuid as _uuid
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"remoteJid": "628222000222@s.whatsapp.net", "fromMe": False, "id": msg_id or f"MSG_{_uuid.uuid4().hex[:8]}"},
                "pushName": "Sari",
                "message": {"conversation": isi_form},
            },
        }
        with patch.dict(os.environ, {"EVOLUTION_API_KEY": "TestKey123"}), \
             patch("api.whatsapp_client.whatsapp_client.send_text_message") as mock_send:
            mock_send.return_value = {"status": "sent"}
            return self.client.post(
                "/api/webhook/evolution/", payload, content_type="application/json",
                HTTP_APIKEY="TestKey123",
            )

    def test_form_kurang_bahan_finishing_tidak_tersimpan(self):
        form = (
            "Nama Pemesan: Sari\n"
            "No. WA: 628222000222\n"
            "Item 1\n"
            "Jenis Produk: Banner Flexi\n"
            "Jumlah: 2\n"
            "Ukuran: 2x3\n"
            "Bahan/Material: \n"
            "Finishing: \n"
        )
        self._kirim_form(form)
        self.assertFalse(Order.objects.filter(nomor_wa="628222000222").exists())

    def test_form_lengkap_menunggu_konfirmasi_lalu_tersimpan(self):
        """Form order lengkap sekarang direkap dulu & TIDAK langsung membuat
        Order — pelanggan wajib balas 'sesuai' dulu (gerbang konfirmasi,
        instruksi user 2026-08-15)."""
        form = (
            "Nama Pemesan: Sari\n"
            "No. WA: 628222000222\n"
            "Item 1\n"
            "Jenis Produk: Banner Flexi\n"
            "Jumlah: 2\n"
            "Ukuran: 2x3\n"
            "Bahan/Material: Flexi Korea\n"
            "Finishing: Mata Ayam\n"
        )
        self._kirim_form(form)
        self.assertFalse(Order.objects.filter(nomor_wa="628222000222").exists())

        self._kirim_form("sesuai")
        self.assertTrue(Order.objects.filter(nomor_wa="628222000222").exists())


class HumanTakeoverAutoPauseTest(TestCase):
    """Deteksi otomatis 'staff balas manual lewat WA langsung' (fromMe=True
    di webhook Evolution) HARUS cuma pause bot 15 menit (cache), BUKAN
    menyalakan Contact.handover_to_staff (flag DB permanen) — itu direservasi
    khusus toggle manual 'Ambil Alih Chat' di dashboard. Bug ditemukan user
    2026-08-15: sebelum diperbaiki, sekali staff balas manual, flag DB ikut
    menyala & bot mati SELAMANYA sampai ada yang matiin manual, walau cache
    15 menitnya sendiri sudah lama kadaluarsa — kasir lupa nyalain lagi =
    bot mati permanen tanpa disadari."""

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_from_me_hanya_set_cache_15_menit_bukan_flag_db_permanen(self):
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"remoteJid": "628444000444@s.whatsapp.net", "fromMe": True, "id": "MSG_STAFF_001"},
                "message": {"conversation": "Halo kak, ini admin ya"},
            },
        }
        with patch.dict(os.environ, {"EVOLUTION_API_KEY": "TestKey123"}):
            response = self.client.post(
                "/api/webhook/evolution/", payload, content_type="application/json",
                HTTP_APIKEY="TestKey123",
            )
        self.assertEqual(response.status_code, 200, response.content)

        self.assertTrue(cache.get("wa_handover_628444000444"))
        contact = Contact.objects.get(nomor_wa="628444000444")
        self.assertFalse(contact.handover_to_staff)


class PilihanProdukSebelumFormWebhookTest(TestCase):
    """Alur lengkap end-to-end lewat webhook Evolution (instruksi user
    2026-08-15): sebut niat+produk -> info kategori & tanya PRODUK MANA ->
    pelanggan sebutkan produk spesifik -> bot tanya status desain utk produk
    itu -> form order dikirim dengan kolom Jenis Produk SUDAH TERISI nama
    produk yang dipilih pelanggan."""

    def setUp(self):
        cache.clear()
        Contact.objects.create(nomor_wa="628333000333", nama="Dian")
        # Lewati gerbang "AI jawab pesan pertama sesi" (T-721,
        # api/views/evolution_ai.py — beda dari cek_rules_awal, ini
        # intercept SEMUA pesan pertama tanpa peduli isinya) supaya test ini
        # benar-benar menguji alur pilih-produk, bukan AI.
        cache.set("wa_ai_respons_awal_628333000333", True, timeout=3600)
        SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori',
            defaults={'value': '{"banner": "Daftar harga: Banner 340 Rp35.000/m2, Roll Banner Rp250rb"}'},
        )
        from api.management.commands.seed_wa_pricelist import KALKULATOR_BAHAN
        SystemConfig.objects.update_or_create(
            key='wa_kalkulator_bahan',
            defaults={'value': json.dumps(KALKULATOR_BAHAN, ensure_ascii=False)},
        )

    def tearDown(self):
        cache.clear()

    def _kirim(self, teks, msg_id=None):
        # Balasan bot dikirim ASYNC lewat thread terpisah (_kirim_balas_async,
        # ada time.sleep simulasi mengetik + send_presence) — bukan lewat
        # body response webhook. send_presence JUGA di-mock (bukan cuma
        # send_text_message) supaya thread tidak nyangkut nunggu network
        # nyata sebelum sempat di-join, yang bisa bikin balasannya baru
        # kekirim belakangan & "nyasar" ke test lain yang jalan setelahnya.
        import uuid as _uuid
        import threading
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"remoteJid": "628333000333@s.whatsapp.net", "fromMe": False, "id": msg_id or f"MSG_{_uuid.uuid4().hex[:8]}"},
                "pushName": "Dian",
                "message": {"conversation": teks},
            },
        }
        with patch.dict(os.environ, {"EVOLUTION_API_KEY": "TestKey123"}), \
             patch("api.whatsapp_client.whatsapp_client.send_text_message") as mock_send, \
             patch("api.whatsapp_client.whatsapp_client.send_presence", return_value=None), \
             patch("time.sleep", return_value=None):
            mock_send.return_value = {"status": "sent"}
            self.client.post(
                "/api/webhook/evolution/", payload, content_type="application/json",
                HTTP_APIKEY="TestKey123",
            )
            for t in threading.enumerate():
                if t is not threading.current_thread() and t.daemon:
                    t.join(timeout=5)
            if mock_send.call_args:
                return mock_send.call_args[0][1]
            return None

    def test_pilih_produk_lalu_status_desain_lalu_form_terisi(self):
        # Prioritaskan cek STATE cache (sinkron, selalu bisa diandalkan)
        # dibanding isi pesan yang dikirim ASYNC (lihat catatan di _kirim).
        self._kirim("mau cetak banner")
        self.assertIn('628333000333', menunggu_pilihan_produk)

        self._kirim("Banner 340")
        self.assertNotIn('628333000333', menunggu_pilihan_produk)
        self.assertEqual(menunggu_status_desain.get('628333000333'), 'Banner 340')

        jawaban3 = self._kirim("sudah ada")
        self.assertIn('FORM ORDER', jawaban3)
        self.assertIn('Jenis Produk  : Banner 340', jawaban3)
        self.assertNotIn('628333000333', menunggu_status_desain)

    def test_form_gabungan_order_dan_desain_belum_ada_tidak_error_id_pesanan(self):
        # Bug ditemukan user 2026-08-15 lewat log VPS: waktu status desain
        # dijawab "belum ada", bot kirim form order + FORM KONSEP DESAIN
        # GABUNGAN dalam 1 pesan (order belum dibuat, jadi belum ada ID
        # Pesanan). Pelanggan copy-isi-kirim balik pesan itu apa adanya —
        # sebelumnya ini disangka pengiriman FORM KONSEP DESAIN utk order yang
        # SUDAH ADA (krn ada kata "tulisan yang dimuat"/"dominan warna"),
        # gagal dgn "ID Pesanan tidak ditemukan". Sekarang harus lanjut ke
        # rekap order biasa (order belum dibuat sampai pelanggan ketik
        # 'sesuai'), bukan error.
        self._kirim("mau cetak banner")
        self._kirim("Banner 340")
        jawaban_form = self._kirim("belum ada")
        self.assertIn('FORM KONSEP DESAIN', jawaban_form)

        form_terisi = (
            "📋 *FORM ORDER - Star Photo & Advertising*\n\n"
            "👤 *Data Pemesan*\n"
            "- Nama    : Dian\n"
            "- No. WA  : 628333000333\n\n"
            "📦 *Item 1*\n"
            "- Jenis Produk  : Banner 340\n"
            "- Jumlah        : 2\n"
            "- Ukuran        : 2x3\n"
            "- Bahan/Material: Flexi Korea\n"
            "- Finishing     : Mata Ayam\n"
            "- File Desain   : belum ada\n"
            "- Keterangan    : -\n\n"
            "📋 *FORM KONSEP DESAIN*\n"
            "- Tulisan yang dimuat: Promo Diskon 50%\n"
            "- Dominan Warna: Merah\n"
            "- Logo / Foto (Ada/Tidak): Ada\n"
            "- Bentuk (Vertikal / Horizontal): Horizontal\n"
            "- Request Tambahan: -\n"
        )
        jawaban_rekap = self._kirim(form_terisi)
        self.assertIsNotNone(jawaban_rekap)
        self.assertNotIn("ID Pesanan tidak ditemukan", jawaban_rekap)
        self.assertNotIn("gagal memproses konsep desain", jawaban_rekap.lower())
        self.assertIn("sesuai", jawaban_rekap.lower())
        self.assertIn("Banner 340", jawaban_rekap)

        pending = pending_order_form.get('628333000333')
        self.assertIsNotNone(pending)
        keterangan_item1 = pending['items'][0]['keterangan']
        self.assertIn("Promo Diskon 50%", keterangan_item1)
        self.assertIn("Merah", keterangan_item1)

    def test_pertanyaan_harga_di_tengah_status_desain_tidak_langsung_kirim_form(self):
        # Bug ditemukan user 2026-08-15: begitu bot lagi "menunggu status
        # desain", pesan APAPUN berikutnya kepaksa dianggap jawaban
        # sudah/belum desain — kalau pelanggan malah nanya harga produk lain
        # dgn ukuran, itu ke-anggap jawaban tidak jelas & bot LANGSUNG kirim
        # form (salah). Sekarang harus dicek dulu apakah itu pertanyaan
        # harga (jalur deterministik cek_harga), dijawab itu, dan STATE
        # menunggu_status_desain TETAP tersimpan biar bisa lanjut nanti.
        self._kirim("mau cetak banner")
        self._kirim("Banner 340")
        self.assertEqual(menunggu_status_desain.get('628333000333'), 'Banner 340')

        jawaban = self._kirim("kalo banner 240 ukuran 3x4m berapa ya kak?")
        self.assertIn('ESTIMASI TOTAL BIAYA - BANNER/SPANDUK', jawaban)
        self.assertNotIn('FORM ORDER', jawaban)
        # State TETAP tersimpan — belum dianggap terjawab
        self.assertEqual(menunggu_status_desain.get('628333000333'), 'Banner 340')

        # Lanjutkan jawab status desain yang sebenarnya -> baru form keluar
        jawaban_lanjut = self._kirim("belum ada")
        self.assertIn('FORM KONSEP DESAIN', jawaban_lanjut)
        self.assertNotIn('628333000333', menunggu_status_desain)

    def test_pertanyaan_harga_di_tengah_pilihan_produk_tidak_dipaksa_jadi_nama_produk(self):
        # Padanan bug yang sama tapi di step SEBELUMNYA (menunggu_pilihan_produk):
        # pelanggan nanya harga produk lain dulu sebelum benar-benar milih.
        self._kirim("mau cetak banner")
        self.assertIn('628333000333', menunggu_pilihan_produk)

        jawaban = self._kirim("banner 340 ukuran 2x3m berapa kak?")
        self.assertIn('ESTIMASI TOTAL BIAYA - BANNER/SPANDUK', jawaban)
        # Masih menunggu pilihan produk, belum dianggap sudah pilih
        self.assertIn('628333000333', menunggu_pilihan_produk)
        self.assertNotIn('628333000333', menunggu_status_desain)

    def test_konfirmasi_niat_tanpa_nama_produk_tidak_dipaksa_jadi_nama_produk(self):
        # Bug ditemukan user 2026-08-15 lewat log percakapan VPS: setelah
        # dikasih info kategori & ditanya "produk yang mana", pelanggan
        # balas "Okey saya mau order" (cuma konfirmasi niat, bukan nama
        # produk) — sebelumnya teks itu KEPAKAI APA ADANYA sbg nama produk
        # (form order akhirnya Jenis Produk: "Okey saya mau order"). Sekarang
        # harus ditanya lagi lebih sopan, state TETAP menunggu.
        self._kirim("mau cetak banner")
        self.assertIn('628333000333', menunggu_pilihan_produk)

        jawaban = self._kirim("Okey saya mau order")
        self.assertIn('produk yang mana', jawaban.lower())
        self.assertIn('628333000333', menunggu_pilihan_produk)
        self.assertNotIn('628333000333', menunggu_status_desain)

        # Lanjutkan dgn nama produk sebenarnya -> baru lanjut normal
        self._kirim("Banner 340")
        self.assertNotIn('628333000333', menunggu_pilihan_produk)
        self.assertEqual(menunggu_status_desain.get('628333000333'), 'Banner 340')

    def test_konfirmasi_singkat_saja_juga_tidak_dipaksa_jadi_nama_produk(self):
        self._kirim("mau cetak banner")
        jawaban = self._kirim("oke")
        self.assertIn('produk yang mana', jawaban.lower())
        self.assertIn('628333000333', menunggu_pilihan_produk)


class FormPembatalanTest(TestCase):
    """Form pembatalan: order belum selesai diproses OTOMATIS (user
    mengizinkan eksplisit); order selesai TIDAK PERNAH diputuskan bot —
    cuma dicatat + admin dinotifikasi."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner_wa_test', password='pw12345', role='owner', is_active=True,
        )

    def test_order_belum_selesai_dibatalkan_otomatis(self):
        order = Order.objects.create(id='ORD-CANCEL-1', nomor_wa='628333', nama='Dedi', status_global='review')
        balasan, admin_notify = proses_form_pembatalan(
            "ID Pesanan: ORD-CANCEL-1\nAlasan Pembatalan: Salah ukuran", "Dedi",
        )
        order.refresh_from_db()
        self.assertEqual(order.status_global, 'batal')
        self.assertIn('sudah kami batalkan', balasan)
        self.assertIsNone(admin_notify)

    def test_order_selesai_tidak_diputuskan_bot_cuma_notify_admin(self):
        order = Order.objects.create(id='ORD-CANCEL-2', nomor_wa='628333', nama='Dedi', status_global='selesai')
        balasan, admin_notify = proses_form_pembatalan(
            "ID Pesanan: ORD-CANCEL-2\nAlasan Pembatalan: Barang rusak", "Dedi",
        )
        order.refresh_from_db()
        # Status TIDAK berubah — bot tidak pernah memutuskan refund.
        self.assertEqual(order.status_global, 'selesai')
        self.assertIn('teruskan', balasan.lower())
        self.assertIsNotNone(admin_notify)
        self.assertIn('ORD-CANCEL-2', admin_notify)
        self.assertTrue(
            order.activity_logs.filter(tindakan='REFUND_REQUEST').exists()
        )

    def test_order_sudah_batal_tidak_diproses_ulang(self):
        Order.objects.create(id='ORD-CANCEL-3', nomor_wa='628333', nama='Dedi', status_global='batal')
        balasan, admin_notify = proses_form_pembatalan(
            "ID Pesanan: ORD-CANCEL-3\nAlasan Pembatalan: Coba lagi", "Dedi",
        )
        self.assertIn('sudah berstatus dibatalkan', balasan)
        self.assertIsNone(admin_notify)

    def test_order_tidak_ditemukan(self):
        balasan, admin_notify = proses_form_pembatalan(
            "ID Pesanan: ORD-TIDAK-ADA\nAlasan Pembatalan: Test", "Dedi",
        )
        self.assertIn('tidak ditemukan', balasan)
        self.assertIsNone(admin_notify)

    def test_cek_rules_awal_kata_kunci_batalkan_kirim_form(self):
        jawaban = cek_rules_awal("mau batalkan pesanan", "628333", "Dedi")
        self.assertIn("FORM PEMBATALAN", jawaban)


class BatalkanOrderServiceTest(TestCase):
    """order_actions.batalkan_order() dipakai bareng dashboard & bot WA —
    pastikan tetap menolak order yang sudah batal/selesai."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner_batalkan_test', password='pw12345', role='owner',
        )

    def test_tolak_order_sudah_batal(self):
        order = Order.objects.create(id='ORD-SVC-1', nomor_wa='628444', nama='X', status_global='batal')
        with self.assertRaises(BatalkanOrderError):
            batalkan_order(order, actor=self.owner, alasan='test')

    def test_tolak_order_sudah_selesai(self):
        order = Order.objects.create(id='ORD-SVC-2', nomor_wa='628444', nama='X', status_global='selesai')
        with self.assertRaises(BatalkanOrderError):
            batalkan_order(order, actor=self.owner, alasan='test')

    def test_berhasil_batalkan_order_review(self):
        order = Order.objects.create(id='ORD-SVC-3', nomor_wa='628444', nama='X', status_global='review')
        hasil = batalkan_order(order, actor=self.owner, alasan='test batal')
        self.assertEqual(hasil.status_global, 'batal')
        self.assertTrue(
            hasil.activity_logs.filter(tindakan='CANCEL').exists()
        )


class RekomendasiProdukTest(TestCase):
    """Produk terlaris & rekomendasi sesuai budget — keduanya data ASLI
    (histori Order / harga Product), bukan taksiran."""

    def setUp(self):
        Product.objects.create(
            nama='Kartu Nama Premium', price_type='flat', harga_jual_toko=50000, is_active=True,
        )
        Product.objects.create(
            nama='Banner Flexi', price_type='per_m2', harga_jual_toko=25000, is_active=True,
        )
        Product.objects.create(
            nama='Stiker Vinyl', price_type='flat', harga_jual_toko=150000, is_active=True,
        )

    def test_cek_produk_terlaris_data_asli(self):
        order = Order.objects.create(id='ORD-REK-1', nomor_wa='6285', nama='X')
        for _ in range(3):
            OrderItem.objects.create(order=order, jenis_produk='Kartu Nama Premium', qty=1)
        OrderItem.objects.create(order=order, jenis_produk='Stiker Vinyl', qty=1)
        order_batal = Order.objects.create(id='ORD-REK-2', nomor_wa='6285', nama='X', status_global='batal')
        OrderItem.objects.create(order=order_batal, jenis_produk='Kartu Nama Premium', qty=10)

        terlaris = cek_produk_terlaris()
        self.assertEqual(terlaris[0], ('Kartu Nama Premium', 3))  # order batal tidak ikut dihitung

    def test_jawab_produk_terlaris_kosong_kalau_belum_ada_data(self):
        jawaban = jawab_produk_terlaris('Budi')
        self.assertIn('belum punya cukup data', jawaban)

    def test_parse_budget_berbagai_format(self):
        self.assertEqual(_parse_budget('budget saya 500rb'), 500000)
        self.assertEqual(_parse_budget('bujet 1 juta'), 1000000)
        self.assertEqual(_parse_budget('budget 250.000'), 250)  # tanpa satuan rb/jt = apa adanya
        self.assertIsNone(_parse_budget('halo apa kabar'))

    def test_jawab_produk_sesuai_budget_filter_flat_saja(self):
        jawaban = jawab_produk_sesuai_budget('budget saya 100rb', 'Budi')
        self.assertIn('Kartu Nama Premium', jawaban)
        self.assertNotIn('Banner Flexi', jawaban)  # per_m2, bukan harga total -> tidak dibandingkan
        self.assertNotIn('Stiker Vinyl', jawaban)  # 150rb > budget 100rb

    def test_jawab_produk_sesuai_budget_tidak_ada_yang_cocok(self):
        jawaban = jawab_produk_sesuai_budget('budget saya 5rb', 'Budi')
        self.assertIn('belum ada produk harga tetap yang pas', jawaban)

    def test_jawab_produk_sesuai_budget_tanpa_kata_budget_none(self):
        self.assertIsNone(jawab_produk_sesuai_budget('halo apa kabar', 'Budi'))

    def test_cek_rules_awal_kata_kunci_terlaris(self):
        jawaban = cek_rules_awal('produk terlaris apa', '628999', 'Budi')
        self.assertIn('belum punya cukup data', jawaban)
