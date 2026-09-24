import { useMemo, useState } from "react";
import {
  Entry,
  Pigeon,
  PigeonInput,
  Sex,
  TIER_LABEL,
  Training,
  formatDT,
  formatFullDT,
  formatSpeed,
  isEligible,
  overdueItems,
  pendingReasons,
  pigeonMap,
  tierOf,
  uniqueBloodlines,
  velocityOf,
} from "../ledger";
import { Store } from "../ledger";
import { Badge, Empty, Field, StatusPill, useConfirm, useFlash } from "./ui";

export function Pigeons({ store, now }: { store: Store; now: number }) {
  const { ui } = store.state;
  const pigeon = store.state.pigeons.find((p) => p.ringNo === ui.ringNo);
  if (ui.ringNo) {
    if (pigeon)
      return <PigeonDetail key={pigeon.ringNo} store={store} pigeon={pigeon} now={now} />;
    return (
      <div className="stack">
        <button className="back" onClick={() => store.setUi({ ringNo: "" })}>
          ← 返回鸽群
        </button>
        <section className="panel">
          <Empty>该档案不存在或已被移除</Empty>
        </section>
      </div>
    );
  }
  return <PigeonList store={store} />;
}

/* ---------------- 鸽群列表与增录 ---------------- */

function PigeonList({ store }: { store: Store }) {
  const { pigeons, trainings } = store.state;
  const map = useMemo(() => pigeonMap(pigeons), [pigeons]);
  const bloodlines = useMemo(() => uniqueBloodlines(pigeons), [pigeons]);
  const confirm = useConfirm();
  const { show, node } = useFlash();

  const [query, setQuery] = useState("");
  const [bloodFilter, setBloodFilter] = useState("all");

  // 未建档足环（出现在训放登记里但鸽群没有档案）
  const unarchived = useMemo(() => {
    const set = new Map<string, { trainings: Training[] }>();
    for (const t of trainings)
      for (const e of t.entries)
        if (!map.has(e.ringNo)) {
          if (!set.has(e.ringNo)) set.set(e.ringNo, { trainings: [] });
          set.get(e.ringNo)!.trainings.push(t);
        }
    return [...set.entries()];
  }, [trainings, map]);

  const [form, setForm] = useState<PigeonInput>({
    ringNo: "",
    bloodline: "",
    sex: "",
    healthNote: "",
    note: "",
  });

  const submit = () => {
    const res = store.addPigeon(form);
    if (res.ok) {
      show(`已建档 ${form.ringNo}`);
      setForm({ ringNo: "", bloodline: "", sex: "", healthNote: "", note: "" });
    } else show(res.error, "err");
  };

  const filtered = pigeons
    .filter((p) => (bloodFilter === "all" ? true : p.bloodline === bloodFilter))
    .filter((p) =>
      query.trim()
        ? p.ringNo.toLowerCase().includes(query.trim().toLowerCase()) ||
          p.bloodline.includes(query.trim())
        : true
    )
    .sort((a, b) => a.ringNo.localeCompare(b.ringNo));

  const historyOf = (ringNo: string) => {
    const list: { training: Training; entry: Entry }[] = [];
    for (const t of trainings) for (const e of t.entries) if (e.ringNo === ringNo) list.push({ training: t, entry: e });
    return list;
  };

  return (
    <div className="stack">
      {node}
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>增录赛鸽</h2>
            <p>建档必须登记血统，未建档或健康异常的归巢记录会进入待核名单</p>
          </div>
        </header>
        <div className="form-grid">
          <Field label="足环号">
            <input value={form.ringNo} onChange={(e) => setForm({ ...form, ringNo: e.target.value })} placeholder="如 CHN-25-000001" />
          </Field>
          <Field label="血统">
            <input
              list="blood-list"
              value={form.bloodline}
              onChange={(e) => setForm({ ...form, bloodline: e.target.value })}
              placeholder="如 詹森系"
            />
          </Field>
          <Field label="性别">
            <select
              className="select"
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value as Sex })}
            >
              <option value="">未登记</option>
              <option value="雄">雄</option>
              <option value="雌">雌</option>
            </select>
          </Field>
          <Field label="健康异常备注" hint="留空表示健康">
            <input
              value={form.healthNote}
              onChange={(e) => setForm({ ...form, healthNote: e.target.value })}
              placeholder="如 换羽期，暂停训放"
            />
          </Field>
          <Field label="备注" full>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
        <div className="form-actions">
          <button className="primary" onClick={submit}>
            建档入棚
          </button>
        </div>
      </section>

      {unarchived.length > 0 && (
        <section className="panel">
          <header className="panel-head">
            <div>
              <h2>未建档足环</h2>
              <p>已出现在训放登记中，补血统后可退出待核名单</p>
            </div>
            <Badge tone="orange">{unarchived.length} 个足环</Badge>
          </header>
          <div className="quick-archive">
            {unarchived.map(([ringNo, info]) => (
              <QuickArchive key={ringNo} store={store} ringNo={ringNo} count={info.trainings.length} onDone={() => show(`${ringNo} 已建档`)} />
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>鸽群档案（{pigeons.length} 羽）</h2>
            <p>点击足环查看单羽档案：历次训放成绩与当前配对关系</p>
          </div>
          <div className="filters">
            <select className="select" value={bloodFilter} onChange={(e) => setBloodFilter(e.target.value)}>
              <option value="all">全部血统</option>
              {bloodlines.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <input className="search" placeholder="搜索足环号 / 血统" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </header>
        {filtered.length === 0 ? (
          <Empty>没有符合条件的档案</Empty>
        ) : (
          <div className="pigeon-grid">
            {filtered.map((p) => {
              const history = historyOf(p.ringNo);
              const speeds = history
                .filter((x) => isEligible(x.training, x.entry, map))
                .map((x) => velocityOf(x.training, x.entry))
                .filter((v): v is number => v !== null);
              const avg = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
              const overdue = history.some(
                (x) => !x.entry.returnAt && (Date.now() - +new Date(x.training.releaseAt)) / 3600e3 > 24
              );
              return (
                <article key={p.ringNo} className={`pigeon-card ${overdue ? "pc-overdue" : ""}`}>
                  <div className="pc-head">
                    <button className="link strong" onClick={() => store.setUi({ ringNo: p.ringNo })}>
                      {p.ringNo}
                    </button>
                    {p.sex && <Badge tone={p.sex === "雄" ? "blue" : "purple"}>{p.sex}</Badge>}
                    {overdue && <Badge tone="red">催查中</Badge>}
                  </div>
                  <p className="muted">{p.bloodline || "血统未建档"}</p>
                  <p className="muted small">
                    训放 {history.length} 站 · 均分 {formatSpeed(avg)}
                  </p>
                  {p.healthNote && <p className="warn-text small">⚠ {p.healthNote}</p>}
                  {p.mateRingNo && (
                    <p className="muted small">
                      配对：
                      <button className="link" onClick={() => store.setUi({ ringNo: p.mateRingNo })}>
                        {p.mateRingNo}
                      </button>
                    </p>
                  )}
                  <div className="row-actions">
                    <button onClick={() => store.setUi({ ringNo: p.ringNo })}>档案</button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (confirm(`移除 ${p.ringNo}？其全部训放登记与配对关系将一并解除。`)) {
                          store.removePigeon(p.ringNo);
                          show("档案已移除");
                        }
                      }}
                    >
                      移除
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function QuickArchive({
  store,
  ringNo,
  count,
  onDone,
}: {
  store: Store;
  ringNo: string;
  count: number;
  onDone: () => void;
}) {
  const [bloodline, setBloodline] = useState("");
  const { show, node } = useFlash();
  return (
    <div className="qa-row">
      <b>{ringNo}</b>
      <span className="muted">已参训 {count} 场</span>
      <input
        list="blood-list"
        value={bloodline}
        onChange={(e) => setBloodline(e.target.value)}
        placeholder="补登血统以建档"
      />
      <button
        className="primary"
        onClick={() => {
          const res = store.quickArchive(ringNo, bloodline);
          if (res.ok) onDone();
          else show(res.error, "err");
        }}
      >
        建档
      </button>
      {node}
    </div>
  );
}

/* ---------------- 单羽档案 ---------------- */

function PigeonDetail({ store, pigeon, now }: { store: Store; pigeon: Pigeon; now: number }) {
  const { pigeons, trainings } = store.state;
  const map = useMemo(() => pigeonMap(pigeons), [pigeons]);
  const mate = pigeon.mateRingNo ? map.get(pigeon.mateRingNo) : undefined;
  const confirm = useConfirm();
  const { show, node } = useFlash();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PigeonInput>({
    ringNo: pigeon.ringNo,
    bloodline: pigeon.bloodline,
    sex: pigeon.sex,
    healthNote: pigeon.healthNote,
    note: pigeon.note,
  });

  const history = useMemo(() => {
    const list: { training: Training; entry: Entry }[] = [];
    for (const t of trainings)
      for (const e of t.entries) if (e.ringNo === pigeon.ringNo) list.push({ training: t, entry: e });
    return list.sort((a, b) => +new Date(b.training.releaseAt) - +new Date(a.training.releaseAt));
  }, [trainings, pigeon.ringNo]);

  const eligibleHistory = history.filter((x) => isEligible(x.training, x.entry, map));
  const speeds = eligibleHistory
    .map((x) => velocityOf(x.training, x.entry))
    .filter((v): v is number => v !== null);
  const avg = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
  const best = speeds.length ? Math.max(...speeds) : null;
  const overdueSet = useMemo(() => new Set(overdueItems(trainings, now).map((o) => o.entry.id)), [trainings, now]);

  const others = pigeons.filter((p) => p.ringNo !== pigeon.ringNo);
  const [pairTarget, setPairTarget] = useState("");

  const saveProfile = () => {
    if (!form.bloodline.trim()) return show("血统不能为空，否则该羽将处于未建档状态", "err");
    store.updatePigeon(pigeon.ringNo, {
      bloodline: form.bloodline,
      sex: form.sex,
      healthNote: form.healthNote,
      note: form.note,
    });
    setEditing(false);
    show("档案已更新");
  };

  const doPair = () => {
    if (!pairTarget) return;
    store.pairPigeons(pigeon.ringNo, pairTarget);
    show(`已与 ${pairTarget} 配对，原配对已自动解除`);
    setPairTarget("");
  };

  return (
    <div className="stack">
      {node}
      <button className="back" onClick={() => store.setUi({ ringNo: "" })}>
        ← 返回鸽群
      </button>

      <section className="panel">
        {!editing ? (
          <header className="panel-head detail-head">
            <div>
              <h2>
                {pigeon.ringNo}
                {pigeon.sex && <Badge tone={pigeon.sex === "雄" ? "blue" : "purple"}>{pigeon.sex}</Badge>}
                {pigeon.healthNote && <Badge tone="orange">健康异常</Badge>}
                {!pigeon.bloodline.trim() && <Badge tone="orange">血统未建档</Badge>}
              </h2>
              <p>
                {pigeon.bloodline || "血统未建档"} · 建档于 {formatDT(pigeon.createdAt)}
                {pigeon.note ? ` · ${pigeon.note}` : ""}
              </p>
              {pigeon.healthNote && <p className="warn-text">当前健康：{pigeon.healthNote}</p>}
            </div>
            <div className="row-actions">
              <button onClick={() => setEditing(true)}>编辑档案</button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`移除 ${pigeon.ringNo}？其训放登记与配对关系将一并解除。`)) {
                    store.removePigeon(pigeon.ringNo);
                    store.setUi({ ringNo: "" });
                  }
                }}
              >
                移除
              </button>
            </div>
          </header>
        ) : (
          <div className="form-grid">
            <Field label="足环号">
              <input value={pigeon.ringNo} disabled />
            </Field>
            <Field label="血统">
              <input list="blood-list" value={form.bloodline} onChange={(e) => setForm({ ...form, bloodline: e.target.value })} />
            </Field>
            <Field label="性别">
              <select className="select" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as Sex })}>
                <option value="">未登记</option>
                <option value="雄">雄</option>
                <option value="雌">雌</option>
              </select>
            </Field>
            <Field label="健康异常备注">
              <input value={form.healthNote} onChange={(e) => setForm({ ...form, healthNote: e.target.value })} />
            </Field>
            <Field label="备注" full>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <div className="form-actions form-grid-full">
              <button className="primary" onClick={saveProfile}>
                保存档案
              </button>
              <button onClick={() => setEditing(false)}>取消</button>
            </div>
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <header className="panel-head">
            <div>
              <h2>配对关系</h2>
              <p>一对一配对：与新足环结合时，双方原配对自动解除</p>
            </div>
          </header>
          <div className="pair-box">
            <p>
              当前配对：
              {mate ? (
                <button className="link" onClick={() => store.setUi({ ringNo: mate.ringNo })}>
                  {mate.ringNo}（{mate.bloodline || "未建档"}
                  {mate.sex ? ` · ${mate.sex}` : ""}）
                </button>
              ) : (
                <span className="muted">暂无配对</span>
              )}
            </p>
            <div className="pair-controls">
              <select className="select" value={pairTarget} onChange={(e) => setPairTarget(e.target.value)}>
                <option value="">选择配对足环…</option>
                {others.map((o) => (
                  <option key={o.ringNo} value={o.ringNo}>
                    {o.ringNo} · {o.bloodline || "未建档"}
                    {o.mateRingNo ? `（原配 ${o.mateRingNo}）` : ""}
                  </option>
                ))}
              </select>
              <button className="primary" onClick={doPair} disabled={!pairTarget}>
                确认配对调整
              </button>
              {pigeon.mateRingNo && (
                <button
                  onClick={() => {
                    store.unpair(pigeon.ringNo);
                    show("已解除配对");
                  }}
                >
                  解除配对
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <h2>训放汇总</h2>
              <p>合并该羽全部训放记录</p>
            </div>
          </header>
          <div className="stat-row">
            <div>
              <small>参训</small>
              <b>{history.length}</b> 站
            </div>
            <div>
              <small>在榜</small>
              <b>{eligibleHistory.length}</b> 次
            </div>
            <div>
              <small>平均分速</small>
              <b>{formatSpeed(avg)}</b>
            </div>
            <div>
              <small>最佳分速</small>
              <b>{formatSpeed(best)}</b>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>历次训放</h2>
            <p>按放飞时间倒序；待核场次不计入成绩统计</p>
          </div>
        </header>
        {history.length === 0 ? (
          <Empty>该羽还没有训放登记</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>放飞时间</th>
                  <th>地点 / 天气</th>
                  <th>距离档</th>
                  <th>归巢时间</th>
                  <th>分速</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {history.map(({ training, entry }) => {
                  const reasons = pendingReasons(entry, map);
                  return (
                    <tr key={entry.id} className={overdueSet.has(entry.id) ? "row-overdue" : ""}>
                      <td>{formatFullDT(training.releaseAt)}</td>
                      <td>
                        <button className="link" onClick={() => store.setUi({ tab: "trainings", trainingId: training.id })}>
                          {training.location}
                        </button>
                        <div className="muted small">{training.weather || "—"}</div>
                      </td>
                      <td>
                        <Badge tone="blue">
                          {TIER_LABEL[tierOf(training.distanceKm)]} · {training.distanceKm}km
                        </Badge>
                      </td>
                      <td>{entry.returnAt ? formatDT(entry.returnAt) : "—"}</td>
                      <td className="speed-cell">{formatSpeed(velocityOf(training, entry))}</td>
                      <td>
                        <StatusPill training={training} entry={entry} reasons={reasons} now={now} />
                      </td>
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
