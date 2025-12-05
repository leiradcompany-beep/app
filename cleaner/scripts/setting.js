$(document).ready(function() {
    loadProfileData();
    
    // Image Preview
    $("#imageUpload").change(function() {
        if (this.files && this.files[0]) {
            var reader = new FileReader();
            reader.onload = function(e) {
                $('#imagePreview').attr('src', e.target.result);
            }
            reader.readAsDataURL(this.files[0]);
        }
    });

    // Profile Update
    $('#profileForm').on('submit', function(e) {
        e.preventDefault();
        const btn = $(this).find('button[type="submit"]');
        UiUtils.setBtnLoading(btn, true, 'Saving...');

        const formData = new FormData();
        formData.append('firstName', $('#inputFirstName').val());
        formData.append('middleName', $('#inputMiddleName').val());
        formData.append('lastName', $('#inputLastName').val());
        formData.append('phone', $('#inputPhone').val());
        
        const imageFile = $('#imageUpload')[0].files[0];
        if (imageFile) {
            formData.append('avatar', imageFile);
        }

        ApiClient.postFormData('/settings/profile', formData)
            .then(function(response) {
                if(response.success) {
                    UiUtils.showToast('Profile updated successfully', 'success');
                    // Update sidebar immediately if possible
                    if (window.updateSidebarProfile) window.updateSidebarProfile();
                } else {
                    UiUtils.showToast(response.message || 'Failed to update profile', 'error');
                }
            })
            .catch(function(xhr) {
                UiUtils.showToast(xhr.responseJSON?.message || 'Error updating profile', 'error');
            })
            .finally(function() {
                UiUtils.setBtnLoading(btn, false, 'Save Profile');
            });
    });

    // Password Update
    $('#passwordForm').on('submit', function(e) {
        e.preventDefault();
        const btn = $(this).find('button[type="submit"]');
        
        const current = $('#currentPassword').val();
        const newPass = $('#newPassword').val();
        const confirmPass = $('#confirmPassword').val();

        if (newPass !== confirmPass) {
            UiUtils.showToast('New passwords do not match', 'warning');
            return;
        }

        if (newPass.length < 8) {
            UiUtils.showToast('Password must be at least 8 characters', 'warning');
            return;
        }

        UiUtils.setBtnLoading(btn, true, 'Updating...');

        ApiClient.post('/settings/password', {
            currentPassword: current,
            newPassword: newPass
        })
        .then(function(response) {
            if(response.success) {
                UiUtils.showToast('Password updated successfully', 'success');
                $('#passwordForm')[0].reset();
            } else {
                UiUtils.showToast(response.message || 'Failed to update password', 'error');
            }
        })
        .catch(function(xhr) {
            UiUtils.showToast(xhr.responseJSON?.message || 'Error updating password', 'error');
        })
        .finally(function() {
            UiUtils.setBtnLoading(btn, false, 'Update Password');
        });
    });
});

function loadProfileData() {
    ApiClient.get('/settings')
        .then(function(response) {
            if(response.success) {
                const p = response.data.profile;
                $('#inputFirstName').val(p.firstName);
                $('#inputMiddleName').val(p.middleName || '');
                $('#inputLastName').val(p.lastName);
                $('#inputPhone').val(p.phone);
                $('#inputEmail').val(p.email);
                
                $('#profileName').text(`${p.firstName} ${p.lastName}`);
                
                if (p.avatar) {
                    const avatarUrl = ImageUtils.withCacheBust(ImageUtils.getAvatarUrl(p.avatar));
                    $('#imagePreview').attr('src', avatarUrl);
                }
            }
        });
}
