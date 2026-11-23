import { randomUUID, randomBytes, createHash, timingSafeEqual } from "node:crypto";

// Independent Media God helpdesk: tickets are stored in PostgreSQL.
// Customers reply using unguessable ticket links; staff reply from support@
// through Resend. This does not depend on a separate inbound mailbox.
export async function createSupport({ pool, requireUser, emailSend, site }) {
  const adminEmails = new Set(String(process.env.SUPPORT_ADMIN_EMAILS || "")
    .split(",").map(x => x.trim().toLowerCase()).filter(Boolean));
  const alertTo = String(process.env.SUPPORT_ALERT_EMAIL || "").trim().toLowerCase();
  const supportFrom = String(process.env.SUPPORT_EMAIL_FROM || "Media God Support <support@underworldhub.co.uk>");
  const hash = x => createHash("sha256").update(x).digest("hex");
  const newKey = () => randomBytes(24).toString("base64url");
  const recent = new Map();
  const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
  const clean = (v, max) => String(v || "").trim().slice(0, max + 1);
  const safeBody = (value, max = 5000) => {
    const out = clean(value, max);
    if (!out || out.length > max) fail(400, "Message must be 1 to " + max + " characters.");
    return out;
  };
  const sendNotice = async (to, subject, body, from = supportFrom) => {
    try { await emailSend(to, subject, body, { from }); return true; }
    catch { console.error("[support] Could not send email notification"); return false; }
  };
  await pool.query("CREATE TABLE IF NOT EXISTS support_tickets (id UUID PRIMARY KEY, requester_email TEXT NOT NULL, requester_name TEXT NOT NULL DEFAULT '', category TEXT NOT NULL, subject TEXT NOT NULL, device TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE INDEX IF NOT EXISTS support_tickets_updated_idx ON support_tickets(updated_at DESC)");
  await pool.query("CREATE TABLE IF NOT EXISTS support_ticket_keys (ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE, key_hash TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(ticket_id,key_hash))");
  await pool.query("CREATE TABLE IF NOT EXISTS support_messages (id UUID PRIMARY KEY, ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE, author TEXT NOT NULL CHECK(author IN ('customer','support')), body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages(ticket_id,created_at)");
  const isAdmin = u => adminEmails.has(String(u?.email || "").toLowerCase());
  const admin = async req => {
    const user = await requireUser(req);
    if (!isAdmin(user)) fail(403, "Support staff access only.");
    return user;
  };
  const verifyKey = async (id, value) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(value)) fail(403, "Invalid support ticket link.");
    const keyHash = hash(value);
    const { rows } = await pool.query("SELECT key_hash FROM support_ticket_keys WHERE ticket_id=$1 AND key_hash=$2", [id,keyHash]);
    if (!rows.length || !timingSafeEqual(Buffer.from(rows[0].key_hash, "hex"), Buffer.from(keyHash, "hex"))) fail(403,"Invalid support ticket link.");
  };
  const view = async id => {
    const {rows} = await pool.query("SELECT * FROM support_tickets WHERE id=$1", [id]);
    if (!rows.length) fail(404, "Ticket not found.");
    const messages = await pool.query("SELECT author,body,created_at FROM support_messages WHERE ticket_id=$1 ORDER BY created_at,id", [id]);
    return { ...rows[0], messages: messages.rows };
  };
  const addKey = async id => {
    const key = newKey();
    await pool.query("INSERT INTO support_ticket_keys(ticket_id,key_hash) VALUES($1,$2)", [id,hash(key)]);
    return key;
  };
  const link = (id,key) => site + "/support/ticket/" + id + "?key=" + encodeURIComponent(key);
  const throttle = (req,email) => {
    const now = Date.now();
    const label = hash(String(req.socket.remoteAddress || "") + ":" + email);
    const old = recent.get(label);
    const entry = old && old.until > now ? old : { count: 0, until: now + 15*60*1000 };
    entry.count++;
    recent.set(label,entry);
    if (recent.size > 2000) for (const [k,v] of recent) if (v.until < now) recent.delete(k);
    if (entry.count > 3) fail(429, "Too many support requests. Please try again later.");
  };
  async function handle(req,res,path,body,origin,respond) {
    if (path === "/support/tickets" && req.method === "POST") {
      // Hidden honeypot field; never send mail for bots.
      if (body.website) return respond(res,200,{ok:true},origin);
      const email = clean(body.email,254).toLowerCase();
      if (!emailRe.test(email) || email.length>254) fail(400,"Enter a valid email address.");
      const subject = safeBody(body.subject,140);
      const details = safeBody(body.details,5000);
      if (details.length < 15) fail(400,"Please describe the problem in at least 15 characters.");
      const name = clean(body.name,100), category=clean(body.category,40)||"General";
      const device = clean(body.device,100);
      if ([name,category,device].some(v=>v.length>100)) fail(400,"Form field too long.");
      throttle(req,email);
      const id = randomUUID();
      await pool.query("INSERT INTO support_tickets(id,requester_email,requester_name,category,subject,device) VALUES($1,$2,$3,$4,$5,$6)",[id,email,name,category,subject,device]);
      await pool.query("INSERT INTO support_messages(id,ticket_id,author,body) VALUES($1,$2,'customer',$3)",[randomUUID(),id,details]);
      const key = await addKey(id);
      const publicLink = link(id,key);
      const ack = await sendNotice(email,"Media God support request received ("+id.slice(0,8)+")","We've received your support request.\nTicket: "+id+"\nSubject: "+subject+"\nYou can view your ticket and send more details here:\n"+publicLink+"\n\nMedia God Support");
      if (alertTo) await sendNotice(alertTo,"New Media God support ticket ("+id.slice(0,8)+")","A new support request was received.\nFrom: "+email+"\nCategory: "+category+"\nSubject: "+subject+"\nDevice: "+device+"\n\nSign in to reply: "+site+"/support/inbox");
      return respond(res,201,{id,key,confirmation_email_accepted:ack},origin);
    }
    const userTicket = /^\/support\/tickets\/([a-f\d-]{36})(?:\/reply)?$/.exec(path);
    if (userTicket) {
      const id=userTicket[1];
      if (!uuid.test(id)) fail(404,"Ticket not found.");
      const isReply = path.endsWith("/reply");
      const key = isReply ? body.key : new URL(req.url,"http://localhost").searchParams.get("key");
      await verifyKey(id,key);
      if (req.method === "GET" && !isReply) return respond(res,200,await view(id),origin);
      if (req.method === "POST" && isReply) {
        const message = safeBody(body.message,5000);
        const current=await view(id);
        await pool.query("INSERT INTO support_messages(id,ticket_id,author,body) VALUES($1,$2,'customer',$3)",[randomUUID(),id,message]);
        await pool.query("UPDATE support_tickets SET status='open',updated_at=NOW() WHERE id=$1",[id]);
        if (alertTo) await sendNotice(alertTo,"Customer replied to ticket "+id.slice(0,8),"The customer replied to: "+current.subject+"\n\nSign in: "+site+"/support/inbox");
        return respond(res,201,{ok:true},origin);
      }
    }
    if (path === "/support/admin/tickets" && req.method === "GET") {
      await admin(req);
      const {rows} = await pool.query("SELECT id,requester_email,requester_name,category,subject,device,status,created_at,updated_at FROM support_tickets ORDER BY updated_at DESC LIMIT 100");
      return respond(res,200,{tickets:rows},origin);
    }
    const staff = /^\/support\/admin\/tickets\/([a-f\d-]{36})(?:\/(reply|status))?$/.exec(path);
    if (staff) {
      const [,id,action] = staff;
      if (!uuid.test(id)) fail(404,"Ticket not found.");
      await admin(req);
      if (!action && req.method === "GET") return respond(res,200,await view(id),origin);
      if (action === "reply" && req.method === "POST") {
        const message = safeBody(body.message,5000);
        const ticket = await view(id);
        // Rotate only this reply's link; old links remain valid.
        const newToken = await addKey(id);
        const delivered = await sendNotice(ticket.requester_email,
          "Media God Support reply - ticket "+id.slice(0,8),
          "Media God Support has replied:\n\n"+message+"\n\nView and reply to your ticket:\n"+link(id,newToken)+"\n\nTicket: "+id);
        if (!delivered) fail(503,"Email provider could not accept this reply. Please try again.");
        await pool.query("INSERT INTO support_messages(id,ticket_id,author,body) VALUES($1,$2,'support',$3)",[randomUUID(),id,message]);
        await pool.query("UPDATE support_tickets SET status='awaiting_customer',updated_at=NOW() WHERE id=$1",[id]);
        return respond(res,201,{ok:true},origin);
      }
      if (action === "status" && req.method === "POST") {
        if (!["open","closed"].includes(body.status)) fail(400,"Invalid ticket status.");
        await pool.query("UPDATE support_tickets SET status=$2,updated_at=NOW() WHERE id=$1",[id,body.status]);
        return respond(res,200,{ok:true},origin);
      }
    }
    fail(404,"Unknown support route.");
  }
  return {handle};
}
