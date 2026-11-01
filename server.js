const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Storage paths
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(SCHEDULES_FILE)) fs.writeFileSync(SCHEDULES_FILE, JSON.stringify([]));

// Multer config for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'status-' + uniqueSuffix + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diperbolehkan!'));
        }
    }
});

// Helper for schedule storage
function getSchedules() {
    try {
        const data = fs.readFileSync(SCHEDULES_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        return [];
    }
}

function saveSchedules(schedules) {
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
}

// Global WhatsApp state
let sock = null;
let connectionStatus = 'connecting'; // 'connecting', 'qr_ready', 'connected', 'disconnected'
let qrCodeDataUrl = null;
let pairingCode = null;
let connectedUser = null;

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['WA Status Scheduler', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            try {
                qrCodeDataUrl = await QRCode.toDataURL(qr);
                connectionStatus = 'qr_ready';
                pairingCode = null;
                console.log('[WA] QR Code siap dipindai');
            } catch (err) {
                console.error('[WA] Gagal generate QR Code', err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[WA] Koneksi terputus. Alasan:', lastDisconnect?.error?.message, '| Reconnect:', shouldReconnect);
            connectionStatus = 'disconnected';
            qrCodeDataUrl = null;
            connectedUser = null;

            if (shouldReconnect) {
                setTimeout(startWhatsApp, 3000);
            }
        } else if (connection === 'open') {
            console.log('[WA] WhatsApp Berhasil Terhubung!');
            connectionStatus = 'connected';
            qrCodeDataUrl = null;
            pairingCode = null;
            connectedUser = {
                id: sock.user?.id || '',
                name: sock.user?.name || sock.user?.notify || 'Pengguna WhatsApp'
            };
        }
    });
}

// Start WhatsApp on launch
startWhatsApp();

// REST API Endpoints

// 1. Get connection status & QR
app.get('/api/connection-status', (req, res) => {
    res.json({
        status: connectionStatus,
        qr: qrCodeDataUrl,
        pairingCode: pairingCode,
        user: connectedUser
    });
});

// 2. Request pairing code (alternative to QR scan for mobile users)
app.post('/api/pairing-code', async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ error: 'Nomor telepon harus diisi!' });
    }

    try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        if (sock && !sock.authState.creds.registered) {
            const code = await sock.requestPairingCode(cleanPhone);
            pairingCode = code;
            res.json({ success: true, code });
        } else {
            res.status(400).json({ error: 'WhatsApp sudah terhubung atau socket belum siap.' });
        }
    } catch (err) {
        console.error('[WA] Error requesting pairing code:', err);
        res.status(500).json({ error: err.message || 'Gagal membuat pairing code' });
    }
});

// 3. Disconnect / Logout
app.post('/api/logout', async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
        }
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        connectionStatus = 'disconnected';
        connectedUser = null;
        qrCodeDataUrl = null;
        pairingCode = null;
        setTimeout(startWhatsApp, 1500);
        res.json({ success: true, message: 'Berhasil logout' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get all schedules
app.get('/api/schedules', (req, res) => {
    res.json(getSchedules());
});

// 5. Create new schedule
app.post('/api/schedules', upload.single('image'), (req, res) => {
    try {
        const { type, text, scheduledTimestamp } = req.body;

        if (!scheduledTimestamp) {
            return res.status(400).json({ error: 'Waktu jadwal harus diisi!' });
        }

        const targetTime = parseInt(scheduledTimestamp, 10);
        if (isNaN(targetTime) || targetTime <= Date.now()) {
            return res.status(400).json({ error: 'Waktu jadwal harus lebih dari waktu sekarang!' });
        }

        if (type === 'IMAGE' && !req.file) {
            return res.status(400).json({ error: 'Gambar harus diunggah untuk status tipe gambar!' });
        }

        if (type === 'TEXT' && (!text || !text.trim())) {
            return res.status(400).json({ error: 'Teks status tidak boleh kosong!' });
        }

        const schedules = getSchedules();
        const newSchedule = {
            id: Date.now().toString(),
            type: type || (req.file ? 'IMAGE' : 'TEXT'),
            text: text ? text.trim() : '',
            imagePath: req.file ? req.file.path : null,
            imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
            scheduledTimestamp: targetTime,
            status: 'PENDING',
            errorMessage: null,
            createdAt: Date.now()
        };

        schedules.push(newSchedule);
        saveSchedules(schedules);

        console.log(`[Jadwal] Status baru dijadwalkan untuk ${new Date(targetTime).toLocaleString('id-ID')}`);
        res.json({ success: true, schedule: newSchedule });
    } catch (err) {
        console.error('[Jadwal] Error creating schedule:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6. Delete schedule
app.delete('/api/schedules/:id', (req, res) => {
    const { id } = req.params;
    let schedules = getSchedules();
    const item = schedules.find(s => s.id === id);

    if (item && item.imagePath && fs.existsSync(item.imagePath)) {
        try { fs.unlinkSync(item.imagePath); } catch (e) {}
    }

    schedules = schedules.filter(s => s.id !== id);
    saveSchedules(schedules);
    res.json({ success: true, message: 'Jadwal berhasil dihapus' });
});

// Scheduler Engine: Runs every 20 seconds to process due schedules
setInterval(async () => {
    const schedules = getSchedules();
    const now = Date.now();
    let hasChanges = false;

    for (const schedule of schedules) {
        if (schedule.status === 'PENDING' && schedule.scheduledTimestamp <= now) {
            console.log(`[Scheduler] Memproses jadwal ID ${schedule.id} (${schedule.type})...`);

            if (connectionStatus !== 'connected' || !sock) {
                console.warn(`[Scheduler] Gagal kirim: WhatsApp belum terhubung!`);
                schedule.status = 'FAILED';
                schedule.errorMessage = 'WhatsApp sedang tidak terhubung ke server saat jadwal tiba';
                hasChanges = true;
                continue;
            }

            try {
                if (schedule.type === 'IMAGE' && schedule.imagePath && fs.existsSync(schedule.imagePath)) {
                    // Send Image status
                    const imageBuffer = fs.readFileSync(schedule.imagePath);
                    await sock.sendMessage('status@broadcast', {
                        image: imageBuffer,
                        caption: schedule.text || ''
                    });
                    console.log(`[Scheduler] Status Gambar ID ${schedule.id} berhasil terkirim!`);
                } else {
                    // Send Text status
                    await sock.sendMessage('status@broadcast', {
                        text: schedule.text
                    });
                    console.log(`[Scheduler] Status Teks ID ${schedule.id} berhasil terkirim!`);
                }

                schedule.status = 'COMPLETED';
                schedule.postedAt = Date.now();
                hasChanges = true;
            } catch (err) {
                console.error(`[Scheduler] Error mengirim status ID ${schedule.id}:`, err);
                schedule.status = 'FAILED';
                schedule.errorMessage = err.message || 'Gagal mengirim status ke WhatsApp';
                hasChanges = true;
            }
        }
    }

    if (hasChanges) {
        saveSchedules(schedules);
    }
}, 20000);

// Start HTTP server
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 WA Status Scheduler Web aktif di port ${PORT}`);
    console.log(`👉 Akses Dashboard: http://localhost:${PORT}`);
    console.log(`=================================================`);
});
