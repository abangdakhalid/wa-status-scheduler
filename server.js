const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const QRCode = require('qrcode');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

// Prevent crashes on network blips, Bad MAC session errors, or unhandled promise rejections
process.on('uncaughtException', (err) => {
    const msg = err?.message || String(err);
    if (msg.includes('Bad MAC') || msg.includes('Failed to decrypt')) {
        return; // Silently ignore incoming chat decryption mismatch (we only post status)
    }
    console.error('[System] Uncaught Exception:', msg);
});
process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || String(reason);
    if (msg.includes('Bad MAC') || msg.includes('Failed to decrypt')) {
        return;
    }
    console.error('[System] Unhandled Rejection:', msg);
});

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
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const CLOUDFLARED_BIN = path.join(__dirname, 'bin', 'cloudflared.exe');

let contactsStore = new Set([
    '6285161510461@s.whatsapp.net',
    '6281284147997@s.whatsapp.net',
    '6281385677521@s.whatsapp.net',
    '6285151129879@s.whatsapp.net',
    '6285819598987@s.whatsapp.net',
    '6285894981403@s.whatsapp.net',
    '6289612748809@s.whatsapp.net',
    '6289624645979@s.whatsapp.net',
    '6289635606769@s.whatsapp.net',
    '6281216738563@s.whatsapp.net',
    '6282345546336@s.whatsapp.net',
    '6281293615295@s.whatsapp.net'
]);

function loadSavedContacts() {
    if (fs.existsSync(CONTACTS_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
            if (Array.isArray(data)) {
                data.forEach(jid => contactsStore.add(jid));
            }
        } catch (e) {}
    }
}
loadSavedContacts();

function saveContacts() {
    try {
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify(Array.from(contactsStore), null, 2));
    } catch (e) {}
}

function getStatusRecipients() {
    const list = new Set();
    
    // Always include user's own number so it appears in "Status Saya"
    if (sock?.user?.id) {
        const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        list.add(myJid);
    }

    // Include valid contact JIDs from synced contactsStore
    for (const jid of contactsStore) {
        if (typeof jid === 'string' && jid.endsWith('@s.whatsapp.net')) {
            const num = jid.split('@')[0];
            // Valid international phone number format (10-14 digits starting with real country code)
            if (/^62[0-9]{8,12}$/.test(num) || /^[1-9][0-9]{8,13}$/.test(num)) {
                list.add(jid);
            }
        }
    }

    return Array.from(list);
}

let cloudflareUrl = null;
let tunnelProcess = null;

function startCloudflareTunnel() {
    if (!fs.existsSync(CLOUDFLARED_BIN)) {
        console.log('[Cloudflare] Binari cloudflared.exe belum ditemukan.');
        return;
    }

    console.log('[Cloudflare] Menghubungkan ke Cloudflare Tunnel...');
    try {
        tunnelProcess = spawn(CLOUDFLARED_BIN, ['tunnel', '--url', `http://localhost:${PORT}`]);

        const parseUrl = (data) => {
            const text = data.toString();
            const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
            if (match && !cloudflareUrl) {
                cloudflareUrl = match[0];
                console.log('=================================================');
                console.log(`☁️  CLOUDFLARE TUNNEL BERHASIL AKTIF!`);
                console.log(`🌐 Link Cloudflare (Buka di HP): ${cloudflareUrl}`);
                console.log('=================================================');
            }
        };

        tunnelProcess.stdout.on('data', parseUrl);
        tunnelProcess.stderr.on('data', parseUrl);

        tunnelProcess.on('close', (code) => {
            console.log(`[Cloudflare] Tunnel tertutup (kode ${code}). Menghubungkan ulang dalam 5 detik...`);
            cloudflareUrl = null;
            setTimeout(startCloudflareTunnel, 5000);
        });
    } catch (err) {
        console.error('[Cloudflare] Gagal menjalankan tunnel:', err.message);
    }
}

process.on('exit', () => {
    if (tunnelProcess) {
        try { tunnelProcess.kill(); } catch (e) {}
    }
});

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
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
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
const sentMessagesStore = new Map();

async function startWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        let version;
        try {
            const v = await fetchLatestBaileysVersion();
            version = v.version;
        } catch (e) {
            console.warn('[WA] Menggunakan versi fallback Baileys');
        }

        sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ['WA Status Scheduler', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            syncFullHistory: false,          // Never download full message history from phone
            markOnlineOnConnect: false,      // Keep connection lightweight
            fireInitQueries: false,          // Skip heavy initial app state queries
            generateHighQualityLinkPreview: false,
            getMessage: async (key) => sentMessagesStore.get(key.id)
        });

        sock.ev.on('creds.update', saveCreds);

        // Ignore incoming messages to prevent memory bloat and session sync issues
        sock.ev.on('messages.upsert', () => {});

        // Automatically capture contact phone numbers (sender_pn / participant_pn) from incoming frames
        sock.ws.on('frame', (frame) => {
            try {
                const str = JSON.stringify(frame);
                const matches = str.match(/62[0-9]{8,13}@s\.whatsapp\.net/g);
                if (matches && matches.length > 0) {
                    let added = false;
                    for (const m of matches) {
                        if (!contactsStore.has(m)) {
                            contactsStore.add(m);
                            added = true;
                        }
                    }
                    if (added) saveContacts();
                }
            } catch (e) {}
        });

        sock.ws.on('CB:ack', (node) => {
            if (node?.attrs?.from === 'status@broadcast' && node?.attrs?.class === 'message') {
                console.log(`[WA ACK] Status berhasil disiarkan oleh server WhatsApp! (Penerima aktif: ${node.attrs.count || 0})`);
            }
        });

        sock.ws.on('CB:receipt', (node) => {
            if (node?.attrs?.from === 'status@broadcast' && node?.attrs?.type === 'sender') {
                console.log(`[WA RECEIPT] Status berhasil disinkronkan ke HP utama Anda ("Status Saya")! ID: ${node.attrs.id}`);
            }
        });

        // Track contacts to broadcast status to
        sock.ev.on('contacts.upsert', (newContacts) => {
            for (const c of newContacts) {
                if (c.id && c.id.endsWith('@s.whatsapp.net')) {
                    contactsStore.add(c.id);
                }
            }
            saveContacts();
        });

        sock.ev.on('contacts.update', (updatedContacts) => {
            for (const c of updatedContacts) {
                if (c.id && c.id.endsWith('@s.whatsapp.net')) {
                    contactsStore.add(c.id);
                }
            }
            saveContacts();
        });

        sock.ev.on('messaging-history.set', ({ contacts, chats }) => {
            if (contacts) {
                for (const c of contacts) {
                    if (c.id && c.id.endsWith('@s.whatsapp.net')) {
                        contactsStore.add(c.id);
                    }
                }
            }
            if (chats) {
                for (const c of chats) {
                    if (c.id && c.id.endsWith('@s.whatsapp.net')) {
                        contactsStore.add(c.id);
                    }
                }
            }
            saveContacts();
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    qrCodeDataUrl = await QRCode.toDataURL(qr, { scale: 8, margin: 2 });
                    connectionStatus = 'qr_ready';
                    pairingCode = null;
                    console.log('[WA] QR Code baru siap dipindai');
                } catch (err) {
                    console.error('[WA] Gagal generate QR Code', err);
                }
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                console.log('[WA] Koneksi terputus. Kode:', statusCode);
                connectionStatus = 'disconnected';
                qrCodeDataUrl = null;
                connectedUser = null;

                if (sock) {
                    try { sock.ev.removeAllListeners(); } catch (e) {}
                }

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    console.log('[WA] Sesi logout/kadaluwarsa. Membersihkan autentikasi...');
                    if (fs.existsSync(AUTH_DIR)) {
                        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
                    }
                    setTimeout(startWhatsApp, 1500);
                } else {
                    console.log('[WA] Menghubungkan ulang dalam 3 detik...');
                    setTimeout(startWhatsApp, 3000);
                }
            } else if (connection === 'open') {
                console.log('[WA] WhatsApp Berhasil Terhubung!');
                connectionStatus = 'connected';
                qrCodeDataUrl = null;
                pairingCode = null;
                connectedUser = {
                    id: sock.user?.id ? sock.user.id.split(':')[0] : '',
                    name: sock.user?.name || sock.user?.notify || 'Nomor WhatsApp Anda'
                };
            }
        });
    } catch (e) {
        console.error('[WA] Gagal inisialisasi socket:', e);
        connectionStatus = 'disconnected';
        setTimeout(startWhatsApp, 5000);
    }
}

// Start WhatsApp on launch
startWhatsApp();

// Shared status sender
async function postStatusToWhatsApp(schedule) {
    // If socket is reconnecting, wait up to 10 seconds before giving up
    if (connectionStatus !== 'connected' || !sock) {
        console.log('[WA] Socket belum siap, menunggu koneksi terhubung hingga 10 detik...');
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (connectionStatus === 'connected' && sock) {
                console.log('[WA] Koneksi siap!');
                break;
            }
        }
    }

    if (connectionStatus !== 'connected' || !sock) {
        throw new Error('WhatsApp sedang menyambung ulang ke HP. Mohon coba klik Kirim Sekarang lagi dalam 5 detik.');
    }

    const statusJidList = getStatusRecipients();
    console.log(`[WA] Mengirim status broadcast ke ${statusJidList.length} penerima (termasuk nomor sendiri)...`);

    const broadcastOptions = {
        statusJidList: statusJidList,
        broadcast: true
    };

    let res;
    if (schedule.type === 'IMAGE' && schedule.imagePath && fs.existsSync(schedule.imagePath)) {
        const imageBuffer = fs.readFileSync(schedule.imagePath);
        res = await sock.sendMessage('status@broadcast', {
            image: imageBuffer,
            caption: schedule.text || ''
        }, broadcastOptions);
    } else {
        res = await sock.sendMessage('status@broadcast', {
            text: schedule.text || ''
        }, {
            ...broadcastOptions,
            backgroundColor: schedule.backgroundColor || '#075E54',
            font: 1
        });
    }
    if (res?.key?.id && res?.message) {
        sentMessagesStore.set(res.key.id, res.message);
    }
    return res;
}

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

// 1b. Get Cloudflare & local access URLs
app.get('/api/tunnel-info', (req, res) => {
    res.json({
        cloudflareUrl: cloudflareUrl,
        localUrl: `http://localhost:${PORT}`,
        wifiUrl: `http://192.168.1.11:${PORT}`
    });
});

// 1c. Send Instant Status (No schedule needed, post immediately)
app.post('/api/send-instant', upload.single('image'), async (req, res) => {
    try {
        const { type, text, backgroundColor } = req.body;
        const statusType = type || (req.file ? 'IMAGE' : 'TEXT');

        if (statusType === 'IMAGE' && !req.file) {
            return res.status(400).json({ error: 'Silakan pilih gambar terlebih dahulu!' });
        }
        if (statusType === 'TEXT' && (!text || !text.trim())) {
            return res.status(400).json({ error: 'Teks status tidak boleh kosong!' });
        }

        const instantSchedule = {
            id: 'instant-' + Date.now(),
            type: statusType,
            text: text ? text.trim() : '',
            backgroundColor: backgroundColor || '#075E54',
            imagePath: req.file ? req.file.path : null
        };

        await postStatusToWhatsApp(instantSchedule);
        console.log('[Instant] Status berhasil dikirim langsung ke WhatsApp!');

        res.json({ success: true, message: 'Status berhasil dikirim langsung ke WhatsApp!' });
    } catch (err) {
        console.error('[Instant] Gagal kirim langsung:', err);
        res.status(500).json({ error: err.message || 'Gagal mengirim status langsung' });
    }
});

// 2. Refresh QR Code (Clears state & forces fresh QR immediately)
app.post('/api/refresh-qr', async (req, res) => {
    try {
        console.log('[WA] Meminta QR Code baru...');
        if (connectionStatus !== 'connected') {
            if (sock) {
                try { sock.end(new Error('Refreshing QR')); } catch (e) {}
                sock = null;
            }
            if (fs.existsSync(AUTH_DIR)) {
                try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
            }
            connectionStatus = 'connecting';
            qrCodeDataUrl = null;
            pairingCode = null;
            setTimeout(startWhatsApp, 1000);
            return res.json({ success: true, message: 'QR Code baru sedang dibuat...' });
        } else {
            return res.json({ success: true, message: 'WhatsApp sudah terhubung!' });
        }
    } catch (err) {
        console.error('[WA] Error refresh QR:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Request pairing code (alternative to QR scan for mobile users)
app.post('/api/pairing-code', async (req, res) => {
    let { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ error: 'Nomor telepon harus diisi!' });
    }

    try {
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        // Auto convert 08xx to 628xx
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '62' + cleanPhone.slice(1);
        } else if (!cleanPhone.startsWith('62')) {
            cleanPhone = '62' + cleanPhone;
        }

        if (sock && !sock.authState.creds.registered) {
            const code = await sock.requestPairingCode(cleanPhone);
            pairingCode = code;
            res.json({ success: true, code });
        } else {
            res.status(400).json({ error: 'WhatsApp sudah terhubung atau sistem belum siap.' });
        }
    } catch (err) {
        console.error('[WA] Error requesting pairing code:', err);
        res.status(500).json({ error: err.message || 'Gagal membuat pairing code' });
    }
});

// 4. Disconnect / Logout
app.post('/api/logout', async (req, res) => {
    try {
        if (sock) {
            try { await sock.logout(); } catch (e) {}
        }
        if (fs.existsSync(AUTH_DIR)) {
            try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
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

// 5. Get all schedules
app.get('/api/schedules', (req, res) => {
    res.json(getSchedules());
});

// 6. Create new schedule (Supports ONCE, DAILY, and CUSTOM_DAYS)
app.post('/api/schedules', upload.single('image'), (req, res) => {
    try {
        const {
            type,
            text,
            backgroundColor,
            repeatType,       // 'ONCE' | 'DAILY' | 'CUSTOM_DAYS'
            timeOfDay,        // '08:30' (HH:mm)
            daysOfWeek,       // JSON string array e.g. '[1,3,5]'
            scheduledTimestamp
        } = req.body;

        const mode = repeatType || 'ONCE';

        if (type === 'IMAGE' && !req.file) {
            return res.status(400).json({ error: 'Silakan pilih gambar terlebih dahulu!' });
        }

        if (type === 'TEXT' && (!text || !text.trim())) {
            return res.status(400).json({ error: 'Teks status tidak boleh kosong!' });
        }

        let targetTime = null;
        let parsedDays = [];

        if (mode === 'ONCE') {
            if (!scheduledTimestamp) {
                return res.status(400).json({ error: 'Waktu tanggal & jam harus ditentukan!' });
            }
            targetTime = parseInt(scheduledTimestamp, 10);
            if (isNaN(targetTime) || targetTime <= Date.now() - 60000) {
                return res.status(400).json({ error: 'Waktu jadwal harus lebih dari waktu sekarang!' });
            }
        } else {
            // DAILY or CUSTOM_DAYS requires timeOfDay (HH:mm)
            if (!timeOfDay || !/^\d{2}:\d{2}$/.test(timeOfDay)) {
                return res.status(400).json({ error: 'Jam posting harus ditentukan (format JJ:MM)!' });
            }

            if (mode === 'CUSTOM_DAYS') {
                try {
                    parsedDays = JSON.parse(daysOfWeek || '[]');
                } catch (e) {
                    parsedDays = [];
                }
                parsedDays = parsedDays.map(d => parseInt(d, 10)).filter(d => !isNaN(d));
                if (!Array.isArray(parsedDays) || parsedDays.length === 0) {
                    return res.status(400).json({ error: 'Pilih minimal satu hari dalam seminggu!' });
                }
            }
        }

        const now = new Date();
        const todayDateStr = now.toLocaleDateString('en-CA');
        const currentHourStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        let initialLastTriggeredDate = null;
        // If daily or custom day schedule is set for a time that already passed today, start from tomorrow
        if (mode === 'DAILY') {
            if (currentHourStr >= timeOfDay) {
                initialLastTriggeredDate = todayDateStr;
            }
        } else if (mode === 'CUSTOM_DAYS') {
            const currentDayOfWeek = now.getDay();
            if (parsedDays.includes(currentDayOfWeek) && currentHourStr >= timeOfDay) {
                initialLastTriggeredDate = todayDateStr;
            }
        }

        const schedules = getSchedules();
        const newSchedule = {
            id: Date.now().toString(),
            type: type || (req.file ? 'IMAGE' : 'TEXT'),
            text: text ? text.trim() : '',
            backgroundColor: backgroundColor || '#075E54',
            imagePath: req.file ? req.file.path : null,
            imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
            repeatType: mode,
            timeOfDay: timeOfDay || null,
            daysOfWeek: parsedDays,
            scheduledTimestamp: targetTime,
            status: mode === 'ONCE' ? 'PENDING' : 'ACTIVE',
            lastTriggeredDate: initialLastTriggeredDate,
            errorMessage: null,
            createdAt: Date.now()
        };

        schedules.push(newSchedule);
        saveSchedules(schedules);

        console.log(`[Jadwal] Jadwal baru dibuat: tipe ${mode}`);
        res.json({ success: true, schedule: newSchedule });
    } catch (err) {
        console.error('[Jadwal] Error creating schedule:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7. Send Immediately (Test / Instant Post)
app.post('/api/schedules/:id/send-now', async (req, res) => {
    const { id } = req.params;
    const schedules = getSchedules();
    const item = schedules.find(s => s.id === id);

    if (!item) {
        return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
    }

    try {
        await postStatusToWhatsApp(item);
        if (item.repeatType === 'ONCE') {
            item.status = 'COMPLETED';
        }
        item.postedAt = Date.now();
        item.errorMessage = null;
        saveSchedules(schedules);
        res.json({ success: true, message: 'Status berhasil dikirim ke WhatsApp!' });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Gagal mengirim status' });
    }
});

// 8. Delete schedule
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

// Scheduler Engine: Runs every 15 seconds to process due schedules
setInterval(async () => {
    const schedules = getSchedules();
    const now = new Date();
    const nowTimestamp = now.getTime();

    // Local YYYY-MM-DD
    const todayDateStr = now.toLocaleDateString('en-CA');
    // Local HH:mm (e.g. "09:30")
    const currentHourStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    // Day of week: 0=Minggu, 1=Senin, ..., 6=Sabtu
    const currentDayOfWeek = now.getDay();

    let hasChanges = false;

    for (const schedule of schedules) {
        let isDue = false;

        if (schedule.repeatType === 'ONCE') {
            if (schedule.status === 'PENDING' && schedule.scheduledTimestamp && schedule.scheduledTimestamp <= nowTimestamp) {
                isDue = true;
            }
        } else if (schedule.repeatType === 'DAILY') {
            if (schedule.status === 'ACTIVE' && schedule.timeOfDay) {
                if (schedule.lastTriggeredDate !== todayDateStr && currentHourStr >= schedule.timeOfDay) {
                    isDue = true;
                }
            }
        } else if (schedule.repeatType === 'CUSTOM_DAYS') {
            if (schedule.status === 'ACTIVE' && schedule.timeOfDay && Array.isArray(schedule.daysOfWeek)) {
                const days = schedule.daysOfWeek.map(d => parseInt(d, 10));
                if (days.includes(currentDayOfWeek)) {
                    if (schedule.lastTriggeredDate !== todayDateStr && currentHourStr >= schedule.timeOfDay) {
                        isDue = true;
                    }
                }
            }
        }

        if (isDue) {
            console.log(`[Scheduler] Mengeksekusi jadwal ${schedule.id} (${schedule.repeatType})...`);
            try {
                await postStatusToWhatsApp(schedule);
                console.log(`[Scheduler] Status ${schedule.id} berhasil terkirim!`);

                if (schedule.repeatType === 'ONCE') {
                    schedule.status = 'COMPLETED';
                }
                schedule.lastTriggeredDate = todayDateStr;
                schedule.postedAt = nowTimestamp;
                schedule.errorMessage = null;
                hasChanges = true;
            } catch (err) {
                console.error(`[Scheduler] Gagal kirim status ${schedule.id}:`, err.message);
                if (schedule.repeatType === 'ONCE') {
                    schedule.status = 'FAILED';
                }
                schedule.errorMessage = err.message || 'Gagal mengirim status';
                hasChanges = true;
            }
        }
    }

    if (hasChanges) {
        saveSchedules(schedules);
    }
}, 15000);

// Start HTTP server
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 WA Status Scheduler Web aktif di port ${PORT}`);
    console.log(`👉 Akses Dashboard: http://localhost:${PORT}`);
    console.log(`=================================================`);
    startCloudflareTunnel();
});
