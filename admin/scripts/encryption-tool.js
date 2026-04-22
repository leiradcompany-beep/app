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
 */

// IMPORTANT: Update this URL to your actual Laravel backend URL
// For production (Hostinger): https://your-laravel-domain.com/api
// For development (Local): http://localhost:8000/api
const API_BASE_URL = 'https://itsolutions.muccsbblock1.com/cleaning_services/public/api'';

/**
 * Verify admin authentication before allowing access
 */
function verifyAdminAccess() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    if (!token) {
        window.location.href = '/auth/templates/login.html'; // Redirect to login
        return false;
    }
    
    // Verify user is admin
    const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
    if (user.role !== 'admin') {
        alert('Access Denied: This tool is restricted to administrators only.');
        window.location.href = '/admin/templates/dashboard.html'; // Redirect to dashboard
        return false;
    }
    
    return true;
}

/**
 * Get authentication headers for API requests
 */
async function getAuthHeaders() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    if (!token) {
        throw new Error('Authentication required. Please login first.');
    }

    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}

/**
 * Encrypt data by sending it to the Laravel backend
 */
async function encryptData() {
    const input = document.getElementById('encryptInput').value.trim();
    
    if (!input) {
        showError('Please enter text to encrypt');
        return;
    }

    // Clear previous results
    hideResult('encryptResult');
    hideError();
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE_URL}/encrypt`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ data: input }),
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Encryption failed');
        }

        // Display encrypted result
        document.getElementById('encryptedOutput').value = result.encrypted;
        showResult('encryptResult');
        
    } catch (error) {
        console.error('Encryption error:', error);
        showError(error.message || 'Failed to encrypt data');
    } finally {
        showLoading(false);
    }
}

/**
 * Decrypt data by sending it to the Laravel backend
 */
async function decryptData() {
    const input = document.getElementById('decryptInput').value.trim();
    
    if (!input) {
        showError('Please enter encrypted text');
        return;
    }

    // Clear previous results
    hideResult('decryptResult');
    hideError();
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE_URL}/decrypt`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ encrypted: input }),
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Decryption failed');
        }

        // Display decrypted result
        document.getElementById('decryptedOutput').value = result.decrypted;
        showResult('decryptResult');
        
    } catch (error) {
        console.error('Decryption error:', error);
        showError(error.message || 'Failed to decrypt data');
    } finally {
        showLoading(false);
    }
}

/**
 * Copy text to clipboard from a textarea element
 */
function copyToClipboard(elementId) {
    const textarea = document.getElementById(elementId);
    
    if (!textarea) {
        showError('Element not found');
        return;
    }

    // Modern clipboard API (preferred)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textarea.value)
            .then(() => {
                showTemporaryMessage('Copied to clipboard!', 'success');
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                fallbackCopyToClipboard(textarea);
            });
    } else {
        // Fallback for older browsers
        fallbackCopyToClipboard(textarea);
    }
}

/**
 * Fallback copy method for older browsers
 */
function fallbackCopyToClipboard(textarea) {
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices
    
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
function showTemporaryMessage(message, type = 'success') {
    const messageEl = document.createElement('div');
    messageEl.className = `temp-message ${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => messageEl.remove(), 300);
    }, 2000);
}

/**
 * UI Helper Functions
 */
function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    if (show) {
        loadingEl.classList.remove('hidden');
    } else {
        loadingEl.classList.add('hidden');
    }
}

function showError(message) {
    const errorEl = document.getElementById('error');
    const errorMessageEl = document.getElementById('errorMessage');
    
    errorMessageEl.textContent = message;
    errorEl.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

function hideError() {
    const errorEl = document.getElementById('error');
    errorEl.classList.add('hidden');
}

function showResult(elementId) {
    const element = document.getElementById(elementId);
    element.classList.remove('hidden');
}

function hideResult(elementId) {
    const element = document.getElementById(elementId);
    element.classList.add('hidden');
}

/**
 * Character counter for encryption input
 */
document.addEventListener('DOMContentLoaded', function() {
    // Verify admin access on page load
    if (!verifyAdminAccess()) {
        return;
    }

    const encryptInput = document.getElementById('encryptInput');
    const charCount = document.getElementById('encryptCharCount');
    
    if (encryptInput && charCount) {
        encryptInput.addEventListener('input', function() {
            const length = this.value.length;
            charCount.textContent = `${length}/1000`;
            
            // Visual feedback when approaching limit
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
        const activeElement = document.activeElement;
        
        if (activeElement.id === 'encryptInput') {
            e.preventDefault();
            encryptData();
        } else if (activeElement.id === 'decryptInput') {
            e.preventDefault();
            decryptData();
        }
    }
});
