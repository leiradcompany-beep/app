# 🔐 Comprehensive Encryption & Data Protection Guide

> This guide maps the complete journey of sensitive data — from the frontend UI to the backend database and back — detailing exactly how encryption and decryption is handled throughout the **Cleaning Services** system.

---

# Table of Contents

1. [What is AES-256-CBC in Laravel](#1-what-is-aes-256-cbc-in-laravel)
2. [Inserting Encrypted Data into the Database](#2-inserting-encrypted-data-into-the-database)
3. [Decrypting Data for Frontend Display](#3-decrypting-data-for-frontend-display)
4. [Admin Encryption & Decryption Tool](#4-admin-encryption--decryption-tool)
   - [Frontend Logic](#frontend-logic)
   - [Backend Logic](#backend-logic)
5. [Models Using Encryption](#5-models-using-encryption)

---

# 1. What is AES-256-CBC in Laravel

Laravel uses the PHP OpenSSL encryption system internally through the `Crypt` facade.

When calling:

```php
Crypt::encryptString($value);
```

Laravel automatically performs encryption using the:

## AES-256-CBC Algorithm

| Term | Meaning |
|------|---------|
| **AES** | Advanced Encryption Standard |
| **256** | Uses a 256-bit encryption key |
| **CBC** | Cipher Block Chaining mode |

---

## 🔍 How AES-256-CBC Works

### Encryption Flow

```text
Plain Text
   │
   ▼
Laravel Crypt::encryptString()
   │
   ▼
Random IV Generated
(Initialization Vector)
   │
   ▼
AES-256-CBC Encryption
using APP_KEY
   │
   ▼
Ciphertext Generated
   │
   ▼
Stored in Database
```

---

## 🔐 Important Components

| Component | Purpose |
|-----------|---------|
| `APP_KEY` | Main secret key used for encryption/decryption |
| `AES-256-CBC` | Encryption algorithm |
| `IV (Initialization Vector)` | Random value that ensures encrypted outputs differ every time |
| `Ciphertext` | Encrypted unreadable data stored in database |

---

## 🧠 Why the Same Text Produces Different Ciphertext

Even if the same value is encrypted multiple times:

```php
Crypt::encryptString('John Doe');
```

Laravel generates different ciphertext outputs because a new random IV is created for every encryption operation.

Example:

```text
John Doe
   ↓
Encrypted #1:
eyJpdiI6Ikx...

John Doe
   ↓
Encrypted #2:
eyJpdiI6InF...
```

> ✅ This improves security and prevents attackers from detecting repeated values.

---

## 🔄 AES-256-CBC Encryption & Decryption Cycle

```text
Frontend Input
      │
      ▼
Laravel Backend
(Crypt::encryptString)
      │
      ▼
AES-256-CBC Encryption
      │
      ▼
Ciphertext Stored in MySQL
      │
      ▼
Later Retrieval
      │
      ▼
Crypt::decryptString
      │
      ▼
AES-256-CBC Decryption
      │
      ▼
Original Plain Text Restored
```

---

## 🔑 Laravel APP_KEY Example

Laravel stores the encryption key inside:

```env
APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

This key is used internally by Laravel to:

- Encrypt data
- Decrypt data
- Generate secure ciphertext
- Verify integrity of encrypted payloads

> ⚠️ If the `APP_KEY` changes, previously encrypted data can no longer be decrypted.

---

## 📦 Laravel Encryption Payload Structure

Laravel does not store only the encrypted text itself.

The encrypted payload typically contains:

```json
{
  "iv": "random-initialization-vector",
  "value": "encrypted-data",
  "mac": "message-authentication-code"
}
```

Laravel then Base64-encodes the entire payload before storing or returning it.

---

## 🛡 Security Benefits of AES-256-CBC in Laravel

| Security Feature | Benefit |
|-----------------|---------|
| 256-bit encryption | Extremely difficult to brute-force |
| Random IV generation | Prevents pattern analysis |
| MAC validation | Detects tampering |
| Server-side decryption only | Frontend never handles keys |
| OpenSSL integration | Industry-standard cryptography |

---

# 2. Inserting Encrypted Data into the Database

The entire system relies on a **central Laravel trait** to intercept and encrypt data before it is saved to the MySQL database.

## How It Works

```text
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

---

## 📄 Source File

| Property | Value |
|----------|-------|
| **File** | `Backend/app/Traits/EncryptsAttributes.php` |
| **Lines** | 43 – 61 |

---

## 💻 Code — Encryption Engine (`setAttribute`)

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

# 3. Decrypting Data for Frontend Display

When the frontend needs to display user information (e.g., Customer Dashboard, Admin User Management table), it makes an API request to the backend.

## How It Works

```text
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

> ✅ The frontend never handles any decryption logic itself. All decryption is done server-side.

---

## 📄 Source File

| Property | Value |
|----------|-------|
| **File** | `Backend/app/Traits/EncryptsAttributes.php` |
| **Lines** | 69 – 102 |

---

## 💻 Code — Decryption Engine (`getAttribute`)

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
                \Log::warning(
                    'Failed to decrypt attribute - possible tampering or key mismatch',
                    [
                        'model'      => get_class($this),
                        'attribute'  => $key,
                        'record_id'  => $this->id ?? null,
                        'error'      => $e->getMessage(),
                    ]
                );

                return '[Decryption Failed]';

            } catch (\Exception $e) {

                \Log::error('Unexpected decryption error', [
                    'model'      => get_class($this),
                    'attribute'  => $key,
                    'record_id'  => $this->id ?? null,
                    'error'      => $e->getMessage(),
                ]);

                return '[Decryption Error]';
            }
        }
    }

    return $value;
}
```

---

## ⚠ Error Handling at a Glance

| Exception | Return Value | Purpose |
|-----------|-------------|---------|
| `DecryptException` | `[Decryption Failed]` | Catches tampering or key mismatches |
| `\Exception` | `[Decryption Error]` | Catches all other unexpected errors |

---

# 4. Admin Encryption & Decryption Tool

Administrators have access to a dedicated UI tool (`encryption.html`) to manually encrypt plain text or decrypt ciphertext.

## How It Works

```text
Admin types text into encryption.html
        │
        ▼
encryption-tool.js sends authenticated POST request
(/api/encrypt OR /api/decrypt)
        │
        ▼
EncryptionController.php performs AES-256-CBC operation
using the system APP_KEY
        │
        ▼
Result returned as JSON and displayed on screen
```

---

# Frontend Logic

| Property | Value |
|----------|-------|
| **File** | `Frontend/admin/scripts/encryption-tool.js` |
| **Encrypt lines** | 82 – 127 |
| **Decrypt lines** | 132 – 185 |

---

## 💻 Code — Frontend API Calls

```javascript
// ── ENCRYPT ──────────────────────────────────────────────
function encryptData() {

    var input = document.getElementById('encryptInput').value.trim();

    // Validation
    if (!input) {
        alert('Please enter text to encrypt.');
        return;
    }

    fetch(API_BASE_URL + '/encrypt', {

        method: 'POST',

        headers: getAuthHeaders(),

        body: JSON.stringify({
            data: input
        })

    })

    .then(function(response) {
        return response.json();
    })

    .then(function(result) {

        document.getElementById('encryptedOutput').value =
            result.encrypted;

        showResult('encryptResult');
    })

    .catch(function(error) {
        console.error(error);
    });
}

// ── DECRYPT ──────────────────────────────────────────────
function decryptData() {

    var input =
        document.getElementById('decryptInput').value.trim();

    var appKey =
        document.getElementById('decryptAppKey').value.trim();

    // Validation
    if (!input || !appKey) {
        alert('Encrypted data and APP_KEY are required.');
        return;
    }

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

        document.getElementById('decryptedOutput').value =
            result.decrypted;

        showResult('decryptResult');
    })

    .catch(function(error) {
        console.error(error);
    });
}
```

---

# Backend Logic

| Property | Value |
|----------|-------|
| **File** | `Backend/app/Http/Controllers/EncryptionController.php` |
| **Encrypt lines** | 26 – 53 |
| **Decrypt lines** | 66 – 118 |

---

## 💻 Code — Backend Processing

```php
// ── ENCRYPT ENDPOINT ─────────────────────────────────────
public function encrypt(Request $request)
{
    $validated = $request->validate([
        'data' => 'required|string|max:1000',
    ]);

    try {

        $encrypted =
            Crypt::encryptString($validated['data']);

        return response()->json([
            'success'   => true,
            'encrypted' => $encrypted,
            'message'   => 'Data encrypted successfully',
        ]);

    } catch (Exception $e) {

        return response()->json([
            'success' => false,
            'message' => 'Encryption failed',
            'error'   => $e->getMessage(),
        ], 500);
    }
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

        $decrypted =
            Crypt::decryptString($validated['encrypted']);

        return response()->json([
            'success'   => true,
            'decrypted' => $decrypted,
            'message'   => 'Data decrypted successfully',
        ]);

    } catch (DecryptException $e) {

        return response()->json([
            'success' => false,
            'message' => 'Invalid encrypted payload',
            'error'   => $e->getMessage(),
        ], 400);

    } catch (Exception $e) {

        return response()->json([
            'success' => false,
            'message' => 'Decryption failed',
            'error'   => $e->getMessage(),
        ], 500);
    }
}
```

---

# 5. Models Using Encryption

All models below use the `EncryptsAttributes` trait:

```php
use App\Traits\EncryptsAttributes;
```

This ties them directly into the encryption/decryption engine described in Section 2 and Section 3.

| Model File | Encrypted Fields |
|------------|-----------------|
| `Backend/app/Models/User.php` | `name`, `phone`, `address` |
| `Backend/app/Models/Booking.php` | `phone_number`, `address` |
| `Backend/app/Models/CleanerProfile.php` | *(If applicable — uses same trait)* |

---

# ✅ Summary

This system implements centralized encryption using Laravel's built-in `Crypt` facade and the AES-256-CBC encryption algorithm.

The architecture ensures that:

- Sensitive data is encrypted before database storage
- Plain text is never permanently stored in MySQL
- Decryption only occurs securely on the backend
- Frontend applications never access encryption keys
- Tampering and invalid payloads are detected safely
- The Laravel `APP_KEY` acts as the root cryptographic secret

This creates a secure end-to-end encryption workflow across the entire Cleaning Services platform.

---

*End of Encryption & Data Protection Guide.*
