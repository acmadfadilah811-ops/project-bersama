import csv
import io
import re

from django.contrib.auth.hashers import make_password
from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from api.permissions import IsOwnerManagerAdminOrKasir, IsOwnerManagerAdminKasirOrFinanceRole

from .customer_models import (
    CustomerGroup, Customer, CustomerNote, CustomerNoteEntry, CustomerNoteDocument,
    CustomerNoteTag, CustomerReview, Supplier,
)
from .customer_serializers import (
    CustomerGroupSerializer, CustomerSerializer, CustomerNoteSerializer,
    CustomerNoteEntrySerializer, CustomerNoteDocumentSerializer, CustomerNoteTagSerializer,
    CustomerReviewSerializer, SupplierSerializer,
)

MAX_IMPORT_ROWS = 500
GENDER_IMPORT_MAP = {'M': 'L', 'F': 'P', 'L': 'L', 'P': 'P'}


def _truthy(value):
    return str(value or '').strip().lower() in ('1', 'true', 'ya', 'yes')


def _parsed_date(value):
    value = (value or '').strip()
    return parse_date(value) if value else None


PESAN_PUNYA_TRANSAKSI = (
    'Pelanggan ini sudah punya transaksi, jadi tidak bisa dihapus supaya riwayat penjualan tetap utuh. '
    'Minta Owner/Manager menonaktifkannya bila tidak dipakai lagi.'
)


def punya_transaksi(nomor_list):
    """True bila ada nota POS atau order atas nomor WA/HP ini (riwayat yang tidak boleh yatim)."""
    from .models import Order
    from .pos_models import POSSale
    nomor_list = [n for n in nomor_list if n]
    if not nomor_list:
        return False
    return (POSSale.objects.filter(pelanggan__nomor_wa__in=nomor_list).exists()
            or Order.objects.filter(nomor_wa__in=nomor_list).exists())


def varian_nomor(nomor):
    """Nomor HP/WA dalam bentuk 08.. dan 628.. supaya data lama dengan format berbeda tetap cocok."""
    angka = re.sub(r'\D', '', nomor or '')
    if not angka:
        return []
    hasil = {angka}
    if angka.startswith('0'):
        hasil.add('62' + angka[1:])
    elif angka.startswith('62'):
        hasil.add('0' + angka[2:])
    return sorted(hasil)


def rekap_transaksi(nomor_list, cust=None):
    """Ringkasan + rincian transaksi POS & Order untuk daftar nomor WA (Contact)."""
    from .models import Order
    from .pos_models import POSSale

    def _f(v):
        return float(v or 0)

    pesanan, pengembalian, items = [], [], []
    nominal = lunas = hutang = 0.0
    total_transaksi = 0

    pos = (POSSale.objects.filter(pelanggan__in=nomor_list)
           .prefetch_related('items').order_by('-created_at')) if nomor_list else []
    for s in pos:
        tgl = s.created_at.date().isoformat() if s.created_at else ''
        tot, bayar = _f(s.total), _f(s.dibayar)
        if s.status == 'void':
            pengembalian.append({'no_pesanan': s.nomor, 'tanggal': tgl, 'sumber': 'POS',
                                 'total': tot, 'status': 'Dibatalkan (Void)'})
            continue
        total_transaksi += 1
        sisa = max(tot - bayar, 0.0)
        nominal += tot
        lunas += min(bayar, tot)
        hutang += sisa
        pesanan.append({'no_pesanan': s.nomor, 'tanggal': tgl, 'sumber': 'POS',
                        'total': tot, 'dibayar': bayar, 'sisa': sisa, 'status': s.status})
        for it in s.items.all():
            items.append({'no_pesanan': s.nomor, 'tanggal': tgl, 'nama': it.nama_snapshot,
                          'qty': _f(it.qty), 'harga': _f(it.harga_snapshot), 'total': _f(it.subtotal)})

    orders = (Order.objects.filter(nomor_wa__in=nomor_list)
              .prefetch_related('items__product').order_by('-waktu')) if nomor_list else []
    for o in orders:
        tgl = o.waktu.date().isoformat() if o.waktu else ''
        tot, sisa = _f(o.total_harga), _f(o.sisa_tagihan)
        if o.status_global == 'batal':
            pengembalian.append({'no_pesanan': str(o.id), 'tanggal': tgl, 'sumber': 'Order',
                                 'total': tot, 'status': 'Dibatalkan'})
            continue
        total_transaksi += 1
        nominal += tot
        lunas += max(tot - sisa, 0.0)
        hutang += sisa
        pesanan.append({'no_pesanan': str(o.id), 'tanggal': tgl, 'sumber': 'Order',
                        'total': tot, 'dibayar': tot - sisa, 'sisa': sisa, 'status': o.status_global})
        for it in o.items.all():
            q = _f(it.qty)
            items.append({'no_pesanan': str(o.id), 'tanggal': tgl,
                          'nama': (it.product.nama if it.product_id else (it.jenis_produk or '')),
                          'qty': q, 'harga': (_f(it.harga_jual) / q if q else _f(it.harga_jual)),
                          'total': _f(it.harga_jual)})

    pesanan.sort(key=lambda r: r['tanggal'], reverse=True)
    pengembalian.sort(key=lambda r: r['tanggal'], reverse=True)
    items.sort(key=lambda r: r['tanggal'], reverse=True)
    return {
        'ringkasan': {
            'total_transaksi': total_transaksi,
            'nominal_transaksi': nominal,
            'lunas': lunas,
            'hutang': hutang,
            'loyalty_points': (cust.loyalty_points or 0) if cust else 0,
            'saldo': _f(cust.deposit) if cust else 0.0,
        },
        'pesanan': pesanan,
        'pengembalian': pengembalian,
        'item': items,
    }


class ToggleStatusMixin:
    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = not instance.is_active
        instance.save()
        return Response(self.get_serializer(instance).data)


class CustomerGroupViewSet(ToggleStatusMixin, viewsets.ModelViewSet):
    """Tipe Pelanggan: Pelanggan & Supplier > Tipe Pelanggan."""
    queryset = CustomerGroup.objects.all()
    serializer_class = CustomerGroupSerializer
    # BE-24: staff diblokir penuh (baca & tulis) dari database pelanggan.
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)


class CustomerViewSet(ToggleStatusMixin, viewsets.ModelViewSet):
    """Pelanggan: Pelanggan & Supplier > Pelanggan."""
    queryset = Customer.objects.all().select_related('customer_group')
    serializer_class = CustomerSerializer
    # BE-24: staff diblokir penuh (baca & tulis) dari database pelanggan.
    # Admin/SPV Finance ditambahkan 2026-09-24 (lihat docstring permission).
    permission_classes = [IsOwnerManagerAdminKasirOrFinanceRole]

    def destroy(self, request, *args, **kwargs):
        """Hapus pelanggan (kasir boleh, 2026-10-27). Pelanggan yang sudah punya transaksi ditolak
        (nonaktifkan saja); kontak WA tertaut tanpa transaksi ikut dihapus supaya tidak muncul lagi
        sebagai kontak lepas di pencarian kasir."""
        from django.db import transaction
        from django.db.models import ProtectedError
        pelanggan = self.get_object()
        kontak = list(pelanggan.contacts.all())
        nomor = [k.nomor_wa for k in kontak] + varian_nomor(pelanggan.handphone)
        if punya_transaksi(nomor):
            return Response({'error': PESAN_PUNYA_TRANSAKSI}, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                for k in kontak:
                    k.delete()
                pelanggan.delete()
        except ProtectedError:
            return Response({'error': PESAN_PUNYA_TRANSAKSI}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        search = (p.get('search') or '').strip()
        if search:
            filt = (Q(nama__icontains=search) | Q(email__icontains=search) | Q(handphone__icontains=search)
                    | Q(kode_pelanggan__icontains=search))
            for n in varian_nomor(search) if re.fullmatch(r'[\d\s\-+()]+', search) else []:
                filt |= Q(handphone__icontains=n)
            qs = qs.filter(filt)
        # Filter daftar Pelanggan dijalankan di server (2026-10-19): data 28 ribu baris
        # tidak bisa lagi dimuat sekaligus ke browser.
        grup = p.get('grup')
        if grup == 'tanpa':
            qs = qs.filter(customer_group__isnull=True)
        elif grup:
            qs = qs.filter(customer_group_id=grup)
        if p.get('grup_nama'):
            qs = qs.filter(customer_group__nama=p['grup_nama'])
        status_filter = p.get('status')
        if status_filter == 'aktif':
            qs = qs.filter(bekukan=False)
        elif status_filter == 'dibekukan':
            qs = qs.filter(bekukan=True)
        rentang = (
            ('lahir_dari', 'tanggal_lahir__gte'), ('lahir_sampai', 'tanggal_lahir__lte'),
            ('berakhir_dari', 'tanggal_berakhir__gte'), ('berakhir_sampai', 'tanggal_berakhir__lte'),
            ('deposit_min', 'deposit__gte'), ('deposit_max', 'deposit__lte'),
            ('loyalty_min', 'loyalty_points__gte'), ('loyalty_max', 'loyalty_points__lte'),
        )
        for param, lookup in rentang:
            if p.get(param) not in (None, ''):
                qs = qs.filter(**{lookup: p[param]})
        if p.get('deposit_tidak_nol'):
            qs = qs.exclude(deposit=0)
        return qs

    @action(detail=False, methods=['get'], url_path='ringkasan-grup')
    def ringkasan_grup(self, request):
        """Jumlah pelanggan per tipe untuk kartu Tipe Pelanggan."""
        from django.db.models import Count

        per_grup = {
            str(r['customer_group']): r['n']
            for r in Customer.objects.values('customer_group').order_by().annotate(n=Count('id'))
        }
        return Response({
            'per_grup': {k: v for k, v in per_grup.items() if k != 'None'},
            'tanpa_grup': per_grup.get('None', 0),
            'total': sum(per_grup.values()),
        })


    def perform_create(self, serializer):
        raw_password = serializer.validated_data.get('password')
        serializer.save(
            dibuat_oleh=self.request.user,
            password=make_password(raw_password) if raw_password else '',
        )

    def perform_update(self, serializer):
        raw_password = serializer.validated_data.get('password')
        if raw_password:
            serializer.save(password=make_password(raw_password))
        else:
            # Kosong/tidak dikirim → jangan timpa password yang sudah tersimpan.
            serializer.validated_data.pop('password', None)
            serializer.save()

    @action(detail=True, methods=['post'], url_path='resolve-contact')
    def resolve_contact(self, request, pk=None):
        """Cari/buat Contact yang tertaut ke Customer ini.

        Terminal Kasir memilih pelanggan dari daftar Customer (master data,
        362 baris) supaya kasir bisa cari SIAPA SAJA yang terdaftar -- bukan
        cuma yang kebetulan sudah pernah order lewat WA (Contact, sebelumnya
        cuma 6 baris, bug ditemukan user 2026-09-07). Tapi transaksi POS/
        Order tetap terikat ke nomor_wa (primary key Contact), jadi resolusi
        ini WAJIB dipanggil sebelum Customer bisa dipakai checkout.
        """
        from .models import Contact
        from .serializers import ContactSerializer

        cust = self.get_object()
        existing = Contact.objects.select_related('customer__customer_group').filter(
            Q(customer=cust) | (Q(nomor_wa=cust.handphone) if cust.handphone else Q(pk__isnull=True))
        ).first()
        if existing:
            if existing.customer_id != cust.id:
                existing.customer = cust
                existing.save(update_fields=['customer'])
            return Response(ContactSerializer(existing).data)

        nomor_wa = re.sub(r'[\s\-()]+', '', cust.handphone or '')
        if not nomor_wa:
            return Response(
                {'error': 'Pelanggan ini belum punya nomor HP tercatat. Lengkapi dulu di data Pelanggan sebelum dipakai transaksi kasir.'},
                status=400,
            )

        contact, created = Contact.objects.get_or_create(
            nomor_wa=nomor_wa,
            defaults={'nama': cust.nama, 'customer': cust},
        )
        if not created and contact.customer_id != cust.id:
            contact.customer = cust
            contact.save(update_fields=['customer'])
        return Response(ContactSerializer(contact).data, status=201 if created else 200)

    @action(detail=True, methods=['get'], url_path='transactions')
    def transactions(self, request, pk=None):
        """Ringkasan & rincian transaksi pelanggan (untuk halaman Rincian Pelanggan).

        Transaksi tersimpan pada Contact (POSSale) / Order (nomor_wa). Kontak
        dijodohkan ke Customer lewat FK Contact.customer ATAU nomor HP yang sama,
        supaya data lama tanpa tautan tetap ikut terhitung.
        """
        from django.db.models import Q
        from .models import Contact

        cust = self.get_object()
        contact_q = Q(customer=cust)
        if cust.handphone:
            contact_q |= Q(nomor_wa__in=varian_nomor(cust.handphone))
        contacts = list(Contact.objects.filter(contact_q).values_list('nomor_wa', flat=True))
        return Response(rekap_transaksi(contacts, cust))

    @action(detail=False, methods=['get'], url_path='cari')
    def cari(self, request):
        """Pencarian pelanggan untuk form transaksi (2026-10-19): database Pelanggan
        + kontak WA yang belum tertaut, dalam satu daftar. Pelanggan dibekukan tidak tampil."""
        from .models import Contact

        q = (request.query_params.get('search') or '').strip()
        cust_qs = Customer.objects.filter(is_active=True, bekukan=False).select_related('customer_group')
        kontak_qs = Contact.objects.filter(customer__isnull=True)
        if q:
            nomor = varian_nomor(q) if re.sub(r'\D', '', q) == re.sub(r'[\s\-+()]', '', q) else []
            filt = (Q(nama__icontains=q) | Q(handphone__icontains=q) | Q(kode_pelanggan__icontains=q)
                    | Q(nama_perusahaan__icontains=q))
            for n in nomor:
                filt |= Q(handphone__icontains=n)
            cust_qs = cust_qs.filter(filt)
            kfilt = Q(nama__icontains=q) | Q(nomor_wa__icontains=q)
            for n in nomor:
                kfilt |= Q(nomor_wa__icontains=n)
            kontak_qs = kontak_qs.filter(kfilt)
        hasil = []
        for c in cust_qs.order_by('nama')[:20]:
            nomor_wa = re.sub(r'[\s\-()]+', '', c.handphone or '')
            hasil.append({
                'id': f'c-{c.id}', 'sumber': 'customer', 'customer_id': c.id, 'nama': c.nama,
                'nomor_wa': nomor_wa, 'handphone': nomor_wa, 'email': c.email,
                'nama_perusahaan': c.nama_perusahaan,
                'customer_group_nama': c.customer_group.nama if c.customer_group_id else '',
            })
        for k in kontak_qs.order_by('nama')[:10]:
            hasil.append({
                'id': f'k-{k.nomor_wa}', 'sumber': 'contact', 'customer_id': None, 'nama': k.nama or k.nomor_wa,
                'nomor_wa': k.nomor_wa, 'handphone': k.nomor_wa, 'email': '', 'nama_perusahaan': '',
                'customer_group_nama': '',
            })
        return Response(hasil)

    @action(detail=False, methods=['get'], url_path='riwayat')
    def riwayat(self, request):
        """Riwayat pembelian ringkas per nomor WA untuk form transaksi (2026-10-19)."""
        from .models import Contact

        nomor = varian_nomor(request.query_params.get('nomor_wa'))
        if not nomor:
            return Response({'error': 'nomor_wa wajib diisi.'}, status=400)
        kontak = list(Contact.objects.filter(nomor_wa__in=nomor).select_related('customer'))
        cust = next((k.customer for k in kontak if k.customer_id), None)
        if cust is None:
            cust = Customer.objects.filter(handphone__in=nomor).first()
        semua = set(nomor) | {k.nomor_wa for k in kontak}
        if cust is not None:
            semua |= set(Contact.objects.filter(customer=cust).values_list('nomor_wa', flat=True))
        data = rekap_transaksi(sorted(semua), cust)
        data['pesanan'] = data['pesanan'][:10]
        data['item'] = data['item'][:15]
        data['pelanggan'] = {
            'nama': cust.nama if cust else (kontak[0].nama if kontak else ''),
            'customer_id': cust.id if cust else None,
            'customer_group_nama': cust.customer_group.nama if cust and cust.customer_group_id else '',
            'catatan': cust.catatan if cust else '',
            'terdaftar': cust is not None,
        }
        return Response(data)

    @action(detail=False, methods=['post'], url_path='import-csv', parser_classes=[MultiPartParser])
    def import_csv(self, request):
        """Import massal dari CSV (max. 500 baris), kolom mengikuti template olsera_customer_import_template."""
        upload = request.FILES.get('file')
        if not upload:
            return Response({'error': 'File CSV tidak ditemukan.'}, status=400)

        try:
            decoded = upload.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response({'error': 'File harus berupa CSV dengan encoding UTF-8.'}, status=400)

        rows = list(csv.DictReader(io.StringIO(decoded)))
        if len(rows) > MAX_IMPORT_ROWS:
            return Response(
                {'error': f'Maksimal {MAX_IMPORT_ROWS} baris per import (file ini berisi {len(rows)} baris).'},
                status=400,
            )

        from .services.pelanggan_nomor import cari_customer_per_nomor, pesan_nomor_terpakai
        from .services.pos_receipt_whatsapp import normalisasi_nomor_whatsapp

        group_cache = {}
        created = 0
        row_errors = []
        nomor_di_berkas = {}  # nomor WA ternormalisasi -> baris pertama di berkas ini

        for idx, row in enumerate(rows, start=2):  # baris 1 adalah header
            nama = (row.get('name') or '').strip()
            if not nama:
                row_errors.append({'row': idx, 'message': 'Kolom "name" wajib diisi.'})
                continue

            # Nomor WA = patokan satu pelanggan: baris dengan nomor yang sudah ada
            # (di sistem atau di baris sebelumnya pada berkas ini) dilewati.
            nomor = normalisasi_nomor_whatsapp(row.get('phone'))
            if nomor:
                ada = cari_customer_per_nomor(nomor)
                if ada:
                    row_errors.append({'row': idx, 'message': pesan_nomor_terpakai(ada)})
                    continue
                if nomor in nomor_di_berkas:
                    row_errors.append({'row': idx, 'message': f'Nomor WA sama dengan baris {nomor_di_berkas[nomor]} di berkas ini.'})
                    continue
                nomor_di_berkas[nomor] = idx

            tipe = (row.get('customer_type') or '').strip()
            group = None
            if tipe:
                group = group_cache.get(tipe.lower())
                if group is None:
                    group, _ = CustomerGroup.objects.get_or_create(
                        nama=tipe, defaults={'dibuat_oleh': request.user}
                    )
                    group_cache[tipe.lower()] = group

            try:
                Customer.objects.create(
                    kode_pelanggan=(row.get('code') or '').strip(),
                    customer_group=group,
                    nama=nama,
                    email=(row.get('email') or '').strip(),
                    handphone=(row.get('phone') or '').strip(),
                    alamat=(row.get('address') or '').strip(),
                    kode_pos=(row.get('postal_code') or '').strip(),
                    jenis_kelamin=GENDER_IMPORT_MAP.get((row.get('gender') or '').strip().upper(), ''),
                    tanggal_lahir=_parsed_date(row.get('dob')),
                    tanggal_berakhir=_parsed_date(row.get('expiry_date')),
                    bekukan=_truthy(row.get('is_frozen')),
                    # Template Olsera tidak punya kolom country/province. Keduanya
                    # tetap dibaca kalau ada (template kita boleh menambahkannya),
                    # dan `negara` jatuh ke 'Indonesia' — default yang sama dengan
                    # form Tambah. Tanpa ini pelanggan hasil import ber-negara
                    # kosong sementara yang diketik manual ber-'Indonesia'.
                    negara=(row.get('country') or '').strip() or 'Indonesia',
                    provinsi=(row.get('province') or '').strip(),
                    kota=(row.get('city') or '').strip(),
                    kecamatan=(row.get('subdistrict') or '').strip(),
                    nama_perusahaan=(row.get('company') or '').strip(),
                    # Opsional — tidak ada di template Olsera, dibaca kalau kolomnya ada
                    # (mis. import data lama yang punya histori tanggal gabung/transaksi).
                    tanggal_bergabung=_parsed_date(row.get('join_date') or row.get('tanggal_gabung')),
                    transaksi_terakhir=_parsed_date(row.get('last_transaction_date') or row.get('transaksi_terakhir')),
                    terima_buletin=_truthy(row.get('accept_newsletter')),
                    batas_kredit=float(row.get('credit_limit') or 0),
                    loyalty_points=int(float(row.get('loyalty_points') or 0)),
                    catatan=(row.get('notes') or '').strip(),
                    dibuat_oleh=request.user,
                )
                created += 1
            except Exception as e:
                row_errors.append({'row': idx, 'message': str(e)})

        return Response({'created': created, 'total_rows': len(rows), 'errors': row_errors})


class CustomerNoteViewSet(viewsets.ModelViewSet):
    """Catatan Pelanggan: Pelanggan & Supplier > Catatan Pelanggan."""
    queryset = CustomerNote.objects.select_related('customer').prefetch_related('tags', 'entries', 'documents')
    serializer_class = CustomerNoteSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)


class CustomerNoteEntryViewSet(viewsets.ModelViewSet):
    """Entri catatan (log/riwayat berulang) di dalam satu CustomerNote. Filter: ?note=<id>."""
    queryset = CustomerNoteEntry.objects.all()
    serializer_class = CustomerNoteEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        note_id = self.request.query_params.get('note')
        if note_id:
            qs = qs.filter(note_id=note_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)


class CustomerNoteDocumentViewSet(viewsets.ModelViewSet):
    """Lampiran dokumen (gambar/PDF, maks. 5MB, maks. 5/catatan). Filter: ?note=<id>."""
    queryset = CustomerNoteDocument.objects.all()
    serializer_class = CustomerNoteDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def get_queryset(self):
        qs = super().get_queryset()
        note_id = self.request.query_params.get('note')
        if note_id:
            qs = qs.filter(note_id=note_id)
        return qs


class CustomerNoteTagViewSet(viewsets.ModelViewSet):
    """Tag bebas untuk Catatan Pelanggan — create bersifat get-or-create (idempoten by nama)."""
    queryset = CustomerNoteTag.objects.all()
    serializer_class = CustomerNoteTagSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        nama = (request.data.get('nama') or '').strip()
        if not nama:
            return Response({'nama': ['Nama tag wajib diisi.']}, status=400)
        tag, _ = CustomerNoteTag.objects.get_or_create(nama=nama)
        return Response(self.get_serializer(tag).data, status=201)


class CustomerReviewViewSet(viewsets.ModelViewSet):
    """Ulasan Pelanggan: Pelanggan & Supplier > Ulasan Pelanggan."""
    queryset = CustomerReview.objects.all()
    serializer_class = CustomerReviewSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)

    def update(self, request, *args, **kwargs):
        if self.get_object().sumber == 'survei':
            return Response({'error': 'Ulasan dari survei pelanggan tidak bisa diubah.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # Ulasan asli pelanggan hanya boleh dihapus Owner/Manager (mis. spam).
        if self.get_object().sumber == 'survei' and getattr(request.user, 'role', '') not in ('owner', 'manager'):
            return Response({'error': 'Hanya Owner/Manager yang bisa menghapus ulasan dari survei.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class SupplierViewSet(ToggleStatusMixin, viewsets.ModelViewSet):
    """Supplier: Pelanggan & Supplier > Supplier.

    Kasir diizinkan create/update (bukan cuma baca) atas instruksi eksplisit
    user 2026-08-10, supaya kasir bisa menambah supplier langsung dari Kasir
    tanpa lewat modul Pelanggan & Supplier. Staff tetap diblokir penuh.

    Tapi "Pengaturan Supplier" (akun_hutang/jatuh_tempo_hari, dipakai modul
    Akuntansi) sengaja DIKUNCI dari kasir (instruksi user 2026-08-13) — dua
    field itu ikut kebuka lewat permission umum di atas padahal harusnya
    cuma Owner/Manager/Admin, karena satu ViewSet ini melayani baik CRUD
    supplier dasar (boleh kasir) maupun setelan akuntansinya (bukan kasir).
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    # Admin/SPV Finance ditambahkan 2026-09-24 (lihat docstring permission).
    permission_classes = [IsOwnerManagerAdminKasirOrFinanceRole]

    _FIELD_PENGATURAN_TERKUNCI_KASIR = {'akun_hutang', 'jatuh_tempo_hari'}

    def _tolak_jika_kasir_ubah_pengaturan(self, request):
        if getattr(request.user, 'role', '') != 'kasir':
            return None
        if self._FIELD_PENGATURAN_TERKUNCI_KASIR & set(request.data.keys()):
            return Response(
                {'error': 'Kasir tidak diizinkan mengubah Pengaturan Supplier (akun hutang/jatuh tempo).'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def update(self, request, *args, **kwargs):
        tolak = self._tolak_jika_kasir_ubah_pengaturan(request)
        return tolak if tolak is not None else super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        tolak = self._tolak_jika_kasir_ubah_pengaturan(request)
        return tolak if tolak is not None else super().partial_update(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        tolak = self._tolak_jika_kasir_ubah_pengaturan(request)
        return tolak if tolak is not None else super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)

    @action(detail=False, methods=['post'], url_path='import-csv', parser_classes=[MultiPartParser])
    def import_csv(self, request):
        """Import massal supplier dari CSV (max. 500 baris)."""
        upload = request.FILES.get('file')
        if not upload:
            return Response({'error': 'File CSV tidak ditemukan.'}, status=400)

        try:
            decoded = upload.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response({'error': 'File harus berupa CSV dengan encoding UTF-8.'}, status=400)

        rows = list(csv.DictReader(io.StringIO(decoded)))
        if len(rows) > MAX_IMPORT_ROWS:
            return Response(
                {'error': f'Maksimal {MAX_IMPORT_ROWS} baris per import (file ini berisi {len(rows)} baris).'},
                status=400,
            )

        created = 0
        row_errors = []

        for idx, row in enumerate(rows, start=2):  # baris 1 adalah header
            # Cek field name / nama / Nama Pelanggan (sesuai header preview)
            nama = (row.get('name') or row.get('nama') or row.get('Nama Pelanggan') or '').strip()
            if not nama:
                row_errors.append({'row': idx, 'message': 'Kolom "name" atau "nama" wajib diisi.'})
                continue

            kontak_pic = (row.get('contact_person') or row.get('pic') or row.get('kontak_pic') or row.get('Personal Yg Dihubungi') or '').strip()
            email = (row.get('email') or '').strip()
            phone = (row.get('phone') or row.get('telpon') or row.get('Telpon') or '').strip()
            alamat = (row.get('address') or row.get('alamat') or row.get('Alamat') or '').strip()
            catatan = (row.get('notes') or row.get('catatan') or row.get('Catatan') or '').strip()
            negara = (row.get('country') or row.get('negara') or 'Indonesia').strip()
            provinsi = (row.get('province') or row.get('provinsi') or row.get('Propinsi') or '').strip()
            kota = (row.get('city') or row.get('kota') or '').strip()
            kode_pos = (row.get('postal_code') or row.get('kode_pos') or row.get('Kode Pos') or '').strip()

            is_active_val = row.get('status') or row.get('is_active')
            is_active = True
            if is_active_val is not None:
                is_active = _truthy(is_active_val)

            try:
                Supplier.objects.create(
                    nama=nama,
                    kontak_pic=kontak_pic,
                    email=email,
                    phone=phone,
                    alamat=alamat,
                    catatan=catatan,
                    negara=negara,
                    provinsi=provinsi,
                    kota=kota,
                    kode_pos=kode_pos,
                    is_active=is_active,
                    dibuat_oleh=request.user
                )
                created += 1
            except Exception as e:
                row_errors.append({'row': idx, 'message': str(e)})

        return Response({
            'created': created,
            'errors': row_errors
        }, status=201 if created > 0 else 400)

