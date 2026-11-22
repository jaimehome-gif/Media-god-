# Jaime Home independent Media God — social sign-in

The original Media God welcome screen choices are retained: **Google, Facebook, Microsoft, Apple**, email/password, and **Browse without signing in**.

This integration uses only the new Railway `media-god-identity-api`, Postgres, and the independent website. It does not use Base44 authentication. The main site at `underworldhub.co.uk` must not be cut over solely because these routes compile.

## 1. Callback URLs (register exactly)

Each provider's developer dashboard requires its exact callback/redirect URL:

| Provider | Register this URL |
|---|---|
| Google OAuth web client | `https://media-god-identity-api-production.up.railway.app/auth/oauth/google/callback` |
| Facebook Login for Business / Facebook Login | `https://media-god-identity-api-production.up.railway.app/auth/oauth/facebook/callback` |
| Microsoft Entra app registration (Web platform) | `https://media-god-identity-api-production.up.railway.app/auth/oauth/microsoft/callback` |
| Sign in with Apple Services ID, Return URL | `https://media-god-identity-api-production.up.railway.app/auth/oauth/apple/callback` |

Apple requires its Services ID, Team ID, Key ID, and Sign in with Apple private key; it uses `response_mode=form_post`. The new identity service handles that special callback securely.

Microsoft should use an app registration supporting both organisational and personal Microsoft accounts if that is the intended audience. Google may require OAuth consent-screen setup and production status. Facebook may require app review/production access to support non-test users.

**Never paste client secrets or private keys in GitHub, user messages, screenshots or logs.** Store them as encrypted Railway environment variables directly in the `media-god-identity-api` service.

## 2. Railway identity API configuration

Set the following variable pairs for the providers you wish to enable:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`

`APPLE_CLIENT_ID` is the Services ID (not the Apple ID email address). Set `APPLE_PRIVATE_KEY` to the full private key contents, with real newlines or escaped `\n`.

Optional, if the independent identity hostname or website preview changes:

- `SOCIAL_CALLBACK_BASE_URL` defaults to `https://media-god-identity-api-production.up.railway.app`.
- `SOCIAL_RETURN_ORIGINS` defaults to `https://underworldhub.co.uk,https://www.underworldhub.co.uk,https://media-god-independent-web-production.up.railway.app`.

Never add the former Base44 domain or old Lee Peters repository to this configuration.

## 3. How the login works

1. The app reads `GET /auth/providers` from the Jaime Home identity API.
2. Each of the four buttons is enabled **only if** its server-side developer configuration is present. Missing connections are shown disabled rather than pretending to work.
3. Selecting a configured provider opens `GET /auth/oauth/{provider}/start`. This creates a short-lived, one-use database state tied to an HttpOnly Secure browser cookie. Google and Microsoft also use PKCE. OpenID providers use a nonce.
4. The provider returns an authorization code to the registered callback. The server exchanges the code with the provider directly and checks the token signature, intended client, issuer, subject and nonce. Facebook tokens are verified with the issuing app and matching Graph account.
5. The server finds the account by **provider plus provider subject ID**, not by an unverified email. A new account is created if this provider identity is not already known. It never merges into a pre-existing email/password user based only on a social email assertion.
6. A 90-second, one-use exchange ticket is returned in the independent website's URL **fragment** and redeemed via `POST /auth/oauth/exchange`. The app removes the fragment immediately and stores the new Jaime Home session locally.
7. A verified session can access the independent personal data API and then connect Real-Debrid to that account. Browser visitors may still skip and browse the catalogue.

Important: social-provider-only accounts are not equivalent to having an email/password account. There is no automatic account merging between providers. Users should continue with the same provider to access the same new Media God account.

## 4. Verification checklist before enabling public login

- Confirm `GET /health`, `GET /auth/config`, and `GET /auth/providers` on the identity API return successfully.
- Use a **test account for each provider** and complete the redirect, signed verification, callback ticket redemption, authenticated `/auth/me`, logout and fresh login.
- Confirm two distinct providers/accounts cannot read each other's watchlists, Continue Watching, or Real-Debrid credentials.
- Confirm reusing an OAuth state or callback ticket fails and expired/cancelled attempts cannot log in.
- Test the flow on Chrome Android, Fire TV browser/WebView, desktop, and Apple Safari as applicable.
- Run the Jaime Home migration smoke workflow. Don't rely solely on a green build to claim social sign-in works.
- Only after all required login and playback tests pass should the independent site replace the current DNS route for `underworldhub.co.uk`.

**Current release gate:** no provider credentials are present in Railway. The integration is implemented but these provider logins are not live yet.
