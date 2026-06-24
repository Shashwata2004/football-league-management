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

  if (pathname === "/login") return null;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-semibold">
          Football League MS
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/public">Public</Link>
          {profile?.role === UserRole.MANAGER || profile?.role === UserRole.ADMIN ? <Link href="/dashboard/manager">Manager</Link> : null}
          {profile?.role === UserRole.ADMIN ? <Link href="/dashboard/admin">Admin</Link> : null}
          {profile ? (
            <Button className="bg-slate-900" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <Link href="/login">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
