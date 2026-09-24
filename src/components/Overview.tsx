import type { AppState, TabId } from "../types";
import { Empty, Panel, Tag } from "./common";
import {
  bandOfDistance,
  formatDuration,
  formatTime,
  isOverdue,
  parseLocal,
} from "../store";
import {
  entriesOfTraining,
  loftStats,
  overdueRows,
} from "../selectors";

function Metric({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: string;
}) {
  return (
    <article className={`metric${tone ? ` metric-${tone}` : ""}`}>
      <small>{label}</small>
      <strong>
        {value}
        {unit && <em>{unit}</em>}
      </strong>
    </article>
  );
}

export default function Overview({
  state,
  goto,
}: {
  state: AppState;
  goto: (tab: TabId) => void;
}) {
  const stats = loftStats(state);
  const overdue = overdueRows(state);
  const recent = [...state.trainings]
    .sort((a, b) => b.releaseTime.localeCompare(a.releaseTime))
    .slice(0, 5);

  return (
    <div className="view-grid">
      <div className="metric-grid">
        <Metric label="在档赛鸽" value={stats.pigeonCount} unit="羽" />
        <Metric
          label="归巢率"
          value={stats.homeRate === null ? "—" : stats.homeRate}
          unit={stats.homeRate === null ? "" : "%"}
        />
        <Metric
          label="平均分速"
          value={stats.avgMpm === null ? "—" : stats.avgMpm}
          unit="米/分"
        />
        <Metric
          label="最佳分速"
          value={stats.bestMpm === null ? "—" : stats.bestMpm}
          unit="米/分"
        />
        <Metric
          label="在飞未归"
          value={stats.flyingCount}
          unit="羽"
          tone={stats.flyingCount > 0 ? "orange" : undefined}
        />
        <Metric
          label="催查（超24h）"
          value={stats.overdueCount}
          unit="羽"
          tone={stats.overdueCount > 0 ? "red" : "green"}
        />
        <Metric label="累计训放" value={stats.trainingCount} unit="次" />
        <Metric
          label="待核名单"
          value={stats.reviewedCount}
          unit="羽"
          tone={stats.reviewedCount > 0 ? "red" : "green"}
        />
      </div>

      <Panel
        title="催查名单"
        sub="放飞超过 24 小时仍未归巢"
        extra={
          <button className="btn-link" onClick={() => goto("training")}>
            去登记归巢 →
          </button>
        }
      >
        {overdue.length === 0 ? (
          <Empty text="暂无超时未归的鸽子" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>足环号</th>
                  <th>血统</th>
                  <th>训放地点</th>
                  <th>距离</th>
                  <th>放飞时间</th>
                  <th>已超时</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map(({ training, entry, pigeon, hours }) => (
                  <tr key={entry.id}>
                    <td className="mono">{entry.ring}</td>
                    <td>
                      {pigeon?.bloodline?.trim() ? (
                        pigeon.bloodline
                      ) : (
                        <Tag tone="orange">未建档</Tag>
                      )}
                    </td>
                    <td>{training.location}</td>
                    <td>{training.distance}km</td>
                    <td>{formatTime(training.releaseTime)}</td>
                    <td className="text-red">
                      {formatDuration(hours * 60)}
                    </td>
                    <td>
                      <Tag tone="red">催查</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="近期训放"
        sub="最近 5 次"
        extra={
          <button className="btn-link" onClick={() => goto("training")}>
            训放登记 →
          </button>
        }
      >
        {recent.length === 0 ? (
          <Empty text="点击“训放登记”新建第一次训放" />
        ) : (
          <div className="training-cards">
            {recent.map((t) => {
              const list = entriesOfTraining(state, t.id);
              const home = list.filter((e) => e.status === "归巢").length;
              const overdueCount = list.filter((e) => isOverdue(t, e)).length;
              const elapsedMin =
                (Date.now() - parseLocal(t.releaseTime)) / 60000;
              return (
                <article key={t.id} className="training-card">
                  <div className="training-card-head">
                    <div>
                      <h3>{t.location}</h3>
                      <p>
                        {formatTime(t.releaseTime)} · {t.weather || "天气未填"}
                      </p>
                    </div>
                    <Tag tone="blue">{bandOfDistance(t.distance).label.split(" ")[0]}</Tag>
                  </div>
                  <div className="training-card-stats">
                    <span>
                      <b>{t.distance}</b> km
                    </span>
                    <span>
                      <b>
                        {home}/{list.length}
                      </b>{" "}
                      归巢
                    </span>
                    <span>
                      <b>{Math.max(0, Math.round(elapsedMin / 60))}</b> 小时前
                    </span>
                    {overdueCount > 0 && (
                      <Tag tone="red">{overdueCount} 羽催查</Tag>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="quick-row">
        <button className="btn-primary big" onClick={() => goto("training")}>
          ＋ 新建训放
        </button>
        <button className="big" onClick={() => goto("pigeons")}>
          单羽档案
        </button>
        <button className="big" onClick={() => goto("ranking")}>
          成绩排行
        </button>
        <button className="big" onClick={() => goto("review")}>
          待核名单{stats.reviewedCount > 0 ? `（${stats.reviewedCount}）` : ""}
        </button>
      </div>
    </div>
  );
}
