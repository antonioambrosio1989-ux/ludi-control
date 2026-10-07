"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { auth } from "@/src/lib/firebase";

import {
  PushNotificationService,
} from "@/src/services/notifications/PushNotificationService";

export default function AdminLogoutButton() {
  const router = useRouter();

  const [isLoading, setIsLoading] =
    useState(false);

  async function handleLogout() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const currentUser =
        auth.currentUser;

      if (
        currentUser
      ) {
        try {
          await PushNotificationService.unregisterCurrentDevice({
            user:
              currentUser,
          });
        } catch (
          error
        ) {
          console.error(
            "Errore rimozione Push durante logout Admin:",
            error,
          );
        }
      }

      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error(
        "Errore durante la disconnessione:",
        error,
      );

      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="rounded-[13px] border border-[#06142E]/15 bg-white px-4 py-2 text-xs font-black uppercase text-[#06142E] transition active:scale-[0.98] disabled:opacity-40"
    >
      {isLoading ? "Uscita..." : "Esci"}
    </button>
  );
}