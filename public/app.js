document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const connectionPill = document.getElementById('connectionPill');
    const connectionText = document.getElementById('connectionText');
    const connectedView = document.getElementById('connectedView');
    const disconnectedView = document.getElementById('disconnectedView');
    const userNameText = document.getElementById('userNameText');
    const btnLogout = document.getElementById('btnLogout');

    // QR & Pairing
    const qrImage = document.getElementById('qrImage');
    const qrLoading = document.getElementById('qrLoading');
    const authTabs = document.querySelectorAll('.auth-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const phoneInput = document.getElementById('phoneInput');
    const btnRequestPairing = document.getElementById('btnRequestPairing');
    const pairingCodeResult = document.getElementById('pairingCodeResult');
    const pairingCodeText = document.getElementById('pairingCodeText');

    // Schedule Form
    const scheduleForm = document.getElementById('scheduleForm');
    const typeRadios = document.querySelectorAll('input[name="statusType"]');
    const imageUploadGroup = document.getElementById('imageUploadGroup');
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const dropzonePrompt = document.getElementById('dropzonePrompt');
    const statusText = document.getElementById('statusText');
    const scheduleDatetime = document.getElementById('scheduleDatetime');
    const btnSubmitSchedule = document.getElementById('btnSubmitSchedule');

    // Schedules List
    const schedulesContainer = document.getElementById('schedulesContainer');
    const filterTabs = document.querySelectorAll('.filter-tab');

    let allSchedules = [];
    let currentFilter = 'all';

    // Set default datetime: 10 minutes from now in local timezone
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    scheduleDatetime.value = localISOTime;
    scheduleDatetime.min = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);

    // Tab switching for QR / Pairing
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetId = tab.dataset.tab === 'qr' ? 'tabContentQr' : 'tabContentPairing';
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Check WhatsApp Connection Status
    async function checkConnection() {
        try {
            const res = await fetch('/api/connection-status');
            const data = await res.json();

            if (data.status === 'connected') {
                connectionPill.className = 'status-pill status-connected';
                connectionText.textContent = 'Terhubung';
                connectedView.style.display = 'flex';
                disconnectedView.style.display = 'none';

                const name = data.user?.name || 'Nomor WhatsApp Anda';
                userNameText.textContent = `Terhubung sebagai: ${name}. Server siap memposting status otomatis.`;
            } else {
                connectionPill.className = 'status-pill status-disconnected';
                connectionText.textContent = 'Belum Terhubung';
                connectedView.style.display = 'none';
                disconnectedView.style.display = 'block';

                if (data.qr) {
                    qrImage.src = data.qr;
                    qrImage.style.display = 'block';
                    qrLoading.style.display = 'none';
                } else {
                    qrImage.style.display = 'none';
                    qrLoading.style.display = 'block';
                }
            }
        } catch (err) {
            console.error('Failed to check connection:', err);
        }
    }

    // Request Pairing Code
    btnRequestPairing.addEventListener('click', async () => {
        const phone = phoneInput.value.trim();
        if (!phone) {
            alert('Silakan masukkan nomor WhatsApp Anda!');
            return;
        }

        btnRequestPairing.disabled = true;
        btnRequestPairing.textContent = 'Meminta Kode...';

        try {
            const res = await fetch('/api/pairing-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();

            if (data.success && data.code) {
                pairingCodeText.textContent = data.code;
                pairingCodeResult.style.display = 'block';
            } else {
                alert(data.error || 'Gagal membuat kode pairing.');
            }
        } catch (err) {
            alert('Terjadi kesalahan jaringan.');
        } finally {
            btnRequestPairing.disabled = false;
            btnRequestPairing.textContent = 'Dapatkan Kode 8 Digit';
        }
    });

    // Logout
    btnLogout.addEventListener('click', async () => {
        if (!confirm('Apakah Anda yakin ingin memutuskan koneksi akun WhatsApp dari server?')) return;

        try {
            await fetch('/api/logout', { method: 'POST' });
            checkConnection();
        } catch (err) {
            alert('Gagal logout.');
        }
    });

    // Toggle Image / Text form fields
    typeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'IMAGE') {
                imageUploadGroup.style.display = 'block';
                statusText.placeholder = 'Tulis caption gambar status (opsional)...';
            } else {
                imageUploadGroup.style.display = 'none';
                statusText.placeholder = 'Tulis pesan status di sini...';
            }
        });
    });

    // Image file selection & preview
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
                dropzonePrompt.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    // Submit Schedule Form
    scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedType = document.querySelector('input[name="statusType"]:checked').value;
        const textVal = statusText.value.trim();
        const dateVal = scheduleDatetime.value;

        if (!dateVal) {
            alert('Tentukan waktu tayang status!');
            return;
        }

        const targetTimestamp = new Date(dateVal).getTime();
        if (targetTimestamp <= Date.now()) {
            alert('Waktu posting harus lebih dari waktu saat ini!');
            return;
        }

        if (selectedType === 'IMAGE' && (!imageInput.files || !imageInput.files[0])) {
            alert('Silakan pilih berkas gambar yang ingin diunggah!');
            return;
        }

        if (selectedType === 'TEXT' && !textVal) {
            alert('Silakan tulis isi status teks!');
            return;
        }

        const formData = new FormData();
        formData.append('type', selectedType);
        formData.append('text', textVal);
        formData.append('scheduledTimestamp', targetTimestamp);
        if (selectedType === 'IMAGE' && imageInput.files[0]) {
            formData.append('image', imageInput.files[0]);
        }

        btnSubmitSchedule.disabled = true;
        btnSubmitSchedule.textContent = 'Menyimpan Jadwal...';

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                alert('Jadwal status berhasil disimpan!');
                statusText.value = '';
                imageInput.value = '';
                imagePreview.style.display = 'none';
                dropzonePrompt.style.display = 'block';
                loadSchedules();
            } else {
                alert(data.error || 'Gagal menyimpan jadwal');
            }
        } catch (err) {
            alert('Terjadi kesalahan server saat menyimpan jadwal.');
        } finally {
            btnSubmitSchedule.disabled = false;
            btnSubmitSchedule.textContent = 'Simpan & Jadwalkan Status';
        }
    });

    // Load Schedules
    async function loadSchedules() {
        try {
            const res = await fetch('/api/schedules');
            allSchedules = await res.json();
            renderSchedules();
        } catch (err) {
            console.error('Failed to load schedules:', err);
        }
    }

    // Filter switching
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderSchedules();
        });
    });

    function renderSchedules() {
        let filtered = allSchedules;
        if (currentFilter !== 'all') {
            filtered = allSchedules.filter(s => s.status === currentFilter);
        }

        // Sort: pending first, then by scheduledTimestamp ascending
        filtered.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);

        if (filtered.length === 0) {
            schedulesContainer.innerHTML = '<div class="empty-state">Belum ada jadwal status pada kategori ini.</div>';
            return;
        }

        schedulesContainer.innerHTML = filtered.map(item => {
            const dateStr = new Date(item.scheduledTimestamp).toLocaleString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let statusBadge = '';
            if (item.status === 'PENDING') {
                statusBadge = '<span class="badge badge-pending">MENUNGGU</span>';
            } else if (item.status === 'COMPLETED') {
                statusBadge = '<span class="badge badge-completed">TERKIRIM</span>';
            } else {
                statusBadge = `<span class="badge badge-failed" title="${item.errorMessage || ''}">GAGAL</span>`;
            }

            const visualThumb = item.imageUrl
                ? `<img src="${item.imageUrl}" class="schedule-thumbnail" alt="Foto">`
                : `<div class="schedule-icon-thumb">TXT</div>`;

            return `
                <div class="schedule-item">
                    ${visualThumb}
                    <div class="schedule-details">
                        <div class="schedule-time">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            ${dateStr}
                        </div>
                        <div class="schedule-text">${escapeHtml(item.text) || '<i>(Tanpa teks)</i>'}</div>
                        ${statusBadge}
                    </div>
                    <button class="btn-delete" onclick="deleteSchedule('${item.id}')" title="Hapus Jadwal">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');
    }

    // Expose deleteSchedule globally
    window.deleteSchedule = async (id) => {
        if (!confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) return;
        try {
            await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
            loadSchedules();
        } catch (err) {
            alert('Gagal menghapus jadwal.');
        }
    };

    function escapeHtml(string) {
        if (!string) return '';
        return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Initial load & Polling
    checkConnection();
    loadSchedules();
    setInterval(checkConnection, 3000);
    setInterval(loadSchedules, 10000);
});
