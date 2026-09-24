import type {
  AppState,
  Entry,
  Pigeon,
  Training,
} from "./types";

const STORAGE_KEY = "pigeon-loft-ledger-v1";

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

const now = () => new Date().toISOString();

/** 首次使用时的演示台账：一次训放 + 若干羽鸽子 */
function seedState(): AppState {
  const release = new Date(Date.now() - 30 * 60 * 60 * 1000);
  const releaseStr = toLocalInput(release);
  const arrived1 = new Date(release.getTime() + 72 * 60 * 1000);
  const arrived2 = new Date(release.getTime() + 81 * 60 * 1000);

  const p1: Pigeon = {
    id: uid("pg"),
    ring: "CHN-24-001839",
    bloodline: "詹森系",
    sex: "公",
    health: "正常",
    createdAt: now(),
  };
  const p2: Pigeon = {
    id: uid("pg"),
    ring: "CHN-24-002114",
    bloodline: "凡龙系",
    sex: "母",
    health: "正常",
    mateId: null,
    createdAt: now(),
  };
  const p3: Pigeon = {
    id: uid("pg"),
    ring: "CHN-24-120766",
    bloodline: "",
    sex: "公",
    health: "异常",
    note: "归巢后精神萎靡，待观察",
    createdAt: now(),
  };
  const p4: Pigeon = {
    id: uid("pg"),
    ring: "CHN-23-008771",
    bloodline: "胡本系",
    sex: "母",
    health: "正常",
    createdAt: now(),
  };
  p2.mateId = p1.id;
  p1.mateId = p2.id;

  const t: Training = {
    id: uid("tr"),
    location: "静海放飞点",
    distance: 100,
    releaseTime: releaseStr,
    weather: "晴，西北风2级",
    createdAt: now(),
  };

  const mk = (ring: string, arrival: Date | null, health: "正常" | "异常" = "正常"): Entry => ({
    id: uid("en"),
    trainingId: t.id,
    ring,
    status: arrival ? "归巢" : "在飞",
    arrivalTime: arrival ? toLocalInput(arrival) : null,
    arrivalHealth: arrival ? health : undefined,
  });

  return {
    pigeons: [p1, p2, p3, p4],
    trainings: [t],
    entries: [
      mk(p1.ring, arrived1),
      mk(p2.ring, arrived2),
      mk(p3.ring, new Date(arrived2.getTime() + 6 * 60 * 1000), "异常"),
      mk(p4.ring, null),
    ],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedState();
      saveState(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.pigeons || !parsed.trainings || !parsed.entries) {
      throw new Error("bad data");
    }
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级，仅当前会话可用
  }
}

/** ISO/Date -> datetime-local 输入框用字符串 */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function parseLocal(s: string): number {
  // datetime-local 按本地时区解析
  return new Date(s).getTime();
}

export const HOUR_MS = 60 * 60 * 1000;

/** 距离档（公里） */
export interface DistanceBand {
  key: string;
  label: string;
  min: number;
  max: number;
}

export const DISTANCE_BANDS: DistanceBand[] = [
  { key: "short", label: "短距离 (<100km)", min: 0, max: 99.999 },
  { key: "middle", label: "中距离 (100–300km)", min: 100, max: 300 },
  { key: "long", label: "长距离 (>300km)", min: 300.001, max: Number.POSITIVE_INFINITY },
];

export function bandOfDistance(distance: number): DistanceBand {
  return (
    DISTANCE_BANDS.find((b) => distance >= b.min && distance <= b.max) ??
    DISTANCE_BANDS[0]
  );
}

export interface SpeedResult {
  /** 用时（分钟） */
  minutes: number;
  /** 分速（米/分），保留整数 */
  mpm: number;
  /** 用时的中文描述 */
  durationText: string;
}

/** 按距离(公里)与放飞/归巢时间计算分速（米/分钟） */
export function calcSpeed(
  distanceKm: number,
  releaseTime: string,
  arrivalTime: string
): SpeedResult | null {
  if (!distanceKm || !releaseTime || !arrivalTime) return null;
  const start = parseLocal(releaseTime);
  const end = parseLocal(arrivalTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  const minutes = (end - start) / 60000;
  const mpm = Math.round((distanceKm * 1000) / minutes);
  return { minutes, mpm, durationText: formatDuration(minutes) };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m}分钟`;
  return `${h}小时${m ? `${m}分` : ""}`;
}

export function formatTime(s?: string | null): string {
  if (!s) return "—";
  const t = parseLocal(s);
  if (!Number.isFinite(t)) return "—";
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** 放飞超过 24 小时仍未归巢 */
export function isOverdue(training: Training, entry: Entry, at: number = Date.now()): boolean {
  if (entry.status !== "在飞" || !training.releaseTime) return false;
  const released = parseLocal(training.releaseTime);
  return Number.isFinite(released) && at - released > 24 * HOUR_MS;
}

export function overdueHours(training: Training, at: number = Date.now()): number {
  const released = parseLocal(training.releaseTime);
  if (!Number.isFinite(released)) return 0;
  return Math.max(0, (at - released) / HOUR_MS);
}
