import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import IndependentSocialButtons from "@/components/mg/IndependentSocialButtons";
import { safeReturnTo } from "@/lib/authReturnTo";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const { continueAsGuest } = useAuth();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  React.useEffect(() => {
    const reason=new URLSearchParams(window.location.search).get("social_error");
    if(!reason)return;
    const messages={
      not_configured:"This social login is not yet connected. Choose another sign-in method.",
      cancelled:"Social sign-in was cancelled. You can try again.",
      invalid_session:"The social login session expired. Please try again from this screen.",
      unavailable:"Social sign-in could not be completed. Please try again later."
    };
    setError(messages[reason] || "Social login could not be completed.");
    window.history.replaceState(null,"",window.location.pathname);
  },[]);

  const submit=async e=>{
    e.preventDefault();
    setLoading(true);setError("");
    try {
      await base44.auth.loginViaEmailPassword(email,password);
      window.location.assign(safeReturnTo());
    }catch(err){setError(err?.message||"Could not sign in");}
    finally{setLoading(false);}
  };
  return (
    <AuthLayout icon={LogIn} title="Welcome to Media God"
      subtitle="Sign in with your new Jaime Home account"
      footer={<>New here? <Link to="/register" className="text-primary font-medium hover:underline">Create a new account</Link></>}>
      <p className="mb-5 text-sm text-muted-foreground">
        We've moved to a new, independent account system. Previous sign-ins cannot be used here.
      </p>
      {error&&<p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <IndependentSocialButtons onError={setError} />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input id="email" type="email" autoComplete="username" value={email}
              onChange={e=>setEmail(e.target.value)} className="pl-10 h-12" required/>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input id="password" type="password" autoComplete="current-password" value={password}
              onChange={e=>setPassword(e.target.value)} className="pl-10 h-12" required/>
          </div>
          <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
        </div>
        <Button className="w-full h-12" type="submit" disabled={loading}>
          {loading?<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Signing in…</>:"Sign in"}
        </Button>
      </form>
      <Button type="button" variant="ghost" className="mt-5 w-full"
        onClick={()=>{continueAsGuest();window.location.assign("/");}}>Browse without signing in</Button>
    </AuthLayout>
  );
}
