import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LifeBuoy, ArrowLeft, Mail, Send, RefreshCw, Inbox, Download, TicketCheck, ShieldCheck } from "lucide-react";
import SupportReleaseCenter from "@/components/mg/SupportReleaseCenter";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Shell({title,description,children,wide=false}) {
  return <main className="min-h-screen bg-background text-foreground p-4 sm:p-8">
    <div className={wide ? "mx-auto max-w-6xl" : "mx-auto max-w-2xl"}>
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-5">
        <ArrowLeft className="w-4 h-4"/> Media God
      </Link>
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><LifeBuoy className="w-6 h-6"/> {title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </header>
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">{children}</div>
    </div>
  </main>;
}
const fieldStyle = "w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";
function ErrorMessage({text}) { return text ? <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{text}</p> : null; }
function TextField({id,label,value,onChange,...props}) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>
    <Input id={id} className="h-11" value={value} onChange={e=>onChange(e.target.value)} {...props}/>
  </div>;
}
export function SupportPage() {
  const navigate=useNavigate();
  const [data,setData]=useState({name:"",email:"",category:"Playback",subject:"",device:"",details:"",website:""});
  const [busy,setBusy]=useState(false), [error,setError]=useState("");
  const set=(field,value)=>setData(old=>({...old,[field]:value}));
  const submit=async e=>{
    e.preventDefault();setBusy(true);setError("");
    try {
      const result=await base44.support.createTicket(data);
      if(!result.id||!result.key) throw Error("Ticket could not be created. Please retry.");
      navigate("/support/ticket/"+result.id+"?key="+encodeURIComponent(result.key),{replace:true});
    } catch(ex){setError(ex?.message||"Support temporarily unavailable. Please try again.");}
    finally{setBusy(false);}
  };
  return <Shell wide title="Support, updates & downloads" description="Everything you need for Media God in one place: official installers, latest releases and help from our support team.">
    <div className="grid gap-3 sm:grid-cols-3">
      <a href="#support-ticket-form" className="flex min-h-24 items-start gap-3 rounded-xl border border-mg-green/30 bg-mg-green/10 p-4 hover:border-mg-green/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mg-green">
        <TicketCheck className="mt-0.5 h-5 w-5 shrink-0 text-mg-green" />
        <span><strong className="block text-sm text-white">Open a support ticket</strong><span className="mt-1 block text-xs leading-5 text-white/60">Report a problem without signing in</span></span>
      </a>
      <a href="#support-downloads" className="flex min-h-24 items-start gap-3 rounded-xl border border-white/15 bg-white/[0.04] p-4 hover:border-mg-green/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mg-green">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-mg-green" />
        <span><strong className="block text-sm text-white">Latest app downloads</strong><span className="mt-1 block text-xs leading-5 text-white/60">Verified Android and Fire TV installers</span></span>
      </a>
      <Link to="/support/inbox" className="flex min-h-24 items-start gap-3 rounded-xl border border-white/15 bg-white/[0.04] p-4 hover:border-mg-green/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mg-green">
        <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-mg-green" />
        <span><strong className="block text-sm text-white">Staff ticket inbox</strong><span className="mt-1 block text-xs leading-5 text-white/60">For authorised Media God support administrators</span></span>
      </Link>
    </div>
    <section aria-labelledby="support-contact-title" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <h2 id="support-contact-title" className="flex items-center gap-2 text-xl font-bold text-white"><Mail className="h-5 w-5 text-mg-green" /> Contact the team</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Email support</h3>
          <a href="mailto:support@underworldhub.co.uk" className="mt-1 block break-all text-sm text-mg-green hover:underline">support@underworldhub.co.uk</a>
          <p className="mt-1 text-xs leading-5 text-white/60">Messages to this address create a support ticket automatically. Our staff can reply from the ticket inbox.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Account and verification emails</h3>
          <span className="mt-1 block break-all text-sm text-white/80">no-reply@underworldhub.co.uk</span>
          <p className="mt-1 text-xs leading-5 text-white/60">Used to send verification and password-reset links. This is a sending-only address; use the support email above for help.</p>
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-white/50"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mg-green" /> Each ticket has a private link emailed to the customer. Keep that link private to read messages and reply without needing to log in.</p>
    </section>
    <SupportReleaseCenter />
    <section id="support-ticket-form" aria-labelledby="support-ticket-title" className="scroll-mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <h2 id="support-ticket-title" className="text-xl font-bold text-white">Send a support request</h2>
      <p className="mb-5 mt-1 text-sm text-white/60">Tell us what happened. We will create your ticket and email you a private link to follow its progress.</p>
      <form onSubmit={submit} className="space-y-4">
      <TextField id="support-name" label="Your name (optional)" value={data.name} onChange={v=>set("name",v)} maxLength={100} autoComplete="name"/>
      <TextField id="support-email" label="Email address" type="email" value={data.email} onChange={v=>set("email",v)} required maxLength={254} autoComplete="email" placeholder="you@example.com"/>
      <div className="space-y-1.5"><Label htmlFor="support-category">Problem type</Label>
        <select id="support-category" className={fieldStyle} value={data.category} onChange={e=>set("category",e.target.value)}>
          {["Playback","Login or password","Android phone","Fire Stick or Android TV","Downloads","Live TV","Other"].map(v=><option key={v}>{v}</option>)}
        </select>
      </div>
      <TextField id="support-device" label="Device or app version (optional)" value={data.device} onChange={v=>set("device",v)} maxLength={100} placeholder="e.g. Fire TV Stick 4K, version 1.4.126"/>
      <TextField id="support-subject" label="Short description" value={data.subject} onChange={v=>set("subject",v)} maxLength={140} required minLength={3}/>
      <div className="space-y-1.5"><Label htmlFor="support-details">What happened?</Label>
        <textarea id="support-details" rows={6} className={fieldStyle} value={data.details} onChange={e=>set("details",e.target.value)} minLength={15} maxLength={5000} required placeholder="Tell us what you tried, what happened and any error messages. Please do not include passwords or API keys."/>
      </div>
      <div className="hidden" aria-hidden="true"><input tabIndex={-1} autoComplete="off" name="website" value={data.website} onChange={e=>set("website",e.target.value)}/></div>
      <ErrorMessage text={error}/>
      <Button className="w-full h-12" type="submit" disabled={busy}>
        {busy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin"/> : <Send className="w-4 h-4 mr-2"/>}
        {busy?"Submitting…":"Send support request"}
      </Button>
      <p className="text-xs text-muted-foreground">We'll email your ticket link. You can also use that link to reply to our support team directly on this website.</p>
      </form>
    </section>
  </Shell>;
}
function Thread({ticket}) {
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold text-lg">{ticket.subject}</h2>
      <span className="rounded-full border border-border px-3 py-1 text-xs capitalize">{ticket.status?.replace("_"," ")}</span>
    </div>
    <p className="text-xs text-muted-foreground">Ticket {ticket.id?.slice(0,8)} · {ticket.category} · {ticket.device||"Device not specified"}</p>
    <div className="space-y-3">
      {(ticket.messages||[]).map((item,i)=><div key={i} className={"rounded-lg border p-3 "+(item.author==="support"?"border-primary/30 bg-primary/5":"border-border bg-background")}>
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <strong>{item.author==="support"?"Media God Support":"Customer"}</strong>
          <span>{new Date(item.created_at).toLocaleString("en-GB")}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
      </div>)}
    </div>
  </div>;
}
export function SupportTicketPage() {
  const {id}=useParams();
  const [params]=useSearchParams();
  const key=params.get("key")||"";
  const [ticket,setTicket]=useState(null),[reply,setReply]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const reload=async()=>setTicket(await base44.support.ticket(id,key));
  useEffect(()=>{let active=true;base44.support.ticket(id,key).then(r=>{if(active)setTicket(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,key]);
  const submit=async e=>{
    e.preventDefault();setBusy(true);setError("");
    try{await base44.support.customerReply(id,key,reply);setReply("");await reload();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <Shell title="Your support ticket" description="Keep this private link safe. You can use it to send more details and read our replies without signing in.">
    <ErrorMessage text={error}/>
    {ticket ? <><Thread ticket={ticket}/><form onSubmit={submit} className="border-t border-border pt-4 space-y-3">
      <Label htmlFor="ticket-reply">Reply to support</Label>
      <textarea id="ticket-reply" rows={4} className={fieldStyle} value={reply} onChange={e=>setReply(e.target.value)} required maxLength={5000} placeholder="Add another message…"/>
      <Button type="submit" className="w-full h-11" disabled={busy}>{busy?"Sending…":"Send reply"}</Button>
    </form></> : !error && <p className="text-muted-foreground">Loading your ticket…</p>}
    <Link to="/support" className="block text-sm text-primary hover:underline">Create another support request</Link>
  </Shell>;
}
export function SupportInboxPage() {
  const [tickets,setTickets]=useState([]),[selected,setSelected]=useState(null),[reply,setReply]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const reload=async()=>{const result=await base44.support.staffTickets();setTickets(result.tickets||[]);};
  useEffect(()=>{let active=true;base44.support.staffTickets().then(r=>{if(active)setTickets(r.tickets||[]);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const choose=async id=>{
    setBusy(true);setError("");
    try{setSelected(await base44.support.staffTicket(id));}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const respond=async e=>{
    e.preventDefault();if(!selected)return;setBusy(true);setError("");
    try{await base44.support.staffReply(selected.id,reply);setReply("");setSelected(await base44.support.staffTicket(selected.id));await reload();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const status=async value=>{
    if(!selected)return;setBusy(true);setError("");
    try{await base44.support.staffStatus(selected.id,value);setSelected(await base44.support.staffTicket(selected.id));await reload();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <Shell title="Media God Support Inbox" description="Staff-only area. Customer support requests are stored independently in Media God's database.">
    <ErrorMessage text={error}/>
    {loading ? <p className="text-muted-foreground">Checking staff access…</p> : tickets.length===0 && !error ? <p>No support tickets yet.</p> : null}
    {error && /Sign in|Session expired|access only/i.test(error) ? <Link to="/login?returnTo=%2Fsupport%2Finbox" className="text-primary hover:underline">Sign in with your support-admin account</Link> : null}
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {tickets.map(t=><button type="button" key={t.id} onClick={()=>choose(t.id)} className={"text-left w-full p-3 rounded-lg border border-border hover:bg-accent "+(selected?.id===t.id?"bg-accent":"")}>
        <div className="flex justify-between gap-2 font-medium text-sm"><span>{t.subject}</span><span className="text-xs capitalize">{t.status?.replace("_"," ")}</span></div>
        <div className="text-xs text-muted-foreground mt-1">{t.requester_email} · {new Date(t.updated_at).toLocaleString("en-GB")}</div>
      </button>)}
    </div>
    {selected ? <section className="border-t border-border pt-4 space-y-4">
      <Thread ticket={selected}/>
      <p className="text-xs text-muted-foreground"><Mail className="w-3 h-3 inline mr-1"/> Reply to {selected.requester_email} from support@underworldhub.co.uk</p>
      <form onSubmit={respond} className="space-y-2"><Label htmlFor="staff-reply">Your reply</Label>
        <textarea id="staff-reply" rows={5} className={fieldStyle} required maxLength={5000} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write your response to the customer…"/>
        <Button className="w-full h-11" disabled={busy} type="submit"><Send className="w-4 h-4 mr-2"/> {busy?"Sending…":"Email reply to customer"}</Button>
      </form>
      <Button variant="outline" className="w-full" disabled={busy} onClick={()=>status(selected.status==="closed"?"open":"closed")}>{selected.status==="closed"?"Reopen ticket":"Close ticket"}</Button>
    </section> : null}
    <Link to="/support" className="text-sm text-primary hover:underline inline-flex gap-2 items-center"><Inbox className="w-4 h-4"/> Public support form</Link>
  </Shell>;
}
