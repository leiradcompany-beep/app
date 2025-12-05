/**
 * Image URL Utility
 * Provides consistent image URL handling across the frontend
 */

const ImageUtils = {
    // Server URL configuration
    SERVER_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:8000'
        : 'https://itsolutions.muccsbblock1.com/cleaning_services/public',

    /**
     * Get the full URL for an image path
     * @param {string|null} imagePath - Image path from backend
     * @param {string} defaultImage - Default image to use if path is invalid
     * @returns {string} - Full image URL
     */
    getImageUrl(imagePath, defaultImage = '../../assets/images/default-avatar.png') {
        // If no image path, return default
        if (!imagePath || imagePath === 'null' || imagePath.trim() === '') {
            return defaultImage;
        }

        // If already a full URL or data URI, return as is
        if (imagePath.startsWith('http://') ||
            imagePath.startsWith('https://') ||
            imagePath.startsWith('data:')) {
            return imagePath;
        }

        // If starts with /storage/, construct full URL
        if (imagePath.startsWith('/storage/')) {
            return `${this.SERVER_URL}${imagePath}`;
        }

        // If starts with storage/ (without leading slash)
        if (imagePath.startsWith('storage/')) {
            return `${this.SERVER_URL}/${imagePath}`;
        }

        // If it's a relative assets path
        if (imagePath.startsWith('assets/')) {
            return `../../${imagePath}`;
        }

        // If it starts with ../../, assume it's already a relative path
        if (imagePath.startsWith('../../')) {
            return imagePath;
        }

        // If it starts with ./ or ../, return as is (relative)
        if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
            return imagePath;
        }

        // Fallback for storage paths missing the prefix (e.g. "avatars/user.jpg")
        return `${this.SERVER_URL}/storage/${imagePath}`;
    },

    /**
     * Get service image URL with specific default
     * @param {string|null} imagePath - Image path from backend
     * @returns {string} - Full image URL
     */
    getServiceImageUrl(imagePath) {
        return this.getImageUrl(imagePath, '../../assets/images/default-service.png');
    },

    /**
     * Get avatar URL with specific default
     * Handles both 'avatar' and 'img' field names
     * @param {string|object|null} imagePathOrUser - Image path string OR user/cleaner object
     * @returns {string} - Full image URL
     */
    getAvatarUrl(imagePathOrUser) {
        // If it's an object (user/cleaner), try to get the image path from it
        if (imagePathOrUser && typeof imagePathOrUser === 'object') {
            const imagePath = imagePathOrUser.avatar || imagePathOrUser.img || imagePathOrUser.profile_photo_path;
            return this.getImageUrl(imagePath, '../../assets/images/default-avatar.png');
        }
        // Otherwise treat it as a string path
        return this.getImageUrl(imagePathOrUser, '../../assets/images/default-avatar.png');
    },

    /**
     * Add cache-busting timestamp to image URL
     * @param {string} imageUrl - Image URL
     * @returns {string} - Image URL with timestamp
     */
    withCacheBust(imageUrl) {
        // Don't add cache bust to data URIs or default images
        if (imageUrl.startsWith('data:') || imageUrl.includes('default-')) {
            return imageUrl;
        }

        const separator = imageUrl.includes('?') ? '&' : '?';
        return `${imageUrl}${separator}t=${new Date().getTime()}`;
    },

    /**
     * Handle image load error with fallback
     * @param {HTMLImageElement} imgElement - Image element
     * @param {string} fallbackSrc - Fallback image source
     */
    handleImageError(imgElement, fallbackSrc = '../../assets/images/default-avatar.png') {
        if (imgElement.src !== fallbackSrc) {
            imgElement.src = fallbackSrc;
            imgElement.style.objectFit = 'cover';
            imgElement.style.backgroundColor = '#f8fafc';
        }
    },

    /**
     * Preload an image with fallback
     * @param {string} imagePath - Image path
     * @param {function} onSuccess - Success callback
     * @param {function} onError - Error callback
     */
    preloadImage(imagePath, onSuccess, onError) {
        const img = new Image();
        img.onload = () => onSuccess && onSuccess(img);
        img.onerror = () => onError && onError();
        img.src = this.getImageUrl(imagePath);
    }
};

// Make it globally available
if (typeof window !== 'undefined') {
    window.ImageUtils = ImageUtils;
}
