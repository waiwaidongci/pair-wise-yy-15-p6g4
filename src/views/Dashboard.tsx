import { useMemo } from "react";
import {
  Entry,
  TIER_LABEL,
  Training,
  formatDT,
  formatSpeed,
  overdueItems,
  pendingFlightItems,
  pendingReasons,
  pigeonMap,
  tierOf,
  velocityOf,
} from "../ledger";
import { Store } from "../ledger";
import { Badge, Empty, hoursLabel } from "./ui";

export function Dashboard({
  store,
  now,
}: {
  store: Store;
  now: number;
}) {
  const { pigeons, trainings } = store.state;
  const map = useMemo(() => pigeonMap(pigeons), [pigeons]);

  const stats = useMemo(() => {
    const allEntries: { training: Training; entry: Entry }[] = [];
    for (const t of trainings) for (const e of t.entries) allEntries.push({ training: t, entry: e });
    const returned = allEntries.filter((x) => x.entry.returnAt);
    const speeds = returned
      .map((x) => velocityOf(x.training, x.entry))
      .filter((v): v is number => v !== null);
    const avg = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
    const bloodlines = new Set(pigeons.map((p) => p.bloodline.trim()).filter(Boolean));
    return {
      pigeonCount: pigeons.length,
      trainingCount: trainings.length,
      returnRate: allEntries.length ? (returned.length / allEntries.length) * 100 : null,
      avg,
      bloodlineCount: bloodlines.size,
    };
  }, [pigeons, trainings]);

  const overdue = useMemo(() => overdueItems(trainings, now), [trainings, now]);
  const flying = useMemo(() => pendingFlightItems(trainings, now), [trainings, now]);

  const reviewRows = useMemo(() => {
    const rows: {
      training: Training;
      entry: Entry;
      reasons: string[];
    }[] = [];
    for (const t of trainings) {
      for (const e of t.entries) {
        const reasons = pendingReasons(e, map);
        if (reasons.length) rows.push({ training: t, entry: e, reasons });
      }
    }
    return rows;
  }, [trainings, map]);

  const openTraining = (id: string) =>
    store.setUi({ tab: "trainings", trainingId: id });
  const openPigeon = (ringNo: string) => store.setUi({ tab: "pigeons", ringNo });

  return (
    <div className="stack">
      <div className="metric-grid">
        <Metric label="在棚档案" value={String(stats.pigeonCount)} unit="羽" tone="blue" />
        <Metric label="累计训放" value={String(stats.trainingCount)} unit="站" tone="purple" />
        <Metric
          label="整体归巢率"
          value={stats.returnRate === null ? "—" : stats.returnRate.toFixed(0)}
          unit={stats.returnRate === null ? "" : "%"}
          tone="green"
        />
        <Metric label="平均分速" value={formatSpeed(stats.avg)} tone="blue" />
        <Metric label="催查" value={String(overdue.length)} unit="羽次" tone="red" />
        <Metric label="待核" value={String(reviewRows.length)} unit="条" tone="orange" />
        <Metric label="飞行中" value={String(flying.length)} unit="羽次" tone="blue" />
        <Metric label="血统档案" value={String(stats.bloodlineCount)} unit="种" tone="purple" />
      </div>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>催查名单</h2>
            <p>放飞超过 24 小时仍未归巢，需立即排查、联系落巢点</p>
          </div>
          <Badge tone="red">{overdue.length} 羽次</Badge>
        </header>
        {overdue.length === 0 ? (
          <Empty>暂无超 24 小时未归巢的鸽子</Empty>
        ) : (
          <ul className="alert-list">
            {overdue.map(({ training, entry, hours }) => (
              <li key={entry.id} className="alert-row alert-red">
                <div>
                  <button className="link" onClick={() => openPigeon(entry.ringNo)}>
                    {entry.ringNo}
                  </button>
                  <span className="muted">
                    {map.get(entry.ringNo)?.bloodline || "未建档"} ·{" "}
                    {training.location} {training.distanceKm}km · 放飞{" "}
                    {formatDT(training.releaseAt)}
                  </span>
                </div>
                <div className="row-actions">
                  <Badge tone="red">已逾 {hoursLabel(hours)}</Badge>
                  <button onClick={() => openTraining(training.id)}>去登记</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <header className="panel-head">
            <div>
              <h2>待核名单</h2>
              <p>健康异常或血统未建档，不参与排行；处理后自动入榜</p>
            </div>
            <Badge tone="orange">{reviewRows.length} 条</Badge>
          </header>
          {reviewRows.length === 0 ? (
            <Empty>暂无待核记录</Empty>
          ) : (
            <ul className="alert-list">
              {reviewRows.map(({ training, entry, reasons }) => (
                <li key={entry.id} className="alert-row alert-orange">
                  <div>
                    <button className="link" onClick={() => openPigeon(entry.ringNo)}>
                      {entry.ringNo}
                    </button>
                    <span className="muted">
                      {training.location} {training.distanceKm}km（
                      {TIER_LABEL[tierOf(training.distanceKm)]}） ·{" "}
                      {entry.returnAt ? `归巢 ${formatDT(entry.returnAt)}` : "尚未归巢"}
                      {entry.healthNote ? ` · ${entry.healthNote}` : ""}
                    </span>
                  </div>
                  <div className="row-actions">
                    {reasons.map((r) => (
                      <Badge key={r} tone="orange">
                        {r}
                      </Badge>
                    ))}
                    <button onClick={() => openTraining(training.id)}>去处理</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <h2>飞行中</h2>
              <p>24 小时内放飞、尚未归巢，继续等待打钟</p>
            </div>
            <Badge tone="blue">{flying.length} 羽次</Badge>
          </header>
          {flying.length === 0 ? (
            <Empty>当前没有在飞的鸽子</Empty>
          ) : (
            <ul className="alert-list">
              {flying.map(({ training, entry, hours }) => (
                <li key={entry.id} className="alert-row alert-blue">
                  <div>
                    <button className="link" onClick={() => openPigeon(entry.ringNo)}>
                      {entry.ringNo}
                    </button>
                    <span className="muted">
                      {training.location} {training.distanceKm}km · 已飞 {hoursLabel(hours)}
                    </span>
                  </div>
                  <button onClick={() => openTraining(training.id)}>登记归巢</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: "blue" | "green" | "orange" | "red" | "purple";
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <small>{label}</small>
      <strong>
        {value}
        {unit ? <em>{unit}</em> : null}
      </strong>
    </article>
  );
}
