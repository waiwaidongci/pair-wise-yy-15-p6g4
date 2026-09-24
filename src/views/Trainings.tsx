import { useMemo, useState } from "react";
import {
  Entry,
  EntryInput,
  TIER_LABEL,
  Training,
  TrainingInput,
  formatDuration,
  formatFullDT,
  formatSpeed,
  flightMinutes,
  isEligible,
  pendingReasons,
  pigeonMap,
  ranksFor,
  tierOf,
  toInputValue,
  velocityOf,
} from "../ledger";
import { Store } from "../ledger";
import { Badge, Empty, Field, StatusPill, useConfirm, useFlash } from "./ui";

export function Trainings({ store, now }: { store: Store; now: number }) {
  const { trainings, ui } = store.state;
  const current = trainings.find((t) => t.id === ui.trainingId);

  if (current) {
    return (
      <TrainingDetail
        key={current.id}
        store={store}
        training={current}
        now={now}
        onBack={() => store.setUi({ trainingId: "" })}
      />
    );
  }
  return <TrainingList store={store} />;
}

/* ---------------- 训放列表与新建 ---------------- */

function TrainingList({ store }: { store: Store }) {
  const { trainings, pigeons } = store.state;
  const map = useMemo(() => pigeonMap(pigeons), [pigeons]);
  const { show, node } = useFlash();
  const sorted = [...trainings].sort(
    (a, b) => +new Date(b.releaseAt) - +new Date(a.releaseAt)
  );

  const [location, setLocation] = useState("");
  const [distance, setDistance] = useState("80");
  const [releaseAt, setReleaseAt] = useState(() => toInputValue(new Date()));
  const [weather, setWeather] = useState("晴");

  const submit = () => {
    const input: TrainingInput = {
      location,
      distanceKm: Number(distance),
      releaseAt,
      weather,
    };
    const res = store.addTraining(input);
    if (res.ok) {
      show("训放已创建，开始按足环登记归巢");
      setLocation("");
      setDistance("80");
      setWeather("晴");
    } else {
      show(res.error, "err");
    }
  };

  return (
    <div className="stack">
      {node}
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>新建训放</h2>
            <p>填好地点、距离、放飞时间和天气后，进入本场按足环登记归巢</p>
          </div>
        </header>
        <div className="form-grid">
          <Field label="训放地点">
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="如：固安服务区" />
          </Field>
          <Field label="放飞距离" hint="公里，自动归档短/中/长距离">
            <input
              type="number"
              min="1"
              step="1"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </Field>
          <Field label="放飞时间">
            <input
              type="datetime-local"
              value={releaseAt}
              onChange={(e) => setReleaseAt(e.target.value)}
            />
          </Field>
          <Field label="天气">
            <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="晴 / 多云 / 侧风…" />
          </Field>
        </div>
        <div className="form-actions">
          <button className="primary" onClick={submit}>
            创建训放并登记
          </button>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>历次训放</h2>
            <p>按放飞时间倒序排列，点击进入本场归巢登记与排行</p>
          </div>
        </header>
        {sorted.length === 0 ? (
          <Empty>还没有训放记录，先在上方创建一场</Empty>
        ) : (
          <div className="training-cards">
            {sorted.map((t) => {
              const returned = t.entries.filter((e) => e.returnAt).length;
              const eligible = t.entries.filter((e) => isEligible(t, e, map)).length;
              const overdue = t.entries
                .filter((e) => !e.returnAt)
                .filter((e) => (Date.now() - +new Date(t.releaseAt)) / 3600e3 > 24).length;
              return (
                <button
                  key={t.id}
                  className="training-card"
                  onClick={() => store.setUi({ tab: "trainings", trainingId: t.id })}
                >
                  <div className="tc-main">
                    <h3>{t.location}</h3>
                    <p>
                      {formatFullDT(t.releaseAt)} · {t.weather || "天气未填"}
                    </p>
                  </div>
                  <div className="tc-meta">
                    <Badge tone="purple">
                      {TIER_LABEL[tierOf(t.distanceKm)]} · {t.distanceKm}km
                    </Badge>
                    <span className="muted">
                      归巢 {returned}/{t.entries.length} · 在榜 {eligible}
                    </span>
                    {overdue > 0 && <Badge tone="red">催查 {overdue}</Badge>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- 单场训放详情 ---------------- */

function TrainingDetail({
  store,
  training,
  now,
  onBack,
}: {
  store: Store;
  training: Training;
  now: number;
  onBack: () => void;
}) {
  const { pigeons } = store.state;
  const map = useMemo(() => pigeonMap(pigeons), [pigeons]);
  const ranks = useMemo(() => ranksFor(training, map), [training, map]);
  const confirm = useConfirm();
  const { show, node } = useFlash();

  const [editing, setEditing] = useState(false);
  const [loc, setLoc] = useState(training.location);
  const [dist, setDist] = useState(String(training.distanceKm));
  const [rel, setRel] = useState(training.releaseAt);
  const [wx, setWx] = useState(training.weather);

  const saveHeader = () => {
    if (!loc.trim()) return show("地点不能为空", "err");
    if (!(Number(dist) > 0)) return show("距离需大于 0", "err");
    if (!rel) return show("请选择放飞时间", "err");
    store.updateTraining(training.id, {
      location: loc,
      distanceKm: Number(dist),
      releaseAt: rel,
      weather: wx,
    });
    setEditing(false);
    show("训放信息已更新");
  };

  const [ringNo, setRingNo] = useState("");
  const [returnAt, setReturnAt] = useState(() => toInputValue(new Date()));
  const [abnormal, setAbnormal] = useState(false);
  const [healthNote, setHealthNote] = useState("");
  const [notReturned, setNotReturned] = useState(false);

  const resetEntryForm = () => {
    setRingNo("");
    setAbnormal(false);
    setHealthNote("");
    setNotReturned(false);
  };

  const register = () => {
    const pigeon = map.get(ringNo.trim());
    // 档案本身处于健康异常期且未勾选“未归巢”时，归巢登记自动按异常处理并带入备注
    const autoAbnormal = !notReturned && !abnormal && !!pigeon?.healthNote;
    const input: EntryInput = {
      ringNo,
      returnAt: notReturned ? "" : returnAt,
      abnormal: abnormal || autoAbnormal,
      healthNote: healthNote || (autoAbnormal && pigeon ? pigeon.healthNote : ""),
    };
    const res = store.addEntry(training.id, input);
    if (res.ok) {
      show(notReturned ? "已登记为未归巢（放飞名单）" : "归巢已登记，分速已自动计算");
      resetEntryForm();
    } else {
      show(res.error, "err");
    }
  };

  const knownRing = map.get(ringNo.trim());

  return (
    <div className="stack">
      {node}
      <button className="back" onClick={onBack}>
        ← 返回训放列表
      </button>

      <section className="panel">
        {!editing ? (
          <header className="panel-head detail-head">
            <div>
              <h2>
                {training.location}
                <Badge tone="purple">
                  {TIER_LABEL[tierOf(training.distanceKm)]} · {training.distanceKm}km
                </Badge>
              </h2>
              <p>
                放飞 {formatFullDT(training.releaseAt)} · {training.weather || "天气未填"} ·
                共登记 {training.entries.length} 羽
              </p>
            </div>
            <div className="row-actions">
              <button onClick={() => setEditing(true)}>编辑</button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`确定移除「${training.location}」整场训放及全部登记？`)) {
                    store.removeTraining(training.id);
                    onBack();
                  }
                }}
              >
                移除本场
              </button>
            </div>
          </header>
        ) : (
          <div className="form-grid">
            <Field label="训放地点">
              <input value={loc} onChange={(e) => setLoc(e.target.value)} />
            </Field>
            <Field label="放飞距离（公里）">
              <input type="number" min="1" value={dist} onChange={(e) => setDist(e.target.value)} />
            </Field>
            <Field label="放飞时间">
              <input type="datetime-local" value={rel} onChange={(e) => setRel(e.target.value)} />
            </Field>
            <Field label="天气">
              <input value={wx} onChange={(e) => setWx(e.target.value)} />
            </Field>
            <div className="form-actions form-grid-full">
              <button className="primary" onClick={saveHeader}>
                保存
              </button>
              <button onClick={() => setEditing(false)}>取消</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>按足环登记归巢</h2>
            <p>分速 = 距离 ÷（归巢时间 − 放飞时间）；勾选健康异常将转入待核、不参与排行</p>
          </div>
        </header>
        <div className="form-grid">
          <Field label="足环号">
            <input
              list="ring-list"
              value={ringNo}
              onChange={(e) => setRingNo(e.target.value)}
              placeholder="如 CHN-24-001839"
            />
            {ringNo.trim() && !knownRing && (
              <small className="warn-text">
                该足环尚未建档：可先登记，归巢记录会进入“血统未建档”待核名单
              </small>
            )}
          </Field>
          <Field label="归巢时间">
            <input
              type="datetime-local"
              value={returnAt}
              disabled={notReturned}
              onChange={(e) => setReturnAt(e.target.value)}
            />
          </Field>
          <Field label="健康异常" hint={knownRing?.healthNote ? `档案提示：${knownRing.healthNote}` : ""}>
            <label className="check">
              <input
                type="checkbox"
                checked={abnormal}
                onChange={(e) => setAbnormal(e.target.checked)}
              />
              归巢状态异常（积食、外伤等）
            </label>
          </Field>
          <Field label="放飞名单">
            <label className="check">
              <input
                type="checkbox"
                checked={notReturned}
                onChange={(e) => setNotReturned(e.target.checked)}
              />
              已放飞、暂未归巢（超 24 小时自动催查）
            </label>
          </Field>
          {abnormal && (
            <Field label="异常说明" full>
              <input
                value={healthNote}
                onChange={(e) => setHealthNote(e.target.value)}
                placeholder="如：归巢后积食，隔离观察"
              />
            </Field>
          )}
        </div>
        <div className="form-actions">
          <button className="primary" onClick={register}>
            {notReturned ? "登记未归巢" : "登记归巢"}
          </button>
          <button onClick={resetEntryForm}>清空</button>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>本场归巢登记</h2>
            <p>在榜按分速排名；待核与未归巢不参与排行</p>
          </div>
        </header>
        {training.entries.length === 0 ? (
          <Empty>本场还没有登记，先按足环录入第一批</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="col-rank">名次</th>
                  <th>足环号 / 血统</th>
                  <th>归巢时间</th>
                  <th>用时</th>
                  <th>分速</th>
                  <th>状态</th>
                  <th className="col-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {[...training.entries]
                  .sort((a, b) => {
                    const ra = ranks.get(a.id);
                    const rb = ranks.get(b.id);
                    if (ra && rb) return ra - rb;
                    if (ra) return -1;
                    if (rb) return 1;
                    return +new Date(a.createdAt) - +new Date(b.createdAt);
                  })
                  .map((entry) => (
                    <EntryRow
                      key={entry.id}
                      store={store}
                      training={training}
                      entry={entry}
                      rank={ranks.get(entry.id)}
                      now={now}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function EntryRow({
  store,
  training,
  entry,
  rank,
  now,
}: {
  store: Store;
  training: Training;
  entry: Entry;
  rank?: number;
  now: number;
}) {
  const map = useMemo(
    () => pigeonMap(store.state.pigeons),
    [store.state.pigeons]
  );
  const pigeon = map.get(entry.ringNo);
  const reasons = pendingReasons(entry, map);
  const speed = velocityOf(training, entry);
  const minutes = flightMinutes(training, entry);
  const confirm = useConfirm();
  const { show, node } = useFlash();
  const [editing, setEditing] = useState(false);

  const [ringNo, setRingNo] = useState(entry.ringNo);
  const [returnAt, setReturnAt] = useState(entry.returnAt);
  const [abnormal, setAbnormal] = useState(entry.abnormal);
  const [healthNote, setHealthNote] = useState(entry.healthNote);

  const save = () => {
    if (!ringNo.trim()) return show("足环号不能为空", "err");
    const dup = training.entries.some((e) => e.id !== entry.id && e.ringNo === ringNo.trim());
    if (dup) return show("该足环已在本场登记", "err");
    store.updateEntry(training.id, entry.id, {
      ringNo,
      returnAt,
      abnormal,
      healthNote,
    });
    setEditing(false);
    show("登记已更新");
  };

  if (editing) {
    return (
      <tr className="edit-row">
        <td className="col-rank">{rank ? `#${rank}` : "—"}</td>
        <td>
          <input list="ring-list" value={ringNo} onChange={(e) => setRingNo(e.target.value)} />
        </td>
        <td>
          <input
            type="datetime-local"
            value={returnAt}
            onChange={(e) => setReturnAt(e.target.value)}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={!returnAt}
              onChange={(e) => setReturnAt(e.target.checked ? "" : toInputValue(new Date()))}
            />
            未归巢
          </label>
        </td>
        <td colSpan={2}>
          <label className="check">
            <input type="checkbox" checked={abnormal} onChange={(e) => setAbnormal(e.target.checked)} />
            健康异常
          </label>
          <input
            value={healthNote}
            onChange={(e) => setHealthNote(e.target.value)}
            placeholder="异常说明"
          />
        </td>
        <td>
          <div className="row-actions">
            <button className="primary" onClick={save}>
              保存
            </button>
            <button onClick={() => setEditing(false)}>取消</button>
          </div>
        </td>
        <td>{node}</td>
      </tr>
    );
  }

  return (
    <tr className={reasons.length || !entry.returnAt ? "row-muted" : ""}>
      <td className="col-rank">
        {rank ? <span className="rank-num">#{rank}</span> : <span className="muted">—</span>}
      </td>
      <td>
        <button className="link" onClick={() => store.setUi({ tab: "pigeons", ringNo: entry.ringNo })}>
          {entry.ringNo}
        </button>
        <div className="muted small">{pigeon?.bloodline || "血统未建档"}</div>
      </td>
      <td>{entry.returnAt ? formatFullDT(entry.returnAt) : <Badge tone="gray">未归巢</Badge>}</td>
      <td>{minutes === null ? "—" : formatDuration(minutes)}</td>
      <td className={speed === null ? "" : "speed-cell"}>{formatSpeed(speed)}</td>
      <td>
        <StatusPill training={training} entry={entry} reasons={reasons} now={now} />
        {entry.healthNote && <div className="muted small">{entry.healthNote}</div>}
      </td>
      <td className="col-actions">
        <div className="row-actions">
          <button onClick={() => setEditing(true)}>编辑</button>
          <button
            className="danger"
            onClick={() => {
              if (confirm(`移除 ${entry.ringNo} 的本场登记？`))
                store.removeEntry(training.id, entry.id);
            }}
          >
            移除
          </button>
        </div>
        {node}
      </td>
    </tr>
  );
}
