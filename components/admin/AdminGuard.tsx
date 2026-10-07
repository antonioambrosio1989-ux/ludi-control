"use client";

import {
  useEffect,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/src/hooks/useAuth";

type Props = {
  children:
    React.ReactNode;
};

/*
 * ============================================================
 * ADMIN GUARD
 * ============================================================
 */

export default function AdminGuard({
  children,
}: Props) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const {
    user,
    isAdmin,
    isLoading,
  } =
    useAuth();

  /*
   * ==========================================================
   * PAGINA LOGIN
   * ==========================================================
   */

  const isLoginPage =
    pathname ===
    "/admin/login";

  /*
   * ==========================================================
   * PROTEZIONE AREA ADMIN
   * ==========================================================
   */

  useEffect(() => {
    /*
     * La pagina Login deve rimanere
     * pubblicamente raggiungibile.
     */

    if (
      isLoginPage ||
      isLoading
    ) {
      return;
    }

    /*
     * ========================================================
     * NON AUTENTICATO
     * ========================================================
     */

    if (
      !user
    ) {
      router.replace(
        "/admin/login",
      );

      return;
    }

    /*
     * ========================================================
     * AUTENTICATO MA NON ADMIN
     * ========================================================
     *
     * È il caso tipico futuro
     * dell'utente Games.
     * ========================================================
     */

    if (
      !isAdmin
    ) {
      router.replace(
        "/admin/login",
      );
    }
  }, [
    isLoginPage,
    isLoading,
    user,
    isAdmin,
    router,
  ]);

  /*
   * ==========================================================
   * LOGIN
   * ==========================================================
   */

  if (
    isLoginPage
  ) {
    return children;
  }

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  if (
    isLoading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F5F2]">
        <p className="font-black text-[#06142E]">
          Verifica autorizzazione...
        </p>
      </main>
    );
  }

  /*
   * ==========================================================
   * NON AUTORIZZATO
   * ==========================================================
   */

  if (
    !user ||
    !isAdmin
  ) {
    return null;
  }

  /*
   * ==========================================================
   * ADMIN AUTORIZZATO
   * ==========================================================
   */

  return children;
}