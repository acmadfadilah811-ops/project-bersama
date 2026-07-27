/**
 * notificationSounds.js
 * Utility untuk memainkan berbagai jenis bunyi notifikasi menggunakan Web Audio API.
 * Tidak membutuhkan file MP3 eksternal — semua dibangkitkan secara programatik.
 */

/**
 * Inisialisasi AudioContext (lazy, karena browser butuh user gesture)
 * Disimpan di module scope agar tidak dibuat ulang setiap panggilan.
 */
let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume jika suspended (browser policy)
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

/**
 * Buat envelope gain untuk fade-in/fade-out alami
 */
function createGain(ctx, peakVolume = 0.12, duration = 0.4) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(peakVolume, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  return gain;
}

/**
 * 🔔 Bunyi notifikasi umum — ding lembut dua nada
 * Digunakan untuk: notifikasi pop-up Dynamic Island biasa
 */
export function playChime() {
  try {
    const ctx = getAudioCtx();
    const notes = [880, 1046]; // A5 → C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = createGain(ctx, 0.08, 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.13);
      osc.start(ctx.currentTime + i * 0.13);
      osc.stop(ctx.currentTime + i * 0.13 + 0.3);
    });
  } catch (e) {
    console.warn('[notificationSounds] playChime blocked:', e.message);
  }
}

/**
 * 🚨 Bunyi peringatan absensi telat — nada urgensi menurun
 * Digunakan untuk: notifikasi staff terlambat/tidak masuk (Unlock Request masuk)
 */
export function playAlert() {
  try {
    const ctx = getAudioCtx();
    // Tiga nada menurun: C5 → A4 → G4
    const sequence = [523, 440, 392];
    sequence.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = createGain(ctx, 0.14, 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.25);
    });
  } catch (e) {
    console.warn('[notificationSounds] playAlert blocked:', e.message);
  }
}

/**
 * ✅ Bunyi sukses / disetujui — nada naik cerah
 * Digunakan untuk: approve unlock request, clock-in berhasil
 */
export function playSuccess() {
  try {
    const ctx = getAudioCtx();
    // Dua nada naik: G4 → C5
    const sequence = [392, 523];
    sequence.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = createGain(ctx, 0.10, 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.28);
    });
  } catch (e) {
    console.warn('[notificationSounds] playSuccess blocked:', e.message);
  }
}

/**
 * ❌ Bunyi tolak / error — nada rendah berat
 * Digunakan untuk: reject unlock request, error
 */
export function playReject() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = createGain(ctx, 0.12, 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.45);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn('[notificationSounds] playReject blocked:', e.message);
  }
}

/**
 * 💬 Bunyi pesan WA masuk — ping singkat
 * Digunakan untuk: pesan WhatsApp baru masuk / staff membalas
 */
export function playMessage() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = createGain(ctx, 0.09, 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  } catch (e) {
    console.warn('[notificationSounds] playMessage blocked:', e.message);
  }
}

/**
 * Helper: pilih bunyi berdasarkan tipe notifikasi
 */
export function playSoundForType(type) {
  switch (type) {
    case 'attendance':
    case 'permission':
      playAlert();
      break;
    case 'job':
      playSuccess();
      break;
    case 'message':
    case 'whatsapp':
      playMessage();
      break;
    case 'announcement':
    default:
      playChime();
      break;
  }
}
