"use client";

import {
  Check,
  FileText,
  LoaderCircle,
  Presentation,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  MAX_DOCUMENT_BRIEFING_FOCUS_CHARS,
  MAX_DOCUMENT_BRIEFING_TITLE_CHARS,
  documentBriefingTargets,
  prepareDocumentBriefingWorkflow,
  type DocumentBriefingInput,
  type DocumentBriefingSlideCount,
} from "../lib/document-briefing";
import { localizeRuneCopy, type RuneLocale } from "../lib/localization";
import type { WorkspaceArtifact } from "../lib/workspace";
import { ReviewDialog } from "./review-dialog";

type DocumentBriefingDialogProps = {
  artifacts: WorkspaceArtifact[];
  locale: RuneLocale;
  error?: string;
  preferredDocumentArtifactId?: string;
  preferredPresentationArtifactId?: string;
  onCancel: () => void;
  onPrepare: (input: DocumentBriefingInput) => void | Promise<void>;
};

export const DOCUMENT_BRIEFING_BASE_COPY = {
  "zh-CN": {
    kicker: "文档到演示 · 来源相连",
    title: "创建或刷新一份轻盈的演示",
    description: "选择已审核的文档、受众和重点。Rune 可以创建新演示，也可以刷新一份已关联的演示，同时保留原文件身份与来源关系。",
    details: "文档演示任务设置",
    presentationTitle: "演示标题",
    titlePlaceholder: "例如：产品发布简报",
    source: "文档来源",
    noSource: "工作区中没有可用的 Document",
    destination: "演示去向",
    newPresentation: "创建一份新演示",
    refreshPresentation: "原位刷新已关联演示",
    audience: "受众",
    leadership: "管理层",
    team: "团队",
    customer: "客户",
    slideCount: "演示长度",
    slides: "页",
    focus: "这次演示要推动什么",
    focusPlaceholder: "说明受众需要理解的问题，以及演示结束后要做出的判断。",
    summary: "实时任务摘要",
    sourceIdentity: "来源身份",
    output: "可编辑成品",
    export: "现有导出",
    freshness: "来源新鲜度",
    current: "已是当前版本",
    changed: "来源已变化 · 可以刷新",
    unknown: "尚未记录基准版本",
    newBaseline: "将记录当前来源版本",
    newOutputValue: "新的 Deck Markdown",
    refreshOutputValue: "原位更新并保留文件身份",
    exportValue: "HTML · PPTX · ODP · PDF",
    cancel: "取消",
    preparing: "正在验证来源…",
    prepare: "准备审核",
    footer: "本地确定性编译 · 审核后写入",
    localErrors: "请先检查以下设置：",
  },
  en: {
    kicker: "Document to presentation · source linked",
    title: "Create or refresh a light presentation",
    description: "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.",
    details: "Document-presentation task settings",
    presentationTitle: "Presentation title",
    titlePlaceholder: "For example: Product launch briefing",
    source: "Document source",
    noSource: "No usable Document in this workspace",
    destination: "Presentation destination",
    newPresentation: "Create a new presentation",
    refreshPresentation: "Refresh linked presentation in place",
    audience: "Audience",
    leadership: "Leadership",
    team: "Team",
    customer: "Customer",
    slideCount: "Presentation length",
    slides: "slides",
    focus: "What should this presentation move forward?",
    focusPlaceholder: "State what the audience needs to understand and the decision the presentation should support.",
    summary: "Live task summary",
    sourceIdentity: "Source identity",
    output: "Editable output",
    export: "Existing exports",
    freshness: "Source freshness",
    current: "Current",
    changed: "Source changed · refresh available",
    unknown: "Baseline not recorded",
    newBaseline: "Current source revision will be recorded",
    newOutputValue: "New Deck Markdown",
    refreshOutputValue: "Update in place · identity preserved",
    exportValue: "HTML · PPTX · ODP · PDF",
    cancel: "Cancel",
    preparing: "Verifying source…",
    prepare: "Prepare review",
    footer: "Deterministic local compile · review before write",
    localErrors: "Check these settings first:",
  },
} as const;

function documentBriefingCopy(locale: RuneLocale) {
  return localizeRuneCopy(locale, DOCUMENT_BRIEFING_BASE_COPY.en, DOCUMENT_BRIEFING_BASE_COPY["zh-CN"]);
}

function freshnessLabel(
  copy: ReturnType<typeof documentBriefingCopy>,
  freshness: "current" | "changed" | "unknown",
) {
  return freshness === "changed" ? copy.changed : freshness === "current" ? copy.current : copy.unknown;
}

export function DocumentBriefingDialog({
  artifacts,
  locale,
  error,
  preferredDocumentArtifactId,
  preferredPresentationArtifactId,
  onCancel,
  onPrepare,
}: DocumentBriefingDialogProps) {
  const copy = documentBriefingCopy(locale);
  const sourceOptions = useMemo(() => artifacts.filter((artifact) => artifact.kind === "document"), [artifacts]);
  const initialSourceArtifactId = preferredDocumentArtifactId ?? sourceOptions[0]?.id ?? "";
  const initialTarget = documentBriefingTargets(artifacts, initialSourceArtifactId)
    .find((target) => target.artifactId === preferredPresentationArtifactId);
  const [sourceArtifactId, setSourceArtifactId] = useState(initialSourceArtifactId);
  const [targetArtifactId, setTargetArtifactId] = useState(initialTarget?.artifactId ?? "");
  const [title, setTitle] = useState(initialTarget?.title ?? "");
  const [audience, setAudience] = useState<DocumentBriefingInput["audience"]>(initialTarget?.audience ?? "leadership");
  const [slideCount, setSlideCount] = useState<DocumentBriefingSlideCount>(
    initialTarget && [4, 6, 8].includes(initialTarget.slideCount)
      ? initialTarget.slideCount as DocumentBriefingSlideCount
      : 6,
  );
  const [focus, setFocus] = useState(initialTarget?.purpose ?? "");
  const [attempted, setAttempted] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const source = sourceOptions.find((artifact) => artifact.id === sourceArtifactId) ?? sourceOptions[0];
  const targetOptions = useMemo(
    () => documentBriefingTargets(artifacts, source?.id ?? ""),
    [artifacts, source?.id],
  );
  const target = targetOptions.find((option) => option.artifactId === targetArtifactId);
  const input = useMemo<DocumentBriefingInput>(() => ({
    sourceArtifactId: source?.id ?? "",
    ...(target ? { targetArtifactId: target.artifactId } : {}),
    title,
    audience,
    focus,
    slideCount,
    locale: target?.locale ?? locale,
  }), [audience, focus, locale, slideCount, source?.id, target, title]);
  const prepared = useMemo(() => prepareDocumentBriefingWorkflow(artifacts, input), [artifacts, input]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (!prepared.plan || preparing) return;
    setPreparing(true);
    try {
      await onPrepare(input);
    } finally {
      setPreparing(false);
    }
  }

  const cancel = () => { if (!preparing) onCancel(); };

  return (
    <ReviewDialog
      dialogId="document-briefing"
      kicker={<><Presentation aria-hidden="true" /> {copy.kicker}</>}
      title={copy.title}
      description={copy.description}
      detailsLabel={copy.details}
      locale={locale}
      onCancel={cancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> {copy.footer}</div>
          <span>
            <button className="button ghost-button" type="button" onClick={cancel} disabled={preparing}>{copy.cancel}</button>
            <button className="button primary-button" type="submit" form="document-briefing-form" disabled={preparing || !sourceOptions.length}>
              {preparing ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {preparing ? copy.preparing : copy.prepare}
            </button>
          </span>
        </>
      )}
    >
      <form id="document-briefing-form" className="operating-review-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="operating-review-grid">
          <label className="operating-review-field wide" htmlFor="document-briefing-title">
            <span>{copy.presentationTitle}</span>
            <input
              id="document-briefing-title"
              data-dialog-initial-focus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={copy.titlePlaceholder}
              maxLength={MAX_DOCUMENT_BRIEFING_TITLE_CHARS}
              required
              aria-invalid={attempted && !title.trim()}
            />
          </label>

          <label className="operating-review-field wide" htmlFor="document-briefing-source">
            <span>{copy.source}</span>
            <select id="document-briefing-source" value={source?.id ?? ""} onChange={(event) => {
              setSourceArtifactId(event.target.value);
              setTargetArtifactId("");
              if (target) {
                setTitle("");
                setAudience("leadership");
                setSlideCount(6);
                setFocus("");
              }
            }} disabled={!sourceOptions.length} required>
              {!sourceOptions.length && <option value="">{copy.noSource}</option>}
              {sourceOptions.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.name} · Document</option>)}
            </select>
          </label>

          <label className="operating-review-field wide" htmlFor="document-briefing-target">
            <span>{copy.destination}</span>
            <select id="document-briefing-target" value={target?.artifactId ?? ""} onChange={(event) => {
              const nextTarget = targetOptions.find((option) => option.artifactId === event.target.value);
              setTargetArtifactId(nextTarget?.artifactId ?? "");
              if (nextTarget) {
                setTitle(nextTarget.title);
                setAudience(nextTarget.audience ?? "leadership");
                setFocus(nextTarget.purpose ?? "");
                if ([4, 6, 8].includes(nextTarget.slideCount)) {
                  setSlideCount(nextTarget.slideCount as DocumentBriefingSlideCount);
                }
              } else {
                setTitle("");
                setAudience("leadership");
                setSlideCount(6);
                setFocus("");
              }
            }}>
              <option value="">{copy.newPresentation}</option>
              {targetOptions.map((option) => <option key={option.artifactId} value={option.artifactId}>{copy.refreshPresentation} · {option.name} · {freshnessLabel(copy, option.freshness)}</option>)}
            </select>
          </label>

          <label className="operating-review-field" htmlFor="document-briefing-audience">
            <span>{copy.audience}</span>
            <select id="document-briefing-audience" value={audience} onChange={(event) => setAudience(event.target.value as DocumentBriefingInput["audience"])}>
              <option value="leadership">{copy.leadership}</option>
              <option value="team">{copy.team}</option>
              <option value="customer">{copy.customer}</option>
            </select>
          </label>

          <fieldset className="operating-review-field">
            <legend>{copy.slideCount}</legend>
            <div className="operating-review-options">
              {([4, 6, 8] as const).map((count) => (
                <label key={count}>
                  <input type="radio" name="document-briefing-slide-count" value={count} checked={slideCount === count} onChange={() => setSlideCount(count)} />
                  <span>{count} {copy.slides}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="operating-review-field wide" htmlFor="document-briefing-focus">
            <span>{copy.focus}</span>
            <textarea
              id="document-briefing-focus"
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder={copy.focusPlaceholder}
              maxLength={MAX_DOCUMENT_BRIEFING_FOCUS_CHARS}
              rows={3}
              required
              aria-invalid={attempted && !focus.trim()}
            />
          </label>
        </div>

        <section className="operating-review-summary" aria-labelledby="document-briefing-summary-title" aria-live="polite">
          <header>
            <FileText aria-hidden="true" />
            <div><span>{copy.summary}</span><strong id="document-briefing-summary-title">{title.trim() || copy.titlePlaceholder}</strong></div>
          </header>
          <p>{source ? `${source.name} → ${slideCount} ${copy.slides} → ${target?.name ?? copy.newOutputValue}` : copy.noSource}</p>
          <dl>
            <div><dt>{copy.sourceIdentity}</dt><dd>{source?.id ?? "—"}</dd></div>
            <div><dt>{copy.audience}</dt><dd>{audience === "customer" ? copy.customer : audience === "team" ? copy.team : copy.leadership}</dd></div>
            <div><dt>{copy.freshness}</dt><dd><span className={`briefing-freshness ${target?.freshness ?? "new"}`}>{target ? freshnessLabel(copy, target.freshness) : copy.newBaseline}</span></dd></div>
            <div><dt>{copy.output}</dt><dd>{target ? copy.refreshOutputValue : copy.newOutputValue}</dd></div>
            <div><dt>{copy.export}</dt><dd>{copy.exportValue}</dd></div>
          </dl>
        </section>

        {error && <div className="import-review-error" role="alert">{error}</div>}
        {attempted && prepared.errors.length > 0 && (
          <div className="import-review-error" role="alert">
            <strong>{copy.localErrors}</strong>
            <ul>{prepared.errors.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}
      </form>
    </ReviewDialog>
  );
}
