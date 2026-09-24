import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { AppState, TabId, UiState } from "./types";
import { loadState, saveState } from "./store";
import Overview from "./components/Overview";
import TrainingView from "./components/TrainingView";
import Ranking from "./components/Ranking";
import ReviewList from "./components/ReviewList";
import PigeonBook from "./components/PigeonBook";

const UI_KEY = "pigeon-loft-ui-v1";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "鸽棚总览" },
  { id: "training", label: "训放登记" },
  { id: "ranking", label: "成绩排行" },
  { id: "review", label: "待核名单" },
  { id: "pigeons", label: "单羽档案" },
];

function loadUi(): UiState {
  const fallback: UiState = {
    tab: "overview",
    rankBand: "all",
    rankBloodline: "all",
    rankRing: "",
    listBloodline: "all",
    listStatus: "all",
    listRing: "",
  };
  try {
    const raw = localStorage.getItem(UI_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [ui, setUi] = useState<UiState>(loadUi);

  // 任何数据变化都落盘，离开页面再回来仍在
  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    } catch {
      /* ignore */
    }
  }, [ui]);

  const patchUi = (patch: Partial<UiState>) =>
    setUi((prev) => ({ ...prev, ...patch }));

  const reviewCount = useMemo(
    () =>
      state.pigeons.filter((p) => p.health === "异常" || !p.bloodline.trim())
        .length,
    [state.pigeons]
  );

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">离线台账 · 数据保存在本机浏览器</p>
          <h1>鸽棚训放台账</h1>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={ui.tab === t.id ? "tab active" : "tab"}
              onClick={() => patchUi({ tab: t.id })}
            >
              {t.label}
              {t.id === "review" && reviewCount > 0 && (
                <em className="badge">{reviewCount}</em>
              )}
            </button>
          ))}
        </nav>
      </header>

      {ui.tab === "overview" && (
        <Overview state={state} goto={(tab) => patchUi({ tab })} />
      )}
      {ui.tab === "training" && (
        <TrainingView state={state} setState={setState} />
      )}
      {ui.tab === "ranking" && (
        <Ranking state={state} ui={ui} patchUi={patchUi} />
      )}
      {ui.tab === "review" && (
        <ReviewList state={state} setState={setState} />
      )}
      {ui.tab === "pigeons" && (
        <PigeonBook state={state} setState={setState} ui={ui} patchUi={patchUi} />
      )}
    </main>
  );
}

export default App;
