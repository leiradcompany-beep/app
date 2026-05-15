# 🔐 Encryption & Data Protection Guide

> A complete reference for how sensitive data is secured across the Cleaning Services application — from the database to the browser.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [The Core Encryption Engine](#the-core-encryption-engine)
- [Password Hashing](#password-hashing)
- [Admin Encryption Tool](#admin-encryption-tool)
- [Frontend Data Flow](#frontend-data-flow)
- [Session & Token Protection](#session--token-protection)
- [Scope & Coverage](#scope--coverage)

---

## Architecture Overview

The application uses a **Backend-centric Encryption Architecture** — all encryption and decryption happens exclusively on the server. The frontend never holds encryption keys or runs decryption logic locally, which eliminates the risk of key exposure through reverse engineering.

### Security Layers at a Glance

| Layer | Method | Purpose |
|---|---|---|
| **PII at Rest** | AES-256-CBC | Encrypts personal data stored in the database |
| **Passwords** | bcrypt (one-way) | Hashes passwords so they can never be recovered |
| **Data in Transit** | HTTPS | Protects all client-server communication |
| **API Auth** | Laravel Sanctum | Manages secure authentication tokens |

### Master Key

The entire AES-256-CBC system is anchored to the `APP_KEY` in the backend's `.env` file.

```
Backend/config/app.php  →  env('APP_KEY')
```

> ⚠️ **Critical:** If `APP_KEY` is lost or rotated without a migration script, all encrypted database fields become permanently unreadable.

---

## The Core Encryption Engine

The absolute core of the entire encryption and decryption system is the **`EncryptsAttributes`** trait. This single file acts as the universal bridge between the application models and the MySQL database.

It automatically **intercepts data before saving** (encrypting it) and **intercepts data when retrieved** (decrypting it) — completely transparently to the rest of the application.

**File:** `Backend/app/Traits/EncryptsAttributes.php`  
**Algorithm:** AES-256-CBC via Laravel's `Crypt` facade

```php
// Encryption — fires on setAttribute() before writing to MySQL
public function setAttribute($key, $value)
{
    if (in_array($key, $this->encryptedAttributes ?? [])) {
        if ($value !== null && $value !== '') {
            try {
                $value = Crypt::encryptString($value); // Core Encryption Action
            } catch (\Exception $e) {
                \Log::error('Failed to encrypt attribute', [...]);
            }
        }
    }
    return parent::setAttribute($key, $value);
}

// Decryption — fires on getAttribute() before returning to the controller
public function getAttribute($key)
{
    $value = parent::getAttribute($key);

    if (in_array($key, $this->encryptedAttributes ?? [])) {
        if ($value !== null && $value !== '') {
            try {
                $value = Crypt::decryptString($value); // Core Decryption Action
            } catch (DecryptException $e) {
                return '[Decryption Failed]';
            }
        }
    }

    return $value;
}
```

### How the Core Connects to the Codebase

```
Frontend Form Input
       ↓
Controller (e.g. UserController)
       ↓
Model setAttribute()  ←  EncryptsAttributes trait encrypts here
       ↓
MySQL Database (stores ciphertext)
       ↓
Model getAttribute()  ←  EncryptsAttributes trait decrypts here
       ↓
Controller bundles plain text → JSON response
       ↓
Frontend UI (dashboard.html, users.html, etc.)
```

**Storing Data (Encryption via Controller)**

```php
// Backend/app/Http/Controllers/UserController.php
// 'name', 'phone', and 'address' are automatically encrypted by the trait before hitting the database
$user = User::create([
    'name'     => $validated['name'],
    'email'    => $validated['email'],
    'password' => Hash::make($validated['password']),
    'phone'    => $validated['phone'] ?? null,
    'address'  => $validated['address'] ?? null,
]);
```

**Fetching Data (Decryption before Frontend Display)**

```php
// Backend/app/Http/Controllers/CustomerDashboardController.php
// Accessing these properties triggers the trait to decrypt the MySQL ciphertext into plain text
$userName    = $user->name;
$userPhone   = $user->phone ?? '';
$userAddress = $user->address ?? '';

// Bundling decrypted data into the JSON response for the frontend
$userData = [
    'firstName' => $firstName,
    'lastName'  => $lastName,
    'phone'     => $userPhone,
    'address'   => $userAddress,
];
return response()->json(['success' => true, 'data' => ['user' => $userData]]);
```

---

### Encrypted Models & Fields

#### User Model
**File:** `Backend/app/Models/User.php`

```php
protected $encryptedAttributes = [
    'name',     // Full name (PII)
    'phone',    // Contact number (PII)
    'address',  // Physical location (PII)
];
```

| Database Column | Frontend Form Field | Data Stored |
|---|---|---|
| `name` | First / Middle / Last Name inputs (registration & admin forms) | Full name |
| `phone` | Phone Number input (profile settings & user management) | Contact number |
| `address` | Address input (profile & user management) | Physical location |

> 📌 **Note:** `email` is intentionally left unencrypted to allow fast SQL `WHERE` lookups during authentication.

#### Booking Model
**File:** `Backend/app/Models/Booking.php`

```php
protected $encryptedAttributes = [
    'phone_number', // Contact information
    'address',      // Service location
];
```

| Database Column | Frontend Form Field | Data Stored |
|---|---|---|
| `phone_number` | Phone Number (checkout/booking form) | Contact number for the booking |
| `address` | Service Address (checkout/booking form) | Where cleaning will be performed |

---

## Password Hashing

Passwords are **never stored in plain text** or with reversible encryption. bcrypt produces a one-way hash that cannot be recovered — even by a database administrator.

**Methods used:** `Hash::make()` to hash, `Hash::check()` to verify

### Implementation Points

| Location | File | What Happens |
|---|---|---|
| User Registration | `AuthController.php` (line 70) | Password is hashed on account creation |
| Password Reset | `AuthController.php` (line 518) | New password is hashed before saving |
| Profile Update | `SettingController.php` (lines 137–142) | Current password verified via `Hash::check()`, then new password hashed |

```php
// Registration
'password' => Hash::make($request->password),

// Password Reset
$user->password = Hash::make($request->password);
```

---

## Admin Encryption Tool

Admins have access to a dedicated UI tool for manually encrypting or decrypting text payloads. This is useful for data migrations and debugging without exposing backend keys directly.

### Backend API Endpoints

**File:** `Backend/app/Http/Controllers/EncryptionController.php`

| Endpoint | Method | Rate Limit | Description |
|---|---|---|---|
| `/api/encrypt` | POST | 30 req/min | Encrypts a string (max 1,000 chars) |
| `/api/decrypt` | POST | 20 req/min | Decrypts an AES-256-CBC payload |

> 🔒 Both endpoints are protected by Laravel Sanctum — only authenticated admins can access them.

```php
// Encrypt endpoint
public function encrypt(Request $request)
{
    $validated = $request->validate(['data' => 'required|string|max:1000']);
    $encrypted = Crypt::encryptString($validated['data']);
    return response()->json(['success' => true, 'encrypted' => $encrypted]);
}

// Decrypt endpoint
public function decrypt(Request $request)
{
    $validated = $request->validate(['encrypted' => 'required|string']);
    $decrypted = Crypt::decryptString($validated['encrypted']);
    return response()->json(['success' => true, 'decrypted' => $decrypted]);
}
```

### Frontend Interface

| File | Purpose |
|---|---|
| `Frontend/admin/templates/encryption.html` | Admin UI for the tool |
| `Frontend/admin/scripts/encryption-tool.js` | Handles API calls |

**Key functions in `encryption-tool.js`:**

- **`encryptData()`** — Reads from `#encryptInput`, POSTs plain text to `/api/encrypt`, writes result to `#encryptedOutput`
- **`decryptData()`** — Reads from `#decryptInput`, POSTs ciphertext to `/api/decrypt`, writes result to `#decryptedOutput`

```javascript
// 1. Send Plain Text to Backend for Encryption
function encryptData() {
    var input = document.getElementById('encryptInput').value.trim();

    fetch(API_BASE_URL + '/encrypt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: input })
    })
    .then(res => res.json())
    .then(result => {
        document.getElementById('encryptedOutput').value = result.encrypted;
    });
}

// 2. Send Ciphertext to Backend for Decryption
function decryptData() {
    var input = document.getElementById('decryptInput').value.trim();

    fetch(API_BASE_URL + '/decrypt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ encrypted: input })
    })
    .then(res => res.json())
    .then(result => {
        document.getElementById('decryptedOutput').value = result.decrypted;
    });
}
```

> No local encryption libraries (e.g., CryptoJS) are used. All processing is server-side.

---

## Frontend Data Flow

Since the database stores encrypted values, the backend always decrypts fields **before** sending JSON responses to the frontend. Once the frontend receives the JSON, it dynamically injects the plain-text data into the HTML DOM (dashboards, tables, profile sections, etc.).

### Controllers, Data Flow & Frontend Display

#### Customer Dashboard

| | |
|---|---|
| **Backend** | `CustomerDashboardController.php` decrypts `name`, `phone`, `address` |
| **JSON → JS** | `Frontend/customer/scripts/dashboard.js` |
| **Rendered in** | `Frontend/customer/templates/dashboard.html` (profile section, booking history table) |

#### Cleaner Dashboard

| | |
|---|---|
| **Backend** | `CleanerDashboardController.php` decrypts customer name, phone, and booking address |
| **JSON → JS** | `Frontend/cleaner/scripts/dashboard.js` |
| **Rendered in** | `Frontend/cleaner/templates/dashboard.html` (assigned job details) |

#### Admin Dashboard

| | |
|---|---|
| **Backend** | `AdminDashboardController.php` decrypts client names in bookings and user names in notifications |
| **JSON → JS** | `Frontend/admin/scripts/dashboard.js` |
| **Rendered in** | `Frontend/admin/templates/dashboard.html` (booking and notification tables) |

#### User Management (Admin)

| | |
|---|---|
| **Backend** | `UserController.php` decrypts `name`, `email`, `phone`, `address` for all users |
| **JSON → JS** | `Frontend/admin/scripts/users.js` |
| **Rendered in** | `Frontend/admin/templates/users.html` (user profile cards and management table) |

---

## Session & Token Protection

Authentication tokens are generated and managed via **Laravel Sanctum**.

| Aspect | Detail |
|---|---|
| **Token generation** | Issued on successful login |
| **Storage location** | `localStorage` / `sessionStorage` (key: `auth_token`) |
| **Relevant files** | `Frontend/auth/scripts/auth.js`, `Frontend/common/scripts/api-client.js` |

### XSS Mitigation

Since `localStorage` is inherently vulnerable to XSS attacks, the application applies these countermeasures:

- ✅ Strict backend CORS policies
- ✅ HTTPS enforced on all routes
- ✅ Cloudflare Turnstile verification to block automated abuse

---

## Scope & Coverage

This guide covers **100% of all encryption and decryption operations** in the codebase.

| Component | Technology | Where |
|---|---|---|
| PII field encryption | `EncryptsAttributes` trait + AES-256-CBC | All models using the trait |
| Password security | bcrypt via `Hash::make()` | `AuthController`, `SettingController` |
| Admin encryption tool | `EncryptionController` + API | Backend routes + Admin frontend |
| Token management | Laravel Sanctum | `auth.js`, `api-client.js` |
| Transport security | HTTPS | All client-server communication |

No third-party libraries (such as CryptoJS) are used for PII handling. No encryption keys are present on the frontend.
