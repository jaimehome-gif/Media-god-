import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { verifyBase44Session } from "./base44Bridge.mjs";

// Base44 credentials are verified upstream; an additional mailbox challenge
// proves control before an existing independent account can be claimed.
// No account linking by email alone.
export function createBase44Recovery({
  pool, issueSession, emailSend, hashPass, sha, token, limitRate, respond,
  verify = verifyBase44Session
}) {
  return {
    async initialize() {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS identity_base44_recovery (legacy_user_id TEXT PRIMARY KEY,email TEXT NOT NULL,salt TEXT NOT NULL,code_hash TEXT NOT NULL,attempts INT NOT NULL DEFAULT 0,expires_at TIMESTAMPTZ NOT NULL)"
      );
    },
    async handle(req,res,path,body,origin) {
      if (path === "/auth/base44/recover/start" && req.method === "POST") {
        const legacy = await verify(body.legacy_token);
        limitRate(req,"legacy-recover-start",legacy.email);
        const code = String(randomInt(100000,1000000));
        const salt = randomBytes(16).toString("hex");
        await pool.query(
          "INSERT INTO identity_base44_recovery(legacy_user_id,email,salt,code_hash,attempts,expires_at) VALUES($1,$2,$3,$4,0,NOW()+INTERVAL '10 minutes') ON CONFLICT(legacy_user_id) DO UPDATE SET email=EXCLUDED.email,salt=EXCLUDED.salt,code_hash=EXCLUDED.code_hash,attempts=0,expires_at=EXCLUDED.expires_at",
          [legacy.legacyId,legacy.email,salt,sha(salt+":"+code)]
        );
        await emailSend(legacy.email,"Verify your original Media God account",
          "Your one-time Media God account recovery code is: "+code+
          "\nUse this code only on underworldhub.co.uk. It expires in 10 minutes. If you did not request it, ignore this email.");
        return respond(res,200,{ok:true,challenge:"email_code",expires_in:600},origin);
      }
      if (path === "/auth/base44/recover/complete" && req.method === "POST") {
        const legacy = await verify(body.legacy_token);
        limitRate(req,"legacy-recover-complete",legacy.email);
        const code = String(body.code || "").trim();
        if (!/^\d{6}$/.test(code)) {
          const e=Error("Enter the six-digit email verification code"); e.status=400; throw e;
        }
        const {rows} = await pool.query(
          "SELECT salt,code_hash,attempts FROM identity_base44_recovery WHERE legacy_user_id=$1 AND email=$2 AND expires_at>NOW()",
          [legacy.legacyId,legacy.email]
        );
        if (!rows.length || rows[0].attempts >= 5) {
          const e=Error("Recovery code expired. Request another."); e.status=401; throw e;
        }
        if (sha(rows[0].salt+":"+code) !== rows[0].code_hash) {
          await pool.query(
            "UPDATE identity_base44_recovery SET attempts=attempts+1 WHERE legacy_user_id=$1",
            [legacy.legacyId]
          );
          const e=Error("Incorrect recovery code"); e.status=401; throw e;
        }
        // Consume the code exactly once before issuing an independent session.
        const consumed = await pool.query(
          "DELETE FROM identity_base44_recovery WHERE legacy_user_id=$1 AND email=$2 AND code_hash=$3 AND expires_at>NOW() AND attempts<5 RETURNING legacy_user_id",
          [legacy.legacyId,legacy.email,rows[0].code_hash]
        );
        if (!consumed.rowCount) {
          const e=Error("Recovery code already used"); e.status=409; throw e;
        }
        const existingLink=await pool.query(
          "SELECT a.* FROM identity_base44_links l JOIN identity_accounts a ON a.id=l.user_id WHERE l.legacy_user_id=$1",
          [legacy.legacyId]
        );
        if (existingLink.rows.length) {
          if (existingLink.rows[0].email !== legacy.email) {
            const e=Error("Account link conflict. Contact support.");e.status=409;throw e;
          }
          return respond(res,200,await issueSession(existingLink.rows[0]),origin);
        }
        let account=await pool.query("SELECT * FROM identity_accounts WHERE email=$1",[legacy.email]);
        if (!account.rows.length) {
          // Random, undisclosed password: subsequent password sign-in requires
          // the usual verified-email reset; Base44 password is never copied.
          const passHash=await hashPass(token());
          await pool.query(
            "INSERT INTO identity_accounts(id,email,password_hash,full_name,verified_at) VALUES($1,$2,$3,'',NOW()) ON CONFLICT(email) DO NOTHING",
            [randomUUID(),legacy.email,passHash]
          );
          account=await pool.query("SELECT * FROM identity_accounts WHERE email=$1",[legacy.email]);
        }
        if (!account.rows.length) {
          const e=Error("Could not recover account");e.status=503;throw e;
        }
        const user=account.rows[0];
        await pool.query(
          "UPDATE identity_accounts SET verified_at=COALESCE(verified_at,NOW()) WHERE id=$1",
          [user.id]
        );
        await pool.query(
          "INSERT INTO identity_base44_links(legacy_user_id,user_id) VALUES($1,$2) ON CONFLICT(legacy_user_id) DO NOTHING",
          [legacy.legacyId,user.id]
        );
        const link=await pool.query(
          "SELECT user_id FROM identity_base44_links WHERE legacy_user_id=$1",
          [legacy.legacyId]
        );
        if (link.rows[0]?.user_id !== user.id) {
          const e=Error("Account already linked elsewhere");e.status=409;throw e;
        }
        user.verified_at ||= new Date();
        return respond(res,200,await issueSession(user),origin);
      }
      return false;
    }
  };
}
