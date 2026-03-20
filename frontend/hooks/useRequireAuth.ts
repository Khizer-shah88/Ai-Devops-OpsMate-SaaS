"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import type { User } from "@/types";

const USER_KEY = "devmate_user";

export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.replace("/auth");
      return;
    }

    const rawUser = localStorage.getItem(USER_KEY);
    if (!rawUser) return;

    try {
      const parsed = JSON.parse(rawUser) as User;
      setUser(parsed);
    } catch {
      localStorage.removeItem(USER_KEY);
    }
  }, [router]);

  return useMemo(() => ({ user }), [user]);
}
