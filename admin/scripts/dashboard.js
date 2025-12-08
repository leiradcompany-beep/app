// ========================================
// Configuration
// ========================================
// API_BASE_URL is now handled by ApiClient
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// ========================================
// DOM Elements
// ========================================
const logoutBtn = document.getElementById('logoutBtn');

// ========================================
// Utility Functions
// ========================================
function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

    toast.innerHTML = `
        <div class="flex items-start">
            <i class="fas ${icons[type]} text-xl mr-3 mt-1"></i>
            <div class="flex-grow">
                <span class="font-bold text-white">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <div class="text-sm">${message}</div>
            </div>
        </div>
        <div class="toast-progress-bar" style="transition: width ${duration / 1000}s linear;"></div>
    `;

    container.insertBefore(toast, container.firstChild);
    requestAnimationFrame(() => {
        toast.classList.add('show');
        toast.querySelector('.toast-progress-bar').style.width = '0%';
    });

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

function setLoading(button, isLoading, loadingText = 'Processing...') {
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = `
            <div class="flex items-center justify-center">
                <div class="loading-spinner mr-3"></div>
                <span>${loadingText}</span>
            </div>`;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalHtml;
    }
}

// ========================================
// Logout Handler
// ========================================
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();

        setLoading(logoutBtn, true, "Logging out...");

        ApiClient.post('/logout')
            .then(function (response) {
                if (response.success) {
                    clearAuth();
                    showToast('Logged out successfully', 'success');
                    setTimeout(() => window.location.href = '../auth/index.html', 1500);
                }
            })
            .catch(function (xhr) {
                // Even if the API call fails, clear local auth data and redirect
                clearAuth();
                showToast('Logged out successfully', 'success');
                setTimeout(() => window.location.href = '../auth/index.html', 1500);
            })
            .finally(function () {
                setLoading(logoutBtn, false);
            });
    });
}

// ========================================
// Initialize
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Set dark mode as default
    document.body.setAttribute('data-theme', 'dark');

    // Display welcome message with user's name
    const user = JSON.parse(localStorage.getItem(USER_KEY)) || { firstname: 'Admin', lastname: 'User' };
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome back, ${user.firstname} ${user.lastname}!`;
    }

    // Check if user is authenticated
    // const token = localStorage.getItem(TOKEN_KEY);
    // if (!token) {
    //     window.location.href = '../auth/index.html';
    // }

    // Sidebar Toggle Logic
    // Moved to admin-sidebar.js for centralized management
    // Kept here commented out if specific override needed
    /*
    const dashboard = document.getElementById('dashboard');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const toggleBtns = document.querySelectorAll('.toggle-btn'); // Select all toggle buttons

    function toggleSidebar() {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('mobile-active');
            overlay.classList.toggle('active');
        } else {
            dashboard.classList.toggle('collapsed');
        }
    }

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', toggleSidebar);
    });
    
    if (overlay) {
        overlay.addEventListener('click', toggleSidebar);
    }
    */

    // View All Bookings Button
    const viewAllBtn = document.getElementById('viewAllBookingsBtn');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', () => window.location.href = 'booking.html');
    }

    // Active Link Handler
    const links = document.querySelectorAll('.nav-item');
    links.forEach(link => {
        // Exclude Logout Button from being set to active
        if (link.id === 'logoutSidebarBtn') return;

        link.addEventListener('click', function () {
            links.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-active');
                overlay.classList.remove('active');
            }
        });
    });

    // --- NOTIFICATION TOGGLE LOGIC ---
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');

    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            if (e.target.closest('.notification-dropdown')) return;
            notifDropdown.classList.toggle('active');
        });

        // Close Notification when clicking outside
        document.addEventListener('click', (e) => {
            if (!notifBtn.contains(e.target)) {
                notifDropdown.classList.remove('active');
            }
        });
    }

});

/**
 * Admin Dashboard Script
 * Fetches real-time stats and bookings from the API.
 */

$(document).ready(function () {
    // Configuration
    // API_BASE_URL handled by ApiClient

    // Initialization
    let allBookings = []; // Store bookings for client-side filtering
    init();

    function init() {
        loadDashboardData();
        // Refresh every 10 seconds for real-time updates
        setInterval(loadDashboardData, 10000);

        // Search Listener
        $('#bookingSearchInput').on('keyup', function () {
            const searchTerm = $(this).val().toLowerCase();
            const filteredBookings = allBookings.filter(booking => {
                return (
                    (booking.client_name && booking.client_name.toLowerCase().includes(searchTerm)) ||
                    (booking.service_name && booking.service_name.toLowerCase().includes(searchTerm)) ||
                    (booking.cleaner_name && booking.cleaner_name.toLowerCase().includes(searchTerm)) ||
                    (booking.status && booking.status.toLowerCase().includes(searchTerm)) ||
                    (booking.id && booking.id.toString().includes(searchTerm))
                );
            });
            renderRecentBookings(filteredBookings);
        });
    }

    function loadDashboardData() {
        ApiClient.get('/admin/dashboard')
            .then(function (response) {
                if (response.success) {
                    updateStats(response.stats);

                    // Store all bookings and render filtered view (or all if search is empty)
                    allBookings = response.recent_bookings;

                    const searchTerm = $('#bookingSearchInput').val().toLowerCase();
                    if (searchTerm) {
                        // Re-apply filter if user is searching while data refreshes
                        const filteredBookings = allBookings.filter(booking => {
                            return (
                                (booking.client_name && booking.client_name.toLowerCase().includes(searchTerm)) ||
                                (booking.service_name && booking.service_name.toLowerCase().includes(searchTerm)) ||
                                (booking.cleaner_name && booking.cleaner_name.toLowerCase().includes(searchTerm)) ||
                                (booking.status && booking.status.toLowerCase().includes(searchTerm)) ||
                                (booking.id && booking.id.toString().includes(searchTerm))
                            );
                        });
                        renderRecentBookings(filteredBookings);
                    } else {
                        renderRecentBookings(allBookings);
                    }

                    renderNotifications(response.notifications || []);
                }
            })
            .catch(function (xhr) {
                console.error('Failed to load dashboard data', xhr);
                UiUtils.showToast('Failed to load dashboard data.', 'error');
            });
    }

    function updateStats(stats) {
        animateValue("statBookings", 0, stats.bookings_today, 1000);
        $('#trendBookings').html(getTrendHtml(stats.bookings_trend));

        $('#statRevenue').text('₱' + Number(stats.total_revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        $('#trendRevenue').html(getTrendHtml(stats.revenue_trend));

        animateValue("statClients", 0, stats.active_clients, 1000);
        $('#trendClients').html(getTrendHtml(stats.clients_trend));

        $('#statAvailability').text(stats.availability_rate + '%');
        $('#trendAvailability').html(getTrendHtml(stats.availability_trend));
    }

    function renderRecentBookings(bookings) {
        const tbody = $('#recentBookingsTable tbody');
        tbody.empty();

        bookings.forEach(booking => {
            const statusClass = getStatusClass(booking.status);
            const clientAvatarHtml = AvatarMixin.renderAvatarHtml(booking.client_avatar, booking.client_name, 'avatar-circle');
            const cleanerAvatarHtml = AvatarMixin.renderAvatarHtml(booking.cleaner_avatar, booking.cleaner_name, 'avatar-circle');
            const serviceImageUrl = ImageUtils.getServiceImageUrl(booking.service_image);

        const cleanerDisplay = booking.cleaner_name === 'Unassigned'
            ? `<div class="flex-center"><span style="opacity:0.6; font-style:italic;">Unassigned</span></div>`
            : `<div class="flex-center">${cleanerAvatarHtml} <span style="margin-left:8px;">${booking.cleaner_name}</span></div>`;

        const row = `
                <tr>
                    <td>
                        <div style="font-size: 0.9rem; color: var(--text-dark); font-weight: 700;">
                            ${booking.display_id || `BK-${String(booking.id).padStart(4, '0')}`}
                        </div>
                    </td>
                    <td>
                        <div class="flex-center">
                            ${clientAvatarHtml}
                            <span style="margin-left: 10px; font-weight: 600;">${booking.client_name}</span>
                        </div>
                    </td>
                    <td>
                        <div class="flex-center">
                            <img src="${serviceImageUrl}" class="avatar-circle" style="border-radius: 4px;" alt="${booking.service_name}" onerror="ImageUtils.handleImageError(this, '../../assets/images/default-service.png')">
                            <span style="margin-left: 10px;">${booking.service_name}</span>
                        </div>
                    </td>
                    <td>
                        ${cleanerDisplay}
                    </td>
                    <td>${booking.date_time}</td>
                    <td><span class="status-badge ${statusClass}">${booking.status}</span></td>
                    <td style="font-weight: 700;">₱${Number(String(booking.price).replace(/[^0-9.-]+/g, "")).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `;
        tbody.append(row);
    });
}

function getTrendHtml(trend) {
    const color = trend.direction === 'up' ? 'var(--success)' : (trend.direction === 'down' ? 'var(--danger)' : 'var(--text-light)');
    const icon = trend.direction === 'up' ? 'ri-arrow-up-line' : (trend.direction === 'down' ? 'ri-arrow-down-line' : 'ri-subtract-line');
    return `<span style="color: ${color}; font-weight: 500; font-size: 0.85rem;"><i class="${icon}"></i> ${trend.text}</span>`;
}

function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'pending': return 'status-pending';
        case 'confirmed': return 'status-confirmed';
        case 'cancelled': return 'status-cancelled';
        case 'completed': return 'status-done';
        default: return 'status-pending';
    }
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
});



function renderNotifications(data) {
    const list = $('#notifList');
    list.empty();
    $('#notifCount').text(data.length);

    if (data.length === 0) {
        list.append('<div style="padding: 20px; text-align: center; color: var(--text-light);">No new notifications</div>');
        return;
    }

    data.forEach(notif => {
        const iconClass = getNotifIconClass(notif.type);
        const item = `
            <a href="cleaner.html" class="notif-item ${notif.read ? '' : 'unread'}">
                <div class="notif-icon ${iconClass.color}"><i class="${iconClass.icon}"></i></div>
                <div class="notif-content">
                    <span class="notif-title">${notif.title}</span>
                    <span class="notif-desc">${notif.message}</span>
                    <span class="notif-time">${notif.time_ago}</span>
                </div>
            </a>
        `;
        list.append(item);
    });
}

function getNotifIconClass(type) {
    switch (type) {
        case 'booking': return { color: 'blue', icon: 'ri-calendar-event-line' };
        case 'payment': return { color: 'red', icon: 'ri-alert-line' };
        case 'success': return { color: 'green', icon: 'ri-check-double-line' };
        case 'info': return { color: 'orange', icon: 'ri-user-add-line' }; // Added for cleaner requests
        default: return { color: 'blue', icon: 'ri-notification-line' };
    }
}
