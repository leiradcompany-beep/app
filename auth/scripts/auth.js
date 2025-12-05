const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000/api';
    } else {
        return 'https://itsolutions.muccsbblock1.com/cleaning_services/public/api';
    }
};

const API_BASE_URL = getApiBaseUrl();

// Toggle Password Visibility
function togglePw(inputId = 'password', iconId = 'toggleIcon') {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('ri-eye-off-line');
        icon.classList.add('ri-eye-line');
    } else {
        input.type = 'password';
        icon.classList.remove('ri-eye-line');
        icon.classList.add('ri-eye-off-line');
    }
}

// Login Handler
function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const email = $('input[type="email"]').val();
    const password = $('#password').val();

    // Loading State
    UiUtils.setBtnLoading(btn, true, 'Verifying...');

    $.ajax({
        url: `${API_BASE_URL}/login`,
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'Accept': 'application/json'
        },
        data: JSON.stringify({ email, password }),
        success: function (response) {
            if (response.success) {
                localStorage.setItem('auth_token', response.token);
                localStorage.setItem('user_data', JSON.stringify(response.user));

                UiUtils.showToast('Login successful! Redirecting...', 'success');

                setTimeout(() => {
                    // Redirect based on role
                    const role = response.user.role || 'customer';

                    // Clear pending service if not a customer
                    if (role !== 'customer') {
                        localStorage.removeItem('pendingServiceId');
                    }

                    window.location.href = `../../${role}/templates/dashboard.html`;
                }, 800);
            } else {
                UiUtils.showToast(response.message || 'Login failed', 'error');
                UiUtils.setBtnLoading(btn, false);
            }
        },
        error: function (xhr) {
            UiUtils.showToast(xhr.responseJSON?.message || 'Login failed. Please try again.', 'error');
            UiUtils.setBtnLoading(btn, false);
        }
    });
}

function resetBtn(btn, originalText) {
    UiUtils.setBtnLoading(btn, false);
}

// Preview ID Image
function previewImage(input, previewId, labelId) {
    const preview = document.getElementById(previewId);
    const label = document.getElementById(labelId);
    const file = input.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            // Hide icon and text
            label.querySelectorAll('i, span').forEach(el => el.style.display = 'none');
        }
        reader.readAsDataURL(file);
    } else {
        preview.src = "";
        preview.style.display = 'none';
        // Show icon and text
        label.querySelectorAll('i, span').forEach(el => el.style.display = 'block');
    }
}

// Validate Password Match
function validatePasswordMatch(form) {
    const password = form.querySelector('input[name="password"]').val();
    const confirm = form.querySelector('input[name="password_confirmation"]').val();

    if (password !== confirm) {
        UiUtils.showToast('Passwords do not match', 'error');
        return false;
    }
    return true;
}

// Register Handler
function handleRegister(e) {
    e.preventDefault();

    // Determine which form is being submitted
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');

    // Validate Password Match First
    const passwordInput = form.querySelector('input[name="password"]');
    const confirmInput = form.querySelector('input[name="password_confirmation"]');

    if (passwordInput && confirmInput && passwordInput.value !== confirmInput.value) {
        UiUtils.showToast('Passwords do not match', 'error');
        return;
    }

    // Gather form data
    const formData = new FormData(form);

    // Determine role based on form ID
    const role = form.id === 'cleanerRegisterForm' ? 'cleaner' : 'customer';
    formData.append('role', role);

    // Loading State
    UiUtils.setBtnLoading(btn, true, 'Creating Account...');

    // Convert FormData to JSON
    const data = Object.fromEntries(formData.entries());
    data.role = role;

    // Handle File Uploads if present (for Cleaners)
    // Since we are sending JSON, we can't send files directly this way.
    // We need to either use FormData directly (and change backend to accept it) or upload files first.
    // For simplicity and standard Laravel API handling, let's switch to sending FormData if it's a cleaner.

    let ajaxSettings = {
        url: `${API_BASE_URL}/register`,
        method: 'POST',
        headers: {
            'Accept': 'application/json'
        },
        success: function (response) {
            if (response.success) {
                // Both roles now require OTP verification
                UiUtils.showToast('Please verify your email', 'info');
                $('#otpModal').show();
                // Store email for OTP verification
                localStorage.setItem('pending_verification_email', data.email);
                // Store role to handle post-verification logic
                localStorage.setItem('pending_verification_role', role);
            } else {
                UiUtils.showToast(response.message || 'Registration failed', 'error');
                UiUtils.setBtnLoading(btn, false);
            }
        },
        error: function (xhr) {
            let msg = 'Registration failed';
            if (xhr.responseJSON) {
                if (xhr.responseJSON.errors) {
                    // Extract first error from the errors object
                    const errors = xhr.responseJSON.errors;
                    const firstKey = Object.keys(errors)[0];
                    msg = errors[firstKey][0];
                } else if (xhr.responseJSON.message) {
                    msg = xhr.responseJSON.message;
                }
            }
            UiUtils.showToast(msg, 'error');
            UiUtils.setBtnLoading(btn, false);
        }
    };

    // Combine names if backend expects 'name' field
    if (data.first_name && data.last_name) {
        data.name = `${data.first_name} ${data.middle_name ? data.middle_name + ' ' : ''}${data.last_name}`;
        formData.append('name', data.name); // Append to FormData as well
    }

    if (role === 'cleaner') {
        // Use FormData for file uploads
        ajaxSettings.data = formData;
        ajaxSettings.contentType = false; // Required for FormData
        ajaxSettings.processData = false; // Required for FormData
    } else {
        // Use JSON for customers (cleaner/lighter payload)
        ajaxSettings.data = JSON.stringify(data);
        ajaxSettings.contentType = 'application/json';
    }

    $.ajax(ajaxSettings);
}

// Forgot Password Flow
function handleResetRequest(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const email = $('#emailInput').val();

    UiUtils.setBtnLoading(btn, true, 'Sending...');

    $.ajax({
        url: `${API_BASE_URL}/forgot-password`,
        method: 'POST',
        contentType: 'application/json',
        headers: { 'Accept': 'application/json' },
        data: JSON.stringify({ email }),
        success: function (response) {
            if (response.success) {
                localStorage.setItem('reset_email', email);
                $('#resetFormWrapper').hide();
                $('#otpWrapper').show();
                UiUtils.showToast('OTP code sent to your email', 'success');
            } else {
                UiUtils.showToast(response.message || 'Request failed', 'error');
            }
        },
        error: function (xhr) {
            UiUtils.showToast(xhr.responseJSON?.message || 'Request failed', 'error');
        },
        complete: function () {
            UiUtils.setBtnLoading(btn, false, 'Send Verification Code');
        }
    });
}

function handleVerifyResetOtp(e) {
    e.preventDefault();
    const btn = document.getElementById('verifyBtn');
    const otp = $('#otpInput').val();
    const email = localStorage.getItem('reset_email');

    if (!email) {
        UiUtils.showToast('Session expired. Please start over.', 'error');
        setTimeout(() => window.location.reload(), 2000);
        return;
    }

    if (!otp || otp.trim().length !== 6) {
        UiUtils.showToast('Please enter a valid 6-digit OTP', 'warning');
        return;
    }

    UiUtils.setBtnLoading(btn, true, 'Verifying...');

    $.ajax({
        url: `${API_BASE_URL}/verify-otp`, // Reusing existing OTP verification or specific reset verify endpoint
        method: 'POST',
        contentType: 'application/json',
        headers: { 'Accept': 'application/json' },
        data: JSON.stringify({ email, otp }),
        success: function (response) {
            if (response.success) {
                $('#otpWrapper').hide();
                $('#newPasswordWrapper').show();
                // Store temp token if backend provides one, or rely on session/email
                if (response.token) localStorage.setItem('reset_token', response.token);
            } else {
                UiUtils.showToast(response.message || 'Invalid OTP', 'error');
            }
        },
        error: function (xhr) {
            UiUtils.showToast(xhr.responseJSON?.message || 'Verification failed', 'error');
        },
        complete: function () {
            UiUtils.setBtnLoading(btn, false, 'Verify Code');
        }
    });
}

function handleNewPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('resetBtn');
    const password = $('#newPassword').val();
    const confirm = $('#confirmNewPassword').val();
    const email = localStorage.getItem('reset_email');
    const token = localStorage.getItem('reset_token'); // If using token based reset

    if (!token) {
        UiUtils.showToast('Authentication token missing. Please verify OTP again.', 'error');
        return;
    }

    if (password !== confirm) {
        UiUtils.showToast('Passwords do not match', 'error');
        return;
    }

    if (password.length < 8) {
        UiUtils.showToast('Password must be at least 8 characters', 'warning');
        return;
    }

    UiUtils.setBtnLoading(btn, true, 'Resetting...');

    $.ajax({
        url: `${API_BASE_URL}/reset-password`,
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}` // If required, otherwise send email/otp again
        },
        data: JSON.stringify({ email, password, password_confirmation: confirm }),
        success: function (response) {
            if (response.success) {
                UiUtils.showToast('Password reset successfully! Please login.', 'success');
                // Clear temporary data
                localStorage.removeItem('reset_email');
                localStorage.removeItem('reset_token');

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                UiUtils.showToast(response.message || 'Reset failed', 'error');
            }
        },
        error: function (xhr) {
            UiUtils.showToast(xhr.responseJSON?.message || 'Reset failed', 'error');
        },
        complete: function () {
            UiUtils.setBtnLoading(btn, false, 'Reset Password');
        }
    });
}

// Role Selector Logic
$(document).ready(function () {
    $('.role-card').click(function () {
        $('.role-card').removeClass('active');
        $(this).addClass('active');
        const role = $(this).data('role');

        // Toggle Forms
        if (role === 'cleaner') {
            $('#customerFormContainer').hide();
            $('#cleanerFormContainer').show();
        } else {
            $('#cleanerFormContainer').hide();
            $('#customerFormContainer').show();
        }
    });
});

// OTP Handling
function handleVerifyOtp() {
    const otp = $('#otpInput').val();
    const email = localStorage.getItem('pending_verification_email');
    const btn = $('#verifyOtpBtn');

    if (!otp || otp.length !== 6) {
        UiUtils.showToast('Please enter a valid 6-digit OTP', 'warning');
        return;
    }

    UiUtils.setBtnLoading(btn, true, 'Verifying...');

    $.ajax({
        url: `${API_BASE_URL}/verify-otp`,
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'Accept': 'application/json'
        },
        data: JSON.stringify({ email, otp }),
        success: function (response) {
            if (response.success) {
                const role = localStorage.getItem('pending_verification_role');
                let msg = 'Email verified successfully! Please login.';

                if (role === 'cleaner') {
                    msg = 'Email verified! Application pending admin approval.';
                }

                UiUtils.showToast(msg, 'success');
                localStorage.removeItem('pending_verification_email');
                localStorage.removeItem('pending_verification_role');
                $('#otpModal').hide();

                // Redirect to login page
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, role === 'cleaner' ? 3000 : 1500);
            } else {
                UiUtils.showToast(response.message || 'Verification failed', 'error');
                UiUtils.setBtnLoading(btn, false, 'Verify OTP');
            }
        },
        error: function (xhr) {
            UiUtils.showToast(xhr.responseJSON?.message || 'Verification failed', 'error');
            UiUtils.setBtnLoading(btn, false, 'Verify OTP');
        }
    });
}

function handleResendOtp(e) {
    e.preventDefault();
    const email = localStorage.getItem('pending_verification_email');

    if (!email) return;

    $.ajax({
        url: `${API_BASE_URL}/resend-otp`,
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'Accept': 'application/json'
        },
        data: JSON.stringify({ email }),
        success: function (response) {
            UiUtils.showToast('OTP resent successfully', 'success');
        },
        error: function (xhr) {
            UiUtils.showToast('Failed to resend OTP', 'error');
        }
    });
}

// Attach OTP Listeners
$(document).ready(function () {
    $('#verifyOtpBtn').click(handleVerifyOtp);
    $('#resendOtpLink').click(handleResendOtp);
    $('#otpCloseBtn').on('click', function(){ $('#otpModal').hide(); });
    $('#otpInput').on('input', function(){ this.value = this.value.replace(/\D/g,'').slice(0,6); });
    $('#otpCloseForgot').on('click', function(){
        $('#otpWrapper').hide();
        $('#resetFormWrapper').show();
        $('#otpInput').val('');
    });
});
$(document).ready(function () {
    $('.social-btn').on('click', function () {
        const text = $(this).text().trim().toLowerCase();
        const provider = text.includes('google') ? 'Google' : (text.includes('facebook') ? 'Facebook' : 'Social');
        UiUtils.showToast(`${provider} login is not yet implemented. Please use email/password login.`, 'warning');
    });
});
