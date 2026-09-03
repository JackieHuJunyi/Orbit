"use client";

import { Check, FileJson2, ListChecks, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { OrbitPilotEvidenceExport } from "../lib/pilot-evidence";
import { localizeOrbitCopy, orbitUICopy, type OrbitLocale } from "../lib/localization";
import { PILOT_EVIDENCE_NOTICE_BASE_COPY } from "../lib/workbench-surface-copy";
import { ReviewDialog } from "./review-dialog";

export const PILOT_EVIDENCE_BASE_COPY = {
  "zh-CN": {
    ...PILOT_EVIDENCE_NOTICE_BASE_COPY["zh-CN"],
    kicker: "Pilot Evidence · 设备本地",
    title: "审阅即将导出的试点证据",
    description:
      "Orbit 已把本机任务记录整理成匿名 JSON。它可用于汇总真实试点结果，但不会上传，也不代表已经完成产品市场验证。",
    details: "Pilot Evidence 导出内容",
    taskRuns: "任务运行",
    deliveryOutcomes: "交付结果",
    reviewedTasks: "已人工评估的真实任务",
    packageSize: "文件大小",
    includedTitle: "这份文件包含",
    included: [
      "任务类型、成功或停止状态、耗时和有限的影响数量",
      "本地或已配置模型，以及可用时的输入/输出令牌数",
      "交付格式、可用性判断和完整的已授权/脱敏七维评分",
      "匿名的 run-001 / output-01 编号与仅精确到日期的时间",
    ],
    excludedTitle: "始终排除",
    excluded: [
      "文档或数据正文、提示词、模型响应与 Query 结果",
      "文件名、Artifact ID、工作区路径与用户身份",
      "API 密钥、模型供应商名称、来源版本和交付指纹",
      "Golden Task 等合成测试结果，以及任何网络上传",
    ],
    evidenceWarning:
      "这是设备本地的候选人工结果证据。只有完整、已授权或已脱敏的评分才计入真实任务数量；它不能单独证明 PMF 或达到试点门槛。",
    reviewConfirmation: "我已审阅导出范围，并理解这是一份候选证据文件，而不是 PMF 证明。",
    privacy: "确认后只下载到本机；Orbit 不会上传或发送此文件。",
    cancel: "取消",
    download: "下载匿名 JSON",
  },
  en: {
    ...PILOT_EVIDENCE_NOTICE_BASE_COPY.en,
    kicker: "Pilot Evidence · on device",
    title: "Review the pilot evidence export",
    description:
      "Orbit has compiled this device's task records into anonymous JSON. It can support real-pilot aggregation, but is never uploaded and does not claim product-market validation.",
    details: "Pilot Evidence export contents",
    taskRuns: "Task runs",
    deliveryOutcomes: "Delivery outcomes",
    reviewedTasks: "Human-reviewed real tasks",
    packageSize: "File size",
    includedTitle: "This file includes",
    included: [
      "Task type, applied or stopped status, elapsed time, and bounded impact counts",
      "Local or configured-model planning plus input/output token counts when available",
      "Delivery format, usability judgment, and complete authorized/redacted seven-dimension ratings",
      "Anonymous run-001 / output-01 labels and dates without exact timestamps",
    ],
    excludedTitle: "Always excluded",
    excluded: [
      "Document or data content, prompts, model responses, and Query rows",
      "File names, Artifact IDs, workspace paths, and user identity",
      "API keys, model provider names, source revisions, and delivery fingerprints",
      "Synthetic Golden Task results and every form of network upload",
    ],
    evidenceWarning:
      "This is device-local candidate human-outcome evidence. Only complete, authorized or redacted ratings count as reviewed real tasks; the file alone cannot prove PMF or a completed pilot threshold.",
    reviewConfirmation:
      "I reviewed the export scope and understand this is a candidate evidence file, not proof of PMF.",
    privacy: "Confirming only downloads to this device; Orbit does not upload or send the file.",
    cancel: "Cancel",
    download: "Download anonymous JSON",
  },
} as const;

export function pilotEvidenceCopy(locale: OrbitLocale) {
  return localizeOrbitCopy(locale, PILOT_EVIDENCE_BASE_COPY.en, PILOT_EVIDENCE_BASE_COPY["zh-CN"]);
}

function readableBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  return `${(bytes / 1_024).toFixed(1)} KB`;
}

export function PilotEvidenceReviewDialog({
  result,
  locale,
  error,
  onCancel,
  onConfirm,
}: {
  result: OrbitPilotEvidenceExport;
  locale: OrbitLocale;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = pilotEvidenceCopy(locale);
  const ui = orbitUICopy(locale);
  const [reviewed, setReviewed] = useState(false);
  const { summary } = result.package;
  const metrics = [
    [copy.taskRuns, summary.runs.total],
    [copy.deliveryOutcomes, summary.deliveries.total],
    [copy.reviewedTasks, summary.deliveries.reviewedRealTasks],
    [copy.packageSize, readableBytes(result.bytes.byteLength)],
  ] as const;

  return (
    <ReviewDialog
      dialogId="pilot-evidence-review"
      dialogClassName="pilot-evidence-dialog"
      kicker={
        <>
          <ShieldCheck aria-hidden="true" /> {copy.kicker}
        </>
      }
      title={copy.title}
      description={copy.description}
      detailsLabel={copy.details}
      locale={locale}
      onCancel={onCancel}
      footer={
        <>
          <div>
            <ShieldCheck aria-hidden="true" /> {copy.privacy}
          </div>
          <span>
            <button className="button ghost-button" type="button" onClick={onCancel}>
              {copy.cancel}
            </button>
            <button className="button primary-button" type="button" disabled={!reviewed} onClick={onConfirm}>
              <Check aria-hidden="true" /> {copy.download}
            </button>
          </span>
        </>
      }
    >
      <div className="pilot-evidence-file">
        <FileJson2 aria-hidden="true" />
        <span>
          <strong>{result.fileName}</strong>
          <small>JSON · {readableBytes(result.bytes.byteLength)} · device-local</small>
        </span>
        <span>{ui.common.ready}</span>
      </div>
      <dl className="pilot-evidence-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="pilot-evidence-scope">
        <section>
          <h3>
            <ListChecks aria-hidden="true" /> {copy.includedTitle}
          </h3>
          <ul>
            {copy.included.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>
            <ShieldCheck aria-hidden="true" /> {copy.excludedTitle}
          </h3>
          <ul>
            {copy.excluded.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
      <p className="pilot-evidence-warning">
        <TriangleAlert aria-hidden="true" /> <span>{copy.evidenceWarning}</span>
      </p>
      {error && (
        <div className="import-review-error" role="alert">
          {error}
        </div>
      )}
      <label className="pilot-evidence-confirmation">
        <input
          data-dialog-initial-focus="true"
          type="checkbox"
          checked={reviewed}
          onChange={(event) => setReviewed(event.target.checked)}
        />
        <span>{copy.reviewConfirmation}</span>
      </label>
    </ReviewDialog>
  );
}
