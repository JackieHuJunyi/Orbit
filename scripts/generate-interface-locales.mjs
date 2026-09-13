import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { GENERATED_INTERFACE_TRANSLATIONS } from "../app/lib/interface-locales.generated.ts";
import { MANUAL_INTERFACE_TRANSLATIONS } from "../app/lib/interface-locales.manual.ts";

import { ENGLISH_ORBIT_GUIDE, localizeOrbitStatus, orbitQuickCommands, orbitUICopy } from "../app/lib/localization.ts";
import { PDF_TOOL_REGISTRY } from "../app/lib/pdf-tool-registry.ts";

const appRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(appRoot, "app", "lib", "interface-locales.generated.ts");
const targetLocales = ["fr", "es", "ru", "ar", "ja", "ko"];
const componentCatalogs = [
  ["app/components/welcome-experience.tsx", "WELCOME_BASE_COPY"],
  ["app/components/empty-workspace.tsx", "EMPTY_WORKSPACE_BASE_COPY"],
  ["app/components/import-review-dialog.tsx", "IMPORT_REVIEW_TASK_BASE_COPY"],
  ["app/components/model-profile-manager.tsx", "MODEL_MANAGER_BASE_COPY"],
  ["app/components/operating-review-dialog.tsx", "OPERATING_REVIEW_BASE_COPY"],
  ["app/components/document-briefing-dialog.tsx", "DOCUMENT_BRIEFING_BASE_COPY"],
  ["app/components/delivery-outcome-dialog.tsx", "DELIVERY_OUTCOME_BASE_COPY"],
  ["app/components/pilot-evidence-review-dialog.tsx", "PILOT_EVIDENCE_BASE_COPY"],
  ["app/components/pdf-ocr-setup-dialog.tsx", "PDF_OCR_BASE_COPY"],
  ["app/components/pdf-tool-center.tsx", "PDF_TOOL_CENTER_BASE_COPY"],
  ["app/lib/workbench-surface-copy.ts", "OPERATING_REVIEW_NOTICE_BASE_COPY"],
  ["app/lib/workbench-surface-copy.ts", "DOCUMENT_BRIEFING_NOTICE_BASE_COPY"],
  ["app/lib/workbench-surface-copy.ts", "PILOT_EVIDENCE_NOTICE_BASE_COPY"],
];
const protectedTerms = [
  "Orbit",
  "Markdown",
  "CSV",
  "JSON",
  "SQL",
  "Chart",
  "Deck",
  "DuckDB",
  "Agent",
  "Artifact",
  "Document",
  "Data",
  "Query",
  "Source",
  "Workspace",
  "Review",
  "Apply",
  "OpenAI",
  "OpenRouter",
  "Anthropic",
  "Gemini",
  "Chat Completions",
  "Responses",
  "generateContent",
  "DOC",
  "DOCX",
  "XLSX",
  "PPT",
  "PPTX",
  "ODT",
  "ODS",
  "ODP",
  "PDF",
  "HTML",
  "OCR",
  "macOS",
  "Windows",
  "Linux",
  "localStorage",
  "HttpOnly",
  "API Key",
  "ORBIT_CREDENTIAL_ENCRYPTION_KEY",
];

function collectStrings(value, strings) {
  if (typeof value === "string" && value.trim()) strings.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, strings));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, strings));
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return "";
}

function collectLiteralStrings(node, strings) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (node.text.trim()) strings.add(node.text);
    return;
  }
  ts.forEachChild(node, (child) => collectLiteralStrings(child, strings));
}

async function collectComponentEnglish(file, identifier, strings) {
  const source = await fs.readFile(path.join(appRoot, file), "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  for (const statement of tree.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== identifier || !declaration.initializer)
        continue;
      const root = ts.isAsExpression(declaration.initializer)
        ? declaration.initializer.expression
        : declaration.initializer;
      if (!ts.isObjectLiteralExpression(root)) continue;
      const english = root.properties.find(
        (property) => ts.isPropertyAssignment(property) && propertyName(property.name) === "en",
      );
      if (!english || !ts.isPropertyAssignment(english)) continue;
      collectLiteralStrings(english.initializer, strings);
      found = true;
    }
  }
  if (!found) throw new Error(`Could not find ${identifier}.en in ${file}.`);
}

async function collectEnglishStrings() {
  const strings = new Set();
  collectStrings(orbitUICopy("en"), strings);
  for (const kind of ["document", "data", "query", "chart", "slides"]) {
    for (const scope of ["selection", "artifact", "workspace"])
      collectStrings(orbitQuickCommands("en", scope, kind), strings);
  }
  ENGLISH_ORBIT_GUIDE.split("\n").forEach((line) => {
    if (line.trim()) strings.add(line);
  });
  for (const tool of PDF_TOOL_REGISTRY) {
    strings.add(tool.title);
    strings.add(tool.description);
  }
  for (const [file, identifier] of componentCatalogs) await collectComponentEnglish(file, identifier, strings);

  const localizationSource = await fs.readFile(path.join(appRoot, "app/lib/localization.ts"), "utf8");
  const statusKeys = [...localizationSource.matchAll(/^\s{2}"([^"]+)":\s*"/gmu)].map((match) => match[1]);
  for (const status of statusKeys) {
    if (localizeOrbitStatus("zh-CN", status) !== status) strings.add(status);
  }
  return [...strings].filter((value) => value.length <= 1_200).sort((left, right) => left.localeCompare(right));
}

function protectText(text) {
  const replacements = [];
  let value = text;
  const protect = (match) => {
    const index = replacements.push(match) - 1;
    return `{{ORBIT_TOKEN_${index}}}`;
  };
  value = value.replace(/`[^`]+`/gu, protect);
  value = value.replace(/(?:⌘|Ctrl|Command|Control|Alt|Shift|F2)(?:\s*[A-Z↵]|\s*Enter)?/gu, protect);
  for (const term of [...protectedTerms].sort((left, right) => right.length - left.length)) {
    value = value.replaceAll(term, () => protect(term));
  }
  return { value, replacements };
}

function restoreText(text, replacements) {
  let value = text;
  replacements.forEach((replacement, index) => {
    value = value
      .replaceAll(`{{ORBIT_TOKEN_${index}}}`, replacement)
      .replaceAll(`{{ORBIT TOKEN ${index}}}`, replacement);
  });
  return value;
}

async function requestTranslation(locale, body) {
  const form = new URLSearchParams({ client: "gtx", sl: "en", tl: locale, dt: "t", q: body });
  let response;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch("https://translate.googleapis.com/translate_a/single", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form,
    });
    if (response.ok || response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
  }
  if (!response.ok) throw new Error(`Translation request for ${locale} failed (${response.status}).`);
  const payload = await response.json();
  return Array.isArray(payload?.[0]) ? payload[0].map((segment) => segment?.[0] ?? "").join("") : "";
}

async function translateBatch(locale, entries) {
  const marker = (index) => `<<<ORBIT_SEGMENT_${index}>>>`;
  const body = entries.map((entry, index) => `${entry.value}\n${marker(index)}`).join("\n");
  const translated = await requestTranslation(locale, body);
  const parts = translated.split(/\n?<<<ORBIT_SEGMENT_\d+>>>\n?/gu);
  if (parts.length < entries.length) {
    return Promise.all(
      entries.map(async (entry) =>
        restoreText((await requestTranslation(locale, entry.value)).trim(), entry.replacements),
      ),
    );
  }
  return entries.map((entry, index) => restoreText((parts[index] ?? "").trim(), entry.replacements));
}

function restoreSourceSyntax(source, translated) {
  const sourceCells = source.split("|");
  const translatedCells = translated.split("|");
  if (sourceCells.length === translatedCells.length && sourceCells.length > 1) {
    sourceCells.forEach((cell, index) => {
      const trimmed = cell.trim();
      if (/^(?:⌘|Ctrl|Command|Control|Alt|Shift|F2)(?:\s*[A-Z↵]|\s*Enter)?$/u.test(trimmed)) {
        const leading = translatedCells[index].match(/^\s*/u)?.[0] ?? "";
        const trailing = translatedCells[index].match(/\s*$/u)?.[0] ?? "";
        translatedCells[index] = `${leading}${trimmed}${trailing}`;
      }
    });
    translated = translatedCells.join("|");
  }
  if (source.startsWith("⌘ Enter") && translated.startsWith("⌘")) {
    translated = translated.replace(/^⌘\s*\p{L}+/u, "⌘ Enter");
  }
  return translated;
}

async function translateLocale(locale, strings, existing = {}) {
  const result = {};
  const pending = [];
  for (const source of strings) {
    if (!process.argv.includes("--refresh") && typeof existing[source] === "string" && existing[source].trim()) {
      result[source] = restoreSourceSyntax(source, existing[source]);
    } else pending.push(source);
  }
  let batch = [];
  let size = 0;
  async function flush() {
    if (!batch.length) return;
    const translated = await translateBatch(locale, batch);
    batch.forEach((entry, index) => {
      result[entry.source] = restoreSourceSyntax(entry.source, translated[index] || entry.source);
    });
    batch = [];
    size = 0;
  }
  for (const source of pending) {
    const protectedEntry = protectText(source);
    const entry = { source, ...protectedEntry };
    if (size + entry.value.length > 3_200) await flush();
    batch.push(entry);
    size += entry.value.length + 30;
  }
  await flush();
  return Object.fromEntries(strings.map((source) => [source, result[source] ?? source]));
}

function serialize(catalogs) {
  return `// Generated by scripts/generate-interface-locales.mjs. Do not edit by hand.\n\nexport const GENERATED_INTERFACE_TRANSLATIONS = ${JSON.stringify(catalogs, null, 2)} as const;\n`;
}

const strings = await collectEnglishStrings();
if (process.argv.includes("--check")) {
  const catalogs = GENERATED_INTERFACE_TRANSLATIONS;
  const missingByLocale = Object.fromEntries(
    targetLocales.map((locale) => [
      locale,
      strings.filter((value) => {
        const catalog = { ...catalogs[locale], ...MANUAL_INTERFACE_TRANSLATIONS[locale] };
        return !catalog || typeof catalog[value] !== "string" || !catalog[value].trim();
      }),
    ]),
  );
  const missing = Object.values(missingByLocale).flat();
  if (missing.length) {
    const detail = Object.entries(missingByLocale)
      .filter(([, values]) => values.length)
      .map(([locale, values]) => `${locale}: ${values.join(" | ")}`)
      .join("\n");
    throw new Error(
      `Interface locale catalog is stale (${missing.length} missing entries). Run npm run locales:interface:generate.\n${detail}`,
    );
  }
  console.log(
    `Interface locale catalog covers ${strings.length} English strings across ${targetLocales.length} generated locales.`,
  );
} else {
  const catalogs = {};
  for (const locale of targetLocales) {
    const existing = GENERATED_INTERFACE_TRANSLATIONS[locale] ?? {};
    const missing = strings.filter((source) => process.argv.includes("--refresh") || !existing[source]);
    console.log(`${locale}: ${strings.length - missing.length} cached · ${missing.length} to translate…`);
    catalogs[locale] = await translateLocale(locale, strings, existing);
  }
  await fs.writeFile(outputPath, serialize(catalogs));
  console.log(`Wrote ${outputPath}.`);
}
