export type Sex = "公" | "母";
export type Health = "正常" | "异常";
export type EntryStatus = "在飞" | "归巢";

/** 单羽赛鸽档案 */
export interface Pigeon {
  id: string;
  /** 足环号 */
  ring: string;
  /** 血统，空字符串表示尚未建档 */
  bloodline: string;
  sex: Sex;
  health: Health;
  note?: string;
  /** 当前配对的另一羽鸽子 id */
  mateId?: string | null;
  createdAt: string;
}

/** 一次训放（放飞） */
export interface Training {
  id: string;
  /** 训放地点 */
  location: string;
  /** 放飞距离（公里） */
  distance: number;
  /** 放飞时间，本地时间字符串（datetime-local） */
  releaseTime: string;
  /** 天气 */
  weather: string;
  note?: string;
  createdAt: string;
}

/** 某次训放中一羽鸽子的归巢登记 */
export interface Entry {
  id: string;
  trainingId: string;
  /** 足环号，与 Pigeon.ring 对应；档案移除后记录保留 */
  ring: string;
  status: EntryStatus;
  /** 归巢时间 */
  arrivalTime?: string | null;
  /** 归巢时健康状态 */
  arrivalHealth?: Health;
  note?: string;
}

export interface AppState {
  pigeons: Pigeon[];
  trainings: Training[];
  entries: Entry[];
}

export type TabId = "overview" | "training" | "ranking" | "review" | "pigeons";

/** 需要跨页面保留的筛选与视图状态 */
export interface UiState {
  tab: TabId;
  rankBand: string;
  rankBloodline: string;
  rankRing: string;
  listBloodline: string;
  listStatus: string;
  listRing: string;
}
