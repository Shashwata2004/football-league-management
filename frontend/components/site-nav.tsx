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
    pathname.startsWith("/dashboard/fan") ||
    pathname.startsWith("/manager")
  ) {
    return null;
  }

  return (
    <header className="border-b border-slate-200 bg-white text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:py-4">
        <Link href="/" className="min-w-0 font-semibold text-slate-950">
          Football League MS
        </Link>
        <nav aria-label="Primary navigation" className="flex max-w-full flex-wrap items-center justify-end gap-2 text-sm text-slate-700 sm:gap-4">
          <Link className="hover:text-slate-950" href="/public">Public</Link>
          {profile?.role === UserRole.USER ? <Link className="hover:text-slate-950" href="/dashboard/fan">My Dashboard</Link> : null}
          {profile?.role === UserRole.MANAGER || profile?.role === UserRole.ADMIN ? <Link className="hover:text-slate-950" href="/dashboard/manager">Manager</Link> : null}
          {profile?.role === UserRole.ADMIN ? <Link className="hover:text-slate-950" href="/dashboard/admin">Admin</Link> : null}
          {profile ? (
            <Button className="bg-slate-900 px-3 sm:px-4" onClick={signOut}>
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
