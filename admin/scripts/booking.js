/**
 * Admin Booking Management Script
 * Handles fetching booking data, filtering, and UI interactions.
 */

$(document).ready(function () {
    // Configuration
    const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:8000/api'
        : 'https://itsolutions.muccsbblock1.com/cleaning_services/public/api';

    // State
    let bookings = [];
    let clients = [];
    let services = [];
    let cleaners = [];
    let currentFilter = 'all';

    // Initialization
    init();

    function init() {
        loadBookings();
        loadDropdownData();
        setupEventListeners();
        setupAvailabilityChecks();
        startRealtimeClock();
    }

    function startRealtimeClock() {
        const updateTime = () => {
            const now = new Date();
            const options = { month: 'short', day: 'numeric' };
            const dateStr = now.toLocaleDateString('en-US', options);
            // Example: Today, Oct 24
            $('#realtimeDateDisplay').text(`Today, ${dateStr}`);
        };

        updateTime(); // Initial call
        setInterval(updateTime, 60000); // Update every minute
    }

    function loadDropdownData() {
        // Load Clients
        ApiClient.get('/admin/users?role=customer').then(res => {
            if (res.success) {
                clients = res.data;
                populateRichSelect('#bookingClient', clients, 'id', 'name', null, 'avatar', 'client');
            }
        });

        // Load Services with rich data
        ApiClient.get('/admin/services').then(res => {
            if (res.success) {
                services = res.data;
                populateRichSelect('#bookingService', services, 'id', 'title', 'price', 'image', 'service');
            }
        });

        // Load Cleaners with rich data
        ApiClient.get('/admin/cleaners?status=approved').then(res => {
            if (res.success) {
                cleaners = res.data;
                // For cleaners list, 'name' is directly on object from map
                // We assume backend sends avatar or profile_photo_path. Let's check cleaner object structure in backend or just map it.
                // Usually cleaner list endpoint returns user object merged with profile.
                populateRichSelect('#bookingCleaner', cleaners, 'user_id', 'name', null, 'img', 'cleaner');
            }
        });
    }

    function parseDurationMinutes(s) {
        const str = (s || '').toLowerCase();
        let m = 60;
        const hMatch = str.match(/(\d+)\s*h/);
        const mMatch = str.match(/(\d+)\s*m/);
        if (hMatch) m = parseInt(hMatch[1], 10) * 60;
        else if (mMatch) m = parseInt(mMatch[1], 10);
        return m;
    }

    function minutesFromHHMM(t) {
        const parts = (t || '').split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h * 60 + m;
    }

    function normalizeToHHMM(display) {
        if (!display) return '';
        const ampm = (display + '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (ampm) {
            let h = parseInt(ampm[1], 10);
            const min = ampm[2];
            const ap = ampm[3].toUpperCase();
            if (ap === 'PM' && h !== 12) h += 12;
            if (ap === 'AM' && h === 12) h = 0;
            return `${String(h).padStart(2,'0')}:${min}`;
        }
        // Accept HH:mm:ss
        if ((display + '').length >= 5) return (display + '').substring(0,5);
        return display + '';
    }

    function setupAvailabilityChecks() {
        const trigger = function() { validateCleanerAvailabilityUI(); };
        $('#bookingCleaner').on('change', trigger);
        $('#bookingService').on('change', trigger);
        $('#bookingDate').on('change', trigger);
        $('#bookingTime').on('change', trigger);
    }

    function validateCleanerAvailabilityUI() {
        const msgEl = $('#cleaner-availability-msg');
        if (!msgEl.length) return;

        msgEl.hide().text('');
        const submitBtn = $('#bookingDrawer form').find('button[type="submit"]');
        submitBtn.prop('disabled', false);

        const cleanerId = $('#bookingCleaner').val();
        const serviceId = $('#bookingService').val();
        const date = $('#bookingDate').val();
        const time = $('#bookingTime').val();

        if (!cleanerId || !serviceId || !date || !time) return;

        const service = services.find(s => String(s.id) === String(serviceId));
        const baseMinutes = parseDurationMinutes(service?.duration || '1h');
        const newStartMinutes = minutesFromHHMM(time);
        const newEndMinutes = newStartMinutes + baseMinutes;

        const conflicts = bookings
            .filter(b => {
                const sameCleaner = String(b.cleaner_id) === String(cleanerId);
                const status = (b.status || '').toLowerCase();
                // Only consider bookings that have been accepted by the cleaner as conflicts
                const accepted = status === 'confirmed' || status === 'in_progress' || status === 'completed';
                return sameCleaner && (b.date === date) && accepted;
            })
            .some(b => {
                const existStart = minutesFromHHMM(normalizeToHHMM(b.time));
                const existDur = parseDurationMinutes(b.duration || service?.duration || '1h');
                const existEnd = existStart + existDur;
                return newStartMinutes < existEnd && newEndMinutes > existStart;
            });

        if (conflicts) {
            msgEl.text('Selected cleaner is not available at this time for the selected service duration. Please choose another time or cleaner.').show();
            submitBtn.prop('disabled', true);
        }
    }

    function populateSelect(selector, data, valueKey, textKey) {
        const select = $(selector);
        // Keep first option
        const first = select.find('option:first');
        select.empty().append(first);

        data.forEach(item => {
            select.append(`<option value="${item[valueKey]}">${item[textKey]}</option>`);
        });
    }

    function populateRichSelect(selector, data, valueKey, textKey, priceKey, imgKey, type) {
        const container = $(selector).parent();
        // Hide original select but keep it for form submission
        const select = $(selector).hide();

        // Determine label
        let label = 'Option';
        if (type === 'service') label = 'Service';
        else if (type === 'cleaner') label = 'Cleaner';
        else if (type === 'client') label = 'Client';

        // Create custom dropdown UI if not exists
        let customDropdown = container.find('.custom-select-wrapper');
        if (customDropdown.length === 0) {
            customDropdown = $(`
                <div class="custom-select-wrapper" id="custom-${selector.replace('#', '')}">
                    <div class="custom-select-trigger">
                        <span>Select ${label}</span>
                        <i class="ri-arrow-down-s-line"></i>
                    </div>
                    <div class="custom-options"></div>
                </div>
            `);
            container.append(customDropdown);

            // Toggle dropdown
            customDropdown.find('.custom-select-trigger').on('click', function (e) {
                e.stopPropagation();
                $('.custom-select-wrapper').not(customDropdown).removeClass('open');
                customDropdown.toggleClass('open');
            });
        }

        const optionsContainer = customDropdown.find('.custom-options');
        optionsContainer.empty();

        // Add default "Select" option logic
        optionsContainer.append(`
            <div class="custom-option" data-value="">
                <span style="color: var(--text-light);">Select ${label}</span>
            </div>
        `);

        // Clear original select
        const firstText = select.find('option:first').text();
        select.empty().append(`<option value="">${firstText}</option>`);

        data.forEach(item => {
            // Update original select
            select.append(`<option value="${item[valueKey]}">${item[textKey]}</option>`);

            // Use ImageUtils for consistent image URL handling
            let imgUrl;
            if (type === 'service') {
                imgUrl = ImageUtils.getServiceImageUrl(item[imgKey]);
            } else {
                // For clients and cleaners: pass whole object to allow multiple key fallbacks
                const avatarSource = (item[imgKey] !== undefined && item[imgKey] !== null) ? item[imgKey] : item;
                imgUrl = ImageUtils.getAvatarUrl(avatarSource);
            }

            // Add cache-busting
            imgUrl = ImageUtils.withCacheBust(imgUrl);

            const priceHtml = priceKey && item[priceKey] ? `<span class="opt-price">₱${String(item[priceKey]).replace(/^[₱$]+/, '')}</span>` : '';

            const optionHtml = `
                <div class="custom-option" data-value="${item[valueKey]}">
                    <img src="${imgUrl}" class="opt-img" alt="${item[textKey]}" onerror="ImageUtils.handleImageError(this, '../../assets/images/default-avatar.png')">
                    <div class="opt-info">
                        <div class="opt-title">${item[textKey]}</div>
                        ${priceHtml}
                    </div>
                </div>
            `;
            optionsContainer.append(optionHtml);
        });

        // Option click handler
        optionsContainer.find('.custom-option').on('click', function () {
            const value = $(this).data('value');
            const html = $(this).html();

            // Update UI
            customDropdown.find('.custom-select-trigger span').html(value ? html : `Select ${label}`);
            customDropdown.removeClass('open');

            // Update original select value
            select.val(value).trigger('change');

            // Visual fix for trigger content layout
            if (value) {
                // Styling now handled by CSS class .custom-select-trigger .opt-info
                // No inline styles needed
            }

            // Auto-fill for Client
            if (type === 'client' && value) {
                const client = data.find(c => c.id == value);
                if (client) {
                    if (client.address) $('#bookingAddress').val(client.address);
                    const phone = client.phone_number || client.phone;
                    if (phone) $('#bookingPhone').val(phone);
                }
            }
        });
    }

    // Close dropdowns when clicking outside
    $(document).on('click', function (e) {
        if (!$(e.target).closest('.custom-select-wrapper').length) {
            $('.custom-select-wrapper').removeClass('open');
        }
    });

    // --- Data Fetching ---

    function loadBookings() {
        // Show loading state (optional improvement)
        $('#bookingList').html('<div style="text-align:center; padding:20px; color:var(--text-light);">Loading bookings...</div>');

        ApiClient.get('/admin/bookings')
            .then(function (response) {
                if (response.success) {
                    bookings = response.data;
                    renderBookings();
                } else {
                    $('#bookingList').html('<div style="text-align:center; padding:20px; color:var(--danger);">Failed to load bookings.</div>');
                }
            })
            .catch(function (xhr) {
                console.error('API fetch failed', xhr);
                $('#bookingList').html('<div style="text-align:center; padding:20px; color:var(--danger);">Error loading bookings.</div>');
            });
    }

    // --- Rendering ---

    function renderBookings() {
        const container = $('#bookingList');
        container.empty();

        let filteredBookings = bookings.filter(b => {
            if (currentFilter === 'all') return true;

            // Mapping for custom filter labels
            let targetStatus = currentFilter;
            if (currentFilter === 'declined (reassign)') targetStatus = 'declined';

            return b.status.toLowerCase() === targetStatus;
        });

        // Sort by Status Priority
        const statusPriority = {
            'pending': 1,
            'assigned': 2,
            'confirmed': 3,
            'in_progress': 4,
            'declined': 5,
            'cancelled': 6,
            'completed': 7,
            'done': 7
        };

        filteredBookings.sort((a, b) => {
            const statusA = a.status.toLowerCase();
            const statusB = b.status.toLowerCase();

            const priorityA = statusPriority[statusA] || 99;
            const priorityB = statusPriority[statusB] || 99;

            return priorityA - priorityB;
        });

        if (filteredBookings.length === 0) {
            container.html('<div style="text-align:center; padding:20px; color:var(--text-light);">No bookings found.</div>');
            return;
        }

        filteredBookings.forEach(booking => {
            const statusClass = getStatusClass(booking.status);
            const statusLabel = booking.status && booking.status.toLowerCase() === 'in_progress' ? 'In Progress' : capitalize(booking.status);
            const isCancelled = booking.status.toLowerCase() === 'cancelled';
            const isCompleted = booking.status.toLowerCase() === 'completed';
            const isDeclined = booking.status.toLowerCase() === 'declined';
            const isAssigned = booking.status.toLowerCase() === 'assigned';
            const isInProgress = booking.status.toLowerCase() === 'in_progress';

            const isPending = booking.status.toLowerCase() === 'pending';

            let editTitle = 'Edit';
            let editIcon = 'ri-pencil-line';
            let statusBadge = `<span class="b-status">${statusLabel}</span>`;

            if (isPending) {
                statusBadge = `<span class="b-status" style="background:#EBF8FF; color:#3182CE; border:1px solid #BEE3F8;">Assignment Needed</span>`;
                editTitle = 'Assign Cleaner';
                editIcon = 'ri-user-add-line';
            } else if (isAssigned) {
                statusBadge = `<span class="b-status" style="background:#FFFBEB; color:#D97706; border:1px solid #FCD34D;">Assigned (Waiting)</span>`;
            } else if (isDeclined) {
                statusBadge = `<span class="b-status" style="background:#FEF2F2; color:#DC2626; border:1px solid #FECACA;">Declined - Reassign Needed</span>`;
                editTitle = 'Reassign Cleaner';
                editIcon = 'ri-user-shared-line';
            }

            if (isCancelled) {
                editTitle = 'View Details';
                editIcon = 'ri-eye-line';
            } else if (isCompleted) {
                editTitle = 'View Details';
                editIcon = 'ri-eye-line';
            }

            // Avatar Helpers
            const clientAvatar = ImageUtils.getAvatarUrl(booking.client_avatar);
            const cleanerAvatar = ImageUtils.getAvatarUrl(booking.cleaner_avatar);
            const serviceImage = ImageUtils.getServiceImageUrl(booking.service_image);

            const cleanerName = (typeof booking.cleaner === 'object' ? booking.cleaner.name : booking.cleaner) || 'Unassigned';
            const cleanerDisplay = booking.cleaner
                ? `<div class="person-chip"><img src="${cleanerAvatar}" alt="Cleaner" onerror="ImageUtils.handleImageError(this)"><div class="person-info"><span class="person-name">${cleanerName}</span><span class="person-role">Cleaner</span></div></div>`
                : `<div class="person-chip"><div class="person-info"><span class="person-name" style="opacity:0.6; font-style:italic;">Unassigned</span><span class="person-role">Cleaner</span></div></div>`;

            // Format Date for display (e.g., "Oct 24, 2023")
            const dateObj = new Date(booking.date);
            const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            // Format Order ID (BK-XXXX)
            const displayId = booking.display_id || `BK-${String(booking.id).padStart(4, '0')}`;

            const cardHtml = `
                <div class="booking-card ${statusClass}" data-status="${booking.status}">
                    <div class="booking-left-border"></div>
                    <div class="booking-content">
                        <!-- Left: Date & Time -->
                        <div class="booking-date-section">
                            <div class="booking-date">${dateDisplay}</div>
                            <div class="booking-time">${booking.time}</div>
                            <div class="booking-duration">${booking.duration}</div>
                            <div class="booking-id">Booking Number: ${displayId}</div>
                        </div>

                        <!-- Middle: Service & People -->
                        <div class="booking-main-info">
                            <div class="booking-service-header">
                                <img src="${serviceImage}" alt="${booking.service}" class="service-thumb" onerror="ImageUtils.handleImageError(this, '../../assets/images/default-service.png')">
                                <h4 class="service-name">${booking.service}</h4>
                            </div>
                            
                            <div class="booking-meta">
                                <span class="meta-item"><i class="ri-map-pin-line"></i> ${booking.address}</span>
                                <span class="meta-item"><i class="ri-money-dollar-circle-line"></i> ₱${String(booking.price).replace(/^[₱$]+/, '')}</span>
                            </div>

                            <div class="booking-people">
                                <div class="person-chip">
                                    <img src="${clientAvatar}" alt="Client" onerror="ImageUtils.handleImageError(this)">
                                    <div class="person-info">
                                        <span class="person-name">${booking.client}</span>
                                        <span class="person-role">Client</span>
                                    </div>
                                </div>
                                
                                ${cleanerDisplay}
                            </div>
                        </div>

                        <!-- Right: Status & Actions -->
                        <div class="booking-actions-section">
                            ${statusBadge}
                            <div class="action-buttons">
                                <button class="icon-btn view-btn" onclick="viewBooking(${booking.id})" title="${editTitle}">
                                    <i class="${editIcon}"></i>
                                </button>
                                <button class="icon-btn delete-btn" onclick="deleteBooking(${booking.id})" title="Delete">
                                    <i class="ri-delete-bin-line"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.append(cardHtml);
        });
    }

    // --- Helpers ---

    function getStatusClass(status) {
        // Maps data status to CSS class
        // CSS classes: status-pending, status-confirmed, status-cancelled, status-done
        switch (status.toLowerCase()) {
            case 'pending': return 'status-pending';
            case 'assigned': return 'status-pending'; // Use pending style for assigned but maybe yellow text
            case 'confirmed': return 'status-confirmed';
            case 'in_progress': return 'status-confirmed';
            case 'cancelled': return 'status-cancelled';
            case 'declined': return 'status-cancelled'; // Use cancelled style for declined
            case 'completed': return 'status-done'; // Map completed to done
            case 'done': return 'status-done';
            default: return 'status-pending';
        }
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // --- Event Listeners ---

    function setupEventListeners() {
        // Sidebar Toggle handled by admin-sidebar.js

        // Filter Tabs
        $('.status-tabs .tab').on('click', function () {
            // UI Update
            $('.status-tabs .tab').removeClass('active');
            $(this).addClass('active');

            // Logic Update
            const filterText = $(this).text().trim().toLowerCase();
            currentFilter = filterText;
            renderBookings();
        });

        // Drawer Toggle (Button & Overlay)
        $('#overlay').on('click', closeDrawer);

        // Date Validation (No Sundays)
        $('#bookingDate').on('input change', function () {
            const inputDate = new Date($(this).val());
            const day = inputDate.getUTCDay(); // 0 = Sunday

            if (day === 0) {
                UiUtils.showToast('Sundays are not available. Please select another date.', 'warning');
                $(this).val('');
            }
        });

        // Time Validation (8 AM - 5 PM)
        $('#bookingTime').on('change', function () {
            const timeStr = $(this).val(); // HH:mm
            if (!timeStr) return;

            const [hours, minutes] = timeStr.split(':').map(Number);

            // Convert to minutes for easier comparison
            // 8:00 AM = 8 * 60 = 480
            // 5:00 PM = 17 * 60 = 1020
            const totalMinutes = hours * 60 + minutes;

            if (totalMinutes < 480 || totalMinutes > 1020) {
                UiUtils.showToast('Operating hours are 8:00 AM to 5:00 PM only.', 'warning');
                $(this).val('');
            }
        });

        // Phone Validation
        $('#bookingPhone').on('input', function () {
            let val = $(this).val().replace(/\D/g, ''); // Remove non-digits
            if (val.length > 11) val = val.slice(0, 11);
            $(this).val(val);
        });

        $('#bookingPhone').on('blur', function () {
            const val = $(this).val();
            if (val.length > 0) {
                if (!val.startsWith('09')) {
                    UiUtils.showToast('Phone number must start with 09', 'warning');
                } else if (val.length !== 11) {
                    UiUtils.showToast('Phone number must be 11 digits', 'warning');
                }
            }
        });

        // Form Submission
        $('#bookingDrawer form').on('submit', function (e) {
            e.preventDefault();

            const btn = $(this).find('button[type="submit"]');
            const form = $(this);
            const bookingId = form.data('id');

            const bookingData = {
                user_id: $('#bookingClient').val(),
                service_id: $('#bookingService').val(),
                cleaner_id: $('#bookingCleaner').val() || null,
                date: $('#bookingDate').val(),
                time: $('#bookingTime').val(),
                address: $('#bookingAddress').val(),
                phone_number: $('#bookingPhone').val(),
                status: bookingId ? $('#bookingStatus').val() : ($('#bookingCleaner').val() ? 'assigned' : 'pending') // Default to assigned if cleaner selected
            };

            // If reassigning (status was declined), ensure status becomes 'assigned'
            if (btn.text() === 'Reassign Cleaner') {
                bookingData.status = 'assigned';
                if (!bookingData.cleaner_id) {
                    UiUtils.showToast('Please select a new cleaner to reassign', 'warning');
                    return;
                }
            }

            if (!bookingData.user_id || !bookingData.service_id || !bookingData.date || !bookingData.time || !bookingData.address || !bookingData.phone_number) {
                UiUtils.showToast('Please fill in required fields', 'warning');
                return;
            }

            // Strict Phone Validation
            if (!/^09\d{9}$/.test(bookingData.phone_number)) {
                UiUtils.showToast('Invalid phone number. Must start with 09 and be 11 digits.', 'warning');
                return;
            }

            const to24 = (display) => {
                if (!display) return '';
                const m = (display + '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                if (!m) return (display + '').substring(0,5);
                let h = parseInt(m[1], 10);
                const min = m[2];
                const ap = m[3].toUpperCase();
                if (ap === 'PM' && h !== 12) h += 12;
                if (ap === 'AM' && h === 12) h = 0;
                return `${String(h).padStart(2,'0')}:${min}`;
            };
            // Check for duplicate booking by the same customer for the same service at the same time
            const duplicateSlot = bookings.some(b => {
                const sameCustomer = String(b.user_id) === String(bookingData.user_id);
                const sameService = String(b.service_id) === String(bookingData.service_id);
                const sameDate = (b.date || '') === bookingData.date;
                const sameTime = to24(b.time) === bookingData.time;
                const status = (b.status || '').toLowerCase();
                const notCancelled = status !== 'cancelled';
                const differentRecord = !bookingId || String(b.id) !== String(bookingId);
                return sameCustomer && sameService && sameDate && sameTime && notCancelled && differentRecord;
            });
            if (duplicateSlot) {
                UiUtils.showToast('Customer already booked this service at this date and time.', 'error');
                return;
            }

            UiUtils.setBtnLoading(btn, true, 'Saving...');

            const request = bookingId
                ? ApiClient.put(`/admin/bookings/${bookingId}`, bookingData)
                : ApiClient.post('/admin/bookings', bookingData);

            request
                .then(function (response) {
                    if (response.success) {
                        UiUtils.showToast(bookingId ? 'Booking updated' : 'Booking created successfully', 'success');
                        loadBookings();
                        closeDrawer();
                    } else {
                        UiUtils.showToast(response.message || 'Failed to save booking', 'error');
                    }
                })
                .catch(function (xhr) {
                    UiUtils.showToast(xhr.responseJSON?.message || 'Error saving booking', 'error');
                })
                .finally(function () {
                    UiUtils.setBtnLoading(btn, false, 'Confirm Booking');
                });
        });
    }

    // --- Global Functions (for HTML onclicks) ---

    let bookingToDeleteId = null;

    window.toggleDrawer = function () {
        const drawer = $('#bookingDrawer');
        const overlay = $('#overlay');
        const form = drawer.find('form');

        // Reset UI state helper
        const resetFormState = () => {
            form[0].reset();
            form.removeData('id');
            form.find('input, select').prop('disabled', false);
            form.find('button[type="submit"]').prop('disabled', false).show().text('Confirm Booking');
            $('#bookingStatusGroup').hide(); // Hide status for new booking
            $('#reassignNote').hide(); // Hide reassign note for new booking

            // Reset custom dropdowns
            $('.custom-select-trigger span').each(function () {
                const wrapperId = $(this).closest('.custom-select-wrapper').attr('id');
                let type = 'Option';
                if (wrapperId.includes('Service')) type = 'Service';
                else if (wrapperId.includes('Cleaner')) type = 'Cleaner';
                else if (wrapperId.includes('Client')) type = 'Client';

                $(this).text(`Select ${type}`);
            });

            // Reset dropdown disabled states
            $('.custom-select-wrapper').css({ 'pointer-events': 'auto', 'opacity': '1' });
            $('#custom-bookingCleaner .custom-option').css({ 'opacity': '1', 'pointer-events': 'auto', 'background': 'transparent' });
            $('#custom-bookingCleaner .opt-title span').remove();

            $('#drawerTitle').text('New Booking');

            // Set default date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            // If tomorrow is Sunday (0), move to Monday
            if (tomorrow.getDay() === 0) {
                tomorrow.setDate(tomorrow.getDate() + 1);
            }

            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            $('#bookingDate').val(tomorrowStr).attr('min', tomorrowStr);
        };

        if (drawer.hasClass('open')) {
            drawer.removeClass('open');
            overlay.removeClass('active');
            resetFormState();
        } else {
            drawer.addClass('open');
            overlay.addClass('active');
            resetFormState(); // Ensure fresh state for new booking
        }
    };

    function closeDrawer() {
        $('#bookingDrawer').removeClass('open');
        $('#overlay').removeClass('active');
        const form = $('#bookingDrawer form');

        // Reset form and UI state
        form[0].reset();
        form.removeData('id');
        form.find('input, select').prop('disabled', false);
        form.find('button[type="submit"]').prop('disabled', false).show();
        $('#drawerTitle').text('New Booking');
    }

    // View/Edit Action
    window.viewBooking = function (id) {
        // UiUtils.showToast('Fetching details...', 'info');
        ApiClient.get(`/admin/bookings/${id}`)
            .then(function (response) {
                if (response.success) {
                    const b = response.data;
                    const form = $('#bookingDrawer form');
                    form.data('id', b.id);

                    $('#bookingClient').val(b.user_id);
                    $('#bookingService').val(b.service_id);
                    $('#bookingCleaner').val(b.cleaner_id);
                    $('#bookingDate').val(b.date);
                    // Time format might need adjustment depending on input type="time" requirement (HH:mm)
                    // Backend sends HH:mm:ss usually, or we formatted it in index but show returns raw model usually
                    // Let's assume raw model has H:i:s. Input time needs H:i.
                    // If b.time is "14:30:00", input accepts "14:30".
                    $('#bookingTime').val(b.time ? b.time.substring(0, 5) : '');
                    $('#bookingAddress').val(b.address);
                    $('#bookingPhone').val(b.phone_number || '');

                    // Set min date for edit to allow keeping current date even if today/past (optional policy)
                    // Or enforce future rule: $('#bookingDate').attr('min', new Date().toISOString().split('T')[0]);
                    // Usually for edit, we allow the existing date. But if they change it, validation triggers.
                    // Let's set min to tomorrow ONLY for new changes if we want strictness, but for UX on edit, 
                    // it's better not to lock them out of the current value.
                    // However, user asked "cannot select an past date". 
                    // So we set min to tomorrow, but if the booking is in the past, this might break the UI display of the date input?
                    // HTML5 date input will still show the value even if it violates min, but validity will fail.

                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = tomorrow.toISOString().split('T')[0];
                    $('#bookingDate').attr('min', tomorrowStr);

                    // Update Custom Dropdowns for Edit Mode
                    if (b.user_id) {
                        const clientOption = $(`#custom-bookingClient .custom-option[data-value="${b.user_id}"]`);
                        if (clientOption.length) {
                            $('#custom-bookingClient .custom-select-trigger span').html(clientOption.html());
                        } else {
                            // Fallback when client option is missing (e.g., not loaded yet)
                            const clientName = (typeof b.client === 'object' ? b.client?.name : b.client) || 'Client';
                            const clientAvatar = ImageUtils.getAvatarUrl(b.client || b.client_avatar);
                            const fallbackHtml = `
                                <img src="${clientAvatar}" class="opt-img" alt="${clientName}" onerror="ImageUtils.handleImageError(this, '../../assets/images/default-avatar.png')">
                                <div class="opt-info">
                                    <div class="opt-title">${clientName}</div>
                                </div>
                            `;
                            $('#custom-bookingClient .custom-select-trigger span').html(fallbackHtml);
                        }
                    }

                    if (b.service_id) {
                        const serviceOption = $(`#custom-bookingService .custom-option[data-value="${b.service_id}"]`);
                        if (serviceOption.length) {
                            $('#custom-bookingService .custom-select-trigger span').html(serviceOption.html());
                            // Styling now handled by CSS
                        }
                    }

                    if (b.cleaner_id) {
                        const cleanerOption = $(`#custom-bookingCleaner .custom-option[data-value="${b.cleaner_id}"]`);
                        if (cleanerOption.length) {
                            $('#custom-bookingCleaner .custom-select-trigger span').html(cleanerOption.html());
                        } else {
                            // Fallback for cleaners not in the list (e.g., deleted or inactive)
                            // Use data from booking details if available
                            const cleanerName = (typeof b.cleaner === 'object' ? b.cleaner.name : b.cleaner) || 'Unknown';
                            // Use booking.cleaner_avatar if available, otherwise default
                            const cleanerAvatar = ImageUtils.getAvatarUrl(b.cleaner_avatar);

                            const fallbackHtml = `
                                <img src="${cleanerAvatar}" class="opt-img" alt="${cleanerName}" onerror="ImageUtils.handleImageError(this, '../../assets/images/default-avatar.png')">
                                <div class="opt-info">
                                    <div class="opt-title">${cleanerName}</div>
                                </div>
                             `;
                            $('#custom-bookingCleaner .custom-select-trigger span').html(fallbackHtml);
                        }
                    } else {
                        $('#custom-bookingCleaner .custom-select-trigger span').text('Select Cleaner');
                    }

                    // Special Logic for Declined Status
                    if (b.status === 'declined') {
                        $('#reassignNote').show();
                        // Fix for cleaner name object issue
                        let cleanerName = b.cleaner;
                        if (typeof b.cleaner === 'object' && b.cleaner !== null) {
                            cleanerName = b.cleaner.name || 'Unknown';
                        }
                        $('#declinedCleanerName').text(cleanerName || 'the cleaner');
                        $('#drawerTitle').text('Reassign Booking');
                        $('#bookingStatus').val('assigned'); // Default to assigned for next save
                        $('#bookingStatusGroup').hide(); // Hide status since we force reassign

                        // Disable the declined cleaner in the dropdown
                        // We need to reset the cleaner selection to empty so admin is forced to choose
                        $('#bookingCleaner').val('');
                        $('#custom-bookingCleaner .custom-select-trigger span').text('Select New Cleaner');

                        // Visual indication in dropdown
                        if (b.cleaner_id) {
                            const declinedOption = $(`#custom-bookingCleaner .custom-option[data-value="${b.cleaner_id}"]`);
                            declinedOption.css({ 'opacity': '0.5', 'pointer-events': 'none', 'background': '#FFF5F5' });
                            declinedOption.find('.opt-title').append(' <span style="color:red; font-size:0.7em;">(Declined)</span>');
                        }
                    } else {
                        $('#reassignNote').hide();
                        // Reset any disabled options
                        $('#custom-bookingCleaner .custom-option').css({ 'opacity': '1', 'pointer-events': 'auto', 'background': 'transparent' });
                        $('#custom-bookingCleaner .custom-option:hover').css('background', 'var(--primary-light)');
                        // Remove appended text
                        $('#custom-bookingCleaner .opt-title span').remove();
                    }

                    // Handle Status Update
                    if (b.status !== 'declined') {
                        $('#bookingStatus').val(b.status);
                        $('#bookingStatusGroup').show();
                    }

                    // Handle Cancelled or Completed Status (View Only)
                    const isReadOnly = b.status === 'cancelled' || b.status === 'completed';

                    if (isReadOnly) {
                        $('#drawerTitle').text(`Booking Details (${capitalize(b.status)})`);

                        // Disable ALL inputs including status
                        form.find('input, select').prop('disabled', true);
                        $('.custom-select-wrapper').css('pointer-events', 'none').css('opacity', '0.6');

                        // Completely hide the submit button in view-only mode
                        form.find('button[type="submit"]').hide();
                    } else if (b.status === 'declined') {
                        // Reassign mode handled above
                        form.find('input, select').prop('disabled', false);
                        // Lock other fields except cleaner
                        $('#bookingClient, #bookingService, #bookingDate, #bookingTime, #bookingAddress, #bookingPhone').prop('disabled', true);
                        // Disable custom dropdowns for locked fields
                        $('#custom-bookingClient, #custom-bookingService').css('pointer-events', 'none').css('opacity', '0.7');

                        $('.custom-select-wrapper#custom-bookingCleaner').css('pointer-events', 'auto').css('opacity', '1');
                        form.find('button[type="submit"]').show().text('Reassign Cleaner');
                    } else {
                        $('#drawerTitle').text('Edit Booking');
                        form.find('input, select').prop('disabled', false);
                        // Enable custom dropdowns
                        $('.custom-select-wrapper').css('pointer-events', 'auto').css('opacity', '1');
                        form.find('button[type="submit"]').show().text('Update Booking');
                    }

                    $('#bookingDrawer').addClass('open');
                    $('#overlay').addClass('active');
                }
            })
            .catch(function (xhr) {
                UiUtils.showToast('Failed to load booking details', 'error');
            });
    };

    window.updateStatus = function (id, status) {
        // Implement status update
    };

    window.deleteBooking = function (id) {
        bookingToDeleteId = id;
        $('#deleteModalOverlay').css('display', 'flex').fadeIn(200);
    };

    // Modal Event Listeners
    $('#cancelDeleteBtn, #deleteModalOverlay').on('click', function (e) {
        if (e.target === this || this.id === 'cancelDeleteBtn') {
            $('#deleteModalOverlay').fadeOut(200);
            bookingToDeleteId = null;
        }
    });

    $('#confirmDeleteBtn').on('click', function () {
        if (!bookingToDeleteId) return;

        const btn = $(this);

        UiUtils.setBtnLoading(btn, true, 'Deleting...');

        ApiClient.delete(`/admin/bookings/${bookingToDeleteId}`)
            .then(function (response) {
                UiUtils.showToast('Booking deleted successfully', 'success');
                loadBookings();
                $('#deleteModalOverlay').fadeOut(200);
            })
            .catch(function (xhr) {
                UiUtils.showToast('Failed to delete booking', 'error');
            })
            .finally(function () {
                UiUtils.setBtnLoading(btn, false, 'Yes, Delete');
                bookingToDeleteId = null;
            });
    });

});
