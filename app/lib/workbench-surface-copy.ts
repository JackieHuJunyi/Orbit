import { localizeRuneCopy, type RuneLocale } from "./localization";

export const OPERATING_REVIEW_NOTICE_BASE_COPY = {
  "zh-CN": {
    modelShaping: "模型正在根据有界聚合证据准备审核问题…",
    modelPrepared: "已准备模型辅助、数字保持实时绑定的经营汇报；审核后才会写入",
    localPrepared: "已准备本地确定性经营汇报；审核后才会写入",
    localFallback: "模型当前不可用，已准备本地确定性经营汇报；审核后才会写入",
    sourceTooLargeFallback: "数据超过模型上下文安全上限，已准备本地确定性经营汇报；审核后才会写入",
  },
  en: {
    modelShaping: "The model is preparing review questions from bounded aggregate evidence…",
    modelPrepared: "Model-assisted operating review prepared with live-bound numbers; nothing writes until review",
    localPrepared: "Deterministic local operating review prepared; nothing writes until review",
    localFallback: "Model unavailable; deterministic local operating review prepared for review",
    sourceTooLargeFallback:
      "Data exceeds the model context safety limit; deterministic local operating review prepared for review",
  },
} as const;

export const DOCUMENT_BRIEFING_NOTICE_BASE_COPY = {
  "zh-CN": {
    modelShaping: "模型正在根据有界来源证据编排演示…",
    modelPrepared: "已准备模型辅助、保留来源关系的演示；审核后才会写入",
    localPrepared: "已准备本地确定性演示；审核后才会写入",
    localFallback: "模型当前不可用，已准备本地确定性演示；审核后才会写入",
    sourceTooLargeFallback: "文档超过模型上下文安全上限，已准备本地确定性演示；审核后才会写入",
  },
  en: {
    modelShaping: "The model is shaping this presentation from bounded source evidence…",
    modelPrepared: "Model-assisted source-linked presentation prepared; nothing writes until review",
    localPrepared: "Deterministic local presentation prepared; nothing writes until review",
    localFallback: "Model unavailable; deterministic local presentation prepared for review",
    sourceTooLargeFallback:
      "Document exceeds the model context safety limit; deterministic local presentation prepared for review",
  },
} as const;

export const PILOT_EVIDENCE_NOTICE_BASE_COPY = {
  "zh-CN": {
    menuTitle: "导出试点证据",
    menuBody: "匿名 JSON · 审核后下载 · 零上传",
    menuEmpty: "完成一次引导任务后可用",
    reviewNotice: "请在下载到本机前审核匿名任务记录",
    prepareError: "Rune 无法准备试点证据。",
    cancelNotice: "已取消试点证据导出 — 未下载任何文件",
    changedError: "审核期间任务证据已变化。请取消并重新准备导出。",
    changedNotice: "试点证据仍在等待审核 — 本机记录已变化",
    downloadedNotice: "匿名 Pilot Evidence 已下载到本机 · 未执行任何上传",
  },
  en: {
    menuTitle: "Export pilot evidence",
    menuBody: "Anonymous JSON · review first · zero upload",
    menuEmpty: "Available after one guided task",
    reviewNotice: "Review the anonymous task records before local download",
    prepareError: "Rune could not prepare pilot evidence.",
    cancelNotice: "Pilot evidence export cancelled — nothing was downloaded",
    changedError: "Task evidence changed while this file was under review. Cancel and prepare a fresh export.",
    changedNotice: "Pilot evidence held for review — device records changed",
    downloadedNotice: "Anonymous Pilot Evidence downloaded locally · no upload performed",
  },
} as const;

const LOCAL_IMAGE_ACTION_COPY: Record<RuneLocale, { insertLocal: string; insertLocalAtCursor: string }> = {
  en: { insertLocal: "Insert local image", insertLocalAtCursor: "Insert local image at the source cursor" },
  "zh-CN": { insertLocal: "插入本机图片", insertLocalAtCursor: "在源内容光标处插入本机图片" },
  "zh-TW": { insertLocal: "插入本機圖片", insertLocalAtCursor: "在來源內容游標處插入本機圖片" },
  fr: {
    insertLocal: "Insérer une image locale",
    insertLocalAtCursor: "Insérer une image locale au curseur de la source",
  },
  es: {
    insertLocal: "Insertar imagen local",
    insertLocalAtCursor: "Insertar una imagen local en el cursor de la fuente",
  },
  ru: {
    insertLocal: "Вставить локальное изображение",
    insertLocalAtCursor: "Вставить локальное изображение в позицию курсора",
  },
  ar: { insertLocal: "إدراج صورة محلية", insertLocalAtCursor: "إدراج صورة محلية عند مؤشر المصدر" },
  ja: { insertLocal: "ローカル画像を挿入", insertLocalAtCursor: "ソースのカーソル位置にローカル画像を挿入" },
  ko: { insertLocal: "로컬 이미지 삽입", insertLocalAtCursor: "소스 커서 위치에 로컬 이미지 삽입" },
};

const DEFERRED_SURFACE_COPY: Record<RuneLocale, { preparing: string }> = {
  en: { preparing: "Preparing Rune…" },
  "zh-CN": { preparing: "Rune 正在准备…" },
  "zh-TW": { preparing: "Rune 正在準備…" },
  fr: { preparing: "Préparation de Rune…" },
  es: { preparing: "Preparando Rune…" },
  ru: { preparing: "Rune готовится…" },
  ar: { preparing: "جارٍ تجهيز Rune…" },
  ja: { preparing: "Rune を準備しています…" },
  ko: { preparing: "Rune 준비 중…" },
};

export function operatingReviewNoticeCopy(locale: RuneLocale) {
  return localizeRuneCopy(locale, OPERATING_REVIEW_NOTICE_BASE_COPY.en, OPERATING_REVIEW_NOTICE_BASE_COPY["zh-CN"]);
}

export function documentBriefingNoticeCopy(locale: RuneLocale) {
  return localizeRuneCopy(locale, DOCUMENT_BRIEFING_NOTICE_BASE_COPY.en, DOCUMENT_BRIEFING_NOTICE_BASE_COPY["zh-CN"]);
}

export function pilotEvidenceNoticeCopy(locale: RuneLocale) {
  return localizeRuneCopy(locale, PILOT_EVIDENCE_NOTICE_BASE_COPY.en, PILOT_EVIDENCE_NOTICE_BASE_COPY["zh-CN"]);
}

export function localImageActionCopy(locale: RuneLocale) {
  return LOCAL_IMAGE_ACTION_COPY[locale];
}

export function deferredSurfaceCopy(locale: RuneLocale) {
  return DEFERRED_SURFACE_COPY[locale];
}
