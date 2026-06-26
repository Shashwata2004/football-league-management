"use client";

import { FormEvent, ReactNode, useState } from "react";
import { ChevronRight, Eye, EyeOff, Shield, Trophy, User, Users } from "lucide-react";
import type { ProfileDto } from "@flms/shared";
import { api } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

type Role = "admin" | "manager" | "fan";
type View = "login" | "signup";

const roles: { id: Role; label: string; sub: string; icon: ReactNode; loginEmail: string; signupName: string }[] = [
  {
    id: "admin",
    label: "Admin",
    sub: "League commissioner",
    icon: <Shield size={20} />,
    loginEmail: "admin@scoreline.com",
    signupName: "Alex Rivera"
  },
  {
    id: "manager",
    label: "Team Manager",
    sub: "Club staff & coaches",
    icon: <Users size={20} />,
    loginEmail: "coach@cityfc.com",
    signupName: "Jordan Reyes"
  },
  {
    id: "fan",
    label: "Fan",
    sub: "Players & supporters",
    icon: <User size={20} />,
    loginEmail: "you@scoreline.com",
    signupName: "Sam Torres"
  }
];

function activeRole(role: Role) {
  return roles.find((item) => item.id === role)!;
}

function FieldLines() {
  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-10"
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="30" y="40" width="340" height="520" stroke="#b3ff00" strokeWidth="2" />
      <line x1="30" y1="300" x2="370" y2="300" stroke="#b3ff00" strokeWidth="1.5" />
      <circle cx="200" cy="300" r="60" stroke="#b3ff00" strokeWidth="1.5" />
      <circle cx="200" cy="300" r="4" fill="#b3ff00" />
      <rect x="100" y="40" width="200" height="90" stroke="#b3ff00" strokeWidth="1.5" />
      <rect x="145" y="40" width="110" height="40" stroke="#b3ff00" strokeWidth="1.5" />
      <rect x="100" y="470" width="200" height="90" stroke="#b3ff00" strokeWidth="1.5" />
      <rect x="145" y="520" width="110" height="40" stroke="#b3ff00" strokeWidth="1.5" />
      <path d="M 30 40 Q 50 40 50 60" stroke="#b3ff00" strokeWidth="1" />
      <path d="M 370 40 Q 350 40 350 60" stroke="#b3ff00" strokeWidth="1" />
      <path d="M 30 560 Q 50 560 50 540" stroke="#b3ff00" strokeWidth="1" />
      <path d="M 370 560 Q 350 560 350 540" stroke="#b3ff00" strokeWidth="1" />
      <circle cx="200" cy="155" r="3" fill="#b3ff00" />
      <circle cx="200" cy="445" r="3" fill="#b3ff00" />
      <path d="M 125 130 Q 200 180 275 130" stroke="#b3ff00" strokeWidth="1.5" fill="none" />
      <path d="M 125 470 Q 200 420 275 470" stroke="#b3ff00" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="flex flex-col gap-1.5">
      <label className="scoreline-condensed text-xs font-bold uppercase tracking-[0.22em] text-[#82a982]">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-lg border border-[#b3ff00]/15 bg-[#172617] px-4 pr-11 text-sm text-[#f0f5f0] placeholder:text-[#6f906f]/55 outline-none transition focus:border-[#b3ff00]/60 focus:ring-1 focus:ring-[#b3ff00]/30"
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#82a982] transition hover:text-[#b3ff00]"
            onClick={() => setShow((value) => !value)}
            tabIndex={-1}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RolePills({ selected, onChange }: { selected: Role; onChange: (role: Role) => void }) {
  return (
    <div className="mb-6 grid grid-cols-3 gap-2">
      {roles.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`scoreline-condensed rounded-lg border px-1 py-2 text-xs font-black uppercase tracking-[0.2em] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
            selected === id
              ? "border-[#b3ff00] bg-[#b3ff00] text-[#081008] shadow-[0_0_22px_rgba(179,255,0,0.25)]"
              : "border-[#b3ff00]/15 bg-[#182418]/45 text-[#82a982] hover:border-[#b3ff00]/55 hover:bg-[#b3ff00]/10 hover:text-[#f0f5f0] hover:shadow-[0_0_18px_rgba(179,255,0,0.12)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function RoleDetail({ role }: { role: Role }) {
  const item = activeRole(role);
  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-[#b3ff00]/20 bg-[#b3ff00]/5 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b3ff00]/15 text-[#b3ff00]">{item.icon}</div>
      <div>
        <p className="scoreline-condensed text-sm font-black uppercase tracking-wide text-[#f0f5f0]">{item.label}</p>
        <p className="scoreline-mono text-xs text-[#82a982]">{item.sub}</p>
      </div>
    </div>
  );
}

function AuthForm({
  view,
  role,
  onSuccess
}: {
  view: View;
  role: Role;
  onSuccess: (profile: ProfileDto) => void;
}) {
  const item = activeRole(role);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(role === "admin" && view === "login" ? "admin@scoreline.com" : "");
  const [password, setPassword] = useState(role === "admin" && view === "login" ? "1234" : "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function validEmail(value: string) {
    return value.includes("@") && value.toLowerCase().endsWith(".com");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!validEmail(email)) {
      setMessage("Use an email containing @ and ending with .com.");
      return;
    }
    if (view === "signup" && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ token: string; profile: ProfileDto }>(view === "login" ? "/login" : "/signup", {
        method: "POST",
        body: JSON.stringify({
          mode: role,
          full_name: fullName || undefined,
          email,
          password
        })
      });
      saveAuth(data.token, data.profile);
      onSuccess(data.profile);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {view === "signup" ? (
        <InputField
          label="Full Name"
          type="text"
          value={fullName}
          onChange={setFullName}
          placeholder={item.signupName}
          autoComplete="name"
        />
      ) : null}

      <InputField
        label="Email"
        type="text"
        value={email}
        onChange={setEmail}
        placeholder={item.loginEmail}
        autoComplete="email"
      />

      <InputField
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder={view === "login" ? "••••••••" : "Create a strong password"}
        autoComplete={view === "login" ? "current-password" : "new-password"}
      />

      {view === "signup" ? (
        <InputField
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat password"
          autoComplete="new-password"
        />
      ) : (
        <div className="flex justify-end">
          <button type="button" className="scoreline-mono text-xs text-[#b3ff00] transition hover:text-[#d7ff72] hover:drop-shadow-[0_0_8px_rgba(179,255,0,0.55)]">
            Forgot password?
          </button>
        </div>
      )}

      {message ? <p className="scoreline-mono text-xs text-red-300">{message}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="scoreline-condensed group mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#b3ff00] py-3.5 text-base font-black uppercase tracking-[0.18em] text-[#081008] shadow-[0_10px_26px_rgba(179,255,0,0.18)] transition-all duration-200 hover:-translate-y-1 hover:bg-[#c6ff34] hover:shadow-[0_16px_42px_rgba(179,255,0,0.34)] active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
      >
        {loading ? "Please wait" : view === "login" ? "Sign In" : "Create Account"}
        <ChevronRight className="transition-transform duration-200 group-hover:translate-x-1" size={18} />
      </button>
    </form>
  );
}

export default function LoginPage() {
  const [view, setView] = useState<View>("login");
  const [role, setRole] = useState<Role>("fan");
  const heading =
    view === "login" ? (
      <>
        Welcome
        <br />
        <span className="text-[#b3ff00]">Back</span>
      </>
    ) : (
      <>
        Join the
        <br />
        <span className="text-[#b3ff00]">League</span>
      </>
    );

  function changeView(nextView: View) {
    setView(nextView);
    if (nextView === "signup" && role === "admin") {
      setRole("manager");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex min-h-screen bg-[#080d08] text-[#f0f5f0]">
      <style jsx global>{`
        .scoreline-condensed {
          font-family: "Barlow Condensed", sans-serif;
        }
        .scoreline-mono {
          font-family: "DM Mono", monospace;
        }
      `}</style>

      <div className="relative hidden flex-1 overflow-hidden bg-[#061006] lg:flex lg:flex-col">
        <FieldLines />
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent to-[#080d08]/60" />
        <div className="relative z-20 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b3ff00]">
              <Trophy size={18} className="text-[#081008]" />
            </div>
            <span className="scoreline-condensed text-xl font-black uppercase tracking-[0.18em] text-[#f0f5f0]">Scoreline</span>
          </div>

          <div className="flex max-w-sm flex-col gap-4">
            <p className="scoreline-condensed text-[4.5rem] font-black uppercase leading-none tracking-[-0.02em] text-[#f0f5f0]">
              The <span className="text-[#b3ff00]">Beautiful</span> Game, <span className="block">Managed.</span>
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-[#82a982]">
              League standings, fixtures, player stats, and match reports — all in one platform for admins, managers, and fans.
            </p>
          </div>

          <div className="flex flex-col gap-3">
          {roles.map(({ id, label, sub, icon }) => (
              <div key={id} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#b3ff00]/20 bg-[#b3ff00]/10 text-[#b3ff00]">
                  <span className="scale-75">{icon}</span>
                </div>
                <div>
                  <span className="scoreline-condensed text-xs font-black uppercase tracking-[0.18em] text-[#f0f5f0]">{label}</span>
                  <span className="ml-2 text-xs text-[#82a982]">— {sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-screen w-full flex-col justify-center overflow-y-auto border-l border-[#b3ff00]/15 bg-[#080d08] px-8 py-12 sm:px-14 lg:w-[500px] xl:w-[540px]">
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#b3ff00]">
            <Trophy size={16} className="text-[#081008]" />
          </div>
          <span className="scoreline-condensed text-lg font-black uppercase tracking-[0.18em] text-[#f0f5f0]">Scoreline</span>
        </div>

        <div className="mb-6">
          <h1 className="scoreline-condensed text-5xl font-black uppercase leading-none tracking-[-0.01em] text-[#f0f5f0]">{heading}</h1>
          <p className="mt-2 text-sm text-[#82a982]">
            {view === "login" ? "Sign in to access your league dashboard." : "Create your account and choose your role."}
          </p>
        </div>

        {view === "login" ? (
          <RolePills selected={role} onChange={setRole} />
        ) : (
          <div className="mb-6 grid grid-cols-2 gap-2">
            {roles
              .filter((item) => item.id !== "admin")
              .map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRole(id)}
                  className={`scoreline-condensed rounded-lg border px-1 py-2 text-xs font-black uppercase tracking-[0.2em] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
                    role === id
                      ? "border-[#b3ff00] bg-[#b3ff00] text-[#081008] shadow-[0_0_22px_rgba(179,255,0,0.25)]"
                      : "border-[#b3ff00]/15 bg-[#182418]/45 text-[#82a982] hover:border-[#b3ff00]/55 hover:bg-[#b3ff00]/10 hover:text-[#f0f5f0] hover:shadow-[0_0_18px_rgba(179,255,0,0.12)]"
                  }`}
                >
                  {label}
                </button>
              ))}
          </div>
        )}
        <RoleDetail role={role} />
        <AuthForm
          key={`${view}-${role}`}
          view={view}
          role={role}
          onSuccess={(profile) => {
            if (profile.role === "ADMIN") window.location.href = "/dashboard/admin";
            else if (profile.role === "MANAGER") window.location.href = "/dashboard/manager";
            else window.location.href = "/public";
          }}
        />

        <p className="mt-6 text-center text-xs text-[#82a982]">
          {view === "login" ? "No account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => changeView(view === "login" ? "signup" : "login")}
            className="font-semibold text-[#b3ff00] transition hover:text-[#d7ff72] hover:drop-shadow-[0_0_8px_rgba(179,255,0,0.55)]"
          >
            {view === "login" ? "Register here" : "Sign in"}
          </button>
        </p>

        <p className="scoreline-mono mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-[#82a982]/50">
          Scoreline © 2026 · All Rights Reserved
        </p>
      </div>
    </div>
  );
}
