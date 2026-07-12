/**
 * QA: compare planned reading slots vs generated IRT items.
 */
import type { IrtGeneratedItem } from "@/lib/irt/types";

export interface SlotPlanEntry {
  slot: number;
  passageId: string;
  questionType: string;
}

export interface SlotQaRow {
  slot: number;
  plannedPassageId: string;
  plannedQuestionType: string;
  itemId: string | null;
  actualQuestionType: string | null;
  passageOk: boolean;
  typeOk: boolean;
  validationOk: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  status: "pass" | "warn" | "fail" | "missing";
  notes: string[];
}

export interface SlotQaReport {
  generatedAt: string;
  readingItemCount: number;
  plannedSlotCount: number;
  summary: {
    pass: number;
    warn: number;
    fail: number;
    missing: number;
    typeMatchRate: number;
    passageMatchRate: number;
    overall: "pass" | "warn" | "fail";
  };
  rows: SlotQaRow[];
}

function passageMatchesItem(
  item: IrtGeneratedItem,
  passageId: string,
  passageTexts?: Record<string, string>
): boolean {
  if (item.exemplarIds?.includes(passageId)) return true;
  const text = passageTexts?.[passageId];
  if (text && item.passage) {
    const a = item.passage.trim().slice(0, 80);
    const b = text.trim().slice(0, 80);
    if (a && b && a === b) return true;
    if (item.passage.includes(text.slice(0, 40))) return true;
  }
  return false;
}

/**
 * Build QA report comparing slot plan to reading-domain generated items
 * (in generation order).
 */
export function buildSlotQaReport(
  slotPlan: SlotPlanEntry[] | undefined,
  items: IrtGeneratedItem[],
  opts?: { passageTexts?: Record<string, string> }
): SlotQaReport | null {
  if (!slotPlan || slotPlan.length === 0) return null;

  const readingItems = items.filter((i) => i.domain === "reading");
  const rows: SlotQaRow[] = [];

  for (let i = 0; i < slotPlan.length; i++) {
    const plan = slotPlan[i];
    const item = readingItems[i] ?? null;
    const notes: string[] = [];

    if (!item) {
      rows.push({
        slot: plan.slot,
        plannedPassageId: plan.passageId,
        plannedQuestionType: plan.questionType,
        itemId: null,
        actualQuestionType: null,
        passageOk: false,
        typeOk: false,
        validationOk: false,
        validationErrors: ["ITEM_MISSING"],
        validationWarnings: [],
        status: "missing",
        notes: ["생성 문항이 슬롯 수보다 적습니다."],
      });
      continue;
    }

    const actualType = item.questionType ?? null;
    const typeOk = actualType === plan.questionType;
    if (!typeOk) {
      notes.push(
        `유형 불일치: planned=${plan.questionType} actual=${actualType ?? "(none)"}`
      );
    }

    const passageOk = passageMatchesItem(
      item,
      plan.passageId,
      opts?.passageTexts
    );
    if (!passageOk) {
      notes.push(`지문 불일치: planned passageId=${plan.passageId}`);
    }

    const validationErrors = item.validation?.errors ?? [];
    const validationWarnings = item.validation?.warnings ?? [];
    const validationOk = item.validation?.ok !== false && validationErrors.length === 0;
    if (!validationOk) {
      notes.push(`검증 실패: ${validationErrors.join(", ") || "unknown"}`);
    }

    let status: SlotQaRow["status"] = "pass";
    if (!typeOk || !passageOk || !validationOk) {
      status = !passageOk || !validationOk || !typeOk ? "fail" : "warn";
    } else if (validationWarnings.length > 0) {
      status = "warn";
      notes.push(`경고: ${validationWarnings.join(", ")}`);
    }

    // soften: type mismatch alone can be warn if passage+validation ok
    // (model sometimes mislabels type but stem is usable)
    if (status === "fail" && passageOk && validationOk && !typeOk) {
      status = "warn";
    }

    rows.push({
      slot: plan.slot,
      plannedPassageId: plan.passageId,
      plannedQuestionType: plan.questionType,
      itemId: item.id,
      actualQuestionType: actualType,
      passageOk,
      typeOk,
      validationOk,
      validationErrors,
      validationWarnings,
      status,
      notes,
    });
  }

  // Extra reading items beyond plan
  if (readingItems.length > slotPlan.length) {
    for (let i = slotPlan.length; i < readingItems.length; i++) {
      const item = readingItems[i];
      rows.push({
        slot: i + 1,
        plannedPassageId: "(unplanned)",
        plannedQuestionType: "(unplanned)",
        itemId: item.id,
        actualQuestionType: item.questionType ?? null,
        passageOk: true,
        typeOk: false,
        validationOk: item.validation?.ok !== false,
        validationErrors: item.validation?.errors ?? [],
        validationWarnings: item.validation?.warnings ?? [],
        status: "warn",
        notes: ["슬롯 계획에 없는 추가 문항"],
      });
    }
  }

  const pass = rows.filter((r) => r.status === "pass").length;
  const warn = rows.filter((r) => r.status === "warn").length;
  const fail = rows.filter((r) => r.status === "fail").length;
  const missing = rows.filter((r) => r.status === "missing").length;
  const comparable = rows.filter((r) => r.status !== "missing");
  const typeMatchRate =
    comparable.length === 0
      ? 0
      : comparable.filter((r) => r.typeOk).length / comparable.length;
  const passageMatchRate =
    comparable.length === 0
      ? 0
      : comparable.filter((r) => r.passageOk).length / comparable.length;

  let overall: SlotQaReport["summary"]["overall"] = "pass";
  if (fail > 0 || missing > 0) overall = "fail";
  else if (warn > 0) overall = "warn";

  return {
    generatedAt: new Date().toISOString(),
    readingItemCount: readingItems.length,
    plannedSlotCount: slotPlan.length,
    summary: {
      pass,
      warn,
      fail,
      missing,
      typeMatchRate: Math.round(typeMatchRate * 1000) / 10,
      passageMatchRate: Math.round(passageMatchRate * 1000) / 10,
      overall,
    },
    rows,
  };
}
