"use client";

import { BadgeCheck, Check, ChevronDown, CircleX, ListChecks, PencilLine, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  RUNE_TASK_RUBRIC_DIMENSIONS,
  type RuneTaskDeliveryConfirmation,
  type RuneTaskDeliveryRating,
  type RuneTaskOutcomeRubric,
  type RuneTaskRubricScore,
} from "../lib/task-evidence";
import { localizeRuneCopy, type RuneLocale } from "../lib/localization";
import { ReviewDialog } from "./review-dialog";

export const DELIVERY_OUTCOME_BASE_COPY = {
  "zh-CN": {
    kicker: "交付确认 · 设备本地",
    title: "这份成品是否已经能用于真实工作？",
    description: "下载或写回成功不等于结果可用。请选择最接近实际情况的一项，帮助 Orbit 区分技术成功与真实交付。",
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
    addEvaluation: "添加详细的真实任务评估",
    evaluationBody: "可选 · 七个维度 · 约一分钟",
    evaluationTitle: "真实任务评估",
    evaluationDescription:
      "只有完整评分并确认内容已获授权或脱敏后，才会计入真实任务样本。每项 1 分表示需要改进，5 分表示表现优秀。",
    numberGate: "数字正确性低于 4 分会始终单独标记，不会被平均分掩盖。",
    authorization: "我确认此任务已获准用于评估，或内容已经脱敏。",
    rubric: {
      numberCorrectness: ["数字正确性", "数值、口径与计算准确。"],
      evidenceCompleteness: ["证据完整性", "结论能追溯到充分的依据。"],
      conclusionUsefulness: ["结论可用性", "洞察能支持下一步决策。"],
      structureClarity: ["结构清晰度", "信息层级清楚且易于浏览。"],
      visualDeliverability: ["视觉可交付性", "版式无需明显返工即可使用。"],
      changeComprehensibility: ["改动可理解性", "用户能理解 Orbit 改了什么以及为什么。"],
      timeSaved: ["整体节省时间", "相较手工完成明显节省时间。"],
    },
  },
  en: {
    kicker: "Delivery confirmation · on device",
    title: "Did this result become usable in real work?",
    description:
      "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Orbit can separate technical success from a real deliverable.",
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
    privacy:
      "Orbit stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.",
    later: "Decide later",
    confirming: "Recording…",
    confirm: "Confirm outcome",
    addEvaluation: "Add a detailed real-task evaluation",
    evaluationBody: "Optional · seven dimensions · about one minute",
    evaluationTitle: "Real-task evaluation",
    evaluationDescription:
      "A sample counts only when every score is complete and the content is confirmed as authorized or redacted. A score of 1 needs work; 5 is excellent.",
    numberGate: "Number correctness below 4 always remains a visible blocker and is never hidden inside an average.",
    authorization: "I confirm this task is authorized for evaluation or its content is redacted.",
    rubric: {
      numberCorrectness: ["Number correctness", "Values, definitions, and calculations are accurate."],
      evidenceCompleteness: ["Evidence completeness", "Conclusions trace to sufficient supporting evidence."],
      conclusionUsefulness: ["Conclusion usefulness", "Insights support a useful next decision."],
      structureClarity: ["Structure clarity", "Information hierarchy is clear and easy to scan."],
      visualDeliverability: ["Visual deliverability", "The layout is usable without material rework."],
      changeComprehensibility: ["Change comprehensibility", "The user can understand what Orbit changed and why."],
      timeSaved: ["Overall time saved", "The result saves meaningful time over manual work."],
    },
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
  onConfirm: (confirmation: RuneTaskDeliveryConfirmation) => void | Promise<void>;
}) {
  const copy = localizeRuneCopy(locale, DELIVERY_OUTCOME_BASE_COPY.en, DELIVERY_OUTCOME_BASE_COPY["zh-CN"]);
  const [rating, setRating] = useState<RuneTaskDeliveryRating | null>(null);
  const [detailed, setDetailed] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [rubric, setRubric] = useState<Partial<RuneTaskOutcomeRubric>>({});
  const evaluationComplete = RUNE_TASK_RUBRIC_DIMENSIONS.every((dimension) => rubric[dimension] != null);
  const canConfirm = Boolean(rating) && (!detailed || (authorized && evaluationComplete));
  const options = [
    { id: "ready" as const, title: copy.readyTitle, body: copy.readyBody, icon: BadgeCheck },
    { id: "minor-edits" as const, title: copy.minorTitle, body: copy.minorBody, icon: PencilLine },
    { id: "not-ready" as const, title: copy.notReadyTitle, body: copy.notReadyBody, icon: CircleX },
  ];

  return (
    <ReviewDialog
      dialogId="delivery-outcome"
      dialogClassName="delivery-outcome-dialog"
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
            <button className="button ghost-button" type="button" disabled={submitting} onClick={onCancel}>
              {copy.later}
            </button>
            <button
              className="button primary-button"
              type="button"
              disabled={!canConfirm || submitting}
              onClick={() => {
                if (!rating || !canConfirm) return;
                if (!detailed) void onConfirm({ rating });
                else
                  void onConfirm({
                    rating,
                    evaluation: {
                      version: 1,
                      provenance: "authorized-or-redacted",
                      rubric: rubric as RuneTaskOutcomeRubric,
                    },
                  });
              }}
            >
              <Check aria-hidden="true" /> {submitting ? copy.confirming : copy.confirm}
            </button>
          </span>
        </>
      }
    >
      <dl className="delivery-outcome-context">
        <div>
          <dt>{copy.task}</dt>
          <dd>{workflowTitle}</dd>
        </div>
        <div>
          <dt>{copy.deliverable}</dt>
          <dd>{artifactName}</dd>
        </div>
        <div>
          <dt>{copy.handoff}</dt>
          <dd>{handoffLabel}</dd>
        </div>
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
              <span>
                <strong>{option.title}</strong>
                <small>{option.body}</small>
              </span>
            </label>
          );
        })}
      </fieldset>
      <button
        className={`delivery-detail-toggle ${detailed ? "open" : ""}`}
        type="button"
        aria-expanded={detailed}
        aria-controls="delivery-detailed-evaluation"
        disabled={submitting}
        onClick={() => setDetailed((current) => !current)}
      >
        <ListChecks aria-hidden="true" />
        <span>
          <strong>{copy.addEvaluation}</strong>
          <small>{copy.evaluationBody}</small>
        </span>
        <ChevronDown aria-hidden="true" />
      </button>
      {detailed && (
        <section
          className="delivery-evaluation"
          id="delivery-detailed-evaluation"
          aria-labelledby="delivery-evaluation-title"
        >
          <header>
            <h3 id="delivery-evaluation-title">{copy.evaluationTitle}</h3>
            <p>{copy.evaluationDescription}</p>
          </header>
          <div className="delivery-rubric">
            {RUNE_TASK_RUBRIC_DIMENSIONS.map((dimension) => {
              const [title, description] = copy.rubric[dimension];
              return (
                <div
                  className="delivery-rubric-row"
                  role="group"
                  aria-labelledby={`delivery-rubric-${dimension}`}
                  key={dimension}
                >
                  <span className="delivery-rubric-copy" id={`delivery-rubric-${dimension}`}>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="delivery-score-options">
                    {([1, 2, 3, 4, 5] as const).map((score) => (
                      <label className={rubric[dimension] === score ? "selected" : ""} key={score}>
                        <input
                          type="radio"
                          name={`delivery-rubric-${dimension}`}
                          value={score}
                          checked={rubric[dimension] === score}
                          disabled={submitting}
                          aria-label={`${title} ${score} / 5`}
                          onChange={() =>
                            setRubric((current) => ({ ...current, [dimension]: score as RuneTaskRubricScore }))
                          }
                        />
                        <span aria-hidden="true">{score}</span>
                      </label>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="delivery-number-gate">
            <ShieldCheck aria-hidden="true" /> {copy.numberGate}
          </p>
          <label className="delivery-authorization">
            <input
              type="checkbox"
              checked={authorized}
              disabled={submitting}
              onChange={(event) => setAuthorized(event.currentTarget.checked)}
            />
            <span>{copy.authorization}</span>
          </label>
        </section>
      )}
      {error && (
        <div className="import-review-error" role="alert">
          {error}
        </div>
      )}
    </ReviewDialog>
  );
}
