$(document).ready(function() {
    // --- STATE ---
    let users = [];
    let currentFilter = 'all';
    let isEditing = false;

    // --- INITIALIZATION ---
    loadUsers();

    // --- EVENT LISTENERS ---
    
    // Filter Tabs
    $('.tab').on('click', function() {
        $('.tab').removeClass('active');
        $(this).addClass('active');
        currentFilter = $(this).data('role');
        renderUsers();
    });

    // Search
    $('#userSearchInput').on('keyup', function() {
        renderUsers();
    });

    // Form Submit
    $('#userForm').on('submit', function(e) {
        e.preventDefault();
        saveUser();
    });

    // Drawer Overlay Close
    $('#mobileOverlay, #overlay').on('click', function() {
        closeDrawer();
    });

    // --- FUNCTIONS ---

    function loadUsers() {
        const listContainer = $('#userList');
        listContainer.html('<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-light);">Loading users...</div>');

        ApiClient.get('/admin/users')
            .then(response => {
                if (response.success) {
                    users = response.data;
                    renderUsers();
                } else {
                    listContainer.html(`<div style="grid-column: 1/-1; text-align:center; color:red;">Error: ${response.message || 'Failed to load users'}</div>`);
                }
            })
            .catch(err => {
                console.error(err);
                listContainer.html('<div style="grid-column: 1/-1; text-align:center; color:red;">Failed to connect to server</div>');
            });
    }

    function renderUsers() {
        const listContainer = $('#userList');
        const searchTerm = $('#userSearchInput').val().toLowerCase();

        let filtered = users.filter(user => {
            // Role Filter
            if (currentFilter !== 'all' && user.role !== currentFilter) return false;

            // Search Filter
            const matchName = user.name.toLowerCase().includes(searchTerm);
            const matchEmail = user.email.toLowerCase().includes(searchTerm);
            return matchName || matchEmail;
        });

        if (filtered.length === 0) {
            listContainer.html('<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-light); background:white; border-radius:16px; border:1px solid var(--border);">No users found matching your criteria.</div>');
            return;
        }

        let html = '';
        filtered.forEach(user => {
            const roleClass = `role-${user.role}`; // role-admin, role-customer, role-cleaner
            // Handle image path (similar to booking.js logic)
            let imgUrl = '../../assets/images/default-avatar.png';
            const userImg = user.profile_photo_path || user.avatar || user.img;
            const BASE_STORAGE_URL = API_BASE_URL.replace('/api', ''); // Remove /api suffix
            
            if (userImg) {
                if (userImg.startsWith('http')) {
                    imgUrl = userImg;
                } else if (userImg.startsWith('assets/')) {
                    imgUrl = '../../' + userImg;
                } else if (userImg.startsWith('/storage/')) {
                    imgUrl = BASE_STORAGE_URL + userImg;
                } else {
                    imgUrl = `${BASE_STORAGE_URL}/storage/${userImg}`;
                }
                
                if (!imgUrl.startsWith('data:')) imgUrl += `?t=${new Date().getTime()}`;
            }

            html += `
                <div class="user-card">
                    <div class="card-header">
                        <img src="${imgUrl}" class="card-img" alt="${user.name}" onerror="this.src='../../assets/images/default-avatar.png'">
                        <div class="card-info">
                            <h4>${user.name}</h4>
                            <span class="card-role ${roleClass}">${user.role}</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="info-row">
                            <i class="ri-mail-line"></i>
                            <span>${user.email}</span>
                        </div>
                        <div class="info-row">
                            <i class="ri-phone-line"></i>
                            <span>${user.phone_number || user.phone || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <i class="ri-calendar-line"></i>
                            <span>Joined: ${new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="card-footer">
                        <div class="status-badge status-active">
                            <i class="ri-checkbox-circle-fill"></i> Active
                        </div>
                        <div style="display:flex; gap: 8px;">
                            <button class="action-btn btn-edit" onclick="openEditDrawer('${user.id}')">
                                <i class="ri-pencil-line"></i>
                            </button>
                            ${user.role !== 'admin' ? `
                            <button class="action-btn btn-delete" onclick="confirmDelete('${user.id}')">
                                <i class="ri-delete-bin-line"></i>
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        listContainer.html(html);
    }

    // --- DRAWER ACTIONS ---

    window.toggleDrawer = function() {
        const drawer = $('#userDrawer');
        const overlay = $('#overlay');
        
        if (drawer.hasClass('open')) {
            closeDrawer();
        } else {
            // Open as Add User
            resetForm();
            $('#drawerTitle').text('Add New User');
            $('#userForm button[type="submit"]').html('<i class="ri-user-add-line"></i> Add User');
            $('#userForm button[type="submit"]').removeClass('btn-update-mode').addClass('btn-add-mode');
            isEditing = false;
            $('#passwordRequired').show();
            $('#userPassword').attr('placeholder', '********').prop('required', true);
            
            drawer.addClass('open');
            overlay.addClass('active');
        }
    };

    function closeDrawer() {
        $('#userDrawer').removeClass('open');
        $('#overlay').removeClass('active');
    }

    window.openEditDrawer = function(userId) {
        const user = users.find(u => u.id == userId); // Loose equality for string/number match
        if (!user) return;

        resetForm();
        isEditing = true;
        $('#drawerTitle').text('Edit User');
        $('#userForm button[type="submit"]').html('<i class="ri-save-line"></i> Update User');
        $('#userForm button[type="submit"]').removeClass('btn-add-mode').addClass('btn-update-mode');
        $('#userId').val(user.id);
        
        const fullName = user.name || '';
        const nameParts = fullName.split(' ');
        let firstName = '';
        let middleName = '';
        let lastName = '';

        if (nameParts.length > 0) {
            firstName = nameParts[0];
            if (nameParts.length === 2) {
                lastName = nameParts[1];
            } else if (nameParts.length > 2) {
                lastName = nameParts[nameParts.length - 1];
                middleName = nameParts.slice(1, -1).join(' ');
            }
        }
        $('#firstNameInput').val(firstName);
        $('#middleNameInput').val(middleName);
        $('#lastNameInput').val(lastName);

        $('#userEmail').val(user.email);
        $('#userRoleSelect').val(user.role);
        const phone = user.phone_number || user.phone;
        $('#userPhone').val(phone);

        // Image Preview
        let imgUrl = '../../assets/images/default-avatar.png';
        const userImg = user.profile_photo_path || user.avatar || user.img;
        const BASE_STORAGE_URL = API_BASE_URL.replace('/api', '');
        
        if (userImg) {
            if (userImg.startsWith('http')) {
                imgUrl = userImg;
            } else if (userImg.startsWith('assets/')) {
                imgUrl = '../../' + userImg;
            } else if (userImg.startsWith('/storage/')) {
                imgUrl = BASE_STORAGE_URL + userImg;
            } else {
                imgUrl = `${BASE_STORAGE_URL}/storage/${userImg}`;
            }
        }
        $('#userPreview').attr('src', imgUrl);

        // Password not required for edit
        $('#passwordRequired').hide();
        $('#userPassword').attr('placeholder', 'Leave blank to keep current').prop('required', false);

        $('#userDrawer').addClass('open');
        $('#overlay').addClass('active');
    };

    function resetForm() {
        $('#userForm')[0].reset();
        $('#userId').val('');
        $('#userPreview').attr('src', '../../assets/images/default-avatar.png');
        $('#userRoleSelect').val('customer');
    }

    function saveUser() {
        const id = $('#userId').val();
        const formData = new FormData();
        
        const firstName = $('#firstNameInput').val().trim();
        const middleName = $('#middleNameInput').val().trim();
        const lastName = $('#lastNameInput').val().trim();
        const fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
        formData.append('name', fullName);
        formData.append('email', $('#userEmail').val());
        formData.append('role', $('#userRoleSelect').val());
        formData.append('phone_number', $('#userPhone').val());
        
        const password = $('#userPassword').val();
        if (password) {
            formData.append('password', password);
        }

        const imageFile = $('#userImage')[0].files[0];
        if (imageFile) {
            formData.append('avatar', imageFile);
        }

        let url = '/admin/users';
        
        if (isEditing && id) {
            url += `/${id}`;
            formData.append('_method', 'PUT'); // Laravel spoofing if needed, or just handle as POST update
            // Note: Standard FormData with PUT method often fails in PHP/Laravel. 
            // Better to use POST with _method=PUT or specific endpoint.
            // Let's try standard POST for update if the backend supports it or use _method.
            // Assuming the ApiClient handles this or we use POST with _method.
        }

        const btn = $('#userForm button[type="submit"]');
        UiUtils.setBtnLoading(btn, true, 'Saving...');

        ApiClient.postFormData(url, formData)
            .then(response => {
                if (response.success) {
                    UiUtils.showToast(isEditing ? 'User updated successfully' : 'User created successfully', 'success');
                    closeDrawer();
                    loadUsers();
                } else {
                    UiUtils.showToast(response.message || 'Operation failed', 'error');
                }
            })
            .catch(xhr => {
                const msg = xhr.responseJSON?.message || 'Server error';
                UiUtils.showToast(msg, 'error');
            })
            .finally(() => {
                UiUtils.setBtnLoading(btn, false, isEditing ? '<i class="ri-save-line"></i> Update User' : '<i class="ri-user-add-line"></i> Add User');
            });
    }

    // --- DELETE ---
    let deleteId = null;
    
    window.confirmDelete = function(id) {
        deleteId = id;
        $('#confirmModalOverlay').css('display', 'flex');
    };

    $('#cancelConfirmBtn').on('click', function() {
        $('#confirmModalOverlay').hide();
        deleteId = null;
    });

    $('#yesConfirmBtn').on('click', function() {
        if (!deleteId) return;

        const btn = $(this);
        UiUtils.setBtnLoading(btn, true, 'Deleting...');

        ApiClient.delete(`/admin/users/${deleteId}`)
            .then(response => {
                if (response.success) {
                    UiUtils.showToast('User deleted successfully', 'success');
                    loadUsers();
                } else {
                    UiUtils.showToast(response.message || 'Failed to delete user', 'error');
                }
            })
            .catch(err => {
                UiUtils.showToast('Error deleting user', 'error');
            })
            .finally(() => {
                $('#confirmModalOverlay').hide();
                UiUtils.setBtnLoading(btn, false, 'Delete');
                deleteId = null;
            });
    });

    // --- UTILS ---
    window.previewUserImage = function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#userPreview').attr('src', e.target.result);
            }
            reader.readAsDataURL(input.files[0]);
        }
    };

    window.togglePasswordVisibility = function() {
        const input = $('#userPassword');
        const icon = $('#passwordIcon');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
            icon.removeClass('ri-eye-line').addClass('ri-eye-off-line');
        } else {
            input.attr('type', 'password');
            icon.removeClass('ri-eye-off-line').addClass('ri-eye-line');
        }
    };
});
