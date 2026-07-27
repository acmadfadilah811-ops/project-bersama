import apiClient from '../api/apiClient';
import { notifyApiError } from './notify';

function filenameFromHeader(headerValue, fallback) {
  const match = /filename="?([^"]+)"?/i.exec(headerValue || '');
  return match ? match[1] : fallback;
}

// Download file lewat apiClient (bukan window.open langsung) supaya header
// Authorization (JWT dari localStorage, lihat api/apiClient.js) ikut terkirim
// -- window.open membuka tab baru tanpa header apa pun sehingga endpoint yang
// butuh login akan menolak dengan 401 alih-alih men-download file-nya. Nama
// file diambil dari Content-Disposition response (dibuat backend, perlu
// CORS_EXPOSE_HEADERS di settings.py), fallbackFilename dipakai kalau header
// itu tidak ada/tidak terbaca.
export async function downloadFile(url, fallbackFilename) {
  try {
    const res = await apiClient.get(url, { responseType: 'blob' });
    const filename = filenameFromHeader(res.headers['content-disposition'], fallbackFilename);
    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    notifyApiError(err, 'Gagal mengunduh file');
  }
}
