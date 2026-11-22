// Every request is authenticated by server.mjs before reaching a handler.
// Reuse that server-validated account identity for the duration of the
// request. Rechecking User/me for every torrent action can hit upstream
// limits and turn a valid account into a spurious HTTP 401 midway through
// resolving a stream. Never accept an identity supplied in the HTTP body.
export const createClientFromRequest = (request) => {
  const client = request?.__mediaGodVerifiedClient;
  const verifiedUser = request?.__mediaGodVerifiedUser;
  const verifiedId = request?.__mediaGodVerifiedUserId;
  if (!client?.auth?.me || !verifiedUser?.id || typeof verifiedUser.id !== "string" ||
      verifiedId !== verifiedUser.id) {
    throw new Error("Verified Media God account required.");
  }

  // Keep the SDK's existing user-scoped entity and updateMe methods. Only
  // memoise auth.me to the exact verified identity bound by server.mjs.
  // The wrapper is ephemeral and cannot be used for another request.
  const scopedClient = Object.create(client);
  scopedClient.auth = Object.create(client.auth);
  scopedClient.auth.me = async () => verifiedUser;
  // A successful RD OAuth refresh writes new credentials through updateMe.
  // Reflect that confirmed write in the server-verified user snapshot as well.
  // Otherwise the short-lived User/me verification cache can keep returning
  // the old Real-Debrid access token and cause immediate 401 bad_token errors.
  scopedClient.auth.updateMe = async (patch) => {
    const updated = await client.auth.updateMe(patch);
    if (patch && typeof patch === "object" && !Array.isArray(patch)) {
      Object.assign(verifiedUser, patch);
    }
    return updated;
  };
  return scopedClient;
};
