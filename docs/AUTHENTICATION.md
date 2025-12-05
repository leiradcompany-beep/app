# Authentication & Token Management

This project uses Laravel Sanctum for token-based authentication. The frontend communicates with the backend API using a secure, centralized `ApiClient`.

## Authentication Flow

1.  **Login**:
    *   User submits credentials to `/api/login`.
    *   Backend validates credentials and returns a Sanctum API token (Bearer token) and user data.
    *   Frontend stores the token in `localStorage` (`auth_token`) and user data (`user_data`).
    *   User is redirected to the appropriate dashboard based on their role.

2.  **API Requests**:
    *   All authenticated requests must include the `Authorization: Bearer <token>` header.
    *   This is handled automatically by `api-client.js`.
    *   Developers should use `ApiClient.get()`, `ApiClient.post()`, etc., instead of raw `$.ajax()` calls to ensure headers are present.

3.  **Token Validation**:
    *   On page load, scripts check for the existence of `auth_token` in `localStorage`.
    *   If missing, the user is redirected to the login page.
    *   The backend validates the token on every request via the `auth:sanctum` middleware.

4.  **Expiration & Refresh**:
    *   If a token expires or is revoked, the backend returns a `401 Unauthorized` status.
    *   The `ApiClient` intercepts all `401` responses globally.
    *   Upon a `401` error, the `ApiClient` automatically clears the `localStorage` and redirects the user to the login page to re-authenticate.

5.  **Logout**:
    *   User clicks "Logout".
    *   Frontend sends a POST request to `/api/logout` to invalidate the token on the server.
    *   Frontend clears `localStorage` and redirects to the login page.

## Security Measures

*   **Secure Storage**: Tokens are stored in `localStorage`. While accessible to JS, this is standard for SPAs. Ensure XSS protection is robust.
*   **Global Interceptor**: A centralized error handler prevents unauthenticated users from accessing protected data if their session expires while using the app.
*   **Role-Based Access Control (RBAC)**: The backend strictly enforces roles (`admin`, `cleaner`, `customer`) via middleware.

## Usage Example

```javascript
// valid request
ApiClient.get('/admin/dashboard')
    .then(response => {
        console.log('Data:', response);
    })
    .catch(error => {
        console.error('Error:', error);
    });
```
