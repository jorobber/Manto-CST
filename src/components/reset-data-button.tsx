"use client";

import { localService } from "@/lib/local/service";

export function ResetDataButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("Esto reinicia los datos locales de la app. ¿Continuar?")) return;
        localService.reset();
        window.location.reload();
      }}
      className="tap-target rounded-2xl bg-white/60 px-3 py-2 text-xs text-muted transition-all duration-200 ease-ios dark:bg-slate-900/40"
    >
      Reset local
    </button>
  );
}
