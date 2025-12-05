/**
 * Admin Sidebar Profile Manager
 * Automatically updates the sidebar profile section with current user data.
 */

$(document).ready(function () {
    checkAuth();
    updateSidebarProfile();
    setupLogout();
    setupSidebarToggle();
});

function setupSidebarToggle() {
    // Ensure elements exist before attaching listeners
    const dashboard = $('#dashboard');
    const sidebar = $('#sidebar');
    const overlay = $('#mobileOverlay');
    const toggleBtns = $('.toggle-btn');

    // 1. Initialize State from LocalStorage (Desktop Only)
    if ($(window).width() > 768) {
        const isCollapsed = localStorage.getItem('admin_sidebar_collapsed') === 'true';
        if (isCollapsed) {
            dashboard.addClass('collapsed');
        }
    }

    function toggleSidebar() {
        if ($(window).width() <= 768) {
            sidebar.toggleClass('mobile-active');
            overlay.toggleClass('active');
        } else {
            dashboard.toggleClass('collapsed');
            // 2. Save State to LocalStorage
            const isCollapsed = dashboard.hasClass('collapsed');
            localStorage.setItem('admin_sidebar_collapsed', isCollapsed);
        }
    }

    toggleBtns.on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
    });

    if (overlay.length) {
        overlay.on('click', function () {
            toggleSidebar();
        });
    }

    // Handle active state update if not handled by page script
    // Highlight current nav based on URL
    const currentFile = window.location.pathname.split('/').pop();
    $('.nav-menu .nav-item').each(function () {
        const href = $(this).attr('href');
        if (href === currentFile) {
            $('.nav-menu .nav-item').removeClass('active');
            $(this).addClass('active');
        }
    });
}

function checkAuth() {
    const token = localStorage.getItem('auth_token');
    let userRole = localStorage.getItem('user_role');

    // Fallback: try getting role from user_data object
    if (!userRole) {
        const userDataString = localStorage.getItem('user_data');
        if (userDataString) {
            try {
                const user = JSON.parse(userDataString);
                userRole = user.role;
            } catch (e) {
                console.warn('Failed to parse user_data for role check');
            }
        }
    }

    if (!token) {
        window.location.href = '../../auth/templates/login.html';
        return;
    }

    if (userRole !== 'admin') {
        // Optional: Redirect unauthorized roles to their respective dashboards
        // window.location.href = `../../auth/${userRole}/dashboard.html`;
        console.warn('User is not an admin');
    }
}

function setupLogout() {
    // Append Modal HTML to body if not exists
    if ($('#logoutModal').length === 0) {
        $('body').append(`
            <div class="drawer-overlay" id="logoutOverlay" style="z-index: 9998;"></div>
            <div class="modal-content" id="logoutModal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 16px; z-index: 9999; width: 90%; max-width: 400px; display: none; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                <div style="width: 60px; height: 60px; background: #FED7D7; color: #E53E3E; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 20px;">
                    <i class="ri-logout-box-r-line"></i>
                </div>
                <h3 style="font-size: 1.5rem; color: var(--text-dark); margin-bottom: 10px; font-weight: 700;">Confirm Logout</h3>
                <p style="color: var(--text-body); margin-bottom: 25px; line-height: 1.5;">Are you sure you want to sign out of your account?</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="cancelLogoutBtn" style="padding: 12px 24px; border-radius: 8px; border: 1px solid var(--border-light); background: white; color: var(--text-dark); font-weight: 600; cursor: pointer; transition: 0.2s;">Cancel</button>
                    <button id="confirmLogoutBtn" style="padding: 12px 24px; border-radius: 8px; border: none; background: #E53E3E; color: white; font-weight: 600; cursor: pointer; transition: 0.2s;">Logout</button>
                </div>
            </div>
        `);
    }

    // Handle Click on Sidebar Logout
    $('#logoutSidebarBtn').on('click', function (e) {
        e.preventDefault();
        $('#logoutOverlay').addClass('active').css({ opacity: 1, visibility: 'visible' });
        $('#logoutModal').fadeIn(200);
    });

    // Handle Cancel
    $(document).on('click', '#cancelLogoutBtn, #logoutOverlay', function () {
        $('#logoutOverlay').removeClass('active').css({ opacity: 0, visibility: 'hidden' });
        $('#logoutModal').fadeOut(200);
    });

    // Handle Confirm
    $(document).on('click', '#confirmLogoutBtn', function () {
        const btn = $(this);
        UiUtils.setBtnLoading(btn, true, 'Logging out...');

        ApiClient.post('/logout')
            .then(() => {
                console.log('Logout successful on server');
            })
            .catch((err) => {
                console.warn('Logout failed on server, clearing local session anyway', err);
            })
            .finally(() => {
                // Clear LocalStorage
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                localStorage.removeItem('user_role');

                // Redirect to Login
                window.location.href = '../../auth/templates/login.html';
            });
    });
}

function updateSidebarProfile() {
    // 1. Try to get fresh data from Settings API if available, otherwise fallback to local storage
    // Ideally, on page load, we should fetch the latest user info to keep sidebar in sync.

    // Helper function to render data
    const renderUser = (user) => {
        const defaultAvatar = '../../assets/images/default-avatar.png';
        // Handle different name structures (settings API returns firstName/lastName, Login returns name)
        let userName = user.name;
        if (!userName && user.firstName) {
            userName = `${user.firstName} ${user.lastName || ''}`.trim();
        }
        userName = userName || 'Admin User';

        const userRole = (user.role || 'Administrator').charAt(0).toUpperCase() + (user.role || 'Administrator').slice(1);

        // Resolve Avatar
        const avatarUrl = ImageUtils.getAvatarUrl(user.avatar || user.profile_photo_path);

        // Update DOM
        const profileImg = $('.user-profile .user-img');
        const profileName = $('.user-profile .user-info div:first-child');
        const profileRole = $('.user-profile .user-info div:last-child');

        profileImg.attr('src', avatarUrl).off('error').on('error', function () {
            $(this).attr('src', defaultAvatar);
        });
        profileName.text(userName);
        profileRole.text(userRole);
    };

    // First, render what we have in localStorage to avoid flicker
    const localData = localStorage.getItem('user_data');
    if (localData) {
        try {
            renderUser(JSON.parse(localData));
        } catch (e) { console.error(e); }
    }

    // Then, fetch fresh data in background
    // We use the /settings endpoint as it returns the full profile
    ApiClient.get('/settings')
        .then(response => {
            if (response.success && response.data && response.data.profile) {
                const profile = response.data.profile;
                // Combine into a user object structure
                const updatedUser = {
                    name: `${profile.firstName} ${profile.lastName}`.trim(),
                    email: profile.email,
                    phone: profile.phone,
                    avatar: profile.avatar,
                    role: 'admin' // Assumed, or fetch from context
                };

                // Update LocalStorage so next page load is fresh
                localStorage.setItem('user_data', JSON.stringify(updatedUser));

                // Re-render
                renderUser(updatedUser);
            }
        })
        .catch(err => {
            // Silent fail, keep showing local data
            console.log('Background profile sync failed, using cached data');
        });
}
