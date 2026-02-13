import { LocalDbState } from "@/types/local-domain";

const STORAGE_KEY = "cst-manto-db-v1";
let memoryFallbackState: LocalDbState | null = null;

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
  const mechanicId = id();

  const users = [
    {
      id: adminId,
      name: "Administrador",
      email: "admin@cst-manto.local",
      password: "Admin#2026",
      role: "ADMIN" as const,
      createdAt
    },
    {
      id: operatorId,
      name: "Encargado Yarda",
      email: "yard@cst-manto.local",
      password: "Yard#2026",
      role: "OPERATOR" as const,
      createdAt
    },
    {
      id: mechanicId,
      name: "Mecanico Taller",
      email: "mech@cst-manto.local",
      password: "Mech#2026",
      role: "MECHANIC" as const,
      createdAt
    }
  ];

  const maintenanceTypes = [
    {
      id: id(),
      name: "Engrase",
      intervalHours: 400,
      warningBeforeHours: 50,
      isActive: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: id(),
      name: "Cambio de aceite",
      intervalHours: 800,
      warningBeforeHours: 80,
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
      currentWorkedHours: 0,
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
      currentWorkedHours: 0,
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
      lastServiceWorkedHours: 0,
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
    openYardEntries: [],
    maintenanceTypes,
    truckMaintenanceStates,
    workOrders: [],
    serviceHistory: [],
    truckDocuments: [],
    auditLogs: [],
    currentActorId: adminId
  };
}

function normalizeState(raw: LocalDbState): LocalDbState {
  const seeded = createSeedState();
  const seedUsersByEmail = new Map(seeded.users.map((user) => [user.email.toLowerCase(), user]));

  const usersByEmail = new Map((raw.users ?? []).map((user) => [user.email.toLowerCase(), user]));

  const users = seeded.users.map((seedUser) => {
    const existing = usersByEmail.get(seedUser.email.toLowerCase());
    if (!existing) return seedUser;

    const canonical = seedUsersByEmail.get(seedUser.email.toLowerCase()) ?? seedUser;
    return {
      ...existing,
      // Keep historical IDs to preserve references, but enforce seed credentials/roles for known users.
      name: existing.name ?? canonical.name,
      role: canonical.role,
      password: canonical.password
    };
  });

  const trucks = (raw.trucks ?? seeded.trucks).map((truck) => ({
    ...truck,
    currentWorkedHours:
      typeof (truck as { currentWorkedHours?: unknown }).currentWorkedHours === "number"
        ? (truck as { currentWorkedHours: number }).currentWorkedHours
        : 0
  }));

  const maintenanceTypes = (raw.maintenanceTypes ?? seeded.maintenanceTypes).map((item) => {
    const legacy = item as unknown as {
      intervalHours?: unknown;
      intervalMiles?: unknown;
      warningBeforeHours?: unknown;
      warningBeforeMiles?: unknown;
    };
    return {
      ...item,
      intervalHours:
        typeof legacy.intervalHours === "number"
          ? legacy.intervalHours
          : typeof legacy.intervalMiles === "number"
            ? legacy.intervalMiles
            : 400,
      warningBeforeHours:
        typeof legacy.warningBeforeHours === "number"
          ? legacy.warningBeforeHours
          : typeof legacy.warningBeforeMiles === "number"
            ? legacy.warningBeforeMiles
            : 50
    };
  });

  const truckMaintenanceStates = (raw.truckMaintenanceStates ?? seeded.truckMaintenanceStates).map((item) => {
    const legacy = item as unknown as {
      lastServiceWorkedHours?: unknown;
      lastServiceOdometer?: unknown;
    };
    return {
      ...item,
      lastServiceWorkedHours:
        typeof legacy.lastServiceWorkedHours === "number"
          ? legacy.lastServiceWorkedHours
          : typeof legacy.lastServiceOdometer === "number"
            ? legacy.lastServiceOdometer
            : 0
    };
  });

  const yardEntries = (raw.yardEntries ?? []).map((entry) => {
    const legacy = entry as unknown as {
      computedDeltaMiles?: unknown;
      computedDelta?: unknown;
      yardEntryAt?: unknown;
      yardExitAt?: unknown;
      workedHours?: unknown;
    };
    return {
      ...entry,
      computedDeltaMiles:
        typeof legacy.computedDeltaMiles === "number"
          ? legacy.computedDeltaMiles
          : typeof legacy.computedDelta === "number"
            ? legacy.computedDelta
            : 0,
      yardEntryAt: typeof legacy.yardEntryAt === "string" ? legacy.yardEntryAt : entry.datetime,
      yardExitAt: typeof legacy.yardExitAt === "string" ? legacy.yardExitAt : entry.datetime,
      workedHours: typeof legacy.workedHours === "number" ? legacy.workedHours : 0
    };
  });

  const openYardEntries = (raw.openYardEntries ?? []).map((entry) => {
    const legacy = entry as unknown as {
      yardEntryAt?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
      odometer?: unknown;
      recordedById?: unknown;
    };

    const normalizedNow = now();
    return {
      ...entry,
      yardEntryAt:
        typeof legacy.yardEntryAt === "string"
          ? legacy.yardEntryAt
          : typeof legacy.createdAt === "string"
            ? legacy.createdAt
            : normalizedNow,
      createdAt: typeof legacy.createdAt === "string" ? legacy.createdAt : normalizedNow,
      updatedAt: typeof legacy.updatedAt === "string" ? legacy.updatedAt : normalizedNow,
      odometer: typeof legacy.odometer === "number" ? legacy.odometer : 0,
      recordedById:
        typeof legacy.recordedById === "string" && legacy.recordedById.length > 0
          ? legacy.recordedById
          : users[0]?.id ?? seeded.currentActorId
    };
  });

  const workOrders = (raw.workOrders ?? []).map((item) => {
    const legacy = item as unknown as {
      dueAtWorkedHours?: unknown;
      dueAtOdometer?: unknown;
    };
    return {
      ...item,
      dueAtWorkedHours:
        typeof legacy.dueAtWorkedHours === "number"
          ? legacy.dueAtWorkedHours
          : typeof legacy.dueAtOdometer === "number"
            ? legacy.dueAtOdometer
            : 0
    };
  });

  const serviceHistory = (raw.serviceHistory ?? []).map((item) => ({
    ...item,
    workedHoursAtService:
      typeof (item as { workedHoursAtService?: unknown }).workedHoursAtService === "number"
        ? (item as { workedHoursAtService: number }).workedHoursAtService
        : typeof (item as { odometerAtService?: unknown }).odometerAtService === "number"
          ? (item as { odometerAtService: number }).odometerAtService
          : 0
  }));

  const truckDocuments = (raw.truckDocuments ?? []).map((doc) => {
    const legacy = doc as unknown as {
      documentName?: unknown;
      startDate?: unknown;
      expirationDate?: unknown;
      fileName?: unknown;
      fileDataUrl?: unknown;
      mimeType?: unknown;
      fileSizeBytes?: unknown;
      uploadedById?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
      notes?: unknown;
    };

    const normalizedNow = now();
    return {
      ...doc,
      documentName:
        typeof legacy.documentName === "string" && legacy.documentName.trim().length > 0
          ? legacy.documentName.trim()
          : "Documento",
      startDate: typeof legacy.startDate === "string" ? legacy.startDate : normalizedNow,
      expirationDate: typeof legacy.expirationDate === "string" ? legacy.expirationDate : normalizedNow,
      fileName:
        typeof legacy.fileName === "string" && legacy.fileName.trim().length > 0
          ? legacy.fileName
          : "documento.pdf",
      fileDataUrl: typeof legacy.fileDataUrl === "string" ? legacy.fileDataUrl : "",
      mimeType: typeof legacy.mimeType === "string" ? legacy.mimeType : "application/pdf",
      fileSizeBytes: typeof legacy.fileSizeBytes === "number" ? legacy.fileSizeBytes : 0,
      uploadedById:
        typeof legacy.uploadedById === "string" && legacy.uploadedById.length > 0
          ? legacy.uploadedById
          : users[0]?.id ?? seeded.currentActorId,
      notes: typeof legacy.notes === "string" ? legacy.notes : undefined,
      createdAt: typeof legacy.createdAt === "string" ? legacy.createdAt : normalizedNow,
      updatedAt: typeof legacy.updatedAt === "string" ? legacy.updatedAt : normalizedNow
    };
  });

  return {
    ...seeded,
    ...raw,
    users,
    trucks,
    maintenanceTypes,
    truckMaintenanceStates,
    yardEntries,
    openYardEntries,
    workOrders,
    serviceHistory,
    truckDocuments,
    currentActorId: raw.currentActorId ?? users[0]?.id ?? seeded.currentActorId
  };
}

function canUseStorage() {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const probe = "__cst_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function loadDbState(): LocalDbState {
  if (!canUseStorage()) {
    if (!memoryFallbackState) {
      memoryFallbackState = createSeedState();
    }
    return normalizeState(memoryFallbackState);
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    if (!memoryFallbackState) {
      memoryFallbackState = createSeedState();
    }
    return normalizeState(memoryFallbackState);
  }

  if (!raw) {
    const seeded = createSeedState();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      memoryFallbackState = seeded;
    }
    return seeded;
  }

  try {
    return normalizeState(JSON.parse(raw) as LocalDbState);
  } catch {
    const seeded = createSeedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveDbState(state: LocalDbState) {
  if (!canUseStorage()) {
    memoryFallbackState = state;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    memoryFallbackState = state;
  }
}

export function withDbState<T>(work: (state: LocalDbState) => T): T {
  const state = loadDbState();
  const result = work(state);
  saveDbState(state);
  return result;
}

export function resetDbState() {
  const seeded = createSeedState();
  if (!canUseStorage()) {
    memoryFallbackState = seeded;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    memoryFallbackState = seeded;
  }
}

export function nowIso() {
  return now();
}

export function newId() {
  return id();
}
