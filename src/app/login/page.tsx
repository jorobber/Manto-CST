"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { localService } from "@/lib/local/service";

const demoUsers = [
  { role: "ADMIN", email: "admin@cst-manto.local", password: "Admin#2026" },
  { role: "OPERATOR", email: "yard@cst-manto.local", password: "Yard#2026" },
  { role: "MECHANIC", email: "mech@cst-manto.local", password: "Mech#2026" }
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localService.initialize();
    const sessionUser = localService.getSessionUser();
    if (sessionUser) {
      router.replace("/");
    }
  }, [router]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      localService.login({ email, password });
      router.replace("/");
    } catch (loginError) {
      setError(String(loginError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[540px] items-center px-4 py-8">
      <section className="glass w-full rounded-3xl border p-6 shadow-glass">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">CST Manto</p>
          <h1 className="mt-1 text-3xl font-semibold">Iniciar sesion</h1>
          <p className="mt-1 text-sm text-muted">Acceso controlado por rol para operar la plataforma.</p>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm text-muted">Correo</label>
          <input
            type="email"
            className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label className="block text-sm text-muted">Contrasena</label>
          <input
            type="password"
            className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="tap-target mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-white transition-all duration-200 ease-ios active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LockKeyhole size={18} />}
            Entrar
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <button
          type="button"
          onClick={() => {
            localService.reset();
            setEmail("");
            setPassword("");
            setError("Datos locales restablecidos. Intenta ingresar nuevamente.");
          }}
          className="tap-target mt-3 w-full rounded-2xl bg-white/60 px-4 py-3 text-sm font-medium text-muted transition-all duration-200 ease-ios active:scale-[0.99] dark:bg-slate-900/35"
        >
          Restablecer datos locales
        </button>

        <div className="mt-5 space-y-2 rounded-2xl bg-white/45 p-3 text-xs dark:bg-slate-900/35">
          <p className="font-semibold">Usuarios demo</p>
          {demoUsers.map((user) => (
            <p key={user.email} className="text-muted">
              {user.role}: {user.email} / {user.password}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
