"""Test penggabungan chat/pesan LID (@lid) <-> JID nomor (@s.whatsapp.net)
di EvolutionAPIClient (api/whatsapp_client.py).

WhatsApp mode multi-device memberi 2 alamat berbeda untuk 1 kontak yang
sama -- Evolution API melaporkannya sebagai chat/pesan TERPISAH walau
orangnya sama (bug ditemukan user 2026-09-07 lewat WA Live Chat: balasan
bot & pesan pelanggan kelihatan "2 percakapan beda" untuk 1 nomor).
`key.remoteJidAlt` menautkan sisi LID ke nomor aslinya; dipakai untuk
menggabungkan tampilan chat list dan riwayat pesan.
"""
from unittest.mock import patch, MagicMock

from django.test import TestCase

from api.whatsapp_client import EvolutionAPIClient


def _resp(payload, status=200):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = payload
    m.raise_for_status = MagicMock()
    return m


class MergeLidChatsTest(TestCase):
    def setUp(self):
        self.client = EvolutionAPIClient()

    def test_menggabungkan_chat_lid_ke_chat_nomor(self):
        chats = [
            {
                'remoteJid': '6282139320408@s.whatsapp.net',
                'lastMessage': {'messageTimestamp': 100, 'key': {'fromMe': True}},
            },
            {
                'remoteJid': '164566218616947@lid',
                'unreadCount': 2,
                'lastMessage': {
                    'messageTimestamp': 200,
                    'key': {'fromMe': False, 'remoteJidAlt': '6282139320408@s.whatsapp.net'},
                },
            },
        ]
        merged = self.client._merge_lid_chats(chats)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]['remoteJid'], '6282139320408@s.whatsapp.net')
        # lastMessage terbaru (timestamp 200, dari sisi LID) yang dipakai.
        self.assertEqual(merged[0]['lastMessage']['messageTimestamp'], 200)
        self.assertEqual(merged[0]['unreadCount'], 2)

    def test_lid_tanpa_remote_jid_alt_tidak_digabung(self):
        """Tanpa remoteJidAlt, tidak ada bukti keterkaitan -- jangan
        digabung asal tebak, biarkan tampil terpisah apa adanya."""
        chats = [
            {'remoteJid': '999999@lid', 'lastMessage': {'messageTimestamp': 100, 'key': {}}},
        ]
        merged = self.client._merge_lid_chats(chats)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]['remoteJid'], '999999@lid')

    def test_chat_lid_tanpa_chat_nomor_dipaksa_ke_jid_nomor(self):
        """Kalau baru ada balasan dari sisi LID (belum pernah ada chat di JID
        nomor sama sekali), tetap disatukan ke JID nomor supaya kirim pesan/
        lookup Contact tetap konsisten dengan Contact.nomor_wa."""
        chats = [
            {
                'remoteJid': '164566218616947@lid',
                'lastMessage': {
                    'messageTimestamp': 100,
                    'key': {'fromMe': False, 'remoteJidAlt': '6281200000001@s.whatsapp.net'},
                },
            },
        ]
        merged = self.client._merge_lid_chats(chats)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]['remoteJid'], '6281200000001@s.whatsapp.net')
        self.assertEqual(merged[0]['id'], '6281200000001@s.whatsapp.net')

    def test_grup_tidak_disentuh(self):
        chats = [{'remoteJid': '12345-6789@g.us', 'lastMessage': {'messageTimestamp': 1, 'key': {}}}]
        merged = self.client._merge_lid_chats(chats)
        self.assertEqual(merged, chats)


class GetMessagesLidMergeTest(TestCase):
    def setUp(self):
        self.client = EvolutionAPIClient()
        self.client.disabled = False
        self.client._last_fail = 0

    @patch('api.whatsapp_client.requests.post')
    def test_gabung_pesan_dari_jid_nomor_dan_lid(self, mock_post):
        def side_effect(url, json, headers, timeout):
            where_key = json['where']['key']
            if 'remoteJid' in where_key:
                return _resp({'messages': {'records': [
                    {'key': {'id': 'A', 'fromMe': True}, 'messageTimestamp': 100},
                ]}})
            return _resp({'messages': {'records': [
                {'key': {'id': 'B', 'fromMe': False, 'remoteJidAlt': '628123@s.whatsapp.net'}, 'messageTimestamp': 200},
            ]}})
        mock_post.side_effect = side_effect

        result = self.client.get_messages('628123@s.whatsapp.net')

        self.assertEqual([r['key']['id'] for r in result], ['A', 'B'])
        self.assertEqual(mock_post.call_count, 2)

    @patch('api.whatsapp_client.requests.post')
    def test_tidak_duplikat_kalau_id_sama_di_kedua_sisi(self, mock_post):
        same_msg = {'key': {'id': 'X', 'fromMe': False}, 'messageTimestamp': 100}

        def side_effect(url, json, headers, timeout):
            return _resp({'messages': {'records': [same_msg]}})
        mock_post.side_effect = side_effect

        result = self.client.get_messages('628123@s.whatsapp.net')

        self.assertEqual(len(result), 1)

    @patch('api.whatsapp_client.requests.post')
    def test_jid_lid_langsung_tidak_ikut_query_alt(self, mock_post):
        """Kalau caller minta riwayat langsung pakai JID LID (bukan JID
        nomor), tidak perlu query remoteJidAlt tambahan -- cuma 1 kali fetch."""
        mock_post.return_value = _resp({'messages': {'records': []}})

        self.client.get_messages('164566218616947@lid')

        self.assertEqual(mock_post.call_count, 1)
