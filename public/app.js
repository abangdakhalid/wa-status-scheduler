document.addEventListener('DOMContentLoaded', () => {
    // State
    let selectedColor = '#075E54';
    let currentFilter = 'all';
    let allSchedules = [];
    let countdownInterval = null;

    // UI References - Header & Auth
    const connectionBadge = document.getElementById('connectionBadge');
    const connectionText = document.getElementById('connectionText');
    const connectedView = document.getElementById('connectedView');
    const disconnectedView = document.getElementById('disconnectedView');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userPhoneDisplay = document.getElementById('userPhoneDisplay');
    const btnLogout = document.getElementById('btnLogout');

    // QR & Pairing Tabs
    const segmentBtns = document.querySelectorAll('.segment-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const phoneInput = document.getElementById('phoneInput');
    const btnRequestPairing = document.getElementById('btnRequestPairing');
    const pairingResultBox = document.getElementById('pairingResultBox');
    const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
    const btnCopyCode = document.getElementById('btnCopyCode');
    const qrImg = document.getElementById('qrImg');
    const qrSpinner = document.getElementById('qrSpinner');
    const btnRefreshQr = document.getElementById('btnRefreshQr');

    // Composer Form Elements
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
    const btnSubmit = document.getElementById('btnSubmit');

    // Repeat Frequency Elements
    const repeatCards = document.querySelectorAll('.repeat-card');
    const sectionOnce = document.getElementById('sectionOnce');
    const sectionDaily = document.getElementById('sectionDaily');
    const sectionCustomDays = document.getElementById('sectionCustomDays');
    const presetPills = document.querySelectorAll('.preset-pill');
    const datetimeSchedule = document.getElementById('datetimeSchedule');
    const timeDaily = document.getElementById('timeDaily');
    const timeCustom = document.getElementById('timeCustom');
    const daysCheckboxes = document.querySelectorAll('input[name="daysCheck"]');

    // Phone Mockup Elements
    const mockupScreen = document.getElementById('mockupScreen');
    const mockupTextBody = document.getElementById('mockupTextBody');
    const mockupTextContent = document.getElementById('mockupTextContent');
    const mockupImageBody = document.getElementById('mockupImageBody');
    const mockupCaptionBox = document.getElementById('mockupCaptionBox');
    const mockupCaptionText = document.getElementById('mockupCaptionText');
    const mockupScheduledTime = document.getElementById('mockupScheduledTime');

    // Timeline / Schedule Grid
    const filterChips = document.querySelectorAll('.filter-chip');
    const schedulesGrid = document.getElementById('schedulesGrid');

    // --- Toast Notification Helper ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
        toast.innerHTML = `<span style="font-weight: 800; font-size: 16px;">${icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3800);
    }

    // --- Datetime Helper ---
    function formatToLocalISO(date) {
        const tzOffset = date.getTimezoneOffset() * 60000;
        return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    }

    // Initialize Default Datetime (+10 minutes)
    const initialTime = new Date(Date.now() + 10 * 60000);
    if (datetimeSchedule) {
        datetimeSchedule.value = formatToLocalISO(initialTime);
        datetimeSchedule.min = formatToLocalISO(new Date());
    }

    // Day name abbreviations in Indonesian
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    // Update Mockup Scheduled Time Label
    function updateMockupTimeLabel() {
        const activeRepeat = document.querySelector('input[name="repeatType"]:checked')?.value || 'ONCE';

        if (activeRepeat === 'ONCE') {
            const val = datetimeSchedule.value;
            if (val) {
                const d = new Date(val);
                mockupScheduledTime.textContent = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            } else {
                mockupScheduledTime.textContent = 'Baru saja';
            }
        } else if (activeRepeat === 'DAILY') {
            const time = timeDaily?.value || '08:00';
            mockupScheduledTime.textContent = `Tiap Hari ${time}`;
        } else if (activeRepeat === 'CUSTOM_DAYS') {
            const selectedDays = Array.from(daysCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => dayNames[parseInt(cb.value, 10)])
                .join(',');
            const time = timeCustom?.value || '08:00';
            mockupScheduledTime.textContent = selectedDays ? `${selectedDays} ${time}` : `Jam ${time}`;
        }
    }

    datetimeSchedule?.addEventListener('input', updateMockupTimeLabel);
    timeDaily?.addEventListener('input', updateMockupTimeLabel);
    timeCustom?.addEventListener('input', updateMockupTimeLabel);
    daysCheckboxes.forEach(cb => cb.addEventListener('change', updateMockupTimeLabel));
    updateMockupTimeLabel();

    // --- Quick Timing Presets (For ONCE mode) ---
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

    // --- Repeat Frequency Tabs (Sekali, Setiap Hari, Hari Tertentu) ---
    repeatCards.forEach(card => {
        card.addEventListener('click', () => {
            repeatCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;

            const mode = radio?.value || 'ONCE';
            if (mode === 'ONCE') {
                sectionOnce.style.display = 'block';
                sectionDaily.style.display = 'none';
                sectionCustomDays.style.display = 'none';
            } else if (mode === 'DAILY') {
                sectionOnce.style.display = 'none';
                sectionDaily.style.display = 'block';
                sectionCustomDays.style.display = 'none';
            } else if (mode === 'CUSTOM_DAYS') {
                sectionOnce.style.display = 'none';
                sectionDaily.style.display = 'none';
                sectionCustomDays.style.display = 'block';
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
            document.getElementById(target)?.classList.add('active');
        });
    });

    // --- Refresh QR Code Button ---
    if (btnRefreshQr) {
        btnRefreshQr.addEventListener('click', async () => {
            try {
                btnRefreshQr.disabled = true;
                btnRefreshQr.innerHTML = `
                    <div class="modern-spinner" style="width: 14px; height: 14px; border-width: 2px; display: inline-block;"></div>
                    <span>Memperbarui Barcode...</span>
                `;
                qrImg.style.display = 'none';
                qrSpinner.style.display = 'block';
                showToast('Membuat Barcode baru, mohon tunggu...', 'info');

                const res = await fetch('/api/refresh-qr', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast('Barcode baru sedang disiapkan. Arahkan kamera HP Anda!', 'success');
                } else {
                    showToast(data.message || 'Gagal memuat barcode baru.', 'error');
                }
            } catch (err) {
                showToast('Gagal terhubung ke server untuk memuat barcode.', 'error');
            } finally {
                setTimeout(() => {
                    btnRefreshQr.disabled = false;
                    btnRefreshQr.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6"></path>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        <span>🔄 Muat Ulang / Segarkan Barcode</span>
                    `;
                    checkConnection();
                }, 2000);
            }
        });
    }

    // --- Type Switcher (TEXT vs IMAGE) ---
    typeCards.forEach(card => {
        card.addEventListener('click', () => {
            typeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;

            if (radio?.value === 'IMAGE') {
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
    textContent?.addEventListener('input', () => {
        const val = textContent.value;
        if (charCounter) charCounter.textContent = `${val.length} karakter`;

        const isImage = document.querySelector('input[name="statusType"]:checked')?.value === 'IMAGE';
        if (isImage) {
            mockupCaptionText.textContent = val || 'Caption foto...';
            mockupCaptionBox.style.display = val.trim() ? 'block' : 'none';
        } else {
            mockupTextContent.textContent = val || 'Tulis pesan status Anda di formulir...';
        }
    });

    // --- Image Upload & Mockup Sync ---
    fileImage?.addEventListener('change', () => {
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

    btnRemoveImage?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileImage.value = '';
        thumbImg.src = '';
        thumbWrapper.style.display = 'none';
        dropPrompt.style.display = 'block';
        mockupImageBody.src = '';
        mockupImageBody.style.display = 'none';
    });

    // --- Copy Pairing Code Button ---
    btnCopyCode?.addEventListener('click', () => {
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
    btnRequestPairing?.addEventListener('click', async () => {
        let phone = phoneInput.value.trim();
        if (!phone) {
            showToast('Silakan masukkan nomor WhatsApp Anda!', 'error');
            phoneInput.focus();
            return;
        }

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
    btnLogout?.addEventListener('click', async () => {
        if (!confirm('Putuskan koneksi WhatsApp dari server?')) return;
        try {
            await fetch('/api/logout', { method: 'POST' });
            showToast('Koneksi WhatsApp diputuskan. Barcode baru siap.', 'info');
            checkConnection();
        } catch (e) {
            showToast('Gagal memutuskan koneksi.', 'error');
        }
    });

    // --- Submit Schedule Form ---
    statusForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedType = document.querySelector('input[name="statusType"]:checked')?.value || 'TEXT';
        const repeatType = document.querySelector('input[name="repeatType"]:checked')?.value || 'ONCE';
        const textVal = textContent.value.trim();

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
        formData.append('repeatType', repeatType);
        formData.append('text', textVal);
        formData.append('backgroundColor', selectedColor);

        if (selectedType === 'IMAGE' && fileImage.files[0]) {
            formData.append('image', fileImage.files[0]);
        }

        // Timing validation based on repeatType
        if (repeatType === 'ONCE') {
            const dateVal = datetimeSchedule.value;
            if (!dateVal) {
                showToast('Tentukan tanggal & jam tayang status!', 'error');
                return;
            }
            const targetTimestamp = new Date(dateVal).getTime();
            if (targetTimestamp <= Date.now() - 30000) {
                showToast('Waktu posting harus lebih dari waktu saat ini!', 'error');
                return;
            }
            formData.append('scheduledTimestamp', targetTimestamp);
        } else if (repeatType === 'DAILY') {
            const timeVal = timeDaily?.value;
            if (!timeVal) {
                showToast('Pilih jam tayang harian!', 'error');
                return;
            }
            formData.append('timeOfDay', timeVal);
        } else if (repeatType === 'CUSTOM_DAYS') {
            const timeVal = timeCustom?.value;
            if (!timeVal) {
                showToast('Pilih jam tayang untuk hari yang dipilih!', 'error');
                return;
            }
            const selectedDays = Array.from(daysCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => parseInt(cb.value, 10));

            if (selectedDays.length === 0) {
                showToast('Pilih minimal satu hari dalam seminggu!', 'error');
                return;
            }
            formData.append('timeOfDay', timeVal);
            formData.append('daysOfWeek', JSON.stringify(selectedDays));
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
                if (charCounter) charCounter.textContent = '0 karakter';
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
                userPhoneDisplay.textContent = data.user?.id ? `Nomor: +${data.user.id}` : 'Server siap mengirim status otomatis sesuai jadwal.';
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
            if (currentFilter === 'PENDING') {
                filtered = allSchedules.filter(s => s.status === 'PENDING' || s.status === 'ACTIVE');
            } else {
                filtered = allSchedules.filter(s => s.status === currentFilter);
            }
        }

        // Sort: pending/active first, then newer
        filtered.sort((a, b) => {
            const aIsActive = (a.status === 'PENDING' || a.status === 'ACTIVE');
            const bIsActive = (b.status === 'PENDING' || b.status === 'ACTIVE');
            if (aIsActive && !bIsActive) return -1;
            if (!aIsActive && bIsActive) return 1;
            return (b.createdAt || 0) - (a.createdAt || 0);
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
            const isRecurring = item.repeatType === 'DAILY' || item.repeatType === 'CUSTOM_DAYS';
            
            // Format Timing Description & Next Run Target
            let timingText = '';
            let countdownHtml = '';
            let nextTargetTime = null;
            let nextRunLabel = '';

            const now = new Date();
            const todayDateStr = now.toLocaleDateString('en-CA');

            if (item.repeatType === 'DAILY') {
                timingText = `🔁 <b>Setiap Hari</b> • Jam <b>${item.timeOfDay || '08:00'} WIB</b>`;
                if (item.status === 'ACTIVE' && item.timeOfDay) {
                    const [h, m] = item.timeOfDay.split(':').map(Number);
                    const targetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
                    
                    if (now.getTime() < targetToday.getTime() && item.lastTriggeredDate !== todayDateStr) {
                        nextTargetTime = targetToday.getTime();
                        nextRunLabel = 'Hari ini';
                    } else {
                        const targetTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m, 0);
                        nextTargetTime = targetTomorrow.getTime();
                        nextRunLabel = 'Besok Pagi';
                    }
                    countdownHtml = `<span class="countdown-badge" data-time="${nextTargetTime}" data-label="${nextRunLabel}">⏳ Menghitung...</span>`;
                }
                if (item.lastTriggeredDate) {
                    timingText += ` <span style="font-size: 11px; color: var(--text-muted);">(Terakhir tayang: ${item.lastTriggeredDate})</span>`;
                }
            } else if (item.repeatType === 'CUSTOM_DAYS') {
                const daysList = (item.daysOfWeek || []).map(d => dayNames[d]).join(', ');
                timingText = `🗓️ <b>${daysList || 'Hari Tertentu'}</b> • Jam <b>${item.timeOfDay || '08:00'} WIB</b>`;
                
                if (item.status === 'ACTIVE' && item.timeOfDay && Array.isArray(item.daysOfWeek) && item.daysOfWeek.length > 0) {
                    const [h, m] = item.timeOfDay.split(':').map(Number);
                    // Find next matching day
                    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
                        const testDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, h, m, 0);
                        const testDay = testDate.getDay();
                        if (item.daysOfWeek.includes(testDay)) {
                            if (dayOffset === 0 && (now.getTime() >= testDate.getTime() || item.lastTriggeredDate === todayDateStr)) {
                                continue;
                            }
                            nextTargetTime = testDate.getTime();
                            nextRunLabel = dayOffset === 0 ? 'Hari ini' : (dayOffset === 1 ? 'Besok' : dayNames[testDay]);
                            break;
                        }
                    }
                    if (nextTargetTime) {
                        countdownHtml = `<span class="countdown-badge" data-time="${nextTargetTime}" data-label="${nextRunLabel}">⏳ Menghitung...</span>`;
                    }
                }
                if (item.lastTriggeredDate) {
                    timingText += ` <span style="font-size: 11px; color: var(--text-muted);">(Terakhir tayang: ${item.lastTriggeredDate})</span>`;
                }
            } else {
                const dateObj = new Date(item.scheduledTimestamp);
                const dateStr = dateObj.toLocaleString('id-ID', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                timingText = `📅 <b>Sekali Saja:</b> ${dateStr} WIB`;

                if (item.status === 'PENDING') {
                    countdownHtml = `<span class="countdown-badge" data-time="${item.scheduledTimestamp}" data-label="Tayang">⏳ Menghitung...</span>`;
                }
            }

            // Status Badge
            let statusBadge = '';
            let actionSendBtn = `
                <button class="btn-action-send" onclick="sendScheduleNow('${item.id}')" title="Kirim status ini sekarang ke WhatsApp">
                    ⚡ Kirim Sekarang
                </button>
            `;

            if (item.status === 'ACTIVE') {
                statusBadge = '<span class="status-badge-pill badge-pending">🔁 AKTIF (RUTIN)</span>';
            } else if (item.status === 'PENDING') {
                statusBadge = '<span class="status-badge-pill badge-pending">MENUNGGU</span>';
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
                                <span>${timingText}</span>
                            </span>
                            ${countdownHtml}
                        </div>
                        <div class="schedule-caption-text">${escapeHtml(item.text) || '<i>(Tanpa teks / Hanya Gambar)</i>'}</div>
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

    // --- Live Countdown Calculation (For ONCE schedules) ---
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
                showToast('Status berhasil dikirim ke WhatsApp!', 'success');
                loadSchedules();
            } else {
                showToast(data.error || 'Gagal mengirim status.', 'error');
            }
        } catch (err) {
            showToast('Terjadi kesalahan saat mengirim.', 'error');
        }
    };

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // --- Cloudflare Tunnel Info ---
    const cloudflareBadge = document.getElementById('cloudflareBadge');
    const cloudflareLink = document.getElementById('cloudflareLink');
    const btnCopyCloudflare = document.getElementById('btnCopyCloudflare');
    let currentCloudflareUrl = null;

    async function checkTunnelInfo() {
        try {
            const res = await fetch('/api/tunnel-info');
            const data = await res.json();
            if (data.cloudflareUrl) {
                currentCloudflareUrl = data.cloudflareUrl;
                cloudflareBadge.style.display = 'inline-flex';
                cloudflareLink.href = data.cloudflareUrl;
                cloudflareLink.textContent = 'Link Cloudflare HP';
            } else {
                cloudflareBadge.style.display = 'none';
            }
        } catch (e) {}
    }

    btnCopyCloudflare?.addEventListener('click', () => {
        if (currentCloudflareUrl) {
            navigator.clipboard.writeText(currentCloudflareUrl).then(() => {
                showToast('Link Cloudflare disalin! Buka link ini di browser HP Anda.', 'success');
            }).catch(() => {
                showToast(`Link: ${currentCloudflareUrl}`, 'info');
            });
        }
    });

    // Initial triggers & polling intervals
    checkConnection();
    loadSchedules();
    checkTunnelInfo();
    setInterval(checkConnection, 2500);
    setInterval(loadSchedules, 8000);
    setInterval(checkTunnelInfo, 5000);
});
