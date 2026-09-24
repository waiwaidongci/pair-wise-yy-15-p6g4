import { useMemo, useState } from "react";
import type { AppState, Pigeon, Sex, UiState } from "../types";
import { bandOfDistance, formatTime, uid } from "../store";
import {
  bloodlines,
  needsReview,
  pigeonHistory,
  reviewReasons,
} from "../selectors";
import { ConfirmBar, Empty, Field, Panel, Tag } from "./common";

type SetState = React.Dispatch<React.SetStateAction<AppState>>;

interface PigeonDraft {
  ring: string;
  bloodline: string;
  sex: Sex;
  health: "正常" | "异常";
  note: string;
}

const emptyDraft: PigeonDraft = {
  ring: "",
  bloodline: "",
  sex: "公",
  health: "正常",
  note: "",
};

/* ---------------- 增录档案 ---------------- */

function PigeonForm({
  state,
  setState,
  editing,
  onDone,
}: {
  state: AppState;
  setState: SetState;
  editing: Pigeon | null;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<PigeonDraft>(() =>
    editing
      ? {
          ring: editing.ring,
          bloodline: editing.bloodline,
          sex: editing.sex,
          health: editing.health,
          note: editing.note ?? "",
        }
      : emptyDraft
  );
  const [error, setError] = useState("");

  const submit = () => {
    const ring = draft.ring.trim();
    if (!ring) return setError("请填写足环号");
    const duplicated = state.pigeons.some(
      (p) => p.ring === ring && p.id !== editing?.id
    );
    if (duplicated) return setError("该足环号已存在");

    setState((s) => {
      if (editing) {
        return {
          ...s,
          pigeons: s.pigeons.map((p) =>
            p.id === editing.id
              ? {
                  ...p,
                  ring,
                  bloodline: draft.bloodline.trim(),
                  sex: draft.sex,
                  health: draft.health,
                  note: draft.note.trim() || undefined,
                }
              : p
          ),
          // 改足环号时同步历次登记
          entries:
            ring !== editing.ring
              ? s.entries.map((e) =>
                  e.ring === editing.ring ? { ...e, ring } : e
                )
              : s.entries,
        };
      }
      return {
        ...s,
        pigeons: [
          {
            id: uid("pg"),
            ring,
            bloodline: draft.bloodline.trim(),
            sex: draft.sex,
            health: draft.health,
            note: draft.note.trim() || undefined,
            mateId: null,
            createdAt: new Date().toISOString(),
          },
          ...s.pigeons,
        ],
      };
    });
    onDone();
  };

  return (
    <div className="pigeon-form">
      <h4>{editing ? "编辑档案" : "增录赛鸽档案"}</h4>
      <div className="field-grid">
        <Field label="足环号">
          <input
            className="ctrl mono"
            value={draft.ring}
            placeholder="如：CHN-24-001839"
            onChange={(e) => setDraft({ ...draft, ring: e.target.value })}
          />
        </Field>
        <Field label="血统" hint="留空进入待核">
          <input
            className="ctrl"
            list="bloodline-options-book"
            value={draft.bloodline}
            placeholder="如：詹森系"
            onChange={(e) =>
              setDraft({ ...draft, bloodline: e.target.value })
            }
          />
        </Field>
        <Field label="性别">
          <select
            className="ctrl"
            value={draft.sex}
            onChange={(e) => setDraft({ ...draft, sex: e.target.value as Sex })}
          >
            <option value="公">公</option>
            <option value="母">母</option>
          </select>
        </Field>
        <Field label="健康状态">
          <select
            className="ctrl"
            value={draft.health}
            onChange={(e) =>
              setDraft({
                ...draft,
                health: e.target.value as "正常" | "异常",
              })
            }
          >
            <option value="正常">正常</option>
            <option value="异常">异常</option>
          </select>
        </Field>
        <label className="field span-2">
          <span>备注</span>
          <input
            className="ctrl"
            value={draft.note}
            placeholder="体征、既往病史等（可选）"
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button className="btn-primary" onClick={submit}>
          {editing ? "保存修改" : "增录档案"}
        </button>
        <button onClick={onDone}>取消</button>
      </div>
    </div>
  );
}

/* ---------------- 配对调整 ---------------- */

function PairEditor({
  state,
  setState,
  pigeon,
  onDone,
}: {
  state: AppState;
  setState: SetState;
  pigeon: Pigeon;
  onDone: () => void;
}) {
  const currentMate = state.pigeons.find((p) => p.id === pigeon.mateId);
  const options = state.pigeons.filter((p) => p.id !== pigeon.id);
  const [mateId, setMateId] = useState<string>(pigeon.mateId ?? "");

  const save = () => {
    const newMateId = mateId || null;
    setState((s) => ({
      ...s,
      pigeons: s.pigeons.map((p) => {
        if (p.id === pigeon.id) return { ...p, mateId: newMateId };
        // 新配偶：改挂到自己
        if (newMateId && p.id === newMateId)
          return { ...p, mateId: pigeon.id };
        // 原配偶解除
        if (p.id === pigeon.mateId) return { ...p, mateId: null };
        // 新配偶原本的对象解除（防止三方关系残留）
        if (newMateId && p.mateId === newMateId)
          return { ...p, mateId: null };
        return p;
      }),
    }));
    onDone();
  };

  return (
    <div className="pair-editor">
      <div className="field-grid">
        <Field label={`当前配对（${pigeon.ring} · ${pigeon.sex}）`}>
          <select
            className="ctrl"
            value={mateId}
            onChange={(e) => setMateId(e.target.value)}
          >
            <option value="">— 暂不配对 —</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ring}（{p.bloodline || "未建档"} · {p.sex}）
              </option>
            ))}
          </select>
        </Field>
      </div>
      {currentMate && (
        <p className="muted">
          当前配偶：<span className="mono">{currentMate.ring}</span>
          ，调整后原配对关系自动解除
        </p>
      )}
      <div className="btn-row">
        <button className="btn-primary" onClick={save}>
          保存配对
        </button>
        <button onClick={onDone}>取消</button>
      </div>
    </div>
  );
}

/* ---------------- 单羽详情（合并历次训放 + 当前配对） ---------------- */

function PigeonDetail({
  state,
  setState,
  pigeon,
  onClose,
}: {
  state: AppState;
  setState: SetState;
  pigeon: Pigeon;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "pair">("view");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const history = useMemo(
    () => pigeonHistory(state, pigeon.ring),
    [state, pigeon.ring]
  );
  const mate = state.pigeons.find((p) => p.id === pigeon.mateId);
  const home = history.filter((h) => h.entry.status === "归巢");
  const speeds = home.map((h) => h.mpm).filter((v): v is number => v != null);
  const avgMpm = speeds.length
    ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)
    : null;

  const removePigeon = () => {
    setState((s) => ({
      ...s,
      pigeons: s.pigeons
        .filter((p) => p.id !== pigeon.id)
        .map((p) =>
          p.mateId === pigeon.id ? { ...p, mateId: null } : p
        ),
    }));
    onClose();
  };

  if (mode === "edit") {
    return (
      <div className="detail-sheet">
        <PigeonForm
          state={state}
          setState={setState}
          editing={pigeon}
          onDone={() => setMode("view")}
        />
      </div>
    );
  }

  return (
    <div className="detail-sheet">
      <div className="detail-head">
        <div>
          <h3 className="mono">{pigeon.ring}</h3>
          <p>
            {pigeon.bloodline.trim() ? (
              <Tag tone="blue">{pigeon.bloodline}</Tag>
            ) : (
              <Tag tone="orange">血统未建档</Tag>
            )}
            <Tag>{pigeon.sex}</Tag>
            {pigeon.health === "异常" ? (
              <Tag tone="red">健康异常</Tag>
            ) : (
              <Tag tone="green">健康正常</Tag>
            )}
            {needsReview(pigeon) &&
              reviewReasons(pigeon)
                .filter((r) => r !== "健康异常" && r !== "血统未建档")
                .map((r) => (
                  <Tag key={r} tone="orange">
                    {r}
                  </Tag>
                ))}
          </p>
        </div>
        <button onClick={onClose}>✕ 关闭</button>
      </div>

      {pigeon.note && <p className="detail-note">备注：{pigeon.note}</p>}

      <div className="detail-meta">
        <div>
          <small>当前配对</small>
          {mate ? (
            <b className="mono">
              {mate.ring}
              <span className="muted">（{mate.bloodline || "未建档"} · {mate.sex}）</span>
            </b>
          ) : (
            <b className="muted">暂未配对</b>
          )}
        </div>
        <div>
          <small>训放次数</small>
          <b>{history.length}</b>
        </div>
        <div>
          <small>归巢次数</small>
          <b>{home.length}</b>
        </div>
        <div>
          <small>平均/最佳分速</small>
          <b>
            {avgMpm ?? "—"}
            {home.some((h) => h.mpm != null)
              ? ` / ${Math.max(...home.map((h) => h.mpm ?? 0))}`
              : ""}{" "}
            <span className="muted">米/分</span>
          </b>
        </div>
      </div>

      {mode === "pair" && (
        <PairEditor
          state={state}
          setState={setState}
          pigeon={pigeon}
          onDone={() => setMode("view")}
        />
      )}

      <div className="btn-row wrap">
        <button onClick={() => setMode("edit")}>编辑档案</button>
        <button
          className={mode === "pair" ? "btn-primary" : ""}
          onClick={() => setMode(mode === "pair" ? "view" : "pair")}
        >
          配对调整
        </button>
        {confirmRemove ? (
          <ConfirmBar
            message="移除该档案？历次训放登记仍保留，可在待核名单恢复"
            onConfirm={removePigeon}
            onCancel={() => setConfirmRemove(false)}
          />
        ) : (
          <button
            className="btn-danger-ghost"
            onClick={() => setConfirmRemove(true)}
          >
            移除档案
          </button>
        )}
      </div>

      <h4 className="detail-section">历次训放</h4>
      {history.length === 0 ? (
        <Empty text="还没有训放登记" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>放飞时间</th>
                <th>地点</th>
                <th>距离档</th>
                <th>天气</th>
                <th>归巢</th>
                <th>用时 / 分速</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr
                  key={h.entry.id}
                  className={h.overdue ? "row-overdue" : undefined}
                >
                  <td>{formatTime(h.training.releaseTime)}</td>
                  <td>{h.training.location}</td>
                  <td>
                    {h.training.distance}km ·{" "}
                    {bandOfDistance(h.training.distance).label.split(" ")[0]}
                  </td>
                  <td>{h.training.weather || "—"}</td>
                  <td>
                    {h.entry.status === "归巢" ? (
                      <>
                        <Tag tone="green">归巢</Tag>
                        {h.entry.arrivalHealth === "异常" && (
                          <Tag tone="red">归巢异常</Tag>
                        )}
                      </>
                    ) : h.overdue ? (
                      <Tag tone="red">催查中</Tag>
                    ) : (
                      <Tag tone="orange">在飞</Tag>
                    )}
                  </td>
                  <td>
                    {h.mpm != null ? (
                      <>
                        {h.durationText} · <b>{h.mpm}</b> 米/分
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- 页面 ---------------- */

export default function PigeonBook({
  state,
  setState,
  ui,
  patchUi,
}: {
  state: AppState;
  setState: SetState;
  ui: UiState;
  patchUi: (patch: Partial<UiState>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lines = useMemo(() => bloodlines(state), [state]);

  const filtered = state.pigeons.filter((p) => {
    if (
      ui.listBloodline === "__none__"
        ? p.bloodline.trim() !== ""
        : ui.listBloodline !== "all" && p.bloodline !== ui.listBloodline
    )
      return false;
    if (ui.listStatus === "review" && !needsReview(p)) return false;
    if (ui.listStatus === "healthy" && needsReview(p)) return false;
    if (ui.listStatus === "paired" && !p.mateId) return false;
    if (ui.listStatus === "single" && p.mateId) return false;
    if (
      ui.listRing.trim() &&
      !(
        p.ring.toLowerCase().includes(ui.listRing.trim().toLowerCase()) ||
        p.bloodline.toLowerCase().includes(ui.listRing.trim().toLowerCase())
      )
    )
      return false;
    return true;
  });

  const selected = selectedId
    ? state.pigeons.find((p) => p.id === selectedId)
    : undefined;

  const mateOf = (p: Pigeon) =>
    state.pigeons.find((m) => m.id === p.mateId);

  return (
    <div className="view-grid">
      <Panel
        title="单羽档案"
        sub="合并历次训放成绩与当前配对关系"
        extra={
          <button
            className="btn-primary"
            onClick={() => {
              setAdding(true);
              setSelectedId(null);
            }}
          >
            ＋ 增录赛鸽
          </button>
        }
      >
        {adding && (
          <PigeonForm
            state={state}
            setState={setState}
            editing={null}
            onDone={() => setAdding(false)}
          />
        )}

        <datalist id="bloodline-options-book">
          {lines.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>

        <div className="filter-bar">
          <label className="filter">
            <span>血统</span>
            <select
              className="ctrl"
              value={ui.listBloodline}
              onChange={(e) => patchUi({ listBloodline: e.target.value })}
            >
              <option value="all">全部血统</option>
              <option value="__none__">未建档</option>
              {lines.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="filter">
            <span>状态</span>
            <select
              className="ctrl"
              value={ui.listStatus}
              onChange={(e) => patchUi({ listStatus: e.target.value })}
            >
              <option value="all">全部</option>
              <option value="review">待核</option>
              <option value="healthy">档案齐全且健康</option>
              <option value="paired">已配对</option>
              <option value="single">未配对</option>
            </select>
          </label>
          <label className="filter grow">
            <span>足环号 / 血统关键字</span>
            <input
              className="ctrl mono"
              value={ui.listRing}
              placeholder="搜索足环号或血统"
              onChange={(e) => patchUi({ listRing: e.target.value })}
            />
          </label>
          {(ui.listBloodline !== "all" ||
            ui.listStatus !== "all" ||
            ui.listRing) && (
            <button
              onClick={() =>
                patchUi({
                  listBloodline: "all",
                  listStatus: "all",
                  listRing: "",
                })
              }
            >
              清除筛选
            </button>
          )}
        </div>

        {state.pigeons.length === 0 ? (
          <Empty text="鸽棚还没有档案，点击右上角增录" />
        ) : filtered.length === 0 ? (
          <Empty text="当前筛选下没有匹配的鸽子" />
        ) : (
          <div className="pigeon-grid">
            {filtered.map((p) => {
              const mate = mateOf(p);
              const trainCount = state.entries.filter(
                (e) => e.ring === p.ring
              ).length;
              return (
                <article
                  key={p.id}
                  className={`pigeon-card${
                    selectedId === p.id ? " selected" : ""
                  }${needsReview(p) ? " is-review" : ""}`}
                  onClick={() => {
                    setSelectedId(p.id);
                    setAdding(false);
                  }}
                >
                  <div className="pigeon-card-top">
                    <b className="mono">{p.ring}</b>
                    {needsReview(p) && <Tag tone="orange">待核</Tag>}
                  </div>
                  <p className="muted">
                    {p.bloodline.trim() || "血统未建档"} · {p.sex} ·{" "}
                    {p.health === "异常" ? (
                      <span className="text-red">健康异常</span>
                    ) : (
                      "健康正常"
                    )}
                  </p>
                  <p className="muted small">
                    训放 {trainCount} 次 · 配对：
                    {mate ? (
                      <span className="mono">{mate.ring}</span>
                    ) : (
                      "无"
                    )}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {selected && (
        <Panel
          title={`档案 · ${selected.ring}`}
          sub="历次训放与当前配对"
          extra={
            <button onClick={() => setSelectedId(null)}>✕ 关闭详情</button>
          }
        >
          <PigeonDetail
            state={state}
            setState={setState}
            pigeon={selected}
            onClose={() => setSelectedId(null)}
          />
        </Panel>
      )}
    </div>
  );
}
