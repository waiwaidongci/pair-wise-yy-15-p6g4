import type { ReactNode } from "react";

export function Panel({
  title,
  sub,
  extra,
  children,
}: {
  title: string;
  sub?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          {sub && <p className="eyebrow">{sub}</p>}
          <h2>{title}</h2>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {hint && <em className="hint">{hint}</em>}
      </span>
      {children}
    </label>
  );
}

export const inputCls = "ctrl";

export function Empty({ text }: { text: string }) {
  return <p className="empty">暂无内容 · {text}</p>;
}

export function Tag({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "blue" | "red" | "orange" | "green";
}) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

/** 用于弹层式确认，替代 window.confirm 的样式不可控问题 */
export function ConfirmBar({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="confirm-bar">
      <b>{message}</b>
      <button className="btn-danger" onClick={onConfirm}>
        确认
      </button>
      <button onClick={onCancel}>取消</button>
    </span>
  );
}
