"use client";

import {
  BarChart3,
  Check,
  Database,
  FilePlus2,
  FileText,
  LoaderCircle,
  Presentation,
  ShieldCheck,
  TableProperties,
} from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import {
  MAX_ARTIFACT_TITLE_CHARS,
  artifactCreationSourceOptions,
  creatableArtifactTypes,
  prepareArtifactCreation,
  type ArtifactCreationInput,
  type ChartCreationFormat,
  type ChartCreationMark,
  type CreatableArtifactKind,
} from "../lib/artifact-creation";
import type { WorkspaceArtifact } from "../lib/workspace";
import { chartEmbeddingTargets } from "../lib/chart-embedding";
import { ReviewDialog } from "./review-dialog";

function TypeIcon({ kind }: { kind: CreatableArtifactKind }) {
  if (kind === "document") return <FileText aria-hidden="true" />;
  if (kind === "data") return <TableProperties aria-hidden="true" />;
  if (kind === "query") return <Database aria-hidden="true" />;
  if (kind === "chart") return <BarChart3 aria-hidden="true" />;
  return <Presentation aria-hidden="true" />;
}

function creationInputFor(
  kind: CreatableArtifactKind,
  title: string,
  sourceArtifactId: string,
  category: string,
  value: string,
  mark: ChartCreationMark,
  format: ChartCreationFormat,
): ArtifactCreationInput {
  if (kind === "query") return { kind, title, sourceArtifactId };
  if (kind === "chart") {
    return { kind, title, sourceArtifactId, category, value, mark, format };
  }
  return { kind, title };
}

function titlePlaceholder(kind: CreatableArtifactKind) {
  if (kind === "document") return "Project brief";
  if (kind === "data") return "Operating metrics";
  if (kind === "query") return "Revenue analysis";
  if (kind === "chart") return "Revenue by region";
  return "Board narrative";
}

export function NewArtifactDialog({
  artifacts,
  error,
  onCancel,
  onCreate,
}: {
  artifacts: WorkspaceArtifact[];
  error?: string;
  onCancel: () => void;
  onCreate: (input: ArtifactCreationInput, embedArtifactId?: string) => void | Promise<void>;
}) {
  const [kind, setKind] = useState<CreatableArtifactKind>("document");
  const [title, setTitle] = useState("");
  const [sourceArtifactId, setSourceArtifactId] = useState("");
  const [category, setCategory] = useState("");
  const [value, setValue] = useState("");
  const [mark, setMark] = useState<ChartCreationMark>("bar");
  const [format, setFormat] = useState<ChartCreationFormat>("number");
  const [embedArtifactId, setEmbedArtifactId] = useState("");
  const [creating, setCreating] = useState(false);
  const embeddingTargets = useMemo(() => chartEmbeddingTargets(artifacts), [artifacts]);
  const sourceOptions = useMemo(
    () => kind === "query" || kind === "chart"
      ? artifactCreationSourceOptions(artifacts, kind)
      : [],
    [artifacts, kind],
  );
  const sourceOption = sourceOptions.find((option) => option.artifactId === sourceArtifactId)
    ?? sourceOptions[0];
  const effectiveCategory = sourceOption?.columns.includes(category)
    ? category
    : sourceOption?.columns[0] ?? "";
  const preferredValue = sourceOption?.numericColumns.find((column) => column !== effectiveCategory)
    ?? sourceOption?.columns.find((column) => column !== effectiveCategory)
    ?? sourceOption?.columns[0]
    ?? "";
  const effectiveValue = sourceOption?.columns.includes(value) ? value : preferredValue;
  const input = useMemo(
    () => creationInputFor(
      kind,
      title,
      sourceOption?.artifactId ?? "",
      effectiveCategory,
      effectiveValue,
      mark,
      format,
    ),
    [effectiveCategory, effectiveValue, format, kind, mark, sourceOption?.artifactId, title],
  );
  const prepared = useMemo(
    () => prepareArtifactCreation(artifacts, input),
    [artifacts, input],
  );
  const bindingError = (kind === "query" || kind === "chart") && !sourceOption
    ? kind === "query"
      ? "Add a valid Data table before creating a Query."
      : "Add a valid Data table or Query before creating a Chart."
    : "";
  const formError = error || bindingError || (title ? prepared.errors[0] : "");

  async function create() {
    if (!prepared.artifact || creating) return;
    setCreating(true);
    try {
      await onCreate(input, kind === "chart" ? embedArtifactId : undefined);
    } finally {
      setCreating(false);
    }
  }

  function onTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void create();
  }

  return (
    <ReviewDialog
      dialogId="new-artifact"
      kicker={<><FilePlus2 aria-hidden="true" /> Start from readable source</>}
      title="Create a new artifact"
      description="Choose a canonical source. Query and Chart files bind to exact upstream artifacts and fields from their first revision."
      detailsLabel="New artifact details"
      onCancel={() => {
        if (!creating) onCancel();
      }}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> One atomic device write · no upload</div>
          <span>
            <button className="button ghost-button" onClick={onCancel} disabled={creating}>Cancel</button>
            <button className="button primary-button" onClick={() => void create()} disabled={!prepared.artifact || creating}>
              {creating ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {creating ? "Verifying live source…" : "Create source"}
            </button>
          </span>
        </>
      )}
    >
      <div className="new-artifact-form">
        <fieldset>
          <legend>Artifact type</legend>
          <div className="new-artifact-types" role="radiogroup" aria-label="Artifact type">
            {creatableArtifactTypes.map((type) => (
              <button
                key={type.kind}
                className={`new-artifact-type ${kind === type.kind ? "selected" : ""}`}
                onClick={() => setKind(type.kind)}
                role="radio"
                aria-checked={kind === type.kind}
              >
                <span className={`artifact-icon ${type.kind}`}><TypeIcon kind={type.kind} /></span>
                <strong>{type.label}</strong>
                <small>{type.description}</small>
                <code>{type.format} · {type.extension}</code>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="new-artifact-title" htmlFor="new-artifact-title">
          <span>Title</span>
          <input
            id="new-artifact-title"
            data-dialog-initial-focus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={onTitleKeyDown}
            placeholder={titlePlaceholder(kind)}
            maxLength={MAX_ARTIFACT_TITLE_CHARS + 1}
            aria-describedby="new-artifact-title-help"
            aria-invalid={Boolean(title && prepared.errors.length)}
          />
          <small id="new-artifact-title-help">Rune derives a portable filename and stable workspace id. You can edit the source immediately.</small>
        </label>

        {(kind === "query" || kind === "chart") && (
          <fieldset className="new-artifact-binding">
            <legend>Source binding</legend>
            <div className="new-artifact-binding-grid">
              <label className="wide" htmlFor="new-artifact-source">
                <span>{kind === "query" ? "Data source" : "Data or Query source"}</span>
                <select
                  id="new-artifact-source"
                  value={sourceOption?.artifactId ?? ""}
                  onChange={(event) => {
                    setSourceArtifactId(event.target.value);
                    setCategory("");
                    setValue("");
                  }}
                  disabled={!sourceOptions.length}
                >
                  {!sourceOptions.length && <option value="">No compatible source</option>}
                  {sourceOptions.map((option) => (
                    <option key={option.artifactId} value={option.artifactId}>
                      {option.name} · {option.kind === "query" ? "Query" : "Data"}
                    </option>
                  ))}
                </select>
              </label>

              {kind === "chart" && sourceOption && (
                <>
                  <label htmlFor="new-artifact-category">
                    <span>Category field</span>
                    <select
                      id="new-artifact-category"
                      value={effectiveCategory}
                      onChange={(event) => {
                        setCategory(event.target.value);
                        if (event.target.value === effectiveValue) setValue("");
                      }}
                    >
                      {sourceOption.columns.map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                  </label>
                  <label htmlFor="new-artifact-value">
                    <span>Value field</span>
                    <select id="new-artifact-value" value={effectiveValue} onChange={(event) => setValue(event.target.value)}>
                      {sourceOption.columns.map((column) => (
                        <option key={column} value={column}>
                          {column}{sourceOption.numericColumns.includes(column) ? " · numeric" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor="new-artifact-mark">
                    <span>Mark</span>
                    <select id="new-artifact-mark" value={mark} onChange={(event) => setMark(event.target.value as ChartCreationMark)}>
                      <option value="bar">Bar · compare</option>
                      <option value="line">Line · sequence</option>
                    </select>
                  </label>
                  <label htmlFor="new-artifact-format">
                    <span>Number format</span>
                    <select id="new-artifact-format" value={format} onChange={(event) => setFormat(event.target.value as ChartCreationFormat)}>
                      <option value="number">Number</option>
                      <option value="currency">Currency · USD</option>
                      <option value="percent">Percent</option>
                    </select>
                  </label>
                  <label className="wide" htmlFor="new-artifact-embed">
                    <span>Embed in · optional</span>
                    <select id="new-artifact-embed" value={embedArtifactId} onChange={(event) => setEmbedArtifactId(event.target.value)}>
                      <option value="">Create reusable Chart only</option>
                      {embeddingTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name} · {target.kind === "document" ? "Document" : "Presentation"}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
            <small>{kind === "query"
              ? "Rune writes an explicit -- rune:data directive, so workspace_data never changes when files are reordered."
              : "The Chart JSON stores the exact source id and field names; reports and decks can reuse it with one chart binding."}</small>
          </fieldset>
        )}

        {formError && <div className="import-review-error" role="alert">{formError}</div>}

        {prepared.artifact && (
          <section className="new-artifact-preview" aria-label="New source preview">
            <header>
              <span className={`artifact-icon ${prepared.artifact.kind}`}><TypeIcon kind={kind} /></span>
              <div><strong>{prepared.artifact.name}</strong><small>{prepared.artifact.language} · ready to edit</small></div>
            </header>
            <pre><code>{prepared.artifact.source}</code></pre>
          </section>
        )}
      </div>
    </ReviewDialog>
  );
}
