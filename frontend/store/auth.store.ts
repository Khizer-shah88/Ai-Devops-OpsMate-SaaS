"use client";

import { setToken, clearToken } from "@/lib/auth";
import type { User } from "@/lib/types";

const USER_KEY = "devmate_user";

function saveUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function removeUser() {
  localStorage.removeItem(USER_KEY);
}

export function useAuthStore() {
  const setAuth = (user: User, accessToken: string) => {
    setToken(accessToken);
    saveUser(user);
  };

  const clearAuth = () => {
    clearToken();
    removeUser();
  };

  return {
    setAuth,
    clearAuth,
  };
}
