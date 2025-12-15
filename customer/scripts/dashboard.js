// State
let servicesData = [];
let bookings = [];
let cleanersData = [];
let bookingTable;
let currentService = null;
let currentPrice = null;
let currentRatingBookingId = null;
let currentBookingStatusFilter = 'All'; // Added for booking status filtering

const SERVER_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : 'https://itsolutions.muccsbblock1.com/cleaning_services/public';

// Use ImageUtils for all image URL construction
// No need for custom getServiceImageUrl, ImageUtils handles it all


// Enhanced image loading with better error handling
function loadImageWithFallback(imgElement, primarySrc, fallbackSrc) {
    // Set initial source
    imgElement.src = primarySrc;

    // Add error handler
    imgElement.onerror = function () {
        // If the primary source failed, try the fallback
        if (imgElement.src !== fallbackSrc) {
            imgElement.src = fallbackSrc;
            // Add additional styling for fallback images
            imgElement.style.objectFit = 'cover';
            imgElement.style.backgroundColor = '#f8fafc';
        } else {
            // If fallback also fails, show a placeholder
            console.warn('Both primary and fallback image sources failed:', primarySrc);
        }
    };

    // Add load handler for successful loads
    imgElement.onload = function () {
        // Reset any error styling if image loads successfully
        imgElement.style.objectFit = 'cover';
        imgElement.style.backgroundColor = '';
    };
}

// Pagination state for mobile timeline
let timelineCurrentPage = 1;
const timelineItemsPerPage = 5;

// Service Pagination & Filtering State
let currentServicePage = 1;
const itemsPerPage = 6;
let currentCategory = 'All';
let currentSort = 'newest'; // Added Sort State
let searchQuery = '';

// --- INITIALIZATION ---
$(document).ready(function () {
    loadDashboardData();

    // Setup Profile Image Preview
    $('#upload-file').change(updateProfileImage);

    // Setup Logout
    $('#sidebar-logout-mobile').on('click', openLogoutModal);
    $('.sidebar-logout-desktop').on('click', openLogoutModal);

    // Setup Logout Modal Close on Outside Click
    $('#logout-modal').on('click', function (e) {
        if (e.target === this) {
            closeLogoutModal();
        }
    });

    // Setup Delete Modal Close on Outside Click
    $('#delete-modal').on('click', function (e) {
        if (e.target === this) {
            closeDeleteModal();
        }
    });

    // Setup Search Listener
    $('#service-search').on('input', function (e) {
        searchQuery = e.target.value.toLowerCase();
        currentServicePage = 1; // Reset to first page on search
        renderServices();
    });

    // Realtime Polling (every 5 minutes)
    setInterval(function () {
        loadDashboardData(true); // true = silent mode
    }, 60000);
});

function handleLogout(e) {
    e.preventDefault();
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.classList.add('open'); // Changed from 'active' to 'open' to match CSS
        document.body.style.overflow = 'hidden';
    }
}

function renderUpcomingIfNear(upcomingJob, allBookings) {
    const NEAR_THRESHOLD_DAYS = 3; // Configurable threshold: 3 days

    // 1. Identify the true nearest active booking from the list
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validStatuses = ['pending', 'confirmed', 'assigned', 'declined'];

    // Ensure we have bookings to check
    if (!allBookings || !Array.isArray(allBookings)) {
        $('#upcoming-widget').hide();
        return;
    }

    const futureBookings = allBookings.filter(b => {
        // Parse date. format is YYYY-MM-DD
        const bDate = new Date(b.date);
        // We include today
        if (bDate < today) return false;

        const status = b.raw_status || (b.status ? b.status.toLowerCase() : '');
        return validStatuses.includes(status);
    });

    if (futureBookings.length === 0) {
        $('#upcoming-widget').hide();
        return;
    }

    // Sort by date and time ascending
    futureBookings.sort((a, b) => {
        const dateA = new Date(a.date + (a.time ? ' ' + a.time : ''));
        const dateB = new Date(b.date + (b.time ? ' ' + b.time : ''));
        return dateA - dateB;
    });

    const nearest = futureBookings[0];
    const nearestDate = new Date(nearest.date + (nearest.time ? ' ' + nearest.time : ''));

    // Calculate difference in days
    const diffTime = nearestDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Check if within threshold
    if (diffDays > NEAR_THRESHOLD_DAYS) {
        $('#upcoming-widget').hide();
        return;
    }

    // If we have an upcomingJob from backend, we use it as it likely contains formatted details
    // We assume the backend's upcomingJob matches our nearest found booking.
    if (upcomingJob) {
        updateUpcomingWidget(upcomingJob);
    } else {
        // Fallback: Construct job object from nearest booking
        const jobToRender = {
            day: nearestDate.getDate(),
            month: nearestDate.toLocaleString('default', { month: 'short' }),
            service: nearest.service,
            time: nearest.time || 'TBD',
            address: nearest.address || 'Registered Address',
            price: nearest.price,
            raw_status: nearest.raw_status || nearest.status.toLowerCase(),
            cleaner: {
                name: nearest.cleaner,
                avatar: nearest.cleaner_avatar,
                email: nearest.cleaner_email,
                phone: nearest.cleaner_phone
            }
        };
        updateUpcomingWidget(jobToRender);
    }
}


function openLogoutModal() {
    $('#logout-modal').addClass('open');
}

function closeLogoutModal() {
    $('#logout-modal').removeClass('open');
}

function confirmLogout() {
    const btn = $('#confirmLogoutBtn');
    if (btn.length) {
        UiUtils.setBtnLoading(btn, true, 'Logging out...');
    }

    // Simulate network request for loading visualization
    setTimeout(() => {
        // Clear storage and redirect
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('user_role');
        window.location.href = '../../auth/templates/login.html';
    }, 800);
}

// --- DATA FETCHING ---
function loadDashboardData(silent = false) {
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    $('#current-date').text(new Date().toLocaleDateString('en-US', dateOptions));

    ApiClient.get('/customer/dashboard')
        .then(function (response) {
            if (response.success) {
                initDashboard(response.data);
            } else if (!silent) {
                UiUtils.showToast('Failed to load dashboard data.', 'error');
            }
        })
        .catch(function (xhr) {
            if (!silent) {
                console.error('API Error:', xhr);
                UiUtils.showToast('Error loading data from server.', 'error');
            }
        });
}

function initDashboard(data) {
    servicesData = data.services;
    bookings = data.bookings;

    // Sort by Status Priority
    const statusPriority = {
        'assigned': 1,
        'confirmed': 2,
        'pending': 3,
        'declined': 4,
        'cancelled': 5,
        'completed': 6,
        'done': 6
    };

    bookings.sort((a, b) => {
        const statusA = (a.raw_status || a.status).toLowerCase();
        const statusB = (b.raw_status || b.status).toLowerCase();

        const priorityA = statusPriority[statusA] || 99;
        const priorityB = statusPriority[statusB] || 99;

        return priorityA - priorityB;
    });

    cleanersData = data.cleaners;

    updateUser(data.user);
    renderUpcomingIfNear(data.upcomingJob, bookings);
    renderRecentHistory(bookings);

    // Initial Service Render
    renderServices();

    renderTrending();
    renderCleaners(data.cleaners);
    initBookingTable();

    // Check for pending booking from landing page
    const pendingServiceId = localStorage.getItem('pendingServiceId');
    if (pendingServiceId) {
        // Ensure type matching (localStorage is string, id might be int)
        const service = servicesData.find(s => s.id == pendingServiceId);
        if (service) {
            openBooking(service.id);
            localStorage.removeItem('pendingServiceId');
            UiUtils.showToast('Continuing your booking...', 'info');
        } else {
            // Service not found or invalid
            localStorage.removeItem('pendingServiceId');
        }
    }
}

function renderRecentHistory(bookings) {
    // Sort by ID descending (assuming higher ID = newer) or use a date field if reliable
    // Assuming 'bookings' comes sorted by date DESC from backend, but let's ensure slicing top 5
    const recent = bookings.slice(0, 5);
    const tbody = $('#overview table tbody');
    tbody.empty();

    if (recent.length === 0) {
        tbody.html('<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">No recent bookings</td></tr>');
        return;
    }

    recent.forEach(b => {
        let statusClass = 'status-pending';
        let displayStatus = b.status;

        if (b.raw_status === 'confirmed') {
            statusClass = 'status-confirmed';
            displayStatus = 'Confirmed';
        } else if (b.raw_status === 'in_progress') {
            statusClass = 'status-in-progress';
            displayStatus = 'In Progress';
        } else if (b.raw_status === 'assigned') {
            statusClass = 'status-assigned';
            displayStatus = 'Assigned';
        } else if (b.raw_status === 'completed') {
            statusClass = 'status-completed';
        } else if (b.raw_status === 'cancelled') {
            statusClass = 'status-cancelled';
        } else if (b.raw_status === 'declined') {
            statusClass = 'status-reassigning';
            displayStatus = 'Reassigning';
        }

        const imgUrl = ImageUtils.getServiceImageUrl(b.service_img);
        const fallbackUrl = '../../assets/images/default-service.png';

        const row = `
            <tr>
                <td style="padding: 18px 24px;">
                    <div class="table-service-info">
                        <img src="${imgUrl}" class="table-service-img" onerror="this.src='${fallbackUrl}'; this.style.objectFit='cover'; this.style.backgroundColor='#f8fafc';">
                        <span style="font-weight:600;">${b.service}</span>
                    </div>
                </td>
                <td style="text-align: right; padding: 18px 24px;" title="${b.raw_status === 'declined' ? 'Cleaner declined, admin is finding a new match' : ''}">
                    <span class="status-badge ${statusClass}">${displayStatus}</span>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

// --- UI UPDATES ---
function updateUser(user) {
    $('#page-title').text(`Welcome back, ${user.firstName}!`);

    const fullName = `${user.firstName} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName}`;
    $('#sidebar-name').text(fullName);
    $('#profile-name-display').text(fullName);

    // Update email in profile header
    if (user.email) {
        $('#profile-email-display').text(user.email);
    }

    // Update email in sidebar
    if (user.email) {
        // Look for the p tag inside .user-info in the sidebar
        $('.user-info p').text(user.email);
    }

    // Improved avatar handling with fallback
    let avatarUrl = user.avatar || '../../assets/images/default-avatar.png';

    if (user.avatar && !user.avatar.startsWith('http') && !user.avatar.startsWith('data:')) {
        if (user.avatar.startsWith('/storage/')) {
            avatarUrl = new URL(user.avatar, SERVER_URL).href;
        } else if (user.avatar.startsWith('storage/')) {
            avatarUrl = new URL('/' + user.avatar, SERVER_URL).href;
        } else if (!user.avatar.startsWith('../../')) {
            avatarUrl = '../../' + user.avatar;
        }
    }

    $('#sidebar-img').attr('src', avatarUrl).off('error').on('error', function () {
        $(this).attr('src', '../../assets/images/default-avatar.png');
    });

    // For main profile image, use the same URL but potentially larger if we had separate logic
    $('#main-profile-img').attr('src', avatarUrl).off('error').on('error', function () {
        $(this).attr('src', '../../assets/images/default-avatar.png');
    });

    // Update form inputs
    $('#inp-fname').val(user.firstName);
    $('#inp-mname').val(user.middleName || '');
    $('#inp-lname').val(user.lastName);
    $('#inp-email').val(user.email);
    $('#inp-phone').val(user.phone);
    $('#inp-address').val(user.address);

    // Update Loyalty Points
    $('.hero-text p').text(`You have ${user.points} loyalty points. Redeem them for your next deep clean.`);
}

function updateUpcomingWidget(job) {
    if (!job) {
        $('#upcoming-widget').hide();
        return;
    }
    $('#upcoming-widget').show();

    // Update Date
    $('#upcoming-widget .date-day').text(job.day);
    $('#upcoming-widget .date-month').text(job.month);

    // Update Status Badge
    const statusEl = $('#upcoming-widget .status');
    statusEl.removeClass('upcoming pending cancelled completed');

    if (job.raw_status === 'declined') {
        statusEl.addClass('reassigning').text('Reassigning');
    } else if (job.raw_status === 'assigned') {
        statusEl.addClass('assigned').text('Assigned');
    } else if (job.raw_status === 'confirmed') {
        statusEl.addClass('confirmed').text('Confirmed');
    } else {
        statusEl.addClass('pending').text('Pending');
    }

    // Update Details
    $('#upcoming-widget h4').text(job.service);
    $('#upcoming-widget .info-row:nth-child(2)').html(`<i class="ri-time-line"></i> ${job.time}`);
    $('#upcoming-widget .info-row:nth-child(3)').html(`<i class="ri-map-pin-line"></i> ${job.address}`);
    $('#upcoming-widget .info-row:nth-child(4)').html(`<i class="ri-wallet-3-line"></i> ${job.price}`);

    // Update Cleaner
    if (job.cleaner) {
        $('#upcoming-widget .cleaner-avatar').attr('src', job.cleaner.avatar || '../../assets/images/default-avatar.png');
        $('#upcoming-widget h5').text(job.cleaner.name);

        if (job.raw_status === 'assigned') {
            $('#upcoming-widget p').html(`
                Cleaner Assigned (Waiting for Acceptance)<br>
                <div style="margin-top:5px; font-size:0.85rem; color:var(--text-light);">
                    ${job.cleaner.email ? `<i class="ri-mail-line"></i> ${job.cleaner.email}<br>` : ''}
                    ${job.cleaner.phone ? `<i class="ri-phone-line"></i> ${job.cleaner.phone}` : ''}
                </div>
            `);
        } else if (job.raw_status === 'confirmed') {
            $('#upcoming-widget p').html(`
                Cleaner Confirmed<br>
                <div style="margin-top:5px; font-size:0.85rem; color:var(--text-light);">
                    ${job.cleaner.email ? `<i class="ri-mail-line"></i> ${job.cleaner.email}<br>` : ''}
                    ${job.cleaner.phone ? `<i class="ri-phone-line"></i> ${job.cleaner.phone}` : ''}
                </div>
            `);
        } else {
            $('#upcoming-widget p').html(`
                Cleaner Assigned<br>
                <div style="margin-top:5px; font-size:0.85rem; color:var(--text-light);">
                    ${job.cleaner.email ? `<i class="ri-mail-line"></i> ${job.cleaner.email}<br>` : ''}
                    ${job.cleaner.phone ? `<i class="ri-phone-line"></i> ${job.cleaner.phone}` : ''}
                </div>
            `);
        }
    } else {
        // Handle Declined Case Specifically for Widget
        if (job.raw_status === 'declined') {
            $('#upcoming-widget .cleaner-avatar').attr('src', '../../assets/images/default-avatar.png');
            $('#upcoming-widget h5').text('Cleaner Unavailable');
            $('#upcoming-widget p').text('Admin is finding a new cleaner...');
        } else {
            $('#upcoming-widget .cleaner-avatar').attr('src', '../../assets/images/default-avatar.png');
            $('#upcoming-widget h5').text('Finding Cleaner...');
            $('#upcoming-widget p').text('Pending Assignment');
        }
    }
}

// --- RENDER FUNCTIONS ---
function getStarsHtml(rating) {
    const r = typeof rating === 'number' ? rating : parseFloat(rating || 0);
    const full = Math.floor(r);
    const hasHalf = (r - full) >= 0.5 ? 1 : 0;
    const total = 5;
    let s = '';
    for (let i = 0; i < full; i++) s += '<i class="ri-star-fill"></i>';
    if (hasHalf) s += '<i class="ri-star-half-line"></i>';
    const empty = total - full - hasHalf;
    for (let i = 0; i < empty; i++) s += '<i class="ri-star-line"></i>';
    return `<span class="stars" style="color:#D69E2E; display:inline-flex; gap:2px;">${s}</span>`;
}

function renderTrending() {
    let frequency = {};
    bookings.forEach(b => {
        frequency[b.service] = (frequency[b.service] || 0) + 1;
    });

    let sortedServices = [...servicesData].sort((a, b) => {
        let freqA = frequency[a.title] || 0;
        let freqB = frequency[b.title] || 0;
        return freqB - freqA;
    }).slice(0, 3);

    const html = sortedServices.map(s => {
        const imgUrl = ImageUtils.getServiceImageUrl(s.img);
        const fallbackUrl = '../../assets/images/default-service.png';
        return `
        <div class="trending-card" onclick="openBooking(${s.id})" style="cursor:pointer">
            <img src="${imgUrl}" class="trending-img" alt="${s.title}" onerror="this.src='${fallbackUrl}'; this.style.objectFit='cover'; this.style.backgroundColor='#f8fafc';">
            <div>
                <span class="trending-badge">Trending</span>
                <h4 style="font-size:0.95rem; font-weight:700;">${s.title}</h4>
                <span style="font-size:0.85rem; color:var(--text-light);">${s.price} • ${s.category}</span>
            </div>
            <div style="margin-left:auto; color:var(--primary);">
                <i class="ri-arrow-right-line"></i>
            </div>
        </div>
    `}).join('');

    $('#trending-services').html(html);
}

function filterServices(category) {
    currentCategory = category;
    currentServicePage = 1; // Reset page when changing category

    // Sync radio buttons if called programmatically
    $(`input[name="category"][value="${category}"]`).prop('checked', true);

    renderServices();
}

function applySort(sortValue) {
    currentSort = sortValue;
    currentServicePage = 1; // Reset page when sorting

    // Sync radio buttons if called programmatically
    $(`input[name="sort"][value="${sortValue}"]`).prop('checked', true);

    renderServices();
}

function loadMoreServices() {
    currentServicePage++;
    renderServices();
}

function normalizeString(str) {
    return (str || '').toString().toLowerCase().replace(/[\s_\-\/]/g, '');
}

function renderServices() {
    // 1. Filter by Category
    let filtered = servicesData;

    if (currentCategory === 'All') {
        filtered = servicesData;
    } else if (currentCategory === 'Move-In/Out') {
        const target = 'moveinout';
        filtered = servicesData.filter(s => {
            const catNorm = normalizeString(s.category);
            const titleNorm = normalizeString(s.title);
            const titleRaw = (s.title || '').toLowerCase();
            const hasMovePair = titleRaw.includes('move-in') || titleRaw.includes('move out');
            return (
                catNorm.includes(target) ||
                catNorm.includes('movein') ||
                catNorm.includes('moveout') ||
                titleNorm.includes(target) ||
                hasMovePair
            );
        });
    } else {
        const categoryKeywords = {
            'Standard Clean': ['Standard', 'Standard Clean'],
            'Deep Clean': ['Deep', 'Deep Clean'],
            'Specialty': ['Specialty']
        };
        const validCategories = categoryKeywords[currentCategory] || [currentCategory];
        const validNorms = validCategories.map(c => normalizeString(c));

        filtered = servicesData.filter(s => {
            const cat = s.category ? s.category.trim() : '';
            return cat && (validCategories.includes(cat) || validNorms.includes(normalizeString(cat)));
        });
    }

    // 2. Filter by Search Query
    if (searchQuery) {
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(searchQuery) ||
            s.desc.toLowerCase().includes(searchQuery)
        );
    }

    // 3. Apply Sorting
    if (currentSort === 'newest') {
        // Assuming higher ID means newer
        filtered.sort((a, b) => b.id - a.id);
    } else if (currentSort === 'price_asc') {
        filtered.sort((a, b) => {
            // Remove currency symbols and commas, then parse float
            const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
            const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
            return priceA - priceB;
        });
    } else if (currentSort === 'price_desc') {
        filtered.sort((a, b) => {
            const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
            const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
            return priceB - priceA;
        });
    } else if (currentSort === 'popular') {
        // Calculate frequency map based on all bookings
        let frequency = {};
        bookings.forEach(b => {
            frequency[b.service] = (frequency[b.service] || 0) + 1;
        });

        filtered.sort((a, b) => {
            const freqA = frequency[a.title] || 0;
            const freqB = frequency[b.title] || 0;
            return freqB - freqA;
        });
    }

    // 4. Pagination Logic
    // We show items from 0 to (currentPage * itemsPerPage)
    const limit = currentServicePage * itemsPerPage;
    const visibleServices = filtered.slice(0, limit);

    // 5. Check if we need to show "See More" button
    const seeMoreBtn = $('#see-more-container');
    if (visibleServices.length < filtered.length) {
        seeMoreBtn.show();
    } else {
        seeMoreBtn.hide();
    }

        const createCard = (s) => {
            let ratingHtml = '';
            const avg = parseFloat(s.rating || 0);
            const count = s.rating_count || 0;
            if (count > 0 && avg > 0) {
                ratingHtml = `
                    <div class="rating" style="font-size:0.85rem; display:flex; align-items:center; gap:6px; margin:0;">
                        ${getStarsHtml(avg)}
                        <span style="color:var(--text-light);">${avg.toFixed(1)} (${count})</span>
                    </div>
                `;
            } else {
                ratingHtml = `
                    <div class="rating" style="font-size:0.85rem; color:var(--text-light); margin:0; font-weight:500;">
                        No ratings yet
                    </div>
                `;
            }

            const imgUrl = ImageUtils.getServiceImageUrl(s.img);
            const fallbackUrl = '../../assets/images/default-service.png';

            return `
            <div class="service-card">
                <div class="service-img">
                    <img src="${imgUrl}" alt="${s.title}" onerror="this.src='${fallbackUrl}'; this.style.objectFit='cover'; this.style.backgroundColor='#f8fafc';">
                    <span class="service-tag">${s.category}</span>
                </div>
                <div class="service-body">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <h4 class="service-title">${s.title}</h4>
                    </div>
                    <div style="margin-bottom: 12px;">${ratingHtml}</div>
                    <p class="service-desc">${s.desc}</p>
                    ${s.duration ? `<div class="service-duration"><i class="ri-time-line"></i> Avg. Duration: ${s.duration}</div>` : ''}
                    <div class="service-footer">
                        <span class="price">${s.price}</span>
                        <button class="btn-book-now" onclick="openBooking(${s.id})">
                            Book Now <i class="ri-arrow-right-line"></i>
                        </button>
                    </div>
                </div>
            </div>
        `};

    // Render Featured (Top 2 from all data, or filtered? Usually featured is static, but here let's keep it simple)
    // The original code rendered servicesData.slice(0,2) for featured.
    $('#featured-services').html(servicesData.slice(0, 2).map(createCard).join(''));

    // Render Main Grid
    if (visibleServices.length === 0) {
        $('#all-services-grid').html('<div style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 20px;">No services found.</div>');
    } else {
        $('#all-services-grid').html(visibleServices.map(createCard).join(''));
    }
}

function renderCleaners(cleaners) {
    if (!cleaners || !Array.isArray(cleaners)) {
        $('#cleaners-grid').html('<div style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 20px;">No cleaners available.</div>');
        return;
    }
    const html = cleaners.map(c => {
        let ratingHtml = '';
        const avg = parseFloat(c.rating || 0);
        const count = c.rating_count || 0;
        if (count > 0 && avg > 0) {
            ratingHtml = `<div class="rating" style="display:flex; align-items:center; gap:6px;">${getStarsHtml(avg)}<span style="color:var(--text-light); font-size:0.85rem;">${avg.toFixed(1)} (${count})</span></div>`;
        } else {
            ratingHtml = `<div class="rating" style="color:var(--text-light); font-size:0.85rem;">No ratings yet</div>`;
        }

        let imgUrl = c.img ? c.img : '../../assets/images/default-avatar.png';
        if (c.img && !c.img.startsWith('http') && !c.img.startsWith('data:')) {
            if (c.img.startsWith('/storage/')) {
                imgUrl = new URL(c.img, SERVER_URL).href;
            } else if (c.img.startsWith('storage/')) {
                imgUrl = new URL('/' + c.img, SERVER_URL).href;
            } else if (!c.img.startsWith('../../')) {
                imgUrl = '../../' + c.img;
            }
        }

        return `
        <div class="cleaner-card" onclick="viewCleanerProfile(${c.id})" style="cursor:pointer">
            <img src="${imgUrl}" class="cleaner-lg-avatar" onerror="this.src='../../assets/images/default-avatar.png'">
            <h4 style="font-weight:700;">${c.name}</h4>
            <p style="font-size:0.85rem; color:var(--text-light);">${c.role}</p>
            ${ratingHtml}
            <button class="btn-sm" style="width:100%; margin-top:10px;" onclick="viewCleanerProfile(${c.id})">View Profile</button>
        </div>
    `}).join('');
    $('#cleaners-grid').html(html);
}

function viewCleanerProfile(id) {
    const cleaner = cleanersData.find(c => c.id === id);
    if (!cleaner) return;

    // Populate Drawer
    $('#drawer-cleaner-img').attr('src', '../../assets/images/default-avatar.png');

    let cleanerImg = cleaner.img || '../../assets/images/default-avatar.png';
    if (cleaner.img && !cleaner.img.startsWith('http') && !cleaner.img.startsWith('data:')) {
        if (cleaner.img.startsWith('/storage/')) {
            cleanerImg = new URL(cleaner.img, SERVER_URL).href;
        } else if (cleaner.img.startsWith('storage/')) {
            cleanerImg = new URL('/' + cleaner.img, SERVER_URL).href;
        } else if (!cleaner.img.startsWith('../../')) {
            cleanerImg = '../../' + cleaner.img;
        }
    }

    $('#drawer-cleaner-img').off('error').on('error', function () {
        $(this).attr('src', '../../assets/images/default-avatar.png');
    }).attr('src', cleanerImg);

    $('#drawer-cleaner-name').text(cleaner.name);
    $('#drawer-cleaner-role').text(cleaner.role);

    const avg = parseFloat(cleaner.rating || 0);
    const count = cleaner.rating_count || 0;
    if (count > 0 && avg > 0) {
        $('#drawer-cleaner-rating').html(`${getStarsHtml(avg)} <span style="color:var(--text-light); font-size:0.9rem;">${avg.toFixed(1)} (${count})</span>`);
    } else {
        $('#drawer-cleaner-rating').html(`<span style="color:var(--text-light); font-size:0.9rem; font-weight:normal;">No ratings yet</span>`);
    }

    $('#drawer-cleaner-jobs').text(cleaner.jobs_done);
    $('#drawer-cleaner-exp').text(`${cleaner.experience} Years`);
    $('#drawer-cleaner-spec').text(cleaner.specialization);

    // Skills
    const skillsContainer = $('#drawer-cleaner-skills');
    skillsContainer.empty();
    if (cleaner.skills && cleaner.skills.length > 0) {
        cleaner.skills.forEach(skill => {
            skillsContainer.append(`<span class="skill-tag" style="background:#E6FFFA; color:#2C7A7B; padding:4px 10px; border-radius:15px; font-size:0.8rem; font-weight:600;">${skill}</span>`);
        });
    } else {
        skillsContainer.html('<span style="color:var(--text-light); font-size:0.85rem;">No skills listed</span>');
    }

    $('#cleaner-drawer').addClass('open');
    $('#drawer-overlay').addClass('active');
}

function closeCleanerDrawer() {
    $('#cleaner-drawer').removeClass('open');
    $('#drawer-overlay').removeClass('active');
}

function initBookingTable() {
    if ($.fn.DataTable.isDataTable('#history-table')) {
        $('#history-table').DataTable().destroy();
    }

    // Filter bookings based on selected status
    let filteredBookings = bookings;
    if (currentBookingStatusFilter !== 'All') {
        filteredBookings = bookings.filter(booking => booking.raw_status === currentBookingStatusFilter);
    }

    filteredBookings = [...filteredBookings].sort((a, b) => {
        const statusOrder = { pending: 0, assigned: 1, confirmed: 2, in_progress: 3, declined: 4, cancelled: 5, completed: 6 };
        const pa = statusOrder[a.raw_status] !== undefined ? statusOrder[a.raw_status] : 999;
        const pb = statusOrder[b.raw_status] !== undefined ? statusOrder[b.raw_status] : 999;
        if (pa !== pb) return pa - pb;
        const da = new Date(a.date + ' ' + (a.time || ''));
        const db = new Date(b.date + ' ' + (b.time || ''));
        return db - da;
    });

    renderBookingTimeline(filteredBookings);

    bookingTable = $('#history-table').DataTable({
        data: filteredBookings,
        order: [], // Disable initial sorting to respect data source order
        dom: 'tip',
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
                    const imgUrl = ImageUtils.getServiceImageUrl(row.service_img);
                    const fallbackUrl = '../../assets/images/default-service.png';
                    return `
                        <div class="table-service-info">
                            <img src="${imgUrl}" class="table-service-img" onerror="this.src='${fallbackUrl}'; this.style.objectFit='cover'; this.style.backgroundColor='#f8fafc';">
                            <span style="font-weight:600;">${data}</span>
                        </div>`;
                }
            },
            {
                data: 'date',
                createdCell: function (td) { $(td).attr('data-label', 'Date'); },
                render: function (data, type, row) {
                    return `<div>${data}</div><div style="font-size: 0.85rem; color: var(--text-light);">${row.time || ''}</div>`;
                }
            },
            {
                data: 'cleaner',
                createdCell: function (td) { $(td).attr('data-label', 'Cleaner'); },
                render: function (data, type, row) {
                    const avatarUrl = row.cleaner_avatar || '../../assets/images/default-avatar.png';
                    return `<div style="display:flex; align-items:center; gap:8px;">
                        <img src="${avatarUrl}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" onerror="this.src='../../assets/images/default-avatar.png'">
                        ${data}
                    </div>`;
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
                    let statusClass = 'status-' + (data || '').toLowerCase();
                    let displayStatus = data;

                    if (row.raw_status === 'assigned') {
                        statusClass = 'status-assigned';
                        displayStatus = 'Assigned';
                    } else if (row.raw_status === 'declined') {
                        statusClass = 'status-reassigning';
                        displayStatus = 'Reassigning';
                    } else if (row.raw_status === 'confirmed') {
                        statusClass = 'status-confirmed';
                        displayStatus = 'Confirmed';
                    } else if (row.raw_status === 'in_progress') {
                        statusClass = 'status-in-progress';
                        displayStatus = 'In Progress';
                    }

                    return `<span class="status-badge ${statusClass}">${displayStatus}</span>`;
                }
            },
            {
                data: null,
                createdCell: function (td) { $(td).attr('data-label', 'Action'); },
                render: function (data, type, row) {
                    if (row.raw_status === 'pending') {
                        return `<button class="btn-action cancel" onclick="cancelBooking('${row.id}')" title="Cancel Booking">
                                    <i class="ri-close-circle-line"></i> Cancel
                                </button>`;
                    }
                    if (row.raw_status === 'completed') {
                        if (row.is_rated) {
                            return `<span class="status-badge rated"><i class="ri-check-double-line"></i> Rated</span>`;
                        }
                        return `<button class="btn-action rate" onclick="openRatingModal('${row.id}', '${row.cleaner}', '${row.service}')" title="Rate Service">
                                    <i class="ri-star-line"></i> Rate
                                </button>`;
                    }
                    return `<span style="color:#CBD5E0;">-</span>`;
                }
            }
        ],
        responsive: false,
        language: {
            search: "_INPUT_",
            searchPlaceholder: "Search bookings...",
            paginate: {
                next: '<i class="ri-arrow-right-s-line"></i>',
                previous: '<i class="ri-arrow-left-s-line"></i>'
            }
        }
    });
}

// --- ACTIONS ---
function navigate(sectionId) {
    // Remove active class from all nav items (both sidebar and mobile bottom nav)
    $('.nav-item').removeClass('active');

    // Add active class to the corresponding nav items
    $(`#nav-${sectionId}`).addClass('active');
    $(`#mobile-nav-${sectionId}`).addClass('active');

    // Switch sections
    $('.section-view').removeClass('active');
    $(`#${sectionId}`).addClass('active');

    // Close sidebar on mobile
    $('#sidebar').removeClass('open');

    // Update page title
    const titles = {
        'overview': `Welcome back, ${$('#inp-fname').val()}!`,
        'services': 'Our Services',
        'cleaners': 'Our Team',
        'history': 'Booking History',
        'profile': 'My Profile'
    };
    $('#page-title').text(titles[sectionId] || 'Dashboard');

    // Scroll to top for better UX on mobile
    if (window.innerWidth <= 767) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function toggleSidebar() {
    $('#sidebar').toggleClass('open');
}

function openBooking(id) {
    const service = servicesData.find(s => s.id === id);
    if (!service) return;

    currentService = service;
    currentPrice = service.price;
    $('#modal-service-name').text(`Booking: ${service.title}`);
    $('#modal-price').text(service.price);

    // Prefill contact info
    $('#phone-picker').val($('#inp-phone').val());
    $('#address-picker').val($('#inp-address').val());

    // Date Restrictions: Min Date = Tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    $('#date-picker').attr('min', minDate);

    // Reset Date and Time
    $('#date-picker').val('');
    $('#time-picker').val('');
    $('#time-validation-msg').hide().text('');
    $('#time-slot-list').empty();

    // Time Range Validation Listener
    $('#time-picker').off('change').on('change', function () {
        const time = $(this).val();
        if (!time) return;

        const [hours, minutes] = time.split(':').map(Number);

        const timeInMinutes = hours * 60 + minutes;
        const minTime = 8 * 60;  // 08:00
        const maxTime = 17 * 60; // 17:00

        if (timeInMinutes < minTime || timeInMinutes > maxTime) {
            UiUtils.showToast('Please select a time between 8:00 AM and 5:00 PM.', 'error');
            $(this).val('');
            $('#time-validation-msg').hide().text('');
            $('#confirmBookingBtn').prop('disabled', false);
            return;
        }
        validateSelectedSlotUI();
    });

    // Sunday Restriction Listener
    $('#date-picker').off('change').on('change', function () {
        const inputDate = new Date($(this).val());
        if (inputDate.getDay() === 0) { // 0 = Sunday
            UiUtils.showToast('Sorry, we are closed on Sundays. Please choose another date.', 'error');
            $(this).val('');
            $('#time-validation-msg').hide().text('');
            $('#confirmBookingBtn').prop('disabled', false);
            return;
        }
        validateSelectedSlotUI();
        renderAvailableSlots();
    });

    $('#booking-modal').addClass('active'); // Match CSS class .modal.active
    $('#drawer-overlay').addClass('active');
}

function renderAvailableSlots() {
    const container = $('#time-slot-list');
    if (!container.length) return;
    container.empty();
    const date = $('#date-picker').val();
    if (!date || !currentService) return;

    const toISO = function (d) {
        const dateObj = new Date(d);
        if (isNaN(dateObj)) return (d || '').trim();
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const str = (currentService.duration || '').toLowerCase();
    let baseMinutes = 60;
    const hMatch = str.match(/(\d+)\s*h/);
    const mMatch = str.match(/(\d+)\s*m/);
    if (hMatch) baseMinutes = parseInt(hMatch[1], 10) * 60;
    else if (mMatch) baseMinutes = parseInt(mMatch[1], 10);

    const minTime = 8 * 60;
    const maxTime = 17 * 60;

    const sameDay = bookings.filter(function (b) {
        const sameService = (b.service || '').toString().trim() === (currentService.title || '').toString().trim();
        const status = (b.raw_status || b.status || '').toLowerCase();
        const notCancelled = status !== 'cancelled';
        const isoDate = toISO(b.date);
        return sameService && (isoDate === date) && notCancelled;
    });

    for (let start = minTime; start <= maxTime; start += baseMinutes) {
        const h = String(Math.floor(start / 60)).padStart(2, '0');
        const m = String(start % 60).padStart(2, '0');
        const value = `${h}:${m}`;
        const ap = Math.floor(start / 60) >= 12 ? 'PM' : 'AM';
        const h12 = (Math.floor(start / 60) % 12) || 12;
        const label = `${h12}:${m} ${ap}`;
        const end = start + baseMinutes;

        const overlapping = sameDay.some(function (b) {
            const bt = (function (t) {
                const mm = (t || '').trim();
                const x = mm.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                if (!x) return mm;
                let hh = parseInt(x[1], 10);
                const mins = x[2];
                const ap2 = x[3].toUpperCase();
                if (ap2 === 'PM' && hh < 12) hh += 12;
                if (ap2 === 'AM' && hh === 12) hh = 0;
                return String(hh).padStart(2, '0') + ':' + mins;
            })(b.time);
            const bp = bt.split(':');
            const bs = (parseInt(bp[0], 10) || 0) * 60 + (parseInt(bp[1], 10) || 0);
            const be = bs + baseMinutes;
            return start < be && end > bs;
        });

        const btn = $('<button type="button"></button>')
            .text(label)
            .attr('data-time', value)
            .css({
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--bg-elevated)',
                color: 'var(--text-body)',
                cursor: 'pointer'
            });

        if (overlapping) {
            btn.prop('disabled', true)
               .css({ opacity: 0.6, cursor: 'not-allowed' })
               .attr('title', 'Selected time overlaps with an existing booking for this service. Please pick a non-overlapping time.');
        } else {
            btn.on('click', function () {
                $('#time-picker').val(value).trigger('change');
                $('#time-validation-msg').hide().text('');
                $('#confirmBookingBtn').prop('disabled', false);
                validateSelectedSlotUI();
            });
        }

        container.append(btn);
    }
}

function validateSelectedSlotUI() {
    const date = $('#date-picker').val();
    const time = $('#time-picker').val();
    const msgEl = $('#time-validation-msg');
    if (!msgEl.length) return;

    msgEl.hide().text('');
    $('#confirmBookingBtn').prop('disabled', false);

    if (!date || !time || !currentService) return;

    const baseMinutes = (function (s) {
        const str = (s || '').toLowerCase();
        let m = 60;
        const hMatch = str.match(/(\d+)\s*h/);
        const mMatch = str.match(/(\d+)\s*m/);
        if (hMatch) m = parseInt(hMatch[1], 10) * 60;
        else if (mMatch) m = parseInt(mMatch[1], 10);
        return m;
    })(currentService.duration);

    const newStartMinutes = (function (t) {
        const parts = (t || '').split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h * 60 + m;
    })(time);
    const newEndMinutes = newStartMinutes + baseMinutes;

    // Local ISO date converter to align with stored display formats
    const toISO = function (d) {
        const dateObj = new Date(d);
        if (isNaN(dateObj)) return (d || '').trim();
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const overlapping = bookings
        .filter(function (b) {
            const sameService = (b.service || '').toString().trim() === (currentService.title || '').toString().trim();
            const status = (b.raw_status || b.status || '').toLowerCase();
            const notCancelled = status !== 'cancelled';
            const isoDate = toISO(b.date);
            return sameService && (isoDate === date) && notCancelled;
        })
        .some(function (b) {
            const bTime24 = (function (t) {
                const m = (t || '').trim();
                const x = m.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                if (!x) return m;
                let h = parseInt(x[1], 10);
                const min = x[2];
                const ap = x[3].toUpperCase();
                if (ap === 'PM' && h < 12) h += 12;
                if (ap === 'AM' && h === 12) h = 0;
                return String(h).padStart(2, '0') + ':' + min;
            })(b.time);
            const existStart = (function (t) {
                const parts = (t || '').split(':');
                const h = parseInt(parts[0], 10) || 0;
                const m = parseInt(parts[1], 10) || 0;
                return h * 60 + m;
            })(bTime24);
            const existEnd = existStart + baseMinutes;
            return newStartMinutes < existEnd && newEndMinutes > existStart;
        });

    if (overlapping) {
        msgEl.text('Selected time overlaps with an existing booking for this service. Please pick a non-overlapping time.').show();
        $('#confirmBookingBtn').prop('disabled', true);
    }
}

function closeModal() {
    $('#booking-modal').removeClass('active'); // Match CSS class .modal.active
    $('#drawer-overlay').removeClass('active');
}

function confirmBooking() {
    const btn = $('#confirmBookingBtn');
    if (btn.length) {
        UiUtils.setBtnLoading(btn, true, 'Confirming...');
    }

    const newBooking = {
        service_id: currentService.id,
        date: $('#date-picker').val(),
        time: $('#time-picker').val(),
        address: $('#address-picker').val(),
        phone_number: $('#phone-picker').val()
    };

    if (!newBooking.date || !newBooking.time || !newBooking.address || !newBooking.phone_number) {
        if (btn.length) UiUtils.setBtnLoading(btn, false, 'Confirm & Pay ' + currentPrice);
        UiUtils.showToast('Please provide date, time, address and phone number.', 'error');
        return;
    }

    function to24Time(t) {
        const m = (t || '').trim();
        const x = m.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!x) return m;
        let h = parseInt(x[1], 10);
        const min = x[2];
        const ap = x[3].toUpperCase();
        if (ap === 'PM' && h < 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        return String(h).padStart(2, '0') + ':' + min;
    }
    function displayDateToISO(d) {
        const date = new Date(d);
        if (isNaN(date)) return (d || '').trim();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    function minutesFromHHMM(t) {
        const parts = (t || '').split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h * 60 + m;
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
    function to12(hhmm) {
        const parts = (hhmm || '').split(':');
        let h = parseInt(parts[0], 10) || 0;
        const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
        const ap = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m} ${ap}`;
    }

    const duplicate = bookings.some(b => {
        const sameService = (b.service || '').toString().trim() === (currentService.title || '').toString().trim();
        const isoDate = displayDateToISO(b.date);
        const sameDate = isoDate === newBooking.date;
        const bTime24 = to24Time(b.time);
        const sameTime = bTime24 === newBooking.time;
        const status = (b.raw_status || b.status || '').toLowerCase();
        const notCancelled = status !== 'cancelled';
        return sameService && sameDate && sameTime && notCancelled;
    });
    if (duplicate) {
        if (btn.length) UiUtils.setBtnLoading(btn, false, 'Confirm & Pay ' + currentPrice);
        UiUtils.showToast('You already booked this service at the same date and time.', 'error');
        return;
    }
    
    const sameDayBookings = bookings.filter(b => {
        const sameService = (b.service || '').toString().trim() === (currentService.title || '').toString().trim();
        const isoDate = displayDateToISO(b.date);
        const status = (b.raw_status || b.status || '').toLowerCase();
        const notCancelled = status !== 'cancelled';
        return sameService && isoDate === newBooking.date && notCancelled;
    });
    if (sameDayBookings.length > 0) {
        const baseMinutes = parseDurationMinutes(currentService.duration);
        const newStartMinutes = minutesFromHHMM(newBooking.time);
        const newEndMinutes = newStartMinutes + baseMinutes;

        const overlapping = sameDayBookings.some(b => {
            const start24 = to24Time(b.time);
            const existStart = minutesFromHHMM(start24);
            const existEnd = existStart + baseMinutes;
            return newStartMinutes < existEnd && newEndMinutes > existStart;
        });

        if (overlapping) {
            if (btn.length) UiUtils.setBtnLoading(btn, false, 'Confirm & Pay ' + currentPrice);
            UiUtils.showToast('Selected time overlaps with an existing booking for this service. Please pick a non-overlapping time.', 'error');
            return;
        }
    }

    // Make actual API call to create booking
    ApiClient.post('/customer/bookings', newBooking)
        .then(function (response) {
            if (response.success) {
                UiUtils.showToast("Booking Confirmed Successfully!", 'success');
                closeModal();
                // Refresh dashboard data to reflect new booking
                loadDashboardData();
                navigate('history');
            } else {
                UiUtils.showToast(response.message || 'Failed to confirm booking', 'error');
            }
        })
        .catch(function (xhr) {
            console.error('API Error:', xhr);
            let errorMessage = 'Error confirming booking';
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            }
            UiUtils.showToast(errorMessage, 'error');
        })
        .finally(function () {
            if (btn.length) UiUtils.setBtnLoading(btn, false, 'Confirm & Pay ' + currentPrice);
        });
}

// State
let deleteBookingId = null;

function cancelBooking(id) {
    deleteBookingId = id;
    $('#delete-modal').addClass('active'); // Match CSS class .modal.active
    $('#drawer-overlay').addClass('active');
}

function closeDeleteModal() {
    $('#delete-modal').removeClass('active'); // Match CSS class .modal.active
    $('#drawer-overlay').removeClass('active');
    deleteBookingId = null;
}

function confirmDeleteBooking() {
    if (!deleteBookingId) return;

    const btn = $('#confirmDeleteBtn');
    if (btn.length) {
        UiUtils.setBtnLoading(btn, true, 'Cancelling...');
    }

    // Make actual API call to cancel booking
    ApiClient.post(`/customer/bookings/${deleteBookingId}/cancel`)
        .then(function (response) {
            if (response.success) {
                UiUtils.showToast('Booking cancelled successfully', 'success');
                // Refresh dashboard data to reflect changes
                loadDashboardData();
                closeDeleteModal();
            } else {
                UiUtils.showToast(response.message || 'Failed to cancel booking', 'error');
            }
        })
        .catch(function (xhr) {
            console.error('API Error:', xhr);
            UiUtils.showToast('Error cancelling booking', 'error');
        })
        .finally(function () {
            if (btn.length) UiUtils.setBtnLoading(btn, false, 'Yes, Cancel Booking');
        });
}

function openRatingModal(id, cleanerName, serviceName) {
    // Store ID if needed for API, here just for simulation
    $('#rate-cleaner-name').text(cleanerName);
    $('#rate-service-name').text(serviceName);
    currentRatingBookingId = id;

    // Reset Rating State
    $('.cleaner-rating i').attr('class', 'ri-star-line').css('color', '#CBD5E0');
    $('.service-rating i').attr('class', 'ri-star-line').css('color', '#CBD5E0');
    $('#cleaner-rating-value').val(0);
    $('#service-rating-value').val(0);
    $('#rating-comment').val('');

    $('#rating-modal').addClass('active');
    $('#drawer-overlay').addClass('active');
}

function closeRatingModal() {
    $('#rating-modal').removeClass('active');
    $('#drawer-overlay').removeClass('active');
}

function setRating(type, value) {
    $(`#${type}-rating-value`).val(value);
    const stars = $(`.${type}-rating i`);
    stars.each(function (index) {
        if (index < value) {
            $(this).attr('class', 'ri-star-fill').css('color', '#D69E2E');
        } else {
            $(this).attr('class', 'ri-star-line').css('color', '#CBD5E0');
        }
    });
}

function submitRating() {
    const cVal = parseInt($('#cleaner-rating-value').val(), 10);
    const sVal = parseInt($('#service-rating-value').val(), 10);

    if (!currentRatingBookingId) {
        UiUtils.showToast('No booking selected for rating.', 'error');
        return;
    }

    if (!cVal || !sVal) {
        UiUtils.showToast('Please provide a rating for both cleaner and service.', 'error');
        return;
    }

    const btn = $('#submitRatingBtn');
    if (btn.length) {
        UiUtils.setBtnLoading(btn, true, 'Submitting...');
    }

    const payload = {
        rating: cVal,
        service_rating: sVal,
        comment: ($('#rating-comment').val() || '').toString().trim()
    };

    ApiClient.post(`/customer/bookings/${currentRatingBookingId}/rate`, payload)
        .then(function (response) {
            if (response.success) {
                UiUtils.showToast('Thank you for your feedback!', 'success');
                closeRatingModal();
                currentRatingBookingId = null;
                loadDashboardData();
            } else {
                UiUtils.showToast(response.message || 'Failed to submit rating.', 'error');
            }
        })
        .catch(function (xhr) {
            let msg = 'Error submitting rating';
            if (xhr.responseJSON) {
                if (xhr.responseJSON.errors) {
                    const errors = Object.values(xhr.responseJSON.errors).flat();
                    msg = errors.join('\n');
                } else if (xhr.responseJSON.message) {
                    msg = xhr.responseJSON.message;
                }
            }
            UiUtils.showToast(msg, 'error');
        })
        .finally(function () {
            if (btn.length) UiUtils.setBtnLoading(btn, false, 'Submit Review');
        });
}

function updateProfileImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const newSrc = e.target.result;
            // Update both main profile image and sidebar image immediately for preview
            $('#main-profile-img').attr('src', newSrc);
            $('#sidebar-img').attr('src', newSrc);
        }
        reader.readAsDataURL(file);
    }
}

// Toggle timeline item visibility
function toggleTimelineItem(itemId) {
    const item = document.getElementById(itemId);
    item.classList.toggle('active');
}

// Change timeline page
function changeTimelinePage(page) {
    timelineCurrentPage = page;
    // Re-render the timeline with the new page
    renderBookingTimeline(bookings.filter(booking => {
        if (currentBookingStatusFilter === 'All') return true;
        return booking.raw_status === currentBookingStatusFilter;
    }));
}

function exportBookingHistory() {
    if (!bookings || bookings.length === 0) {
        UiUtils.showToast('No booking history to export.', 'error');
        return;
    }

    // Check if jsPDF is loaded
    if (!window.jspdf) {
        UiUtils.showToast('PDF library not loaded. Please refresh the page.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Booking History', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Exported on: ${dateStr}`, 14, 30);

    // Prepare data
    const headers = [['Order ID', 'Service', 'Date', 'Cleaner', 'Amount', 'Status']];

    const data = bookings.map(b => {
        // Match status logic from table
        let displayStatus = b.status;
        if (b.raw_status === 'assigned') displayStatus = 'Assigned';
        else if (b.raw_status === 'declined') displayStatus = 'Reassigning';
        else if (b.raw_status === 'confirmed') displayStatus = 'Confirmed';
        else if (b.raw_status === 'in_progress') displayStatus = 'In Progress';

        return [
            b.display_id,
            b.service,
            b.date,
            b.cleaner || 'Pending',
            b.price,
            displayStatus
        ];
    });

    // Generate Table
    doc.autoTable({
        head: headers,
        body: data,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [44, 122, 123] }, // Teal color to match theme
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { fontStyle: 'bold' }, // Order ID
            4: { halign: 'right' }    // Amount
        }
    });

    // Save
    doc.save(`booking_history_${new Date().toISOString().split('T')[0]}.pdf`);
}

function saveProfile(e) {
    e.preventDefault();

    const btn = $(e.target).find('button[type="submit"]');
    UiUtils.setBtnLoading(btn, true, 'Saving...');

    const formData = new FormData();
    formData.append('firstName', $('#inp-fname').val());
    formData.append('middleName', $('#inp-mname').val());
    formData.append('lastName', $('#inp-lname').val());
    formData.append('phone', $('#inp-phone').val());
    formData.append('address', $('#inp-address').val());

    const fileInput = $('#upload-file')[0];
    if (fileInput.files && fileInput.files[0]) {
        formData.append('avatar', fileInput.files[0]);
    }

    const token = localStorage.getItem('auth_token');
    const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:8000/api'
        : 'https://itsolutions.muccsbblock1.com/cleaning_services/public/api';

    $.ajax({
        url: `${API_BASE_URL}/settings/profile`,
        type: 'POST',
        data: formData,
        headers: { 'Authorization': `Bearer ${token}` },
        processData: false,
        contentType: false,
        success: function (response) {
            UiUtils.showToast('Profile updated successfully', 'success');

            // Update UI with new avatar if returned
            if (response.avatar) {
                let newAvatar = response.avatar;
                if (newAvatar.startsWith('/storage/')) {
                    newAvatar = new URL(newAvatar, SERVER_URL).href;
                } else if (newAvatar.startsWith('storage/')) {
                    newAvatar = new URL('/' + newAvatar, SERVER_URL).href;
                }
                // Cache bust
                newAvatar += '?t=' + new Date().getTime();

                $('#sidebar-img').attr('src', newAvatar);
                $('#main-profile-img').attr('src', newAvatar);

                // Update Local Storage
                let userData = JSON.parse(localStorage.getItem('user_data') || '{}');
                userData.avatar = newAvatar;
                userData.firstName = $('#inp-fname').val();
                userData.middleName = $('#inp-mname').val();
                userData.lastName = $('#inp-lname').val();
                userData.phone = $('#inp-phone').val();
                userData.address = $('#inp-address').val();
                localStorage.setItem('user_data', JSON.stringify(userData));
            }
        },
        error: function (xhr) {
            UiUtils.showToast('Failed to update profile', 'error');
        },
        complete: function () {
            UiUtils.setBtnLoading(btn, false, 'Save Changes');
        }
    });
}

// --- FILTER DRAWER LOGIC ---
function openFilterDrawer() {
    const drawer = document.getElementById('filter-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) {
        overlay.classList.add('active');
        // Override onclick to close both
        overlay.onclick = function () {
            closeCleanerDrawer();
            closeFilterDrawer();
        };
    }
    document.body.style.overflow = 'hidden';
}

function closeFilterDrawer() {
    const drawer = document.getElementById('filter-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// --- BOOKING FILTER DRAWER LOGIC ---
function openBookingFilterDrawer() {
    const drawer = document.getElementById('booking-filter-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) {
        overlay.classList.add('active');
        // Override onclick to close both
        overlay.onclick = function () {
            closeCleanerDrawer();
            closeBookingFilterDrawer();
        };
    }
    document.body.style.overflow = 'hidden';
}

function closeBookingFilterDrawer() {
    const drawer = document.getElementById('booking-filter-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function filterBookingsByStatus(status) {
    currentBookingStatusFilter = status;
    // Reset timeline pagination when filtering
    timelineCurrentPage = 1;
    // Re-initialize the booking table with filtered data
    initBookingTable();
}

function renderBookingTimeline(bookings) {
    const timelineContainer = $('#booking-timeline');

    if (timelineContainer.length === 0) {
        console.error('Booking timeline container not found');
        return;
    }

    timelineContainer.empty();

    if (!bookings || bookings.length === 0) {
        timelineContainer.html(`
            <div class="empty-state">
                <i class="ri-file-list-line"></i>
                <h3>No Booking History</h3>
                <p>You haven't made any bookings yet.</p>
                <button class="btn-primary dark" onclick="navigate('services')">Book a Service</button>
            </div>
        `);
        return;
    }

    const sortedBookings = [...bookings].sort((a, b) => {
        const statusOrder = { pending: 0, assigned: 1, confirmed: 2, in_progress: 3, declined: 4, cancelled: 5, completed: 6 };
        const pa = statusOrder[a.raw_status] !== undefined ? statusOrder[a.raw_status] : 999;
        const pb = statusOrder[b.raw_status] !== undefined ? statusOrder[b.raw_status] : 999;
        if (pa !== pb) return pa - pb;
        let dateA, dateB;
        try {
            dateA = new Date(a.date + ' ' + (a.time || ''));
            dateB = new Date(b.date + ' ' + (b.time || ''));
        } catch (e) {
            dateA = new Date(a.date);
            dateB = new Date(b.date);
        }
        return dateB - dateA;
    });

    // Pagination calculations
    const totalPages = Math.ceil(sortedBookings.length / timelineItemsPerPage);
    const startIndex = (timelineCurrentPage - 1) * timelineItemsPerPage;
    const endIndex = startIndex + timelineItemsPerPage;
    const paginatedBookings = sortedBookings.slice(startIndex, endIndex);

    // Create collapsible timeline items
    const timelineItems = paginatedBookings.map((booking, index) => {
        // Format date and time
        let dateObj;
        try {
            dateObj = new Date(booking.date);
        } catch (e) {
            // Fallback to current date if parsing fails
            dateObj = new Date();
        }
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Get status display text and class
        let statusDisplay = booking.status;
        let statusClass = 'status-' + booking.status.toLowerCase();

        if (booking.raw_status === 'assigned') {
            statusDisplay = 'Assigned';
            statusClass = 'status-assigned';
        } else if (booking.raw_status === 'declined') {
            statusDisplay = 'Reassigning';
            statusClass = 'status-reassigning';
        } else if (booking.raw_status === 'confirmed') {
            statusDisplay = 'Confirmed';
            statusClass = 'status-confirmed';
        } else if (booking.raw_status === 'in_progress') {
            statusDisplay = 'In Progress';
            statusClass = 'status-confirmed';
        } else if (booking.raw_status === 'pending') {
            statusDisplay = 'Pending';
            statusClass = 'status-pending';
        } else if (booking.raw_status === 'completed') {
            statusDisplay = 'Completed';
            statusClass = 'status-completed';
        } else if (booking.raw_status === 'cancelled') {
            statusDisplay = 'Cancelled';
            statusClass = 'status-cancelled';
        }

        // Action button based on status
        let actionButton = '<span style="color:#CBD5E0;">-</span>';
        if (booking.raw_status === 'pending') {
            actionButton = `<button class="btn-action cancel" onclick="cancelBooking('${booking.id}')" title="Cancel Booking">
                <i class="ri-close-circle-line"></i> Cancel
            </button>`;
        } else if (booking.raw_status === 'completed') {
            if (booking.is_rated) {
                actionButton = '<span class="status-badge rated"><i class="ri-check-double-line"></i> Rated</span>';
            } else {
                actionButton = `<button class="btn-action rate" onclick="openRatingModal('${booking.id}', '${booking.cleaner || ''}', '${booking.service || ''}')" title="Rate Service">
                    <i class="ri-star-line"></i> Rate
                </button>`;
            }
        }

        // Service image
        const serviceImg = ImageUtils.getServiceImageUrl(booking.service_img);
        const fallbackServiceImg = '../../assets/images/default-service.png';

        // Cleaner image
        const cleanerImg = booking.cleaner_avatar || '../../assets/images/default-avatar.png';

        // Unique ID for this item
        const itemId = `timeline-item-${startIndex + index}`;

        return `
        <div class="timeline-item" id="${itemId}">
            <div class="timeline-dot"></div>
            
            <!-- Header (Visible) -->
            <div class="timeline-header" onclick="toggleTimelineItem('${itemId}')">
                <div class="timeline-main-info">
                    <img src="${serviceImg}" class="timeline-service-img" onerror="this.src='${fallbackServiceImg}'" alt="Service">
                    <div>
                        <div class="timeline-date">${formattedDate} • ${booking.time || ''}</div>
                        <div class="timeline-service-name">${booking.service || 'N/A'}</div>
                        <span class="status-badge ${statusClass}" style="margin-top:5px; display:inline-block; font-size:10px; padding: 4px 8px;">${statusDisplay}</span>
                    </div>
                </div>
                <button class="collapse-btn">
                    <i class="ri-arrow-down-s-line"></i>
                </button>
            </div>

            <!-- Details (Hidden - Collapsible) -->
            <div class="timeline-details">
                <div class="detail-row">
                    <span class="detail-label">Order ID</span>
                    <span class="detail-value">${booking.display_id || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Cleaner</span>
                    <span class="detail-value">
                        <img src="${cleanerImg}" style="width:20px; height:20px; border-radius:50%; object-fit:cover; margin-right:5px;" onerror="this.src='../../assets/images/default-avatar.png'"> 
                        ${booking.cleaner || 'Pending'}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Amount</span>
                    <span class="detail-value" style="color: var(--primary); font-size: 16px;">${booking.price || 'N/A'}</span>
                </div>
                <div style="text-align: right; margin-top: 15px;">
                    ${actionButton}
                </div>
            </div>
        </div>`;
    }).join('\n');

    // Create pagination controls
    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = `
        <div class="timeline-pagination" style="display: flex; justify-content: center; margin: 20px 0;">
            <button class="btn-secondary btn-sm" ${timelineCurrentPage === 1 ? 'disabled' : ''} onclick="changeTimelinePage(${timelineCurrentPage - 1})">
                <i class="ri-arrow-left-s-line"></i> Previous
            </button>
            <span style="margin: 0 15px; display: flex; align-items: center; color: var(--text-light);">
                Page ${timelineCurrentPage} of ${totalPages}
            </span>
            <button class="btn-secondary btn-sm" ${timelineCurrentPage === totalPages ? 'disabled' : ''} onclick="changeTimelinePage(${timelineCurrentPage + 1})">
                Next <i class="ri-arrow-right-s-line"></i>
            </button>
        </div>`;
    }

    timelineContainer.html(timelineItems + paginationHtml);
}
