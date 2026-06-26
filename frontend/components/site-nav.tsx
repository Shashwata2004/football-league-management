"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { UserRole, type ProfileDto } from "@flms/shared";
import { api } from "@/lib/api";
import { clearAuth, getStoredProfile } from "@/lib/auth";
import { Button } from "./ui/button";

export function SiteNav() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setProfile(getStoredProfile());
    api<{ profile: ProfileDto }>("/me")
      .then((data) => setProfile(data.profile))
      .catch(() => setProfile(null));
  }, []);

  function signOut() {
    clearAuth();
    window.location.href = "/";
  }

  if (
    pathname === "/login" ||
    pathname.startsWith("/dashboard/admin") ||
    pathname.startsWith("/dashboard/manager") ||
    pathname.startsWith("/manager")
  ) {
    return null;
  }

  return (
    <header className="border-b border-slate-200 bg-white text-slate-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-semibold text-slate-950">
          Football League MS
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-700">
          <Link className="hover:text-slate-950" href="/public">Public</Link>
          {profile?.role === UserRole.MANAGER || profile?.role === UserRole.ADMIN ? <Link className="hover:text-slate-950" href="/dashboard/manager">Manager</Link> : null}
          {profile?.role === UserRole.ADMIN ? <Link className="hover:text-slate-950" href="/dashboard/admin">Admin</Link> : null}
          {profile ? (
            <Button className="bg-slate-900" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <Link className="hover:text-slate-950" href="/login">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
