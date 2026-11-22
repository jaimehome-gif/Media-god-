import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Mail } from "lucide-react";

export default function Register() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [again,setAgain]=useState("");
  const [pending,setPending]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [registration,setRegistration]=useState("checking");
  useEffect(()=>{
    let active=true;
    base44.auth.getRegistrationConfig()
      .then(result=>{if(active)setRegistration(result?.registration_ready===true?"ready":"waiting");})
      .catch(()=>{if(active)setRegistration("unknown");});
    return ()=>{active=false;};
  },[]);

  const submit=async event=>{
    event.preventDefault();
    if(registration!=="ready"){setError("New Media God registrations are not open yet. The verification email service is being connected.");return;}
    if(password!==again){setError("Passwords do not match");return;}
    if(password.length<12){setError("Use at least 12 characters");return;}
    setBusy(true);setError("");
    try {
      await base44.auth.register({email,password});
      setPending(true);
    }catch(err){setError(err?.message||"Could not create account");}
    finally{setBusy(false);}
  };
  const resend=async()=>{
    setBusy(true);setError("");
    try { await base44.auth.resendOtp(email); }
    catch(err){setError(err?.message||"Could not resend verification");}
    finally{setBusy(false);}
  };
  return (
    <AuthLayout icon={UserPlus} title={pending?"Check your email":"Create Media God account"}
      subtitle={pending?"Verify your email to activate your new account":"Jaime Home independent registration"}
      footer={<Link to="/login" className="text-primary font-medium hover:underline">Already registered? Sign in</Link>}>
      {error&&<p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {registration!=="ready" && !pending && (
        <div role="status" className="mb-4 rounded-md border border-border p-3 text-sm text-muted-foreground">
          {registration==="checking"
            ? "Checking whether new Media God registrations are ready…"
            : registration==="waiting"
              ? "We're preparing verification emails for the independent Media God system. Sign-up will open once email delivery is confirmed; you can browse without an account meanwhile."
              : "Registration status is temporarily unavailable. Please return to this page later."}
        </div>
      )}
      {pending?(
        <div className="space-y-4 text-center">
          <Mail className="mx-auto h-12 w-12 text-primary"/>
          <p className="text-sm">We sent a verification link to <strong>{email}</strong>. Open it before signing in.</p>
          <p className="text-sm text-muted-foreground">Each person needs a new Media God account. Your old login and Real-Debrid connection will not transfer automatically.</p>
          <Button disabled={busy} variant="outline" onClick={resend} className="w-full">Resend verification</Button>
          <Link to="/login" className="block text-primary underline">Back to sign in</Link>
        </div>
      ):(
        <form className="space-y-4" onSubmit={submit}>
          <div><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
          <div><Label htmlFor="password">New password (at least 12 characters)</Label><Input id="password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} required/></div>
          <div><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" autoComplete="new-password" value={again} onChange={e=>setAgain(e.target.value)} required/></div>
          <Button type="submit" disabled={busy || registration!=="ready"} className="w-full h-12">{busy?<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Creating…</>:"Create account"}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
