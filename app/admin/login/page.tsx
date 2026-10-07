"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "@/src/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      router.replace("/admin");
    } catch (currentError) {
      console.error(
        "Errore login Admin:",
        currentError,
      );

      setError(
        "Email o password non corretti.",
      );

      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F5F2] p-5">
      <section className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-[0_20px_60px_rgba(6,20,46,0.14)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
          Ludi Control
        </p>

        <h1 className="mt-2 text-3xl font-black uppercase text-[#06142E]">
          Centro di Controllo
        </h1>

        <p className="mt-2 text-sm font-bold text-[#06142E]/50">
          Accesso riservato agli amministratori della Ludis League.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-7 space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-xs font-black uppercase text-[#06142E]/55"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
              className="ludi-input"
              placeholder="admin@email.it"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-xs font-black uppercase text-[#06142E]/55"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
              className="ludi-input"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-[13px] border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700">
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="ludi-button-primary w-full"
          >
            {isLoading
              ? "Accesso in corso..."
              : "Accedi"}
          </button>
        </form>
      </section>
    </main>
  );
}