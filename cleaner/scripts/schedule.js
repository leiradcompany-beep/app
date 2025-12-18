$(document).ready(function () {
    initScheduleTable();

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    $('#bookingDate').attr('min', today);
});

function initScheduleTable() {
    const table = $('#schedule-table').DataTable({
        language: {
            search: "_INPUT_",
            searchPlaceholder: "Search schedule...",
            lengthMenu: "Show _MENU_ entries",
            info: "Showing _START_ to _END_ of _TOTAL_ entries",
            paginate: {
                first: '<i class="ri-arrow-left-double-line"></i>',
                last: '<i class="ri-arrow-right-double-line"></i>',
                next: '<i class="ri-arrow-right-s-line"></i>',
                previous: '<i class="ri-arrow-left-s-line"></i>'
            }
        },
        dom: '<"d-flex justify-content-between align-items-center mb-4"lf>rt<"d-flex justify-content-between align-items-center mt-4"ip>',
        ajax: {
            url: `${window.API_BASE_URL}/cleaner/schedule`,
            type: 'GET',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem('auth_token'));
            },
            dataSrc: function (json) {
                if (!json.success) {
                    UiUtils.showToast('Failed to load schedule', 'error');
                    return [];
                }
                const rows = Array.isArray(json.data) ? [...json.data] : [];
                const statusOrder = { assigned: 0, confirmed: 1, in_progress: 2, completed: 3 };
                rows.sort((a, b) => {
                    const sa = (a.raw_status || a.status || '').toLowerCase();
                    const sb = (b.raw_status || b.status || '').toLowerCase();
                    const pa = statusOrder[sa] !== undefined ? statusOrder[sa] : 99;
                    const pb = statusOrder[sb] !== undefined ? statusOrder[sb] : 99;
                    if (pa !== pb) return pa - pb;
                    const da = new Date(a.date + ' ' + (a.time || ''));
                    const db = new Date(b.date + ' ' + (b.time || ''));
                    return db - da;
                });
                return rows;
            }
        },
        columns: [
            {
                data: 'display_id',
                className: 'fw-bold',
                createdCell: function (td) { $(td).attr('data-label', 'Order ID'); }
            },
            {
                data: 'service',
                createdCell: function (td) { $(td).attr('data-label', 'Service'); },
                render: function (data, type, row) {
                    return `
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${ImageUtils.withCacheBust(ImageUtils.getServiceImageUrl(row.service_img))}" style="width:38px; height:38px; border-radius:8px; object-fit:cover; border:1px solid #E2E8F0;" alt="${data}" onerror="ImageUtils.handleImageError(this, '../../assets/images/default-service.png')">
                            <span>${data}</span>
                        </div>
                    `;
                }
            },
            {
                data: 'date',
                createdCell: function (td) { $(td).attr('data-label', 'Date'); }
            },
            {
                data: 'customer',
                createdCell: function (td) { $(td).attr('data-label', 'Customer'); },
                render: function (data, type, row) {
                    let imgUrl = ImageUtils.withCacheBust(ImageUtils.getAvatarUrl(row.customer_img));
                    if (typeof row.customer_img === 'string' && row.customer_img.includes('ui-avatars.com')) {
                        imgUrl = '../../assets/images/default-avatar.png';
                    }
                    return `
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${imgUrl}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid #E2E8F0;" alt="${data}" onerror="ImageUtils.handleImageError(this, '../../assets/images/default-avatar.png')">
                            <div style="display:flex; flex-direction:column;">
                                <span style="font-weight:600; color:var(--text-dark); line-height:1.2;">${data}</span>
                                <span style="font-size:0.8em; color:var(--text-light); margin-bottom:2px;">${row.location}</span>
                                <span style="font-size:0.8em; color:var(--primary); font-weight:500; display:flex; align-items:center; gap:4px;">
                                    <i class="ri-phone-line"></i> ${row.phone_number || 'N/A'}
                                </span>
                            </div>
                        </div>
                    `;
                }
            },
            {
                data: 'price',
                className: 'fw-bold',
                createdCell: function (td) { $(td).attr('data-label', 'Amount'); }
            },
            {
                data: 'status',
                createdCell: function (td) { $(td).attr('data-label', 'Status'); },
                render: function (data, type, row) {
                    const raw = (row.raw_status || data || '').toLowerCase();
                    let label = data;
                    let statusClass = raw;
                    if (raw === 'in_progress') { label = 'In Progress'; statusClass = 'in_progress'; }
                    return `<span class="status-badge ${statusClass}">${label}</span>`;
                }
            },
            {
                data: null,
                createdCell: function (td) { $(td).attr('data-label', 'Action'); },
                render: function (data, type, row) {
                    const status = row.raw_status || row.status.toLowerCase();

                    // Assigned: Show Accept / Decline
                    if (status === 'assigned') {
                        return `
                            <div class="d-flex gap-2">
                                <button class="btn-action-soft accept" onclick="openAcceptModal('${row.id}')">
                                    <i class="ri-check-line"></i> Accept
                                </button>
                                <button class="btn-action-soft reject" onclick="openRejectModal('${row.id}')">
                                    <i class="ri-close-line"></i> Decline
                                </button>
                            </div>
                        `;
                    }

                    // Confirmed: Show Start only
                    if (status === 'confirmed') {
                        return `
                            <button class="btn-action-soft start" onclick="openStartModal('${row.id}')">
                                <i class="ri-play-line"></i> Start Job
                            </button>
                        `;
                    }

                    // In Progress: Show Complete only
                    if (status === 'in_progress') {
                        return `
                            <button class="btn-action-soft complete" onclick="openCompleteModal('${row.id}')">
                                <i class="ri-check-double-line"></i> Complete Job
                            </button>
                        `;
                    }

                    // Pending: Show Waiting
                    if (status === 'pending') {
                        return `<span class="text-muted" style="font-size:0.85rem;"><i class="ri-time-line"></i> Waiting Admin</span>`;
                    }

                    // Completed/Cancelled/Declined: No Action
                    return `<span class="text-muted" style="font-size:0.85rem; opacity:0.7;">No actions available</span>`;
                }
            }
        ],
        order: []
    });
}

let currentJobId = null;

// Modal Helpers
function toggleModal(modalId, show) {
    const el = document.getElementById(modalId);
    if (!el) return;
    if (show) {
        el.classList.add('open');
        document.body.style.overflow = 'hidden';
    } else {
        el.classList.remove('open');
        document.body.style.overflow = '';
    }
}

window.openAcceptModal = function (id) {
    currentJobId = id;
    toggleModal('accept-modal', true);
};

window.openRejectModal = function (id) {
    currentJobId = id;
    toggleModal('reject-modal', true);
};

window.openCompleteModal = function (id) {
    currentJobId = id;
    toggleModal('complete-modal', true);
};

window.closeAcceptModal = function () {
    currentJobId = null;
    toggleModal('accept-modal', false);
};

window.closeRejectModal = function () {
    currentJobId = null;
    toggleModal('reject-modal', false);
};

window.closeCompleteModal = function () {
    currentJobId = null;
    toggleModal('complete-modal', false);
};

window.closeLogoutModal = function () {
    toggleModal('logout-modal', false);
};

// --- ADD BOOKING DRAWER LOGIC START ---

// Custom Dropdown Logic (Mimicking Admin Booking)
window.populateRichSelect = function (selector, data, valueKey, textKey, priceKey, imgKey) {
    const container = $(selector).parent();
    const select = $(selector).hide(); // Hide original select

    // Check if custom dropdown exists, if not create it
    let customDropdown = container.find('.custom-select-wrapper');
    if (customDropdown.length === 0) {
        customDropdown = $(`
                <div class="custom-select-wrapper" id="custom-${selector.replace('#', '')}">
                    <div class="custom-select-trigger">
                        <span>Select Service</span>
                        <i class="ri-arrow-down-s-line"></i>
                    </div>
                    <div class="custom-options"></div>
                </div>
            `);
        container.append(customDropdown);

        // Toggle event
        customDropdown.find('.custom-select-trigger').on('click', function (e) {
            e.stopPropagation();
            $('.custom-select-wrapper').not(customDropdown).removeClass('open');
            customDropdown.toggleClass('open');
        });
    }

    const optionsContainer = customDropdown.find('.custom-options');
    optionsContainer.empty();

    // Default Option
    optionsContainer.append(`
            <div class="custom-option" data-value="">
                <span style="color: var(--text-light);">Select Service</span>
            </div>
        `);

    // Populate Options
    data.forEach(item => {
        // Add standard option to the hidden select
        select.append(`<option value="${item[valueKey]}">${item[textKey]}</option>`);

        // Resolve Image URL
        let imgUrl = 'https://via.placeholder.com/200';
        if (item[imgKey]) {
            if (item[imgKey].startsWith('http')) {
                imgUrl = item[imgKey];
            } else {
                imgUrl = `${window.BACKEND_URL || ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://127.0.0.1:8000' : 'https://itsolutions.muccsbblock1.com/cleaning_services/public')}${item[imgKey]}`;
            }
        }

        const priceHtml = priceKey && item[priceKey] ? `<span class="opt-price">₱${String(item[priceKey]).replace(/^[₱$]+/, '')}</span>` : '';

        const optionHtml = `
                <div class="custom-option" data-value="${item[valueKey]}">
                    <img src="${imgUrl}" class="opt-img" style="width: 42px; height: 42px; border-radius: 8px; object-fit: cover;" alt="${item[textKey]}">
                    <div class="opt-info">
                        <div class="opt-title">${item[textKey]}</div>
                        ${priceHtml}
                    </div>
                </div>
            `;
        optionsContainer.append(optionHtml);
    });

    // Option Click Event
    optionsContainer.find('.custom-option').on('click', function () {
        const value = $(this).data('value');
        const html = $(this).html();

        // Update Trigger UI
        customDropdown.find('.custom-select-trigger span').html(value ? html : 'Select Service');
        customDropdown.removeClass('open');

        // Update Hidden Select & Trigger Change
        select.val(value).trigger('change');

        // Update hidden input for form submission compatibility if needed
        $('#selectedServiceId').val(value);
    });
};

window.toggleBookingDrawer = function (show) {
    const drawer = document.getElementById('bookingDrawer');
    const overlay = document.getElementById('drawerOverlay');

    if (show) {
        drawer.classList.add('open');
        overlay.style.display = 'block';
        setTimeout(() => overlay.style.opacity = '1', 10);
        document.body.style.overflow = 'hidden';
        loadBookingServices();
    } else {
        drawer.classList.remove('open');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 300);
        document.body.style.overflow = '';

        // Reset form logic
        setTimeout(() => {
            document.getElementById('cleanerBookingForm').reset();
            // Reset custom dropdown UI
            const triggerSpan = $('#custom-bookingService .custom-select-trigger span');
            if (triggerSpan.length) triggerSpan.text('Select Service');
            $('#bookingService').val('');
            $('#selectedServiceId').val('');
        }, 300);
    }
};

// Close dropdowns when clicking outside (Global Listener)
$(document).on('click', function (e) {
    if (!$(e.target).closest('.custom-select-wrapper').length) {
        $('.custom-select-wrapper').removeClass('open');
    }
});

function loadBookingServices() {
    // We'll populate the select element first, then convert it to rich select
    // Ensure the HTML has a <select id="bookingService">

    ApiClient.get('/services?active_only=true')
        .then(res => {
            if (res.success) {
                // Use the new populateRichSelect function
                // Data, valueKey, textKey, priceKey, imgKey
                populateRichSelect('#bookingService', res.data, 'id', 'title', 'price', 'image');
            }
        })
        .catch(err => {
            console.error('Error loading services:', err);
            UiUtils.showToast('Failed to load services', 'error');
        });
}

window.submitCleanerBooking = async function () {
    // 1. Validate
    const firstName = $('#custFirstName').val().trim();
    const middleName = $('#custMiddleName').val().trim();
    const lastName = $('#custLastName').val().trim();
    const email = $('#custEmail').val().trim();
    const phone = $('#custPhone').val().trim();
    const address = $('#custAddress').val().trim();

    // Get service ID from hidden input or select
    const serviceId = $('#bookingService').val() || $('#selectedServiceId').val();

    const date = $('#bookingDate').val();
    const time = $('#bookingTime').val();

    if (!firstName || !lastName || !email || !phone || !address || !serviceId || !date || !time) {
        UiUtils.showToast('Please fill in all required fields.', 'warning');
        return;
    }

    // Construct Full Name
    const fullName = `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`;

    // 2. Get Current Cleaner ID
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    let cleanerId = userData.id || userData.user_id;

    // Fallback 1: Parse token if cleanerId is still missing
    if (!cleanerId) {
        const token = localStorage.getItem('auth_token');
        if (token && token.split('.').length === 3) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const payload = JSON.parse(jsonPayload);
                cleanerId = payload.sub || payload.id || payload.user_id;
            } catch (e) {
                console.error('Error parsing token for cleaner ID:', e);
            }
        }
    }

    // Fallback 2: Fetch from API if still missing
    if (!cleanerId) {
        try {
            const btn = document.querySelector('#bookingDrawer .btn-primary');
            UiUtils.setBtnLoading($(btn), true, 'Verifying Session...');

            const response = await ApiClient.get('/cleaner/dashboard');
            if (response.success && response.data && response.data.profile) {
                cleanerId = response.data.profile.id;
                // Save to prevent future calls
                userData.id = cleanerId;
                localStorage.setItem('user_data', JSON.stringify(userData));
            }
        } catch (e) {
            console.error('Failed to fetch cleaner ID from API', e);
        }
    }

    if (!cleanerId) {
        console.error('Cleaner ID missing from session data:', userData);
        UiUtils.showToast('Session error. Please login again.', 'error');
        // Reset button since we are returning early
        const btn = document.querySelector('#bookingDrawer .btn-primary');
        UiUtils.setBtnLoading($(btn), false, '<i class="ri-check-double-line"></i> Confirm Booking');
        return;
    }

    // 3. Payload
    // We send customer details to the backend so it can create/link the user account
    const payload = {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        email: email,
        phone_number: phone,
        address: address,
        service_id: serviceId,
        date: date,
        time: time,
        cleaner_id: cleanerId // Explicitly linking current cleaner
    };

    // 4. Submit
    const btn = document.querySelector('#bookingDrawer .btn-primary');
    UiUtils.setBtnLoading($(btn), true, 'Booking...');

    ApiClient.post('/cleaner/bookings', payload)
        .then(res => {
            if (res.success) {
                let msg = 'Booking confirmed!';
                if (res.user_created) {
                    msg += ` New customer account created.`;
                }
                UiUtils.showToast(msg, 'success');
                toggleBookingDrawer(false);
                $('#schedule-table').DataTable().ajax.reload();
            } else {
                UiUtils.showToast(res.message || 'Booking failed.', 'error');
                console.error('Booking Error:', res);
            }
        })
        .catch(err => {
            console.error('Booking API Error:', err);
            // Extract validation errors if available
            let msg = 'Failed to create booking.';
            if (err.responseJSON && err.responseJSON.message) {
                msg = err.responseJSON.message;
            }
            UiUtils.showToast(msg, 'error');
        })
        .finally(() => {
            UiUtils.setBtnLoading($(btn), false, '<i class="ri-check-double-line"></i> Confirm Booking');
        });
};

// --- ADD BOOKING DRAWER LOGIC END ---

// Setup Modal Actions and Listeners
$(document).ready(function () {
    $('#confirmAcceptBtn').on('click', function () {
        if (currentJobId) {
            const btn = $(this);
            UiUtils.setBtnLoading(btn, true, 'Accepting...');
            updateJobStatus(currentJobId, 'confirmed', btn, 'Yes, Accept');
        }
    });

    $('#confirmRejectBtn').on('click', function () {
        if (currentJobId) {
            const btn = $(this);
            UiUtils.setBtnLoading(btn, true, 'Rejecting...');
            updateJobStatus(currentJobId, 'declined', btn, 'Yes, Decline');
        }
    });

    $('#confirmCompleteBtn').on('click', function () {
        if (currentJobId) {
            const btn = $(this);
            UiUtils.setBtnLoading(btn, true, 'Completing...');
            updateJobStatus(currentJobId, 'completed', btn, 'Yes, Complete');
        }
    });

    $('#confirmStartBtn').on('click', function () {
        if (currentJobId) {
            const btn = $(this);
            UiUtils.setBtnLoading(btn, true, 'Starting...');
            updateJobStatus(currentJobId, 'in_progress', btn, 'Start Job');
        }
    });

    // Close Modals on Outside Click
    $('.custom-modal').on('click', function (e) {
        if (e.target === this) {
            const id = $(this).attr('id');
            toggleModal(id, false);
            if (id !== 'logout-modal') currentJobId = null;
        }
    });

    // Logout Modal Handling is primarily in cleaner-sidebar.js
    // We keep this just in case, but ensure no conflict
    $('#logoutSidebarBtn').off('click').on('click', function (e) {
        e.preventDefault();
        const modal = document.getElementById('logout-modal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    });

    $('#logout-modal').on('click', function (e) {
        if (e.target === this) closeLogoutModal();
    });

    $('#confirmLogoutBtn').on('click', function () {
        // Reuse existing logout logic from sidebar or implement here if sidebar logic is isolated
        // Assuming cleaner-sidebar.js handles the actual API call if we just trigger it or we can duplicate logic
        // Since cleaner-sidebar.js is loaded, we can just let it handle the logout if it's attached to #confirmLogoutBtn
        // However, cleaner-sidebar.js attaches listener to #confirmLogoutBtn on ready. 
        // Since we added the modal dynamically or it exists in HTML, sidebar js should pick it up.
        // BUT cleaner-sidebar.js might have run before this HTML was fully ready if it was injected? 
        // No, this is a static HTML file update. So cleaner-sidebar.js will attach its listener.
    });

    // Filter Tabs Logic
    $('.status-tabs .filter-tab').on('click', function () {
        // UI Update
        $('.status-tabs .filter-tab').removeClass('active');
        $(this).addClass('active');

        // Filter Logic
        const filterValue = $(this).data('filter');
        const table = $('#schedule-table').DataTable();

        if (filterValue === 'all') {
            table.column(5).search('').draw();
        } else {
            const searchText = (filterValue === 'in_progress') ? 'In Progress' : filterValue;
            table.column(5).search(searchText, true, false).draw();
        }
    });

    // Trigger click on active tab to set initial styles
    $('.status-tabs .filter-tab.active').trigger('click');
});

    window.updateJobStatus = function (id, status, btn, originalText) {
        // Proceed with API call directly
        ApiClient.post(`/cleaner/jobs/${id}/status`, { status: status })
            .then(function (response) {
                if (response.success) {
                    UiUtils.showToast('Job status updated', 'success');
                    $('#schedule-table').DataTable().ajax.reload();

                // If this was an acceptance that triggered auto-rejections, reload the page
                if (status === 'confirmed') {
                    closeAcceptModal();
                    
                    // Check if there were auto-rejections by looking for a special flag in response
                    if (response.has_auto_rejections) {
                        // Reload the entire page to ensure UI consistency
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    }
                } else if (status === 'declined') closeRejectModal();
                else if (status === 'in_progress') closeStartModal();
                else if (status === 'completed') closeCompleteModal();
                } else {
                    UiUtils.showToast(response.message || 'Failed to update status', 'error');
                }
            })
        .catch(function (xhr) {
            console.error('Status update error:', xhr);
            let msg = 'Error updating status';
            if (xhr.responseJSON && xhr.responseJSON.message) {
                msg = xhr.responseJSON.message;
            }
            UiUtils.showToast(msg, 'error');
        })
        .finally(function () {
            if (btn) UiUtils.setBtnLoading(btn, false, originalText);
        });
};
window.openStartModal = function (id) {
    currentJobId = id;
    toggleModal('start-modal', true);
};

window.closeStartModal = function () {
    currentJobId = null;
    toggleModal('start-modal', false);
};

