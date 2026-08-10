import {
  replaceSourceSelection,
  sourceSelectionError,
  type SourceSelection,
} from "./source-selection.ts";
import type { ArtifactKind, LocalPlan, WorkspaceArtifact } from "./workspace.ts";

export const selectionQuickCommands: Record<ArtifactKind, string[]> = {
  document: ["把选中内容压缩成一句话", "把选中内容改成三条要点"],
  data: ["把选中数值乘以 1.1", "把选中内容转成大写"],
  query: ["把选中内容转成大写", "去掉选中内容两端空格"],
  chart: ["把选中内容转成大写", "去掉选中内容两端空格"],
  slides: ["把选中内容压缩成一句话", "把选中内容改成三条要点"],
};

function selectedParts(source: string, selection: SourceSelection) {
  const selected = source.slice(selection.start, selection.end);
  const leadingLength = selected.length - selected.trimStart().length;
  const trailingLength = selected.length - selected.trimEnd().length;
  const coreEnd = Math.max(leadingLength, selected.length - trailingLength);
  return {
    leading: selected.slice(0, leadingLength),
    core: selected.slice(leadingLength, coreEnd),
    trailing: selected.slice(coreEnd),
  };
}

function sentenceUnits(value: string) {
  return (value.match(/[^.!?。！？\n]+[.!?。！？]?/gu) ?? [])
    .map((unit) => unit.trim())
    .filter(Boolean);
}

function conciseSelection(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const firstSentence = sentenceUnits(normalized)[0] ?? normalized;
  let concise = firstSentence
    .replace(/\b(?:actually|basically|really|very)\b[ ,]*/gi, "")
    .replace(/(?:其实|基本上|总体而言|非常)[，,\s]*/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (/^[A-Z]/.test(firstSentence) && /^[a-z]/.test(concise)) {
    concise = `${concise[0].toUpperCase()}${concise.slice(1)}`;
  }
  if (concise.length > 180) {
    const boundary = concise.slice(0, 177).replace(/\s+\S*$/, "").trimEnd();
    concise = `${boundary || concise.slice(0, 177)}…`;
  }
  return concise;
}

function bulletSelection(value: string) {
  const normalized = value.replace(/[\t ]+/g, " ").trim();
  let units = sentenceUnits(normalized);
  if (units.length < 2) {
    units = normalized.split(/[,，;；]\s*/u).map((unit) => unit.trim()).filter(Boolean);
  }
  return units.slice(0, 3).map((unit) => `- ${unit.replace(/^[-*+]\s+/, "")}`).join("\n");
}

function scaleNumericSelection(value: string) {
  const normalized = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(normalized)) {
    throw new Error("Select one unquoted CSV or JSON number before multiplying it by 1.1.");
  }
  const number = Number(normalized);
  const scaled = number * 1.1;
  if (!Number.isFinite(scaled)) throw new Error("The selected number cannot be scaled safely.");
  return Number(scaled.toPrecision(15)).toString();
}

export function planLocalSelectionChange(
  artifact: WorkspaceArtifact,
  selection: SourceSelection,
  prompt: string,
): LocalPlan {
  const selectionError = sourceSelectionError(artifact.source, selection);
  if (selectionError) throw new Error(selectionError);
  const instruction = prompt.trim();
  if (!instruction) throw new Error("Describe how Rune should change the selected source.");
  const parts = selectedParts(artifact.source, selection);
  if (!parts.core) throw new Error("Select visible source text before using Selection Agent.");

  let replacement: string;
  let summary: string;
  let detail: string;
  if (/乘以\s*1\.1|multiply(?:\s+it)?\s+by\s+1\.1/i.test(instruction)) {
    replacement = `${parts.leading}${scaleNumericSelection(parts.core)}${parts.trailing}`;
    summary = "Scale the selected numeric source by 1.1";
    detail = "Only the exact unquoted CSV or JSON number changes; the complete artifact and its dependencies are revalidated before Apply.";
  } else if (/大写|uppercase/i.test(instruction)) {
    replacement = artifact.source.slice(selection.start, selection.end).toLocaleUpperCase();
    summary = "Uppercase the selected source";
    detail = "Only the exact selected characters change case; surrounding source stays byte-for-byte equivalent.";
  } else if (/两端空格|trim/i.test(instruction)) {
    replacement = artifact.source.slice(selection.start, selection.end).trim();
    summary = "Trim the selected source";
    detail = "Only leading and trailing whitespace inside the exact selection is removed.";
  } else if (/要点|bullet|points?/i.test(instruction)) {
    replacement = `${parts.leading}${bulletSelection(parts.core)}${parts.trailing}`;
    summary = "Turn the selected source into reviewable points";
    detail = "Only the exact selected source range becomes up to three concise Markdown bullets.";
  } else if (/压缩|精简|简化|一句话|concise|shorten|one sentence/i.test(instruction)) {
    replacement = `${parts.leading}${conciseSelection(parts.core)}${parts.trailing}`;
    summary = "Condense the selected source";
    detail = "Only the exact selected source range is reduced to one concise statement.";
  } else {
    throw new Error("Try condensing the selection, turning it into points, multiplying one number by 1.1, uppercasing it, or trimming its edges.");
  }

  const nextSource = replaceSourceSelection(artifact.source, selection, replacement);
  if (nextSource === artifact.source) {
    throw new Error("The deterministic selection plan would not change this source. Select a different range or choose another action.");
  }
  return { nextSource, summary, detail };
}
