import { useMemo } from "react";
import type { AppState, UiState } from "../types";
import { DISTANCE_BANDS, bandOfDistance, formatTime } from "../store";
import { bloodlines, rankRows } from "../selectors";
import { Empty, Panel, Tag } from "./common";

export default function Ranking({
  state,
  ui,
  patchUi,
}: {
  state: AppState;
  ui: UiState;
  patchUi: (patch: Partial<UiState>) => void;
}) {
  const lines = useMemo(() => bloodlines(state), [state]);
  const rows = useMemo(() => rankRows(state), [state]);

  const filtered = rows.filter((r) => {
    if (ui.rankBand !== "all" && bandOfDistance(r.training.distance).key !== ui.rankBand)
      return false;
    if (
      ui.rankBloodline !== "all" &&
      (r.pigeon?.bloodline ?? "") !== ui.rankBloodline
    )
      return false;
    if (
      ui.rankRing.trim() &&
      !r.entry.ring.toLowerCase().includes(ui.rankRing.trim().toLowerCase())
    )
      return false;
    return true;
  });

  const ranked = filtered.filter((r) => !r.excluded);
  const excluded = filtered.filter((r) => r.excluded);

  return (
    <div className="view-grid">
      <Panel title="成绩排行" sub="按分速（米/分）自动排序">
        <div className="filter-bar">
          <label className="filter">
            <span>距离档</span>
            <select
              className="ctrl"
              value={ui.rankBand}
              onChange={(e) => patchUi({ rankBand: e.target.value })}
            >
              <option value="all">全部距离</option>
              {DISTANCE_BANDS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter">
            <span>血统</span>
            <select
              className="ctrl"
              value={ui.rankBloodline}
              onChange={(e) => patchUi({ rankBloodline: e.target.value })}
            >
              <option value="all">全部血统</option>
              {lines.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="filter grow">
            <span>足环号</span>
            <input
              className="ctrl mono"
              value={ui.rankRing}
              placeholder="输入足环号筛选"
              onChange={(e) => patchUi({ rankRing: e.target.value })}
            />
          </label>
          {(ui.rankBand !== "all" ||
            ui.rankBloodline !== "all" ||
            ui.rankRing) && (
            <button
              onClick={() =>
                patchUi({
                  rankBand: "all",
                  rankBloodline: "all",
                  rankRing: "",
                })
              }
            >
              清除筛选
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <Empty text="当前筛选下还没有归巢成绩" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table rank-table">
                <thead>
                  <tr>
                    <th style={{ width: 56 }}>名次</th>
                    <th>分速</th>
                    <th>足环号</th>
                    <th>血统</th>
                    <th>训放地点</th>
                    <th>距离</th>
                    <th>放飞时间</th>
                    <th>用时</th>
                    <th>归巢健康</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r, i) => (
                    <tr key={r.entry.id} className={i < 3 ? `rank-${i + 1}` : undefined}>
                      <td>
                        <span className={`rank-no rank-no-${i + 1}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td>
                        <b className="text-primary big-num">{r.mpm}</b>
                        <span className="muted"> 米/分</span>
                      </td>
                      <td className="mono">{r.entry.ring}</td>
                      <td>{r.pigeon?.bloodline || "—"}</td>
                      <td>{r.training.location}</td>
                      <td>{r.training.distance}km</td>
                      <td>{formatTime(r.training.releaseTime)}</td>
                      <td>{r.durationText}</td>
                      <td>
                        {r.arrivalAbnormal ? (
                          <Tag tone="red">归巢异常</Tag>
                        ) : (
                          <Tag tone="green">正常</Tag>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {excluded.length > 0 && (
              <div className="excluded-block">
                <h4>
                  不参与排行（{excluded.length} 条）
                  <small className="muted">
                    健康异常、血统未建档或档案缺失的成绩仅作记录
                  </small>
                </h4>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>分速</th>
                        <th>足环号</th>
                        <th>血统</th>
                        <th>训放</th>
                        <th>排除原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excluded.map((r) => (
                        <tr key={r.entry.id} className="row-review">
                          <td>
                            <b>{r.mpm}</b>
                            <span className="muted"> 米/分</span>
                          </td>
                          <td className="mono">{r.entry.ring}</td>
                          <td>
                            {r.pigeon?.bloodline?.trim() ? (
                              r.pigeon.bloodline
                            ) : (
                              <Tag tone="orange">未建档</Tag>
                            )}
                          </td>
                          <td>
                            {r.training.location} · {r.training.distance}km
                          </td>
                          <td>
                            {r.excludeReasons.map((reason) => (
                              <Tag key={reason} tone="red">
                                {reason}
                              </Tag>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
