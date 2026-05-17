# Comprehensive Encryption & Data Protection Guide

This guide outlines exactly how data encryption and decryption is handled throughout the entire Cleaning Services system, mapping the journey of sensitive data from the frontend UI to the backend database and vice versa.

## 1. How Encrypted Data is Inserted into the Database

The entire system relies on a central Laravel trait to intercept and encrypt data *before* it is saved to the MySQL database. 

When a user submits a form on the frontend (e.g., registering an account or making a booking), the frontend sends standard JSON text to the backend. The backend Eloquent model uses the `EncryptsAttributes` trait. Whenever an attribute defined in the `$encryptedAttributes` array is set, the trait intercepts it and encrypts the plain text using Laravel's AES-256-CBC algorithm (`Crypt::encryptString`). The resulting ciphertext is what gets permanently stored in the database.

**File Name:** `Backend/app/Traits/EncryptsAttributes.php`
**Line of Code:** Lines 43-61

**Snippet Code (Encryption Engine):**
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
                        'model' => get_class($this),
                        'attribute' => $key,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        return parent::setAttribute($key, $value);
    }
```

## 2. How Data is Decrypted and Displayed on the Frontend UI/UX

When the frontend UI/UX website needs to display user information (like in the Customer Dashboard or Admin User Management table), it makes an API request to the backend.

The backend pulls the raw ciphertext from the MySQL database. Because the Eloquent models utilize the `EncryptsAttributes` trait, the trait intercepts the retrieval of the attribute. It uses `Crypt::decryptString` to automatically convert the ciphertext back into plain text. The backend then bundles this decrypted plain text into a JSON response and sends it back to the frontend. The frontend JavaScript simply receives standard JSON data and renders it into the HTML DOM. The frontend *never* handles any decryption logic itself.

**File Name:** `Backend/app/Traits/EncryptsAttributes.php`
**Line of Code:** Lines 69-102

**Snippet Code (Decryption Engine):**
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
                    // Log failed decryption attempts for security monitoring
                    \Log::warning('Failed to decrypt attribute - possible tampering or key mismatch', [
                        'model' => get_class($this),
                        'attribute' => $key,
                        'record_id' => $this->id ?? null,
                        'error' => $e->getMessage(),
                    ]);
                    
                    // Return placeholder instead of breaking the app
                    return '[Decryption Failed]';
                } catch (\Exception $e) {
                    // ... error logging ...
                    return '[Decryption Error]';
                }
            }
        }

        return $value;
    }
```

## 3. Admin Encryption & Decryption Tool (`encryption.html`)

Administrators have access to a dedicated UI tool to manually encrypt plain text or decrypt ciphertext. 

### How it Happens
1. The admin types text into the input fields on `encryption.html`.
2. The `encryption-tool.js` script captures this text and sends it via an authenticated POST request to the backend API (`/api/encrypt` or `/api/decrypt`).
3. The `EncryptionController.php` on the backend receives the request, performs the AES-256-CBC operation using the system's `APP_KEY`, and returns the processed string.
4. The frontend JavaScript receives the response and displays the result on the screen.

### Frontend Logic
**File Name:** `Frontend/admin/scripts/encryption-tool.js`
**Line of Code:** Lines 82-127 (Encrypt) and 132-185 (Decrypt)

**Snippet Code (Frontend API Calls):**
```javascript
// Encrypt Request
function encryptData() {
    var input = document.getElementById('encryptInput').value.trim();
    // ... validation ...
    fetch(API_BASE_URL + '/encrypt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: input })
    })
    .then(function(response) { return response.json(); })
    .then(function(result) {
        document.getElementById('encryptedOutput').value = result.encrypted;
        showResult('encryptResult');
    });
}

// Decrypt Request
function decryptData() {
    var input = document.getElementById('decryptInput').value.trim();
    var appKey = document.getElementById('decryptAppKey').value.trim();
    // ... validation ...
    fetch(API_BASE_URL + '/decrypt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ encrypted: input, app_key: appKey })
    })
    .then(function(response) { return response.json(); })
    .then(function(result) {
        document.getElementById('decryptedOutput').value = result.decrypted;
        showResult('decryptResult');
    });
}
```

### Backend Logic
**File Name:** `Backend/app/Http/Controllers/EncryptionController.php`
**Line of Code:** Lines 26-53 (Encrypt) and 66-118 (Decrypt)

**Snippet Code (Backend Processing):**
```php
    // Encrypt Endpoint
    public function encrypt(Request $request)
    {
        $validated = $request->validate([
            'data' => 'required|string|max:1000',
        ]);

        try {
            $encrypted = Crypt::encryptString($validated['data']);
            return response()->json([
                'success' => true,
                'encrypted' => $encrypted,
                'message' => 'Data encrypted successfully',
            ]);
        } catch (Exception $e) { /* Error handling */ }
    }

    // Decrypt Endpoint
    public function decrypt(Request $request)
    {
        $validated = $request->validate([
            'encrypted' => 'required|string',
            'app_key' => 'required|string',
        ]);

        // App Key verification logic here...

        try {
            $decrypted = Crypt::decryptString($validated['encrypted']);
            return response()->json([
                'success' => true,
                'decrypted' => $decrypted,
                'message' => 'Data decrypted successfully',
            ]);
        } catch (DecryptException $e) { /* Error handling */ }
    }
```

## Summary of Models Using Encryption
Models that interact with the database using this encryption engine include:
- `Backend/app/Models/User.php` (Encrypts: `name`, `phone`, `address`)
- `Backend/app/Models/Booking.php` (Encrypts: `phone_number`, `address`)
- `Backend/app/Models/CleanerProfile.php` (If applicable, utilizes the same trait)

These files use the declaration `use App\Traits\EncryptsAttributes;` to tie into the core engine detailed in Section 1 and 2.
