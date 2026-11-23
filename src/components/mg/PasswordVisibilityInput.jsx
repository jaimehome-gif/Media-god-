import React, { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Passwords remain hidden unless the user explicitly taps Show.
 * The control never reads, stores, sends or logs the password itself.
 */
export default function PasswordVisibilityInput({
  id,
  label = "password",
  className = "",
  ...props
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
      <Input
        {...props}
        id={id}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`pl-10 pr-14 h-12 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible(value => !value)}
        aria-label={`${visible ? "Hide" : "Show"} ${label}`}
        aria-pressed={visible}
        aria-controls={id}
        title={`${visible ? "Hide" : "Show"} ${label}`}
        className="absolute right-1 top-1/2 flex h-10 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
