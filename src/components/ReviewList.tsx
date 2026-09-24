import { useMemo, useState } from "react";
import type { AppState, Pigeon } from "../types";
import { formatTime, uid } from "../store";
import { needsReview, pigeonByRing, reviewReasons } from "../selectors";
import { ConfirmBar, Empty, Panel, Tag } from "./common";

type SetState = React.Dispatch<React.SetStateAction<AppState>>;

function ReviewRow({
  pigeon,
  state,
  setState,
}: {
  pigeon: Pigeon;
  state: AppState;
  setState: SetState;
}) {
  const [bloodline, setBloodline] = useState(pigeon.bloodline);
  const [editing, setEditing] = useState(false);
  const reasons = reviewReasons(pigeon);
  const entries = state.entries.filter((e) => e.ring === pigeon.ring);
  const homeCount = entries.filter((e) => e.status === "归巢").length;

  const saveBloodline = () => {
    setState((s) => ({
      ...s,
      pigeons: s.pigeons.map((p) =>
        p.id === pigeon.id ? { ...p, bloodline: bloodline.trim() } : p
      ),
    }));
    setEditing(false);
  };

  const markHealthy = () => {
    setState((s) => ({
      ...s,
      pigeons: s.pigeons.map((p) =>
        p.id === pigeon.id ? { ...p, health: "正常" as const } : p
      ),
    }));
  };

  return (
    <tr className="row-review">
      <td className="mono">{pigeon.ring}</td>
      <td>
        {reasons.map((r) => (
          <Tag key={r} tone={r === "健康异常" ? "red" : "orange"}>
            {r}
          </Tag>
        ))}
      </td>
      <td>
        {editing ? (
          <span className="inline-edit-row">
            <input
              className="ctrl"
              list="bloodline-options"
              value={bloodline}
              placeholder="如：詹森系"
              onChange={(e) => setBloodline(e.target.value)}
            />
            <button className="btn-mini btn-primary" onClick={saveBloodline}>
              保存
            </button>
            <button className="btn-mini" onClick={() => setEditing(false)}>
              取消
            </button>
          </span>
        ) : (
          <>
            {pigeon.bloodline.trim() || <span className="muted">未建档</span>}
            <button
              className="btn-mini"
              onClick={() => {
                setBloodline(pigeon.bloodline);
                setEditing(true);
              }}
            >
              {pigeon.bloodline.trim() ? "修改血统" : "补录血统"}
            </button>
          </>
        )}
      </td>
      <td>
        {pigeon.health === "异常" ? (
          <>
            <Tag tone="red">异常</Tag>
            <button className="btn-mini" onClick={markHealthy}>
              标记恢复正常
            </button>
          </>
        ) : (
          <Tag tone="green">正常</Tag>
        )}
      </td>
      <td className="muted">
        登记 {entries.length} 次 · 归巢 {homeCount} 次
        {entries.length > 0 && "（待核期间成绩不参与排行）"}
      </td>
    </tr>
  );
}

export default function ReviewList({
  state,
  setState,
}: {
  state: AppState;
  setState: SetState;
}) {
  const reviewPigeons = useMemo(
    () => state.pigeons.filter(needsReview),
    [state.pigeons]
  );

  // 档案已移除但登记仍在的记录
  const orphanEntries = useMemo(
    () =>
      state.entries
        .filter((e) => !pigeonByRing(state, e.ring))
        .map((e) => ({
          entry: e,
          training: state.trainings.find((t) => t.id === e.trainingId),
        }))
        .filter((x) => x.training),
    [state]
  );

  const [removeOrphanId, setRemoveOrphanId] = useState<string | null>(null);

  const restorePigeon = (ring: string) => {
    setState((s) => ({
      ...s,
      pigeons: [
        {
          id: uid("pg"),
          ring,
          bloodline: "",
          sex: "公",
          health: "正常",
          createdAt: new Date().toISOString(),
        },
        ...s.pigeons,
      ],
    }));
  };

  const removeOrphan = (id: string) => {
    setState((s) => ({
      ...s,
      entries: s.entries.filter((e) => e.id !== id),
    }));
    setRemoveOrphanId(null);
  };

  return (
    <div className="view-grid">
      <datalist id="bloodline-options">
                {Array.from(new Set(state.pigeons.map((p) => p.bloodline).filter(Boolean))).map(
                  (b) => (
                    <option key={b} value={b} />
                  )
                )}
              </datalist>
      <Panel
        title="待核名单"
        sub="健康异常或血统未建档的鸽子，核实前其成绩不参与排行"
      >
        {reviewPigeons.length === 0 ? (
          <Empty text="没有待核的鸽子，全部档案齐全且健康正常" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>足环号</th>
                  <th>待核原因</th>
                  <th>血统建档</th>
                  <th>健康状态</th>
                  <th>登记情况</th>
                </tr>
              </thead>
              <tbody>
                {reviewPigeons.map((p) => (
                  <ReviewRow
                    key={p.id}
                    pigeon={p}
                    state={state}
                    setState={setState}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {orphanEntries.length > 0 && (
        <Panel
          title="档案缺失的登记"
          sub="这些足环号的档案已被移除，可恢复档案或清理登记"
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>足环号</th>
                  <th>训放</th>
                  <th>状态</th>
                  <th>归巢时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orphanEntries.map(({ entry, training }) => (
                  <tr key={entry.id}>
                    <td className="mono">{entry.ring}</td>
                    <td>
                      {training!.location} · {training!.distance}km
                    </td>
                    <td>
                      {entry.status === "归巢" ? (
                        <Tag tone="green">归巢</Tag>
                      ) : (
                        <Tag tone="orange">在飞</Tag>
                      )}
                    </td>
                    <td>{entry.arrivalTime ? formatTime(entry.arrivalTime) : "—"}</td>
                    <td className="ops">
                      <button
                        className="btn-mini btn-primary"
                        onClick={() => restorePigeon(entry.ring)}
                      >
                        恢复档案
                      </button>
                      {removeOrphanId === entry.id ? (
                        <ConfirmBar
                          message="移除该登记？"
                          onConfirm={() => removeOrphan(entry.id)}
                          onCancel={() => setRemoveOrphanId(null)}
                        />
                      ) : (
                        <button
                          className="btn-mini btn-danger-ghost"
                          onClick={() => setRemoveOrphanId(entry.id)}
                        >
                          移除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
