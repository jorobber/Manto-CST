import {
  HealthState,
  LocalDbState,
  MaintenanceType,
  OpenYardEntry,
  ServiceHistory,
  Truck,
  TruckDocument,
  TruckMaintenanceState,
  User,
  WorkOrder,
  WorkOrderStatus
} from "@/types/local-domain";
import { loadDbState, newId, nowIso, resetDbState, saveDbState, withDbState } from "@/lib/local/store";

type PublicUser = Omit<User, "password">;

const FIXED_SEED_USERS: Array<{
  email: string;
  password: string;
  role: User["role"];
  name: string;
}> = [
  {
    email: "admin@cst-manto.local",
    password: "Admin#2026",
    role: "ADMIN",
    name: "Administrador"
  },
  {
    email: "yard@cst-manto.local",
    password: "Yard#2026",
    role: "OPERATOR",
    name: "Encargado Yarda"
  },
  {
    email: "mech@cst-manto.local",
    password: "Mech#2026",
    role: "MECHANIC",
    name: "Mecanico Taller"
  }
];

type MaintenanceSnapshotItem = {
  maintenanceTypeId: string;
  maintenanceName: string;
  intervalHours: number;
  warningBeforeHours: number;
  lastServiceWorkedHours: number;
  hoursSinceLastService: number;
  remainingHours: number;
  health: HealthState;
  overdueHours: number;
  openWorkOrderId?: string;
  openWorkOrderNumber?: string;
};

type ReportQuery = {
  period?: "week" | "month" | "custom";
  from?: string;
  to?: string;
  truckId?: string;
};

function sanitizeUser(user: User): PublicUser {
  const { password: _password, ...publicData } = user;
  return publicData;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function safeTime(value: string | undefined) {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

function workedHoursBetween(entryAt: string, exitAt: string) {
  const start = safeTime(entryAt);
  const end = safeTime(exitAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  if (end <= start) return 0;
  return round2((end - start) / 3_600_000);
}

function isoFromTodayAndClock(clock: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock.trim());
  if (!match) return null;

  const now = new Date();
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const local = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  );
  return local.toISOString();
}

function sortByDateAsc<T extends { yardExitAt?: string; datetime: string; createdAt: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const dateA = safeTime(a.yardExitAt ?? a.datetime);
    const dateB = safeTime(b.yardExitAt ?? b.datetime);
    const byDate = dateA - dateB;
    if (byDate !== 0) return byDate;
    return safeTime(a.createdAt) - safeTime(b.createdAt);
  });
}

function sortByDateDesc<T extends { yardExitAt?: string; datetime: string; createdAt: string }>(rows: T[]) {
  return sortByDateAsc(rows).reverse();
}

function getActorFromState(state: LocalDbState): User {
  const actor =
    (state.currentActorId
      ? state.users.find((user) => user.id === state.currentActorId)
      : undefined) ??
    state.users.find((user) => user.role === "ADMIN") ??
    state.users[0];

  if (!actor) throw new Error("No hay usuarios disponibles.");
  state.currentActorId = actor.id;
  return actor;
}

function requireAdmin(actor: User) {
  if (actor.role !== "ADMIN") {
    throw new Error("Operacion permitida solo para Admin");
  }
}

function getMaintenanceType(state: LocalDbState, maintenanceTypeId: string) {
  const type = state.maintenanceTypes.find((item) => item.id === maintenanceTypeId);
  if (!type) throw new Error("Tipo de mantenimiento no encontrado");
  return type;
}

function ensureMaintenanceState(
  state: LocalDbState,
  truckId: string,
  maintenanceTypeId: string
): TruckMaintenanceState {
  const existing = state.truckMaintenanceStates.find(
    (item) => item.truckId === truckId && item.maintenanceTypeId === maintenanceTypeId
  );

  if (existing) return existing;

  const createdAt = nowIso();
  const created: TruckMaintenanceState = {
    id: newId(),
    truckId,
    maintenanceTypeId,
    lastServiceWorkedHours: 0,
    createdAt,
    updatedAt: createdAt
  };

  state.truckMaintenanceStates.push(created);
  return created;
}

function classifyHealth(
  hoursSinceLastService: number,
  intervalHours: number,
  warningBeforeHours: number
): HealthState {
  if (hoursSinceLastService > intervalHours) return "OVERDUE";
  if (hoursSinceLastService === intervalHours) return "DUE";

  const remaining = intervalHours - hoursSinceLastService;
  if (remaining <= warningBeforeHours) return "DUE_SOON";
  return "OK";
}

function formatWorkOrderNumber(serialNumber: number) {
  return `OS-${serialNumber.toString().padStart(6, "0")}`;
}

function ensureOpenWorkOrder(params: {
  state: LocalDbState;
  truckId: string;
  maintenanceType: MaintenanceType;
  dueAtWorkedHours: number;
  createdFromEntryId?: string;
}): WorkOrder {
  const { state, truckId, maintenanceType, dueAtWorkedHours, createdFromEntryId } = params;

  const existing = state.workOrders.find(
    (item) =>
      item.truckId === truckId &&
      item.maintenanceTypeId === maintenanceType.id &&
      (item.status === "PENDING" || item.status === "IN_PROGRESS")
  );

  if (existing) return existing;

  state.meta.workOrderSerial += 1;
  const serialNumber = state.meta.workOrderSerial;
  const createdAt = nowIso();

  const created: WorkOrder = {
    id: newId(),
    serialNumber,
    workorderNumber: formatWorkOrderNumber(serialNumber),
    truckId,
    maintenanceTypeId: maintenanceType.id,
    status: "PENDING",
    createdAt,
    dueAtWorkedHours,
    createdFromEntryId,
    autoGenerated: true
  };

  state.workOrders.push(created);
  return created;
}

function cancelNoLongerDuePendingOrders(state: LocalDbState, truckId: string, maintenanceTypeId: string) {
  const completedAt = nowIso();
  for (const order of state.workOrders) {
    if (
      order.truckId === truckId &&
      order.maintenanceTypeId === maintenanceTypeId &&
      order.autoGenerated &&
      order.status === "PENDING"
    ) {
      order.status = "CANCELLED";
      order.completedAt = completedAt;
    }
  }
}

function evaluateTruckMaintenance(params: {
  state: LocalDbState;
  truckId: string;
  currentWorkedHours: number;
  createdFromEntryId?: string;
  pruneNotDue?: boolean;
}): MaintenanceSnapshotItem[] {
  const { state, truckId, currentWorkedHours, createdFromEntryId, pruneNotDue = false } = params;

  const activeTypes = state.maintenanceTypes
    .filter((item) => item.isActive)
    .sort((a, b) => a.intervalHours - b.intervalHours);

  const snapshots: MaintenanceSnapshotItem[] = [];

  for (const maintenanceType of activeTypes) {
    const stateRow = ensureMaintenanceState(state, truckId, maintenanceType.id);

    const hoursSinceLastService = round2(currentWorkedHours - stateRow.lastServiceWorkedHours);
    const remainingHours = round2(maintenanceType.intervalHours - hoursSinceLastService);
    const health = classifyHealth(
      hoursSinceLastService,
      maintenanceType.intervalHours,
      maintenanceType.warningBeforeHours
    );

    const overdueHours = round2(Math.max(0, hoursSinceLastService - maintenanceType.intervalHours));
    let openWorkOrder: WorkOrder | undefined;

    if (hoursSinceLastService >= maintenanceType.intervalHours) {
      openWorkOrder = ensureOpenWorkOrder({
        state,
        truckId,
        maintenanceType,
        dueAtWorkedHours: round2(stateRow.lastServiceWorkedHours + maintenanceType.intervalHours),
        createdFromEntryId
      });
    } else if (pruneNotDue) {
      cancelNoLongerDuePendingOrders(state, truckId, maintenanceType.id);
    }

    snapshots.push({
      maintenanceTypeId: maintenanceType.id,
      maintenanceName: maintenanceType.name,
      intervalHours: maintenanceType.intervalHours,
      warningBeforeHours: maintenanceType.warningBeforeHours,
      lastServiceWorkedHours: stateRow.lastServiceWorkedHours,
      hoursSinceLastService,
      remainingHours,
      health,
      overdueHours,
      openWorkOrderId: openWorkOrder?.id,
      openWorkOrderNumber: openWorkOrder?.workorderNumber
    });
  }

  return snapshots;
}

function recomputeYardEntriesAndTruckMetrics(state: LocalDbState, truckId: string): {
  currentOdometer: number;
  currentWorkedHours: number;
} {
  const entries = sortByDateAsc(state.yardEntries.filter((entry) => entry.truckId === truckId));

  let previousOdometer = 0;
  let accumulatedHours = 0;

  for (const [index, entry] of entries.entries()) {
    const computedDeltaMiles = index === 0 ? entry.odometer : entry.odometer - previousOdometer;
    previousOdometer = entry.odometer;

    const workedHours =
      entry.workedHours > 0
        ? entry.workedHours
        : workedHoursBetween(entry.yardEntryAt, entry.yardExitAt);

    if (entry.computedDeltaMiles !== computedDeltaMiles || entry.workedHours !== workedHours) {
      entry.computedDeltaMiles = computedDeltaMiles;
      entry.workedHours = workedHours;
      entry.updatedAt = nowIso();
    }

    accumulatedHours += entry.workedHours;
  }

  const latest = entries.at(-1);
  const currentOdometer = latest?.odometer ?? 0;
  const currentWorkedHours = round2(accumulatedHours);
  const truck = state.trucks.find((item) => item.id === truckId);

  if (truck) {
    truck.currentOdometer = currentOdometer;
    truck.currentWorkedHours = currentWorkedHours;
    truck.updatedAt = nowIso();
  }

  return { currentOdometer, currentWorkedHours };
}

function refreshMaintenanceStatesFromHistory(state: LocalDbState, truckId: string) {
  const activeTypes = state.maintenanceTypes.filter((item) => item.isActive);

  for (const maintenanceType of activeTypes) {
    const latestService = [...state.serviceHistory]
      .filter(
        (item) => item.truckId === truckId && item.maintenanceTypeId === maintenanceType.id
      )
      .sort((a, b) => safeTime(b.performedAt) - safeTime(a.performedAt))[0];

    const row = ensureMaintenanceState(state, truckId, maintenanceType.id);
    row.lastServiceWorkedHours = latestService?.workedHoursAtService ?? 0;
    row.lastServiceAt = latestService?.performedAt;
    row.updatedAt = nowIso();
  }
}

function recalculateTruckImpact(state: LocalDbState, truckId: string) {
  const metrics = recomputeYardEntriesAndTruckMetrics(state, truckId);
  refreshMaintenanceStatesFromHistory(state, truckId);
  evaluateTruckMaintenance({
    state,
    truckId,
    currentWorkedHours: metrics.currentWorkedHours,
    pruneNotDue: true
  });
}

function parseDateRange(query: ReportQuery) {
  const now = new Date();
  const period = query.period ?? "week";

  if (period === "month") {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return { start, end: now };
  }

  if (period === "custom") {
    if (!query.from || !query.to) {
      throw new Error("Para periodo custom debe enviar from y to");
    }

    const start = new Date(query.from);
    const end = new Date(query.to);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Rango custom inválido");
    }

    return { start, end };
  }

  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  return { start, end: now };
}

function mapTruckMaintenanceState(state: LocalDbState, truck: Truck) {
  return state.truckMaintenanceStates
    .filter((row) => row.truckId === truck.id)
    .map((row) => ({
      ...row,
      maintenanceType: getMaintenanceType(state, row.maintenanceTypeId)
    }))
    .sort((a, b) => a.maintenanceType.intervalHours - b.maintenanceType.intervalHours);
}

function getServiceRowsByRange(state: LocalDbState, query: ReportQuery) {
  const { start, end } = parseDateRange(query);

  const rows = state.serviceHistory
    .filter((row) => {
      const date = safeTime(row.performedAt);
      const inRange = date >= start.getTime() && date <= end.getTime();
      if (!inRange) return false;
      if (query.truckId && row.truckId !== query.truckId) return false;
      return true;
    })
    .sort((a, b) => safeTime(b.performedAt) - safeTime(a.performedAt));

  return { start, end, rows };
}

function asCsvCell(value: string | number | Date) {
  const raw = value instanceof Date ? value.toISOString() : String(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

function startOfDayMs(value: string | Date) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfDayMs(value: string | Date) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

function dayDiffFromToday(expirationDate: string) {
  const today = startOfDayMs(new Date());
  const target = startOfDayMs(expirationDate);
  return Math.round((target - today) / 86_400_000);
}

function classifyDocumentExpiration(expirationDate: string) {
  const daysToExpiration = dayDiffFromToday(expirationDate);
  if (daysToExpiration < 0) return { status: "EXPIRED" as const, daysToExpiration };
  if (daysToExpiration <= 7) return { status: "DUE_SOON" as const, daysToExpiration };
  return { status: "VALID" as const, daysToExpiration };
}

function parseDateInputAsLocalNoon(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function parseMonthKey(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return {
    monthStart: new Date(year, month - 1, 1).getTime(),
    monthEnd: new Date(year, month, 0, 23, 59, 59, 999).getTime()
  };
}

export const localService = {
  initialize() {
    const state = loadDbState();
    saveDbState(state);
    return state;
  },

  reset() {
    resetDbState();
  },

  login(input: { email: string; password: string }) {
    return withDbState((state) => {
      const email = input.email.trim().toLowerCase();
      const password = input.password.trim();
      const seed = FIXED_SEED_USERS.find((item) => item.email === email);
      let user = state.users.find((item) => item.email.toLowerCase() === email);

      if (seed) {
        if (!user) {
          user = {
            id: newId(),
            name: seed.name,
            email: seed.email,
            password: seed.password,
            role: seed.role,
            createdAt: nowIso()
          };
          state.users.push(user);
        } else {
          user.name = seed.name;
          user.role = seed.role;
          user.password = seed.password;
        }
      }

      if (!user || user.password !== password) {
        throw new Error("Credenciales inválidas");
      }

      state.currentActorId = user.id;
      return sanitizeUser(user);
    });
  },

  logout() {
    withDbState((state) => {
      state.currentActorId = null;
    });
  },

  getSessionUser() {
    const state = loadDbState();
    const actor = getActorFromState(state);
    saveDbState(state);
    return sanitizeUser(actor);
  },

  getUsers() {
    const state = loadDbState();
    return state.users.map(sanitizeUser);
  },

  getTrucks() {
    const state = loadDbState();
    getActorFromState(state);

    return [...state.trucks]
      .sort((a, b) => a.truckNumber.localeCompare(b.truckNumber))
      .map((truck) => ({
        ...truck,
        maintenanceStates: mapTruckMaintenanceState(state, truck)
      }));
  },

  uploadTruckDocument(input: {
    truckId: string;
    documentName: string;
    startDate: string;
    expirationDate: string;
    fileName: string;
    fileDataUrl: string;
    mimeType: string;
    fileSizeBytes: number;
    notes?: string;
  }) {
    return withDbState((state) => {
      const actor = getActorFromState(state);
      const truck = state.trucks.find((item) => item.id === input.truckId);
      if (!truck) throw new Error("Camión no encontrado");

      const documentName = input.documentName.trim();
      if (documentName.length < 2) throw new Error("El nombre del documento es obligatorio");
      if (!input.fileDataUrl || !input.fileDataUrl.startsWith("data:")) {
        throw new Error("Debe subir un PDF válido");
      }
      if (!input.mimeType.toLowerCase().includes("pdf")) {
        throw new Error("Solo se permiten archivos PDF");
      }

      const startDate = parseDateInputAsLocalNoon(input.startDate);
      const expirationDate = parseDateInputAsLocalNoon(input.expirationDate);
      if (!startDate || !expirationDate) {
        throw new Error("Fechas inválidas");
      }
      if (endOfDayMs(expirationDate) < startOfDayMs(startDate)) {
        throw new Error("La fecha de expiración no puede ser menor a la fecha de inicio");
      }

      const now = nowIso();
      const created: TruckDocument = {
        id: newId(),
        truckId: truck.id,
        documentName,
        startDate: startDate.toISOString(),
        expirationDate: expirationDate.toISOString(),
        fileName: input.fileName || "documento.pdf",
        fileDataUrl: input.fileDataUrl,
        mimeType: input.mimeType || "application/pdf",
        fileSizeBytes: input.fileSizeBytes || 0,
        uploadedById: actor.id,
        notes: input.notes?.trim() || undefined,
        createdAt: now,
        updatedAt: now
      };

      state.truckDocuments.push(created);
      state.auditLogs.push({
        id: newId(),
        entityType: "TruckDocument",
        entityId: created.id,
        oldValue: {},
        newValue: {
          truckId: truck.id,
          documentName: created.documentName,
          expirationDate: created.expirationDate
        },
        changedById: actor.id,
        reason: "Carga de documento",
        timestamp: now
      });

      return created;
    });
  },

  getTruckDocuments(query?: { truckId?: string; month?: string }) {
    const state = loadDbState();
    getActorFromState(state);

    let monthStart: number | undefined;
    let monthEnd: number | undefined;
    if (query?.month) {
      const parsed = parseMonthKey(query.month);
      if (parsed) {
        monthStart = parsed.monthStart;
        monthEnd = parsed.monthEnd;
      }
    }

    const rows = state.truckDocuments
      .filter((doc) => (query?.truckId ? doc.truckId === query.truckId : true))
      .filter((doc) => {
        if (monthStart === undefined || monthEnd === undefined) return true;
        const expiration = safeTime(doc.expirationDate);
        return expiration >= monthStart && expiration <= monthEnd;
      })
      .sort((a, b) => safeTime(a.expirationDate) - safeTime(b.expirationDate))
      .map((doc) => {
        const truck = state.trucks.find((item) => item.id === doc.truckId);
        const uploadedBy = state.users.find((user) => user.id === doc.uploadedById);
        const expiration = classifyDocumentExpiration(doc.expirationDate);

        return {
          ...doc,
          truck,
          uploadedBy: uploadedBy ? sanitizeUser(uploadedBy) : undefined,
          expirationStatus: expiration.status,
          daysToExpiration: expiration.daysToExpiration
        };
      });

    const summary = {
      total: rows.length,
      expired: rows.filter((item) => item.expirationStatus === "EXPIRED").length,
      dueSoon: rows.filter((item) => item.expirationStatus === "DUE_SOON").length,
      valid: rows.filter((item) => item.expirationStatus === "VALID").length
    };

    const upcoming = state.truckDocuments
      .map((doc) => {
        const expiration = classifyDocumentExpiration(doc.expirationDate);
        const truck = state.trucks.find((item) => item.id === doc.truckId);
        return {
          ...doc,
          truck,
          expirationStatus: expiration.status,
          daysToExpiration: expiration.daysToExpiration
        };
      })
      .sort((a, b) => a.daysToExpiration - b.daysToExpiration)
      .slice(0, 30);

    return {
      summary,
      rows,
      upcoming
    };
  },

  createTruck(input: {
    truckNumber: string;
    brand: string;
    model: string;
    year: number;
    status?: Truck["status"];
  }) {
    return withDbState((state) => {
      const actor = getActorFromState(state);
      requireAdmin(actor);

      const truckNumber = input.truckNumber.trim().toUpperCase();
      if (!truckNumber) throw new Error("El numero de camión es obligatorio");
      if (state.trucks.some((truck) => truck.truckNumber === truckNumber)) {
        throw new Error("Ya existe un camión con ese número");
      }

      const now = nowIso();
      const truck: Truck = {
        id: newId(),
        truckNumber,
        brand: input.brand.trim(),
        model: input.model.trim(),
        year: input.year,
        currentOdometer: 0,
        currentWorkedHours: 0,
        status: input.status ?? "ACTIVE",
        createdAt: now,
        updatedAt: now
      };

      state.trucks.push(truck);

      for (const mt of state.maintenanceTypes.filter((item) => item.isActive)) {
        state.truckMaintenanceStates.push({
          id: newId(),
          truckId: truck.id,
          maintenanceTypeId: mt.id,
          lastServiceWorkedHours: 0,
          createdAt: now,
          updatedAt: now
        });
      }

      state.auditLogs.push({
        id: newId(),
        entityType: "Truck",
        entityId: truck.id,
        oldValue: {},
        newValue: { truckNumber: truck.truckNumber },
        changedById: actor.id,
        reason: "Creacion de nuevo camion",
        timestamp: now
      });

      return truck;
    });
  },

  updateTruckCurrentOdometer(input: { truckId: string; odometer: number; reason: string }) {
    return withDbState((state) => {
      const actor = getActorFromState(state);
      requireAdmin(actor);

      if (!input.reason || input.reason.trim().length < 8) {
        throw new Error("Motivo obligatorio (mínimo 8 caracteres)");
      }

      const truck = state.trucks.find((item) => item.id === input.truckId);
      if (!truck) throw new Error("Camión no encontrado");
      if (input.odometer < 0) throw new Error("Odómetro inválido");

      const entriesAsc = sortByDateAsc(state.yardEntries.filter((entry) => entry.truckId === truck.id));
      const latest = entriesAsc.at(-1);

      if (!latest) {
        const now = nowIso();
        state.yardEntries.push({
          id: newId(),
          truckId: truck.id,
          datetime: now,
          odometer: input.odometer,
          computedDeltaMiles: input.odometer,
          yardEntryAt: now,
          yardExitAt: now,
          workedHours: 0,
          recordedById: actor.id,
          notes: `Ajuste admin: ${input.reason}`,
          createdAt: now,
          updatedAt: now
        });
      } else {
        const previous = entriesAsc.at(-2);
        if (previous && input.odometer < previous.odometer) {
          throw new Error(`No puede ser menor a la lectura previa (${previous.odometer}).`);
        }

        const oldValue = latest.odometer;
        latest.odometer = input.odometer;
        latest.updatedAt = nowIso();

        state.auditLogs.push({
          id: newId(),
          entityType: "TruckOdometerAdjust",
          entityId: truck.id,
          oldValue: { odometer: oldValue },
          newValue: { odometer: input.odometer },
          changedById: actor.id,
          reason: input.reason,
          timestamp: nowIso()
        });
      }

      recalculateTruckImpact(state, truck.id);
      return truck;
    });
  },

  getTruckById(truckId: string) {
    const state = loadDbState();
    const actor = getActorFromState(state);
    const truck = state.trucks.find((item) => item.id === truckId);
    if (!truck) throw new Error("Camión no encontrado");
    const openYardEntry = state.openYardEntries.find((entry) => entry.truckId === truck.id);

    const yardEntries = sortByDateDesc(state.yardEntries.filter((entry) => entry.truckId === truck.id))
      .slice(0, 20)
      .map((entry) => ({
        ...entry,
        recordedBy: (() => {
          const recordedBy = state.users.find((user) => user.id === entry.recordedById);
          return recordedBy ? sanitizeUser(recordedBy) : undefined;
        })()
      }));

    const workOrders = [...state.workOrders]
      .filter((order) => order.truckId === truck.id)
      .sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt))
      .slice(0, 20)
      .map((order) => ({
        ...order,
        maintenanceType: getMaintenanceType(state, order.maintenanceTypeId)
      }));

    return {
      ...truck,
      canAdminManage: actor.role === "ADMIN",
      openYardEntry,
      yardEntries,
      maintenanceStates: mapTruckMaintenanceState(state, truck),
      workOrders
    };
  },

  getOpenYardEntry(truckId: string) {
    const state = loadDbState();
    getActorFromState(state);

    const openEntry = state.openYardEntries.find((entry) => entry.truckId === truckId);
    if (!openEntry) return null;

    const recordedBy = state.users.find((user) => user.id === openEntry.recordedById);
    return {
      ...openEntry,
      recordedBy: recordedBy ? sanitizeUser(recordedBy) : undefined
    };
  },

  registerYardEntry(input: {
    truckId: string;
    movementType: "ENTRY" | "EXIT";
    time: string;
    odometer?: number;
    notes?: string;
    photoUrl?: string;
  }) {
    return withDbState((state) => {
      const actor = getActorFromState(state);
      const truck = state.trucks.find((item) => item.id === input.truckId);
      if (!truck) throw new Error("Camión no encontrado");

      const movementAt = isoFromTodayAndClock(input.time);
      if (!movementAt) {
        throw new Error("Hora inválida. Use formato HH:mm");
      }

      if (input.movementType === "ENTRY") {
        const hasOpenEntry = state.openYardEntries.some((entry) => entry.truckId === truck.id);
        if (hasOpenEntry) {
          throw new Error("Este camión ya tiene una entrada abierta. Registre la salida primero.");
        }

        if (!Number.isFinite(input.odometer)) {
          throw new Error("El odómetro es obligatorio para registrar entrada");
        }

        const odometer = Number(input.odometer);
        if (odometer < truck.currentOdometer) {
          throw new Error(
            `Lectura inválida. El último odómetro es ${truck.currentOdometer} y no puede disminuir.`
          );
        }

        const now = nowIso();
        const openEntry: OpenYardEntry = {
          id: newId(),
          truckId: truck.id,
          odometer,
          yardEntryAt: movementAt,
          recordedById: actor.id,
          notes: input.notes,
          photoUrl: input.photoUrl,
          createdAt: now,
          updatedAt: now
        };

        state.openYardEntries.push(openEntry);

        return {
          eventType: "ENTRY" as const,
          openYardEntry: openEntry
        };
      }

      const openEntryIndex = state.openYardEntries.findIndex((entry) => entry.truckId === truck.id);
      if (openEntryIndex < 0) {
        throw new Error("No hay entrada abierta para este camión. Registre entrada primero.");
      }

      const openEntry = state.openYardEntries[openEntryIndex];
      const startTime = safeTime(openEntry.yardEntryAt);
      const endTime = safeTime(movementAt);
      if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) {
        throw new Error("La hora de salida debe ser mayor que la hora de entrada abierta");
      }

      const lastEntry = sortByDateDesc(state.yardEntries.filter((entry) => entry.truckId === truck.id))[0];
      const previousOdometer = lastEntry?.odometer ?? 0;

      if (openEntry.odometer < previousOdometer) {
        throw new Error(
          `Lectura inválida. El último odómetro confirmado es ${previousOdometer} y no puede disminuir.`
        );
      }

      const workedHours = workedHoursBetween(openEntry.yardEntryAt, movementAt);
      const currentTime = nowIso();
      const computedDeltaMiles = openEntry.odometer - previousOdometer;
      const mergedNotes = [openEntry.notes, input.notes].filter(Boolean).join(" | ") || undefined;

      const entry = {
        id: newId(),
        truckId: truck.id,
        datetime: movementAt,
        odometer: openEntry.odometer,
        computedDeltaMiles,
        yardEntryAt: openEntry.yardEntryAt,
        yardExitAt: movementAt,
        workedHours,
        recordedById: openEntry.recordedById,
        notes: mergedNotes,
        photoUrl: openEntry.photoUrl ?? input.photoUrl,
        createdAt: currentTime,
        updatedAt: currentTime
      };

      state.yardEntries.push(entry);
      state.openYardEntries.splice(openEntryIndex, 1);
      truck.currentOdometer = openEntry.odometer;
      truck.currentWorkedHours = round2(truck.currentWorkedHours + workedHours);
      truck.updatedAt = nowIso();

      const maintenanceSnapshot = evaluateTruckMaintenance({
        state,
        truckId: truck.id,
        currentWorkedHours: truck.currentWorkedHours,
        createdFromEntryId: entry.id
      });

      return {
        eventType: "EXIT" as const,
        yardEntry: entry,
        maintenanceSnapshot,
        generatedWorkOrders: maintenanceSnapshot
          .filter((item) => !!item.openWorkOrderId)
          .map((item) => ({
            maintenanceName: item.maintenanceName,
            workOrderId: item.openWorkOrderId,
            workOrderNumber: item.openWorkOrderNumber,
            health: item.health
          }))
      };
    });
  },

  correctYardEntry(input: { entryId: string; odometer: number; reason: string }) {
    return withDbState((state) => {
      const actor = getActorFromState(state);
      requireAdmin(actor);

      if (!input.reason || input.reason.trim().length < 8) {
        throw new Error("Motivo obligatorio (mínimo 8 caracteres)");
      }

      const target = state.yardEntries.find((entry) => entry.id === input.entryId);
      if (!target) throw new Error("Entrada de yarda no encontrada");

      const ordered = sortByDateAsc(state.yardEntries.filter((entry) => entry.truckId === target.truckId));
      const index = ordered.findIndex((entry) => entry.id === target.id);
      if (index < 0) throw new Error("No se pudo ubicar la lectura a corregir");

      const previous = ordered[index - 1];
      const next = ordered[index + 1];

      if (previous && input.odometer < previous.odometer) {
        throw new Error(
          `Corrección inválida: el odómetro no puede ser menor al anterior (${previous.odometer})`
        );
      }

      if (next && input.odometer > next.odometer) {
        throw new Error(
          `Corrección inválida: el odómetro no puede ser mayor al siguiente (${next.odometer})`
        );
      }

      const oldOdometer = target.odometer;
      target.odometer = input.odometer;
      target.updatedAt = nowIso();

      state.auditLogs.push({
        id: newId(),
        entityType: "YardEntry",
        entityId: target.id,
        oldValue: { odometer: oldOdometer },
        newValue: { odometer: input.odometer },
        changedById: actor.id,
        reason: input.reason,
        timestamp: nowIso()
      });

      recalculateTruckImpact(state, target.truckId);

      return target;
    });
  },

  getWorkOrders(filters?: { truckId?: string; status?: WorkOrderStatus | "ALL" }) {
    const state = loadDbState();
    const actor = getActorFromState(state);

    const rows = state.workOrders
      .filter((order) => {
        if (filters?.truckId && order.truckId !== filters.truckId) return false;
        if (filters?.status && filters.status !== "ALL" && order.status !== filters.status) return false;
        return true;
      })
      .sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt))
      .map((order) => {
        const truck = state.trucks.find((item) => item.id === order.truckId);
        const maintenanceType = getMaintenanceType(state, order.maintenanceTypeId);

        if (!truck) throw new Error("Camión no encontrado para orden");

        const overdueHours = round2(Math.max(0, truck.currentWorkedHours - order.dueAtWorkedHours));
        const visualState =
          order.status === "COMPLETED" || order.status === "CANCELLED"
            ? order.status
            : overdueHours > 0
              ? "OVERDUE"
              : "DUE";

        return {
          ...order,
          truck,
          maintenanceType,
          canRevert: actor.role === "ADMIN" && order.status === "COMPLETED",
          overdueHours,
          visualState,
          serviceHistory: state.serviceHistory.find((item) => item.workorderId === order.id)
        };
      });

    return rows;
  },

  startWorkOrder(workOrderId: string) {
    return withDbState((state) => {
      const actor = getActorFromState(state);
      const order = state.workOrders.find((item) => item.id === workOrderId);
      if (!order) throw new Error("Orden no encontrada");
      if (order.status === "COMPLETED" || order.status === "CANCELLED") {
        throw new Error("La orden ya está cerrada");
      }

      order.status = "IN_PROGRESS";
      order.assignedToId = order.assignedToId ?? actor.id;
      return order;
    });
  },

  completeWorkOrder(input: {
    workOrderId: string;
    workedHoursAtService: number;
    notes?: string;
    attachmentUrl?: string;
  }) {
    return withDbState((state) => {
      const actor = getActorFromState(state);
      const order = state.workOrders.find((item) => item.id === input.workOrderId);
      if (!order) throw new Error("Orden no encontrada");

      if (order.status === "COMPLETED" || order.status === "CANCELLED") {
        throw new Error("La orden ya está cerrada");
      }

      const truck = state.trucks.find((item) => item.id === order.truckId);
      if (!truck) throw new Error("Camión no encontrado");

      if (!Number.isFinite(input.workedHoursAtService)) {
        throw new Error("Las horas de servicio son obligatorias");
      }
      if (input.workedHoursAtService < 0) {
        throw new Error("Las horas de servicio no pueden ser negativas");
      }

      const maintenanceState = ensureMaintenanceState(state, order.truckId, order.maintenanceTypeId);
      if (input.workedHoursAtService < maintenanceState.lastServiceWorkedHours) {
        throw new Error("Las horas de servicio no pueden ser menores al último servicio");
      }
      if (input.workedHoursAtService > truck.currentWorkedHours) {
        throw new Error("Las horas de servicio no pueden superar las horas actuales del camión");
      }

      order.status = "COMPLETED";
      order.completedAt = nowIso();
      order.assignedToId = order.assignedToId ?? actor.id;

      const existingHistory = state.serviceHistory.find((item) => item.workorderId === order.id);
      if (!existingHistory) {
        const createdHistory: ServiceHistory = {
          id: newId(),
          truckId: order.truckId,
          maintenanceTypeId: order.maintenanceTypeId,
          workorderId: order.id,
          performedAt: nowIso(),
          workedHoursAtService: round2(input.workedHoursAtService),
          odometerAtService: truck.currentOdometer,
          performedById: actor.id,
          notes: input.notes,
          attachmentUrl: input.attachmentUrl
        };
        state.serviceHistory.push(createdHistory);
      }

      maintenanceState.lastServiceWorkedHours = round2(input.workedHoursAtService);
      maintenanceState.lastServiceAt = nowIso();
      maintenanceState.updatedAt = nowIso();

      const maintenanceSnapshot = evaluateTruckMaintenance({
        state,
        truckId: order.truckId,
        currentWorkedHours: truck.currentWorkedHours,
        pruneNotDue: true
      });

      return {
        workOrder: order,
        maintenanceSnapshot
      };
    });
  },

  revertCompletedWorkOrder(input: { workOrderId: string; reason: string }) {
    return withDbState((state) => {
      const actor = getActorFromState(state);
      requireAdmin(actor);

      if (!input.reason || input.reason.trim().length < 8) {
        throw new Error("Motivo obligatorio (mínimo 8 caracteres)");
      }

      const order = state.workOrders.find((item) => item.id === input.workOrderId);
      if (!order) throw new Error("Orden no encontrada");
      if (order.status !== "COMPLETED") {
        throw new Error("Solo se pueden revertir ordenes completadas");
      }

      const oldStatus = order.status;
      order.status = "PENDING";
      order.completedAt = undefined;

      const beforeCount = state.serviceHistory.length;
      state.serviceHistory = state.serviceHistory.filter((item) => item.workorderId !== order.id);

      refreshMaintenanceStatesFromHistory(state, order.truckId);
      const truck = state.trucks.find((item) => item.id === order.truckId);
      evaluateTruckMaintenance({
        state,
        truckId: order.truckId,
        currentWorkedHours: truck?.currentWorkedHours ?? 0,
        pruneNotDue: true
      });

      state.auditLogs.push({
        id: newId(),
        entityType: "WorkOrderRevert",
        entityId: order.id,
        oldValue: { status: oldStatus, serviceRows: beforeCount },
        newValue: { status: order.status, serviceRows: state.serviceHistory.length },
        changedById: actor.id,
        reason: input.reason,
        timestamp: nowIso()
      });

      return order;
    });
  },

  getDashboardSummary() {
    const state = loadDbState();
    getActorFromState(state);

    let dueNow = 0;
    let dueSoon = 0;
    let overdue = 0;
    let okCount = 0;

    const progressByTruck = state.trucks.map((truck) => {
      const maintenanceStates = mapTruckMaintenanceState(state, truck);

      for (const item of maintenanceStates) {
        const hoursSince = round2(truck.currentWorkedHours - item.lastServiceWorkedHours);

        if (hoursSince > item.maintenanceType.intervalHours) overdue += 1;
        else if (hoursSince === item.maintenanceType.intervalHours) dueNow += 1;
        else if (item.maintenanceType.intervalHours - hoursSince <= item.maintenanceType.warningBeforeHours) {
          dueSoon += 1;
        } else {
          okCount += 1;
        }
      }

      const next = maintenanceStates
        .map((item) => {
          const hoursSince = round2(truck.currentWorkedHours - item.lastServiceWorkedHours);
          const remainingHours = round2(item.maintenanceType.intervalHours - hoursSince);
          const completion = Math.min(100, Math.max(0, (hoursSince / item.maintenanceType.intervalHours) * 100));
          return {
            maintenanceName: item.maintenanceType.name,
            remainingHours,
            completion
          };
        })
        .sort((a, b) => a.remainingHours - b.remainingHours)[0];

      return {
        truckId: truck.id,
        truckNumber: truck.truckNumber,
        nextMaintenance: next?.maintenanceName ?? "N/A",
        remainingHours: next?.remainingHours ?? 0,
        completion: next?.completion ?? 0
      };
    });

    const totalCheckpoints = okCount + dueSoon + dueNow + overdue;
    const fleetHealthScore =
      totalCheckpoints === 0
        ? 100
        : Math.round(((okCount + dueSoon * 0.7 + dueNow * 0.4) / totalCheckpoints) * 100);

    const pendingOrders = state.workOrders
      .filter((item) => item.status === "PENDING" || item.status === "IN_PROGRESS")
      .map((order) => {
        const truck = state.trucks.find((item) => item.id === order.truckId);
        const maintenanceType = getMaintenanceType(state, order.maintenanceTypeId);

        return {
          id: order.id,
          workorderNumber: order.workorderNumber,
          truckNumber: truck?.truckNumber ?? "N/A",
          maintenanceName: maintenanceType.name,
          status: order.status,
          dueAtWorkedHours: order.dueAtWorkedHours,
          createdAt: order.createdAt
        };
      })
      .sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));

    return {
      totals: {
        dueNow,
        dueSoon,
        overdue,
        pendingOrders: pendingOrders.length,
        totalTrucks: state.trucks.length,
        totalCheckpoints
      },
      fleetHealthScore,
      healthDistribution: {
        ok: okCount,
        dueSoon,
        dueNow,
        overdue
      },
      progressByTruck,
      pendingOrders
    };
  },

  getReportSummary(query: ReportQuery) {
    const state = loadDbState();
    getActorFromState(state);
    const { start, end, rows } = getServiceRowsByRange(state, query);

    const summaryByTruck = state.trucks
      .filter((truck) => (query.truckId ? truck.id === query.truckId : true))
      .map((truck) => {
        const truckRows = rows.filter((row) => row.truckId === truck.id);
        const engrases = truckRows.filter((row) =>
          getMaintenanceType(state, row.maintenanceTypeId).name.toLowerCase().includes("engrase")
        );
        const aceites = truckRows.filter((row) =>
          getMaintenanceType(state, row.maintenanceTypeId).name.toLowerCase().includes("aceite")
        );

        const nextMaintenance = mapTruckMaintenanceState(state, truck)
          .map((item) => {
            const dueAtWorkedHours = round2(item.lastServiceWorkedHours + item.maintenanceType.intervalHours);
            const remainingHours = round2(dueAtWorkedHours - truck.currentWorkedHours);
            return {
              maintenanceType: item.maintenanceType.name,
              dueAtWorkedHours,
              remainingHours,
              state:
                remainingHours < 0 ? "OVERDUE" : remainingHours === 0 ? "DUE" : "UPCOMING"
            };
          })
          .sort((a, b) => a.remainingHours - b.remainingHours)[0];

        const lastService = [...truckRows].sort(
          (a, b) => safeTime(b.performedAt) - safeTime(a.performedAt)
        )[0];

        return {
          truckId: truck.id,
          truckNumber: truck.truckNumber,
          engrases: {
            count: engrases.length,
            dates: engrases.map((item) => item.performedAt)
          },
          cambiosAceite: {
            count: aceites.length,
            dates: aceites.map((item) => item.performedAt)
          },
          lastService: lastService
            ? {
                date: lastService.performedAt,
                service: getMaintenanceType(state, lastService.maintenanceTypeId).name,
                workedHours: lastService.workedHoursAtService
              }
            : null,
          nextMaintenance: nextMaintenance ?? null
        };
      });

    return {
      range: { start, end },
      totalServices: rows.length,
      summaryByTruck
    };
  },

  getReportDetail(query: ReportQuery) {
    const state = loadDbState();
    getActorFromState(state);
    const { start, end, rows } = getServiceRowsByRange(state, query);

    return {
      range: { start, end },
      rows: rows.map((row) => {
        const truck = state.trucks.find((item) => item.id === row.truckId);
        const actor = state.users.find((item) => item.id === row.performedById);
        const type = getMaintenanceType(state, row.maintenanceTypeId);
        const order = state.workOrders.find((item) => item.id === row.workorderId);

        return {
          date: row.performedAt,
          truck: truck?.truckNumber ?? "N/A",
          service: type.name,
          workedHours: row.workedHoursAtService,
          user: actor?.name ?? "N/A",
          workorderNumber: order?.workorderNumber ?? "N/A"
        };
      })
    };
  },

  exportDetailCsv(query: ReportQuery) {
    const detail = this.getReportDetail(query);
    const header = ["Fecha", "Camion", "Servicio", "Horas", "Usuario", "Orden"];

    const body = detail.rows.map((row) =>
      [row.date, row.truck, row.service, row.workedHours, row.user, row.workorderNumber]
        .map(asCsvCell)
        .join(",")
    );

    return [header.map(asCsvCell).join(","), ...body].join("\n");
  }
};
