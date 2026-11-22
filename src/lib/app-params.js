// Independent Jaime Home application identity.
// Old Base44 session parameters are deliberately not read or propagated.
export const appParams = {
  appId: 'media-god-independent',
  token: '',
  fromUrl: typeof window === 'undefined' ? '' : window.location.href,
  functionsVersion: 'independent',
  appBaseUrl: 'https://underworldhub.co.uk',
};
