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
                renderGeneral(response.data.general);
                renderHours(response.data.hours);
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

function renderGeneral(data) {
    $('#companyName').val(data.companyName);
    $('#supportEmail').val(data.supportEmail);
    $('#address').val(data.address);
}

function renderHours(hoursData) {
    const container = $('#hoursContainer');
    container.empty();

    hoursData.forEach(day => {
        const disabledClass = day.active ? '' : 'disabled';
        const checked = day.active ? 'checked' : '';

        const html = `
            <div class="hours-row ${disabledClass}" id="row-${day.id}" data-id="${day.id}">
                <span class="day-label">${day.day}</span>
                
                <div class="time-picker-wrapper">
                    <i class="ri-time-line clock-icon"></i>
                    <input type="text" class="time-picker-input start-time" value="${day.start}" ${day.active ? '' : 'disabled'}>
                </div>
                
                <div class="separator">-</div>
                
                <div class="time-picker-wrapper">
                    <i class="ri-time-line clock-icon"></i>
                    <input type="text" class="time-picker-input end-time" value="${day.end}" ${day.active ? '' : 'disabled'}>
                </div>
                
                <div class="switch-wrapper">
                    <label class="switch">
                        <input type="checkbox" class="day-toggle" data-row="row-${day.id}" ${checked}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
        container.append(html);
    });

    initFlatpickr();
}

function initFlatpickr() {
    flatpickr(".time-picker-input", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true
    });
}

function setupEventListeners() {
    // Tab Switching
    $('.tab-btn').click(function () {
        const target = $(this).data('target');

        $('.tab-btn').removeClass('active');
        $(this).addClass('active');

        $('.settings-panel').removeClass('active');
        $(`#${target}`).addClass('active');
    });

    // Sidebar Toggle handled by admin-sidebar.js
    // $('.toggle-btn').click(toggleSidebar);
    // $('#overlay').click(closeSidebar);

    // Save Profile
    $('#saveProfileBtn').click(function () {
        const btn = $(this);

        const formData = new FormData();
        formData.append('firstName', $('#firstName').val());
        formData.append('middleName', $('#middleName').val());
        formData.append('lastName', $('#lastName').val());
        formData.append('phone', $('#phone').val());

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

    // Save Company Info
    $('#saveGeneralBtn').click(function () {
        const btn = $(this);

        const data = {
            companyName: $('#companyName').val(),
            supportEmail: $('#supportEmail').val(),
            address: $('#address').val()
        };

        UiUtils.setBtnLoading(btn, true, 'Saving...');

        ApiClient.post('/admin/settings/general', data)
            .then(function (response) {
                UiUtils.showToast('Company details saved!', 'success');
            })
            .catch(function (xhr) {
                UiUtils.showToast('Failed to save details', 'error');
            })
            .finally(function () {
                UiUtils.setBtnLoading(btn, false, 'Save Details');
            });
    });

    // Save Hours
    $('#saveHoursBtn').click(function () {
        const btn = $(this);

        const hours = [];
        $('.hours-row').each(function () {
            const id = $(this).data('id');
            const start = $(this).find('.start-time').val();
            const end = $(this).find('.end-time').val();
            const active = $(this).find('.day-toggle').is(':checked');

            hours.push({ id, start, end, active });
        });

        UiUtils.setBtnLoading(btn, true, 'Saving...');

        ApiClient.post('/admin/settings/hours', { hours })
            .then(function (response) {
                UiUtils.showToast('Business hours updated!', 'success');
            })
            .catch(function (xhr) {
                UiUtils.showToast('Failed to update hours', 'error');
            })
            .finally(function () {
                UiUtils.setBtnLoading(btn, false, 'Save Hours');
            });
    });

    // Day Toggle Switch
    $(document).on('change', '.day-toggle', function () {
        const rowId = $(this).data('row');
        const row = $(`#${rowId}`);
        const inputs = row.find('input[type="text"]');

        if (this.checked) {
            row.removeClass('disabled');
            inputs.prop('disabled', false);
        } else {
            row.addClass('disabled');
            inputs.prop('disabled', true);
        }
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
