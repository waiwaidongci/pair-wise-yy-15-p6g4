import { useMemo, useState } from "react";
import type {
  AppState,
  Entry,
  Health,
  Pigeon,
  Training,
} from "../types";
import {
  bandOfDistance,
  calcSpeed,
  formatDuration,
  formatTime,
  isOverdue,
  toLocalInput,
  uid,
} from "../store";
import { entriesOfTraining, needsReview, pigeonByRing } from "../selectors";
import { ConfirmBar, Empty, Field, Panel, Tag } from "./common";

type SetState = React.Dispatch<React.SetStateAction<AppState>>;

/* ---------------- 新建训放表单 ---------------- */

function NewTrainingForm({
  state,
  setState,
}: {
  state: AppState;
  setState: SetState;
}) {
  const [form, setForm] = useState({
    location: "",
    distance: "",
    releaseTime: toLocalInput(new Date()),
    weather: "",
  });
  const [error, setError] = useState("");

  const submit = () => {
    const distance = Number(form.distance);
    if (!form.location.trim()) return setError("请填写训放地点");
    if (!Number.isFinite(distance) || distance <= 0)
      return setError("距离需为大于 0 的公里数");
    if (!form.releaseTime) return setError("请选择放飞时间");
    const t: Training = {
      id: uid("tr"),
      location: form.location.trim(),
      distance,
      releaseTime: form.releaseTime,
      weather: form.weather.trim(),
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, trainings: [t, ...s.trainings] }));
    setForm({
      location: "",
      distance: "",
      releaseTime: toLocalInput(new Date()),
      weather: "",
    });
    setError("");
  };

  return (
    <Panel title="新建训放" sub="地点 / 距离 / 放飞时间 / 天气">
      <div className="field-grid">
        <Field label="训放地点">
          <input
            className="ctrl"
            value={form.location}
            placeholder="如：静海放飞点"
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </Field>
        <Field label="放飞距离" hint="公里">
          <input
            className="ctrl"
            type="number"
            min="0"
            step="0.1"
            value={form.distance}
            placeholder="如：100"
            onChange={(e) => setForm({ ...form, distance: e.target.value })}
          />
        </Field>
        <Field label="放飞时间">
          <input
            className="ctrl"
            type="datetime-local"
            value={form.releaseTime}
            onChange={(e) =>
              setForm({ ...form, releaseTime: e.target.value })
            }
          />
        </Field>
        <Field label="天气">
          <input
            className="ctrl"
            value={form.weather}
            placeholder="如：晴，西北风2级"
            onChange={(e) => setForm({ ...form, weather: e.target.value })}
          />
        </Field>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="btn-primary" onClick={submit}>
          保存训放
        </button>
        {state.trainings.length > 0 && (
          <span className="muted">已建 {state.trainings.length} 次训放，下方继续登记归巢</span>
        )}
      </div>
    </Panel>
  );
}

/* ---------------- 归巢登记表单 ---------------- */

interface ArrivalDraft {
  ring: string;
  arrivalTime: string;
  health: Health;
  note: string;
}

function ArrivalForm({
  state,
  setState,
  training,
  editing,
  onDone,
}: {
  state: AppState;
  setState: SetState;
  training: Training;
  editing: Entry | null;
  onDone: () => void;
}) {
  const existingRings = useMemo(
    () => new Set(entriesOfTraining(state, training.id).map((e) => e.ring)),
    [state, training.id]
  );

  const [draft, setDraft] = useState<ArrivalDraft>(() => ({
    ring: editing?.ring ?? "",
    arrivalTime: editing?.arrivalTime ?? toLocalInput(new Date()),
    health: editing?.arrivalHealth ?? "正常",
    note: editing?.note ?? "",
  }));

  const speed = draft.ring
    ? calcSpeed(training.distance, training.releaseTime, draft.arrivalTime)
    : null;

  const known = draft.ring
    ? pigeonByRing(state, draft.ring.trim())
    : undefined;

  const submit = () => {
    const ring = draft.ring.trim();
    if (!ring) return;
    if (!draft.arrivalTime) return;
    if (!calcSpeed(training.distance, training.releaseTime, draft.arrivalTime))
      return;

    setState((s) => {
      let pigeons = s.pigeons;
      // 足环查不到档案时自动建档（血统留空，进入待核）
      if (!pigeons.some((p) => p.ring === ring)) {
        const stub: Pigeon = {
          id: uid("pg"),
          ring,
          bloodline: "",
          sex: "公",
          health: draft.health,
          createdAt: new Date().toISOString(),
        };
        pigeons = [stub, ...pigeons];
      } else {
        pigeons = pigeons.map((p) =>
          p.ring === ring ? { ...p, health: draft.health } : p
        );
      }

      let entries = s.entries;
      if (editing) {
        entries = entries.map((e) =>
          e.id === editing.id
            ? {
                ...e,
                ring,
                status: "归巢" as const,
                arrivalTime: draft.arrivalTime,
                arrivalHealth: draft.health,
                note: draft.note.trim() || undefined,
              }
            : e
        );
      } else {
        const oldIndex = entries.findIndex(
          (e) => e.trainingId === training.id && e.ring === ring
        );
        const payload: Entry = {
          id: oldIndex >= 0 ? entries[oldIndex].id : uid("en"),
          trainingId: training.id,
          ring,
          status: "归巢",
          arrivalTime: draft.arrivalTime,
          arrivalHealth: draft.health,
          note: draft.note.trim() || undefined,
        };
        entries =
          oldIndex >= 0
            ? entries.map((e, i) => (i === oldIndex ? payload : e))
            : [...entries, payload];
      }
      return { ...s, pigeons, entries };
    });
    onDone();
  };

  const ringTaken =
    !editing && draft.ring.trim() && existingRings.has(draft.ring.trim());

  return (
    <div className="arrival-form">
      <h4>{editing ? "编辑归巢登记" : "登记归巢"}</h4>
      <div className="field-grid three">
        <Field label="足环号">
          <input
            className="ctrl mono"
            list="ring-options"
            value={draft.ring}
            disabled={!!editing}
            placeholder="扫描或输入足环号"
            onChange={(e) => setDraft({ ...draft, ring: e.target.value })}
          />
          <datalist id="ring-options">
            {state.pigeons.map((p) => (
              <option key={p.id} value={p.ring}>
                {p.bloodline || "未建档"}
              </option>
            ))}
          </datalist>
          {draft.ring.trim() && !known && !editing && (
            <small className="hint-warn">
              档案中没有这羽鸽子，保存时将自动建档（血统待补）
            </small>
          )}
          {known && (
            <small className={needsReview(known) ? "hint-warn" : "hint-ok"}>
              {known.bloodline || "血统未建档"} · {known.sex}
              {known.health === "异常" ? " · 健康异常" : ""}
            </small>
          )}
        </Field>
        <Field label="归巢时间">
          <input
            className="ctrl"
            type="datetime-local"
            value={draft.arrivalTime}
            onChange={(e) =>
              setDraft({ ...draft, arrivalTime: e.target.value })
            }
          />
        </Field>
        <Field label="归巢健康">
          <select
            className="ctrl"
            value={draft.health}
            onChange={(e) =>
              setDraft({ ...draft, health: e.target.value as Health })
            }
          >
            <option value="正常">正常</option>
            <option value="异常">异常</option>
          </select>
        </Field>
      </div>
      <div className="arrival-foot">
        <div className="speed-preview">
          {speed ? (
            <>
              用时 <b>{speed.durationText}</b> · 分速{" "}
              <b className="text-primary">{speed.mpm}</b> 米/分
            </>
          ) : (
            <span className="muted">
              归巢时间需晚于放飞时间，分速自动计算
            </span>
          )}
          {ringTaken && (
            <Tag tone="orange">该足环已在本次名单中，保存将更新为归巢</Tag>
          )}
        </div>
        <div className="btn-row">
          <button
            className="btn-primary"
            disabled={!speed}
            onClick={submit}
          >
            {editing ? "保存修改" : "确认归巢"}
          </button>
          <button onClick={onDone}>取消</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 单次训放卡片 ---------------- */

function TrainingCard({
  state,
  setState,
  training,
  defaultOpen,
}: {
  state: AppState;
  setState: SetState;
  training: Training;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<"none" | "flying" | "arrival" | "edit">(
    "none"
  );
  const [editing, setEditing] = useState<Entry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeEntryId, setRemoveEntryId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState({
    location: training.location,
    distance: String(training.distance),
    releaseTime: training.releaseTime,
    weather: training.weather,
  });

  const entries = useMemo(
    () =>
      entriesOfTraining(state, training.id).slice().sort((a, b) => {
        // 归巢按分速（用时）排，在飞的放后面
        const sa = a.arrivalTime
          ? calcSpeed(training.distance, training.releaseTime, a.arrivalTime)
          : null;
        const sb = b.arrivalTime
          ? calcSpeed(training.distance, training.releaseTime, b.arrivalTime)
          : null;
        if (sa && sb) return sb.mpm - sa.mpm;
        if (sa) return -1;
        if (sb) return 1;
        return a.ring.localeCompare(b.ring);
      }),
    [state, training]
  );

  const registered = new Set(entries.map((e) => e.ring));
  const candidates = state.pigeons.filter((p) => !registered.has(p.ring));

  const addFlying = () => {
    const chosen = candidates.filter((c) => picked.has(c.id));
    if (chosen.length === 0) return;
    setState((s) => ({
      ...s,
      entries: [
        ...s.entries,
        ...chosen.map((p) => ({
          id: uid("en"),
          trainingId: training.id,
          ring: p.ring,
          status: "在飞" as const,
          arrivalTime: null,
        })),
      ],
    }));
    setPicked(new Set());
    setMode("none");
  };

  const setStatus = (entry: Entry, status: "在飞" | "归巢") => {
    setState((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === entry.id
          ? {
              ...e,
              status,
              arrivalTime:
                status === "归巢" && !e.arrivalTime
                  ? toLocalInput(new Date())
                  : status === "在飞"
                  ? null
                  : e.arrivalTime,
              arrivalHealth:
                status === "在飞" ? undefined : e.arrivalHealth ?? "正常",
            }
          : e
      ),
    }));
    if (status === "归巢") {
      setEditing(entry);
      setMode("arrival");
    }
  };

  const deleteTraining = () => {
    setState((s) => ({
      ...s,
      trainings: s.trainings.filter((t) => t.id !== training.id),
      entries: s.entries.filter((e) => e.trainingId !== training.id),
    }));
  };

  const removeEntry = (id: string) => {
    setState((s) => ({
      ...s,
      entries: s.entries.filter((e) => e.id !== id),
    }));
    setRemoveEntryId(null);
  };

  const saveEdit = () => {
    const distance = Number(editForm.distance);
    if (!editForm.location.trim() || !(distance > 0)) return;
    setState((s) => ({
      ...s,
      trainings: s.trainings.map((t) =>
        t.id === training.id
          ? {
              ...t,
              location: editForm.location.trim(),
              distance,
              releaseTime: editForm.releaseTime,
              weather: editForm.weather.trim(),
            }
          : t
      ),
    }));
    setMode("none");
  };

  const homeCount = entries.filter((e) => e.status === "归巢").length;
  const overdueCount = entries.filter((e) => isOverdue(training, e)).length;

  return (
    <article className={`training-block${open ? " open" : ""}`}>
      <div className="training-block-head" onClick={() => setOpen(!open)}>
        <div className="caret">{open ? "▾" : "▸"}</div>
        <div className="grow">
          <h3>
            {training.location}
            <Tag tone="blue">{bandOfDistance(training.distance).label.split(" ")[0]}</Tag>
            {overdueCount > 0 && <Tag tone="red">{overdueCount} 羽催查</Tag>}
          </h3>
          <p>
            {training.distance}km · 放飞 {formatTime(training.releaseTime)} ·{" "}
            {training.weather || "天气未填"} · 归巢 {homeCount}/{entries.length}
          </p>
        </div>
      </div>

      {open && (
        <div className="training-block-body">
          <div className="btn-row wrap">
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setMode(mode === "arrival" ? "none" : "arrival");
              }}
            >
              ＋ 按足环登记归巢
            </button>
            <button
              onClick={() => {
                setMode(mode === "flying" ? "none" : "flying");
                setEditing(null);
              }}
            >
              勾选在飞名单
            </button>
            <button
              onClick={() => {
                setEditForm({
                  location: training.location,
                  distance: String(training.distance),
                  releaseTime: training.releaseTime,
                  weather: training.weather,
                });
                setMode(mode === "edit" ? "none" : "edit");
              }}
            >
              编辑训放信息
            </button>
            {confirmDelete ? (
              <ConfirmBar
                message="移除该训放及其全部登记？"
                onConfirm={deleteTraining}
                onCancel={() => setConfirmDelete(false)}
              />
            ) : (
              <button
                className="btn-danger-ghost"
                onClick={() => setConfirmDelete(true)}
              >
                移除训放
              </button>
            )}
          </div>

          {mode === "edit" && (
            <div className="inline-edit">
              <div className="field-grid">
                <Field label="地点">
                  <input
                    className="ctrl"
                    value={editForm.location}
                    onChange={(e) =>
                      setEditForm({ ...editForm, location: e.target.value })
                    }
                  />
                </Field>
                <Field label="距离（公里）">
                  <input
                    className="ctrl"
                    type="number"
                    step="0.1"
                    value={editForm.distance}
                    onChange={(e) =>
                      setEditForm({ ...editForm, distance: e.target.value })
                    }
                  />
                </Field>
                <Field label="放飞时间">
                  <input
                    className="ctrl"
                    type="datetime-local"
                    value={editForm.releaseTime}
                    onChange={(e) =>
                      setEditForm({ ...editForm, releaseTime: e.target.value })
                    }
                  />
                </Field>
                <Field label="天气">
                  <input
                    className="ctrl"
                    value={editForm.weather}
                    onChange={(e) =>
                      setEditForm({ ...editForm, weather: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="btn-row">
                <button className="btn-primary" onClick={saveEdit}>
                  保存
                </button>
                <button onClick={() => setMode("none")}>取消</button>
              </div>
            </div>
          )}

          {mode === "flying" && (
            <div className="flying-pick">
              {candidates.length === 0 ? (
                <Empty text="在档鸽子都已加入本次训放" />
              ) : (
                <>
                  <div className="pick-list">
                    {candidates.map((p) => (
                      <label key={p.id} className="pick-item">
                        <input
                          type="checkbox"
                          checked={picked.has(p.id)}
                          onChange={() =>
                            setPicked((prev) => {
                              const next = new Set(prev);
                              next.has(p.id)
                                ? next.delete(p.id)
                                : next.add(p.id);
                              return next;
                            })
                          }
                        />
                        <span className="mono">{p.ring}</span>
                        <span className="muted">
                          {p.bloodline || "未建档"} · {p.sex}
                        </span>
                        {needsReview(p) && <Tag tone="orange">待核</Tag>}
                      </label>
                    ))}
                  </div>
                  <div className="btn-row">
                    <button
                      className="btn-primary"
                      disabled={picked.size === 0}
                      onClick={addFlying}
                    >
                      加入 {picked.size > 0 ? picked.size : ""} 羽到在飞名单
                    </button>
                    <button onClick={() => setMode("none")}>取消</button>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "arrival" && (
            <ArrivalForm
              state={state}
              setState={setState}
              training={training}
              editing={editing}
              onDone={() => {
                setMode("none");
                setEditing(null);
              }}
            />
          )}

          <div className="table-wrap">
            <table className="data-table entries-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>足环号</th>
                  <th>血统</th>
                  <th>状态</th>
                  <th>归巢时间</th>
                  <th>用时 / 分速</th>
                  <th>健康</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <Empty text="先勾选在飞名单，或直接按足环登记归巢" />
                    </td>
                  </tr>
                )}
                {entries.map((e, i) => {
                  const p = pigeonByRing(state, e.ring);
                  const speed = e.arrivalTime
                    ? calcSpeed(
                        training.distance,
                        training.releaseTime,
                        e.arrivalTime
                      )
                    : null;
                  const overdue = isOverdue(training, e);
                  return (
                    <tr
                      key={e.id}
                      className={
                        p && needsReview(p) ? "row-review" : undefined
                      }
                    >
                      <td className="muted">{i + 1}</td>
                      <td className="mono">{e.ring}</td>
                      <td>
                        {p?.bloodline?.trim() ? (
                          p.bloodline
                        ) : (
                          <Tag tone="orange">未建档</Tag>
                        )}
                      </td>
                      <td>
                        {e.status === "归巢" ? (
                          <Tag tone="green">归巢</Tag>
                        ) : overdue ? (
                          <Tag tone="red">催查 {formatDuration(overdue ? (Date.now() - new Date(training.releaseTime).getTime()) / 60000 : 0)}</Tag>
                        ) : (
                          <Tag tone="orange">在飞</Tag>
                        )}
                      </td>
                      <td>{e.arrivalTime ? formatTime(e.arrivalTime) : "—"}</td>
                      <td>
                        {speed ? (
                          <>
                            {speed.durationText} ·{" "}
                            <b className="text-primary">{speed.mpm}</b> 米/分
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {e.arrivalHealth === "异常" ? (
                          <Tag tone="red">异常</Tag>
                        ) : e.arrivalHealth === "正常" ? (
                          <Tag>正常</Tag>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="ops">
                        {e.status === "在飞" ? (
                          <button
                            className="btn-mini btn-primary"
                            onClick={() => setStatus(e, "归巢")}
                          >
                            归巢
                          </button>
                        ) : (
                          <button
                            className="btn-mini"
                            onClick={() => {
                              setEditing(e);
                              setMode("arrival");
                            }}
                          >
                            编辑
                          </button>
                        )}
                        {e.status === "归巢" && (
                          <button
                            className="btn-mini"
                            onClick={() => setStatus(e, "在飞")}
                          >
                            撤回在飞
                          </button>
                        )}
                        {removeEntryId === e.id ? (
                          <ConfirmBar
                            message="移除该登记？"
                            onConfirm={() => removeEntry(e.id)}
                            onCancel={() => setRemoveEntryId(null)}
                          />
                        ) : (
                          <button
                            className="btn-mini btn-danger-ghost"
                            onClick={() => setRemoveEntryId(e.id)}
                          >
                            移除
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}

/* ---------------- 页面容器 ---------------- */

export default function TrainingView({
  state,
  setState,
}: {
  state: AppState;
  setState: SetState;
}) {
  const sorted = [...state.trainings].sort((a, b) =>
    b.releaseTime.localeCompare(a.releaseTime)
  );
  return (
    <div className="view-grid">
      <NewTrainingForm state={state} setState={setState} />
      <Panel
        title="训放批次"
        sub="展开后可登记在飞 / 归巢、编辑与移除"
      >
        {sorted.length === 0 ? (
          <Empty text="还没有训放记录" />
        ) : (
          <div className="training-list">
            {sorted.map((t, i) => (
              <TrainingCard
                key={t.id}
                state={state}
                setState={setState}
                training={t}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
