# 🔐 Comprehensive Encryption & Data Protection Guide

> This guide maps the complete journey of sensitive data — from the frontend UI to the backend database and back — detailing exactly how encryption and decryption is handled throughout the **Cleaning Services** system.

---

## Table of Contents

1. [Inserting Encrypted Data into the Database](#1-inserting-encrypted-data-into-the-database)
2. [Decrypting Data for Frontend Display](#2-decrypting-data-for-frontend-display)
3. [Admin Encryption & Decryption Tool](#3-admin-encryption--decryption-tool)
   - [Frontend Logic](#frontend-logic)
   - [Backend Logic](#backend-logic)
4. [Models Using Encryption](#4-models-using-encryption)

---

## 1. Inserting Encrypted Data into the Database

The entire system relies on a **central Laravel trait** to intercept and encrypt data before it is saved to the MySQL database.

### How It Works

```
User submits form (Frontend)
        │
        ▼
Backend receives plain JSON text
        │
        ▼
Eloquent model intercepts via EncryptsAttributes trait
        │
        ▼
AES-256-CBC encryption applied (Crypt::encryptString)
        │
        ▼
Ciphertext stored permanently in MySQL database
```

| Step | Actor | Action |
|------|-------|--------|
| 1 | Frontend | Sends standard JSON (plain text) to backend |
| 2 | Eloquent Model | Uses `EncryptsAttributes` trait |
| 3 | Trait | Intercepts any attribute listed in `$encryptedAttributes` |
| 4 | Laravel Crypt | Encrypts value using **AES-256-CBC** |
| 5 | Database | Stores resulting **ciphertext** |

### 📄 Source File

| Property | Value |
|----------|-------|
| **File** | `Backend/app/Traits/EncryptsAttributes.php` |
| **Lines** | 43 – 61 |

### 💻 Code — Encryption Engine (`setAttribute`)

```php
public function setAttribute($key, $value)
{
    // Check if this attribute should be encrypted
    if (in_array($key, $this->encryptedAttributes ?? [])) {
        // Only encrypt non-null, non-empty values
        if ($value !== null && $value !== '') {
            try {
                $value = Crypt::encryptString($value);
            } catch (\Exception $e) {
                \Log::error('Failed to encrypt attribute', [
                    'model'     => get_class($this),
                    'attribute' => $key,
                    'error'     => $e->getMessage(),
                ]);
            }
        }
    }
    return parent::setAttribute($key, $value);
}
```

---

## 2. Decrypting Data for Frontend Display

When the frontend needs to display user information (e.g., Customer Dashboard, Admin User Management table), it makes an API request to the backend.

### How It Works

```
Frontend makes API request
        │
        ▼
Backend pulls raw ciphertext from MySQL
        │
        ▼
EncryptsAttributes trait intercepts attribute retrieval
        │
        ▼
AES-256-CBC decryption applied (Crypt::decryptString)
        │
        ▼
Plain text bundled into JSON response
        │
        ▼
Frontend renders plain text into HTML DOM
```

> ✅ **The frontend never handles any decryption logic itself.** All decryption is done server-side.

### 📄 Source File

| Property | Value |
|----------|-------|
| **File** | `Backend/app/Traits/EncryptsAttributes.php` |
| **Lines** | 69 – 102 |

### 💻 Code — Decryption Engine (`getAttribute`)

```php
public function getAttribute($key)
{
    $value = parent::getAttribute($key);

    // Check if this attribute should be decrypted
    if (in_array($key, $this->encryptedAttributes ?? [])) {
        // Only decrypt non-null, non-empty values
        if ($value !== null && $value !== '') {
            try {
                $value = Crypt::decryptString($value);
            } catch (DecryptException $e) {
                // Log failed decryption for security monitoring
                \Log::warning('Failed to decrypt attribute - possible tampering or key mismatch', [
                    'model'      => get_class($this),
                    'attribute'  => $key,
                    'record_id'  => $this->id ?? null,
                    'error'      => $e->getMessage(),
                ]);
                return '[Decryption Failed]'; // Graceful fallback
            } catch (\Exception $e) {
                // ... error logging ...
                return '[Decryption Error]';
            }
        }
    }
    return $value;
}
```

#### Error Handling at a Glance

| Exception | Return Value | Purpose |
|-----------|-------------|---------|
| `DecryptException` | `[Decryption Failed]` | Catches tampering or key mismatches |
| `\Exception` | `[Decryption Error]` | Catches all other unexpected errors |

---

## 3. Admin Encryption & Decryption Tool

Administrators have access to a dedicated UI tool (`encryption.html`) to **manually encrypt** plain text or **decrypt** ciphertext.

### How It Works

```
Admin types text into encryption.html
        │
        ▼
encryption-tool.js sends authenticated POST request
   (/api/encrypt  OR  /api/decrypt)
        │
        ▼
EncryptionController.php performs AES-256-CBC operation
   using the system APP_KEY
        │
        ▼
Result returned as JSON and displayed on screen
```

---

### Frontend Logic

| Property | Value |
|----------|-------|
| **File** | `Frontend/admin/scripts/encryption-tool.js` |
| **Encrypt lines** | 82 – 127 |
| **Decrypt lines** | 132 – 185 |

#### 💻 Code — Frontend API Calls

```javascript
// ── ENCRYPT ──────────────────────────────────────────────
function encryptData() {
    var input = document.getElementById('encryptInput').value.trim();
    // ... validation ...

    fetch(API_BASE_URL + '/encrypt', {
        method:  'POST',
        headers: getAuthHeaders(),
        body:    JSON.stringify({ data: input })
    })
    .then(function(response) { return response.json(); })
    .then(function(result) {
        document.getElementById('encryptedOutput').value = result.encrypted;
        showResult('encryptResult');
    });
}

// ── DECRYPT ──────────────────────────────────────────────
function decryptData() {
    var input  = document.getElementById('decryptInput').value.trim();
    var appKey = document.getElementById('decryptAppKey').value.trim();
    // ... validation ...

    fetch(API_BASE_URL + '/decrypt', {
        method:  'POST',
        headers: getAuthHeaders(),
        body:    JSON.stringify({ encrypted: input, app_key: appKey })
    })
    .then(function(response) { return response.json(); })
    .then(function(result) {
        document.getElementById('decryptedOutput').value = result.decrypted;
        showResult('decryptResult');
    });
}
```

---

### Backend Logic

| Property | Value |
|----------|-------|
| **File** | `Backend/app/Http/Controllers/EncryptionController.php` |
| **Encrypt lines** | 26 – 53 |
| **Decrypt lines** | 66 – 118 |

#### 💻 Code — Backend Processing

```php
// ── ENCRYPT ENDPOINT ─────────────────────────────────────
public function encrypt(Request $request)
{
    $validated = $request->validate([
        'data' => 'required|string|max:1000',
    ]);

    try {
        $encrypted = Crypt::encryptString($validated['data']);
        return response()->json([
            'success'   => true,
            'encrypted' => $encrypted,
            'message'   => 'Data encrypted successfully',
        ]);
    } catch (Exception $e) { /* Error handling */ }
}

// ── DECRYPT ENDPOINT ─────────────────────────────────────
public function decrypt(Request $request)
{
    $validated = $request->validate([
        'encrypted' => 'required|string',
        'app_key'   => 'required|string',
    ]);

    // App Key verification logic here...

    try {
        $decrypted = Crypt::decryptString($validated['encrypted']);
        return response()->json([
            'success'   => true,
            'decrypted' => $decrypted,
            'message'   => 'Data decrypted successfully',
        ]);
    } catch (DecryptException $e) { /* Error handling */ }
}
```

---

## 4. Models Using Encryption

All models below use the `EncryptsAttributes` trait — declared as:

```php
use App\Traits\EncryptsAttributes;
```

This ties them directly into the encryption/decryption engine described in [Section 1](#1-inserting-encrypted-data-into-the-database) and [Section 2](#2-decrypting-data-for-frontend-display).

| Model File | Encrypted Fields |
|------------|-----------------|
| `Backend/app/Models/User.php` | `name`, `phone`, `address` |
| `Backend/app/Models/Booking.php` | `phone_number`, `address` |
| `Backend/app/Models/CleanerProfile.php` | *(If applicable — uses same trait)* |

---

*End of Encryption & Data Protection Guide.*
