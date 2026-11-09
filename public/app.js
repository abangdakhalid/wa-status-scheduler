document.addEventListener('DOMContentLoaded', () => {
    // State
    let selectedColor = '#075E54';
    let currentFilter = 'all';
    let allSchedules = [];
    let countdownInterval = null;

    // UI References
    const connectionBadge = document.getElementById('connectionBadge');
    const connectionText = document.getElementById('connectionText');
    const connectedView = document.getElementById('connectedView');
    const disconnectedView = document.getElementById('disconnectedView');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userPhoneDisplay = document.getElementById('userPhoneDisplay');
    const btnLogout = document.getElementById('btnLogout');

    // Tabs & Auth
    const segmentBtns = document.querySelectorAll('.segment-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const phoneInput = document.getElementById('phoneInput');
    const btnRequestPairing = document.getElementById('btnRequestPairing');
    const pairingResultBox = document.getElementById('pairingResultBox');
    const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
    const btnCopyCode = document.getElementById('btnCopyCode');
    const qrImg = document.getElementById('qrImg');
    const qrSpinner = document.getElementById('qrSpinner');

    // Composer & Mockup
    const statusForm = document.getElementById('statusForm');
    const typeCards = document.querySelectorAll('.type-card');
    const colorPickerRow = document.getElementById('colorPickerRow');
    const colorDots = document.querySelectorAll('.color-dot');
    const imageUploaderRow = document.getElementById('imageUploaderRow');
    const fileImage = document.getElementById('fileImage');
    const dropZone = document.getElementById('dropZone');
    const dropPrompt = document.getElementById('dropPrompt');
    const thumbWrapper = document.getElementById('thumbWrapper');
    const thumbImg = document.getElementById('thumbImg');
    const btnRemoveImage = document.getElementById('btnRemoveImage');
    const textContent = document.getElementById('textContent');
    const charCounter = document.getElementById('charCounter');
    const presetPills = document.querySelectorAll('.preset-pill');
    const datetimeSchedule = document.getElementById('datetimeSchedule');
    const btnSubmit = document.getElementById('btnSubmit');

    // Phone Mockup Elements
    const mockupScreen = document.getElementById('mockupScreen');
    const mockupTextBody = document.getElementById('mockupTextBody');
    const mockupTextContent = document.getElementById('mockupTextContent');
    const mockupImageBody = document.getElementById('mockupImageBody');
    const mockupCaptionBox = document.getElementById('mockupCaptionBox');
    const mockupCaptionText = document.getElementById('mockupCaptionText');
    const mockupScheduledTime = document.getElementById('mockupScheduledTime');

    // Timeline Grid
    const filterChips = document.querySelectorAll('.filter-chip');
    const schedulesGrid = document.getElementById('schedulesGrid');

    // --- Toast Notification Helper ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
        toast.innerHTML = `<span style="font-weight: 800;">${icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // --- Datetime Helper ---
    function formatToLocalISO(date) {
        const tzOffset = date.getTimezoneOffset() * 60000;
        return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    }

    // Initialize Default Datetime (+10 minutes)
    const initialTime = new Date(Date.now() + 10 * 60000);
    datetimeSchedule.value = formatToLocalISO(initialTime);
    datetimeSchedule.min = formatToLocalISO(new Date());

    // Update Mockup Scheduled Time Label
    function updateMockupTimeLabel() {
        const val = datetimeSchedule.value;
        if (val) {
            const d = new Date(val);
            mockupScheduledTime.textContent = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } else {
            mockupScheduledTime.textContent = 'Baru saja';
        }
    }
    datetimeSchedule.addEventListener('input', updateMockupTimeLabel);
    updateMockupTimeLabel();

    // --- Quick Timing Presets ---
    presetPills.forEach(pill => {
        pill.addEventListener('click', () => {
            presetPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const now = new Date();
            if (pill.dataset.minutes) {
                const mins = parseInt(pill.dataset.minutes, 10);
                const target = new Date(now.getTime() + mins * 60000);
                datetimeSchedule.value = formatToLocalISO(target);
            } else if (pill.dataset.preset === 'tomorrow-morning') {
                const target = new Date();
                target.setDate(target.getDate() + 1);
                target.setHours(7, 0, 0, 0);
                datetimeSchedule.value = formatToLocalISO(target);
            } else if (pill.dataset.preset === 'tomorrow-evening') {
                const target = new Date();
                target.setDate(target.getDate() + 1);
                target.setHours(19, 0, 0, 0);
                datetimeSchedule.value = formatToLocalISO(target);
            }
            updateMockupTimeLabel();
        });
    });

    // --- Segmented Control (Pairing Code vs QR) ---
    segmentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            segmentBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const target = btn.dataset.tab === 'pairing' ? 'tabPairing' : 'tabQr';
            document.getElementById(target).classList.add('active');
        });
    });

    // --- Type Switcher (TEXT vs IMAGE) ---
    typeCards.forEach(card => {
        card.addEventListener('click', () => {
            typeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input[type="radio"]');
            radio.checked = true;

            if (radio.value === 'IMAGE') {
                imageUploaderRow.style.display = 'block';
                colorPickerRow.style.display = 'none';
                textContent.placeholder = 'Tulis caption gambar status (opsional)...';
                mockupTextBody.style.display = 'none';
                mockupImageBody.style.display = 'block';
                mockupCaptionBox.style.display = textContent.value.trim() ? 'block' : 'none';
            } else {
                imageUploaderRow.style.display = 'none';
                colorPickerRow.style.display = 'block';
                textContent.placeholder = 'Tulis apa yang ingin Anda bagikan ke status WhatsApp...';
                mockupTextBody.style.display = 'flex';
                mockupImageBody.style.display = 'none';
                mockupCaptionBox.style.display = 'none';
                mockupScreen.style.backgroundColor = selectedColor;
            }
        });
    });

    // --- Color Picker ---
    colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
            colorDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            selectedColor = dot.dataset.color;
            mockupScreen.style.backgroundColor = selectedColor;
        });
    });

    // --- Live Text Sync to Mockup & Counter ---
    textContent.addEventListener('input', () => {
        const val = textContent.value;
        charCounter.textContent = `${val.length} karakter`;

        const isImage = document.querySelector('input[name="statusType"]:checked').value === 'IMAGE';
        if (isImage) {
            mockupCaptionText.textContent = val || 'Caption foto...';
            mockupCaptionBox.style.display = val.trim() ? 'block' : 'none';
        } else {
            mockupTextContent.textContent = val || 'Tulis pesan status Anda di formulir...';
        }
    });

    // --- Image Upload & Mockup Sync ---
    fileImage.addEventListener('change', () => {
        const file = fileImage.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                thumbImg.src = dataUrl;
                thumbWrapper.style.display = 'block';
                dropPrompt.style.display = 'none';

                mockupImageBody.src = dataUrl;
                mockupImageBody.style.display = 'block';
                mockupTextBody.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    btnRemoveImage.addEventListener('click', (e) => {
        e.stopPropagation();
        fileImage.value = '';
        thumbImg.src = '';
        thumbWrapper.style.display = 'none';
        dropPrompt.style.display = 'block';
        mockupImageBody.src = '';
        mockupImageBody.style.display = 'none';
    });

    // --- Copy Pairing Code Button ---
    btnCopyCode.addEventListener('click', () => {
        const code = pairingCodeDisplay.textContent.replace(/\s+/g, '');
        if (code && code !== '--------') {
            navigator.clipboard.writeText(code).then(() => {
                showToast('Kode berhasil disalin ke clipboard!', 'success');
            }).catch(() => {
                showToast(`Salin manual: ${code}`, 'info');
            });
        }
    });

    // --- Request Pairing Code ---
    btnRequestPairing.addEventListener('click', async () => {
        let phone = phoneInput.value.trim();
        if (!phone) {
            showToast('Silakan masukkan nomor WhatsApp Anda!', 'error');
            phoneInput.focus();
            return;
        }

        // Format phone: if starts with 08, convert to 628
        phone = phone.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.slice(1);
        else if (!phone.startsWith('62')) phone = '62' + phone;

        btnRequestPairing.disabled = true;
        btnRequestPairing.innerHTML = '<span>Meminta...</span>';

        try {
            const res = await fetch('/api/pairing-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();

            if (data.success && data.code) {
                // Format code with space in middle: e.g. ABCD-1234 -> ABCD 1234
                const formatted = data.code.includes('-') ? data.code.replace('-', ' ') : `${data.code.slice(0, 4)} ${data.code.slice(4)}`;
                pairingCodeDisplay.textContent = formatted;
                pairingResultBox.style.display = 'block';
                showToast('Kode 8 Digit siap! Cek notifikasi WhatsApp di HP Anda.', 'success');
            } else {
                showToast(data.error || 'Gagal membuat kode pairing.', 'error');
            }
        } catch (err) {
            showToast('Koneksi terputus ke server.', 'error');
        } finally {
            btnRequestPairing.disabled = false;
            btnRequestPairing.innerHTML = `
                <span>Dapatkan Kode</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
            `;
        }
    });

    // --- Logout ---
    btnLogout.addEventListener('click', async () => {
        if (!confirm('Putuskan koneksi WhatsApp dari server?')) return;
        try {
            await fetch('/api/logout', { method: 'POST' });
            showToast('Koneksi WhatsApp diputuskan.', 'info');
            checkConnection();
        } catch (e) {
            showToast('Gagal memutuskan koneksi.', 'error');
        }
    });

    // --- Submit Schedule Form ---
    statusForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedType = document.querySelector('input[name="statusType"]:checked').value;
        const textVal = textContent.value.trim();
        const dateVal = datetimeSchedule.value;

        if (!dateVal) {
            showToast('Tentukan waktu tayang status!', 'error');
            return;
        }

        const targetTimestamp = new Date(dateVal).getTime();
        if (targetTimestamp <= Date.now()) {
            showToast('Waktu posting harus lebih dari waktu saat ini!', 'error');
            return;
        }

        if (selectedType === 'IMAGE' && (!fileImage.files || !fileImage.files[0])) {
            showToast('Silakan pilih berkas gambar yang ingin diunggah!', 'error');
            return;
        }

        if (selectedType === 'TEXT' && !textVal) {
            showToast('Silakan tulis isi status teks!', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('type', selectedType);
        formData.append('text', textVal);
        formData.append('scheduledTimestamp', targetTimestamp);
        formData.append('backgroundColor', selectedColor);
        if (selectedType === 'IMAGE' && fileImage.files[0]) {
            formData.append('image', fileImage.files[0]);
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>Menyimpan Jadwal...</span>`;

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                showToast('Jadwal status berhasil disimpan!', 'success');
                textContent.value = '';
                charCounter.textContent = '0 karakter';
                mockupTextContent.textContent = 'Tulis pesan status Anda di formulir...';
                mockupCaptionBox.style.display = 'none';

                if (selectedType === 'IMAGE') {
                    fileImage.value = '';
                    thumbImg.src = '';
                    thumbWrapper.style.display = 'none';
                    dropPrompt.style.display = 'block';
                    mockupImageBody.src = '';
                    mockupImageBody.style.display = 'none';
                }

                loadSchedules();
            } else {
                showToast(data.error || 'Gagal menjadwalkan status', 'error');
            }
        } catch (err) {
            showToast('Terjadi kesalahan jaringan.', 'error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                <span>Simpan &amp; Jadwalkan Status</span>
            `;
        }
    });

    // --- Filter Buttons ---
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            renderSchedules();
        });
    });

    // --- Polling WhatsApp Connection ---
    async function checkConnection() {
        try {
            const res = await fetch('/api/connection-status');
            const data = await res.json();

            if (data.status === 'connected') {
                connectionBadge.className = 'connection-pill pill-connected';
                connectionText.textContent = 'WhatsApp Terhubung';
                connectedView.style.display = 'flex';
                disconnectedView.style.display = 'none';

                userNameDisplay.textContent = data.user?.name || 'WhatsApp Anda';
                userPhoneDisplay.textContent = data.user?.id ? `Nomor: +${data.user.id}` : 'Server cloud aktif dan siap mengirim status 24/7.';
            } else {
                connectionBadge.className = 'connection-pill pill-disconnected';
                connectionText.textContent = 'Belum Terhubung';
                connectedView.style.display = 'none';
                disconnectedView.style.display = 'block';

                if (data.qr) {
                    qrImg.src = data.qr;
                    qrImg.style.display = 'block';
                    qrSpinner.style.display = 'none';
                } else {
                    qrImg.style.display = 'none';
                    qrSpinner.style.display = 'block';
                }
            }
        } catch (err) {
            connectionBadge.className = 'connection-pill pill-disconnected';
            connectionText.textContent = 'Server Offline';
        }
    }

    // --- Load & Render Schedules ---
    async function loadSchedules() {
        try {
            const res = await fetch('/api/schedules');
            allSchedules = await res.json();
            renderSchedules();
        } catch (err) {
            console.error('Failed to load schedules:', err);
        }
    }

    function renderSchedules() {
        let filtered = allSchedules;
        if (currentFilter !== 'all') {
            filtered = allSchedules.filter(s => s.status === currentFilter);
        }

        // Sort pending first, then by scheduledTimestamp ascending
        filtered.sort((a, b) => {
            if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
            if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
            return a.scheduledTimestamp - b.scheduledTimestamp;
        });

        if (filtered.length === 0) {
            schedulesGrid.innerHTML = `
                <div class="empty-box">
                    <div class="empty-icon-wrap">📭</div>
                    <p>Belum ada jadwal status pada kategori ini.</p>
                </div>
            `;
            return;
        }

        schedulesGrid.innerHTML = filtered.map(item => {
            const dateObj = new Date(item.scheduledTimestamp);
            const dateStr = dateObj.toLocaleString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Status Badge & Countdown
            let statusBadge = '';
            let countdownHtml = '';
            let actionSendBtn = '';

            if (item.status === 'PENDING') {
                statusBadge = '<span class="status-badge-pill badge-pending">MENUNGGU</span>';
                countdownHtml = `<span class="countdown-badge" data-time="${item.scheduledTimestamp}">⏳ Menghitung...</span>`;
                actionSendBtn = `
                    <button class="btn-action-send" onclick="sendScheduleNow('${item.id}')" title="Kirim status ini sekarang ke WhatsApp">
                        ⚡ Kirim Sekarang
                    </button>
                `;
            } else if (item.status === 'COMPLETED') {
                statusBadge = '<span class="status-badge-pill badge-completed">✓ TERKIRIM</span>';
            } else {
                statusBadge = `<span class="status-badge-pill badge-failed" title="${item.errorMessage || ''}">✕ GAGAL</span>`;
            }

            // Thumbnail
            const thumb = item.imageUrl
                ? `<img src="${item.imageUrl}" alt="Foto">`
                : `<div class="text-status-badge" style="background: ${item.backgroundColor || '#075E54'};">TXT</div>`;

            return `
                <div class="schedule-card-item">
                    <div class="schedule-thumb-box">
                        ${thumb}
                    </div>
                    <div class="schedule-main-info">
                        <div class="schedule-timing-row">
                            <span class="target-time">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                ${dateStr}
                            </span>
                            ${countdownHtml}
                        </div>
                        <div class="schedule-caption-text">${escapeHtml(item.text) || '<i>(Tanpa teks)</i>'}</div>
                        <div>${statusBadge}</div>
                    </div>
                    <div class="schedule-actions">
                        ${actionSendBtn}
                        <button class="btn-action-delete" onclick="deleteScheduleItem('${item.id}')" title="Hapus Jadwal">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        updateCountdowns();
    }

    // --- Live Countdown Calculation ---
    function updateCountdowns() {
        const badges = document.querySelectorAll('.countdown-badge');
        const now = Date.now();

        badges.forEach(badge => {
            const target = parseInt(badge.dataset.time, 10);
            const diff = target - now;

            if (diff <= 0) {
                badge.textContent = '⚡ Sedang memproses...';
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                if (hours > 0) {
                    badge.textContent = `⏳ ${hours}j ${minutes}m lagi`;
                } else if (minutes > 0) {
                    badge.textContent = `⏳ ${minutes}m ${seconds}d lagi`;
                } else {
                    badge.textContent = `⏳ ${seconds} detik lagi`;
                }
            }
        });
    }

    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdowns, 1000);

    // --- Global Actions (Delete & Send Now) ---
    window.deleteScheduleItem = async (id) => {
        if (!confirm('Hapus jadwal status ini?')) return;
        try {
            const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Jadwal berhasil dihapus.', 'info');
                loadSchedules();
            }
        } catch (e) {
            showToast('Gagal menghapus jadwal.', 'error');
        }
    };

    window.sendScheduleNow = async (id) => {
        if (!confirm('Kirim status ini sekarang ke WhatsApp tanpa menunggu jadwal?')) return;
        showToast('Sedang mengirim status ke WhatsApp...', 'info');

        try {
            const res = await fetch(`/api/schedules/${id}/send-now`, { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                showToast('Status berhasil terkirim ke WhatsApp!', 'success');
                loadSchedules();
            } else {
                showToast(data.error || 'Gagal mengirim status.', 'error');
            }
        } catch (e) {
            showToast('Terjadi kesalahan saat mengirim.', 'error');
        }
    };

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Initial triggers & intervals
    checkConnection();
    loadSchedules();
    setInterval(checkConnection, 3500);
    setInterval(loadSchedules, 8000);
});
