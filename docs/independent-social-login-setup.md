# Media God independent social login — production setup

Owner: Jaime Home Media God / Underworld Hub.
Backend: `media-god-identity-api` on Railway.
User-facing website: `https://www.underworldhub.co.uk`.
Independent identity service: `https://media-god-identity-api-production.up.railway.app`.

**Do not reuse the old Base44-managed provider configuration.** Those social credentials
were owned by Base44's authentication service, not by this independently deployed
Railway project. The four OAuth routes are implemented but are deliberately disabled
until the owner provisions each provider's credentials. Never commit OAuth secrets to
GitHub or paste them into a support ticket or chat.

## Railway variables

Open the production **media-god-identity-api** service, Variables, and add the
app-specific values using Railway's secret/variable controls.

| Provider | Variable names | Provider application's HTTPS redirect URI |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `https://media-god-identity-api-production.up.railway.app/auth/oauth/google/callback` |
| Facebook / Meta | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | `https://media-god-identity-api-production.up.railway.app/auth/oauth/facebook/callback` |
| Microsoft | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | `https://media-god-identity-api-production.up.railway.app/auth/oauth/microsoft/callback` |
| Apple | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | `https://media-god-identity-api-production.up.railway.app/auth/oauth/apple/callback` |

Optional: `SITE_LINK_ORIGIN=https://www.underworldhub.co.uk`,
`SOCIAL_CALLBACK_BASE_URL=https://media-god-identity-api-production.up.railway.app`,
`SOCIAL_RETURN_ORIGINS=https://www.underworldhub.co.uk,https://underworldhub.co.uk,https://media-god-independent-web-production.up.railway.app`.

* Google: register a **Web application** client in Google Cloud Console, add
  `https://www.underworldhub.co.uk` under Authorized JavaScript origins when
  required, configure the consent-screen/brand and the exact OAuth redirect
  URI above. Use `openid email profile` scopes; store the client secret
  only in Railway.
* Facebook: create a Meta developer application, configure Facebook Login for
  the website, enter the exact callback in **Valid OAuth Redirect URIs**,
  and ensure the app is in Live mode for public users.
* Microsoft: register an app in Microsoft Entra, choose supported account
  types including personal Microsoft accounts if desired, add the exact
  **Web** redirect URI, and store the application/client ID plus a new secret.
* Apple: create a Services ID, Sign in with Apple key and verified website
  domain/return URL. Apple web sign-in has additional domain-ownership
  requirements; do not publish Apple as active until Apple validates the
  callback domain and completes a genuine login round trip.

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

### Critical Android / Fire TV consideration

The apps currently show the web login page in an Android WebView.
**Google prohibits OAuth authorisation inside embedded WebViews**. An active
Google client is therefore not enough to deliver native social login: the
native APKs must use the device browser/Custom Tabs and a **secure return
flow that restores the authenticated session inside Media God**, or a
proper native Google identity integration. Do not route a signed-in browser
session into the app by copying a token into an unsecured URL or an
unverified custom-scheme handler. The phone and Fire TV flow is **not ready
for release as social login** until this secure handback is implemented,
APK builds are signed and device-tested, even if website social login works.

### User messaging

Until all tests pass, keep nonconfigured social provider buttons disabled.
Email/password continues to work on the independent service. Do not tell
users they need a different email address or a new Base44 account.
