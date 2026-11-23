import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LifeBuoy, ArrowLeft, Mail, Send, RefreshCw, Inbox } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Shell({title,description,children}) {
  return <main className="min-h-screen bg-background text-foreground p-4 sm:p-8">
    <div className="mx-auto max-w-2xl">
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
  return <Shell title="Contact Media God Support" description="Tell us about a problem with the website, Android app, Fire Stick, account or playback. No login is required.">
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
