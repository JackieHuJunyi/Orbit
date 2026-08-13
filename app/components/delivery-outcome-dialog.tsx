"use client";

import { BadgeCheck, Check, CircleX, PencilLine, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { OperatingReviewDeliveryRating } from "../lib/delivery-outcomes";
import { localizeRuneCopy, type RuneLocale } from "../lib/localization";
import { ReviewDialog } from "./review-dialog";

export const DELIVERY_OUTCOME_BASE_COPY = {
  "zh-CN": {
    kicker: "交付确认 · 设备本地",
    title: "这份成品是否已经能用于真实工作？",
    description: "下载或写回成功不等于结果可用。请选择最接近实际情况的一项，帮助 Rune 区分技术成功与真实交付。",
    details: "成品交付结果",
    task: "任务",
    deliverable: "成品",
    handoff: "交付方式",
    readyTitle: "可以直接交付",
    readyBody: "数字、结构和表达已经满足本次工作。",
    minorTitle: "少量修改后可交付",
    minorBody: "方向正确，只需要有限的人工调整。",
    notReadyTitle: "目前不能交付",
    notReadyBody: "结果仍有关键错误、遗漏或明显返工。",
    privacy: "只在本机记录判断、格式、耗时与来源版本指纹；不保存正文或提示词。",
    later: "稍后再说",
    confirming: "正在记录…",
    confirm: "确认结果",
  },
  en: {
    kicker: "Delivery confirmation · on device",
    title: "Did this result become usable in real work?",
    description: "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.",
    details: "Deliverable outcome",
    task: "Task",
    deliverable: "Deliverable",
    handoff: "Handoff",
    readyTitle: "Ready to deliver",
    readyBody: "The numbers, structure, and language meet this task.",
    minorTitle: "Deliverable after minor edits",
    minorBody: "The direction is right and only limited manual changes remain.",
    notReadyTitle: "Not ready to deliver",
    notReadyBody: "A material error, omission, or rework still blocks delivery.",
    privacy: "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.",
    later: "Decide later",
    confirming: "Recording…",
    confirm: "Confirm outcome",
  },
} as const;

export function DeliveryOutcomeDialog({
  workflowTitle,
  artifactName,
  handoffLabel,
  locale,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  workflowTitle: string;
  artifactName: string;
  handoffLabel: string;
  locale: RuneLocale;
  submitting?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (rating: OperatingReviewDeliveryRating) => void | Promise<void>;
}) {
  const copy = localizeRuneCopy(locale, DELIVERY_OUTCOME_BASE_COPY.en, DELIVERY_OUTCOME_BASE_COPY["zh-CN"]);
  const [rating, setRating] = useState<OperatingReviewDeliveryRating | null>(null);
  const options = [
    { id: "ready" as const, title: copy.readyTitle, body: copy.readyBody, icon: BadgeCheck },
    { id: "minor-edits" as const, title: copy.minorTitle, body: copy.minorBody, icon: PencilLine },
    { id: "not-ready" as const, title: copy.notReadyTitle, body: copy.notReadyBody, icon: CircleX },
  ];

  return (
    <ReviewDialog
      dialogId="delivery-outcome"
      dialogClassName="delivery-outcome-dialog"
      kicker={<><ShieldCheck aria-hidden="true" /> {copy.kicker}</>}
      title={copy.title}
      description={copy.description}
      detailsLabel={copy.details}
      locale={locale}
      onCancel={onCancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> {copy.privacy}</div>
          <span>
            <button className="button ghost-button" type="button" disabled={submitting} onClick={onCancel}>{copy.later}</button>
            <button className="button primary-button" type="button" disabled={!rating || submitting} onClick={() => rating && void onConfirm(rating)}>
              <Check aria-hidden="true" /> {submitting ? copy.confirming : copy.confirm}
            </button>
          </span>
        </>
      )}
    >
      <dl className="delivery-outcome-context">
        <div><dt>{copy.task}</dt><dd>{workflowTitle}</dd></div>
        <div><dt>{copy.deliverable}</dt><dd>{artifactName}</dd></div>
        <div><dt>{copy.handoff}</dt><dd>{handoffLabel}</dd></div>
      </dl>
      <fieldset className="delivery-outcome-options">
        <legend className="visually-hidden">{copy.details}</legend>
        {options.map((option, index) => {
          const Icon = option.icon;
          return (
            <label className={rating === option.id ? "selected" : ""} key={option.id}>
              <input
                data-dialog-initial-focus={index === 0 ? "true" : undefined}
                type="radio"
                name="delivery-outcome-rating"
                value={option.id}
                checked={rating === option.id}
                disabled={submitting}
                onChange={() => setRating(option.id)}
              />
              <Icon aria-hidden="true" />
              <span><strong>{option.title}</strong><small>{option.body}</small></span>
            </label>
          );
        })}
      </fieldset>
      {error && <div className="import-review-error" role="alert">{error}</div>}
    </ReviewDialog>
  );
}
