import type { AppState, Entry, Pigeon, Training } from "./types";
import { bandOfDistance, calcSpeed, isOverdue } from "./store";

export function pigeonByRing(state: AppState, ring: string): Pigeon | undefined {
  return state.pigeons.find((p) => p.ring === ring);
}

export function bloodlines(state: AppState): string[] {
  return Array.from(
    new Set(
      state.pigeons
        .map((p) => p.bloodline.trim())
        .filter((b): b is string => b.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

export function entriesOfTraining(state: AppState, trainingId: string): Entry[] {
  return state.entries.filter((e) => e.trainingId === trainingId);
}

export function trainingById(state: AppState, id: string): Training | undefined {
  return state.trainings.find((t) => t.id === id);
}

/** 待核判定：血统未建档或当前健康异常 */
export function needsReview(p: Pigeon): boolean {
  return !p.bloodline.trim() || p.health === "异常";
}

export function reviewReasons(p: Pigeon): string[] {
  const reasons: string[] = [];
  if (!p.bloodline.trim()) reasons.push("血统未建档");
  if (p.health === "异常") reasons.push("健康异常");
  return reasons;
}

export interface RankRow {
  entry: Entry;
  training: Training;
  pigeon?: Pigeon;
  mpm: number;
  minutes: number;
  durationText: string;
  excluded: boolean;
  excludeReasons: string[];
  arrivalAbnormal: boolean;
}

export function rankRows(state: AppState): RankRow[] {
  const rows: RankRow[] = [];
  for (const entry of state.entries) {
    const training = trainingById(state, entry.trainingId);
    if (!training) continue;
    const pigeon = pigeonByRing(state, entry.ring);
    const speed =
      entry.status === "归巢" && entry.arrivalTime
        ? calcSpeed(training.distance, training.releaseTime, entry.arrivalTime)
        : null;
    if (!speed) continue;
    const reasons: string[] = [];
    if (!pigeon) {
      reasons.push("档案已移除");
    } else {
      if (!pigeon.bloodline.trim()) reasons.push("血统未建档");
      if (pigeon.health === "异常") reasons.push("健康异常");
    }
    rows.push({
      entry,
      training,
      pigeon,
      mpm: speed.mpm,
      minutes: speed.minutes,
      durationText: speed.durationText,
      excluded: reasons.length > 0,
      excludeReasons: reasons,
      arrivalAbnormal: entry.arrivalHealth === "异常",
    });
  }
  return rows.sort((a, b) => b.mpm - a.mpm);
}

export interface OverdueRow {
  training: Training;
  entry: Entry;
  pigeon?: Pigeon;
  hours: number;
}

export function overdueRows(state: AppState): OverdueRow[] {
  const at = Date.now();
  const rows: OverdueRow[] = [];
  for (const t of state.trainings) {
    for (const e of entriesOfTraining(state, t.id)) {
      if (isOverdue(t, e, at)) {
        rows.push({
          training: t,
          entry: e,
          pigeon: pigeonByRing(state, e.ring),
          hours: (at - new Date(t.releaseTime).getTime()) / 3_600_000,
        });
      }
    }
  }
  return rows.sort((a, b) => a.training.releaseTime.localeCompare(b.training.releaseTime));
}

export interface PigeonHistoryItem {
  entry: Entry;
  training: Training;
  mpm?: number;
  durationText?: string;
  bandLabel: string;
  overdue: boolean;
}

export function pigeonHistory(state: AppState, ring: string): PigeonHistoryItem[] {
  return state.entries
    .filter((e) => e.ring === ring)
    .map((entry) => {
      const training = trainingById(state, entry.trainingId)!;
      const speed =
        entry.status === "归巢" && entry.arrivalTime
          ? calcSpeed(training.distance, training.releaseTime, entry.arrivalTime)
          : null;
      return {
        entry,
        training,
        mpm: speed?.mpm,
        durationText: speed?.durationText,
        bandLabel: bandOfDistance(training.distance).label,
        overdue: isOverdue(training, entry),
      };
    })
    .filter((h) => h.training)
    .sort((a, b) =>
      b.training.releaseTime.localeCompare(a.training.releaseTime)
    );
}

export interface LoftStats {
  pigeonCount: number;
  reviewedCount: number;
  trainingCount: number;
  homeRate: number | null;
  avgMpm: number | null;
  bestMpm: number | null;
  overdueCount: number;
  flyingCount: number;
}

export function loftStats(state: AppState): LoftStats {
  const released = state.entries.length;
  const home = state.entries.filter((e) => e.status === "归巢").length;
  const eligible = rankRows(state).filter((r) => !r.excluded);
  const avgMpm =
    eligible.length > 0
      ? Math.round(eligible.reduce((s, r) => s + r.mpm, 0) / eligible.length)
      : null;
  const bestMpm = eligible.length > 0 ? eligible[0].mpm : null;
  return {
    pigeonCount: state.pigeons.length,
    reviewedCount: state.pigeons.filter(needsReview).length,
    trainingCount: state.trainings.length,
    homeRate: released ? Math.round((home / released) * 100) : null,
    avgMpm,
    bestMpm,
    overdueCount: overdueRows(state).length,
    flyingCount: released - home,
  };
}
