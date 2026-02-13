"use client";

import { useEffect, useState } from "react";
import { localService } from "@/lib/local/service";

export function ActorSwitch({ onChange }: { onChange?: () => void }) {
  const [users, setUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [current, setCurrent] = useState("");

  useEffect(() => {
    localService.initialize();
    const all = localService.getUsers();
    const actor = localService.getCurrentActor();
    setUsers(all.map((user) => ({ id: user.id, name: user.name, role: user.role })));
    setCurrent(actor.id);
  }, []);

  return (
    <label className="glass flex items-center gap-2 rounded-2xl px-2 py-2 text-xs text-muted">
      Usuario
      <select
        value={current}
        onChange={(event) => {
          const id = event.target.value;
          setCurrent(id);
          localService.setCurrentActor(id);
          onChange?.();
        }}
        className="rounded-xl border border-white/40 bg-white/60 px-2 py-1 text-xs text-text outline-none dark:border-white/10 dark:bg-slate-900/40"
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.role})
          </option>
        ))}
      </select>
    </label>
  );
}
