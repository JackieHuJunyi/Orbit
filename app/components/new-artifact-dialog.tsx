"use client";

import {
  Check,
  FilePlus2,
  FileText,
  Presentation,
  ShieldCheck,
  TableProperties,
} from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import {
  MAX_ARTIFACT_TITLE_CHARS,
  creatableArtifactTypes,
  prepareArtifactCreation,
  type ArtifactCreationInput,
  type CreatableArtifactKind,
} from "../lib/artifact-creation";
import type { WorkspaceArtifact } from "../lib/workspace";
import { ReviewDialog } from "./review-dialog";

function TypeIcon({ kind }: { kind: CreatableArtifactKind }) {
  if (kind === "document") return <FileText aria-hidden="true" />;
  if (kind === "data") return <TableProperties aria-hidden="true" />;
  return <Presentation aria-hidden="true" />;
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
  onCreate: (input: ArtifactCreationInput) => void;
}) {
  const [kind, setKind] = useState<CreatableArtifactKind>("document");
  const [title, setTitle] = useState("");
  const prepared = useMemo(
    () => prepareArtifactCreation(artifacts, { kind, title }),
    [artifacts, kind, title],
  );
  const titleError = title ? prepared.errors[0] : "";

  function create() {
    if (!prepared.artifact) return;
    onCreate({ kind, title });
  }

  function onTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    create();
  }

  return (
    <ReviewDialog
      dialogId="new-artifact"
      kicker={<><FilePlus2 aria-hidden="true" /> Start from readable source</>}
      title="Create a new artifact"
      description="Choose a canonical Office-native format. Rune creates a valid local source and opens it immediately."
      detailsLabel="New artifact details"
      onCancel={onCancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> One atomic device write · no upload</div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>Cancel</button>
            <button className="button primary-button" onClick={create} disabled={!prepared.artifact}><Check aria-hidden="true" /> Create source</button>
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
            placeholder={kind === "document" ? "Project brief" : kind === "data" ? "Operating metrics" : "Board narrative"}
            maxLength={MAX_ARTIFACT_TITLE_CHARS + 1}
            aria-describedby="new-artifact-title-help"
            aria-invalid={Boolean(titleError)}
          />
          <small id="new-artifact-title-help">Rune derives a portable filename and stable workspace id. You can edit the source immediately.</small>
        </label>

        {(titleError || error) && <div className="import-review-error" role="alert">{error || titleError}</div>}

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
