import { LocalDbState } from "@/types/local-domain";

const STORAGE_KEY = "cst-manto-db-v1";

function id() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function createSeedState(): LocalDbState {
  const createdAt = now();

  const adminId = id();
  const operatorId = id();

  const users = [
    {
      id: adminId,
      name: "Administrador",
      email: "admin@cst-manto.local",
      role: "ADMIN" as const,
      createdAt
    },
    {
      id: operatorId,
      name: "Encargado Yarda",
      email: "yard@cst-manto.local",
      role: "OPERATOR" as const,
      createdAt
    }
  ];

  const maintenanceTypes = [
    {
      id: id(),
      name: "Engrase",
      intervalMiles: 400,
      warningBeforeMiles: 50,
      isActive: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: id(),
      name: "Cambio de aceite",
      intervalMiles: 800,
      warningBeforeMiles: 80,
      isActive: true,
      createdAt,
      updatedAt: createdAt
    }
  ];

  const trucks = [
    {
      id: id(),
      truckNumber: "TRK-001",
      brand: "Freightliner",
      model: "Cascadia",
      year: 2020,
      currentOdometer: 0,
      status: "ACTIVE" as const,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: id(),
      truckNumber: "TRK-002",
      brand: "Kenworth",
      model: "T680",
      year: 2021,
      currentOdometer: 0,
      status: "ACTIVE" as const,
      createdAt,
      updatedAt: createdAt
    }
  ];

  const truckMaintenanceStates = trucks.flatMap((truck) =>
    maintenanceTypes.map((mt) => ({
      id: id(),
      truckId: truck.id,
      maintenanceTypeId: mt.id,
      lastServiceOdometer: 0,
      createdAt,
      updatedAt: createdAt
    }))
  );

  return {
    meta: {
      workOrderSerial: 0
    },
    users,
    trucks,
    yardEntries: [],
    maintenanceTypes,
    truckMaintenanceStates,
    workOrders: [],
    serviceHistory: [],
    auditLogs: [],
    currentActorId: operatorId
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadDbState(): LocalDbState {
  if (!canUseStorage()) {
    return createSeedState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = createSeedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(raw) as LocalDbState;
  } catch {
    const seeded = createSeedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveDbState(state: LocalDbState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function withDbState<T>(work: (state: LocalDbState) => T): T {
  const state = loadDbState();
  const result = work(state);
  saveDbState(state);
  return result;
}

export function resetDbState() {
  if (!canUseStorage()) return;
  const seeded = createSeedState();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
}

export function nowIso() {
  return now();
}

export function newId() {
  return id();
}
