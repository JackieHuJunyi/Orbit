"use client";

import { Check, HardDrive, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { PreparedOrbitImageAsset, OrbitImageInsertion } from "../lib/local-assets";
import type { OrbitLocale } from "../lib/localization";
import { localImageActionCopy } from "../lib/workbench-surface-copy";
import { ReviewDialog } from "./review-dialog";

const LOCAL_IMAGE_COPY: Record<
  OrbitLocale,
  {
    kicker: string;
    title: string;
    description: (name: string) => string;
    details: string;
    staysLocal: string;
    cancel: string;
    saving: string;
    insert: string;
    imageDescription: string;
    imageDescriptionAria: string;
    altHint: string;
    sourceAddition: string;
    sourceContract: string;
  }
> = {
  en: {
    kicker: "Device-local asset",
    title: "Review local image",
    description: (name) => `Confirm the image and its readable source reference before updating ${name}.`,
    details: "Image and source change",
    staysLocal: "Image bytes stay on this device",
    cancel: "Cancel",
    saving: "Saving locally…",
    insert: "Insert image",
    imageDescription: "Image description",
    imageDescriptionAria: "Image description for assistive technology",
    altHint: "Used as alternative text and required for accessible content.",
    sourceAddition: "Canonical source addition",
    sourceContract: "Orbit stores a content-hash reference in canonical source, never base64 image data.",
  },
  "zh-CN": {
    kicker: "本机资源",
    title: "审核本机图片",
    description: (name) => `确认图片及其可读源内容引用，再更新 ${name}。`,
    details: "图片与源内容变更",
    staysLocal: "图片字节仅保留在本机",
    cancel: "取消",
    saving: "正在保存到本机…",
    insert: "插入图片",
    imageDescription: "图片说明",
    imageDescriptionAria: "供辅助技术使用的图片说明",
    altHint: "将用作替代文本，是无障碍内容的必需信息。",
    sourceAddition: "规范源内容新增",
    sourceContract: "Orbit 只在规范源内容中保存内容哈希引用，不保存 base64 图片数据。",
  },
  "zh-TW": {
    kicker: "本機資源",
    title: "審閱本機圖片",
    description: (name) => `確認圖片及其可讀來源參照，再更新 ${name}。`,
    details: "圖片與來源內容變更",
    staysLocal: "圖片位元組僅保留在本機",
    cancel: "取消",
    saving: "正在儲存到本機…",
    insert: "插入圖片",
    imageDescription: "圖片說明",
    imageDescriptionAria: "供輔助技術使用的圖片說明",
    altHint: "將用作替代文字，是無障礙內容的必要資訊。",
    sourceAddition: "規範來源內容新增",
    sourceContract: "Orbit 只在規範來源中儲存內容雜湊參照，不儲存 base64 圖片資料。",
  },
  fr: {
    kicker: "Ressource sur l’appareil",
    title: "Vérifier l’image locale",
    description: (name) => `Confirmez l’image et sa référence source lisible avant de mettre à jour ${name}.`,
    details: "Image et modification de la source",
    staysLocal: "Les octets de l’image restent sur cet appareil",
    cancel: "Annuler",
    saving: "Enregistrement local…",
    insert: "Insérer l’image",
    imageDescription: "Description de l’image",
    imageDescriptionAria: "Description de l’image pour les technologies d’assistance",
    altHint: "Utilisée comme texte alternatif, requis pour un contenu accessible.",
    sourceAddition: "Ajout à la source canonique",
    sourceContract:
      "Orbit stocke dans la source canonique une référence par empreinte de contenu, jamais les données de l’image en base64.",
  },
  es: {
    kicker: "Recurso del dispositivo",
    title: "Revisar imagen local",
    description: (name) => `Confirma la imagen y su referencia de fuente legible antes de actualizar ${name}.`,
    details: "Imagen y cambio de fuente",
    staysLocal: "Los bytes de la imagen permanecen en este dispositivo",
    cancel: "Cancelar",
    saving: "Guardando localmente…",
    insert: "Insertar imagen",
    imageDescription: "Descripción de la imagen",
    imageDescriptionAria: "Descripción de la imagen para tecnologías de asistencia",
    altHint: "Se usa como texto alternativo y es obligatorio para contenido accesible.",
    sourceAddition: "Adición a la fuente canónica",
    sourceContract:
      "Orbit guarda en la fuente canónica una referencia por hash de contenido, nunca los datos de imagen en base64.",
  },
  ru: {
    kicker: "Ресурс на устройстве",
    title: "Проверка локального изображения",
    description: (name) => `Подтвердите изображение и читаемую ссылку в исходнике перед обновлением ${name}.`,
    details: "Изображение и изменение исходника",
    staysLocal: "Байты изображения остаются на этом устройстве",
    cancel: "Отмена",
    saving: "Сохранение на устройстве…",
    insert: "Вставить изображение",
    imageDescription: "Описание изображения",
    imageDescriptionAria: "Описание изображения для вспомогательных технологий",
    altHint: "Используется как альтернативный текст и обязательно для доступного содержимого.",
    sourceAddition: "Добавление в канонический исходник",
    sourceContract: "Orbit хранит в каноническом исходнике ссылку по хэшу, а не данные изображения в base64.",
  },
  ar: {
    kicker: "مورد على الجهاز",
    title: "مراجعة الصورة المحلية",
    description: (name) => `أكّد الصورة ومرجع المصدر المقروء قبل تحديث ${name}.`,
    details: "الصورة وتغيير المصدر",
    staysLocal: "تبقى وحدات بايت الصورة على هذا الجهاز",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ محليًا…",
    insert: "إدراج الصورة",
    imageDescription: "وصف الصورة",
    imageDescriptionAria: "وصف الصورة للتقنيات المساعدة",
    altHint: "يُستخدم كنص بديل وهو مطلوب لإتاحة المحتوى.",
    sourceAddition: "إضافة إلى المصدر المعياري",
    sourceContract: "يخزّن Orbit في المصدر المعياري مرجعًا ببصمة المحتوى، ولا يخزّن بيانات الصورة بصيغة base64.",
  },
  ja: {
    kicker: "デバイス内アセット",
    title: "ローカル画像を確認",
    description: (name) => `画像と読み取り可能なソース参照を確認してから ${name} を更新します。`,
    details: "画像とソースの変更",
    staysLocal: "画像データはこのデバイス内に保持",
    cancel: "キャンセル",
    saving: "ローカルに保存中…",
    insert: "画像を挿入",
    imageDescription: "画像の説明",
    imageDescriptionAria: "支援技術向けの画像説明",
    altHint: "代替テキストとして使用され、アクセシブルなコンテンツに必須です。",
    sourceAddition: "正規ソースへの追加",
    sourceContract: "Orbit は正規ソースにコンテンツハッシュ参照だけを保存し、base64 画像データは保存しません。",
  },
  ko: {
    kicker: "기기 내 자산",
    title: "로컬 이미지 검토",
    description: (name) => `이미지와 읽을 수 있는 소스 참조를 확인한 뒤 ${name}을 업데이트합니다.`,
    details: "이미지 및 소스 변경",
    staysLocal: "이미지 바이트는 이 기기에만 유지",
    cancel: "취소",
    saving: "로컬에 저장 중…",
    insert: "이미지 삽입",
    imageDescription: "이미지 설명",
    imageDescriptionAria: "보조 기술용 이미지 설명",
    altHint: "대체 텍스트로 사용되며 접근 가능한 콘텐츠에 필수입니다.",
    sourceAddition: "정규 소스 추가",
    sourceContract: "Orbit은 정규 소스에 콘텐츠 해시 참조만 저장하며 base64 이미지 데이터는 저장하지 않습니다.",
  },
};

export function localImageCopy(locale: OrbitLocale) {
  return { ...LOCAL_IMAGE_COPY[locale], ...localImageActionCopy(locale) };
}

function readableBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function LocalImagePreview({ asset }: { asset: PreparedOrbitImageAsset }) {
  const [previewUrl] = useState(() => {
    const bytes = asset.bytes.slice().buffer as ArrayBuffer;
    return URL.createObjectURL(new Blob([bytes], { type: asset.mimeType }));
  });
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);
  // Orbit has already verified these device-local bytes; a framework image optimizer would cross the local-only boundary.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={previewUrl} alt="" />;
}

export function LocalImageReviewDialog({
  asset,
  artifactName,
  insertion,
  alt,
  error,
  submitting,
  locale,
  onAltChange,
  onCancel,
  onConfirm,
}: {
  asset: PreparedOrbitImageAsset;
  artifactName: string;
  insertion: OrbitImageInsertion;
  alt: string;
  error: string;
  submitting: boolean;
  locale: OrbitLocale;
  onAltChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = localImageCopy(locale);
  const title = copy.title;
  return (
    <ReviewDialog
      dialogId="local-image-review"
      kicker={
        <>
          <ShieldCheck aria-hidden="true" /> {copy.kicker}
        </>
      }
      title={title}
      description={copy.description(artifactName)}
      detailsLabel={copy.details}
      locale={locale}
      onCancel={onCancel}
      footer={
        <>
          <div>
            <HardDrive aria-hidden="true" /> {copy.staysLocal}
          </div>
          <span>
            <button className="button ghost-button" type="button" disabled={submitting} onClick={onCancel}>
              {copy.cancel}
            </button>
            <button
              className="button primary-button"
              type="button"
              data-dialog-initial-focus
              disabled={submitting || !alt.trim()}
              onClick={onConfirm}
            >
              {submitting ? (
                <LoaderCircle className="agent-spinner" aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {submitting ? copy.saving : copy.insert}
            </button>
          </span>
        </>
      }
    >
      <div className="local-image-review-grid">
        <figure>
          <LocalImagePreview key={asset.id} asset={asset} />
          <figcaption>
            <strong>{asset.name}</strong>
            <span>
              {asset.mimeType.replace("image/", "").toUpperCase()} · {readableBytes(asset.size)}
            </span>
          </figcaption>
        </figure>
        <div className="local-image-review-fields">
          <label>
            <span>{copy.imageDescription}</span>
            <input
              value={alt}
              maxLength={160}
              disabled={submitting}
              onChange={(event) => onAltChange(event.target.value)}
              aria-label={copy.imageDescriptionAria}
            />
            <small>{copy.altHint}</small>
          </label>
          <div className="local-image-reference">
            <span>{copy.sourceAddition}</span>
            <code>{insertion.markdown}</code>
          </div>
          <p>
            <ShieldCheck aria-hidden="true" /> {copy.sourceContract}
          </p>
        </div>
      </div>
      {error && (
        <div className="import-review-error" role="alert">
          {error}
        </div>
      )}
    </ReviewDialog>
  );
}
