"""Approval hasil edit StarFoto oleh pelanggan (2026-10-11): pratinjau
ber-watermark, tautan publik, revisi dengan batas, tertunda, tanpa edit."""
import io
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from .models import JobBoard, SystemConfig
from .services import starfoto_approval as svc
from .starfoto_models import PesananFoto, PratinjauEdit
from .tests_starfoto import _Dasar


def gambar(nama='edit.jpg'):
    buf = io.BytesIO()
    Image.new('RGB', (2400, 1600), (200, 120, 90)).save(buf, 'JPEG')
    return SimpleUploadedFile(nama, buf.getvalue(), content_type='image/jpeg')


@patch('api.whatsapp_client.whatsapp_client.send_text_message', return_value={'ok': True})
class ApprovalTests(_Dasar):
    def _dikonfirmasi(self, **ekstra):
        pesanan, sesi = self._pesanan_siap_konfirmasi()
        self.client.post(f'/api/starfoto/sesi/{sesi.id}/selesai/')
        self.client.force_authenticate(self.kasir)
        res = self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/konfirmasi/', {
            'pilihan_file': [{'nomor_file': '0007', 'peruntukan': 'Edit + cetak 8RP', 'catatan': 'cerahkan'}],
            'spk': {'deadline': str(timezone.localdate()), 'deadline_jam': '17:00'}, **ekstra,
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        return PesananFoto.objects.get(pk=pesanan.pk)

    def _unggah_dan_kirim(self, pesanan):
        self.client.force_authenticate(self.editor)
        res = self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/pratinjau/',
                               {'foto': gambar(), 'pilihan_file': pesanan.pilihan_file.get().id}, format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(res.json()['berkas'].startswith('http://testserver/api/media-protected/'))
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/kirim-approval/')
        self.assertEqual(res.status_code, 200, res.content)
        pesanan.refresh_from_db()
        return pesanan

    def test_alur_revisi_lalu_setuju_sampai_cetak(self, kirim_wa):
        pesanan = self._dikonfirmasi()
        self.client.force_authenticate(self.editor)
        self.assertEqual([p['id'] for p in self.client.get('/api/starfoto/edit-foto/').json()], [pesanan.id])
        # Kirim tanpa pratinjau ditolak.
        self.assertEqual(self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/kirim-approval/').status_code, 400)

        pesanan = self._unggah_dan_kirim(pesanan)
        self.assertEqual((pesanan.approval_status, pesanan.approval_putaran), ('menunggu', 1))
        self.assertIn('/approval-foto/', kirim_wa.call_args.args[1])
        job_edit = JobBoard.objects.get(order_item=pesanan.paket_item, tahap=self.t_edit)
        self.assertEqual(job_edit.status_pekerjaan, 'selesai')
        self.assertNotEqual(pesanan.order.status_global, 'ready')
        self.assertEqual(self.client.get('/api/starfoto/edit-foto/').json(), [])

        # Pelanggan membuka tautan tanpa login & melihat foto ber-watermark (JPEG <= 1600px).
        self.client.force_authenticate(None)
        token = svc.buat_token(pesanan)
        data = self.client.get(f'/api/approval-foto/{token}/').json()
        self.assertEqual((data['status'], data['sisa_revisi'], data['foto'][0]['nomor_file']), ('menunggu', 2, '0007'))
        foto_id = data['foto'][0]['id']
        res = self.client.get(f'/api/approval-foto/{token}/foto/{foto_id}/')
        self.assertEqual(res.status_code, 200)
        self.assertLessEqual(max(Image.open(io.BytesIO(b''.join(res.streaming_content))).size), 1600)

        # Revisi wajib catatan; lalu SPK Edit kembali ke editor yang sama.
        res = self.client.post(f'/api/approval-foto/{token}/', {'keputusan': [{'id': foto_id, 'setuju': False}]}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.post(f'/api/approval-foto/{token}/', {'keputusan': [{'id': foto_id, 'setuju': False, 'catatan': 'kulit lebih cerah'}]}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        pesanan.refresh_from_db()
        self.assertEqual(pesanan.approval_status, 'revisi')
        job_edit.refresh_from_db()
        self.assertEqual((job_edit.status_pekerjaan, job_edit.pic_staff_id), ('antrean', self.editor.id))

        # Putaran 2: tautan lama usang, keputusan lewat tautan baru.
        pesanan = self._unggah_dan_kirim(pesanan)
        # File pratinjau putaran 1 dihapus dari server saat putaran 2 dikirim.
        self.assertEqual(PratinjauEdit.objects.get(pesanan=pesanan, putaran=1).berkas.name, '')
        self.assertNotEqual(PratinjauEdit.objects.get(pesanan=pesanan, putaran=2).berkas.name, '')
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'/api/approval-foto/{token}/').json()['status'], 'usang')
        token2 = svc.buat_token(pesanan)
        foto2 = self.client.get(f'/api/approval-foto/{token2}/').json()['foto'][0]['id']
        res = self.client.post(f'/api/approval-foto/{token2}/', {'keputusan': [{'id': foto2, 'setuju': True}]}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        pesanan.refresh_from_db()
        self.assertEqual((pesanan.approval_status, pesanan.approval_oleh), ('disetujui', 'pelanggan'))
        # Disetujui -> semua file pratinjau dihapus dari server, riwayat keputusan tetap.
        self.assertFalse(PratinjauEdit.objects.filter(pesanan=pesanan).exclude(berkas='').exists())
        self.assertEqual(PratinjauEdit.objects.get(pesanan=pesanan, putaran=2).keputusan, 'setuju')
        self.assertEqual(self.client.get(f'/api/approval-foto/{token2}/foto/{foto2}/').status_code, 404)

        # SPK Cetak terbit; operator selesai -> Siap Diambil.
        job_cetak = JobBoard.objects.get(order_item=pesanan.paket_item, tahap=self.t_cetak)
        job_cetak.pic_staff, job_cetak.status_pekerjaan = self.operator, 'dikerjakan'
        job_cetak.save()
        self.client.force_authenticate(self.operator)
        self.assertEqual(self.client.post(f'/api/jobs/{job_cetak.id}/complete/').status_code, 200)
        pesanan.order.refresh_from_db()
        self.assertEqual(pesanan.order.status_global, 'ready')

    def test_batas_revisi_dari_pengaturan(self, kirim_wa):
        SystemConfig.objects.create(key='starfoto_batas_revisi', value='0')
        pesanan = self._unggah_dan_kirim(self._dikonfirmasi())
        self.client.force_authenticate(None)
        token = svc.buat_token(pesanan)
        foto = self.client.get(f'/api/approval-foto/{token}/').json()['foto'][0]['id']
        res = self.client.post(f'/api/approval-foto/{token}/', {'keputusan': [{'id': foto, 'setuju': False, 'catatan': 'x'}]}, format='json')
        self.assertIn('Batas revisi', res.json()['error'])

    def test_tertunda_dan_staff_menyetujui(self, kirim_wa):
        pesanan = self._unggah_dan_kirim(self._dikonfirmasi())
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.client.get('/api/starfoto/approval-tertunda/').json(), [])
        PesananFoto.objects.filter(pk=pesanan.pk).update(approval_dikirim_pada=timezone.now() - timezone.timedelta(hours=30))
        self.assertEqual([p['id'] for p in self.client.get('/api/starfoto/approval-tertunda/').json()], [pesanan.id])
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/kirim-ulang-link/').status_code, 200)
        self.assertEqual(self.client.get('/api/starfoto/approval-tertunda/').json(), [])
        foto = pesanan.pratinjau.get().id
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/approval/',
                                          {'keputusan': [{'id': foto, 'setuju': True}]}, format='json').status_code, 403)
        self.client.force_authenticate(self.kasir)
        res = self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/approval/', {'keputusan': [{'id': foto, 'setuju': True}]}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['approval_oleh'], 'kasir.sf')
        self.assertTrue(JobBoard.objects.filter(order_item=pesanan.paket_item, tahap=self.t_cetak).exists())

    def test_paket_tanpa_edit_langsung_cetak(self, kirim_wa):
        self.paket.jumlah_edit = 0
        self.paket.save()
        pesanan = self._dikonfirmasi()
        self.assertEqual(pesanan.approval_status, 'tanpa_edit')
        jobs = JobBoard.objects.filter(order_item=pesanan.paket_item, status_pekerjaan='antrean')
        self.assertEqual([j.tahap_id for j in jobs], [self.t_cetak.id])
