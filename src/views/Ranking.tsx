import { useMemo } from "react";
import {
  Entry,
  TIER_FILTERS,
  TIER_LABEL,
  Training,
  TierFilter,
  formatDT,
  formatDuration,
  formatSpeed,
  flightMinutes,
  isEligible,
  pigeonMap,
  tierOf,
  uniqueBloodlines,
  velocityOf,
} from "../ledger";
import { Store } from "../ledger";
import { Badge, Empty } from "./ui";

interface RankRow {
  training: Training;
  entry: Entry;
  bloodline: string;
  speed: number;
}

export function Ranking({ store }: { store: Store }) {
  const { pigeons, trainings, filters } = store.state;
  const map = useMemo(() => pigeonMap(pigeons), [pigeons]);
  const bloodlines = useMemo(() => uniqueBloodlines(pigeons), [pigeons]);

  const rows = useMemo(() => {
    const list: RankRow[] = [];
    for (const training of trainings) {
      for (const entry of training.entries) {
        if (!isEligible(training, entry, map)) continue;
        const speed = velocityOf(training, entry);
        if (speed === null) continue;
        const pigeon = map.get(entry.ringNo);
        if (!pigeon) continue;
        if (filters.tier !== "all" && tierOf(training.distanceKm) !== (filters.tier as Exclude<TierFilter, "all">))
          continue;
        if (filters.bloodline !== "all" && pigeon.bloodline !== filters.bloodline) continue;
        if (filters.query.trim() && !entry.ringNo.toLowerCase().includes(filters.query.trim().toLowerCase()))
          continue;
        list.push({ training, entry, bloodline: pigeon.bloodline, speed });
      }
    }
    // 分速降序；相同分速按归巢时间先到先排
    return list.sort((a, b) => {
      if (b.speed !== a.speed) return b.speed - a.speed;
      return +new Date(a.entry.returnAt) - +new Date(b.entry.returnAt);
    });
  }, [trainings, map, filters]);

  // 各距离档的最佳分速（用于横向参考）
  const bestByTier = useMemo(() => {
    const best = new Map<string, number>();
    for (const training of trainings) {
      for (const entry of training.entries) {
        if (!isEligible(training, entry, map)) continue;
        const v = velocityOf(training, entry);
        if (v === null) continue;
        const key = tierOf(training.distanceKm);
        if (!best.has(key) || (best.get(key) as number) < v) best.set(key, v);
      }
    }
    return best;
  }, [trainings, map]);

  return (
    <div className="stack">
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>训放成绩排行</h2>
            <p>
              全部在榜归巢记录按分速排序；待核（健康异常 / 血统未建档）和未归巢不参与排行
            </p>
          </div>
          <div className="tier-best">
            {(["short", "mid", "long"] as const).map((t) => (
              <span key={t} className="muted">
                {TIER_LABEL[t]}最佳 <b>{formatSpeed(bestByTier.get(t) ?? null)}</b>
              </span>
            ))}
          </div>
        </header>

        <div className="filters">
          <div className="seg">
            {TIER_FILTERS.map((f) => (
              <button
                key={f.value}
                className={filters.tier === f.value ? "seg-on" : ""}
                onClick={() => store.setFilters({ tier: f.value })}
                title={f.hint}
              >
                {f.label}
                {f.hint ? <em className="seg-hint">{f.hint}</em> : null}
              </button>
            ))}
          </div>
          <select
            className="select"
            value={filters.bloodline}
            onChange={(e) => store.setFilters({ bloodline: e.target.value })}
          >
            <option value="all">全部血统</option>
            {bloodlines.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <input
            className="search"
            placeholder="搜索足环号"
            value={filters.query}
            onChange={(e) => store.setFilters({ query: e.target.value })}
          />
          {(filters.tier !== "all" || filters.bloodline !== "all" || filters.query) && (
            <button
              onClick={() =>
                store.setFilters({ tier: "all", bloodline: "all", query: "" })
              }
            >
              清除筛选
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        {rows.length === 0 ? (
          <Empty>当前筛选下没有在榜成绩，试试清除筛选或调整距离档</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="col-rank">总名次</th>
                  <th>足环号</th>
                  <th>血统</th>
                  <th>场次</th>
                  <th>距离档</th>
                  <th>归巢时间</th>
                  <th>用时</th>
                  <th>分速</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const minutes = flightMinutes(row.training, row.entry);
                  return (
                    <tr key={row.entry.id} className={i < 3 ? `podium podium-${i + 1}` : ""}>
                      <td className="col-rank">
                        <span className={`rank-num ${i < 3 ? "rank-top" : ""}`}>#{i + 1}</span>
                      </td>
                      <td>
                        <button
                          className="link"
                          onClick={() =>
                            store.setUi({ tab: "pigeons", ringNo: row.entry.ringNo })
                          }
                        >
                          {row.entry.ringNo}
                        </button>
                      </td>
                      <td>
                        <Badge tone="purple">{row.bloodline}</Badge>
                      </td>
                      <td>
                        <button
                          className="link"
                          onClick={() =>
                            store.setUi({ tab: "trainings", trainingId: row.training.id })
                          }
                        >
                          {row.training.location}
                        </button>
                        <div className="muted small">{formatDT(row.training.releaseAt)}</div>
                      </td>
                      <td>
                        <Badge tone="blue">
                          {TIER_LABEL[tierOf(row.training.distanceKm)]} · {row.training.distanceKm}
                          km
                        </Badge>
                      </td>
                      <td>{formatDT(row.entry.returnAt)}</td>
                      <td>{minutes === null ? "—" : formatDuration(minutes)}</td>
                      <td className="speed-cell">{formatSpeed(row.speed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
