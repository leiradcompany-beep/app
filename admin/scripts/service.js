/**
 * Admin Service Management Script
 * Handles fetching service data, filtering, and UI interactions.
 */

$(document).ready(function () {
    // Configuration
    // API_BASE_URL handled by ApiClient

    // State
    let services = [];
    let currentFilter = 'All';
    let searchQuery = '';
    let currentPage = 1;
    const itemsPerPage = 6;

    // Initialization
    init();

    function init() {
        loadServices();
        setupEventListeners();

        // Setup Search Listener
        $('#service-search').on('input', function (e) {
            searchQuery = e.target.value.toLowerCase();
            currentPage = 1; // Reset pagination on search
            renderServices();
        });
    }

    // --- Data Fetching ---

    function loadServices() {
        // Show loading state
        $('#servicesGrid').html('<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-light);">Loading services...</div>');

        ApiClient.get('/admin/services')
            .then(function (response) {
                if (response.success) {
                    services = response.data;
                    renderServices();
                } else {
                    $('#servicesGrid').html('<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--danger);">Failed to load services.</div>');
                }
            })
            .catch(function (xhr) {
                console.error('API fetch failed', xhr);
                $('#servicesGrid').html('<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--danger);">Error loading data.</div>');
            });
    }

    // --- Rendering ---

    window.loadMoreServices = function () {
        currentPage++;
        renderServices();
    };

    function renderServices() {
        const container = $('#servicesGrid');
        container.empty();

        let filteredServices = services;

        // 1. Filter by Category
        if (currentFilter !== 'All') {
            if (currentFilter === 'Move-In/Out') {
                filteredServices = services.filter(s =>
                    (s.title && (s.title.includes('Move-In/Out') || s.title.includes('Move-Out'))) ||
                    (s.category && s.category === 'Move-In/Out')
                );
            } else {
                const categoryKeywords = {
                    'Standard Clean': ['Standard', 'Standard Clean'],
                    'Deep Clean': ['Deep', 'Deep Clean'],
                    'Specialty': ['Specialty']
                };
                const validCategories = categoryKeywords[currentFilter] || [currentFilter];

                filteredServices = services.filter(s =>
                    s.category && validCategories.includes(s.category.trim())
                );
            }
        }

        // 2. Filter by Search
        if (searchQuery) {
            filteredServices = filteredServices.filter(s =>
                s.title.toLowerCase().includes(searchQuery) ||
                (s.description && s.description.toLowerCase().includes(searchQuery))
            );
        }

        // 3. Pagination
        const limit = currentPage * itemsPerPage;
        const visibleServices = filteredServices.slice(0, limit);

        // Check if we need to show "See More" button
        const seeMoreBtn = $('#see-more-container');
        if (visibleServices.length < filteredServices.length) {
            seeMoreBtn.show();
        } else {
            seeMoreBtn.hide();
        }

        if (visibleServices.length === 0) {
            container.html('<div style="grid-column: 1/-1; text-align:center; padding:20px;">No services found.</div>');
            seeMoreBtn.hide();
            return;
        }

        visibleServices.forEach(service => {
            // Use ImageUtils for consistent image URL handling
            const imgSrc = ImageUtils.getServiceImageUrl(service.image);
            const cacheBustedImgSrc = ImageUtils.withCacheBust(imgSrc);


            const cardHtml = `
                <div class="service-card">
                    <div class="s-img-container">
                        <img src="${cacheBustedImgSrc}" alt="${service.title}" class="s-img" onerror="ImageUtils.handleImageError(this, '../../assets/images/default-service.png')">
                        <div class="s-badge">${capitalize(service.category)}</div>
                        ${service.is_active ? '<div class="s-status active">Active</div>' : '<div class="s-status inactive">Inactive</div>'}
                    </div>
                    <div class="s-content">
                        <div class="s-header">
                            <div class="s-title">${service.title}</div>
                            <div class="s-price">₱${service.price}</div>
                        </div>
                        <div class="s-desc">${service.description || 'No description available.'}</div>
                        <div class="s-meta">
                            <span><i class="ri-time-line"></i> ${service.duration}</span>
                            <span><i class="ri-price-tag-3-line"></i> ${capitalize(service.category)}</span>
                        </div>
                        <div class="s-actions">
                            <button class="btn-action btn-edit" onclick="editService(${service.id})">
                                <i class="ri-pencil-line"></i> Edit
                            </button>
                            <button class="btn-action btn-delete" onclick="deleteService(${service.id})">
                                <i class="ri-delete-bin-line"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.append(cardHtml);
        });
    }

    // --- Helpers ---

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // --- Event Listeners ---

    function setupEventListeners() {
        // Sidebar Toggle handled by admin-sidebar.js

        // Drawer Toggle
        $('#overlay').on('click', closeDrawer);
        $('.close-drawer').on('click', closeDrawer);

        // Save Service Button
        $('#serviceDrawer .btn-primary').on('click', function () {
            const btn = $(this);
            const form = $('#serviceDrawer form');
            const serviceId = form.data('id'); // Check if editing

            const formData = new FormData();
            formData.append('title', form.find('input[type="text"]').val());
            // Category Select
            formData.append('category', form.find('select').eq(0).val());
            formData.append('price', form.find('input[type="number"]').val());
            // Duration Select
            formData.append('duration', form.find('select').eq(1).val());
            formData.append('description', form.find('textarea').val());

            // Handle active toggle
            const isActive = form.find('input[type="checkbox"]').is(':checked') ? 1 : 0;
            formData.append('is_active', isActive);

            const fileInput = form.find('input[type="file"]')[0];
            if (fileInput.files && fileInput.files[0]) {
                formData.append('image', fileInput.files[0]);
            }

            // Basic validation
            if (!formData.get('title') || !formData.get('price') || !formData.get('category')) {
                UiUtils.showToast('Please fill in required fields', 'warning');
                return;
            }

            UiUtils.setBtnLoading(btn, true, 'Saving...');

            let request;
            if (serviceId) {
                formData.append('_method', 'PUT');
                request = ApiClient.postFormData(`/admin/services/${serviceId}`, formData);
            } else {
                request = ApiClient.postFormData('/admin/services', formData);
            }

            request
                .then(function (response) {
                    if (response.success) {
                        UiUtils.showToast(serviceId ? 'Service updated' : 'Service added successfully', 'success');
                        loadServices(); // Reload list
                        closeDrawer();
                        // Clear form
                        form[0].reset();
                        form.removeData('id'); // Clear ID
                        $('#imagePreviewContainer').hide();
                        $('#imagePreview').attr('src', '');
                        $('#uploadLabel').show();
                    } else {
                        UiUtils.showToast(response.message || 'Failed to save service', 'error');
                    }
                })
                .catch(function (xhr) {
                    let msg = 'Error saving service';
                    if (xhr.responseJSON) {
                        if (xhr.responseJSON.errors) {
                            // Collect all error messages
                            const errors = Object.values(xhr.responseJSON.errors).flat();
                            msg = errors.join('<br>');
                        } else if (xhr.responseJSON.message) {
                            msg = xhr.responseJSON.message;
                        }
                    }
                    UiUtils.showToast(msg, 'error');
                })
                .finally(function () {
                    UiUtils.setBtnLoading(btn, false, 'Save Service');
                });
        });
    }

    // --- Global Functions ---

    let serviceToDeleteId = null;

    window.previewImage = function (input) {
        const file = input.files[0];
        const maxSize = 2 * 1024 * 1024; // 2MB
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        if (file) {
            if (file.size > maxSize) {
                UiUtils.showToast('Image size must be less than 2MB', 'warning');
                input.value = '';
                $('#imagePreviewContainer').hide();
                return;
            }

            if (!validTypes.includes(file.type)) {
                UiUtils.showToast('Invalid image format. Use JPG, PNG, GIF, or WEBP', 'warning');
                input.value = '';
                $('#imagePreviewContainer').hide();
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                $('#imagePreview').attr('src', e.target.result);
                $('#imagePreviewContainer').show();
                $('#uploadLabel').hide();
            }
            reader.readAsDataURL(file);
        }
    };

    window.removeImage = function () {
        const form = $('#serviceDrawer form');
        form.find('input[type="file"]').val('');
        $('#imagePreviewContainer').hide();
        $('#imagePreview').attr('src', '');
        $('#uploadLabel').show();
    };

    window.toggleDrawer = function () {
        const drawer = $('#serviceDrawer');
        const overlay = $('#overlay');

        if (drawer.hasClass('open')) {
            drawer.removeClass('open');
            overlay.removeClass('active');
            // Reset form when closing if it was open
            const form = drawer.find('form');
            form[0].reset();
            form.removeData('id');
            drawer.find('.drawer-header h3').text('Add New Service');
        } else {
            drawer.addClass('open');
            overlay.addClass('active');
            drawer.find('.drawer-header h3').text('Add New Service'); // Default title
        }
    };

    function closeDrawer() {
        $('#serviceDrawer').removeClass('open');
        $('#overlay').removeClass('active');
        const form = $('#serviceDrawer form');
        form[0].reset();
        form.removeData('id');
    }

    window.filterServices = function (category, btnElement) {
        // UI Update
        $('.filter-btn').removeClass('active');
        $(btnElement).addClass('active');

        // Logic Update
        currentFilter = category;
        currentPage = 1; // Reset pagination on filter change
        renderServices();
    };

    window.editService = function (id) {
        const service = services.find(s => s.id === id);
        if (!service) return;

        const form = $('#serviceDrawer form');
        form.data('id', id); // Store ID for update

        // Populate form
        form.find('input[type="text"]').val(service.title);
        // Category Select
        form.find('select').eq(0).val(service.category);
        form.find('input[type="number"]').val(service.price);
        // Duration Select
        form.find('select').eq(1).val(service.duration);
        form.find('textarea').val(service.description);

        // Populate Active Toggle
        form.find('input[type="checkbox"]').prop('checked', service.is_active);

        // Image Preview
        const preview = form.find('.image-preview');
        if (service.image) {
            const previewSrc = ImageUtils.getServiceImageUrl(service.image);
            $('#imagePreview').attr('src', previewSrc);
            $('#imagePreviewContainer').show();
            $('#uploadLabel').hide();
        } else {
            $('#imagePreviewContainer').hide();
            $('#uploadLabel').show();
        }
        form.find('input[type="file"]').val('');

        // Change Title
        $('#serviceDrawer .drawer-header h3').text('Edit Service');

        // Open Drawer
        $('#serviceDrawer').addClass('open');
        $('#overlay').addClass('active');
    };

    window.deleteService = function (id) {
        serviceToDeleteId = id;
        $('#deleteModalOverlay').css('display', 'flex').fadeIn(200);
    };

    // Modal Event Listeners
    $('#cancelDeleteBtn, #deleteModalOverlay').on('click', function (e) {
        if (e.target === this || this.id === 'cancelDeleteBtn') {
            $('#deleteModalOverlay').fadeOut(200);
            serviceToDeleteId = null;
        }
    });

    $('#confirmDeleteBtn').on('click', function () {
        if (!serviceToDeleteId) return;

        const btn = $(this);

        UiUtils.setBtnLoading(btn, true, 'Deleting...');

        ApiClient.delete(`/admin/services/${serviceToDeleteId}`)
            .then(function (response) {
                UiUtils.showToast('Service deleted successfully', 'success');
                loadServices();
                $('#deleteModalOverlay').fadeOut(200);
            })
            .catch(function (xhr) {
                UiUtils.showToast('Failed to delete service', 'error');
            })
            .finally(function () {
                UiUtils.setBtnLoading(btn, false, 'Yes, Delete');
                serviceToDeleteId = null;
            });
    });

});
