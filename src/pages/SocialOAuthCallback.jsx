import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";

export default function SocialOAuthCallback() {
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("Completing your secure Media God sign-in…");
  useEffect(() => {
    // OAuth exchange tickets arrive only in a URL fragment so they aren't
    // transmitted to website servers, proxies or HTTP referrer headers.
    const params = new URLSearchParams(window.location.hash.slice(1));
    const ticket = params.get("ticket") || "";
    window.history.replaceState(null, "", window.location.pathname);
    if (!ticket) {
      setStatus("error");
      setMessage("Social login was interrupted. Start it again from the welcome screen.");
      return;
    }
    let active = true;
    base44.auth.exchangeSocialTicket(ticket).then(() => {
      if (!active) return;
      let target = "/";
      try {
        if (window.sessionStorage.getItem("mg:social-return-path") === "/device-login") {
          target = "/device-login";
        }
        window.sessionStorage.removeItem("mg:social-return-path");
      } catch { /* Never trust arbitrary external redirect destinations. */ }
      window.location.replace(target);
    }).catch(error => {
      if (!active) return;
      setStatus("error");
      setMessage(error?.message || "Social sign-in was not completed. Please try again.");
    });
    return () => { active = false; };
  }, []);
  return (
    <AuthLayout icon={ShieldCheck} title="Secure social sign-in" subtitle="Jaime Home Media God account">
      {status === "verifying" ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />{message}
        </p>
      ) : (
        <>
          <p role="alert" className="mb-4 text-sm">{message}</p>
          <Link className="text-primary underline" to="/login">Back to sign in</Link>
        </>
      )}
    </AuthLayout>
  );
}
