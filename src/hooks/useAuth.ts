"use client";

import {
  useAuthContext,
} from "@/src/contexts/AuthContext";

/*
 * ============================================================
 * AUTH
 * ============================================================
 */

export function useAuth() {
  return useAuthContext();
}