/**
 * Cleaner Sidebar Profile Manager
 * Automatically updates the sidebar profile section with current user data.
 */

$(document).ready(function() {
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
    if ($(window).width() > 992) {
        const isCollapsed = localStorage.getItem('cleaner_sidebar_collapsed') === 'true';
        if (isCollapsed) {
            dashboard.addClass('collapsed');
        }
    }

    function toggleSidebar() {
        if ($(window).width() <= 992) {
            sidebar.toggleClass('mobile-active');
            overlay.toggleClass('active');
        } else {
            sidebar.toggleClass('collapsed');
            $('.main-content').toggleClass('expanded');
            
            // 2. Save State to LocalStorage
            const isCollapsed = sidebar.hasClass('collapsed');
            localStorage.setItem('cleaner_sidebar_collapsed', isCollapsed);
        }
    }

    // 3. Apply initial state correctly (fixes flickering/wrong margin)
    if ($(window).width() > 992) {
        const isCollapsed = localStorage.getItem('cleaner_sidebar_collapsed') === 'true';
        if (isCollapsed) {
            sidebar.addClass('collapsed');
            $('.main-content').addClass('expanded');
        }
    }

    toggleBtns.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
    });

    if (overlay.length) {
        overlay.on('click', function() {
            toggleSidebar();
        });
    }
    
    // Handle active state update if not handled by page script
    // Highlight current nav based on URL
    const currentFile = window.location.pathname.split('/').pop();
    $('.nav-menu .nav-item').each(function() {
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

    // Allow both 'cleaner' and specific roles like 'Residential Specialist'
    const allowedRoles = ['cleaner', 'residential specialist', 'commercial specialist', 'deep clean expert'];
    const normalizedRole = userRole ? userRole.toLowerCase().trim() : '';

    if (userRole && !allowedRoles.includes(normalizedRole)) {
        console.warn('User is not a recognized cleaner role: ' + userRole);
        // Optional: redirect to correct dashboard if strictly enforced
        // window.location.href = '../../auth/templates/login.html';
    } else if (!userRole) {
        // If role is missing but token exists, maybe fetch profile?
        // For now just warn
        console.warn('User role not found in local storage');
    }
}

function setupLogout() {
    // Handle Click on Sidebar Logout
    $('#logoutSidebarBtn').on('click', function(e) {
        e.preventDefault();
        const modal = document.getElementById('logout-modal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    });

    // Handle Confirm
    $('#confirmLogoutBtn').on('click', function() {
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

    // Close Modal on Outside Click
    $('#logout-modal').on('click', function(e) {
        if (e.target === this) closeLogoutModal();
    });
}

function closeLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = 'auto';
    }
}

function updateSidebarProfile() {
    const renderUser = (user) => {
        const defaultAvatar = '../../assets/images/default-avatar.png';
        let userName = user.name;
        if (!userName && user.firstName) {
             userName = `${user.firstName} ${user.lastName || ''}`.trim();
        }
        userName = userName || 'Cleaner';
        
        const userRole = (user.role || 'Cleaner').charAt(0).toUpperCase() + (user.role || 'Cleaner').slice(1);
        
        let avatarUrl = defaultAvatar;
        const rawAvatar = user.avatar || user.profile_photo_path || user.img; // Handle different key names
        
        if (rawAvatar) {
             const SERVER_URL = API_BASE_URL.replace('/api', '');
             if (rawAvatar.startsWith('http')) {
                 avatarUrl = rawAvatar;
             } else if (rawAvatar.startsWith('/storage/')) {
                 avatarUrl = new URL(rawAvatar, SERVER_URL).href;
             } else if (rawAvatar.startsWith('storage/')) {
                 avatarUrl = new URL('/' + rawAvatar, SERVER_URL).href;
             } else {
                 avatarUrl = '../../' + rawAvatar;
             }
             if (!avatarUrl.startsWith('data:')) {
                  avatarUrl += `?t=${new Date().getTime()}`;
             }
        }

        const profileImg = $('.user-profile .user-img');
        const profileName = $('.user-profile .user-info h4');
        const profileRole = $('.user-profile .user-info p');

        profileImg.attr('src', avatarUrl).off('error').on('error', function() {
            $(this).attr('src', defaultAvatar);
        });
        profileName.text(userName);
        profileRole.text(userRole);
    };

    const localData = localStorage.getItem('user_data');
    if (localData) {
        try {
            renderUser(JSON.parse(localData));
        } catch(e) { console.error(e); }
    }

    // Fetch fresh data
    ApiClient.get('/cleaner/dashboard')
        .then(response => {
            if (response.success && response.data && response.data.profile) {
                const profile = response.data.profile;
                
                // Retrieve existing data to preserve ID
                const existingData = JSON.parse(localStorage.getItem('user_data') || '{}');
                
                const updatedUser = {
                    ...existingData, // Preserve existing fields like id/user_id
                    name: profile.name,
                    email: profile.email,
                    phone: profile.phone,
                    avatar: profile.avatar_url,
                    role: profile.title || existingData.role // Use cleaner title as role display or keep existing
                };
                
                // Ensure ID is present if returned from API
                if (profile.id) updatedUser.id = profile.id;
                
                localStorage.setItem('user_data', JSON.stringify(updatedUser));
                renderUser(updatedUser);
            }
        })
        .catch(err => {
            console.log('Background profile sync failed');
        });
}
