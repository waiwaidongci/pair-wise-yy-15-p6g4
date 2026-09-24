/* 鸽棚训放台账：数据模型、派生计算、本地存储与演示数据 */

export type Tier = "short" | "mid" | "long";
export type TierFilter = Tier | "all";
export type Sex = "" | "雄" | "雌";

export interface Pigeon {
  ringNo: string; // 足环号，同时作为档案主键
  bloodline: string; // 血统；为空视为未建档
  sex: Sex;
  healthNote: string; // 当前健康异常备注，非空表示健康异常
  note: string;
  mateRingNo: string; // 当前配对足环号
  createdAt: string;
}

export interface Entry {
  id: string;
  ringNo: string; // 足环号
  returnAt: string; // 归巢时间（datetime-local），留空表示尚未归巢
  abnormal: boolean; // 归巢登记时标记健康异常
  healthNote: string; // 异常说明
  createdAt: string;
}

export interface Training {
  id: string;
  location: string; // 训放地点
  distanceKm: number; // 放飞距离（公里）
  releaseAt: string; // 放飞时间
  weather: string; // 天气
  entries: Entry[];
  createdAt: string;
}

export interface RankingFilters {
  tier: TierFilter;
  bloodline: string; // "all" 或具体血统
  query: string; // 足环号搜索
}

export type Tab = "dashboard" | "trainings" | "ranking" | "pigeons";

export interface UiState {
  tab: Tab;
  trainingId: string;
  ringNo: string;
}

export interface PersistState {
  pigeons: Pigeon[];
  trainings: Training[];
  filters: RankingFilters;
  ui: UiState;
}

export interface PigeonInput {
  ringNo: string;
  bloodline: string;
  sex: Sex;
  healthNote: string;
  note: string;
}

export interface TrainingInput {
  location: string;
  distanceKm: number;
  releaseAt: string;
  weather: string;
}

export interface EntryInput {
  ringNo: string;
  returnAt: string;
  abnormal: boolean;
  healthNote: string;
}

export type OpResult = { ok: true; id: string } | { ok: false; error: string };

export interface Store {
  state: PersistState;
  setFilters(patch: Partial<RankingFilters>): void;
  setUi(patch: Partial<UiState>): void;
  addPigeon(input: PigeonInput): OpResult;
  updatePigeon(ringNo: string, patch: Partial<Omit<Pigeon, "ringNo">>): void;
  removePigeon(ringNo: string): void;
  pairPigeons(a: string, b: string): void;
  unpair(ringNo: string): void;
  addTraining(input: TrainingInput): OpResult;
  updateTraining(id: string, patch: Partial<TrainingInput>): void;
  removeTraining(id: string): void;
  addEntry(trainingId: string, input: EntryInput): OpResult;
  updateEntry(trainingId: string, entryId: string, patch: Partial<EntryInput>): void;
  removeEntry(trainingId: string, entryId: string): void;
  quickArchive(ringNo: string, bloodline: string): OpResult;
  resetDemo(): void;
}

/* ---------------- 常量与格式化 ---------------- */

export const TIER_LABEL: Record<Tier, string> = {
  short: "短距离",
  mid: "中距离",
  long: "长距离",
};

export const TIER_FILTERS: { value: TierFilter; label: string; hint: string }[] = [
  { value: "all", label: "全部距离", hint: "" },
  { value: "short", label: "短距离", hint: "<100km" },
  { value: "mid", label: "中距离", hint: "100–300km" },
  { value: "long", label: "长距离", hint: "≥300km" },
];

export function tierOf(km: number): Tier {
  if (km < 100) return "short";
  if (km < 300) return "mid";
  return "long";
}

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const pad = (n: number) => String(n).padStart(2, "0");

/** Date -> datetime-local input 值 */
export function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** datetime-local 值 -> 显示用 MM-DD HH:mm */
export function formatDT(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(+d)) return s;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function formatFullDT(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(+d)) return s;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 分速（米/分）= 距离(米) / 用时(分钟)；时间无效返回 null */
export function velocityOf(training: Training, entry: Entry): number | null {
  if (!entry.returnAt) return null;
  const start = new Date(training.releaseAt).getTime();
  const end = new Date(entry.returnAt).getTime();
  const minutes = (end - start) / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return (training.distanceKm * 1000) / minutes;
}

export function flightMinutes(training: Training, entry: Entry): number | null {
  if (!entry.returnAt) return null;
  const minutes =
    (new Date(entry.returnAt).getTime() - new Date(training.releaseAt).getTime()) / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes;
}

export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h <= 0) return `${rest}分`;
  return `${h}小时${rest}分`;
}

export function formatSpeed(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v).toLocaleString("zh-CN")} m/min`;
}

/* ---------------- 派生名单 ---------------- */

export function pigeonMap(pigeons: Pigeon[]): Map<string, Pigeon> {
  return new Map(pigeons.map((p) => [p.ringNo, p]));
}

/** 待核原因：健康异常 / 血统未建档 */
export function pendingReasons(entry: Entry, map: Map<string, Pigeon>): string[] {
  const reasons: string[] = [];
  if (entry.abnormal) reasons.push("健康异常");
  const p = map.get(entry.ringNo);
  if (!p || !p.bloodline.trim()) reasons.push("血统未建档");
  return reasons;
}

/** 在榜资格：已归巢、时间有效、无健康异常、血统已建档 */
export function isEligible(training: Training, entry: Entry, map: Map<string, Pigeon>): boolean {
  if (!entry.returnAt || entry.abnormal) return false;
  if (velocityOf(training, entry) === null) return false;
  const p = map.get(entry.ringNo);
  return !!p && !!p.bloodline.trim();
}

/** 当场训放的在榜名次（分速降序） */
export function ranksFor(
  training: Training,
  map: Map<string, Pigeon>
): Map<string, number> {
  const ranked = training.entries
    .filter((e) => isEligible(training, e, map))
    .sort((a, b) => {
      const va = velocityOf(training, a) ?? 0;
      const vb = velocityOf(training, b) ?? 0;
      return vb - va;
    });
  return new Map(ranked.map((e, i) => [e.id, i + 1]));
}

export interface OverdueItem {
  training: Training;
  entry: Entry;
  hours: number;
}

/** 超过放飞 24 小时仍未归巢 → 催查 */
export function overdueItems(trainings: Training[], now = Date.now()): OverdueItem[] {
  const items: OverdueItem[] = [];
  for (const training of trainings) {
    const start = new Date(training.releaseAt).getTime();
    if (Number.isNaN(start)) continue;
    for (const entry of training.entries) {
      if (entry.returnAt) continue;
      const hours = (now - start) / 3600000;
      if (hours > 24) items.push({ training, entry, hours });
    }
  }
  return items.sort((a, b) => b.hours - a.hours);
}

/** 24 小时内尚未归巢 */
export function pendingFlightItems(trainings: Training[], now = Date.now()): OverdueItem[] {
  const items: OverdueItem[] = [];
  for (const training of trainings) {
    const start = new Date(training.releaseAt).getTime();
    if (Number.isNaN(start) || start > now) continue;
    for (const entry of training.entries) {
      if (entry.returnAt) continue;
      const hours = (now - start) / 3600000;
      if (hours <= 24) items.push({ training, entry, hours });
    }
  }
  return items.sort((a, b) => b.hours - a.hours);
}

export function uniqueBloodlines(pigeons: Pigeon[]): string[] {
  return [...new Set(pigeons.map((p) => p.bloodline.trim()).filter(Boolean))].sort();
}

/* ---------------- 本地存储 ---------------- */

const STORAGE_KEY = "pigeon-training-ledger-v1";

export function defaultFilters(): RankingFilters {
  return { tier: "all", bloodline: "all", query: "" };
}

/* ---------------- 演示数据 ---------------- */

function seedState(): PersistState {
  const now = Date.now();
  const at = (offsetHours: number, plusMinutes = 0) =>
    toInputValue(new Date(now - offsetHours * 3600_000 + plusMinutes * 60_000));

  const pigeons: Pigeon[] = [
    { ringNo: "CHN-24-001839", bloodline: "詹森系", sex: "雄", healthNote: "", note: "棚内主力，短距离爆发好", mateRingNo: "", createdAt: new Date(now - 40 * 864e5).toISOString() },
    { ringNo: "CHN-24-002114", bloodline: "凡龙系", sex: "雌", healthNote: "", note: "状态稳定", mateRingNo: "", createdAt: new Date(now - 40 * 864e5).toISOString() },
    { ringNo: "CHN-24-002115", bloodline: "凡龙系", sex: "雄", healthNote: "右侧主翼换羽中", note: "150km 站次未归，重点催查", mateRingNo: "", createdAt: new Date(now - 40 * 864e5).toISOString() },
    { ringNo: "CHN-24-003362", bloodline: "詹森系", sex: "雌", healthNote: "归巢后积食，隔离观察", note: "", mateRingNo: "", createdAt: new Date(now - 30 * 864e5).toISOString() },
    { ringNo: "CHN-23-008771", bloodline: "慕利门系", sex: "雌", healthNote: "", note: "留种种鸽", mateRingNo: "CHN-22-003210", createdAt: new Date(now - 300 * 864e5).toISOString() },
    { ringNo: "CHN-22-003210", bloodline: "胡本系", sex: "雄", healthNote: "", note: "留种种鸽", mateRingNo: "CHN-23-008771", createdAt: new Date(now - 400 * 864e5).toISOString() },
    { ringNo: "CHN-24-004108", bloodline: "胡本系", sex: "雄", healthNote: "", note: "今晨 50km 训放尚未归巢", mateRingNo: "", createdAt: new Date(now - 20 * 864e5).toISOString() },
  ];

  const mk = (ringNo: string, returnOffset: [number, number] | null, abnormal = false, note = ""): Entry => ({
    id: uid(),
    ringNo,
    returnAt: returnOffset ? at(returnOffset[0], returnOffset[1]) : "",
    abnormal,
    healthNote: note,
    createdAt: new Date().toISOString(),
  });

  const trainings: Training[] = [
    {
      id: uid(),
      location: "固安服务区",
      distanceKm: 80,
      releaseAt: at(48),
      weather: "晴，西北风2级",
      createdAt: new Date(now - 48 * 3600e3).toISOString(),
      entries: [
        mk("CHN-24-001839", [48, -68]),
        mk("CHN-24-002114", [48, -75]),
        mk("CHN-24-002115", [48, -82]),
        mk("CHN-24-003362", [48, -95]),
      ],
    },
    {
      id: uid(),
      location: "保定北站",
      distanceKm: 150,
      releaseAt: at(30),
      weather: "多云，侧风",
      createdAt: new Date(now - 30 * 3600e3).toISOString(),
      entries: [
        mk("CHN-24-001839", [30, -132]),
        mk("CHN-24-002114", [30, -145]),
        mk("CHN-24-002115", null), // 超过 24 小时未归 → 催查
        mk("CHN-24-003362", [30, -150], true, "归巢后积食、精神差"), // 健康异常 → 待核
        mk("CHN-24-009999", [30, -138]), // 血统未建档 → 待核
      ],
    },
    {
      id: uid(),
      location: "漷县集结点",
      distanceKm: 50,
      releaseAt: at(5),
      weather: "晴",
      createdAt: new Date(now - 5 * 3600e3).toISOString(),
      entries: [
        mk("CHN-24-001839", [5, -40]),
        mk("CHN-24-002114", [5, -48]),
        mk("CHN-24-004108", null), // 24 小时内未归，暂不催查
      ],
    },
  ];

  return {
    pigeons,
    trainings,
    filters: defaultFilters(),
    ui: { tab: "dashboard", trainingId: "", ringNo: "" },
  };
}

export function loadState(): PersistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistState>;
      if (parsed && Array.isArray(parsed.pigeons) && Array.isArray(parsed.trainings)) {
        return {
          pigeons: parsed.pigeons,
          trainings: parsed.trainings,
          filters: { ...defaultFilters(), ...(parsed.filters ?? {}) },
          ui: { tab: "dashboard", trainingId: "", ringNo: "", ...(parsed.ui ?? {}) },
        };
      }
    }
  } catch {
    /* 存档损坏时回退演示数据 */
  }
  return seedState();
}

export function saveState(state: PersistState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式等场景静默失败 */
  }
}

export { seedState, STORAGE_KEY };
