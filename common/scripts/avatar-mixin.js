/**
 * Avatar Display Mixin
 * Add this to all dashboard scripts to ensure proper avatar display
 */

const AvatarMixin = {
    /**
     * Initialize avatar display for the current user
     * @param {Object} user - User object with avatar property
     * @param {string} sidebarImgSelector - jQuery selector for sidebar image
     * @param {string} mainImgSelector - jQuery selector for main profile image
     */
    initUserAvatar(user, sidebarImgSelector = '#sidebar-img', mainImgSelector = '#main-profile-img') {
        const avatarUrl = ImageUtils.getAvatarUrl(user.avatar);
        const cacheBustedUrl = ImageUtils.withCacheBust(avatarUrl);

        // Update sidebar avatar
        $(sidebarImgSelector)
            .attr('src', cacheBustedUrl)
            .off('error')
            .on('error', function () {
                ImageUtils.handleImageError(this);
            });

        // Update main profile avatar if it exists
        if ($(mainImgSelector).length) {
            $(mainImgSelector)
                .attr('src', cacheBustedUrl)
                .off('error')
                .on('error', function () {
                    ImageUtils.handleImageError(this);
                });
        }
    },

    /**
     * Update avatar after upload
     * @param {string} newAvatarPath - New avatar path from API response
     * @param {string} sidebarImgSelector - jQuery selector for sidebar image
     * @param {string} mainImgSelector - jQuery selector for main profile image
     */
    updateAvatarAfterUpload(newAvatarPath, sidebarImgSelector = '#sidebar-img', mainImgSelector = '#main-profile-img') {
        const avatarUrl = ImageUtils.getAvatarUrl(newAvatarPath);
        const cacheBustedUrl = ImageUtils.withCacheBust(avatarUrl);

        // Update both images
        $(sidebarImgSelector).attr('src', cacheBustedUrl);
        $(mainImgSelector).attr('src', cacheBustedUrl);

        // Update localStorage
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        userData.avatar = newAvatarPath;
        localStorage.setItem('user_data', JSON.stringify(userData));
    },

    /**
     * Display avatar in a table or list
     * @param {string} avatarPath - Avatar path from API
     * @param {string} altText - Alt text for the image
     * @param {string} cssClasses - Optional CSS classes
     * @returns {string} HTML string for the avatar img tag
     */
    renderAvatarHtml(avatarPath, altText = 'User Avatar', cssClasses = '') {
        const avatarUrl = ImageUtils.getAvatarUrl(avatarPath);
        return `<img src="${avatarUrl}" alt="${altText}" class="${cssClasses}" onerror="ImageUtils.handleImageError(this)">`;
    },

    /**
     * Render service image HTML
     * @param {string} imagePath - Service image path from API
     * @param {string} altText - Alt text for the image
     * @param {string} cssClasses - Optional CSS classes
     * @returns {string} HTML string for the service img tag
     */
    renderServiceImageHtml(imagePath, altText = 'Service', cssClasses = '') {
        const imageUrl = ImageUtils.getServiceImageUrl(imagePath);
        return `<img src="${imageUrl}" alt="${altText}" class="${cssClasses}" onerror="ImageUtils.handleImageError(this, '../../assets/images/default-service.png')">`;
    }
};

// Make it globally available
if (typeof window !== 'undefined') {
    window.AvatarMixin = AvatarMixin;
}
