/**
 * Encryption Tool - Admin Panel Integration
 * 
 * ADMIN-ONLY ACCESS: This tool is restricted to administrators
 * 
 * SECURITY NOTES:
 * - Never store or handle encryption keys in frontend code
 * - All encryption/decryption happens on the backend
 * - Always use HTTPS in production
 * - Authentication tokens must be stored securely
 * - Only admin users should have access to this tool
 * 
 * IMPORTANT: Frontend decryption is INSECURE because:
 * 1. JavaScript code is visible to users
 * 2. Encryption keys would be exposed
 * 3. Vulnerable to reverse engineering
 * 4. No secure key storage mechanism in browsers
 * 
 * NOTE: Uses API_BASE_URL from api-client.js (loaded before this script)
 */

/**
 * Verify admin authentication before allowing access
 */
function verifyAdminAccess() {
    var token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    if (!token) {
        window.location.href = '../../auth/templates/login.html';
        return false;
    }
    
    // Check admin role using the same method as admin-sidebar.js
    var userRole = localStorage.getItem('user_role');
    
    // Fallback: try getting role from user_data object
    if (!userRole) {
        var userDataString = localStorage.getItem('user_data');
        if (userDataString) {
            try {
                var user = JSON.parse(userDataString);
                userRole = user.role;
            } catch (e) {
                console.warn('Failed to parse user_data for role check');
            }
        }
    }
    
    // Additional fallback: try 'user' key
    if (!userRole) {
        var userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
            try {
                var userData = JSON.parse(userStr);
                userRole = userData.role;
            } catch (e) {
                console.warn('Failed to parse user for role check');
            }
        }
    }
    
    if (userRole !== 'admin') {
        alert('Access Denied: This tool is restricted to administrators only.\n\nYour role: ' + (userRole || 'Unknown') + '\nRequired role: admin');
        window.location.href = 'dashboard.html';
        return false;
    }
    
    return true;
}

/**
 * Get authentication headers for API requests
 */
function getAuthHeaders() {
    var token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    if (!token) {
        throw new Error('Authentication required. Please login first.');
    }

    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + token
    };
}

/**
 * Encrypt data by sending it to the Laravel backend
 */
function encryptData() {
    var input = document.getElementById('encryptInput').value.trim();
    
    if (!input) {
        showError('Please enter text to encrypt');
        return;
    }

    if (input.length > 1000) {
        showError('Text must be 1000 characters or less');
        return;
    }

    hideResult('encryptResult');
    hideError();
    showLoading(true);

    fetch(API_BASE_URL + '/encrypt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: input })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (!result.encrypted) {
            throw new Error(result.message || 'No encrypted data received');
        }
        document.getElementById('encryptedOutput').value = result.encrypted;
        showResult('encryptResult');
    })
    .catch(function(error) {
        console.error('Encryption error:', error);
        if (error.message && error.message.includes('Failed to fetch')) {
            showError('Cannot connect to server. Please check your internet connection and API URL.');
        } else {
            showError(error.message || 'Failed to encrypt data');
        }
    })
    .finally(function() {
        showLoading(false);
    });
}

/**
 * Decrypt data by sending it to the Laravel backend
 */
function decryptData() {
    var input = document.getElementById('decryptInput').value.trim();
    var appKey = document.getElementById('decryptAppKey').value.trim();
    
    if (!appKey) {
        showError('Please enter the App Key for security verification');
        return;
    }
    
    if (!input) {
        showError('Please enter encrypted text');
        return;
    }

    if (input.length < 20) {
        showError('Invalid encrypted text format. Text too short.');
        return;
    }

    hideResult('decryptResult');
    hideError();
    showLoading(true);

    fetch(API_BASE_URL + '/decrypt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
            encrypted: input,
            app_key: appKey
        })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (result.decrypted === undefined || result.decrypted === null) {
            throw new Error(result.message || 'No decrypted data received');
        }
        document.getElementById('decryptedOutput').value = result.decrypted;
        showResult('decryptResult');
    })
    .catch(function(error) {
        console.error('Decryption error:', error);
        if (error.message && error.message.includes('Failed to fetch')) {
            showError('Cannot connect to server. Please check your internet connection and API URL.');
        } else {
            showError(error.message || 'Failed to decrypt data');
        }
    })
    .finally(function() {
        showLoading(false);
    });
}

/**
 * Copy text to clipboard from a textarea element
 */
function copyToClipboard(elementId) {
    var textarea = document.getElementById(elementId);
    
    if (!textarea) {
        showError('Element not found');
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textarea.value)
            .then(function() {
                showTemporaryMessage('Copied to clipboard!', 'success');
            })
            .catch(function(err) {
                console.error('Failed to copy:', err);
                fallbackCopyToClipboard(textarea);
            });
    } else {
        fallbackCopyToClipboard(textarea);
    }
}

/**
 * Fallback copy method for older browsers
 */
function fallbackCopyToClipboard(textarea) {
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    try {
        document.execCommand('copy');
        showTemporaryMessage('Copied to clipboard!', 'success');
    } catch (err) {
        showError('Failed to copy to clipboard');
    }
}

/**
 * Show a temporary success message
 */
function showTemporaryMessage(message, type) {
    if (!type) type = 'success';
    var messageEl = document.createElement('div');
    messageEl.className = 'temp-message ' + type;
    messageEl.textContent = message;
    var bgColor = type === 'success' ? '#4CAF50' : '#f44336';
    messageEl.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 12px 24px; background: ' + bgColor + '; color: white; border-radius: 4px; z-index: 10000;';
    
    document.body.appendChild(messageEl);
    
    setTimeout(function() {
        messageEl.remove();
    }, 2000);
}

/**
 * UI Helper Functions
 */
function showLoading(show) {
    var loadingEl = document.getElementById('loading');
    if (show) {
        loadingEl.classList.remove('hidden');
    } else {
        loadingEl.classList.add('hidden');
    }
}

function showError(message) {
    var errorEl = document.getElementById('error');
    var errorMessageEl = document.getElementById('errorMessage');
    
    errorMessageEl.textContent = message;
    errorEl.classList.remove('hidden');
    
    setTimeout(function() {
        hideError();
    }, 5000);
}

function hideError() {
    var errorEl = document.getElementById('error');
    errorEl.classList.add('hidden');
}

function showResult(elementId) {
    var element = document.getElementById(elementId);
    element.classList.remove('hidden');
}

function hideResult(elementId) {
    var element = document.getElementById(elementId);
    element.classList.add('hidden');
}

/**
 * Character counter for encryption input
 */
document.addEventListener('DOMContentLoaded', function() {
    if (!verifyAdminAccess()) {
        return;
    }

    var encryptInput = document.getElementById('encryptInput');
    var charCount = document.getElementById('encryptCharCount');
    
    if (encryptInput && charCount) {
        encryptInput.addEventListener('input', function() {
            var length = this.value.length;
            charCount.textContent = length + '/1000';
            
            if (length > 900) {
                charCount.style.color = '#f44336';
            } else if (length > 700) {
                charCount.style.color = '#ff9800';
            } else {
                charCount.style.color = '#666';
            }
        });
    }
});

/**
 * Add keyboard shortcuts
 * Ctrl/Cmd + Enter to submit
 */
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var activeElement = document.activeElement;
        
        if (activeElement.id === 'encryptInput') {
            e.preventDefault();
            encryptData();
        } else if (activeElement.id === 'decryptInput') {
            e.preventDefault();
            decryptData();
        }
    }
});
