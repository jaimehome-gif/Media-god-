# Media God independent social login — production setup

Owner: Jaime Home Media God / Underworld Hub.
Backend: `media-god-identity-api` on Railway.
User-facing website: `https://www.underworldhub.co.uk`.
Independent identity service: `https://media-god-identity-api-production.up.railway.app`.

**Do not reuse the old Base44-managed provider configuration.** Google website sign-in is now user-confirmed. Facebook, Microsoft and Apple stay disabled until their provider credentials and verification are in place. Never commit OAuth secrets to GitHub or paste them into chat.

## Railway variables

Open the production **media-god-identity-api** service, Variables, and add the
app-specific values using Railway's secret/variable controls.

| Provider | Variable names | Provider application's HTTPS redirect URI |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `https://media-god-identity-api-production.up.railway.app/auth/oauth/google/callback` |
| Facebook / Meta | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | `https://media-god-identity-api-production.up.railway.app/auth/oauth/facebook/callback` |
| Microsoft | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | `https://media-god-identity-api-production.up.railway.app/auth/oauth/microsoft/callback` |
| Apple | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, optional `APPLE_REDIRECT_URI` | `https://auth.underworldhub.co.uk/auth/oauth/apple/callback` after its verified Railway subdomain is configured |

Optional: `SITE_LINK_ORIGIN=https://www.underworldhub.co.uk`,
`SOCIAL_CALLBACK_BASE_URL=https://media-god-identity-api-production.up.railway.app`,
`SOCIAL_RETURN_ORIGINS=https://www.underworldhub.co.uk,https://underworldhub.co.uk,https://media-god-independent-web-production.up.railway.app`.

* Google: register a **Web application** client in Google Cloud Console, add
  `https://www.underworldhub.co.uk` under Authorized JavaScript origins when
  required, configure the consent-screen/brand and the exact OAuth redirect
  URI above. Use `openid email profile` scopes; store the client secret
  only in Railway.
### Facebook / Meta (requires the owner to sign in to Meta Developers)
1. Open https://developers.facebook.com/apps/ and create or choose a Media God application.
2. Add the Facebook Login use case/product for **web**, with the Website URL
   `https://www.underworldhub.co.uk/` and App Domain `underworldhub.co.uk`.
3. In Facebook Login Settings, turn on **Client OAuth Login** and **Web OAuth Login**.
   Under **Valid OAuth Redirect URIs**, add:
   `https://media-god-identity-api-production.up.railway.app/auth/oauth/facebook/callback`
4. Under **App Settings → Basic**, copy the **App ID** to
   `FACEBOOK_CLIENT_ID` in Railway and the **App Secret** to
   `FACEBOOK_CLIENT_SECRET` using Railway's private Variables interface.
5. Complete any Meta required actions, domain verification, privacy-policy
   information and public Live-mode approval. Test the website with a Meta test
   user first. No Meta account or secret can be created by source-code changes.

### Microsoft (requires the owner to sign in to Entra)
1. Open https://entra.microsoft.com → Entra ID → **App registrations**
   → **New registration** and name it `Media God`.
2. Set **Supported account types** to **Accounts in any organisational
   directory and personal Microsoft accounts** if you want Outlook/Hotmail.
3. Under **Redirect URI** select **Web**, then enter:
   `https://media-god-identity-api-production.up.railway.app/auth/oauth/microsoft/callback`
4. Copy the **Application (client) ID** to Railway's `MICROSOFT_CLIENT_ID`.
5. Under **Certificates & secrets → New client secret**, copy the secret
   **Value** (not its ID) to Railway's `MICROSOFT_CLIENT_SECRET`.
6. Apply the Railway variables and test the Microsoft login on the website.

### Apple (requires Apple Developer enrolment and verified return domain)
1. Apple web login uses an Apple Developer **App ID** with Sign in with Apple,
   a **Services ID**, and a Sign in with Apple **private key**. Access
   https://developer.apple.com/account/ and set these up under Identifiers/Keys.
2. A unique callback hostname under a domain Media God owns must first be
   available. Add `auth.underworldhub.co.uk` as a Railway custom domain on
   the existing identity service, configure its DNS record and wait for TLS.
   **Do not change working Google/Microsoft/Facebook callback URLs.**
3. On the Apple Services ID, configure Domain `auth.underworldhub.co.uk`,
   and exact Return URL:
   `https://auth.underworldhub.co.uk/auth/oauth/apple/callback`
   Follow Apple's domain verification and primary-App-ID association steps.
4. Set Railway `APPLE_CLIENT_ID` to the **Services ID identifier**,
   `APPLE_TEAM_ID` to the Apple Developer Team ID,
   `APPLE_KEY_ID` to the Sign in with Apple key identifier, and
   `APPLE_PRIVATE_KEY` to the complete private key (preserve newlines).
   Set `APPLE_REDIRECT_URI` to the exact verified URL from step 3.
5. Redeploy the identity service. Test the full Apple sign-in flow in a
   normal browser, including Apple's first-use or Hide My Email behaviour.
   Apple cannot be switched on through Railway variables alone until its
   developer account and verified return domain are ready.

### Activation checks

1. Restart/deploy the identity API after supplying credentials.
2. GET `/auth/providers` on the identity API. Each provider reports
   `configured: true` only when its required variables are set.
3. Test each flow in a **normal browser** at
   `https://www.underworldhub.co.uk/login`: start → provider approval →
   callback → opaque one-time ticket exchange → `/auth/me` in the same
   independent account.
4. For an existing verified Gmail account, Google login should attach to that
   same independent Media God account. Existing already-linked provider
   profiles are **not** silently merged; use a consent-based recovery flow
   if a prior duplicate has user data.
5. Test reset password, email/password sign-in, account security and logout.

### Secure Android phone and Fire TV sign-in

The native phone and Fire TV APKs both host Media God in Android WebView.
Google does **not** allow its authorisation endpoint inside embedded WebViews,
so the independent app uses a **device pairing** flow entirely in the hosted
web frontend and Railway identity service. This does **not** require a new APK
as long as the installed app loads the independent `www` website.

1. In the APK login screen select **Continue with Google** (or another
   provider after that provider is configured).
2. The app shows a fresh eight-character code, lasting ten minutes.
3. On a second browser (on the same phone via Chrome, or another phone for
   Fire TV), open `https://www.underworldhub.co.uk/device-login`, sign in
   to the desired independent account, and type the device code.
4. The browser shows the account email and provider. Explicitly **approve**
   the device, after verifying this is your own TV/phone and code.
5. The APK polls using a distinct high-entropy secret device token; the
   approval is atomically consumed, and the existing identity backend issues
   the APK its own independent session. No Google password, social tokens,
   or account bearer token are placed in URLs.

The backend rate-limits starts and approval attempts, stores hashed codes and
tokens, requires a valid signed-in website session for approval, and allows
one-time redemption. For now, **real phone and Fire TV use must be tested**
before we mark the whole native journey verified for public rollout.

### User messaging

Until all tests pass, keep nonconfigured social provider buttons disabled.
Email/password continues to work on the independent service. Do not tell
users they need a different email address or a new Base44 account.
