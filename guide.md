# AES-256-CBC Encryption Guide

> How sensitive data is protected across the Cleaning Services codebase.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Field Encryption (Data at Rest)](#2-database-field-encryption-data-at-rest)
3. [Password Hashing (One-Way)](#3-password-hashing-one-way)
4. [Admin Encryption Tool](#4-admin-encryption-tool)
5. [Frontend Decryption Flow](#5-frontend-decryption-flow)
6. [Session & Token Protection](#6-session--token-protection)

---

## 1. Architecture Overview

The application uses a **Backend-centric Encryption Architecture** — all encryption and decryption happens on the server. The frontend never holds encryption keys or performs local AES decryption.

### Security Layers

| Layer | Method | Purpose |
|---|---|---|
| **Data at Rest** | AES-256-CBC (`Crypt` facade) | Encrypts PII fields in the database |
| **Passwords** | bcrypt (`Hash::make`) | One-way hashing; cannot be reversed |
| **Data in Transit** | HTTPS + Laravel Sanctum | Secures all client-server communication |

### Key Management

- **Master Key:** `APP_KEY` in the backend `.env` file
- **Config Reference:** `Backend/config/app.php` → `env('APP_KEY')`

> ⚠️ **Critical:** If `APP_KEY` is lost or rotated without a migration script, all encrypted database fields become **permanently unreadable**.

---

## 2. Database Field Encryption (Data at Rest)

Specific model fields are automatically encrypted on write and decrypted on read using a shared trait.

### How It Works

**File:** `Backend/app/Traits/EncryptsAttributes.php`

The `EncryptsAttributes` trait hooks into Eloquent's lifecycle:

- **On Save** → `setAttribute()` calls `Crypt::encryptString()`
- **On Read** → `getAttribute()` calls `Crypt::decryptString()`

```php
// EncryptsAttributes.php (Lines 43–60)
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

### Encrypted Models & Fields

#### User Model
`Backend/app/Models/User.php` (Lines 60–64)

```php
protected $encryptedAttributes = [
    'name',     // Full name (PII)
    'phone',    // Contact information (PII)
    'address',  // Location data (PII)
];
```

> **Note:** `email` is intentionally **not** encrypted to allow fast SQL `WHERE` lookups during authentication.

---

#### Booking Model
`Backend/app/Models/Booking.php` (Lines 34–38)

```php
protected $encryptedAttributes = [
    'phone_number',  // Contact information
    'address',       // Location data
];
```

---

#### CleanerProfile Model
`Backend/app/Models/CleanerProfile.php` (Lines 38–42)

```php
protected $encryptedAttributes = [
    'id_number',                // Government ID (highly sensitive)
    'emergency_contact_name',   // Emergency contact PII
    'emergency_contact_phone',  // Emergency contact PII
];
```

---

## 3. Password Hashing (One-Way)

Passwords are **never** stored as plain text or reversible ciphertext. bcrypt produces a one-way hash that even database administrators cannot read.

| Operation | Method |
|---|---|
| Hash a password | `Hash::make($password)` |
| Verify a password | `Hash::check($input, $hash)` |

### Where It's Used

**Registration & Password Reset** — `AuthController.php`

```php
// Registration (Line 70)
'password' => Hash::make($request->password),

// Reset (Line 518)
$user->password = Hash::make($request->password);
```

**Profile Password Update** — `SettingController.php` (Lines 137–142)

The controller first verifies the current password with `Hash::check()`, then stores the new one with `Hash::make()`.

---

## 4. Admin Encryption Tool

Administrators can manually encrypt or decrypt text payloads — useful for data migration and debugging without exposing backend keys.

### Backend Endpoints

**File:** `Backend/app/Http/Controllers/EncryptionController.php`

| Endpoint | Rate Limit | Description |
|---|---|---|
| `POST /api/encrypt` | 30 req/min | Encrypts a string (max 1,000 chars) |
| `POST /api/decrypt` | 20 req/min | Decrypts an AES-256-CBC payload |

Both routes are protected by **Sanctum middleware** — authenticated admins only.

```php
// EncryptionController.php — Decrypt endpoint (Lines 64–75)
public function decrypt(Request $request)
{
    $validated = $request->validate(['encrypted' => 'required|string']);
    try {
        $decrypted = Crypt::decryptString($validated['encrypted']);
        return response()->json([
            'success'   => true,
            'decrypted' => $decrypted,
            'message'   => 'Data decrypted successfully',
        ]);
    } catch (DecryptException $e) {
        // Handle tampered or invalid payload
    }
}
```

### Frontend Interface

| File | Role |
|---|---|
| `Frontend/admin/templates/encryption.html` | Admin UI |
| `Frontend/admin/scripts/encryption-tool.js` | API call logic |

The frontend sends plain text or ciphertext to the backend API and displays the result. **No local encryption (e.g., CryptoJS) is used.**

```javascript
// encryption-tool.js (Lines 141–155)
function decryptData() {
    var input = document.getElementById('decryptInput').value.trim();

    fetch(API_BASE_URL + '/decrypt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ encrypted: input })
    })
    .then(response => response.json())
    .then(result => {
        document.getElementById('decryptedOutput').value = result.decrypted;
    });
}
```

---

## 5. Frontend Decryption Flow

The frontend never decrypts data itself. The backend decrypts encrypted fields before sending JSON responses over HTTPS.

### How It Works

When a controller accesses a field like `$user->name` or `$booking->address`, the `EncryptsAttributes` trait automatically decrypts the value before it reaches the JSON response.

```
Database (encrypted) → Eloquent Model → EncryptsAttributes trait → Plain text in JSON → HTTPS → Frontend DOM
```

### Examples

| Controller | Decrypted Fields Served |
|---|---|
| `CustomerDashboardController.php` | `$user->name`, `$booking->address` |
| `CleanerDashboardController.php` | Customer names and addresses for assigned jobs |

The decrypted data arrives at the frontend over a secure HTTPS connection and is injected directly into the DOM (e.g., `dashboard.html`).

---

## 6. Session & Token Protection

Laravel Sanctum generates secure API tokens on login. These are used to authenticate all subsequent requests.

| Aspect | Detail |
|---|---|
| **Token generation** | Laravel Sanctum on successful login |
| **Frontend storage** | `localStorage` or `sessionStorage` (key: `auth_token`) |
| **Relevant files** | `auth.js`, `api-client.js` |

### Security Considerations

`localStorage` is inherently vulnerable to XSS. The application mitigates this through:

- Strict backend **CORS policies**
- Enforced **HTTPS** on all routes
- **Cloudflare Turnstile** verification to block unauthorized requests and token theft
