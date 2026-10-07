import { betterFetch } from '@better-fetch/fetch';

const defaultEndpoints = ["/sign-up", "/sign-in", "/forget-password"];
const Providers = {
  CLOUDFLARE_TURNSTILE: "cloudflare-turnstile",
  GOOGLE_RECAPTCHA: "google-recaptcha"
};
const siteVerifyMap = {
  [Providers.CLOUDFLARE_TURNSTILE]: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  [Providers.GOOGLE_RECAPTCHA]: "https://www.google.com/recaptcha/api/siteverify"
};

const CAPTCHA_ERROR_CODES = {
  MISSING_RESPONSE: "Missing CAPTCHA response",
  SERVICE_UNAVAILABLE: "CAPTCHA service unavailable",
  VERIFICATION_FAILED: "Captcha verification failed",
  UNKNOWN_ERROR: "Something went wrong"
};

const middlewareResponse = ({ message, status }) => ({
  response: new Response(
    JSON.stringify({
      message
    }),
    {
      status
    }
  )
});

const cloudflareTurnstile = async ({
  siteVerifyURL,
  captchaResponse,
  secretKey
}) => {
  const response = await betterFetch(
    siteVerifyURL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: captchaResponse
      })
    }
  );
  if (!response.data || response.error) {
    return middlewareResponse({
      message: CAPTCHA_ERROR_CODES.SERVICE_UNAVAILABLE,
      status: 503
    });
  }
  if (!response.data.success) {
    return middlewareResponse({
      message: CAPTCHA_ERROR_CODES.VERIFICATION_FAILED,
      status: 403
    });
  }
  return void 0;
};

const googleReCAPTCHA = async ({
  siteVerifyURL,
  captchaResponse,
  secretKey
}) => {
  const response = await betterFetch(
    siteVerifyURL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: captchaResponse
      })
    }
  );
  if (!response.data || response.error) {
    return middlewareResponse({
      message: CAPTCHA_ERROR_CODES.SERVICE_UNAVAILABLE,
      status: 503
    });
  }
  if (!response.data.success) {
    return middlewareResponse({
      message: CAPTCHA_ERROR_CODES.VERIFICATION_FAILED,
      status: 403
    });
  }
  return void 0;
};

const captcha = (options) => ({
  id: "captcha",
  onRequest: async (request) => {
    try {
      if (request.method !== "POST") return void 0;
      const endpoints = options.endpoints?.length ? options.endpoints : defaultEndpoints;
      if (!endpoints.some((endpoint) => request.url.includes(endpoint)))
        return;
      const captchaResponse = request.headers.get("x-captcha-response");
      if (!captchaResponse) {
        return middlewareResponse({
          message: CAPTCHA_ERROR_CODES.MISSING_RESPONSE,
          status: 400
        });
      }
      const siteVerifyURL = options.siteVerifyURLOverride || siteVerifyMap[options.provider];
      if (options.provider === Providers.CLOUDFLARE_TURNSTILE) {
        return await cloudflareTurnstile({
          secretKey: options.secretKey,
          captchaResponse,
          siteVerifyURL
        });
      }
      if (options.provider === Providers.GOOGLE_RECAPTCHA) {
        return await googleReCAPTCHA({
          secretKey: options.secretKey,
          captchaResponse,
          siteVerifyURL
        });
      }
    } catch (_error) {
      return middlewareResponse({
        message: CAPTCHA_ERROR_CODES.UNKNOWN_ERROR,
        status: 500
      });
    }
  }
});

export { captcha };
