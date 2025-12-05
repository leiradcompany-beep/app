/**
 * Admin Cleaner Management Script
 * Handles fetching cleaner data, managing profiles, and UI interactions.
 */

$(document).ready(function () {
    // Configuration

    // State
    let cleaners = [];
    let filteredCleaners = []; // For client-side search
    let currentStatus = 'all';

    // Initialization
    init();

    function init() {
        loadCleaners();
        setupEventListeners();
    }

    // --- Data Fetching ---

    function loadCleaners() {
        // Show loading state
        $('.cleaner-grid').html('<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-light);">Loading team data...</div>');

        let url = `/admin/cleaners`;
        if (currentStatus !== 'all') {
            url += `?status=${currentStatus}`;
        }

        ApiClient.get(url)
            .then(function (response) {
                if (response.success) {
                    cleaners = response.data;
                    applySearch(); // Render with search filter applied
                } else {
                    $('.cleaner-grid').html('<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--danger);">Failed to load cleaners.</div>');
                }
            })
            .catch(function (xhr) {
                console.error('API fetch failed', xhr);
                $('.cleaner-grid').html('<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--danger);">Error loading data.</div>');
            });
    }

    function applySearch() {
        const searchTerm = $('#cleanerSearchInput').val().toLowerCase();
        filteredCleaners = cleaners.filter(cleaner => {
            return (
                (cleaner.name && cleaner.name.toLowerCase().includes(searchTerm)) ||
                (cleaner.role && cleaner.role.toLowerCase().includes(searchTerm)) ||
                (cleaner.email && cleaner.email.toLowerCase().includes(searchTerm)) ||
                (cleaner.skills && cleaner.skills.some(skill => skill.toLowerCase().includes(searchTerm)))
            );
        });
        renderCleaners(filteredCleaners);
    }

    window.filterCleaners = function (status, btn) {
        $('.filter-chip').removeClass('active');
        $(btn).addClass('active');
        currentStatus = status;
        loadCleaners();
    }

    // --- Rendering ---

    function renderCleaners(data) {
        const container = $('.cleaner-grid');
        container.empty();

        if (data.length === 0) {
            container.html('<div style="grid-column: 1/-1; text-align:center; padding:20px;">No cleaners found.</div>');
            return;
        }

        data.forEach(cleaner => {
            const skills = cleaner.skills || [];
            const skillsHtml = skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('');

            // Avatar Logic
            const avatarUrl = ImageUtils.getAvatarUrl(cleaner.img);

            let actionsHtml = '';
            // Check is_approved property (assuming backend sends 0/1 or false/true)
            if (cleaner.is_approved == 0 || cleaner.is_approved === false) {
                actionsHtml = `
                    <button class="btn-outline btn-review" onclick="viewIdDocuments(${cleaner.id})" style="width: 100%; margin-bottom: 8px;">
                        <i class="ri-file-shield-2-line"></i> Review IDs
                    </button>
                    <div style="display: flex; gap: 10px; width: 100%;">
                        <button class="btn-outline btn-approve" onclick="approveCleaner(${cleaner.id}, this)" style="flex: 1;">
                            <i class="ri-check-line"></i> Approve
                        </button>
                        <button class="btn-outline btn-reject" onclick="deleteCleaner(${cleaner.id})" style="flex: 1;">
                            <i class="ri-close-line"></i> Reject
                        </button>
                    </div>
                `;
            } else {
                actionsHtml = `
                    <button class="btn-outline" onclick="viewSchedule(${cleaner.id})">
                        <i class="ri-calendar-line"></i> Schedule
                    </button>
                    <button class="btn-outline" onclick="editProfile(${cleaner.id})">
                        <i class="ri-edit-line"></i> Profile
                    </button>
                `;
            }

            const cardHtml = `
                <div class="cleaner-card">
                    <img src="${avatarUrl}" alt="${cleaner.name}" class="c-img" onerror="this.src='../../assets/images/default-avatar.png'">
                    <div class="c-name">${cleaner.name}</div>
                    <div class="c-role">${cleaner.role}</div>
                    
                    <div class="c-stats">
                        <div class="stat-item">
                            <span class="stat-val">${cleaner.jobs}</span>
                            <span class="stat-label">Jobs</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-val">${cleaner.rating && cleaner.rating > 0 ? cleaner.rating : '<span style="font-size: 0.65rem; color: var(--text-light); font-weight: 600; white-space: nowrap;">Not yet rated</span>'}</span>
                            <span class="stat-label">Rating</span>
                        </div>
                    </div>
                    
                    <div class="c-skills">
                        ${skillsHtml}
                    </div>
                    
                    <div class="c-actions" style="flex-wrap: wrap;">
                        ${actionsHtml}
                    </div>
                </div>
            `;
            container.append(cardHtml);
        });
    }

    window.previewCleanerImage = function (input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                $('#cleanerPreview').attr('src', e.target.result);
            }
            reader.readAsDataURL(input.files[0]);
        }
    };

    // --- Event Listeners ---

    function setupEventListeners() {
        // Drawer Toggle
        $('#overlay').on('click', closeDrawer);
        $('.close-drawer').on('click', closeDrawer);

        // Search Input
        $('#cleanerSearchInput').on('keyup', function () {
            applySearch();
        });

        // Image Preview
        $('#cleanerImage').on('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    $('#imagePreview img').attr('src', e.target.result);
                    $('#imagePreview').show();
                }
                reader.readAsDataURL(file);
            }
        });

        // Form Submission
        $('#cleanerDrawer form').on('submit', function (e) {
            e.preventDefault();

            const btn = $(this).find('button[type="submit"]');
            const form = $(this);
            const cleanerId = $('#cleanerId').val();

            const formData = new FormData();
            formData.append('name', $('#cleanerName').val());
            formData.append('role', $('#cleanerRole').val());

            const skills = $('#cleanerSkills').val().split(',').map(s => s.trim());
            skills.forEach((skill, index) => {
                formData.append(`skills[${index}]`, skill);
            });

            formData.append('experience_years', $('#cleanerExperience').val());
            formData.append('email', $('#cleanerEmail').val());

            const password = $('#cleanerPassword').val();
            if (password) formData.append('password', password);

            const imageFile = $('#cleanerImage')[0].files[0];
            if (imageFile) {
                formData.append('img', imageFile);
            }

            if (cleanerId) {
                formData.append('_method', 'PUT');
            }

            if (!$('#cleanerName').val() || !$('#cleanerEmail').val() || (!cleanerId && !password)) {
                UiUtils.showToast('Please fill in all required fields', 'warning');
                return;
            }

            UiUtils.setBtnLoading(btn, true, 'Saving...');

            const url = cleanerId
                ? `/admin/cleaners/${cleanerId}`
                : '/admin/cleaners';

            const token = localStorage.getItem('auth_token');

            UiUtils.setBtnLoading(btn, true, 'Saving...');

            $.ajax({
                url: window.API_BASE_URL + url,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                success: function (response) {
                    if (response.success) {
                        UiUtils.showToast(cleanerId ? 'Profile updated' : 'Cleaner added successfully', 'success');
                        loadCleaners();
                        closeDrawer();
                        form[0].reset();
                        $('#cleanerId').val('');
                        $('#imagePreview').hide();
                    } else {
                        UiUtils.showToast(response.message || 'Failed to save cleaner', 'error');
                    }
                },
                error: function (xhr) {
                    console.error(xhr);
                    UiUtils.showToast(xhr.responseJSON?.message || 'Error saving cleaner', 'error');
                },
                complete: function () {
                    UiUtils.setBtnLoading(btn, false, 'Save Profile');
                }
            });
        });
    }

    // --- Global Functions ---

    window.toggleDrawer = function () {
        const drawer = $('#cleanerDrawer');
        const overlay = $('#overlay');

        if (drawer.hasClass('open')) {
            closeDrawer();
        } else {
            drawer.addClass('open');
            overlay.addClass('active');
            $('#drawerTitle').text('Add New Cleaner');
            $('#cleanerPreview').attr('src', '../../assets/images/default-avatar.png');
            $('#passwordGroup').show();
        }
    };

    function closeDrawer() {
        $('#cleanerDrawer').removeClass('open');
        $('#overlay').removeClass('active');
        const form = $('#cleanerDrawer form');
        form[0].reset();
        $('#cleanerId').val('');
        $('#cleanerPreview').attr('src', '../../assets/images/default-avatar.png');
    }



    window.editProfile = function (id) {
        const cleaner = cleaners.find(c => c.id === id);
        if (!cleaner) return;

        $('#cleanerId').val(id);
        $('#cleanerName').val(cleaner.name);
        $('#cleanerRole').val(cleaner.role);
        $('#cleanerSkills').val((cleaner.skills || []).join(', '));

        ApiClient.get(`/admin/cleaners/${id}`)
            .then(function (response) {
                if (response.success) {
                    const data = response.data;
                    $('#cleanerName').val(data.name);
                    $('#cleanerRole').val(data.role);
                    $('#cleanerSkills').val((data.skills || []).join(', '));
                    $('#cleanerExperience').val(data.experience_years);
                    $('#cleanerEmail').val(data.email);
                    $('#cleanerPassword').val('');

                    if (data.img) {
                        const imgSrc = ImageUtils.getAvatarUrl(data.img);
                        $('#cleanerPreview').attr('src', imgSrc);
                    } else {
                        $('#cleanerPreview').attr('src', '../../assets/images/default-avatar.png');
                    }

                    $('#drawerTitle').text('Edit Cleaner Profile');
                    $('#passwordGroup').show();
                    $('#cleanerPassword').attr('placeholder', 'Leave blank to keep current');

                    $('#cleanerDrawer').addClass('open');
                    $('#overlay').addClass('active');
                }
            })
            .catch(function (xhr) {
                console.error('API fetch failed for cleaner profile', xhr);
                UiUtils.showToast('Failed to load cleaner profile for editing.', 'error');
            });
    };

    // --- Global Confirmation Modal Logic ---
    let confirmCallback = null;

    function showConfirmModal(title, message, iconClass, iconColor, callback) {
        $('#confirmTitle').text(title);
        $('#confirmMessage').text(message);
        $('#confirmIcon').html(`<i class="${iconClass}" style="color: ${iconColor};"></i>`);

        $('#confirmModalOverlay').addClass('active');
        $('#confirmModal').fadeIn(200);

        confirmCallback = callback;
    }

    function hideConfirmModal() {
        $('#confirmModalOverlay').removeClass('active');
        $('#confirmModal').fadeOut(200);
        confirmCallback = null;
    }

    $('#cancelConfirmBtn, #confirmModalOverlay').on('click', function (e) {
        if (e.target === this) {
            hideConfirmModal();
        }
    });

    $('#yesConfirmBtn').on('click', function () {
        if (confirmCallback) {
            // If callback returns nothing (undefined), we assume it handles hiding modal (e.g. async with finally)
            // But our previous implementation was synchronous.
            // To support async loading inside callback without closing modal immediately:
            // We should let the callback handle closing if it's async?
            // Or we just call it.
            confirmCallback();

            // Note: If confirmCallback is async and sets loading on the button, 
            // we shouldn't call hideConfirmModal immediately here if we want to show loading state on the modal.
            // However, the current structure of deleteCleaner calls hideConfirmModal inside finally block now.
            // BUT approveCleaner (below) and others might rely on synchronous closing.
            // Let's check other usages.

            // Usage in approveCleaner: calls Ajax. It doesn't handle loading on yesBtn yet.
            // Usage in deleteCleaner: Now handles loading and hiding.

            // We should NOT auto-hide here if we want to support loading states in the modal.
            // But existing code expects auto-hide.
            // Let's remove auto-hide here and ensure all callbacks call hideConfirmModal() or we check return value?
            // Simpler approach: The callbacks that need loading will handle it. 
            // Those that don't might leave modal open?
            // Let's make it safe:
            // If the callback is deleteCleaner (async), it handles hiding.
            // If approveCleaner (async), we should update it to handle hiding too.
        } else {
            hideConfirmModal();
        }
    });

    // --- Rejection Modal Logic ---
    let cleanerToRejectId = null;

    window.deleteCleaner = function (id) {
        cleanerToRejectId = id;
        $('#rejectionReasonInput').val(''); // Clear previous input
        $('#rejectReasonOverlay').addClass('active');
        $('#rejectReasonModal').fadeIn(200);
    };

    function closeRejectModal() {
        $('#rejectReasonOverlay').removeClass('active');
        $('#rejectReasonModal').fadeOut(200);
        cleanerToRejectId = null;
    }

    $('#closeRejectModal, #cancelRejectBtn, #rejectReasonOverlay').on('click', function (e) {
        // Prevent closing if clicking inside modal content (though overlay click usually handles outside)
        // If target is overlay or close buttons
        if (e.target === this || this.id === 'closeRejectModal' || this.id === 'cancelRejectBtn') {
            closeRejectModal();
        }
    });

    $('#confirmRejectBtn').on('click', function () {
        if (!cleanerToRejectId) return;

        const reason = $('#rejectionReasonInput').val().trim();
        if (!reason) {
            UiUtils.showToast('Please provide a reason for rejection.', 'warning');
            return;
        }

        const btn = $(this);
        UiUtils.setBtnLoading(btn, true, 'Rejecting...');

        // We use the confirmModal logic but customized here directly or reuse the confirm modal?
        // The prompt was replaced by this modal. 
        // Now we proceed to call API directly or show another confirm?
        // Usually one modal is enough. "Reject Application" button implies confirmation.

        const token = localStorage.getItem('auth_token');

        ApiClient.post(`/admin/cleaners/${cleanerToRejectId}/reject`, { reason: reason })
            .then(function (response) {
                UiUtils.showToast('Cleaner request rejected and email sent', 'success');
                loadCleaners();
                closeRejectModal();
            })
            .catch(function (xhr) {
                // Fallback to delete if reject endpoint fails or is not standard
                ApiClient.delete(`/admin/cleaners/${cleanerToRejectId}`)
                    .then(() => {
                        UiUtils.showToast('Cleaner removed', 'success');
                        loadCleaners();
                        closeRejectModal();
                    })
                    .catch(() => {
                        UiUtils.showToast('Failed to remove cleaner', 'error');
                    });
            })
            .finally(() => {
                UiUtils.setBtnLoading(btn, false, 'Reject Application');
            });
    });

    window.toggleSidebar = function () {
        $('#sidebar').toggleClass('active');
    };

    window.viewIdDocuments = function (id) {
        const cleaner = cleaners.find(c => c.id === id);
        if (!cleaner) return;

        const baseUrl = window.API_BASE_URL.replace('/api', '');

        const frontSrc = cleaner.id_document_path ? (cleaner.id_document_path.startsWith('http') ? cleaner.id_document_path : baseUrl + cleaner.id_document_path) : '../../assets/images/no-image.png';
        const backSrc = cleaner.background_check_path ? (cleaner.background_check_path.startsWith('http') ? cleaner.background_check_path : baseUrl + cleaner.background_check_path) : '../../assets/images/no-image.png';

        $('#reviewFrontId').attr('src', frontSrc);
        $('#reviewBackId').attr('src', backSrc);

        // Map ID Types to readable names
        const idMap = {
            'passport': 'Philippine Passport',
            'drivers_license': 'Driver’s License',
            'sss_umid': 'SSS UMID Card',
            'philhealth': 'PhilHealth ID',
            'tin': 'TIN Card',
            'postal': 'Postal ID',
            'voters': 'Voter’s ID',
            'prc': 'PRC ID',
            'senior_citizen': 'Senior Citizen ID',
            'ofw': 'OFW ID',
            'national_id': 'National ID (PhilSys ID)',
            'gsis': 'GSIS ID',
            'ibp': 'IBP ID',
            'diplomat': 'Diplomat ID',
            'alien_cr': 'Alien Certificate of Registration (ACR I-Card)',
            'gocc': 'GOCC/Government Office ID',
            'other': 'Other Valid Government ID'
        };

        const idText = cleaner.valid_id_type ? (idMap[cleaner.valid_id_type] || cleaner.valid_id_type) : 'Not Specified';
        $('#reviewIdType').text(idText);

        $('#idReviewOverlay').addClass('active');
        $('#idReviewModal').fadeIn(200);
    };

    window.closeIdReview = function () {
        $('#idReviewOverlay').removeClass('active');
        $('#idReviewModal').fadeOut(200);
    };

    window.approveCleaner = function (id, btn) {
        showConfirmModal(
            'Approve Cleaner?',
            'This will activate the cleaner account and allow them to accept jobs.',
            'ri-check-double-line',
            '#2C7A7B',
            function () {
                const token = localStorage.getItem('auth_token');
                const yesBtn = $('#yesConfirmBtn');
                UiUtils.setBtnLoading(yesBtn, true, 'Approving...');

                $.ajax({
                    url: `${(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://127.0.0.1:8000' : 'https://itsolutions.muccsbblock1.com/cleaning_services/public'}/api/admin/cleaners/${id}/approve`,
                    type: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    success: function (res) {
                        UiUtils.showToast('Cleaner approved successfully', 'success');
                        loadCleaners();
                        closeIdReview();
                    },
                    error: function (xhr) {
                        UiUtils.showToast('Failed to approve cleaner', 'error');
                    },
                    complete: function () {
                        UiUtils.setBtnLoading(yesBtn, false, 'Yes, Proceed');
                        hideConfirmModal();
                    }
                });
            }
        );
    };

    // --- Schedule Drawer ---

    window.viewSchedule = function (id) {
        const cleaner = cleaners.find(c => c.id === id);
        if (!cleaner) return;

        // 1. Populate Header - Use ImageUtils for Avatar
        const avatarUrl = ImageUtils.getAvatarUrl(cleaner.img);

        $('#scheduleCleanerImg').attr('src', avatarUrl).off('error').on('error', function () {
            $(this).attr('src', '../../assets/images/default-avatar.png');
        });
        $('#scheduleCleanerName').text(cleaner.name);
        $('#scheduleCleanerRole').text(cleaner.role);

        // 2. Open Drawer
        $('#scheduleDrawer').addClass('open');
        $('#overlay').addClass('active');

        // 3. Fetch Schedule
        $('#scheduleList').html('<div style="text-align:center; padding:20px; color:var(--text-light);">Loading schedule...</div>');

        ApiClient.get(`/admin/bookings?cleaner_id=${cleaner.user_id}`) // cleaner.user_id is the actual user ID for bookings
            .then(function (response) {
                if (response.success) {
                    renderCleanerSchedule(response.data);
                } else {
                    $('#scheduleList').html('<div style="text-align:center; color:var(--danger);">Failed to load schedule.</div>');
                }
            })
            .catch(function (xhr) {
                $('#scheduleList').html('<div style="text-align:center; color:var(--danger);">Error loading schedule.</div>');
            });
    };

    window.closeScheduleDrawer = function () {
        $('#scheduleDrawer').removeClass('open');
        $('#overlay').removeClass('active');
    };

    function renderCleanerSchedule(bookings) {
        const container = $('#scheduleList');
        container.empty();

        if (bookings.length === 0) {
            container.html('<div style="text-align:center; padding:20px; color:var(--text-light);">No upcoming jobs found.</div>');
            return;
        }

        // Sort by date desc
        bookings.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

        bookings.forEach(job => {
            let statusColor = '#718096';
            let statusBg = '#EDF2F7';

            switch (job.status.toLowerCase()) {
                case 'confirmed': statusColor = '#2F855A'; statusBg = '#F0FFF4'; break;
                case 'completed': statusColor = '#2C5282'; statusBg = '#EBF8FF'; break;
                case 'cancelled': statusColor = '#C53030'; statusBg = '#FFF5F5'; break;
                case 'assigned': statusColor = '#D69E2E'; statusBg = '#FFFFF0'; break;
                case 'declined': statusColor = '#E53E3E'; statusBg = '#FFF5F5'; break;
            }

            // --- FIX: Use ImageUtils for Proper Image URL Construction ---

            // Service Image - Use ImageUtils
            const serviceImg = ImageUtils.getServiceImageUrl(job.service_image);

            // Client Avatar - Use ImageUtils
            const clientImg = ImageUtils.getAvatarUrl(job.client_avatar);

            const item = `
                <div style="background:white; border:1px solid var(--border); border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display:flex; gap:15px; align-items:flex-start; margin-bottom:10px;">
                        <img src="${serviceImg}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; border:1px solid var(--border);" onerror="this.src='../../assets/images/default-service.png'">
                        <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div style="font-weight:700; font-size:0.95rem; color:var(--text-dark); margin-bottom:4px;">${job.service}</div>
                                <span style="background:${statusBg}; color:${statusColor}; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:700;">
                                    ${job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                </span>
                            </div>
                            <div style="font-size:0.85rem; color:var(--text-light);"><i class="ri-calendar-line"></i> ${job.date} • ${job.time}</div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid #eee; padding-top:10px; margin-top:5px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${clientImg}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;" onerror="this.src='../../assets/images/default-avatar.png'">
                            <div style="font-size:0.9rem; font-weight:600; color:var(--text-body);">${job.client}</div>
                        </div>
                        <div style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">₱${Number(String(job.price).replace(/[^0-9.-]+/g, "")).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">
                        <i class="ri-map-pin-line"></i> ${job.address}
                    </div>
                </div>
            `;
            container.append(item);
        });
    }
});
