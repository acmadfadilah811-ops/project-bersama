import json
import os
from unittest.mock import patch, MagicMock
from django.test import TestCase, TransactionTestCase, Client
from django.core.cache import cache

from api.models import (
    Contact, CustomUser, FAQ, Order, OrderItem, SystemConfig,
)
from api.wa_logic import (
    get_business_name,
    get_ai_client,
    ekstrak_nama_dari_pesan,
    get_system_prompt,
    get_memori_percakapan,
    simpan_ke_memori,
    format_tracking,
    proses_kirim_desain,
    BUTTON_ID_KE_TEKS,
    cek_bahan_finishing_kurang,
    cek_bahan_terlaris,
    cek_finishing_terlaris,
    format_pesan_field_kurang,
    proses_form_pembatalan,
    cek_produk_terlaris,
    cocok_konfirmasi_sesuai,
    pending_order_form,
    proses_dengan_ai_agent,
    MAKS_PUTARAN_TOOL,
)
from api.services.order_actions import batalkan_order, BatalkanOrderError
from api.services.wa_ai_tools import (
    TOOL_SCHEMAS,
    TOOL_FUNCTIONS,
    jalankan_tool,
    daftar_kategori_produk,
    cari_produk,
    cek_status_pesanan,
    produk_terlaris,
    produk_sesuai_budget,
    cek_faq,
    ambil_template_form_order,
    buat_pesanan,
    eskalasi_admin,
)
from api.product_models import Product
from django.contrib.auth import get_user_model

User = get_user_model()


def _mock_tool_call(id_, nama_tool, argumen_dict):
    tc = MagicMock()
    tc.id = id_
    tc.function.name = nama_tool
    tc.function.arguments = json.dumps(argumen_dict)
    return tc


def _mock_response(content=None, tool_calls=None):
    msg = MagicMock()
    msg.content = content
    msg.tool_calls = tool_calls
    resp = MagicMock()
    resp.choices = [MagicMock(message=msg)]
    return resp


class WALogicUnitTestCase(TestCase):
    """Utilitas dasar wa_logic.py yang TIDAK terkait sistem klasifikasi/
    keyword lama (dihapus total 2026-09-10, lihat proses_dengan_ai_agent)."""

    def setUp(self):
        cache.clear()
        SystemConfig.objects.update_or_create(
            key='bisnis_nama', defaults={'value': 'Bintang Advertising'}
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

    def test_get_system_prompt_mewajibkan_tools_bukan_form_manual(self):
        prompt = get_system_prompt("Andi")
        self.assertIn("Andi", prompt)
        self.assertIn("Bintang Advertising", prompt)
        # (2026-09-10) AI sekarang WAJIB pakai tools, bukan diarahkan minta
        # pelanggan ketik ulang / isi form manual duluan.
        self.assertIn("cari_produk", prompt)
        self.assertIn("hitung_harga_produk", prompt)
        self.assertIn("buat_pesanan", prompt)
        self.assertIn("eskalasi_admin", prompt)

    def test_get_system_prompt_dan_memori_percakapan(self):
        mem = get_memori_percakapan("62812345678", "Andi")
        self.assertIsInstance(mem, list)
        self.assertEqual(mem[0]["role"], "system")

        simpan_ke_memori("62812345678", "user", "Halo admin", "Andi")
        mem_updated = get_memori_percakapan("62812345678", "Andi")
        self.assertEqual(len(mem_updated), 2)
        self.assertEqual(mem_updated[1]["role"], "user")
        self.assertEqual(mem_updated[1]["content"], "Halo admin")

    def test_get_system_prompt_tidak_menyuruh_tolak_sapaan(self):
        # Regresi (2026-09-10): begitu klasifikasi 'sapaan' AI-native dihapus
        # (diganti proses_dengan_ai_agent), rule "BATASAN RANAH" di system
        # prompt DEFAULT ternyata masih menyuruh AI menolak "menyapa secara
        # umum di luar bisnis" -- persis bug produksi asal ("malam"/"hay"
        # dibalas pesan penolakan) muncul lagi, kali ini dari prompt itu
        # sendiri, bukan classifier. Dites nyata lewat KoboiLLM live sebelum
        # fix ini (lihat catatan sesi) -- sekarang harus eksplisit
        # mengecualikan sapaan dari larangan topik di luar bisnis.
        prompt = get_system_prompt("Rian")
        self.assertNotIn("menyapa secara umum di luar bisnis", prompt)
        self.assertIn("SAPAAN", prompt)
        self.assertIn("BUKAN topik", prompt)

    def test_button_id_ke_teks_masih_ada_utk_tombol_lama(self):
        # Bot tidak lagi PERNAH mengirim tombol, tapi mapping ini tetap
        # dipertahankan supaya tap dari tombol lama (sisa sesi sebelum
        # rebuild) tidak nyasar -- lihat views/whatsapp.py EvolutionWebhookView.
        self.assertEqual(BUTTON_ID_KE_TEKS['menu_order'], '1')
        self.assertEqual(BUTTON_ID_KE_TEKS['produk_order'], 'mau order')

    def test_cocok_konfirmasi_sesuai(self):
        # Gerbang konfirmasi sebelum Order benar-benar dibuat (dipertahankan
        # apa adanya, dipakai baik jalur form-teks manual maupun tool
        # buat_pesanan AI agent -- lihat pending_order_form).
        self.assertTrue(cocok_konfirmasi_sesuai("sesuai"))
        self.assertTrue(cocok_konfirmasi_sesuai("Data sudah sesuai kak"))
        self.assertFalse(cocok_konfirmasi_sesuai("belum sesuai nih"))


class AiAgentToolLoopTest(TestCase):
    """proses_dengan_ai_agent() -- satu-satunya "otak" bot sekarang
    (2026-09-10, instruksi user: hapus total klasifikasi/keyword lama, AI
    bertindak langsung lewat tools). Satu-satunya jalur gagal adalah
    _fallback_keras (pesan sopan + eskalasi admin), TANPA jaring pengaman
    keyword di baliknya."""

    def setUp(self):
        cache.clear()
        SystemConfig.objects.update_or_create(
            key='bisnis_nama', defaults={'value': 'Bintang Advertising'}
        )

    def tearDown(self):
        cache.clear()

    def test_jawaban_langsung_tanpa_tool_call(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_response(
            content="Halo Kak! Ada yang bisa kami bantu? 😊",
        )
        with patch("api.wa_logic.get_ai_client", return_value=mock_client):
            jawaban = proses_dengan_ai_agent("6281111111", "Budi", pesan_asli="halo")
        self.assertEqual(jawaban, "Halo Kak! Ada yang bisa kami bantu? 😊")
        mock_client.chat.completions.create.assert_called_once()
        call_kwargs = mock_client.chat.completions.create.call_args.kwargs
        self.assertEqual(call_kwargs.get("tools"), TOOL_SCHEMAS)
        self.assertEqual(call_kwargs.get("tool_choice"), "auto")

    def test_satu_putaran_tool_call_lalu_jawaban_final(self):
        tc = _mock_tool_call("call_1", "cek_faq", {"pertanyaan": "jam buka"})
        resp_tool = _mock_response(content=None, tool_calls=[tc])
        resp_final = _mock_response(content="Buka Senin-Sabtu jam 8-5 ya Kak 😊")

        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = [resp_tool, resp_final]
        mock_jalankan_tool = MagicMock(return_value={'ok': True, 'jawaban': 'Senin-Sabtu 08:00-17:00'})

        with patch("api.wa_logic.get_ai_client", return_value=mock_client), \
             patch("api.services.wa_ai_tools.jalankan_tool", mock_jalankan_tool):
            jawaban = proses_dengan_ai_agent("6281111111", "Budi", pesan_asli="jam buka jam berapa ya")

        self.assertEqual(jawaban, "Buka Senin-Sabtu jam 8-5 ya Kak 😊")
        mock_jalankan_tool.assert_called_once_with(
            "cek_faq", {"pertanyaan": "jam buka"},
            konteks={"nomor": "6281111111", "nama_pelanggan": "Budi", "pesan_asli": "jam buka jam berapa ya"},
        )
        self.assertEqual(mock_client.chat.completions.create.call_count, 2)

    def test_fallback_keras_saat_tidak_ada_ai_client(self):
        manager = CustomUser.objects.create_user(
            username='mgr_fallback1', password='pass12345', role='manager', no_hp='6281111222333',
        )
        with patch("api.wa_logic.get_ai_client", return_value=None), \
             patch('api.whatsapp_client.whatsapp_client.send_text_message') as mock_kirim:
            jawaban = proses_dengan_ai_agent("6289998887776", "Ahmad", pesan_asli="halo")
        self.assertIn("sistem kami sedang sibuk", jawaban)
        mock_kirim.assert_called_once()
        self.assertEqual(mock_kirim.call_args[0][0], manager.no_hp)

    def test_fallback_keras_saat_koneksi_gagal_total_setelah_retry(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = RuntimeError("timeout")
        with patch("api.wa_logic.get_ai_client", return_value=mock_client), \
             patch("time.sleep", return_value=None), \
             patch("api.wa_logic._eskalasi_ke_admin") as mock_eskalasi:
            jawaban = proses_dengan_ai_agent("6281111111", "Budi", pesan_asli="halo")
        self.assertIn("sistem kami sedang sibuk", jawaban)
        mock_eskalasi.assert_called_once()
        # 3x retry per putaran (pola sama spt tanya_ai_finishing lama)
        self.assertEqual(mock_client.chat.completions.create.call_count, 3)

    def test_fallback_keras_saat_respons_kosong_tanpa_tool_calls_maupun_content(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_response(content=None, tool_calls=None)
        with patch("api.wa_logic.get_ai_client", return_value=mock_client), \
             patch("api.wa_logic._eskalasi_ke_admin") as mock_eskalasi:
            jawaban = proses_dengan_ai_agent("6281111111", "Budi", pesan_asli="halo")
        self.assertIn("sistem kami sedang sibuk", jawaban)
        mock_eskalasi.assert_called_once()

    def test_fallback_keras_setelah_lolos_maks_putaran_tanpa_jawaban_final(self):
        tc = _mock_tool_call("call_x", "cek_faq", {"pertanyaan": "apa saja"})
        resp_tool = _mock_response(content=None, tool_calls=[tc])

        mock_client = MagicMock()
        # AI TERUS minta tool tiap putaran, tidak pernah kasih jawaban final.
        mock_client.chat.completions.create.return_value = resp_tool

        with patch("api.wa_logic.get_ai_client", return_value=mock_client), \
             patch("api.services.wa_ai_tools.jalankan_tool", return_value={'ok': True}), \
             patch("api.wa_logic._eskalasi_ke_admin") as mock_eskalasi:
            jawaban = proses_dengan_ai_agent("6281111111", "Budi", pesan_asli="halo")

        self.assertIn("sistem kami sedang sibuk", jawaban)
        mock_eskalasi.assert_called_once()
        self.assertEqual(mock_client.chat.completions.create.call_count, MAKS_PUTARAN_TOOL)


class WaAiToolsTest(TestCase):
    """Tool-tool AI agent (api/services/wa_ai_tools.py) -- fungsi Python
    biasa yang dipanggil AI lewat tool-calling. Kalkulasi harga sendiri
    (product_pricing.hitung_harga) sudah dites lengkap di
    tests_product_pricing.py -- di sini cukup verifikasi pembungkusnya."""

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_cari_produk_kata_kunci_kosong_redirect_bukan_dump_db(self):
        # (2026-09-10) cari_produk TIDAK BOLEH lagi jadi jalur browse katalog
        # umum -- itu database operasional internal (ada Bahan Baku dkk,
        # tidak dikurasi utk pelanggan). Redirect ke daftar_kategori_produk.
        Product.objects.create(nama='Banner Flexi 280gr', price_type='flat', harga_jual_toko=25000, is_active=True)
        Product.objects.create(nama='Kain Blacu Bahan Baku', price_type='flat', harga_jual_toko=1000, is_active=True)
        hasil = cari_produk('')
        self.assertTrue(hasil['ok'])
        self.assertEqual(hasil['produk'], [])
        self.assertIn('daftar_kategori_produk', hasil['catatan'])

    def test_cari_produk_typo_toleran(self):
        Product.objects.create(nama='Banner Flexi 280gr', price_type='flat', harga_jual_toko=25000, is_active=True)
        hasil = cari_produk('benner')
        self.assertTrue(hasil['ok'])
        self.assertEqual(hasil['produk'][0]['nama'], 'Banner Flexi 280gr')

    def test_daftar_kategori_produk_tanpa_parameter_kembalikan_daftar_slug(self):
        SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori',
            defaults={'value': '{"banner": "Info harga banner", "stiker": "Info harga stiker"}'},
        )
        hasil = daftar_kategori_produk()
        self.assertTrue(hasil['ok'])
        self.assertEqual(set(hasil['kategori_tersedia']), {'banner', 'stiker'})

    def test_daftar_kategori_produk_dengan_parameter_kembalikan_detail(self):
        SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori',
            defaults={'value': '{"banner": "Banner 240 Rp18.000/m2"}'},
        )
        hasil = daftar_kategori_produk(kategori='banner')
        self.assertTrue(hasil['ok'])
        self.assertIn('Rp18.000', hasil['detail'])

    def test_daftar_kategori_produk_kategori_tidak_dikenal(self):
        SystemConfig.objects.update_or_create(
            key='wa_pricelist_kategori', defaults={'value': '{"banner": "x"}'},
        )
        hasil = daftar_kategori_produk(kategori='kategori_ngawur')
        self.assertFalse(hasil['ok'])
        self.assertIn('banner', hasil['kategori_tersedia'])

    def test_daftar_kategori_produk_belum_diseed(self):
        SystemConfig.objects.filter(key='wa_pricelist_kategori').delete()
        hasil = daftar_kategori_produk()
        self.assertFalse(hasil['ok'])

    def test_cari_produk_tidak_ketemu(self):
        hasil = cari_produk('produk zzz yang tidak ada sama sekali')
        self.assertTrue(hasil['ok'])
        self.assertEqual(hasil['produk'], [])

    def test_hitung_harga_produk_id_tidak_valid(self):
        hasil = TOOL_FUNCTIONS['hitung_harga_produk'](product_id=999999)
        self.assertFalse(hasil['ok'])
        self.assertIn('tidak ditemukan', hasil['error'])

    def test_cek_status_pesanan_by_nomor_order(self):
        order = Order.objects.create(id='ORD-TOOL-1', nomor_wa='628111', nama='Rian', status_global='review')
        OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1)
        hasil = cek_status_pesanan(nomor_order='ord-tool-1')
        self.assertTrue(hasil['ok'])
        self.assertIn('ORD-TOOL-1', hasil['status_text'])

    def test_cek_status_pesanan_order_tidak_ditemukan(self):
        hasil = cek_status_pesanan(nomor_order='ORD-TIDAK-ADA')
        self.assertFalse(hasil['ok'])

    def test_cek_status_pesanan_tanpa_nomor_order_pakai_nomor_konteks(self):
        Order.objects.create(id='ORD-TOOL-2', nomor_wa='628222', nama='Sari', status_global='review')
        hasil = cek_status_pesanan(nomor='628222')
        self.assertTrue(hasil['ok'])
        self.assertIn('ORD-TOOL-2', hasil['status_text'])

    def test_cek_status_pesanan_beberapa_order_kembalikan_daftar(self):
        Order.objects.create(id='ORD-TOOL-3A', nomor_wa='628333', nama='X', status_global='review')
        Order.objects.create(id='ORD-TOOL-3B', nomor_wa='628333', nama='X', status_global='dikerjakan')
        hasil = cek_status_pesanan(nomor='628333')
        self.assertTrue(hasil['ok'])
        self.assertEqual(len(hasil['daftar_pesanan']), 2)

    def test_cek_status_pesanan_tanpa_nomor_sama_sekali(self):
        hasil = cek_status_pesanan()
        self.assertFalse(hasil['ok'])

    def test_produk_terlaris_data_asli(self):
        order = Order.objects.create(id='ORD-TOOL-TERLARIS', nomor_wa='6285', nama='X')
        for _ in range(3):
            OrderItem.objects.create(order=order, jenis_produk='Kartu Nama Premium', qty=1)
        hasil = produk_terlaris()
        self.assertTrue(hasil['ok'])
        self.assertEqual(hasil['produk_terlaris'][0]['nama'], 'Kartu Nama Premium')
        self.assertEqual(hasil['produk_terlaris'][0]['jumlah_dipesan'], 3)

    def test_produk_terlaris_kosong_kalau_belum_ada_histori(self):
        hasil = produk_terlaris()
        self.assertTrue(hasil['ok'])
        self.assertEqual(hasil['produk_terlaris'], [])

    def test_produk_sesuai_budget_filter_flat_saja(self):
        Product.objects.create(nama='Kartu Nama Premium', price_type='flat', harga_jual_toko=50000, is_active=True)
        Product.objects.create(nama='Banner Flexi', price_type='per_m2', harga_jual_toko=25000, is_active=True)
        Product.objects.create(nama='Stiker Vinyl', price_type='flat', harga_jual_toko=150000, is_active=True)
        hasil = produk_sesuai_budget(budget=100000)
        nama_list = [p['nama'] for p in hasil['produk']]
        self.assertIn('Kartu Nama Premium', nama_list)
        self.assertNotIn('Banner Flexi', nama_list)
        self.assertNotIn('Stiker Vinyl', nama_list)

    def test_produk_sesuai_budget_tidak_valid(self):
        hasil = produk_sesuai_budget(budget='bukan angka')
        self.assertFalse(hasil['ok'])

    def test_cek_faq_ketemu(self):
        FAQ.objects.create(pertanyaan='jam buka toko', jawaban='Senin-Sabtu jam 8-5 Kak!')
        hasil = cek_faq(pertanyaan='jam buka toko')
        self.assertTrue(hasil['ok'])
        self.assertIn('Senin-Sabtu', hasil['jawaban'])

    def test_cek_faq_tidak_ketemu(self):
        hasil = cek_faq(pertanyaan='pertanyaan yang tidak ada di FAQ manapun sama sekali')
        self.assertTrue(hasil['ok'])
        self.assertIsNone(hasil['jawaban'])

    def test_ambil_template_form_order_pre_fill(self):
        hasil = ambil_template_form_order(jenis_produk='Banner 340')
        self.assertTrue(hasil['ok'])
        self.assertIn('Banner 340', hasil['template'])
        self.assertIn('FORM ORDER', hasil['template'])

    def test_buat_pesanan_item_kurang_bahan_finishing_ditolak(self):
        Product.objects.create(
            nama='Banner Flexi', price_type='per_m2', harga_jual_toko=25000,
            is_active=True, butuh_bahan=True, butuh_finishing=True,
        )
        hasil = buat_pesanan(
            items=[{'jenis_produk': 'Banner Flexi', 'qty': 2}],
            nomor='628444', nama_pelanggan='Rudi',
        )
        self.assertFalse(hasil['ok'])
        self.assertTrue(hasil.get('field_kurang'))
        self.assertIsNone(pending_order_form.get('628444'))

    def test_buat_pesanan_berhasil_simpan_draft_dan_rekap(self):
        Product.objects.create(
            nama='Cetak Foto 4R', price_type='flat', harga_jual_toko=5000,
            is_active=True, butuh_bahan=False, butuh_finishing=False,
        )
        hasil = buat_pesanan(
            items=[{'jenis_produk': 'Cetak Foto 4R', 'qty': 10}],
            nomor='628555', nama_pelanggan='Wati',
        )
        self.assertTrue(hasil['ok'])
        self.assertIn('Cetak Foto 4R', hasil['rekap'])
        self.assertIn('sesuai', hasil['instruksi'].lower())
        draft = pending_order_form.get('628555')
        self.assertIsNotNone(draft)
        self.assertEqual(draft['items'][0]['jenis_produk'], 'Cetak Foto 4R')

    def test_buat_pesanan_tanpa_items(self):
        hasil = buat_pesanan(items=[], nomor='628666')
        self.assertFalse(hasil['ok'])

    def test_buat_pesanan_tanpa_nomor_ditolak(self):
        hasil = buat_pesanan(items=[{'jenis_produk': 'Umum', 'qty': 1}], nomor=None)
        self.assertFalse(hasil['ok'])

    def test_eskalasi_admin_memanggil_notifikasi_dan_ok(self):
        with patch('api.wa_logic._eskalasi_ke_admin') as mock_eskalasi:
            hasil = eskalasi_admin(alasan='komplain kualitas cetak', nomor='628777', nama_pelanggan='Doni', pesan_asli='cetakannya buram')
        self.assertTrue(hasil['ok'])
        mock_eskalasi.assert_called_once_with('628777', 'Doni', 'cetakannya buram', 'komplain kualitas cetak')

    def test_jalankan_tool_tool_tidak_dikenal(self):
        hasil = jalankan_tool('tool_ngawur_tidak_ada', {})
        self.assertFalse(hasil['ok'])

    def test_jalankan_tool_konteks_menang_atas_argumen_ai(self):
        # Keamanan (docstring jalankan_tool): 'nomor' TIDAK diekspos di
        # TOOL_SCHEMAS, tapi seandainya AI somehow menyertakan key itu di
        # argumen, nilai dari konteks TERPERCAYA harus selalu menang --
        # cegah pelanggan "menyuruh" AI mengecek data nomor WA orang lain.
        Order.objects.create(id='ORD-TOOL-KTX', nomor_wa='628999', nama='Asli', status_global='review')
        hasil = jalankan_tool(
            'cek_status_pesanan', {'nomor': '628000_bukan_punyanya'},
            konteks={'nomor': '628999', 'nama_pelanggan': 'Asli', 'pesan_asli': 'cek status'},
        )
        self.assertTrue(hasil['ok'])
        self.assertIn('ORD-TOOL-KTX', hasil['status_text'])

    def test_jalankan_tool_argumen_tidak_valid_type_error(self):
        hasil = jalankan_tool('hitung_harga_produk', {'product_id': 'bukan_angka_bukan_id_valid', 'panjang': {}})
        self.assertFalse(hasil['ok'])


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
        # Tunggu thread background _kirim_balas_async & return mock_send
        # supaya test BENAR-BENAR bisa verifikasi balasan terkirim, bukan
        # cuma efek sampingnya di DB (bug nyata ditemukan user 2026-09-10:
        # rekap form dihitung benar tapi tidak pernah terkirim -- lolos test
        # lama krn tidak pernah cek mock_send sama sekali).
        import threading
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
        return mock_send

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
        mock_send = self._kirim_form(form)
        self.assertFalse(Order.objects.filter(nomor_wa="628222000222").exists())
        mock_send.assert_called_once()
        self.assertIn("Bahan/Material, Finishing", mock_send.call_args[0][1])

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
        mock_send_rekap = self._kirim_form(form)
        self.assertFalse(Order.objects.filter(nomor_wa="628222000222").exists())
        # Rekap WAJIB benar-benar terkirim ke pelanggan (bukan cuma dihitung
        # & disimpan ke pending_order_form) -- lihat catatan bug di _kirim_form.
        mock_send_rekap.assert_called_once()
        self.assertIn("Banner Flexi", mock_send_rekap.call_args[0][1])
        self.assertIn("sesuai", mock_send_rekap.call_args[0][1].lower())

        mock_send_konfirmasi = self._kirim_form("sesuai")
        self.assertTrue(Order.objects.filter(nomor_wa="628222000222").exists())
        mock_send_konfirmasi.assert_called_once()


class KonfirmasiOrderKonkurenTest(TransactionTestCase):
    """(2026-09-10) Bug konkurensi ditemukan user: kalau pelanggan kirim
    'sesuai' 2x hampir bersamaan (double-tap, atau WA redeliver dgn
    message_id beda shg lolos anti-duplikasi inbound), dua request bisa
    sama-sama baca pending_order_form SEBELUM salah satu sempat
    menghapusnya -> berpotensi 2 Order tersimpan dari 1 form yang sama.
    Perbaikan: kunci per-nomor pengirim (_dengan_kunci_pengirim di
    views/whatsapp.py) menyerialkan pemrosesan pesan dari nomor yang sama."""

    def setUp(self):
        cache.clear()
        Contact.objects.create(nomor_wa="628222000999", nama="Rudi")
        Product.objects.create(
            nama='Banner Flexi Konkuren', price_type='per_m2', harga_jual_toko=25000,
            is_active=True, butuh_bahan=False, butuh_finishing=False,
        )
        cache.set("wa_ai_respons_awal_628222000999", True, timeout=3600)

    def tearDown(self):
        cache.clear()

    def _kirim(self, isi, msg_id):
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"remoteJid": "628222000999@s.whatsapp.net", "fromMe": False, "id": msg_id},
                "pushName": "Rudi",
                "message": {"conversation": isi},
            },
        }
        with patch.dict(os.environ, {"EVOLUTION_API_KEY": "TestKey123"}), \
             patch("api.whatsapp_client.whatsapp_client.send_text_message") as mock_send, \
             patch("api.whatsapp_client.whatsapp_client.send_presence", return_value=None), \
             patch("time.sleep", return_value=None):
            mock_send.return_value = {"status": "sent"}
            return Client().post(
                "/api/webhook/evolution/", payload, content_type="application/json",
                HTTP_APIKEY="TestKey123",
            )

    def test_konfirmasi_sesuai_dobel_hampir_bersamaan_cuma_bikin_1_order(self):
        form = (
            "Nama Pemesan: Rudi\n"
            "No. WA: 628222000999\n"
            "Item 1\n"
            "Jenis Produk: Banner Flexi Konkuren\n"
            "Jumlah: 1\n"
            "Ukuran: 1x1\n"
        )
        self._kirim(form, "MSG_FORM_001")
        self.assertFalse(Order.objects.filter(nomor_wa="628222000999").exists())

        import threading
        results = []

        def kirim_sesuai(msg_id):
            res = self._kirim("sesuai", msg_id)
            results.append(res.status_code)

        # message_id BEDA supaya tidak tertangkap anti-duplikasi inbound
        # (itu mekanisme LAIN, bukan yang diuji di sini) -- yang diuji
        # murni race pending_order_form.
        threads = [
            threading.Thread(target=kirim_sesuai, args=(f"MSG_SESUAI_{i}",))
            for i in range(2)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=15)

        self.assertEqual(sorted(results), [200, 200])
        self.assertEqual(
            Order.objects.filter(nomor_wa="628222000999").count(), 1,
            "Dua konfirmasi 'sesuai' hampir bersamaan harus cuma bikin 1 Order, bukan 2.",
        )


class KirimDesainTanpaIDPesananTest(TestCase):
    """(2026-09-10) Bug ditemukan user: pelanggan kirim file desain (foto/
    dokumen) TANPA menyebut ID pesanan di caption -- kasus SANGAT umum,
    kebanyakan orang kirim file WA polos tanpa keterangan -- sebelumnya
    file itu diam-diam diabaikan total (bahkan sebelum sempat sampai ke
    proses_kirim_desain(), pesan tanpa teks di-skip duluan). Sekarang
    dicari pesanan aktif milik nomor itu: auto-tautkan kalau cuma 1, minta
    pelanggan pilih kalau >1, minta ID manual kalau tidak ada sama sekali."""

    def setUp(self):
        cache.clear()

    def test_media_tanpa_id_satu_order_aktif_auto_tertaut(self):
        order = Order.objects.create(nomor_wa="628555000111", status_global='review')
        OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1)

        jawaban = proses_kirim_desain(
            "", "628555000111", "Nita", media_url="https://mmg.whatsapp.net/file123.jpg",
        )
        self.assertIsNotNone(jawaban)
        self.assertIn(order.id, jawaban)
        item = order.items.first()
        item.refresh_from_db()
        self.assertEqual(item.gdrive_customer_link, "https://mmg.whatsapp.net/file123.jpg")
        self.assertTrue(item.desain_susulan)

    def test_media_tanpa_id_lebih_dari_1_order_aktif_minta_pilih(self):
        o1 = Order.objects.create(nomor_wa="628555000222", status_global='review')
        o2 = Order.objects.create(nomor_wa="628555000222", status_global='dikerjakan')

        jawaban = proses_kirim_desain(
            "", "628555000222", "Budi", media_url="https://mmg.whatsapp.net/file456.jpg",
        )
        self.assertIsNotNone(jawaban)
        self.assertIn(o1.id, jawaban)
        self.assertIn(o2.id, jawaban)

    def test_media_tanpa_id_tanpa_order_aktif_minta_id_manual(self):
        jawaban = proses_kirim_desain(
            "", "628555000333", "Wati", media_url="https://mmg.whatsapp.net/file789.jpg",
        )
        self.assertIsNotNone(jawaban)
        self.assertIn("ID Pesanan", jawaban)

    def test_media_dengan_id_di_caption_tetap_jalur_lama(self):
        """Regresi: jalur lama (media + ID pesanan disebut eksplisit) tidak
        boleh berubah perilakunya."""
        order = Order.objects.create(nomor_wa="628555000444", status_global='review')
        OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1)

        jawaban = proses_kirim_desain(
            f"{order.id}", "628555000444", "Sinta", media_url="https://mmg.whatsapp.net/fileabc.jpg",
        )
        self.assertIsNotNone(jawaban)
        self.assertIn(order.id, jawaban)

    def test_pesan_kosong_tanpa_media_tetap_none(self):
        self.assertIsNone(proses_kirim_desain("", "628555000555", "Tono", media_url=""))


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


class RekomendasiProdukDataTest(TestCase):
    """cek_produk_terlaris() -- query data ASLI (histori Order), dipakai
    ulang oleh tool `produk_terlaris` (lihat WaAiToolsTest). Rekomendasi
    sesuai budget dites di WaAiToolsTest lewat tool `produk_sesuai_budget`."""

    def test_cek_produk_terlaris_data_asli(self):
        Product.objects.create(nama='Kartu Nama Premium', price_type='flat', harga_jual_toko=50000, is_active=True)
        Product.objects.create(nama='Stiker Vinyl', price_type='flat', harga_jual_toko=150000, is_active=True)

        order = Order.objects.create(id='ORD-REK-1', nomor_wa='6285', nama='X')
        for _ in range(3):
            OrderItem.objects.create(order=order, jenis_produk='Kartu Nama Premium', qty=1)
        OrderItem.objects.create(order=order, jenis_produk='Stiker Vinyl', qty=1)
        order_batal = Order.objects.create(id='ORD-REK-2', nomor_wa='6285', nama='X', status_global='batal')
        OrderItem.objects.create(order=order_batal, jenis_produk='Kartu Nama Premium', qty=10)

        terlaris = cek_produk_terlaris()
        self.assertEqual(terlaris[0], ('Kartu Nama Premium', 3))  # order batal tidak ikut dihitung


class TombolLamaWebhookTest(TestCase):
    """Balasan tap tombol (buttonsResponseMessage) dari sesi SEBELUM rebuild
    ini (bot tidak lagi pernah mengirim tombol baru) tetap di-map ke padanan
    teks '1'/'2'/'3' & diproses normal lewat AI agent, bukan diabaikan."""

    def setUp(self):
        cache.clear()
        Contact.objects.create(nomor_wa="628111000111", nama="Rian")
        cache.set("wa_ai_respons_awal_628111000111", True, timeout=3600)

    def tearDown(self):
        cache.clear()

    def test_button_reply_dipetakan_ke_teks_lalu_diproses_ai_agent(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_response(
            content="Siap Kak, mau order produk apa nih? 😊",
        )
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
             patch("api.wa_logic.get_ai_client", return_value=mock_client), \
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
        self.assertTrue(mock_send.called)
        teks_terkirim = mock_send.call_args[0][1]
        self.assertIn("order produk apa", teks_terkirim.lower())
        # 'menu_order' di-map ke '1' -- pastikan itu yang sampai ke AI (pesan
        # user tersimpan di memori percakapan), bukan ID tombol mentah.
        mem = get_memori_percakapan("628111000111", "Rian")
        self.assertTrue(any(m.get("content") == "1" for m in mem if m.get("role") == "user"))


class AiAgentWebhookIntegrationTest(TestCase):
    """Pipeline end-to-end webhook Evolution -> proses_dengan_ai_agent --
    pastikan wiring _proses_pesan_masuk_terkunci Step 4 (satu-satunya
    "otak" sekarang) benar2 memanggil AI agent & mengirim balasannya."""

    def setUp(self):
        cache.clear()
        Contact.objects.create(nomor_wa="628177700099", nama="Fajar")
        cache.set("wa_ai_respons_awal_628177700099", True, timeout=3600)

    def tearDown(self):
        cache.clear()

    def _kirim(self, teks, mock_client, msg_id="MSG_AGENT_001"):
        import threading
        payload = {
            "event": "messages.upsert",
            "data": {
                "key": {"remoteJid": "628177700099@s.whatsapp.net", "fromMe": False, "id": msg_id},
                "pushName": "Fajar",
                "message": {"conversation": teks},
            },
        }
        with patch.dict(os.environ, {"EVOLUTION_API_KEY": "TestKey123"}), \
             patch("api.wa_logic.get_ai_client", return_value=mock_client), \
             patch("api.whatsapp_client.whatsapp_client.send_text_message") as mock_send, \
             patch("api.whatsapp_client.whatsapp_client.send_presence", return_value=None), \
             patch("time.sleep", return_value=None):
            mock_send.return_value = {"status": "sent"}
            response = self.client.post(
                "/api/webhook/evolution/", payload, content_type="application/json",
                HTTP_APIKEY="TestKey123",
            )
            for t in threading.enumerate():
                if t is not threading.current_thread() and t.daemon:
                    t.join(timeout=5)
        self.assertEqual(response.status_code, 200)
        return mock_send

    def test_pesan_bebas_dibalas_ai_agent_langsung(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_response(
            content="Halo Kak Fajar! Mau tanya produk apa nih? 😊",
        )
        mock_send = self._kirim("halo kak", mock_client)
        mock_send.assert_called_once()
        self.assertIn("mau tanya produk apa", mock_send.call_args[0][1].lower())

    def test_ai_gagal_total_fallback_sopan_dan_eskalasi_admin(self):
        manager = CustomUser.objects.create_user(
            username='mgr_webhook_fallback', password='pass12345', role='manager', no_hp='6281199988877',
        )
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = RuntimeError("koneksi AI gagal")
        mock_send = self._kirim("kalo tanya-tanya boleh", mock_client, msg_id="MSG_AGENT_FALLBACK")
        # 2 panggilan: 1x ke pelanggan (fallback sopan), 1x ke manager (eskalasi).
        self.assertEqual(mock_send.call_count, 2)
        nomor_dihubungi = {c.args[0] for c in mock_send.call_args_list}
        self.assertIn("628177700099", nomor_dihubungi)
        self.assertIn(manager.no_hp, nomor_dihubungi)
        teks_ke_pelanggan = next(c.args[1] for c in mock_send.call_args_list if c.args[0] == "628177700099")
        self.assertIn("sistem kami sedang sibuk", teks_ke_pelanggan)
