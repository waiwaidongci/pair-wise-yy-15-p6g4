import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { overdueItems, pendingReasons, pigeonMap, uniqueBloodlines } from "./ledger";
import { useNow, useStore } from "./store";
import { Dashboard } from "./views/Dashboard";
import { Pigeons } from "./views/Pigeons";
import { Ranking } from "./views/Ranking";
import { Trainings } from "./views/Trainings";

const TABS: { key: "dashboard" | "trainings" | "ranking" | "pigeons"; label: string }[] = [
  { key: "dashboard", label: "鸽棚总览" },
  { key: "trainings", label: "训放登记" },
  { key: "ranking", label: "成绩排行" },
  { key: "pigeons", label: "鸽群档案" },
];

function App() {
  const store = useStore();
  const now = useNow();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const { pigeons, trainings, ui } = store.state;
  const map = useMemo(() => pigeonMap(pigeons), [pigeons]);

  const reviewCount = useMemo(() => {
    let n = 0;
    for (const t of trainings)
      for (const e of t.entries) if (pendingReasons(e, map).length) n++;
    return n;
  }, [trainings, map]);

  const overdueCount = useMemo(
    () => overdueItems(trainings, now).length,
    [trainings, now]
  );

  const tabBadges: Record<string, number> = {
    dashboard: overdueCount + reviewCount,
  };

  const ringNos = useMemo(() => pigeons.map((p) => p.ringNo), [pigeons]);
  const bloodlines = useMemo(() => uniqueBloodlines(pigeons), [pigeons]);

  const go = (tab: typeof ui.tab) => {
    store.setUi({
      tab,
      // 切换大标签时返回对应一级列表，档案/场次详情仍可在内部跳转
      trainingId: tab === "trainings" ? ui.trainingId : "",
      ringNo: tab === "pigeons" ? ui.ringNo : "",
    });
  };

  const resetAll = () => {
    if (
      window.confirm("确定清空当前全部台账并恢复演示数据？此操作不可撤销。") &&
      window.confirm("再次确认：所有自建档案、训放与配对都将被演示数据覆盖。")
    ) {
      store.resetDemo();
    }
  };

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">🕊</span>
          <div>
            <h1>鸽棚训放台账</h1>
            <p>离线可用 · 数据保存在本机浏览器</p>
          </div>
        </div>
        <div className="topbar-side">
          <span className={`net ${online ? "net-on" : "net-off"}`}>
            {online ? "在线" : "离线模式"}
          </span>
          <button className="ghost" onClick={resetAll}>
            恢复演示数据
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={ui.tab === t.key ? "tab tab-on" : "tab"}
            onClick={() => go(t.key)}
          >
            {t.label}
            {tabBadges[t.key] ? <span className="tab-dot">{tabBadges[t.key]}</span> : null}
          </button>
        ))}
      </nav>

      {ui.tab === "dashboard" && <Dashboard store={store} now={now} />}
      {ui.tab === "trainings" && <Trainings store={store} now={now} />}
      {ui.tab === "ranking" && <Ranking store={store} />}
      {ui.tab === "pigeons" && <Pigeons store={store} now={now} />}

      <footer className="footer">
        <span>所有增录、编辑、筛选、移除与配对调整均自动保存在本机，关闭页面或离线后再回来仍然可见。</span>
      </footer>

      {/* 全局自动补全：足环号、血统 */}
      <datalist id="ring-list">
        {ringNos.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <datalist id="blood-list">
        {bloodlines.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </main>
  );
}

export default App;
