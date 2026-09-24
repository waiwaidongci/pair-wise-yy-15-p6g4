import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EntryInput,
  OpResult,
  PigeonInput,
  PersistState,
  Store,
  TrainingInput,
  loadState,
  saveState,
  seedState,
  uid,
} from "./ledger";

/** 每分钟刷新一次，驱动“催查 / 飞行中”的时间判断 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export function useStore(): Store {
  const [state, setState] = useState<PersistState>(loadState);
  const first = useRef(true);

  useEffect(() => {
    saveState(state);
    first.current = false;
  }, [state]);

  const setFilters = useCallback((patch: Partial<PersistState["filters"]>) => {
    setState((s) => ({ ...s, filters: { ...s.filters, ...patch } }));
  }, []);

  const setUi = useCallback((patch: Partial<PersistState["ui"]>) => {
    setState((s) => ({ ...s, ui: { ...s.ui, ...patch } }));
  }, []);

  const addPigeon = useCallback((input: PigeonInput): OpResult => {
    const ringNo = input.ringNo.trim();
    if (!ringNo) return { ok: false, error: "请填写足环号" };
    if (!input.bloodline.trim()) return { ok: false, error: "请填写血统（建档必须登记血统）" };
    let result: OpResult = { ok: true, id: ringNo };
    setState((s) => {
      if (s.pigeons.some((p) => p.ringNo === ringNo)) {
        result = { ok: false, error: "足环号已存在" };
        return s;
      }
      return {
        ...s,
        pigeons: [
          ...s.pigeons,
          {
            ringNo,
            bloodline: input.bloodline.trim(),
            sex: input.sex,
            healthNote: input.healthNote.trim(),
            note: input.note.trim(),
            mateRingNo: "",
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
    return result;
  }, []);

  const updatePigeon = useCallback(
    (ringNo: string, patch: Partial<Omit<PigeonInput, "ringNo">> & { mateRingNo?: string }) => {
      setState((s) => ({
        ...s,
        pigeons: s.pigeons.map((p) =>
          p.ringNo === ringNo
            ? {
                ...p,
                ...patch,
                bloodline:
                  patch.bloodline === undefined ? p.bloodline : patch.bloodline.trim(),
              }
            : p
        ),
      }));
    },
    []
  );

  const removePigeon = useCallback((ringNo: string) => {
    setState((s) => ({
      ...s,
      pigeons: s.pigeons
        .filter((p) => p.ringNo !== ringNo)
        // 解除其他鸽子与它的配对
        .map((p) => (p.mateRingNo === ringNo ? { ...p, mateRingNo: "" } : p)),
      trainings: s.trainings.map((t) => ({
        ...t,
        entries: t.entries.filter((e) => e.ringNo !== ringNo),
      })),
      ui: s.ui.ringNo === ringNo ? { ...s.ui, ringNo: "" } : s.ui,
    }));
  }, []);

  /** 一对一配对：任一方原配对自动解除 */
  const pairPigeons = useCallback((a: string, b: string) => {
    if (!a || !b || a === b) return;
    setState((s) => ({
      ...s,
      pigeons: s.pigeons.map((p) => {
        if (p.ringNo === a) return { ...p, mateRingNo: b };
        if (p.ringNo === b) return { ...p, mateRingNo: a };
        if (p.mateRingNo === a || p.mateRingNo === b) return { ...p, mateRingNo: "" };
        return p;
      }),
    }));
  }, []);

  const unpair = useCallback((ringNo: string) => {
    setState((s) => ({
      ...s,
      pigeons: s.pigeons.map((p) =>
        p.ringNo === ringNo || p.mateRingNo === ringNo
          ? { ...p, mateRingNo: "" }
          : p
      ),
    }));
  }, []);

  const addTraining = useCallback((input: TrainingInput): OpResult => {
    const location = input.location.trim();
    if (!location) return { ok: false, error: "请填写训放地点" };
    if (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0)
      return { ok: false, error: "距离需为大于 0 的公里数" };
    if (!input.releaseAt) return { ok: false, error: "请选择放飞时间" };
    const id = uid();
    setState((s) => ({
      ...s,
      trainings: [
        {
          id,
          location,
          distanceKm: input.distanceKm,
          releaseAt: input.releaseAt,
          weather: input.weather.trim(),
          entries: [],
          createdAt: new Date().toISOString(),
        },
        ...s.trainings,
      ],
      ui: { ...s.ui, tab: "trainings", trainingId: id },
    }));
    return { ok: true, id };
  }, []);

  const updateTraining = useCallback(
    (id: string, patch: Partial<TrainingInput>) => {
      setState((s) => ({
        ...s,
        trainings: s.trainings.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                location:
                  patch.location === undefined ? t.location : patch.location.trim(),
                weather:
                  patch.weather === undefined ? t.weather : patch.weather.trim(),
              }
            : t
        ),
      }));
    },
    []
  );

  const removeTraining = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      trainings: s.trainings.filter((t) => t.id !== id),
      ui: s.ui.trainingId === id ? { ...s.ui, trainingId: "" } : s.ui,
    }));
  }, []);

  const addEntry = useCallback((trainingId: string, input: EntryInput): OpResult => {
    const ringNo = input.ringNo.trim();
    if (!ringNo) return { ok: false, error: "请填写足环号" };
    if (input.returnAt && Number.isNaN(+new Date(input.returnAt)))
      return { ok: false, error: "归巢时间格式无效" };
    let result: OpResult = { ok: true, id: "" };
    setState((s) => {
      const training = s.trainings.find((t) => t.id === trainingId);
      if (!training) {
        result = { ok: false, error: "训放记录不存在" };
        return s;
      }
      if (training.entries.some((e) => e.ringNo === ringNo)) {
        result = { ok: false, error: "该足环已在本场登记" };
        return s;
      }
      const entryId = uid();
      result = { ok: true, id: entryId };
      return {
        ...s,
        trainings: s.trainings.map((t) =>
          t.id === trainingId
            ? {
                ...t,
                entries: [
                  ...t.entries,
                  {
                    id: entryId,
                    ringNo,
                    returnAt: input.returnAt,
                    abnormal: input.abnormal,
                    healthNote: input.healthNote.trim(),
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : t
        ),
      };
    });
    return result;
  }, []);

  const updateEntry = useCallback(
    (trainingId: string, entryId: string, patch: Partial<EntryInput>) => {
      setState((s) => ({
        ...s,
        trainings: s.trainings.map((t) =>
          t.id === trainingId
            ? {
                ...t,
                entries: t.entries.map((e) =>
                  e.id === entryId
                    ? {
                        ...e,
                        ...patch,
                        ringNo:
                          patch.ringNo === undefined ? e.ringNo : patch.ringNo.trim(),
                        healthNote:
                          patch.healthNote === undefined
                            ? e.healthNote
                            : patch.healthNote.trim(),
                      }
                    : e
                ),
              }
            : t
        ),
      }));
    },
    []
  );

  const removeEntry = useCallback((trainingId: string, entryId: string) => {
    setState((s) => ({
      ...s,
      trainings: s.trainings.map((t) =>
        t.id === trainingId
          ? { ...t, entries: t.entries.filter((e) => e.id !== entryId) }
          : t
      ),
    }));
  }, []);

  /** 待核名单快捷建档：补血统后即退出“血统未建档” */
  const quickArchive = useCallback((ringNo: string, bloodline: string): OpResult => {
    const bl = bloodline.trim();
    if (!bl) return { ok: false, error: "请填写血统后再建档" };
    let result: OpResult = { ok: true, id: ringNo };
    setState((s) => {
      if (s.pigeons.some((p) => p.ringNo === ringNo)) {
        result = { ok: false, error: "该足环已建档" };
        return s;
      }
      result = { ok: true, id: ringNo };
      return {
        ...s,
        pigeons: [
          ...s.pigeons,
          {
            ringNo,
            bloodline: bl,
            sex: "",
            healthNote: "",
            note: "由待核名单快速建档",
            mateRingNo: "",
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
    return result;
  }, []);

  const resetDemo = useCallback(() => {
    setState(seedState());
  }, []);

  return useMemo(
    () => ({
      state,
      setFilters,
      setUi,
      addPigeon,
      updatePigeon,
      removePigeon,
      pairPigeons,
      unpair,
      addTraining,
      updateTraining,
      removeTraining,
      addEntry,
      updateEntry,
      removeEntry,
      quickArchive,
      resetDemo,
    }),
    [
      state,
      setFilters,
      setUi,
      addPigeon,
      updatePigeon,
      removePigeon,
      pairPigeons,
      unpair,
      addTraining,
      updateTraining,
      removeTraining,
      addEntry,
      updateEntry,
      removeEntry,
      quickArchive,
      resetDemo,
    ]
  );
}
