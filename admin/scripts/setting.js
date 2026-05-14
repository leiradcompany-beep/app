// API_BASE_URL handled by ApiClient

$(document).ready(function () {
    loadSettingsData();
    setupEventListeners();
});

function loadSettingsData() {
    ApiClient.get('/settings')
        .then(function (response) {
            if (response.success) {
                renderProfile(response.data.profile);
            } else {
                UiUtils.showToast('Failed to load settings', 'error');
            }
        })
        .catch(function (xhr) {
            console.error('API fetch failed', xhr);
            UiUtils.showToast('Error loading settings', 'error');
        });
}

function renderProfile(data) {
    $('#firstName').val(data.firstName);
    $('#middleName').val(data.middleName || '');
    $('#lastName').val(data.lastName);
    $('#email').val(data.email);
    $('#phone').val(data.phone);
    $('#address').val(data.address || '');

    const defaultAvatar = '../../assets/images/default-avatar.png';
    const avatarSrc = ImageUtils.getAvatarUrl(data.avatar);

    $('.current-avatar').attr('src', avatarSrc).off('error').on('error', function () {
        $(this).attr('src', defaultAvatar);
    });
}

window.previewAvatar = function (input) {
    const file = input.files[0];
    const maxSize = 2 * 1024 * 1024; // 2MB
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (file) {
        if (file.size > maxSize) {
            UiUtils.showToast('Image size must be less than 2MB', 'warning');
            input.value = '';
            return;
        }

        if (!validTypes.includes(file.type)) {
            UiUtils.showToast('Invalid image format', 'warning');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            $('.current-avatar').attr('src', e.target.result);
        }
        reader.readAsDataURL(file);
    }
};

function setupEventListeners() {
    // Save Profile
    $('#saveProfileBtn').click(function () {
        const btn = $(this);

        const formData = new FormData();
        formData.append('firstName', $('#firstName').val());
        formData.append('middleName', $('#middleName').val());
        formData.append('lastName', $('#lastName').val());
        formData.append('phone', $('#phone').val());
        formData.append('address', $('#address').val());

        const avatarInput = $('#avatarInput')[0];
        if (avatarInput.files && avatarInput.files[0]) {
            formData.append('avatar', avatarInput.files[0]);
        }

        UiUtils.setBtnLoading(btn, true, 'Saving...');

        // Use postFormData instead of post for FormData object
        ApiClient.postFormData('/settings/profile', formData)
            .then(function (response) {
                UiUtils.showToast('Profile updated successfully!', 'success');
                // Reload data to confirm persistence and update UI (like sidebar)
                loadSettingsData();
            })
            .catch(function (xhr) {
                UiUtils.showToast(xhr.responseJSON?.message || 'Failed to update profile', 'error');
            })
            .finally(function () {
                UiUtils.setBtnLoading(btn, false, 'Save Profile');
            });
    });

    // Update Password
    $('#updatePasswordBtn').click(function () {
        const current = $('#currentPassword').val();
        const newPass = $('#newPassword').val();

        if (!current || !newPass) {
            UiUtils.showToast('Please fill in all password fields', 'warning');
            return;
        }

        const btn = $(this);
        UiUtils.setBtnLoading(btn, true, 'Updating...');

        ApiClient.post('/settings/password', { currentPassword: current, newPassword: newPass })
            .then(function (response) {
                UiUtils.showToast('Password updated successfully!', 'success');
                $('#currentPassword').val('');
                $('#newPassword').val('');
            })
            .catch(function (xhr) {
                UiUtils.showToast(xhr.responseJSON?.message || 'Failed to update password', 'error');
            })
            .finally(function () {
                UiUtils.setBtnLoading(btn, false, 'Update Password');
            });
    });
}

/* 
function toggleSidebar() {
    $('.sidebar').toggleClass('mobile-active');
    $('#overlay').toggleClass('active');
}

function closeSidebar() {
    $('.sidebar').removeClass('mobile-active');
    $('#overlay').removeClass('active');
}
*/
