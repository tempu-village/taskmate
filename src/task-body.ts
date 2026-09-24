import type { TaskStep } from "./domain";

const STEP_LINE = /^- \[([ xX])\](?: (.*))?$/;
const DUE_SUFFIX = /^(.*?)(?:\s+<!-- due: (\d{4}-\d{2}-\d{2}) -->)\s*$/;

export interface ParsedTaskBody { steps: TaskStep[]; notes: string; stepSectionRemainder: string; }

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function splitStepDeadline(rawText: string): { text: string; date: string | null } {
  let text = rawText;
  let date: string | null = null;
  while (true) {
    const due = text.match(DUE_SUFFIX);
    if (!due?.[2] || !isCalendarDate(due[2]) || !due[1].trim()) break;
    date ??= due[2];
    text = due[1].trimEnd();
  }
  return { text, date };
}

export function normalizeTaskSteps(steps: TaskStep[]): TaskStep[] {
  return steps.map((step) => {
    const parsed = splitStepDeadline(step.text.replace(/\r?\n/g, " ").trim());
    return { text: parsed.text, completed: step.completed, date: step.date && isCalendarDate(step.date) ? step.date : parsed.date };
  }).filter((step) => step.text.length > 0);
}

export function parseTaskBody(body: string): ParsedTaskBody {
  const lines = body.trim().split(/\r?\n/);
  if (lines.length === 1 && lines[0] === "") return { steps: [], notes: "", stepSectionRemainder: "" };
  const stepsHeading = lines.findIndex((line) => line.trim() === "## Steps");
  if (stepsHeading < 0) return { steps: [], notes: body.trim(), stepSectionRemainder: "" };
  const notesHeading = lines.findIndex((line, index) => index > stepsHeading && line.trim() === "## Notes");
  const sectionEnd = notesHeading >= 0 ? notesHeading : lines.findIndex((line, index) => index > stepsHeading && /^##\s+/.test(line));
  const end = sectionEnd >= 0 ? sectionEnd : lines.length;
  const steps: TaskStep[] = [];
  const remainder: string[] = [];
  for (const line of lines.slice(stepsHeading + 1, end)) {
    const checkbox = line.match(STEP_LINE);
    const rawText = checkbox?.[2]?.trim() ?? "";
    if (!checkbox || !rawText) { remainder.push(line); continue; }
    const parsed = splitStepDeadline(rawText);
    steps.push({ text: parsed.text, completed: checkbox[1].toLowerCase() === "x", date: parsed.date });
  }
  const before = lines.slice(0, stepsHeading).join("\n").trim();
  const after = notesHeading >= 0 ? lines.slice(notesHeading + 1).join("\n").trim() : "";
  return { steps, notes: [before, after].filter(Boolean).join("\n\n"), stepSectionRemainder: remainder.join("\n").trim() };
}

export function encodeTaskBody(steps: TaskStep[], notes: string, stepSectionRemainder = ""): string {
  const normalized = normalizeTaskSteps(steps);
  const remainder = stepSectionRemainder.trim();
  const trimmedNotes = notes.trim();
  if (normalized.length === 0 && !remainder) return trimmedNotes;
  const stepLines = normalized.map((step) => `- [${step.completed ? "x" : " "}] ${step.text}${step.date ? ` <!-- due: ${step.date} -->` : ""}`);
  const stepSection = ["## Steps", "", ...stepLines, ...(remainder ? ["", remainder] : [])].join("\n").trimEnd();
  return trimmedNotes ? `${stepSection}\n\n## Notes\n\n${trimmedNotes}` : stepSection;
}
