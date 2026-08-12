import * as React from "react";

import type { ChatUIMessage } from "../types";
import { BrandLogo } from "./BrandLogo";

type StepId =
  | "thinking"
  | "checking"
  | "searching"
  | "makes"
  | "orders"
  | "comparing"
  | "writing";
type KnownTool =
  | "search_products"
  | "list_catalog_makes"
  | "lookup_order"
  | "list_my_orders"
  | "compare_products";

interface ActivityStep {
  id: StepId;
  label: string;
}

type StepPhase = "pending" | "active" | "done";

interface VisibleStep {
  id: StepId;
  label: string;
  phase: StepPhase;
}

const STEP_LABELS: Record<StepId, string> = {
  thinking: "Thinking",
  checking: "Checking your question",
  searching: "Searching the catalog",
  makes: "Looking up vehicles",
  orders: "Checking your order",
  comparing: "Comparing products",
  writing: "Preparing your answer",
};

function isToolPart(part: ChatUIMessage["parts"][number], toolName: KnownTool): boolean {
  return part.type === `tool-${toolName}`;
}

function toolState(part: ChatUIMessage["parts"][number]): string | undefined {
  if ("state" in part && typeof part.state === "string") {
    return part.state;
  }
  return undefined;
}

function isToolInProgress(part: ChatUIMessage["parts"][number]): boolean {
  const state = toolState(part);
  return state === "input-streaming" || state === "input-available" || state === "call";
}

function isToolDone(part: ChatUIMessage["parts"][number]): boolean {
  const state = toolState(part);
  return state === "output-available" || state === "output-error" || state === "result";
}

/**
 * Builds the activity trail from real stream/tool signals. Catalog / order
 * steps only appear when those tools actually run.
 */
export function deriveActivitySteps(
  status: string,
  assistantMessage: ChatUIMessage | undefined,
  softAdvanced: boolean,
): VisibleStep[] {
  const parts = assistantMessage?.parts ?? [];
  const hasText = parts.some((part) => part.type === "text" && part.text.trim().length > 0);

  const searchPart = parts.find((part) => isToolPart(part, "search_products"));
  const makesPart = parts.find((part) => isToolPart(part, "list_catalog_makes"));
  const orderPart =
    parts.find((part) => isToolPart(part, "lookup_order")) ??
    parts.find((part) => isToolPart(part, "list_my_orders"));
  const comparePart = parts.find((part) => isToolPart(part, "compare_products"));

  const searchActive = searchPart ? isToolInProgress(searchPart) : false;
  const searchDone = searchPart ? isToolDone(searchPart) : false;
  const makesActive = makesPart ? isToolInProgress(makesPart) : false;
  const makesDone = makesPart ? isToolDone(makesPart) : false;
  const ordersActive = orderPart ? isToolInProgress(orderPart) : false;
  const ordersDone = orderPart ? isToolDone(orderPart) : false;
  const compareActive = comparePart ? isToolInProgress(comparePart) : false;
  const compareDone = comparePart ? isToolDone(comparePart) : false;

  const anyToolSeen = Boolean(searchPart || makesPart || orderPart || comparePart);
  const anyToolActive = searchActive || makesActive || ordersActive || compareActive;
  const anyToolDone = searchDone || makesDone || ordersDone || compareDone;

  let activeId: StepId;

  if (status === "submitted" && !softAdvanced) {
    activeId = "thinking";
  } else if (ordersActive) {
    activeId = "orders";
  } else if (compareActive) {
    activeId = "comparing";
  } else if (searchActive) {
    activeId = "searching";
  } else if (makesActive) {
    activeId = "makes";
  } else if (anyToolDone && !hasText) {
    activeId = "writing";
  } else if (status === "streaming" && !anyToolSeen && !hasText) {
    activeId = "checking";
  } else if (status === "submitted" && softAdvanced) {
    activeId = "checking";
  } else if (anyToolActive) {
    activeId = searchActive
      ? "searching"
      : makesActive
        ? "makes"
        : compareActive
          ? "comparing"
          : "orders";
  } else {
    activeId = "checking";
  }

  const sequence: ActivityStep[] = [{ id: "thinking", label: STEP_LABELS.thinking }];

  if (
    activeId === "checking" ||
    activeId === "searching" ||
    activeId === "makes" ||
    activeId === "orders" ||
    activeId === "comparing" ||
    activeId === "writing" ||
    softAdvanced ||
    status === "streaming"
  ) {
    sequence.push({ id: "checking", label: STEP_LABELS.checking });
  }

  if (searchPart || activeId === "searching") {
    sequence.push({ id: "searching", label: STEP_LABELS.searching });
  }

  if (makesPart || activeId === "makes") {
    sequence.push({ id: "makes", label: STEP_LABELS.makes });
  }

  if (orderPart || activeId === "orders") {
    sequence.push({ id: "orders", label: STEP_LABELS.orders });
  }

  if (comparePart || activeId === "comparing") {
    sequence.push({ id: "comparing", label: STEP_LABELS.comparing });
  }

  if (activeId === "writing" || (anyToolDone && !hasText)) {
    sequence.push({ id: "writing", label: STEP_LABELS.writing });
  }

  const activeIndex = sequence.findIndex((step) => step.id === activeId);
  const resolvedActive = activeIndex >= 0 ? activeIndex : 0;

  return sequence.map((step, index) => ({
    ...step,
    phase: index < resolvedActive ? "done" : index === resolvedActive ? "active" : "pending",
  }));
}

interface ActivityStatusProps {
  logoUrl: string;
  status: string;
  /** Latest assistant message for the in-flight turn, if the stream has created one. */
  assistantMessage?: ChatUIMessage;
}

/**
 * ChatGPT-style activity trail shown while waiting for the first tokens /
 * products — replaces the old bouncing-dots typing bubble.
 */
export function ActivityStatus({ logoUrl, status, assistantMessage }: ActivityStatusProps) {
  const [softAdvanced, setSoftAdvanced] = React.useState(false);

  React.useEffect(() => {
    if (status !== "submitted") {
      setSoftAdvanced(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setSoftAdvanced(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [status]);

  const steps = deriveActivitySteps(status, assistantMessage, softAdvanced);
  const activeLabel = steps.find((step) => step.phase === "active")?.label ?? "Thinking";

  return (
    <div className="dg-activity-row">
      <span className="dg-avatar" aria-hidden="true">
        <BrandLogo logoUrl={logoUrl} />
      </span>
      <div className="dg-activity" role="status" aria-live="polite" aria-label={activeLabel}>
        <ol className="dg-activity-list">
          {steps.map((step) => (
            <li
              key={step.id}
              className={`dg-activity-step dg-activity-step-${step.phase}`}
              aria-current={step.phase === "active" ? "step" : undefined}
            >
              <span className="dg-activity-rail" aria-hidden="true">
                <span className="dg-activity-dot" />
              </span>
              <span className="dg-activity-label">{step.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
