/**
 * API Client Utility
 * Centralizes API requests with automatic token injection and error handling.
 */

const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000/api';
    } else {
        return 'https://itsolutions.muccsbblock1.com/cleaning_services/public/api';
    }
};

const API_BASE_URL = getApiBaseUrl();

const ApiClient = {
    /**
     * Generic request handler
     */
    request: function (endpoint, method = 'GET', data = null, contentType = 'application/json') {
        const token = localStorage.getItem('auth_token');

        // Redirect to login if no token found (except for public pages)
        if (!token && !window.location.href.includes('login.html') && !window.location.href.includes('register.html')) {
            window.location.href = '../../auth/templates/login.html';
            return Promise.reject('No token found');
        }

        const config = {
            url: `${API_BASE_URL}${endpoint}`,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            dataType: 'json',
        };

        if (data) {
            if (contentType === 'application/json') {
                config.data = JSON.stringify(data);
                config.contentType = 'application/json';
            } else if (contentType === false) {
                // For FormData (file uploads)
                config.data = data;
                config.contentType = false;
                config.processData = false;
            } else {
                config.data = data;
                config.contentType = contentType;
            }
        }

        // Return a native Promise to ensure .finally() support across all environments
        return new Promise((resolve, reject) => {
            $.ajax(config)
                .done((response) => {
                    resolve(response);
                })
                .fail((xhr) => {
                    // Handle 401 Unauthorized globally
                    if (xhr.status === 401) {
                        console.warn('Session expired or unauthorized. Redirecting to login.');
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('user_data');
                        window.location.href = '../../auth/templates/login.html';
                    }
                    reject(xhr);
                });
        });
    },

    get: function (endpoint) {
        return this.request(endpoint, 'GET');
    },

    post: function (endpoint, data) {
        return this.request(endpoint, 'POST', data);
    },

    postFormData: function (endpoint, formData) {
        return this.request(endpoint, 'POST', formData, false);
    },

    put: function (endpoint, data) {
        return this.request(endpoint, 'PUT', data);
    },

    delete: function (endpoint) {
        return this.request(endpoint, 'DELETE');
    }
};

// Expose globally
window.ApiClient = ApiClient;
window.API_BASE_URL = API_BASE_URL;
