import { calcSpeed, isOverdue, bandOfDistance, DISTANCE_BANDS } from "../src/store";
import { rankRows, needsReview, reviewReasons, loftStats, overdueRows } from "../src/selectors";
import type { AppState } from "../src/types";

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error("✗", msg);
  }
}

// 1. 分速：120km / 100分钟 = 1200 米/分
const release = "2026-09-24T07:00";
const arrival = "2026-09-24T08:40";
const s1 = calcSpeed(120, release, arrival)!;
assert(s1.mpm === 1200, `分速应为1200，实际${s1?.mpm}`);
assert(s1.minutes === 100, `用时应为100分钟，实际${s1?.minutes}`);
assert(s1.durationText === "1小时40分", `时长文本应为1小时40分，实际${s1?.durationText}`);

// 归巢早于放飞 → null
assert(calcSpeed(100, "2026-09-24T08:00", "2026-09-24T07:00") === null, "归巢早于放飞应返回null");
assert(calcSpeed(100, "2026-09-24T08:00", "2026-09-24T08:00") === null, "同时返回应null");

// 2. 距离档
assert(bandOfDistance(80).key === "short", "80km 短距离");
assert(bandOfDistance(100).key === "middle", "100km 中距离");
assert(bandOfDistance(300).key === "middle", "300km 中距离");
assert(bandOfDistance(350).key === "long", "350km 长距离");
assert(DISTANCE_BANDS.length === 3, "三个距离档");

// 3. 待核
assert(needsReview({ id: "a", ring: "R1", bloodline: "", sex: "公", health: "正常", createdAt: "" }), "血统未建档应待核");
assert(needsReview({ id: "b", ring: "R2", bloodline: "詹森系", sex: "公", health: "异常", createdAt: "" }), "健康异常应待核");
assert(!needsReview({ id: "c", ring: "R3", bloodline: "詹森系", sex: "公", health: "正常", createdAt: "" }), "齐全且健康不待核");
assert(reviewReasons({ id: "b", ring: "R2", bloodline: "", sex: "公", health: "异常", createdAt: "" }).length === 2, "两个待核原因");

// 4. 完整 state 排行 / 催查 / 统计
const H = 3600000;
const now = Date.now();
const fmt = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const state: AppState = {
  pigeons: [
    { id: "p1", ring: "R-OK-1", bloodline: "詹森系", sex: "公", health: "正常", createdAt: "" },
    { id: "p2", ring: "R-OK-2", bloodline: "凡龙系", sex: "母", health: "正常", createdAt: "" },
    { id: "p3", ring: "R-BAD-HEALTH", bloodline: "詹森系", sex: "公", health: "异常", createdAt: "" },
    { id: "p4", ring: "R-NO-BLOOD", bloodline: "", sex: "母", health: "正常", createdAt: "" },
  ],
  trainings: [
    { id: "t1", location: "静海", distance: 100, releaseTime: fmt(now - 2 * H), weather: "晴", createdAt: "" },
    { id: "t2", location: "远距离点", distance: 350, releaseTime: fmt(now - 30 * H), weather: "阴", createdAt: "" },
  ],
  entries: [
    // t1: 两羽正常，分速不同
    { id: "e1", trainingId: "t1", ring: "R-OK-1", status: "归巢", arrivalTime: fmt(now - 2 * H + 50 * 60000), arrivalHealth: "正常" },
    { id: "e2", trainingId: "t1", ring: "R-OK-2", status: "归巢", arrivalTime: fmt(now - 2 * H + 80 * 60000), arrivalHealth: "正常" },
    // 健康异常，成绩不计排行
    { id: "e3", trainingId: "t1", ring: "R-BAD-HEALTH", status: "归巢", arrivalTime: fmt(now - 2 * H + 60 * 60000), arrivalHealth: "异常" },
    // 血统未建档，成绩不计排行
    { id: "e4", trainingId: "t1", ring: "R-NO-BLOOD", status: "归巢", arrivalTime: fmt(now - 2 * H + 40 * 60000), arrivalHealth: "正常" },
    // t2: 在飞 30 小时 → 催查
    { id: "e5", trainingId: "t2", ring: "R-OK-1", status: "在飞", arrivalTime: null },
    // t2: 在飞 30h 但已在另一条... 再加一羽超时
    { id: "e6", trainingId: "t2", ring: "R-OK-2", status: "在飞", arrivalTime: null },
  ],
};

const rows = rankRows(state);
assert(rows.length === 4, `应有4条归巢成绩，实际${rows.length}`);
assert(rows[0].entry.ring === "R-NO-BLOOD", "分速最高的是未建档鸽（仅排序原始数据）");
const ranked = rows.filter((r) => !r.excluded);
assert(ranked.length === 2, `有效排行应2条，实际${ranked.length}`);
assert(ranked[0].entry.ring === "R-OK-1", "有效第一名 R-OK-1");
assert(ranked[1].entry.ring === "R-OK-2", "有效第二名 R-OK-2");
assert(ranked[0].mpm === 2000, `R-OK-1 分速 100km/50min=2000，实际${ranked[0].mpm}`);

const excl = rows.filter((r) => r.excluded).map((r) => r.entry.ring);
assert(excl.includes("R-BAD-HEALTH"), "健康异常被排除");
assert(excl.includes("R-NO-BLOOD"), "血统未建档被排除");

// 催查
const overdue = overdueRows(state);
assert(overdue.length === 2, `催查应2条，实际${overdue.length}`);
assert(isOverdue(state.trainings[1], state.entries[4]), "30小时未归应催查");
assert(!isOverdue(state.trainings[0], state.entries[0]), "已归巢不应催查");

// 统计
const stats = loftStats(state);
assert(stats.overdueCount === 2, "催查数2");
assert(stats.reviewedCount === 2, "待核数2");
assert(stats.homeRate === 67, `归巢率4/6≈67%，实际${stats.homeRate}`);
assert(stats.avgMpm === 1625, `有效平均分速(2000+1250)/2=1625，实际${stats.avgMpm}`);

console.log(`\n${fail === 0 ? "全部通过" : "有失败"}：${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
