import { window } from "./env"; // 必须最先加载：React 事件系统读取全局 window
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import App from "../src/App";

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error("✗", msg);
  }
}

async function setValue(el: Element, value: string) {
  const tag = el.tagName.toLowerCase();
  const Ctor =
    tag === "select"
      ? window.HTMLSelectElement
      : window.HTMLInputElement;
  // 用原型原生 setter：React 的 valueTracker 靠“DOM 新值 vs 记录的旧值”判定变化，
  // 实例上的 setter 会提前同步 tracker，导致 onChange 不触发（testing-library 同款做法）
  const setter = Object.getOwnPropertyDescriptor(Ctor.prototype, "value")!.set!;
  (el as HTMLElement).focus?.();
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(
      tag === "select"
        ? new window.Event("change", { bubbles: true })
        : new window.InputEvent("input", { bubbles: true, inputType: "insertText" })
    );
  });
}

let root: Root | null = null;
async function renderApp() {
  const container = document.getElementById("root")!;
  if (root) {
    await act(async () => {
      root!.unmount();
    });
  }
  root = createRoot(container);
  await act(async () => {
    root!.render(React.createElement(App));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const findButton = (text: string, scope?: Element) =>
  Array.from((scope ?? document).querySelectorAll("button")).find((b) =>
    b.textContent!.includes(text)
  );

async function click(el?: Element) {
  if (!el) throw new Error("element not found");
  await act(async () => {
    (el as HTMLElement).click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const bodyText = () => document.body.textContent ?? "";
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;

async function main() {
  await renderApp();

  // 1. 总览
  assert(document.querySelector("h1")!.textContent === "鸽棚训放台账", "标题渲染");
  assert(bodyText().includes("催查"), "总览有催查指标");
  assert(bodyText().includes("在档赛鸽"), "总览有在档指标");

  // 2. 新建训放
  await click(findButton("训放登记"));
  const releaseD = new Date(Date.now() - 3 * 3600000);
  const arrivalD = new Date(releaseD.getTime() + 2 * 3600000);
  const inputs = document.querySelectorAll(".field-grid input");
  await setValue(inputs[0], "测试放飞点");
  await setValue(inputs[1], "240");
  await setValue(inputs[2], fmt(releaseD));
  await setValue(inputs[3], "多云，顺风");
  await click(findButton("保存训放"));
  assert(bodyText().includes("测试放飞点"), "新训放已创建");

  // 3. 登记归巢（240km / 2小时 = 2000 米/分）
  const firstBlock = document.querySelector(".training-block.open")!;
  await click(findButton("按足环登记归巢", firstBlock));
  const aInputs = firstBlock.querySelectorAll(
    ".arrival-form input, .arrival-form select"
  );
  await setValue(aInputs[0], "CHN-23-008771");
  await setValue(aInputs[1], fmt(arrivalD));
  assert(bodyText().includes("2小时") && bodyText().includes("2000"), "保存前实时算出用时/分速");
  await click(findButton("确认归巢", firstBlock));
  assert(bodyText().includes("2000"), "登记后显示分速2000米/分");
  assert(bodyText().includes("CHN-23-008771"), "名单含该足环");

  // 未知足环自动建档
  await click(findButton("按足环登记归巢", firstBlock));
  const aInputs2 = firstBlock.querySelectorAll(
    ".arrival-form input, .arrival-form select"
  );
  await setValue(aInputs2[0], "CHN-99-NEWRING");
  await setValue(aInputs2[1], fmt(new Date(releaseD.getTime() + 3 * 3600000)));
  assert(bodyText().includes("自动建档"), "未知足环提示自动建档");
  await click(findButton("确认归巢", firstBlock));

  // 4. 排行榜：分速降序 + 距离档 + 血统筛选 + 排除区
  await click(findButton("成绩排行"));
  assert(!!document.querySelector(".rank-table"), "排行榜渲染");
  assert(bodyText().includes("不参与排行"), "存在不参与排行分区");
  const rankRings = () =>
    Array.from(document.querySelectorAll(".rank-table tbody tr"));
  const sortedNow = rankRings();
  // 第二列是分速列
  const mpmOf = (tr: Element) =>
    Number((tr.querySelectorAll("td")[1].textContent ?? "").replace(/[^\d]/g, ""));
  assert(
    sortedNow.slice(0, -1).every((t, i) => mpmOf(t) >= mpmOf(sortedNow[i + 1])),
    "排行榜按分速降序"
  );

  const fSelects = document.querySelectorAll(".filter select");
  await setValue(fSelects[0], "long");
  assert(
    document.querySelectorAll(".rank-table tbody tr").length === 0,
    "长距离档下无成绩"
  );
  await setValue(fSelects[0], "middle");
  assert(!!document.querySelector(".rank-table"), "中距离档有成绩");
  await setValue(fSelects[0], "all");
  await setValue(fSelects[1], "詹森系");
  assert(
    rankRings().every((tr) => (tr.textContent ?? "").includes("詹森系")) &&
      rankRings().length >= 1,
    "血统筛选只剩詹森系"
  );
  await setValue(fSelects[1], "all");
  const filterInput = document.querySelector(".filter input") as HTMLInputElement;
  await setValue(filterInput, "NEWRING");
  assert(
    document.querySelectorAll(".rank-table tbody tr").length === 0,
    "未建档鸽成绩不进主榜"
  );
  assert(bodyText().includes("CHN-99-NEWRING"), "未建档鸽在排除区");
  await click(findButton("清除筛选"));

  // 5. 待核名单：NEWRING 血统未建档、120766 健康异常且血统未建档
  await click(findButton("待核名单"));
  assert(bodyText().includes("血统未建档"), "显示血统未建档");
  assert(bodyText().includes("健康异常"), "显示健康异常");
  if (findButton("标记恢复正常")) await click(findButton("标记恢复正常"));
  // 逐条补录全部未建档血统（必须定位到具体行，避免按钮匹配串行）
  const fillFirstBloodline = async (name: string) => {
    const row = Array.from(
      document.querySelectorAll(".data-table tbody tr")
    ).find((r) => (r.textContent ?? "").includes("补录血统"))!;
    await click(findButton("补录血统", row));
    const editRow = row.querySelector(".inline-edit-row")!;
    await setValue(editRow.querySelector("input")!, name);
    await click(findButton("保存", editRow));
  };
  await fillFirstBloodline("考夫曼系");
  await fillFirstBloodline("胡本系");
  assert(!findButton("补录血统"), "补录血统按钮全部消失");
  assert(bodyText().includes("没有待核的鸽子"), "处理完后待核名单清空");

  // 6. 单羽档案
  await click(findButton("单羽档案"));
  const card = Array.from(document.querySelectorAll(".pigeon-card")).find((c) =>
    c.textContent!.includes("CHN-24-001839")
  )!;
  assert(!!card, "档案卡片含目标足环");
  await click(card);
  assert(bodyText().includes("历次训放"), "详情含历次训放");
  assert(bodyText().includes("当前配对"), "详情含当前配对");
  assert(bodyText().includes("CHN-24-002114"), "显示种子配对配偶");
  await click(findButton("配对调整"));
  const pairSelect = document.querySelector(".pair-editor select") as HTMLSelectElement;
  const target = Array.from(pairSelect.querySelectorAll("option")).find((o) =>
    (o.textContent ?? "").includes("CHN-23-008771")
  )!;
  await setValue(pairSelect, target.getAttribute("value")!);
  await click(findButton("保存配对", document.querySelector(".pair-editor")!));
  assert(bodyText().includes("CHN-23-008771"), "配对更新为新配偶");
  await click(findButton("✕ 关闭详情"));
  const exCard = Array.from(document.querySelectorAll(".pigeon-card")).find((c) =>
    c.textContent!.includes("CHN-24-002114")
  )!;
  assert(exCard.textContent!.includes("配对：无"), "原配偶关系自动解除");

  // 7. 编辑档案 + 移除
  await click(
    Array.from(document.querySelectorAll(".pigeon-card")).find((c) =>
      c.textContent!.includes("CHN-99-NEWRING")
    )
  );
  await click(findButton("编辑档案"));
  const editFormInputs = document.querySelectorAll(".pigeon-form input");
  await setValue(editFormInputs[1], "考夫曼系B");
  const editFormSelects = document.querySelectorAll(".pigeon-form select");
  await setValue(editFormSelects[1], "正常");
  await click(findButton("保存修改", document.querySelector(".detail-sheet")!));
  assert(bodyText().includes("考夫曼系B"), "档案编辑已保存");

  // 8. 持久化：离开再回来（先验证，再做移除）
  const stored = window.localStorage.getItem("pigeon-loft-ledger-v1")!;
  assert(stored.includes("测试放飞点"), "localStorage 含新训放");
  assert(stored.includes("考夫曼系B"), "localStorage 含编辑后血统");
  await renderApp();
  // 重载后默认停在离开时的“单羽档案”页（UI 状态也持久化）
  assert(
    document.querySelector(".tab.active")!.textContent!.includes("单羽档案"),
    "回来后停留在离开时的页签"
  );
  await click(findButton("训放登记"));
  assert(bodyText().includes("测试放飞点"), "回来后新训放仍在");
  await click(findButton("单羽档案"));
  const filterSel = document.querySelectorAll(".filter select")[0] as HTMLSelectElement;
  await setValue(filterSel, "詹森系");
  assert(
    Array.from(document.querySelectorAll(".pigeon-card")).every((c) =>
      c.textContent!.includes("詹森系")
    ),
    "档案血统筛选生效"
  );
  await renderApp();
  assert(
    (document.querySelectorAll(".filter select")[0] as HTMLSelectElement)
      .value === "詹森系" && !!document.querySelector(".pigeon-card"),
    "离开再回来筛选条件保留"
  );

  // 移除档案（历次训放登记保留，可在待核页恢复）
  await click(findButton("清除筛选"));
  const newRingCard = Array.from(
    document.querySelectorAll(".pigeon-card")
  ).find((c) => c.textContent!.includes("CHN-99-NEWRING"));
  assert(!!newRingCard, "清除筛选后能找到待移除卡片");
  await click(newRingCard);
  await click(findButton("移除档案"));
  await click(findButton("确认"));
  assert(!bodyText().includes("CHN-99-NEWRING"), "档案已移除");
  const afterRemove = JSON.parse(
    window.localStorage.getItem("pigeon-loft-ledger-v1")!
  );
  assert(
    afterRemove.entries.some((e: { ring: string }) => e.ring === "CHN-99-NEWRING"),
    "移除档案后历次训放登记仍保留"
  );

  console.log(
    `\n${fail === 0 ? "端到端冒烟全部通过" : "有失败"}：${pass} 通过, ${fail} 失败`
  );
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
