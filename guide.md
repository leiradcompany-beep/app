# Comprehensive Encryption & Data Protection Guide

## 1. System Architecture Overview

The Cleaning Services application employs a **Backend-centric Encryption Architecture**. This means all sensitive data encryption and decryption operations are strictly handled by the backend server. The frontend never possesses encryption keys or performs local AES decryption, which prevents reverse engineering and key exposure.

### Security Levels
1. **High Security (Two-Way Encryption):** Personal Identifiable Information (PII) stored in the database is encrypted at rest using AES-256-CBC.
2. **Maximum Security (One-Way Hashing):** User passwords are mathematically hashed using `bcrypt` and can never be reversed.
3. **Transport Security:** All client-server communication relies on HTTPS to protect data in transit. Authentication tokens are securely managed via Laravel Sanctum.

### Key Management
- **Master Key:** The entire AES-256-CBC encryption system relies on the `APP_KEY` stored securely in the backend's `.env` file.
- **Key Location:** `Backend/config/app.php` references `env('APP_KEY')`.
- **Security Rule:** If the `APP_KEY` is lost or changed without a migration script, all encrypted database fields become permanently unreadable.

---

## 2. Database Field Encryption (Data at Rest)

The system automatically encrypts specific database fields before they are saved and decrypts them when they are retrieved.

### The Encryption Engine
- **File:** [EncryptsAttributes.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Traits/EncryptsAttributes.php#L32-L127)
- **Algorithm:** AES-256-CBC via Laravel's `Crypt` facade.
- **Mechanism:** The trait overrides Eloquent's `setAttribute()` to intercept and encrypt data using `Crypt::encryptString()`, and `getAttribute()` to decrypt data using `Crypt::decryptString()`.

**Code Snippet:**
```php
// Backend/app/Traits/EncryptsAttributes.php (Lines 43-60)
public function setAttribute($key, $value)
{
    if (in_array($key, $this->encryptedAttributes ?? [])) {
        if ($value !== null && $value !== '') {
            try {
                $value = Crypt::encryptString($value);
            } catch (\Exception $e) {
                \Log::error('Failed to encrypt attribute', [...]);
            }
        }
    }
    return parent::setAttribute($key, $value);
}
```

### Encrypted Models & Fields (Database Columns & Form Textfields)

The following models use the `EncryptsAttributes` trait. Below is the exact mapping of which database columns are encrypted and which frontend form textfields they correspond to.

#### A. User Model
- **File:** [User.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Models/User.php#L60-L64)
- **Trait Used:** `use App\Traits\EncryptsAttributes;`

**Encrypted Database Columns:**
1. **`name`**
   - **Frontend Textfields:** "First Name", "Middle Name", "Last Name" inputs on registration and admin "Add User" forms.
   - **Data Stored:** Full Name (PII).
2. **`phone`**
   - **Frontend Textfields:** "Phone Number" input in profile settings and admin user management forms.
   - **Data Stored:** User's contact number (PII).
3. **`address`**
   - **Frontend Textfields:** "Address" input in user profile and admin user management forms.
   - **Data Stored:** Physical location data (PII).

**Code Snippet:**
```php
// Backend/app/Models/User.php
protected $encryptedAttributes = [
    'name',      // Full name (PII)
    'phone',     // Contact information (PII)
    'address',   // Location data (PII)
];
```
- *Note:* The `email` field is deliberately kept unencrypted to allow fast SQL `WHERE` lookups during authentication.

#### B. Booking Model
- **File:** [Booking.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Models/Booking.php#L34-L38)
- **Trait Used:** `use App\Traits\EncryptsAttributes;`

**Encrypted Database Columns:**
1. **`phone_number`**
   - **Frontend Textfields:** "Phone Number" input in the customer checkout/booking form.
   - **Data Stored:** Contact number used specifically for the booked service.
2. **`address`**
   - **Frontend Textfields:** "Service Address" input in the customer checkout/booking form.
   - **Data Stored:** The physical location where the cleaning service will be performed.

**Code Snippet:**
```php
// Backend/app/Models/Booking.php
protected $encryptedAttributes = [
    'phone_number',  // Contact information
    'address',       // Location data
];
```

---

## 3. Password Hashing (One-Way Encryption)

Passwords are never stored in plain text or using two-way encryption. They are securely hashed so that even database administrators cannot read them.

- **Algorithm:** `bcrypt`
- **Mechanism:** Laravel's `Hash::make()` and `Hash::check()`

### Implementations

#### A. User Registration & Password Reset
- **File:** [AuthController.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Http/Controllers/AuthController.php)
- **Registration Flow:**
  ```php
  // AuthController.php - Line 70
  'password' => Hash::make($request->password),
  ```
- **Reset Flow:**
  ```php
  // AuthController.php - Line 518
  $user->password = Hash::make($request->password);
  ```

#### B. Profile Password Update
- **File:** [SettingController.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Http/Controllers/SettingController.php#L137-L142)
- **Flow:** Verifies the current password using `Hash::check()`, then updates it using `Hash::make()`.

---

## 4. API Payload Encryption Utility (Admin Tool)

Administrators have access to a dedicated tool to manually encrypt or decrypt specific text payloads. This is useful for migrating old data or debugging without exposing the backend keys.

### Backend Controller
- **File:** [EncryptionController.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Http/Controllers/EncryptionController.php#L24-L90)
- **Endpoints:**
  - `POST /api/encrypt`: Encrypts a string (max 1000 chars, rate-limited to 30/min).
  - `POST /api/decrypt`: Decrypts an AES-256-CBC payload (rate-limited to 20/min).
- **Security:** Protected by Sanctum middleware. Only authenticated admins can utilize these routes.

**Code Snippet (Decryption Endpoint):**
```php
// Backend/app/Http/Controllers/EncryptionController.php
public function decrypt(Request $request)
{
    $validated = $request->validate(['encrypted' => 'required|string']);
    try {
        $decrypted = Crypt::decryptString($validated['encrypted']);
        return response()->json([
            'success' => true,
            'decrypted' => $decrypted,
            'message' => 'Data decrypted successfully',
        ]);
    } catch (DecryptException $e) {
        // ...
    }
}
```

### Frontend Interface (Encryption Tool)
- **UI File:** [encryption.html](file:///c:/xampp/htdocs/cleaning_services/Frontend/admin/templates/encryption.html)
- **Logic File:** [encryption-tool.js](file:///c:/xampp/htdocs/cleaning_services/Frontend/admin/scripts/encryption-tool.js)
- **Data Flow:** The frontend securely transmits the plain text or ciphertext to the backend API, receives the processed result, and displays it. No `CryptoJS` or local encryption algorithms are used.

**Frontend Encryption/Decryption Functions (`encryption-tool.js`):**
1. **`encryptData()`** ([Link](file:///c:/xampp/htdocs/cleaning_services/Frontend/admin/scripts/encryption-tool.js#L87-L133)): Captures plain text input from `#encryptInput` and sends it via POST to the backend `/api/encrypt` endpoint.
2. **`decryptData()`** ([Link](file:///c:/xampp/htdocs/cleaning_services/Frontend/admin/scripts/encryption-tool.js#L138-L182)): Captures ciphertext from `#decryptInput` and sends it via POST to the backend `/api/decrypt` endpoint.

**Code Snippet (Frontend API call):**
```javascript
// Frontend/admin/scripts/encryption-tool.js
function decryptData() {
    var input = document.getElementById('decryptInput').value.trim();
    
    fetch(API_BASE_URL + '/decrypt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ encrypted: input })
    })
    .then(function(response) { return response.json(); })
    .then(function(result) {
        document.getElementById('decryptedOutput').value = result.decrypted;
    })
    // ...
}
```

---

## 5. Frontend Data Handling & Decryption Flow

Since encrypted database fields (like `name` and `address`) cannot be natively read by the frontend, the backend explicitly decrypts them before transmitting JSON responses.

### Implementation Examples
- **Customer Dashboard:** [CustomerDashboardController.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Http/Controllers/CustomerDashboardController.php#L168-L172) explicitly accesses fields like `$user->name` and `$booking->address`, which triggers the `EncryptsAttributes` trait to return plain text to the JSON payload.
- **Cleaner Dashboard:** [CleanerDashboardController.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Http/Controllers/CleanerDashboardController.php) does the same for jobs, ensuring that the cleaner sees decrypted customer names and addresses.
- **Admin Dashboard:** [AdminDashboardController.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Http/Controllers/AdminDashboardController.php#L69-L86) decrypts the client names in bookings and user names in notifications.
- **User Management:** [UserController.php](file:///c:/xampp/htdocs/cleaning_services/Backend/app/Http/Controllers/UserController.php#L27-L33) explicitly decrypts user fields like `name`, `email`, `phone`, and `address` when listing users for the admin dashboard.
- **Frontend Receipt:** The frontend receives the decrypted data over an HTTPS connection and injects it directly into the DOM (e.g., `dashboard.html`).

---

## 6. Session & Token Protection

While not encryption in the traditional sense, token protection is a crucial part of the data security lifecycle.

- **Mechanism:** Laravel Sanctum generates secure API tokens upon successful login.
- **Storage:** The frontend stores these tokens in `localStorage` or `sessionStorage` (e.g., `auth_token`).
- **File Reference:** [auth.js](file:///c:/xampp/htdocs/cleaning_services/Frontend/auth/scripts/auth.js) and [api-client.js](file:///c:/xampp/htdocs/cleaning_services/Frontend/common/scripts/api-client.js).
- **Security Context:** Since `localStorage` is vulnerable to XSS, the application relies on strict backend CORS policies, HTTPS enforcement, and Turnstile (Cloudflare) verification to mitigate unauthorized access or token theft.
