import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import { MailCheck, Loader2 } from "lucide-react";
export default function VerifyEmail(){
  const [params]=useSearchParams();
  const token=params.get("token")||"";
  const [status,setStatus]=useState("checking");
  const [message,setMessage]=useState("");
  useEffect(()=>{
    if(!token){setStatus("error");setMessage("Missing verification token");return;}
    let active=true;
    base44.auth.verifyEmail(token).then(()=>{
      if(active){setStatus("ok");setMessage("Your new Media God account is ready. You can sign in.");}
    }).catch(err=>{
      if(active){setStatus("error");setMessage(err?.message||"Verification failed");}
    });
    return()=>{active=false;};
  },[token]);
  return (
    <AuthLayout icon={MailCheck} title="Verify your email" subtitle="Jaime Home account">
      {status==="checking"?<p className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/>Checking your link…</p>:(
        <p role="status" className="mb-4 text-sm">{message}</p>
      )}
      <Link className="text-primary underline" to="/login">Go to Media God sign in</Link>
    </AuthLayout>
  );
}
