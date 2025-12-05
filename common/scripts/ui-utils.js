/**
 * UI Utilities for Leirad Massage Frontend
 * Handles loading states, toasts, and common UI interactions.
 */

const UiUtils = {
    /**
     * Set button loading state
     * @param {HTMLElement|jQuery} btn - The button element
     * @param {boolean} isLoading - Whether to show loading state
     * @param {string} text - Loading text (default: 'Processing...')
     */
    setBtnLoading: function(btn, isLoading, text = 'Processing...') {
        const $btn = $(btn);
        
        if (isLoading) {
            $btn.prop('disabled', true);
            $btn.data('original-html', $btn.html());
            $btn.html(`
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <div class="loading-spinner"></div>
                    <span>${text}</span>
                </div>
            `);
        } else {
            $btn.prop('disabled', false);
            $btn.html($btn.data('original-html'));
        }
    },

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', 'info', 'warning'
     * @param {number} duration - Duration in ms (default: 3000)
     */
    showToast: function(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        
        const icons = {
            success: 'ri-checkbox-circle-fill',
            error: 'ri-error-warning-fill',
            warning: 'ri-alert-fill',
            info: 'ri-information-fill'
        };
        
        const colors = {
            success: '#48BB78',
            error: '#F56565',
            warning: '#ED8936',
            info: '#4299E1'
        };

        toast.style.cssText = `
            background: white;
            border-left: 4px solid ${colors[type]};
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            padding: 16px 20px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            transform: translateX(120%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'Manrope', sans-serif;
        `;

        toast.innerHTML = `
            <i class="${icons[type]}" style="color: ${colors[type]}; font-size: 1.25rem;"></i>
            <div style="color: #2D3748; font-weight: 500; font-size: 0.95rem;">${message}</div>
        `;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });

        // Remove after duration
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            toast.addEventListener('transitionend', () => {
                toast.remove();
                if (container.children.length === 0) {
                    container.remove();
                }
            });
        }, duration);
    },

    /**
     * Add CSS for spinner if not present
     */
    injectStyles: function() {
        if (!document.getElementById('ui-utils-styles')) {
            const style = document.createElement('style');
            style.id = 'ui-utils-styles';
            style.textContent = `
                .loading-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid currentColor;
                    border-right-color: transparent;
                    border-radius: 50%;
                    animation: spin 0.75s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }
};

// Initialize styles
UiUtils.injectStyles();
