import { ReactNode, useCallback, useState } from "react";

export function Badge({
  tone = "gray",
  children,
}: {
  tone?: "gray" | "blue" | "green" | "orange" | "red" | "purple";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Field({
  label,
  children,
  hint,
  full,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  full?: boolean;
}) {
  return (
    <label className={full ? "field field-full" : "field"}>
      <span className="field-label">
        {label}
        {hint ? <em className="field-hint">{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

export function useFlash() {
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const show = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    setFlash({ tone, text });
    window.setTimeout(() => setFlash(null), 2600);
  }, []);
  const node = flash ? (
    <div className={`flash flash-${flash.tone}`} role="status">
      {flash.text}
    </div>
  ) : null;
  return { show, node };
}

export function useConfirm() {
  return useCallback((message: string): boolean => window.confirm(message), []);
}

export function StatusPill({
  training,
  entry,
  reasons,
  now,
}: {
  training: { releaseAt: string };
  entry: { returnAt: string };
  reasons: string[];
  now: number;
}) {
  if (reasons.length > 0) return <Badge tone="orange">待核 · {reasons.join("、")}</Badge>;
  if (!entry.returnAt) {
    const hours = (now - new Date(training.releaseAt).getTime()) / 3600e3;
    if (hours > 24) return <Badge tone="red">催查</Badge>;
    return <Badge tone="blue">飞行中</Badge>;
  }
  return <Badge tone="green">有效归巢</Badge>;
}

export function hoursLabel(hours: number): string {
  if (hours < 48) return `${Math.round(hours)} 小时`;
  return `${(hours / 24).toFixed(1)} 天`;
}
