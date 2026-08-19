// Human-reviewed additions that should not depend on the machine-generated catalog.

const OCR_ENGLISH = {
  changed: "The detected scan pages changed. Import the file again.",
  reviewPages: "Review the OCR page selection.",
  loadingModel: "Loading and caching language model",
  renderingPage: "Rendering page",
  locally: "locally",
  recognizingPage: "Recognizing page",
  preparing: "Preparing OCR",
  kicker: "Scanned PDF · explicit selection",
  title: "Choose pages for OCR",
  description:
    "Rune found pages without selectable text. Confirm pages and language; image content is not read until you open a preview or recognize.",
  settings: "OCR settings",
  privacyFooter: "Page images stay on device · results remain reviewable",
  stop: "Stop",
  cancel: "Cancel",
  recognizing: "Recognizing…",
  recognize: "Recognize",
  page: "page",
  pages: "pages",
  onDevice: "On-device recognition",
  privacy:
    "PDF pages render only in this browser. Rune loads its bundled OCR runtime and language data from this site and the browser caches them; page images and recognized text are never sent.",
  detectedScanPages: "detected scan pages",
  pagesToRecognize: "Pages to recognize",
  ocrPagesFor: "OCR pages for",
  pageExample: "For example 1-3, 5; only detected scan pages can be selected.",
  pageLanguage: "Page language",
  ocrLanguageFor: "OCR language for",
  languageHint: "Choose the language actually used on the page to reduce errors.",
  regionTitle: "Optional page region",
  regionDescription:
    "Choose a page, then drag over the preview to recognize only that area. Whole page remains the default.",
  openPreview: "Preview and choose region",
  previewPage: "Preview page",
  wholePage: "Whole page",
  resetRegion: "Reset to whole page",
  loadingPreview: "Rendering a private on-device preview…",
  previewError: "Rune could not render this page preview.",
  dragRegion: "Drag to select the OCR region",
  regionLeft: "Left",
  regionTop: "Top",
  regionWidth: "Width",
  regionHeight: "Height",
  percent: "%",
} as const;

type OcrCopy = Record<keyof typeof OCR_ENGLISH, string>;

function catalog(values: OcrCopy) {
  return Object.fromEntries(Object.entries(OCR_ENGLISH).map(([key, source]) => [source, values[key as keyof OcrCopy]]));
}

export const MANUAL_INTERFACE_TRANSLATIONS = {
  fr: catalog({
    changed: "Les pages numérisées détectées ont changé. Importez de nouveau le fichier.",
    reviewPages: "Vérifiez la sélection des pages OCR.",
    loadingModel: "Chargement et mise en cache du modèle linguistique",
    renderingPage: "Rendu de la page",
    locally: "en local",
    recognizingPage: "Reconnaissance de la page",
    preparing: "Préparation de l’OCR",
    kicker: "PDF numérisé · sélection explicite",
    title: "Choisissez les pages à reconnaître",
    description:
      "Rune a trouvé des pages sans texte sélectionnable. Confirmez les pages et la langue ; les images ne seront lues qu’après ouverture d’un aperçu ou lancement de la reconnaissance.",
    settings: "Réglages OCR",
    privacyFooter: "Les images restent sur l’appareil · les résultats restent vérifiables",
    stop: "Arrêter",
    cancel: "Annuler",
    recognizing: "Reconnaissance…",
    recognize: "Reconnaître",
    page: "page",
    pages: "pages",
    onDevice: "Reconnaissance sur l’appareil",
    privacy:
      "Les pages PDF sont rendues uniquement dans ce navigateur. Rune charge son moteur OCR intégré et les données linguistiques depuis ce site, puis le navigateur les met en cache ; les images et le texte reconnu ne sont jamais envoyés.",
    detectedScanPages: "pages numérisées détectées",
    pagesToRecognize: "Pages à reconnaître",
    ocrPagesFor: "Pages OCR pour",
    pageExample: "Par exemple 1-3, 5 ; seules les pages numérisées détectées peuvent être sélectionnées.",
    pageLanguage: "Langue de la page",
    ocrLanguageFor: "Langue OCR pour",
    languageHint: "Choisissez la langue réellement utilisée sur la page afin de réduire les erreurs.",
    regionTitle: "Zone de page facultative",
    regionDescription:
      "Choisissez une page, puis tracez un cadre sur l’aperçu pour ne reconnaître que cette zone. La page entière reste le réglage par défaut.",
    openPreview: "Prévisualiser et choisir une zone",
    previewPage: "Page à prévisualiser",
    wholePage: "Page entière",
    resetRegion: "Rétablir la page entière",
    loadingPreview: "Rendu d’un aperçu privé sur l’appareil…",
    previewError: "Rune n’a pas pu afficher l’aperçu de cette page.",
    dragRegion: "Faites glisser pour sélectionner la zone OCR",
    regionLeft: "Gauche",
    regionTop: "Haut",
    regionWidth: "Largeur",
    regionHeight: "Hauteur",
    percent: "%",
  }),
  es: catalog({
    changed: "Las páginas escaneadas detectadas han cambiado. Vuelve a importar el archivo.",
    reviewPages: "Revisa la selección de páginas para OCR.",
    loadingModel: "Cargando y almacenando en caché el modelo de idioma",
    renderingPage: "Renderizando la página",
    locally: "localmente",
    recognizingPage: "Reconociendo la página",
    preparing: "Preparando OCR",
    kicker: "PDF escaneado · selección explícita",
    title: "Elige las páginas para OCR",
    description:
      "Rune encontró páginas sin texto seleccionable. Confirma las páginas y el idioma; las imágenes solo se leerán al abrir una vista previa o iniciar el reconocimiento.",
    settings: "Ajustes de OCR",
    privacyFooter: "Las imágenes permanecen en el dispositivo · los resultados se pueden revisar",
    stop: "Detener",
    cancel: "Cancelar",
    recognizing: "Reconociendo…",
    recognize: "Reconocer",
    page: "página",
    pages: "páginas",
    onDevice: "Reconocimiento en el dispositivo",
    privacy:
      "Las páginas PDF se renderizan solo en este navegador. Rune carga su motor OCR integrado y los datos de idioma desde este sitio, y el navegador los almacena en caché; las imágenes y el texto reconocido nunca se envían.",
    detectedScanPages: "páginas escaneadas detectadas",
    pagesToRecognize: "Páginas para reconocer",
    ocrPagesFor: "Páginas OCR de",
    pageExample: "Por ejemplo 1-3, 5; solo se pueden seleccionar las páginas escaneadas detectadas.",
    pageLanguage: "Idioma de la página",
    ocrLanguageFor: "Idioma de OCR para",
    languageHint: "Elige el idioma que realmente usa la página para reducir errores.",
    regionTitle: "Región de página opcional",
    regionDescription:
      "Elige una página y arrastra sobre la vista previa para reconocer solo esa zona. La página completa sigue siendo el valor predeterminado.",
    openPreview: "Previsualizar y elegir región",
    previewPage: "Página de vista previa",
    wholePage: "Página completa",
    resetRegion: "Restablecer página completa",
    loadingPreview: "Renderizando una vista previa privada en el dispositivo…",
    previewError: "Rune no pudo renderizar la vista previa de esta página.",
    dragRegion: "Arrastra para seleccionar la región de OCR",
    regionLeft: "Izquierda",
    regionTop: "Arriba",
    regionWidth: "Ancho",
    regionHeight: "Alto",
    percent: "%",
  }),
  ru: catalog({
    changed: "Набор обнаруженных сканированных страниц изменился. Импортируйте файл снова.",
    reviewPages: "Проверьте выбор страниц для OCR.",
    loadingModel: "Загрузка и кэширование языковой модели",
    renderingPage: "Локальная отрисовка страницы",
    locally: "локально",
    recognizingPage: "Распознавание страницы",
    preparing: "Подготовка OCR",
    kicker: "Сканированный PDF · явный выбор",
    title: "Выберите страницы для OCR",
    description:
      "Rune обнаружил страницы без выделяемого текста. Подтвердите страницы и язык; изображения будут прочитаны только после открытия предпросмотра или запуска распознавания.",
    settings: "Настройки OCR",
    privacyFooter: "Изображения остаются на устройстве · результаты можно проверить",
    stop: "Остановить",
    cancel: "Отмена",
    recognizing: "Распознавание…",
    recognize: "Распознать",
    page: "страница",
    pages: "страниц",
    onDevice: "Распознавание на устройстве",
    privacy:
      "Страницы PDF отрисовываются только в этом браузере. Rune загружает встроенный модуль OCR и языковые данные с этого сайта, а браузер кэширует их; изображения и распознанный текст никогда не отправляются.",
    detectedScanPages: "обнаружены сканированные страницы",
    pagesToRecognize: "Страницы для распознавания",
    ocrPagesFor: "Страницы OCR для",
    pageExample: "Например, 1-3, 5; можно выбрать только обнаруженные сканированные страницы.",
    pageLanguage: "Язык страницы",
    ocrLanguageFor: "Язык OCR для",
    languageHint: "Выберите язык, который действительно используется на странице, чтобы уменьшить число ошибок.",
    regionTitle: "Необязательная область страницы",
    regionDescription:
      "Выберите страницу и обведите область в предпросмотре, чтобы распознать только её. По умолчанию используется вся страница.",
    openPreview: "Открыть предпросмотр и выбрать область",
    previewPage: "Страница предпросмотра",
    wholePage: "Вся страница",
    resetRegion: "Вернуть всю страницу",
    loadingPreview: "Локальная отрисовка приватного предпросмотра…",
    previewError: "Rune не удалось отобразить предпросмотр этой страницы.",
    dragRegion: "Перетащите, чтобы выбрать область OCR",
    regionLeft: "Слева",
    regionTop: "Сверху",
    regionWidth: "Ширина",
    regionHeight: "Высота",
    percent: "%",
  }),
  ar: catalog({
    changed: "تغيّرت الصفحات الممسوحة المكتشفة. أعد استيراد الملف.",
    reviewPages: "راجع اختيار صفحات التعرّف الضوئي.",
    loadingModel: "جارٍ تحميل نموذج اللغة وتخزينه مؤقتًا",
    renderingPage: "جارٍ عرض الصفحة",
    locally: "على الجهاز",
    recognizingPage: "جارٍ التعرّف على الصفحة",
    preparing: "جارٍ إعداد التعرّف الضوئي",
    kicker: "PDF ممسوح ضوئيًا · اختيار صريح",
    title: "اختر الصفحات للتعرّف الضوئي",
    description:
      "وجد Rune صفحات بلا نص قابل للتحديد. أكّد الصفحات واللغة؛ لن تُقرأ الصور إلا عند فتح المعاينة أو بدء التعرّف.",
    settings: "إعدادات التعرّف الضوئي",
    privacyFooter: "تبقى صور الصفحات على الجهاز · تظل النتائج قابلة للمراجعة",
    stop: "إيقاف",
    cancel: "إلغاء",
    recognizing: "جارٍ التعرّف…",
    recognize: "تعرّف على",
    page: "صفحة",
    pages: "صفحات",
    onDevice: "تعرّف على الجهاز",
    privacy:
      "تُعرض صفحات PDF داخل هذا المتصفح فقط. يحمّل Rune مشغّل التعرّف الضوئي المضمّن وبيانات اللغة من هذا الموقع ويخزّنهما المتصفح مؤقتًا؛ ولا تُرسل صور الصفحات أو النصوص المتعرّف عليها.",
    detectedScanPages: "الصفحات الممسوحة المكتشفة",
    pagesToRecognize: "الصفحات المراد التعرّف عليها",
    ocrPagesFor: "صفحات التعرّف الضوئي لـ",
    pageExample: "مثل 1-3، 5؛ لا يمكن اختيار سوى الصفحات الممسوحة المكتشفة.",
    pageLanguage: "لغة الصفحة",
    ocrLanguageFor: "لغة التعرّف الضوئي لـ",
    languageHint: "اختر اللغة المستخدمة فعليًا في الصفحة لتقليل الأخطاء.",
    regionTitle: "منطقة اختيارية من الصفحة",
    regionDescription:
      "اختر صفحة ثم اسحب فوق المعاينة للتعرّف على تلك المنطقة فقط. تبقى الصفحة كاملة هي الخيار الافتراضي.",
    openPreview: "معاينة واختيار المنطقة",
    previewPage: "صفحة المعاينة",
    wholePage: "الصفحة كاملة",
    resetRegion: "إعادة الضبط إلى الصفحة كاملة",
    loadingPreview: "جارٍ عرض معاينة خاصة على الجهاز…",
    previewError: "تعذّر على Rune عرض معاينة هذه الصفحة.",
    dragRegion: "اسحب لتحديد منطقة التعرّف الضوئي",
    regionLeft: "اليسار",
    regionTop: "الأعلى",
    regionWidth: "العرض",
    regionHeight: "الارتفاع",
    percent: "%",
  }),
  ja: catalog({
    changed: "検出されたスキャンページが変わりました。ファイルをもう一度読み込んでください。",
    reviewPages: "OCR ページの選択を確認してください。",
    loadingModel: "言語モデルを読み込んでキャッシュしています",
    renderingPage: "ページをレンダリングしています",
    locally: "（ローカル）",
    recognizingPage: "ページを認識しています",
    preparing: "OCR を準備しています",
    kicker: "スキャン PDF · 明示的な選択",
    title: "OCR するページを選択",
    description:
      "Rune は選択可能なテキストがないページを検出しました。ページと言語を確認してください。プレビューを開くか認識を開始するまで画像内容は読み取りません。",
    settings: "OCR 設定",
    privacyFooter: "ページ画像はデバイス内に保持 · 結果は確認可能",
    stop: "停止",
    cancel: "キャンセル",
    recognizing: "認識中…",
    recognize: "認識",
    page: "ページ",
    pages: "ページ",
    onDevice: "デバイス上で認識",
    privacy:
      "PDF ページはこのブラウザ内だけでレンダリングされます。Rune は内蔵 OCR ランタイムと言語データをこのサイトから読み込み、ブラウザがキャッシュします。ページ画像や認識されたテキストは送信されません。",
    detectedScanPages: "検出したスキャンページ",
    pagesToRecognize: "認識するページ",
    ocrPagesFor: "OCR ページ：",
    pageExample: "例：1-3, 5。検出されたスキャンページだけを選択できます。",
    pageLanguage: "ページの言語",
    ocrLanguageFor: "OCR 言語：",
    languageHint: "誤認識を減らすため、ページで実際に使われている言語を選択してください。",
    regionTitle: "任意のページ領域",
    regionDescription:
      "ページを選び、プレビュー上をドラッグすると、その範囲だけを認識できます。既定値はページ全体です。",
    openPreview: "プレビューして領域を選択",
    previewPage: "プレビューページ",
    wholePage: "ページ全体",
    resetRegion: "ページ全体に戻す",
    loadingPreview: "デバイス上で非公開プレビューを描画しています…",
    previewError: "Rune はこのページのプレビューを描画できませんでした。",
    dragRegion: "ドラッグして OCR 領域を選択",
    regionLeft: "左",
    regionTop: "上",
    regionWidth: "幅",
    regionHeight: "高さ",
    percent: "%",
  }),
  ko: catalog({
    changed: "감지된 스캔 페이지가 변경되었습니다. 파일을 다시 가져오세요.",
    reviewPages: "OCR 페이지 선택을 확인하세요.",
    loadingModel: "언어 모델을 불러와 캐시하는 중",
    renderingPage: "페이지 렌더링 중",
    locally: "(로컬)",
    recognizingPage: "페이지 인식 중",
    preparing: "OCR 준비 중",
    kicker: "스캔 PDF · 명시적 선택",
    title: "OCR 페이지 선택",
    description:
      "Rune이 선택 가능한 텍스트가 없는 페이지를 찾았습니다. 페이지와 언어를 확인하세요. 미리보기를 열거나 인식을 시작하기 전에는 이미지 내용을 읽지 않습니다.",
    settings: "OCR 설정",
    privacyFooter: "페이지 이미지는 기기에 유지 · 결과는 검토 가능",
    stop: "중지",
    cancel: "취소",
    recognizing: "인식 중…",
    recognize: "인식",
    page: "페이지",
    pages: "페이지",
    onDevice: "기기 내 인식",
    privacy:
      "PDF 페이지는 이 브라우저에서만 렌더링됩니다. Rune은 이 사이트에서 내장 OCR 런타임과 언어 데이터를 불러오고 브라우저가 이를 캐시합니다. 페이지 이미지와 인식된 텍스트는 전송되지 않습니다.",
    detectedScanPages: "감지된 스캔 페이지",
    pagesToRecognize: "인식할 페이지",
    ocrPagesFor: "OCR 페이지:",
    pageExample: "예: 1-3, 5. 감지된 스캔 페이지만 선택할 수 있습니다.",
    pageLanguage: "페이지 언어",
    ocrLanguageFor: "OCR 언어:",
    languageHint: "오류를 줄이려면 페이지에서 실제 사용하는 언어를 선택하세요.",
    regionTitle: "선택적 페이지 영역",
    regionDescription: "페이지를 고른 뒤 미리보기에서 드래그하면 해당 영역만 인식합니다. 기본값은 전체 페이지입니다.",
    openPreview: "미리보고 영역 선택",
    previewPage: "미리보기 페이지",
    wholePage: "전체 페이지",
    resetRegion: "전체 페이지로 재설정",
    loadingPreview: "기기에서 비공개 미리보기를 렌더링하는 중…",
    previewError: "Rune이 이 페이지의 미리보기를 렌더링하지 못했습니다.",
    dragRegion: "드래그하여 OCR 영역 선택",
    regionLeft: "왼쪽",
    regionTop: "위",
    regionWidth: "너비",
    regionHeight: "높이",
    percent: "%",
  }),
} as Record<"fr" | "es" | "ru" | "ar" | "ja" | "ko", Record<string, string>>;

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Recent task runs": "Exécutions récentes",
  "Operating review": "Revue d’activité",
  "Document to presentation": "Du document à la présentation",
  "Task time": "Durée de la tâche",
  "Earlier device records (read only)": "Anciens enregistrements de l’appareil (lecture seule)",
  Appearance: "Apparence",
  "Choose Rune's character color": "Choisissez la couleur de caractère de Rune",
  "Current theme": "Thème actuel",
  "More tools": "Plus d’outils",
  "Workspace tools": "Outils de l’espace de travail",
  "Help, models, folder, and appearance": "Aide, modèles, dossier et apparence",
  "Source and versions": "Source et versions",
  Sources: "Sources",
  Analysis: "Analyse",
  Deliverables: "Livrables",
  Version: "Version",
  "Mist Blue": "Bleu brume",
  Sage: "Sauge",
  Lavender: "Lavande",
  "Sky Blue": "Bleu ciel",
  "Light Gold": "Or clair",
  "Deep Blue": "Bleu profond",
  "Cosmic Orange": "Orange cosmique",
  Silver: "Argent",
  "Space Black": "Noir sidéral",
  "Show API key": "Afficher la clé API",
  "Hide API key": "Masquer la clé API",
  "Resize source and preview": "Redimensionner la source et l’aperçu",
  "Reset source and preview widths": "Rétablir les largeurs par défaut",
  "Workspace view": "Vue de l’espace de travail",
  Split: "Partagé",
  Source: "Source",
  Preview: "Aperçu",
  "Preview evidence": "Preuves de l’aperçu",
  "Source, bindings, and validation": "Source, liaisons et validation",
  "Show source and preview": "Afficher la source et l’aperçu",
  "Show source only": "Afficher uniquement la source",
  "Show preview only": "Afficher uniquement l’aperçu",
  "Try four shortcuts yourself": "Essayez vous-même quatre raccourcis",
  "Enter a focus view": "Passer à une vue ciblée",
  "Move instantly among Split, Source, and Preview without changing source":
    "Basculez instantanément entre Partagé, Source et Aperçu sans modifier la source",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |":
    "| Basculer entre Partagé / Source / Aperçu | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Recent task runs": "Ejecuciones recientes",
  "Operating review": "Revisión operativa",
  "Document to presentation": "De documento a presentación",
  "Task time": "Duración de la tarea",
  "Earlier device records (read only)": "Registros anteriores del dispositivo (solo lectura)",
  Appearance: "Apariencia",
  "Choose Rune's character color": "Elige el color de carácter de Rune",
  "Current theme": "Tema actual",
  "More tools": "Más herramientas",
  "Workspace tools": "Herramientas del espacio de trabajo",
  "Help, models, folder, and appearance": "Ayuda, modelos, carpeta y apariencia",
  "Source and versions": "Fuente y versiones",
  Sources: "Fuentes",
  Analysis: "Análisis",
  Deliverables: "Entregables",
  Version: "Versión",
  "Mist Blue": "Azul bruma",
  Sage: "Salvia",
  Lavender: "Lavanda",
  "Sky Blue": "Azul cielo",
  "Light Gold": "Oro claro",
  "Deep Blue": "Azul profundo",
  "Cosmic Orange": "Naranja cósmico",
  Silver: "Plateado",
  "Space Black": "Negro espacial",
  "Show API key": "Mostrar clave API",
  "Hide API key": "Ocultar clave API",
  "Resize source and preview": "Cambiar el tamaño de la fuente y la vista previa",
  "Reset source and preview widths": "Restablecer los anchos predeterminados",
  "Workspace view": "Vista del espacio de trabajo",
  Split: "Dividida",
  Source: "Fuente",
  Preview: "Vista previa",
  "Preview evidence": "Evidencia de la vista previa",
  "Source, bindings, and validation": "Fuente, enlaces y validación",
  "Show source and preview": "Mostrar fuente y vista previa",
  "Show source only": "Mostrar solo la fuente",
  "Show preview only": "Mostrar solo la vista previa",
  "Try four shortcuts yourself": "Prueba cuatro atajos",
  "Enter a focus view": "Entrar en una vista de enfoque",
  "Move instantly among Split, Source, and Preview without changing source":
    "Cambia al instante entre Dividida, Fuente y Vista previa sin modificar la fuente",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |":
    "| Cambiar vista Dividida / Fuente / Vista previa | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Recent task runs": "Недавние запуски задач",
  "Operating review": "Операционный обзор",
  "Document to presentation": "Из документа в презентацию",
  "Task time": "Время задачи",
  "Earlier device records (read only)": "Ранние записи на устройстве (только чтение)",
  Appearance: "Оформление",
  "Choose Rune's character color": "Выберите характерный цвет Rune",
  "Current theme": "Текущая тема",
  "More tools": "Другие инструменты",
  "Workspace tools": "Инструменты рабочей области",
  "Help, models, folder, and appearance": "Справка, модели, папка и оформление",
  "Source and versions": "Исходник и версии",
  Sources: "Источники",
  Analysis: "Анализ",
  Deliverables: "Результаты",
  Version: "Версия",
  "Mist Blue": "Туманно-синий",
  Sage: "Шалфейный",
  Lavender: "Лавандовый",
  "Sky Blue": "Небесно-голубой",
  "Light Gold": "Светлое золото",
  "Deep Blue": "Глубокий синий",
  "Cosmic Orange": "Космический оранжевый",
  Silver: "Серебристый",
  "Space Black": "Космический чёрный",
  "Show API key": "Показать ключ API",
  "Hide API key": "Скрыть ключ API",
  "Resize source and preview": "Изменить ширину исходника и предпросмотра",
  "Reset source and preview widths": "Восстановить ширину по умолчанию",
  "Workspace view": "Вид рабочей области",
  Split: "Оба",
  Source: "Исходник",
  Preview: "Предпросмотр",
  "Preview evidence": "Доказательства предпросмотра",
  "Source, bindings, and validation": "Исходник, связи и проверка",
  "Show source and preview": "Показать исходник и предпросмотр",
  "Show source only": "Показать только исходник",
  "Show preview only": "Показать только предпросмотр",
  "Try four shortcuts yourself": "Попробуйте четыре сочетания клавиш",
  "Enter a focus view": "Перейти в режим фокуса",
  "Move instantly among Split, Source, and Preview without changing source":
    "Мгновенно переключайтесь между обоими окнами, исходником и предпросмотром, не меняя исходник",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |":
    "| Вид: оба окна / исходник / предпросмотр | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Recent task runs": "عمليات المهام الأخيرة",
  "Operating review": "مراجعة التشغيل",
  "Document to presentation": "من مستند إلى عرض تقديمي",
  "Task time": "مدة المهمة",
  "Earlier device records (read only)": "سجلات سابقة على الجهاز (للقراءة فقط)",
  Appearance: "المظهر",
  "Choose Rune's character color": "اختر لون طابع Rune",
  "Current theme": "السمة الحالية",
  "More tools": "المزيد من الأدوات",
  "Workspace tools": "أدوات مساحة العمل",
  "Help, models, folder, and appearance": "المساعدة والنماذج والمجلد والمظهر",
  "Source and versions": "المصدر والإصدارات",
  Sources: "المصادر",
  Analysis: "التحليل",
  Deliverables: "المخرجات",
  Version: "الإصدار",
  "Mist Blue": "أزرق ضبابي",
  Sage: "أخضر مريمي",
  Lavender: "خزامي",
  "Sky Blue": "أزرق سماوي",
  "Light Gold": "ذهبي فاتح",
  "Deep Blue": "أزرق داكن",
  "Cosmic Orange": "برتقالي كوني",
  Silver: "فضي",
  "Space Black": "أسود فلكي",
  "Show API key": "إظهار مفتاح API",
  "Hide API key": "إخفاء مفتاح API",
  "Resize source and preview": "تغيير عرض المصدر والمعاينة",
  "Reset source and preview widths": "استعادة العرض الافتراضي",
  "Workspace view": "عرض مساحة العمل",
  Split: "مقسّم",
  Source: "المصدر",
  Preview: "المعاينة",
  "Preview evidence": "أدلة المعاينة",
  "Source, bindings, and validation": "المصدر والروابط والتحقق",
  "Show source and preview": "إظهار المصدر والمعاينة",
  "Show source only": "إظهار المصدر فقط",
  "Show preview only": "إظهار المعاينة فقط",
  "Try four shortcuts yourself": "جرّب أربعة اختصارات بنفسك",
  "Enter a focus view": "انتقل إلى عرض التركيز",
  "Move instantly among Split, Source, and Preview without changing source":
    "انتقل فورًا بين العرض المقسّم والمصدر والمعاينة من دون تغيير المصدر",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |":
    "| تبديل عرض مقسّم / المصدر / المعاينة | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Recent task runs": "最近のタスク実行",
  "Operating review": "経営レビュー",
  "Document to presentation": "文書からプレゼンテーションへ",
  "Task time": "タスク時間",
  "Earlier device records (read only)": "以前のデバイス記録（読み取り専用）",
  Appearance: "外観",
  "Choose Rune's character color": "Rune のテーマカラーを選択",
  "Current theme": "現在のテーマ",
  "More tools": "その他のツール",
  "Workspace tools": "ワークスペースツール",
  "Help, models, folder, and appearance": "ヘルプ・モデル・フォルダ・外観",
  "Source and versions": "ソースとバージョン",
  Sources: "ソース",
  Analysis: "分析",
  Deliverables: "成果物",
  Version: "バージョン",
  "Mist Blue": "ミストブルー",
  Sage: "セージ",
  Lavender: "ラベンダー",
  "Sky Blue": "スカイブルー",
  "Light Gold": "ライトゴールド",
  "Deep Blue": "ディープブルー",
  "Cosmic Orange": "コズミックオレンジ",
  Silver: "シルバー",
  "Space Black": "スペースブラック",
  "Show API key": "API キーを表示",
  "Hide API key": "API キーを隠す",
  "Resize source and preview": "ソースとプレビューの幅を調整",
  "Reset source and preview widths": "既定の幅に戻す",
  "Workspace view": "ワークスペース表示",
  Split: "分割",
  Source: "ソース",
  Preview: "プレビュー",
  "Preview evidence": "プレビューの根拠",
  "Source, bindings, and validation": "ソース・バインディング・検証",
  "Show source and preview": "ソースとプレビューを表示",
  "Show source only": "ソースだけを表示",
  "Show preview only": "プレビューだけを表示",
  "Try four shortcuts yourself": "4 つのショートカットを試す",
  "Enter a focus view": "フォーカス表示に切り替える",
  "Move instantly among Split, Source, and Preview without changing source":
    "ソースを変更せずに、分割・ソース・プレビューをすぐ切り替えます",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |":
    "| 分割 / ソース / プレビュー表示を切り替える | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Recent task runs": "최근 작업 실행",
  "Operating review": "운영 검토",
  "Document to presentation": "문서에서 프레젠테이션으로",
  "Task time": "작업 시간",
  "Earlier device records (read only)": "이전 기기 기록(읽기 전용)",
  Appearance: "화면 스타일",
  "Choose Rune's character color": "Rune의 테마 색상 선택",
  "Current theme": "현재 테마",
  "More tools": "도구 더 보기",
  "Workspace tools": "작업 공간 도구",
  "Help, models, folder, and appearance": "도움말, 모델, 폴더 및 화면 스타일",
  "Source and versions": "소스 및 버전",
  Sources: "소스",
  Analysis: "분석",
  Deliverables: "결과물",
  Version: "버전",
  "Mist Blue": "미스트 블루",
  Sage: "세이지",
  Lavender: "라벤더",
  "Sky Blue": "스카이 블루",
  "Light Gold": "라이트 골드",
  "Deep Blue": "딥 블루",
  "Cosmic Orange": "코스믹 오렌지",
  Silver: "실버",
  "Space Black": "스페이스 블랙",
  "Show API key": "API 키 표시",
  "Hide API key": "API 키 숨기기",
  "Resize source and preview": "소스와 미리보기 너비 조절",
  "Reset source and preview widths": "기본 너비로 복원",
  "Workspace view": "작업 공간 보기",
  Split: "분할",
  Source: "소스",
  Preview: "미리보기",
  "Preview evidence": "미리보기 근거",
  "Source, bindings, and validation": "소스, 바인딩 및 검증",
  "Show source and preview": "소스와 미리보기 표시",
  "Show source only": "소스만 표시",
  "Show preview only": "미리보기만 표시",
  "Try four shortcuts yourself": "네 가지 단축키 직접 사용해 보기",
  "Enter a focus view": "집중 보기로 전환",
  "Move instantly among Split, Source, and Preview without changing source":
    "소스를 변경하지 않고 분할, 소스, 미리보기 사이를 즉시 전환합니다",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |":
    "| 분할 / 소스 / 미리보기 전환 | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});

const MODEL_GUIDE_WITH_EXPLICIT_FAILOVER =
  "Rune supports personal OpenAI Responses, OpenRouter/compatible Chat Completions, Anthropic Messages, Gemini generateContent, and custom protocol profiles. After Save, the server encrypts the key into an HttpOnly credential that browser scripts cannot read; it never enters the workspace or localStorage. Local/deployed web servers need a separate `RUNE_CREDENTIAL_ENCRYPTION_KEY`; Rune Desktop protects that master key with the macOS Keychain. Cross-provider failover is off by default and runs only after you explicitly allow it in Models settings; deterministic local planners remain available without a model.";

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  [MODEL_GUIDE_WITH_EXPLICIT_FAILOVER]:
    "Rune prend en charge les profils personnels OpenAI Responses, OpenRouter/Chat Completions compatibles, Anthropic Messages, Gemini generateContent et les protocoles personnalisés. Après l’enregistrement, le serveur chiffre la clé dans un identifiant HttpOnly illisible par les scripts du navigateur ; elle n’entre jamais dans l’espace de travail ni dans localStorage. Les serveurs Web locaux ou déployés nécessitent un `RUNE_CREDENTIAL_ENCRYPTION_KEY` distinct ; Rune Desktop protège cette clé principale avec le trousseau macOS. Le basculement entre fournisseurs est désactivé par défaut et ne fonctionne qu’après votre autorisation explicite dans les réglages des modèles ; les planificateurs locaux déterministes restent disponibles sans modèle.",
  "Folder changes detected · review with Pull": "Modifications du dossier détectées · vérifiez-les avec Pull",
  "Folder monitoring stopped · reconnect to resume":
    "La surveillance du dossier s’est arrêtée · reconnectez-le pour reprendre",
  "Changes detected": "Modifications détectées",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  [MODEL_GUIDE_WITH_EXPLICIT_FAILOVER]:
    "Rune admite perfiles personales de OpenAI Responses, OpenRouter/Chat Completions compatibles, Anthropic Messages, Gemini generateContent y protocolos personalizados. Después de guardar, el servidor cifra la clave en una credencial HttpOnly que los scripts del navegador no pueden leer; nunca entra en el espacio de trabajo ni en localStorage. Los servidores web locales o desplegados necesitan un `RUNE_CREDENTIAL_ENCRYPTION_KEY` independiente; Rune Desktop protege esa clave maestra con el llavero de macOS. La conmutación entre proveedores está desactivada de forma predeterminada y solo funciona después de autorizarla expresamente en los ajustes de modelos; los planificadores locales deterministas siguen disponibles sin un modelo.",
  "Folder changes detected · review with Pull": "Se detectaron cambios en la carpeta · revísalos con Pull",
  "Folder monitoring stopped · reconnect to resume":
    "La supervisión de la carpeta se detuvo · vuelve a conectarla para continuar",
  "Changes detected": "Cambios detectados",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  [MODEL_GUIDE_WITH_EXPLICIT_FAILOVER]:
    "Rune поддерживает личные профили OpenAI Responses, OpenRouter/совместимых Chat Completions, Anthropic Messages, Gemini generateContent и пользовательских протоколов. После сохранения сервер шифрует ключ в учётных данных HttpOnly, недоступных сценариям браузера; ключ никогда не попадает в рабочую область или localStorage. Локальным и развёрнутым веб-серверам нужен отдельный `RUNE_CREDENTIAL_ENCRYPTION_KEY`; Rune Desktop защищает этот главный ключ с помощью Связки ключей macOS. Переключение между поставщиками по умолчанию выключено и работает только после явного разрешения в настройках моделей; детерминированные локальные планировщики доступны и без модели.",
  "Folder changes detected · review with Pull": "Обнаружены изменения в папке · проверьте их с помощью Pull",
  "Folder monitoring stopped · reconnect to resume":
    "Наблюдение за папкой остановлено · подключите её снова для продолжения",
  "Changes detected": "Обнаружены изменения",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  [MODEL_GUIDE_WITH_EXPLICIT_FAILOVER]:
    "يدعم Rune ملفات OpenAI Responses الشخصية وOpenRouter/Chat Completions المتوافقة وAnthropic Messages وGemini generateContent وملفات البروتوكول المخصصة. بعد الحفظ يشفّر الخادم المفتاح في بيانات اعتماد HttpOnly لا تستطيع نصوص المتصفح قراءتها؛ ولا يدخل المفتاح إلى مساحة العمل أو localStorage. تحتاج خوادم الويب المحلية أو المنشورة إلى `RUNE_CREDENTIAL_ENCRYPTION_KEY` منفصل، ويحمي Rune Desktop هذا المفتاح الرئيسي عبر سلسلة مفاتيح macOS. يظل التبديل بين المزودين متوقفاً افتراضياً ولا يعمل إلا بعد السماح به صراحةً في إعدادات النماذج؛ وتبقى المخططات المحلية الحتمية متاحة من دون نموذج.",
  "Folder changes detected · review with Pull": "تم اكتشاف تغييرات في المجلد · راجعها باستخدام Pull",
  "Folder monitoring stopped · reconnect to resume": "توقفت مراقبة المجلد · أعد الاتصال لاستئنافها",
  "Changes detected": "تم اكتشاف تغييرات",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  [MODEL_GUIDE_WITH_EXPLICIT_FAILOVER]:
    "Rune は、個人用の OpenAI Responses、OpenRouter/互換 Chat Completions、Anthropic Messages、Gemini generateContent、カスタムプロトコルの各プロファイルに対応しています。保存後、サーバーはキーをブラウザスクリプトから読み取れない HttpOnly 認証情報として暗号化し、ワークスペースや localStorage には一切保存しません。ローカルまたはデプロイ済みの Web サーバーには別の `RUNE_CREDENTIAL_ENCRYPTION_KEY` が必要で、Rune Desktop はそのマスターキーを macOS キーチェーンで保護します。プロバイダー間のフェイルオーバーは初期設定ではオフで、モデル設定で明示的に許可した場合にのみ実行されます。モデルがなくても決定論的なローカルプランナーを利用できます。",
  "Folder changes detected · review with Pull": "フォルダーの変更を検出しました · Pull で確認してください",
  "Folder monitoring stopped · reconnect to resume": "フォルダーの監視が停止しました · 再接続すると再開します",
  "Changes detected": "変更を検出",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  [MODEL_GUIDE_WITH_EXPLICIT_FAILOVER]:
    "Rune은 개인 OpenAI Responses, OpenRouter/호환 Chat Completions, Anthropic Messages, Gemini generateContent 및 사용자 지정 프로토콜 프로필을 지원합니다. 저장 후 서버는 브라우저 스크립트가 읽을 수 없는 HttpOnly 자격 증명으로 키를 암호화하며, 키는 작업공간이나 localStorage에 저장되지 않습니다. 로컬 또는 배포된 웹 서버에는 별도의 `RUNE_CREDENTIAL_ENCRYPTION_KEY`이 필요하며 Rune Desktop은 해당 마스터 키를 macOS 키체인으로 보호합니다. 공급자 간 장애 조치는 기본적으로 꺼져 있고 모델 설정에서 명시적으로 허용한 뒤에만 실행됩니다. 모델이 없어도 결정론적 로컬 플래너를 사용할 수 있습니다.",
  "Folder changes detected · review with Pull": "폴더 변경 감지 · Pull로 검토하세요",
  "Folder monitoring stopped · reconnect to resume": "폴더 모니터링 중지 · 다시 연결하면 재개됩니다",
  "Changes detected": "변경 감지됨",
});

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Allow provider failover": "Autoriser le basculement de fournisseur",
  Capabilities: "Capacités",
  "Input budget per task": "Budget d’entrée par tâche",
  "Not checked yet": "Pas encore vérifié",
  "Only after the primary model fails may Rune send the same bounded content to another configured provider. Off by default.":
    "Ce n’est qu’après l’échec du modèle principal que Rune peut envoyer le même contenu limité à un autre fournisseur configuré. Désactivé par défaut.",
  "Output budget per task": "Budget de sortie par tâche",
  "Provider-reported token usage": "Utilisation des jetons déclarée par le fournisseur",
  "Recent call succeeded": "Dernier appel réussi",
  "Structured output": "Sortie structurée",
  "Temporarily avoided": "Temporairement évité",
  tokens: "jetons",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Allow provider failover": "Permitir la conmutación por error del proveedor",
  Capabilities: "Capacidades",
  "Input budget per task": "Presupuesto de entrada por tarea",
  "Not checked yet": "Aún no comprobado",
  "Only after the primary model fails may Rune send the same bounded content to another configured provider. Off by default.":
    "Solo si falla el modelo principal, Rune puede enviar el mismo contenido acotado a otro proveedor configurado. Desactivado de forma predeterminada.",
  "Output budget per task": "Presupuesto de salida por tarea",
  "Provider-reported token usage": "Uso de tokens informado por el proveedor",
  "Recent call succeeded": "La llamada reciente se completó correctamente",
  "Structured output": "Salida estructurada",
  "Temporarily avoided": "Evitado temporalmente",
  tokens: "tokens",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Allow provider failover": "Разрешить переключение поставщика при сбое",
  Capabilities: "Возможности",
  "Input budget per task": "Бюджет входных токенов на задачу",
  "Not checked yet": "Ещё не проверено",
  "Only after the primary model fails may Rune send the same bounded content to another configured provider. Off by default.":
    "Только после сбоя основной модели Rune может отправить тот же ограниченный контент другому настроенному поставщику. По умолчанию выключено.",
  "Output budget per task": "Бюджет выходных токенов на задачу",
  "Provider-reported token usage": "Расход токенов по данным поставщика",
  "Recent call succeeded": "Последний вызов выполнен успешно",
  "Structured output": "Структурированный вывод",
  "Temporarily avoided": "Временно исключён",
  tokens: "токенов",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Allow provider failover": "السماح بالتبديل إلى مزود آخر عند الفشل",
  Capabilities: "الإمكانات",
  "Input budget per task": "ميزانية الإدخال لكل مهمة",
  "Not checked yet": "لم يُفحص بعد",
  "Only after the primary model fails may Rune send the same bounded content to another configured provider. Off by default.":
    "لا يجوز لـ Rune إرسال المحتوى المحدود نفسه إلى مزود آخر مُعدّ إلا بعد فشل النموذج الأساسي. هذا الخيار متوقف افتراضياً.",
  "Output budget per task": "ميزانية الإخراج لكل مهمة",
  "Provider-reported token usage": "استخدام الرموز المبلغ عنه من المزود",
  "Recent call succeeded": "نجح آخر استدعاء",
  "Structured output": "إخراج منظم",
  "Temporarily avoided": "مستبعد مؤقتاً",
  tokens: "رمزاً",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Allow provider failover": "プロバイダーのフェイルオーバーを許可",
  Capabilities: "機能",
  "Input budget per task": "タスクごとの入力上限",
  "Not checked yet": "未確認",
  "Only after the primary model fails may Rune send the same bounded content to another configured provider. Off by default.":
    "プライマリモデルが失敗した場合に限り、Rune は同じ制限済みコンテンツを別の設定済みプロバイダーへ送信できます。初期設定ではオフです。",
  "Output budget per task": "タスクごとの出力上限",
  "Provider-reported token usage": "プロバイダー報告のトークン使用量",
  "Recent call succeeded": "直近の呼び出しは成功しました",
  "Structured output": "構造化出力",
  "Temporarily avoided": "一時的に回避中",
  tokens: "トークン",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Allow provider failover": "공급자 장애 조치 허용",
  Capabilities: "기능",
  "Input budget per task": "작업당 입력 예산",
  "Not checked yet": "아직 확인하지 않음",
  "Only after the primary model fails may Rune send the same bounded content to another configured provider. Off by default.":
    "기본 모델이 실패한 경우에만 Rune이 동일한 제한된 콘텐츠를 설정된 다른 공급자에게 보낼 수 있습니다. 기본값은 꺼짐입니다.",
  "Output budget per task": "작업당 출력 예산",
  "Provider-reported token usage": "공급자가 보고한 토큰 사용량",
  "Recent call succeeded": "최근 호출 성공",
  "Structured output": "구조화된 출력",
  "Temporarily avoided": "일시적으로 제외됨",
  tokens: "토큰",
});

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Fetching models checks authentication and the model catalog only. The first Agent plan still verifies structured output for the selected protocol. Cross-provider retry requires separate permission in Models settings.":
    "La récupération des modèles vérifie uniquement l’authentification et le catalogue. Le premier plan Agent vérifie encore la sortie structurée du protocole choisi. Une nouvelle tentative auprès d’un autre fournisseur nécessite une autorisation distincte dans les réglages des modèles.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Fetching models checks authentication and the model catalog only. The first Agent plan still verifies structured output for the selected protocol. Cross-provider retry requires separate permission in Models settings.":
    "Obtener los modelos solo comprueba la autenticación y el catálogo. El primer plan de Agent también verifica la salida estructurada del protocolo elegido. Reintentar con otro proveedor requiere un permiso independiente en los ajustes de modelos.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Fetching models checks authentication and the model catalog only. The first Agent plan still verifies structured output for the selected protocol. Cross-provider retry requires separate permission in Models settings.":
    "Получение списка моделей проверяет только аутентификацию и каталог. Первый план Agent также проверяет структурированный вывод выбранного протокола. Для повторной попытки у другого поставщика требуется отдельное разрешение в настройках моделей.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Fetching models checks authentication and the model catalog only. The first Agent plan still verifies structured output for the selected protocol. Cross-provider retry requires separate permission in Models settings.":
    "يقتصر جلب النماذج على التحقق من المصادقة ودليل النماذج. وتظل خطة Agent الأولى تتحقق من الإخراج المنظم للبروتوكول المحدد. وتتطلب إعادة المحاولة عبر مزود آخر إذناً منفصلاً في إعدادات النماذج.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Fetching models checks authentication and the model catalog only. The first Agent plan still verifies structured output for the selected protocol. Cross-provider retry requires separate permission in Models settings.":
    "モデルの取得で確認するのは認証とモデル一覧だけです。最初の Agent プランでは、選択したプロトコルの構造化出力も検証します。別のプロバイダーで再試行するには、モデル設定で個別の許可が必要です。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Fetching models checks authentication and the model catalog only. The first Agent plan still verifies structured output for the selected protocol. Cross-provider retry requires separate permission in Models settings.":
    "모델 가져오기는 인증과 모델 목록만 확인합니다. 첫 Agent 계획은 선택한 프로토콜의 구조화된 출력도 검증합니다. 다른 공급자로 재시도하려면 모델 설정에서 별도의 권한을 허용해야 합니다.",
});

// Human-reviewed copy for the privacy boundary around device-local pilot evidence exports.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Always excluded": "Toujours exclus",
  "Anonymous JSON · review first · zero upload": "JSON anonyme · vérification préalable · aucun envoi",
  "Anonymous run-001 / output-01 labels and dates without exact timestamps":
    "Identifiants anonymes run-001 / output-01 et dates sans heure précise",
  "API keys, model provider names, source revisions, and delivery fingerprints":
    "Clés API, noms des fournisseurs de modèles, révisions des sources et empreintes de livraison",
  "Available after one guided task": "Disponible après une tâche guidée",
  "Confirming only downloads to this device; Rune does not upload or send the file.":
    "La confirmation télécharge uniquement sur cet appareil ; Rune ne téléverse ni n’envoie le fichier.",
  "Delivery format, usability judgment, and complete authorized/redacted seven-dimension ratings":
    "Format de livraison, jugement d’utilisabilité et évaluations complètes en sept dimensions sur du contenu autorisé ou anonymisé",
  "Delivery outcomes": "Résultats de livraison",
  "Document or data content, prompts, model responses, and Query rows":
    "Contenu des documents ou données, invites, réponses du modèle et lignes Query",
  "Download anonymous JSON": "Télécharger le JSON anonyme",
  "Export pilot evidence": "Exporter les preuves du pilote",
  "File names, Artifact IDs, workspace paths, and user identity":
    "Noms de fichiers, identifiants Artifact, chemins de l’espace de travail et identité de l’utilisateur",
  "File size": "Taille du fichier",
  "Human-reviewed real tasks": "Tâches réelles évaluées par une personne",
  "I reviewed the export scope and understand this is a candidate evidence file, not proof of PMF.":
    "J’ai vérifié le périmètre de l’export et je comprends qu’il s’agit d’un fichier de preuves candidates, et non d’une preuve de PMF.",
  "Local or configured-model planning plus input/output token counts when available":
    "Planification locale ou par modèle configuré, avec le nombre de jetons en entrée et en sortie lorsqu’il est disponible",
  "Pilot Evidence · on device": "Preuves du pilote · sur l’appareil",
  "Pilot Evidence export contents": "Contenu de l’export des preuves du pilote",
  "Review the pilot evidence export": "Vérifier l’export des preuves du pilote",
  "Rune has compiled this device's task records into anonymous JSON. It can support real-pilot aggregation, but is never uploaded and does not claim product-market validation.":
    "Rune a compilé les enregistrements de tâches de cet appareil dans un JSON anonyme. Il peut servir à agréger un pilote réel, mais n’est jamais téléversé et ne prétend pas valider l’adéquation produit-marché.",
  "Synthetic Golden Task results and every form of network upload":
    "Résultats synthétiques Golden Task et toute forme de téléversement réseau",
  "Task runs": "Exécutions de tâches",
  "Task type, applied or stopped status, elapsed time, and bounded impact counts":
    "Type de tâche, état appliqué ou arrêté, durée et mesures d’impact limitées",
  "This file includes": "Ce fichier contient",
  "This is device-local candidate human-outcome evidence. Only complete, authorized or redacted ratings count as reviewed real tasks; the file alone cannot prove PMF or a completed pilot threshold.":
    "Il s’agit de preuves candidates de résultats humains conservées sur l’appareil. Seules les évaluations complètes portant sur du contenu autorisé ou anonymisé comptent comme tâches réelles évaluées ; ce fichier seul ne prouve ni la PMF ni l’atteinte du seuil du pilote.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Always excluded": "Siempre excluido",
  "Anonymous JSON · review first · zero upload": "JSON anónimo · revisión previa · sin subidas",
  "Anonymous run-001 / output-01 labels and dates without exact timestamps":
    "Etiquetas anónimas run-001 / output-01 y fechas sin horas exactas",
  "API keys, model provider names, source revisions, and delivery fingerprints":
    "Claves API, nombres de proveedores de modelos, revisiones de origen y huellas de entrega",
  "Available after one guided task": "Disponible después de una tarea guiada",
  "Confirming only downloads to this device; Rune does not upload or send the file.":
    "Al confirmar, solo se descarga en este dispositivo; Rune no sube ni envía el archivo.",
  "Delivery format, usability judgment, and complete authorized/redacted seven-dimension ratings":
    "Formato de entrega, valoración de utilidad y puntuaciones completas de siete dimensiones sobre contenido autorizado o anonimizado",
  "Delivery outcomes": "Resultados de entrega",
  "Document or data content, prompts, model responses, and Query rows":
    "Contenido de documentos o datos, instrucciones, respuestas del modelo y filas de Query",
  "Download anonymous JSON": "Descargar JSON anónimo",
  "Export pilot evidence": "Exportar evidencia piloto",
  "File names, Artifact IDs, workspace paths, and user identity":
    "Nombres de archivo, identificadores Artifact, rutas del espacio de trabajo e identidad del usuario",
  "File size": "Tamaño del archivo",
  "Human-reviewed real tasks": "Tareas reales revisadas por personas",
  "I reviewed the export scope and understand this is a candidate evidence file, not proof of PMF.":
    "He revisado el alcance de la exportación y entiendo que es un archivo de evidencia candidata, no una prueba de PMF.",
  "Local or configured-model planning plus input/output token counts when available":
    "Planificación local o con un modelo configurado y, cuando estén disponibles, recuentos de tokens de entrada y salida",
  "Pilot Evidence · on device": "Evidencia piloto · en el dispositivo",
  "Pilot Evidence export contents": "Contenido de la exportación de evidencia piloto",
  "Review the pilot evidence export": "Revisar la exportación de evidencia piloto",
  "Rune has compiled this device's task records into anonymous JSON. It can support real-pilot aggregation, but is never uploaded and does not claim product-market validation.":
    "Rune ha recopilado los registros de tareas de este dispositivo en un JSON anónimo. Puede apoyar la agregación de un piloto real, pero nunca se sube ni afirma validar el encaje producto-mercado.",
  "Synthetic Golden Task results and every form of network upload":
    "Resultados sintéticos de Golden Task y cualquier tipo de subida a la red",
  "Task runs": "Ejecuciones de tareas",
  "Task type, applied or stopped status, elapsed time, and bounded impact counts":
    "Tipo de tarea, estado aplicado o detenido, tiempo transcurrido y recuentos de impacto limitados",
  "This file includes": "Este archivo incluye",
  "This is device-local candidate human-outcome evidence. Only complete, authorized or redacted ratings count as reviewed real tasks; the file alone cannot prove PMF or a completed pilot threshold.":
    "Es evidencia candidata de resultados humanos almacenada en el dispositivo. Solo las puntuaciones completas sobre contenido autorizado o anonimizado cuentan como tareas reales revisadas; el archivo por sí solo no demuestra PMF ni que se haya alcanzado el umbral del piloto.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Always excluded": "Всегда исключается",
  "Anonymous JSON · review first · zero upload": "Анонимный JSON · сначала проверка · без загрузки",
  "Anonymous run-001 / output-01 labels and dates without exact timestamps":
    "Анонимные метки run-001 / output-01 и даты без точного времени",
  "API keys, model provider names, source revisions, and delivery fingerprints":
    "API-ключи, названия поставщиков моделей, версии источников и отпечатки передачи",
  "Available after one guided task": "Доступно после одной управляемой задачи",
  "Confirming only downloads to this device; Rune does not upload or send the file.":
    "После подтверждения файл только скачивается на это устройство; Rune не загружает и не отправляет его.",
  "Delivery format, usability judgment, and complete authorized/redacted seven-dimension ratings":
    "Формат передачи, оценка пригодности и полные оценки по семи критериям для разрешённого или обезличенного содержимого",
  "Delivery outcomes": "Результаты передачи",
  "Document or data content, prompts, model responses, and Query rows":
    "Содержимое документов или данных, запросы, ответы модели и строки Query",
  "Download anonymous JSON": "Скачать анонимный JSON",
  "Export pilot evidence": "Экспортировать данные пилота",
  "File names, Artifact IDs, workspace paths, and user identity":
    "Имена файлов, идентификаторы Artifact, пути рабочей области и личность пользователя",
  "File size": "Размер файла",
  "Human-reviewed real tasks": "Реальные задачи с экспертной оценкой",
  "I reviewed the export scope and understand this is a candidate evidence file, not proof of PMF.":
    "Я проверил состав экспорта и понимаю, что это файл с предварительными доказательствами, а не подтверждение PMF.",
  "Local or configured-model planning plus input/output token counts when available":
    "Локальное планирование или настроенная модель, а также число входных и выходных токенов при наличии",
  "Pilot Evidence · on device": "Данные пилота · на устройстве",
  "Pilot Evidence export contents": "Состав экспорта данных пилота",
  "Review the pilot evidence export": "Проверьте экспорт данных пилота",
  "Rune has compiled this device's task records into anonymous JSON. It can support real-pilot aggregation, but is never uploaded and does not claim product-market validation.":
    "Rune собрал записи задач с этого устройства в анонимный JSON. Он может использоваться для сводного анализа реального пилота, но никогда не загружается и не заявляет о подтверждении соответствия продукта рынку.",
  "Synthetic Golden Task results and every form of network upload":
    "Синтетические результаты Golden Task и любая сетевая загрузка",
  "Task runs": "Запуски задач",
  "Task type, applied or stopped status, elapsed time, and bounded impact counts":
    "Тип задачи, статус применения или остановки, длительность и ограниченные показатели воздействия",
  "This file includes": "Файл содержит",
  "This is device-local candidate human-outcome evidence. Only complete, authorized or redacted ratings count as reviewed real tasks; the file alone cannot prove PMF or a completed pilot threshold.":
    "Это предварительные данные о человеческой оценке, хранящиеся на устройстве. Реальными проверенными задачами считаются только полные оценки разрешённого или обезличенного содержимого; один этот файл не доказывает PMF и не подтверждает достижение порога пилота.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Always excluded": "مستبعد دائمًا",
  "Anonymous JSON · review first · zero upload": "JSON مجهول الهوية · مراجعة أولًا · بلا رفع",
  "Anonymous run-001 / output-01 labels and dates without exact timestamps":
    "تسميات مجهولة run-001 / output-01 وتواريخ بلا أوقات دقيقة",
  "API keys, model provider names, source revisions, and delivery fingerprints":
    "مفاتيح API وأسماء مزودي النماذج ومراجعات المصدر وبصمات التسليم",
  "Available after one guided task": "متاح بعد مهمة موجهة واحدة",
  "Confirming only downloads to this device; Rune does not upload or send the file.":
    "يؤدي التأكيد إلى التنزيل على هذا الجهاز فقط؛ ولا يرفع Rune الملف أو يرسله.",
  "Delivery format, usability judgment, and complete authorized/redacted seven-dimension ratings":
    "تنسيق التسليم وحكم القابلية للاستخدام وتقييمات الأبعاد السبعة الكاملة للمحتوى المصرح به أو المنقح",
  "Delivery outcomes": "نتائج التسليم",
  "Document or data content, prompts, model responses, and Query rows":
    "محتوى المستندات أو البيانات والمطالبات واستجابات النموذج وصفوف Query",
  "Download anonymous JSON": "تنزيل JSON مجهول الهوية",
  "Export pilot evidence": "تصدير أدلة التجربة",
  "File names, Artifact IDs, workspace paths, and user identity":
    "أسماء الملفات ومعرفات Artifact ومسارات مساحة العمل وهوية المستخدم",
  "File size": "حجم الملف",
  "Human-reviewed real tasks": "مهام حقيقية راجعها أشخاص",
  "I reviewed the export scope and understand this is a candidate evidence file, not proof of PMF.":
    "راجعت نطاق التصدير وأفهم أن هذا ملف أدلة مرشحة وليس إثباتًا لملاءمة المنتج للسوق.",
  "Local or configured-model planning plus input/output token counts when available":
    "تخطيط محلي أو بنموذج مُعدّ، مع أعداد رموز الإدخال والإخراج عند توفرها",
  "Pilot Evidence · on device": "أدلة التجربة · على الجهاز",
  "Pilot Evidence export contents": "محتويات تصدير أدلة التجربة",
  "Review the pilot evidence export": "راجع تصدير أدلة التجربة",
  "Rune has compiled this device's task records into anonymous JSON. It can support real-pilot aggregation, but is never uploaded and does not claim product-market validation.":
    "جمع Rune سجلات مهام هذا الجهاز في JSON مجهول الهوية. ويمكن أن يدعم تجميع نتائج تجربة حقيقية، لكنه لا يُرفع أبدًا ولا يدّعي إثبات ملاءمة المنتج للسوق.",
  "Synthetic Golden Task results and every form of network upload":
    "نتائج Golden Task الاصطناعية وكل أشكال الرفع عبر الشبكة",
  "Task runs": "تشغيلات المهام",
  "Task type, applied or stopped status, elapsed time, and bounded impact counts":
    "نوع المهمة وحالة التطبيق أو الإيقاف والوقت المنقضي وأعداد التأثير المحدودة",
  "This file includes": "يتضمن هذا الملف",
  "This is device-local candidate human-outcome evidence. Only complete, authorized or redacted ratings count as reviewed real tasks; the file alone cannot prove PMF or a completed pilot threshold.":
    "هذه أدلة مرشحة لنتائج بشرية محفوظة على الجهاز. ولا تُحتسب مهام حقيقية مراجعة إلا التقييمات الكاملة لمحتوى مصرح به أو منقح؛ ولا يمكن للملف وحده إثبات ملاءمة المنتج للسوق أو اكتمال عتبة التجربة.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Always excluded": "常に除外",
  "Anonymous JSON · review first · zero upload": "匿名 JSON · 事前確認 · アップロードなし",
  "Anonymous run-001 / output-01 labels and dates without exact timestamps":
    "匿名の run-001 / output-01 ラベルと時刻を含まない日付",
  "API keys, model provider names, source revisions, and delivery fingerprints":
    "API キー、モデル提供元名、ソースのリビジョン、納品フィンガープリント",
  "Available after one guided task": "ガイド付きタスクを 1 回完了すると利用できます",
  "Confirming only downloads to this device; Rune does not upload or send the file.":
    "確認するとこのデバイスにのみダウンロードされます。Rune がファイルをアップロードまたは送信することはありません。",
  "Delivery format, usability judgment, and complete authorized/redacted seven-dimension ratings":
    "納品形式、利用可否の判断、許可済みまたは匿名化済み内容の完全な 7 項目評価",
  "Delivery outcomes": "納品結果",
  "Document or data content, prompts, model responses, and Query rows":
    "文書やデータの内容、プロンプト、モデルの応答、Query の行",
  "Download anonymous JSON": "匿名 JSON をダウンロード",
  "Export pilot evidence": "パイロット証拠をエクスポート",
  "File names, Artifact IDs, workspace paths, and user identity":
    "ファイル名、Artifact ID、ワークスペースのパス、ユーザーの識別情報",
  "File size": "ファイルサイズ",
  "Human-reviewed real tasks": "人が評価した実タスク",
  "I reviewed the export scope and understand this is a candidate evidence file, not proof of PMF.":
    "エクスポート範囲を確認し、これは候補証拠ファイルであって PMF の証明ではないことを理解しました。",
  "Local or configured-model planning plus input/output token counts when available":
    "ローカルまたは設定済みモデルによる計画と、利用可能な場合の入出力トークン数",
  "Pilot Evidence · on device": "パイロット証拠 · デバイス内",
  "Pilot Evidence export contents": "パイロット証拠のエクスポート内容",
  "Review the pilot evidence export": "パイロット証拠のエクスポートを確認",
  "Rune has compiled this device's task records into anonymous JSON. It can support real-pilot aggregation, but is never uploaded and does not claim product-market validation.":
    "Rune はこのデバイスのタスク記録を匿名 JSON にまとめました。実際のパイロット結果の集計に利用できますが、アップロードされることはなく、プロダクトマーケット検証の完了を示すものでもありません。",
  "Synthetic Golden Task results and every form of network upload":
    "合成 Golden Task の結果とあらゆるネットワークアップロード",
  "Task runs": "タスク実行",
  "Task type, applied or stopped status, elapsed time, and bounded impact counts":
    "タスク種別、適用または停止状態、経過時間、上限付きの影響件数",
  "This file includes": "このファイルに含まれるもの",
  "This is device-local candidate human-outcome evidence. Only complete, authorized or redacted ratings count as reviewed real tasks; the file alone cannot prove PMF or a completed pilot threshold.":
    "これはデバイス内に保存された、人による結果評価の候補証拠です。完全かつ許可済みまたは匿名化済みの評価だけが確認済み実タスクとして集計されます。このファイル単独では PMF やパイロット基準達成を証明できません。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Always excluded": "항상 제외",
  "Anonymous JSON · review first · zero upload": "익명 JSON · 먼저 검토 · 업로드 없음",
  "Anonymous run-001 / output-01 labels and dates without exact timestamps":
    "익명 run-001 / output-01 레이블과 정확한 시각이 없는 날짜",
  "API keys, model provider names, source revisions, and delivery fingerprints":
    "API 키, 모델 공급자 이름, 소스 리비전, 전달 지문",
  "Available after one guided task": "가이드 작업 1회 완료 후 사용 가능",
  "Confirming only downloads to this device; Rune does not upload or send the file.":
    "확인하면 이 기기에만 다운로드됩니다. Rune은 파일을 업로드하거나 전송하지 않습니다.",
  "Delivery format, usability judgment, and complete authorized/redacted seven-dimension ratings":
    "전달 형식, 사용 가능성 판단, 승인되었거나 비식별 처리된 콘텐츠의 완전한 7개 항목 평가",
  "Delivery outcomes": "전달 결과",
  "Document or data content, prompts, model responses, and Query rows":
    "문서 또는 데이터 본문, 프롬프트, 모델 응답, Query 행",
  "Download anonymous JSON": "익명 JSON 다운로드",
  "Export pilot evidence": "파일럿 증거 내보내기",
  "File names, Artifact IDs, workspace paths, and user identity":
    "파일 이름, Artifact ID, 작업 공간 경로, 사용자 식별 정보",
  "File size": "파일 크기",
  "Human-reviewed real tasks": "사람이 검토한 실제 작업",
  "I reviewed the export scope and understand this is a candidate evidence file, not proof of PMF.":
    "내보내기 범위를 검토했으며 이것이 후보 증거 파일이지 PMF의 증명이 아님을 이해했습니다.",
  "Local or configured-model planning plus input/output token counts when available":
    "로컬 또는 구성된 모델의 계획과 사용 가능한 경우 입출력 토큰 수",
  "Pilot Evidence · on device": "파일럿 증거 · 기기 내",
  "Pilot Evidence export contents": "파일럿 증거 내보내기 내용",
  "Review the pilot evidence export": "파일럿 증거 내보내기 검토",
  "Rune has compiled this device's task records into anonymous JSON. It can support real-pilot aggregation, but is never uploaded and does not claim product-market validation.":
    "Rune이 이 기기의 작업 기록을 익명 JSON으로 정리했습니다. 실제 파일럿 결과 집계에 사용할 수 있지만 업로드되지 않으며 제품 시장 검증 완료를 의미하지 않습니다.",
  "Synthetic Golden Task results and every form of network upload":
    "합성 Golden Task 결과와 모든 형태의 네트워크 업로드",
  "Task runs": "작업 실행",
  "Task type, applied or stopped status, elapsed time, and bounded impact counts":
    "작업 유형, 적용 또는 중지 상태, 경과 시간, 제한된 영향 수치",
  "This file includes": "이 파일에 포함되는 항목",
  "This is device-local candidate human-outcome evidence. Only complete, authorized or redacted ratings count as reviewed real tasks; the file alone cannot prove PMF or a completed pilot threshold.":
    "이 자료는 기기에 저장되는 사람 평가 결과의 후보 증거입니다. 완전하고 승인되었거나 비식별 처리된 평가만 검토된 실제 작업으로 집계됩니다. 이 파일만으로 PMF나 파일럿 기준 달성을 증명할 수 없습니다.",
});

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Review the anonymous task records before local download":
    "Vérifiez les enregistrements de tâches anonymes avant le téléchargement local",
  "Rune could not prepare pilot evidence.": "Rune n’a pas pu préparer les preuves du pilote.",
  "Pilot evidence export cancelled — nothing was downloaded":
    "Export des preuves du pilote annulé — aucun fichier n’a été téléchargé",
  "Task evidence changed while this file was under review. Cancel and prepare a fresh export.":
    "Les preuves de tâche ont changé pendant la vérification. Annulez et préparez un nouvel export.",
  "Pilot evidence held for review — device records changed":
    "Preuves du pilote suspendues — les enregistrements de l’appareil ont changé",
  "Anonymous Pilot Evidence downloaded locally · no upload performed":
    "Preuves du pilote anonymes téléchargées localement · aucun envoi effectué",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Review the anonymous task records before local download":
    "Revisa los registros de tareas anónimos antes de descargarlos localmente",
  "Rune could not prepare pilot evidence.": "Rune no pudo preparar la evidencia piloto.",
  "Pilot evidence export cancelled — nothing was downloaded":
    "Exportación de evidencia piloto cancelada — no se descargó nada",
  "Task evidence changed while this file was under review. Cancel and prepare a fresh export.":
    "La evidencia de las tareas cambió durante la revisión. Cancela y prepara una nueva exportación.",
  "Pilot evidence held for review — device records changed":
    "Evidencia piloto retenida para revisión — cambiaron los registros del dispositivo",
  "Anonymous Pilot Evidence downloaded locally · no upload performed":
    "Evidencia piloto anónima descargada localmente · no se realizó ninguna subida",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Review the anonymous task records before local download":
    "Проверьте анонимные записи задач перед локальным скачиванием",
  "Rune could not prepare pilot evidence.": "Rune не смог подготовить данные пилота.",
  "Pilot evidence export cancelled — nothing was downloaded": "Экспорт данных пилота отменён — ничего не скачано",
  "Task evidence changed while this file was under review. Cancel and prepare a fresh export.":
    "Данные задач изменились во время проверки файла. Отмените и подготовьте новый экспорт.",
  "Pilot evidence held for review — device records changed":
    "Данные пилота задержаны для проверки — записи на устройстве изменились",
  "Anonymous Pilot Evidence downloaded locally · no upload performed":
    "Анонимные данные пилота скачаны локально · загрузка в сеть не выполнялась",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Review the anonymous task records before local download": "راجع سجلات المهام مجهولة الهوية قبل التنزيل المحلي",
  "Rune could not prepare pilot evidence.": "تعذر على Rune إعداد أدلة التجربة.",
  "Pilot evidence export cancelled — nothing was downloaded": "أُلغي تصدير أدلة التجربة — لم يُنزّل أي ملف",
  "Task evidence changed while this file was under review. Cancel and prepare a fresh export.":
    "تغيّرت أدلة المهام أثناء مراجعة الملف. ألغِ العملية وأعد تصدير ملف جديد.",
  "Pilot evidence held for review — device records changed": "أدلة التجربة معلّقة للمراجعة — تغيّرت سجلات الجهاز",
  "Anonymous Pilot Evidence downloaded locally · no upload performed":
    "نُزّلت أدلة التجربة مجهولة الهوية محليًا · لم يُنفذ أي رفع",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Review the anonymous task records before local download":
    "ローカルにダウンロードする前に匿名のタスク記録を確認してください",
  "Rune could not prepare pilot evidence.": "Rune はパイロット証拠を準備できませんでした。",
  "Pilot evidence export cancelled — nothing was downloaded":
    "パイロット証拠のエクスポートをキャンセルしました — ダウンロードはありません",
  "Task evidence changed while this file was under review. Cancel and prepare a fresh export.":
    "ファイルの確認中にタスク証拠が変更されました。キャンセルして新しいエクスポートを準備してください。",
  "Pilot evidence held for review — device records changed":
    "パイロット証拠を保留しました — デバイスの記録が変更されました",
  "Anonymous Pilot Evidence downloaded locally · no upload performed":
    "匿名のパイロット証拠をローカルにダウンロードしました · アップロードはありません",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Review the anonymous task records before local download": "로컬 다운로드 전에 익명 작업 기록을 검토하세요",
  "Rune could not prepare pilot evidence.": "Rune이 파일럿 증거를 준비하지 못했습니다.",
  "Pilot evidence export cancelled — nothing was downloaded": "파일럿 증거 내보내기 취소됨 — 다운로드된 파일 없음",
  "Task evidence changed while this file was under review. Cancel and prepare a fresh export.":
    "파일 검토 중 작업 증거가 변경되었습니다. 취소하고 새 내보내기를 준비하세요.",
  "Pilot evidence held for review — device records changed": "파일럿 증거 검토 보류 — 기기 기록이 변경됨",
  "Anonymous Pilot Evidence downloaded locally · no upload performed":
    "익명 파일럿 증거를 로컬에 다운로드함 · 업로드 없음",
});

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "A material error, omission, or rework still blocks delivery.":
    "Une erreur importante, une omission ou une reprise empêche encore la livraison.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.":
    "Un téléchargement ou une écriture dans un dossier réussis ne prouvent pas que le résultat est utile. Choisissez l’issue la plus proche afin que Rune distingue la réussite technique d’un livrable réel.",
  "Confirm outcome": "Confirmer le résultat",
  "Confirm real usability after a handoff": "Confirmez l’utilité réelle après une remise",
  "confirmed deliverables": "livrables confirmés",
  "Decide later": "Décider plus tard",
  Deliverable: "Livrable",
  "Deliverable after minor edits": "Livrable après quelques retouches",
  "Deliverable outcome": "Résultat du livrable",
  "Delivery confirmation · on device": "Confirmation de livraison · sur l’appareil",
  "Delivery outcome recorded on this device": "Résultat de livraison enregistré sur cet appareil",
  "Did this result become usable in real work?": "Ce résultat est-il devenu utilisable dans un travail réel ?",
  Handoff: "Remise",
  "Not ready to deliver": "Pas prêt à livrer",
  "Ready to deliver": "Prêt à livrer",
  "Recording…": "Enregistrement…",
  "Rune could not record this delivery outcome": "Rune n’a pas pu enregistrer ce résultat de livraison",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.":
    "Rune conserve uniquement le jugement, le format, le temps écoulé et l’empreinte de révision de la source sur cet appareil, jamais le texte du document ni les invites.",
  Task: "Tâche",
  "The direction is right and only limited manual changes remain.":
    "La direction est bonne et seules quelques modifications manuelles restent à faire.",
  "The numbers, structure, and language meet this task.":
    "Les chiffres, la structure et le langage répondent à cette tâche.",
  "usable or minor edits": "utilisables ou avec retouches mineures",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "A material error, omission, or rework still blocks delivery.":
    "Un error importante, una omisión o una reelaboración todavía impide la entrega.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.":
    "Una descarga o escritura en carpeta correcta no demuestra que el resultado sea útil. Elige el resultado más cercano para que Rune distinga el éxito técnico de un entregable real.",
  "Confirm outcome": "Confirmar resultado",
  "Confirm real usability after a handoff": "Confirma la utilidad real después de una entrega",
  "confirmed deliverables": "entregables confirmados",
  "Decide later": "Decidir más tarde",
  Deliverable: "Entregable",
  "Deliverable after minor edits": "Entregable tras pequeños ajustes",
  "Deliverable outcome": "Resultado del entregable",
  "Delivery confirmation · on device": "Confirmación de entrega · en el dispositivo",
  "Delivery outcome recorded on this device": "Resultado de entrega guardado en este dispositivo",
  "Did this result become usable in real work?": "¿Este resultado llegó a ser útil en un trabajo real?",
  Handoff: "Entrega",
  "Not ready to deliver": "Aún no se puede entregar",
  "Ready to deliver": "Listo para entregar",
  "Recording…": "Guardando…",
  "Rune could not record this delivery outcome": "Rune no pudo guardar este resultado de entrega",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.":
    "Rune guarda en este dispositivo solo la valoración, el formato, el tiempo transcurrido y la huella de revisión de la fuente; nunca el texto del documento ni las instrucciones.",
  Task: "Tarea",
  "The direction is right and only limited manual changes remain.":
    "La dirección es correcta y solo quedan cambios manuales limitados.",
  "The numbers, structure, and language meet this task.": "Las cifras, la estructura y el lenguaje cumplen esta tarea.",
  "usable or minor edits": "utilizables o con ajustes menores",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "A material error, omission, or rework still blocks delivery.":
    "Существенная ошибка, пропуск или необходимость переработки всё ещё мешают передаче результата.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.":
    "Успешное скачивание или запись в папку не доказывают полезность результата. Выберите наиболее близкий исход, чтобы Rune отличал технический успех от реального готового материала.",
  "Confirm outcome": "Подтвердить результат",
  "Confirm real usability after a handoff": "Подтвердите реальную пригодность после передачи",
  "confirmed deliverables": "подтверждённых материалов",
  "Decide later": "Решить позже",
  Deliverable: "Готовый материал",
  "Deliverable after minor edits": "Готово после небольших правок",
  "Deliverable outcome": "Итог готового материала",
  "Delivery confirmation · on device": "Подтверждение результата · на устройстве",
  "Delivery outcome recorded on this device": "Результат передачи сохранён на этом устройстве",
  "Did this result become usable in real work?": "Стал ли этот результат пригоден для реальной работы?",
  Handoff: "Передача",
  "Not ready to deliver": "Пока не готово",
  "Ready to deliver": "Готово к передаче",
  "Recording…": "Сохранение…",
  "Rune could not record this delivery outcome": "Rune не удалось сохранить итог передачи",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.":
    "Rune хранит на этом устройстве только оценку, формат, затраченное время и отпечаток версии исходника — без текста документа и запросов.",
  Task: "Задача",
  "The direction is right and only limited manual changes remain.":
    "Направление верное, остались лишь небольшие ручные правки.",
  "The numbers, structure, and language meet this task.": "Числа, структура и язык соответствуют задаче.",
  "usable or minor edits": "пригодны или требуют мелких правок",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "A material error, omission, or rework still blocks delivery.": "لا يزال خطأ جوهري أو نقص أو عمل إضافي يمنع التسليم.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.":
    "لا يثبت نجاح التنزيل أو الكتابة إلى المجلد أن النتيجة مفيدة. اختر النتيجة الأقرب كي يميّز Rune بين النجاح التقني والمخرج الحقيقي القابل للتسليم.",
  "Confirm outcome": "تأكيد النتيجة",
  "Confirm real usability after a handoff": "أكّد قابلية الاستخدام الفعلية بعد التسليم",
  "confirmed deliverables": "مخرجات مؤكدة",
  "Decide later": "القرار لاحقًا",
  Deliverable: "المخرج",
  "Deliverable after minor edits": "قابل للتسليم بعد تعديلات بسيطة",
  "Deliverable outcome": "نتيجة المخرج",
  "Delivery confirmation · on device": "تأكيد التسليم · على الجهاز",
  "Delivery outcome recorded on this device": "تم تسجيل نتيجة التسليم على هذا الجهاز",
  "Did this result become usable in real work?": "هل أصبحت هذه النتيجة قابلة للاستخدام في عمل حقيقي؟",
  Handoff: "التسليم",
  "Not ready to deliver": "غير جاهز للتسليم",
  "Ready to deliver": "جاهز للتسليم",
  "Recording…": "جارٍ التسجيل…",
  "Rune could not record this delivery outcome": "تعذّر على Rune تسجيل نتيجة التسليم",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.":
    "يخزّن Rune على هذا الجهاز التقييم والتنسيق والوقت المنقضي وبصمة إصدار المصدر فقط، ولا يخزّن نص المستند أو المطالبات.",
  Task: "المهمة",
  "The direction is right and only limited manual changes remain.": "الاتجاه صحيح ولا يتبقى سوى تعديلات يدوية محدودة.",
  "The numbers, structure, and language meet this task.": "الأرقام والبنية واللغة مناسبة لهذه المهمة.",
  "usable or minor edits": "قابلة للاستخدام أو تحتاج تعديلات بسيطة",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "A material error, omission, or rework still blocks delivery.":
    "重大な誤り、欠落、または手戻りがあり、まだ納品できません。",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.":
    "ダウンロードやフォルダへの書き込みが成功しても、結果が有用だったとは限りません。Rune が技術的な成功と実際の成果物を区別できるよう、最も近い結果を選んでください。",
  "Confirm outcome": "結果を確定",
  "Confirm real usability after a handoff": "受け渡し後に実際の有用性を確認",
  "confirmed deliverables": "件の確認済み成果物",
  "Decide later": "後で決める",
  Deliverable: "成果物",
  "Deliverable after minor edits": "軽微な修正後に納品可能",
  "Deliverable outcome": "成果物の結果",
  "Delivery confirmation · on device": "納品確認 · デバイス内",
  "Delivery outcome recorded on this device": "納品結果をこのデバイスに記録しました",
  "Did this result become usable in real work?": "この結果は実際の業務で使えるものになりましたか？",
  Handoff: "受け渡し",
  "Not ready to deliver": "まだ納品できない",
  "Ready to deliver": "そのまま納品できる",
  "Recording…": "記録中…",
  "Rune could not record this delivery outcome": "Rune はこの納品結果を記録できませんでした",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.":
    "Rune がこのデバイスに保存するのは、評価、形式、経過時間、ソース改訂の指紋だけです。文書本文やプロンプトは保存しません。",
  Task: "タスク",
  "The direction is right and only limited manual changes remain.":
    "方向性は正しく、残るのは限定的な手作業の修正だけです。",
  "The numbers, structure, and language meet this task.": "数値、構成、表現がこのタスクを満たしています。",
  "usable or minor edits": "利用可能または軽微な修正のみ",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "A material error, omission, or rework still blocks delivery.":
    "중대한 오류, 누락 또는 재작업이 남아 있어 아직 전달할 수 없습니다.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.":
    "다운로드나 폴더 쓰기가 성공했다고 결과가 유용했다는 뜻은 아닙니다. Rune이 기술적 성공과 실제 결과물을 구분할 수 있도록 가장 가까운 결과를 선택하세요.",
  "Confirm outcome": "결과 확인",
  "Confirm real usability after a handoff": "전달 후 실제 사용 가능 여부 확인",
  "confirmed deliverables": "개 확인된 결과물",
  "Decide later": "나중에 결정",
  Deliverable: "결과물",
  "Deliverable after minor edits": "조금 수정하면 전달 가능",
  "Deliverable outcome": "결과물 평가",
  "Delivery confirmation · on device": "전달 확인 · 기기 내",
  "Delivery outcome recorded on this device": "전달 결과를 이 기기에 기록했습니다",
  "Did this result become usable in real work?": "이 결과를 실제 업무에 사용할 수 있었나요?",
  Handoff: "전달",
  "Not ready to deliver": "아직 전달할 수 없음",
  "Ready to deliver": "바로 전달 가능",
  "Recording…": "기록 중…",
  "Rune could not record this delivery outcome": "Rune이 전달 결과를 기록하지 못했습니다",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.":
    "Rune은 이 기기에 판단, 형식, 경과 시간, 소스 리비전 지문만 저장하며 문서 내용이나 프롬프트는 저장하지 않습니다.",
  Task: "작업",
  "The direction is right and only limited manual changes remain.": "방향은 맞으며 제한적인 수동 수정만 남았습니다.",
  "The numbers, structure, and language meet this task.": "수치, 구조, 표현이 이 작업의 요구를 충족합니다.",
  "usable or minor edits": "사용 가능 또는 가벼운 수정 필요",
});

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Proposal preview": "Aperçu de la proposition",
  "AI proposal · read-only until Apply": "Proposition de l’IA · lecture seule jusqu’à l’application",
  "Proposed source": "Source proposée",
  "Canonical source stays unchanged until Apply": "La source canonique reste inchangée jusqu’à l’application",
  "Proposal preview unavailable": "Aperçu de la proposition indisponible",
  "Proposed output · nothing written": "Résultat proposé · aucune écriture",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.":
    "Cette source est inchangée ; son résultat en direct est rendu à partir de l’espace de travail proposé complet.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Proposal preview": "Vista previa de la propuesta",
  "AI proposal · read-only until Apply": "Propuesta de IA · solo lectura hasta aplicar",
  "Proposed source": "Fuente propuesta",
  "Canonical source stays unchanged until Apply": "La fuente canónica permanece sin cambios hasta aplicar",
  "Proposal preview unavailable": "Vista previa de la propuesta no disponible",
  "Proposed output · nothing written": "Resultado propuesto · nada escrito",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.":
    "Esta fuente no cambia; su resultado en directo se renderiza con todo el espacio de trabajo propuesto.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Proposal preview": "Предпросмотр предложения",
  "AI proposal · read-only until Apply": "Предложение ИИ · только чтение до применения",
  "Proposed source": "Предлагаемый исходник",
  "Canonical source stays unchanged until Apply": "Канонический исходник не изменится до применения",
  "Proposal preview unavailable": "Предпросмотр предложения недоступен",
  "Proposed output · nothing written": "Предлагаемый результат · ничего не записано",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.":
    "Этот исходник не изменён; его живой результат построен на основе всего предлагаемого рабочего пространства.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Proposal preview": "معاينة الاقتراح",
  "AI proposal · read-only until Apply": "اقتراح الذكاء الاصطناعي · للقراءة فقط حتى التطبيق",
  "Proposed source": "المصدر المقترح",
  "Canonical source stays unchanged until Apply": "يبقى المصدر الأساسي بلا تغيير حتى التطبيق",
  "Proposal preview unavailable": "معاينة الاقتراح غير متاحة",
  "Proposed output · nothing written": "النتيجة المقترحة · لم تتم أي كتابة",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.":
    "هذا المصدر لم يتغير؛ وتُعرض نتيجته المباشرة استنادًا إلى مساحة العمل المقترحة كاملة.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Proposal preview": "提案プレビュー",
  "AI proposal · read-only until Apply": "AI の提案 · 適用するまで読み取り専用",
  "Proposed source": "提案されたソース",
  "Canonical source stays unchanged until Apply": "適用するまで正規ソースは変更されません",
  "Proposal preview unavailable": "提案をプレビューできません",
  "Proposed output · nothing written": "提案された成果物 · まだ書き込まれていません",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.":
    "このソース自体は変更されていません。ライブ成果物は提案されたワークスペース全体を基に再描画されています。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Proposal preview": "제안 미리보기",
  "AI proposal · read-only until Apply": "AI 제안 · 적용 전까지 읽기 전용",
  "Proposed source": "제안된 소스",
  "Canonical source stays unchanged until Apply": "적용 전까지 정규 소스는 변경되지 않습니다",
  "Proposal preview unavailable": "제안을 미리 볼 수 없음",
  "Proposed output · nothing written": "제안된 결과물 · 아직 쓰지 않음",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.":
    "이 소스 자체는 변경되지 않았으며, 실시간 결과물은 제안된 전체 작업 공간을 기준으로 렌더링됩니다.",
});

// Human-reviewed copy for the task-first onboarding and import continuation.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.":
    "Après cet import vérifié, Rune ouvre la configuration de la revue opérationnelle avec cette source Data déjà sélectionnée.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.":
    "Choisissez CSV, JSON, XLSX ou ODS. Rune affiche d’abord l’import, puis vous guide à travers les champs, les mesures, les graphiques et les livrables.",
  "Create a review from data": "Créer une revue à partir des données",
  "Import and map review": "Importer et configurer la revue",
  "Import data, then continue directly to mapping and output setup":
    "Importez les données, puis passez directement à l’association des champs et à la configuration des livrables",
  "Import real data, review it, then map fields, measures, and deliverables":
    "Importez des données réelles, vérifiez-les, puis associez les champs, les mesures et les livrables",
  "Next step": "Étape suivante",
  "Next: choose fields and deliverables": "Ensuite : choisissez les champs et les livrables",
  "Open files": "Ouvrir des fichiers",
  "Or open something else": "Ou ouvrir autre chose",
  "Start with a real operating review, or read the local guide and explore the complete sample first.":
    "Commencez par une vraie revue opérationnelle, ou lisez d’abord le guide local et explorez l’exemple complet.",
  "Start with a real outcome": "Commencer par un résultat concret",
  "Turn data into a verifiable review.": "Transformez les données en une revue vérifiable.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.":
    "Vous pouvez aussi déposer ici tout fichier pris en charge. Chaque conversion de compatibilité est vérifiée avant l’écriture.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.":
    "Después de esta importación revisada, Rune abre la configuración de la revisión operativa con esta fuente Data ya seleccionada.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.":
    "Elige CSV, JSON, XLSX u ODS. Rune muestra primero la importación y después te guía por los campos, las medidas, los gráficos y los entregables.",
  "Create a review from data": "Crear una revisión a partir de datos",
  "Import and map review": "Importar y configurar la revisión",
  "Import data, then continue directly to mapping and output setup":
    "Importa datos y pasa directamente a la asignación de campos y la configuración de entregables",
  "Import real data, review it, then map fields, measures, and deliverables":
    "Importa datos reales, revísalos y después asigna los campos, las medidas y los entregables",
  "Next step": "Siguiente paso",
  "Next: choose fields and deliverables": "A continuación: elige los campos y los entregables",
  "Open files": "Abrir archivos",
  "Or open something else": "O abre otro contenido",
  "Start with a real operating review, or read the local guide and explore the complete sample first.":
    "Empieza con una revisión operativa real, o lee primero la guía local y explora el ejemplo completo.",
  "Start with a real outcome": "Empieza por un resultado real",
  "Turn data into a verifiable review.": "Convierte los datos en una revisión verificable.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.":
    "También puedes arrastrar aquí cualquier archivo compatible. Cada conversión de compatibilidad se revisa antes de escribir.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.":
    "После подтверждения импорта Rune откроет настройку управленческого отчёта с уже выбранным источником Data.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.":
    "Выберите CSV, JSON, XLSX или ODS. Rune сначала покажет результат импорта, а затем проведёт по полям, показателям, диаграммам и результатам.",
  "Create a review from data": "Создать отчёт на основе данных",
  "Import and map review": "Импортировать и настроить отчёт",
  "Import data, then continue directly to mapping and output setup":
    "Импортируйте данные и сразу переходите к сопоставлению полей и настройке результатов",
  "Import real data, review it, then map fields, measures, and deliverables":
    "Импортируйте реальные данные, проверьте их, затем сопоставьте поля, показатели и результаты",
  "Next step": "Следующий шаг",
  "Next: choose fields and deliverables": "Далее: выберите поля и результаты",
  "Open files": "Открыть файлы",
  "Or open something else": "Или откройте другой материал",
  "Start with a real operating review, or read the local guide and explore the complete sample first.":
    "Начните с реального управленческого отчёта или сначала прочитайте локальное руководство и изучите полный пример.",
  "Start with a real outcome": "Начните с реального результата",
  "Turn data into a verifiable review.": "Превратите данные в проверяемый отчёт.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.":
    "Сюда также можно перетащить любой поддерживаемый файл. Каждое преобразование совместимости проверяется до записи.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.":
    "بعد تأكيد هذا الاستيراد، يفتح Rune إعداد المراجعة التشغيلية مع تحديد مصدر Data هذا مسبقًا.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.":
    "اختر CSV أو JSON أو XLSX أو ODS. يعرض Rune الاستيراد أولًا، ثم يرشدك عبر الحقول والمقاييس والمخططات والمخرجات.",
  "Create a review from data": "إنشاء مراجعة من البيانات",
  "Import and map review": "استيراد المراجعة وإعدادها",
  "Import data, then continue directly to mapping and output setup":
    "استورد البيانات، ثم انتقل مباشرة إلى ربط الحقول وإعداد المخرجات",
  "Import real data, review it, then map fields, measures, and deliverables":
    "استورد بيانات حقيقية وراجعها ثم اربط الحقول والمقاييس والمخرجات",
  "Next step": "الخطوة التالية",
  "Next: choose fields and deliverables": "التالي: اختر الحقول والمخرجات",
  "Open files": "فتح ملفات",
  "Or open something else": "أو افتح محتوى آخر",
  "Start with a real operating review, or read the local guide and explore the complete sample first.":
    "ابدأ بمراجعة تشغيلية حقيقية، أو اقرأ الدليل المحلي واستكشف المثال الكامل أولًا.",
  "Start with a real outcome": "ابدأ بنتيجة حقيقية",
  "Turn data into a verifiable review.": "حوّل البيانات إلى مراجعة قابلة للتحقق.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.":
    "يمكنك أيضًا إسقاط أي ملف مدعوم هنا. ستُراجع كل عملية تحويل توافقية قبل الكتابة.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.":
    "確認済みのインポート後、Rune はこの Data ソースを選択した状態で経営レビュー設定を開きます。",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.":
    "CSV、JSON、XLSX、ODS を選択してください。Rune はまずインポート内容を表示し、その後フィールド、指標、グラフ、成果物の設定へ案内します。",
  "Create a review from data": "データから経営レビューを作成",
  "Import and map review": "インポートしてレビューを設定",
  "Import data, then continue directly to mapping and output setup":
    "データをインポートし、そのままフィールドの対応付けと成果物の設定に進みます",
  "Import real data, review it, then map fields, measures, and deliverables":
    "実データをインポートして確認し、フィールド、指標、成果物を対応付けます",
  "Next step": "次のステップ",
  "Next: choose fields and deliverables": "次へ：フィールドと成果物を選択",
  "Open files": "ファイルを開く",
  "Or open something else": "または別の内容を開く",
  "Start with a real operating review, or read the local guide and explore the complete sample first.":
    "まず実際の経営レビューから始めるか、ローカルガイドを読んで完全なサンプルを確認してください。",
  "Start with a real outcome": "実際の成果から始める",
  "Turn data into a verifiable review.": "データを検証可能なレビューに変換。",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.":
    "対応ファイルをここにドロップすることもできます。互換変換は書き込み前に必ず確認できます。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.":
    "검토된 가져오기를 확인하면 Rune이 이 Data 소스를 미리 선택한 상태로 운영 리뷰 설정을 엽니다.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.":
    "CSV, JSON, XLSX 또는 ODS를 선택하세요. Rune이 먼저 가져오기 결과를 보여 준 다음 필드, 지표, 차트와 결과물 설정을 안내합니다.",
  "Create a review from data": "데이터로 운영 리뷰 만들기",
  "Import and map review": "가져와서 리뷰 설정",
  "Import data, then continue directly to mapping and output setup":
    "데이터를 가져온 뒤 바로 필드 연결과 결과물 설정으로 이동합니다",
  "Import real data, review it, then map fields, measures, and deliverables":
    "실제 데이터를 가져와 검토한 뒤 필드, 지표와 결과물을 연결합니다",
  "Next step": "다음 단계",
  "Next: choose fields and deliverables": "다음: 필드와 결과물 선택",
  "Open files": "파일 열기",
  "Or open something else": "또는 다른 콘텐츠 열기",
  "Start with a real operating review, or read the local guide and explore the complete sample first.":
    "실제 운영 리뷰로 시작하거나 로컬 가이드를 읽고 전체 예제를 먼저 살펴보세요.",
  "Start with a real outcome": "실제 결과에서 시작",
  "Turn data into a verifiable review.": "데이터를 검증 가능한 리뷰로 전환하세요.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.":
    "지원되는 파일을 여기에 놓을 수도 있습니다. 모든 호환 변환은 쓰기 전에 검토할 수 있습니다.",
});

// Human-reviewed copy for the Document-to-Presentation task. These strings stay
// curated because they describe source identity and the review-before-write contract.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.":
    "Après cet import vérifié, Rune ouvre la configuration de la présentation avec ce Document déjà sélectionné.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.":
    "Choisissez un document vérifié, un public et un objectif. Rune crée un Deck Markdown modifiable et conserve un lien explicite avec le document source.",
  "Create presentation from document": "Créer une présentation à partir d’un document",
  Customer: "Client",
  "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "Compilation locale déterministe · vérification avant écriture",
  "Document source": "Document source",
  "Document to presentation · source linked": "Document vers présentation · source liée",
  "Document-presentation task settings": "Réglages de la tâche document-présentation",
  "Editable output": "Résultat modifiable",
  "Existing exports": "Exports disponibles",
  "For example: Product launch briefing": "Par exemple : présentation de lancement produit",
  "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length":
    "Importez un document, vérifiez-le, puis choisissez le public, l’objectif et la longueur",
  "Import and shape presentation": "Importer et préparer la présentation",
  "Import Word, Markdown, or PDF, review it, then create a source-linked presentation":
    "Importez Word, Markdown ou PDF, vérifiez le contenu, puis créez une présentation liée à sa source",
  "Next: choose audience and presentation purpose": "Ensuite : choisissez le public et l’objectif de la présentation",
  "No usable Document in this workspace": "Aucun Document utilisable dans cet espace de travail",
  "Presentation length": "Longueur de la présentation",
  "Presentation title": "Titre de la présentation",
  slides: "diapositives",
  "Source identity": "Identité de la source",
  "State what the audience needs to understand and the decision the presentation should support.":
    "Indiquez ce que le public doit comprendre et la décision que la présentation doit soutenir.",
  Team: "Équipe",
  "Turn one document into a light presentation": "Transformez un document en une présentation légère",
  "Verifying source…": "Vérification de la source…",
  "What should this presentation move forward?": "Que doit faire avancer cette présentation ?",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.":
    "Después de esta importación revisada, Rune abre la configuración de la presentación con este Document ya seleccionado.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.":
    "Elige un documento revisado, el público y el objetivo. Rune crea un Deck Markdown editable y mantiene una relación explícita con el documento de origen.",
  "Create presentation from document": "Crear una presentación a partir de un documento",
  Customer: "Cliente",
  "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "Compilación local determinista · revisión antes de escribir",
  "Document source": "Documento de origen",
  "Document to presentation · source linked": "Documento a presentación · origen vinculado",
  "Document-presentation task settings": "Ajustes de la tarea documento-presentación",
  "Editable output": "Resultado editable",
  "Existing exports": "Exportaciones disponibles",
  "For example: Product launch briefing": "Por ejemplo: presentación del lanzamiento del producto",
  "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length":
    "Importa un documento, revísalo y elige el público, el objetivo y la extensión",
  "Import and shape presentation": "Importar y preparar la presentación",
  "Import Word, Markdown, or PDF, review it, then create a source-linked presentation":
    "Importa Word, Markdown o PDF, revísalo y crea una presentación vinculada a su origen",
  "Next: choose audience and presentation purpose": "A continuación: elige el público y el objetivo de la presentación",
  "No usable Document in this workspace": "No hay ningún Document utilizable en este espacio de trabajo",
  "Presentation length": "Extensión de la presentación",
  "Presentation title": "Título de la presentación",
  slides: "diapositivas",
  "Source identity": "Identidad del origen",
  "State what the audience needs to understand and the decision the presentation should support.":
    "Indica qué necesita comprender el público y qué decisión debe respaldar la presentación.",
  Team: "Equipo",
  "Turn one document into a light presentation": "Convierte un documento en una presentación ligera",
  "Verifying source…": "Verificando el origen…",
  "What should this presentation move forward?": "¿Qué debe impulsar esta presentación?",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.":
    "После подтверждения импорта Rune откроет настройку презентации с уже выбранным Document.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.":
    "Выберите проверенный документ, аудиторию и цель. Rune создаст редактируемый Deck Markdown и сохранит явную связь с исходным документом.",
  "Create presentation from document": "Создать презентацию из документа",
  Customer: "Клиенты",
  "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "Детерминированная локальная сборка · проверка до записи",
  "Document source": "Исходный документ",
  "Document to presentation · source linked": "Документ в презентацию · источник связан",
  "Document-presentation task settings": "Настройки задачи документ-презентация",
  "Editable output": "Редактируемый результат",
  "Existing exports": "Доступный экспорт",
  "For example: Product launch briefing": "Например: презентация запуска продукта",
  "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length":
    "Импортируйте документ, проверьте его, затем выберите аудиторию, цель и объём",
  "Import and shape presentation": "Импортировать и подготовить презентацию",
  "Import Word, Markdown, or PDF, review it, then create a source-linked presentation":
    "Импортируйте Word, Markdown или PDF, проверьте и создайте презентацию со связью с источником",
  "Next: choose audience and presentation purpose": "Далее: выберите аудиторию и цель презентации",
  "No usable Document in this workspace": "В рабочей области нет подходящего Document",
  "Presentation length": "Объём презентации",
  "Presentation title": "Название презентации",
  slides: "слайдов",
  "Source identity": "Идентификатор источника",
  "State what the audience needs to understand and the decision the presentation should support.":
    "Укажите, что должна понять аудитория и какое решение должна поддержать презентация.",
  Team: "Команда",
  "Turn one document into a light presentation": "Превратите документ в лёгкую презентацию",
  "Verifying source…": "Проверка источника…",
  "What should this presentation move forward?": "Какое решение должна продвинуть эта презентация?",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.":
    "بعد تأكيد هذا الاستيراد، يفتح Rune إعداد العرض مع تحديد هذا الـ Document مسبقًا.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.":
    "اختر مستندًا تمت مراجعته والجمهور والهدف. ينشئ Rune ملف Deck Markdown قابلًا للتحرير ويحافظ على علاقة صريحة بالمستند المصدر.",
  "Create presentation from document": "إنشاء عرض من مستند",
  Customer: "العميل",
  "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "تجميع محلي حتمي · مراجعة قبل الكتابة",
  "Document source": "المستند المصدر",
  "Document to presentation · source linked": "من مستند إلى عرض · المصدر مرتبط",
  "Document-presentation task settings": "إعدادات مهمة المستند إلى عرض",
  "Editable output": "مخرج قابل للتحرير",
  "Existing exports": "خيارات التصدير المتاحة",
  "For example: Product launch briefing": "مثل: موجز إطلاق المنتج",
  "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length":
    "استورد مستندًا وراجعه، ثم اختر الجمهور والهدف والطول",
  "Import and shape presentation": "استيراد العرض وإعداده",
  "Import Word, Markdown, or PDF, review it, then create a source-linked presentation":
    "استورد Word أو Markdown أو PDF وراجعه، ثم أنشئ عرضًا مرتبطًا بالمصدر",
  "Next: choose audience and presentation purpose": "التالي: اختر الجمهور وهدف العرض",
  "No usable Document in this workspace": "لا يوجد Document صالح في مساحة العمل",
  "Presentation length": "طول العرض",
  "Presentation title": "عنوان العرض",
  slides: "شرائح",
  "Source identity": "هوية المصدر",
  "State what the audience needs to understand and the decision the presentation should support.":
    "حدّد ما يحتاج الجمهور إلى فهمه والقرار الذي يجب أن يدعمه العرض.",
  Team: "الفريق",
  "Turn one document into a light presentation": "حوّل مستندًا واحدًا إلى عرض خفيف",
  "Verifying source…": "جارٍ التحقق من المصدر…",
  "What should this presentation move forward?": "ما الذي يجب أن يدفعه هذا العرض إلى الأمام؟",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.":
    "確認済みのインポート後、Rune はこの Document を選択した状態でプレゼンテーション設定を開きます。",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.":
    "確認済みの文書、対象者、目的を選択してください。Rune は編集可能な Deck Markdown を作成し、元文書との明示的な関係を保持します。",
  "Create presentation from document": "文書からプレゼンテーションを作成",
  Customer: "顧客",
  "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "決定的なローカルコンパイル · 書き込み前に確認",
  "Document source": "元文書",
  "Document to presentation · source linked": "文書からプレゼンへ · ソース連携",
  "Document-presentation task settings": "文書プレゼンテーションのタスク設定",
  "Editable output": "編集可能な成果物",
  "Existing exports": "利用可能な書き出し",
  "For example: Product launch briefing": "例：製品ローンチ説明会",
  "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length":
    "文書をインポートして確認し、対象者、目的、長さを選択します",
  "Import and shape presentation": "インポートしてプレゼンを構成",
  "Import Word, Markdown, or PDF, review it, then create a source-linked presentation":
    "Word、Markdown、PDF をインポートして確認し、元文書に紐づくプレゼンを作成します",
  "Next: choose audience and presentation purpose": "次へ：対象者とプレゼンの目的を選択",
  "No usable Document in this workspace": "このワークスペースに利用可能な Document がありません",
  "Presentation length": "プレゼンの長さ",
  "Presentation title": "プレゼンのタイトル",
  slides: "枚",
  "Source identity": "ソース ID",
  "State what the audience needs to understand and the decision the presentation should support.":
    "対象者に理解してほしいことと、プレゼンが支える判断を記述してください。",
  Team: "チーム",
  "Turn one document into a light presentation": "一つの文書を軽やかなプレゼンに",
  "Verifying source…": "ソースを検証中…",
  "What should this presentation move forward?": "このプレゼンで何を前に進めますか？",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.":
    "검토된 가져오기를 확인하면 Rune이 이 Document를 미리 선택한 상태로 프레젠테이션 설정을 엽니다.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.":
    "검토된 문서, 대상, 목적을 선택하세요. Rune이 편집 가능한 Deck Markdown을 만들고 원본 문서와의 명시적 관계를 유지합니다.",
  "Create presentation from document": "문서에서 프레젠테이션 만들기",
  Customer: "고객",
  "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "결정적 로컬 컴파일 · 쓰기 전 검토",
  "Document source": "원본 문서",
  "Document to presentation · source linked": "문서에서 프레젠테이션으로 · 소스 연결",
  "Document-presentation task settings": "문서 프레젠테이션 작업 설정",
  "Editable output": "편집 가능한 결과물",
  "Existing exports": "사용 가능한 내보내기",
  "For example: Product launch briefing": "예: 제품 출시 브리핑",
  "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length":
    "문서를 가져와 검토한 뒤 대상, 목적과 길이를 선택하세요",
  "Import and shape presentation": "가져와서 프레젠테이션 구성",
  "Import Word, Markdown, or PDF, review it, then create a source-linked presentation":
    "Word, Markdown 또는 PDF를 가져와 검토한 뒤 원본에 연결된 프레젠테이션을 만드세요",
  "Next: choose audience and presentation purpose": "다음: 대상과 프레젠테이션 목적 선택",
  "No usable Document in this workspace": "이 작업 공간에 사용할 수 있는 Document가 없습니다",
  "Presentation length": "프레젠테이션 길이",
  "Presentation title": "프레젠테이션 제목",
  slides: "슬라이드",
  "Source identity": "소스 ID",
  "State what the audience needs to understand and the decision the presentation should support.":
    "대상이 이해해야 할 내용과 프레젠테이션이 뒷받침할 결정을 적으세요.",
  Team: "팀",
  "Turn one document into a light presentation": "한 문서를 가벼운 프레젠테이션으로",
  "Verifying source…": "소스 확인 중…",
  "What should this presentation move forward?": "이 프레젠테이션으로 무엇을 진전시킬까요?",
});

// Human-reviewed refresh copy for repeatable source-linked presentations.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.":
    "Choisissez un document vérifié, un public et un objectif. Rune peut créer une présentation ou actualiser une présentation liée tout en conservant l’identité du fichier et sa relation avec la source.",
  "Create a new presentation": "Créer une nouvelle présentation",
  "Create or refresh a light presentation": "Créer ou actualiser une présentation légère",
  "New Deck Markdown": "Nouveau Deck Markdown",
  "Presentation destination": "Destination de la présentation",
  "Refresh linked presentation in place": "Actualiser la présentation liée sur place",
  "Update in place · identity preserved": "Mise à jour sur place · identité préservée",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.":
    "Elige un documento revisado, el público y el objetivo. Rune puede crear una presentación nueva o actualizar una vinculada conservando la identidad del archivo y su relación con el origen.",
  "Create a new presentation": "Crear una presentación nueva",
  "Create or refresh a light presentation": "Crear o actualizar una presentación ligera",
  "New Deck Markdown": "Nuevo Deck Markdown",
  "Presentation destination": "Destino de la presentación",
  "Refresh linked presentation in place": "Actualizar la presentación vinculada en el mismo archivo",
  "Update in place · identity preserved": "Actualización en el mismo archivo · identidad conservada",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.":
    "Выберите проверенный документ, аудиторию и цель. Rune может создать новую презентацию или обновить связанную, сохранив идентичность файла и связь с источником.",
  "Create a new presentation": "Создать новую презентацию",
  "Create or refresh a light presentation": "Создайте или обновите лёгкую презентацию",
  "New Deck Markdown": "Новый Deck Markdown",
  "Presentation destination": "Куда сохранить презентацию",
  "Refresh linked presentation in place": "Обновить связанную презентацию на месте",
  "Update in place · identity preserved": "Обновление на месте · идентичность сохранена",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.":
    "اختر مستندًا تمت مراجعته والجمهور والهدف. يستطيع Rune إنشاء عرض جديد أو تحديث عرض مرتبط مع الحفاظ على هوية الملف وعلاقته بالمصدر.",
  "Create a new presentation": "إنشاء عرض جديد",
  "Create or refresh a light presentation": "أنشئ عرضًا خفيفًا أو حدّثه",
  "New Deck Markdown": "Deck Markdown جديد",
  "Presentation destination": "وجهة العرض",
  "Refresh linked presentation in place": "تحديث العرض المرتبط في مكانه",
  "Update in place · identity preserved": "تحديث في المكان · الهوية محفوظة",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.":
    "確認済みの文書、対象者、目的を選択してください。Rune は新しいプレゼンテーションを作成することも、ファイル ID と元文書との関係を保ったまま既存の連携プレゼンテーションを更新することもできます。",
  "Create a new presentation": "新しいプレゼンテーションを作成",
  "Create or refresh a light presentation": "軽やかなプレゼンテーションを作成・更新",
  "New Deck Markdown": "新しい Deck Markdown",
  "Presentation destination": "プレゼンテーションの保存先",
  "Refresh linked presentation in place": "連携プレゼンテーションをそのまま更新",
  "Update in place · identity preserved": "同じファイルを更新 · ID を保持",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.":
    "검토된 문서, 대상, 목적을 선택하세요. Rune은 새 프레젠테이션을 만들거나 파일 ID와 원본 문서 관계를 유지한 채 연결된 프레젠테이션을 갱신할 수 있습니다.",
  "Create a new presentation": "새 프레젠테이션 만들기",
  "Create or refresh a light presentation": "가벼운 프레젠테이션 만들기 또는 갱신",
  "New Deck Markdown": "새 Deck Markdown",
  "Presentation destination": "프레젠테이션 대상",
  "Refresh linked presentation in place": "연결된 프레젠테이션을 제자리에서 갱신",
  "Update in place · identity preserved": "제자리 업데이트 · ID 유지",
});

// Human-reviewed source-freshness copy for linked presentations.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Source freshness": "Actualité de la source",
  "Refresh available": "Actualisation disponible",
  "Review refresh": "Vérifier l’actualisation",
  "This presentation no longer needs a source refresh":
    "Cette présentation n’a plus besoin d’être actualisée depuis sa source",
  "Source changed · refresh available": "Source modifiée · actualisation disponible",
  "Baseline not recorded": "Version de référence non enregistrée",
  "Current source revision will be recorded": "La version actuelle de la source sera enregistrée",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Source freshness": "Actualidad del origen",
  "Refresh available": "Actualización disponible",
  "Review refresh": "Revisar actualización",
  "This presentation no longer needs a source refresh": "Esta presentación ya no necesita actualizarse desde el origen",
  "Source changed · refresh available": "El origen cambió · actualización disponible",
  "Baseline not recorded": "Versión de referencia no registrada",
  "Current source revision will be recorded": "Se registrará la versión actual del origen",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Source freshness": "Актуальность источника",
  "Refresh available": "Доступно обновление",
  "Review refresh": "Проверить обновление",
  "This presentation no longer needs a source refresh": "Этой презентации больше не требуется обновление из источника",
  "Source changed · refresh available": "Источник изменён · доступно обновление",
  "Baseline not recorded": "Исходная версия не записана",
  "Current source revision will be recorded": "Текущая версия источника будет записана",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Source freshness": "حداثة المصدر",
  "Refresh available": "يتوفر تحديث",
  "Review refresh": "مراجعة التحديث",
  "This presentation no longer needs a source refresh": "لم يعد هذا العرض بحاجة إلى تحديث من المصدر",
  "Source changed · refresh available": "تغيّر المصدر · يتوفر تحديث",
  "Baseline not recorded": "لم يُسجّل الإصدار المرجعي",
  "Current source revision will be recorded": "سيُسجّل إصدار المصدر الحالي",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Source freshness": "ソースの更新状態",
  "Refresh available": "更新できます",
  "Review refresh": "更新を確認",
  "This presentation no longer needs a source refresh":
    "このプレゼンテーションは元文書から更新する必要がなくなりました",
  "Source changed · refresh available": "元文書が変更されました · 更新できます",
  "Baseline not recorded": "基準バージョンは未記録です",
  "Current source revision will be recorded": "現在のソース版を記録します",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Source freshness": "원본 최신 상태",
  "Refresh available": "갱신 가능",
  "Review refresh": "갱신 검토",
  "This presentation no longer needs a source refresh": "이 프레젠테이션은 더 이상 원본에서 갱신할 필요가 없습니다",
  "Source changed · refresh available": "원본 변경됨 · 갱신 가능",
  "Baseline not recorded": "기준 버전이 기록되지 않음",
  "Current source revision will be recorded": "현재 원본 버전을 기록합니다",
});

// Human-reviewed copy for the bounded model-assisted Document briefing planner.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Deterministic local compiler": "Compilateur local déterministe",
  "Deterministic local presentation prepared; nothing writes until review":
    "Présentation locale déterministe préparée ; aucune écriture avant vérification",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review":
    "Le document dépasse la limite de sécurité du contexte du modèle ; une présentation locale déterministe est prête à être vérifiée",
  "Model unavailable; deterministic local presentation prepared for review":
    "Modèle indisponible ; une présentation locale déterministe est prête à être vérifiée",
  "Model when available · bounded source evidence · deterministic local fallback":
    "Modèle si disponible · preuves sources limitées · repli local déterministe",
  "Model-assisted outline when available · Rune compile · review before write":
    "Plan assisté par modèle si disponible · compilation Rune · vérification avant écriture",
  "Model-assisted source outline": "Plan source assisté par modèle",
  "Model-assisted source-linked presentation prepared; nothing writes until review":
    "Présentation liée à la source et assistée par modèle préparée ; aucune écriture avant vérification",
  "Narrative planner": "Structure narrative",
  "Shaping and verifying…": "Structuration et vérification…",
  "The model is shaping this presentation from bounded source evidence…":
    "Le modèle structure cette présentation à partir de preuves sources limitées…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Deterministic local compiler": "Compilador local determinista",
  "Deterministic local presentation prepared; nothing writes until review":
    "Presentación local determinista preparada; no se escribe nada antes de revisarla",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review":
    "El documento supera el límite seguro de contexto del modelo; se ha preparado una presentación local determinista para revisión",
  "Model unavailable; deterministic local presentation prepared for review":
    "Modelo no disponible; se ha preparado una presentación local determinista para revisión",
  "Model when available · bounded source evidence · deterministic local fallback":
    "Modelo cuando esté disponible · evidencia de origen acotada · alternativa local determinista",
  "Model-assisted outline when available · Rune compile · review before write":
    "Esquema asistido por modelo cuando esté disponible · compilación de Rune · revisión antes de escribir",
  "Model-assisted source outline": "Esquema de origen asistido por modelo",
  "Model-assisted source-linked presentation prepared; nothing writes until review":
    "Presentación vinculada al origen y asistida por modelo preparada; no se escribe nada antes de revisarla",
  "Narrative planner": "Planificador narrativo",
  "Shaping and verifying…": "Estructurando y verificando…",
  "The model is shaping this presentation from bounded source evidence…":
    "El modelo está estructurando esta presentación con evidencia de origen acotada…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Deterministic local compiler": "Детерминированный локальный компилятор",
  "Deterministic local presentation prepared; nothing writes until review":
    "Локальная детерминированная презентация подготовлена; до проверки ничего не записывается",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review":
    "Документ превышает безопасный предел контекста модели; для проверки подготовлена локальная детерминированная презентация",
  "Model unavailable; deterministic local presentation prepared for review":
    "Модель недоступна; для проверки подготовлена локальная детерминированная презентация",
  "Model when available · bounded source evidence · deterministic local fallback":
    "Модель при наличии · ограниченные свидетельства источника · детерминированный локальный резерв",
  "Model-assisted outline when available · Rune compile · review before write":
    "План с помощью модели при наличии · компиляция Rune · проверка до записи",
  "Model-assisted source outline": "План источника с помощью модели",
  "Model-assisted source-linked presentation prepared; nothing writes until review":
    "Связанная с источником презентация с помощью модели подготовлена; до проверки ничего не записывается",
  "Narrative planner": "Планировщик повествования",
  "Shaping and verifying…": "Формирование и проверка…",
  "The model is shaping this presentation from bounded source evidence…":
    "Модель формирует презентацию на основе ограниченных свидетельств источника…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Deterministic local compiler": "مُصرّف محلي حتمي",
  "Deterministic local presentation prepared; nothing writes until review":
    "أُعد عرض محلي حتمي؛ لن يُكتب شيء قبل المراجعة",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review":
    "يتجاوز المستند حد أمان سياق النموذج؛ أُعد عرض محلي حتمي للمراجعة",
  "Model unavailable; deterministic local presentation prepared for review":
    "النموذج غير متاح؛ أُعد عرض محلي حتمي للمراجعة",
  "Model when available · bounded source evidence · deterministic local fallback":
    "النموذج عند توفره · أدلة مصدر محدودة · رجوع محلي حتمي",
  "Model-assisted outline when available · Rune compile · review before write":
    "مخطط بمساعدة النموذج عند توفره · تجميع Rune · مراجعة قبل الكتابة",
  "Model-assisted source outline": "مخطط مصدر بمساعدة النموذج",
  "Model-assisted source-linked presentation prepared; nothing writes until review":
    "أُعد عرض مرتبط بالمصدر بمساعدة النموذج؛ لن يُكتب شيء قبل المراجعة",
  "Narrative planner": "مخطط السرد",
  "Shaping and verifying…": "جارٍ التشكيل والتحقق…",
  "The model is shaping this presentation from bounded source evidence…":
    "يشكّل النموذج هذا العرض من أدلة مصدر محدودة…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Deterministic local compiler": "決定的なローカルコンパイラ",
  "Deterministic local presentation prepared; nothing writes until review":
    "決定的なローカルプレゼンテーションを準備しました。確認するまで書き込みません",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review":
    "文書がモデルの安全なコンテキスト上限を超えています。確認用に決定的なローカルプレゼンテーションを準備しました",
  "Model unavailable; deterministic local presentation prepared for review":
    "モデルを利用できません。確認用に決定的なローカルプレゼンテーションを準備しました",
  "Model when available · bounded source evidence · deterministic local fallback":
    "利用可能な場合はモデル · 範囲を限定したソース根拠 · 決定的なローカル代替",
  "Model-assisted outline when available · Rune compile · review before write":
    "利用可能な場合はモデル支援アウトライン · Rune がコンパイル · 書き込み前に確認",
  "Model-assisted source outline": "モデル支援のソースアウトライン",
  "Model-assisted source-linked presentation prepared; nothing writes until review":
    "モデル支援のソース連携プレゼンテーションを準備しました。確認するまで書き込みません",
  "Narrative planner": "構成プランナー",
  "Shaping and verifying…": "構成して検証中…",
  "The model is shaping this presentation from bounded source evidence…":
    "モデルが範囲を限定したソース根拠からプレゼンテーションを構成しています…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Deterministic local compiler": "결정적 로컬 컴파일러",
  "Deterministic local presentation prepared; nothing writes until review":
    "결정적 로컬 프레젠테이션을 준비했습니다. 검토 전에는 쓰지 않습니다",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review":
    "문서가 모델 컨텍스트 안전 한도를 초과했습니다. 검토할 결정적 로컬 프레젠테이션을 준비했습니다",
  "Model unavailable; deterministic local presentation prepared for review":
    "모델을 사용할 수 없습니다. 검토할 결정적 로컬 프레젠테이션을 준비했습니다",
  "Model when available · bounded source evidence · deterministic local fallback":
    "사용 가능할 때 모델 · 범위가 제한된 원본 근거 · 결정적 로컬 대체",
  "Model-assisted outline when available · Rune compile · review before write":
    "사용 가능할 때 모델 보조 개요 · Rune 컴파일 · 쓰기 전 검토",
  "Model-assisted source outline": "모델 보조 원본 개요",
  "Model-assisted source-linked presentation prepared; nothing writes until review":
    "모델 보조 원본 연결 프레젠테이션을 준비했습니다. 검토 전에는 쓰지 않습니다",
  "Narrative planner": "내러티브 플래너",
  "Shaping and verifying…": "구성하고 확인하는 중…",
  "The model is shaping this presentation from bounded source evidence…":
    "모델이 범위가 제한된 원본 근거로 프레젠테이션을 구성하고 있습니다…",
});

// Human-reviewed copy for the bounded model-assisted operating-review planner.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Bounded aggregates to your model · review before write":
    "Agrégats limités transmis à votre modèle · vérification avant écriture",
  "Data exceeds the model context safety limit; deterministic local operating review prepared for review":
    "Les données dépassent la limite de sécurité du contexte du modèle ; une revue opérationnelle locale déterministe est prête à être vérifiée",
  "Deterministic local operating review prepared; nothing writes until review":
    "Revue opérationnelle locale déterministe préparée ; aucune écriture avant vérification",
  "Model unavailable; deterministic local operating review prepared for review":
    "Modèle indisponible ; une revue opérationnelle locale déterministe est prête à être vérifiée",
  "Model when available · bounded aggregates only · deterministic local fallback":
    "Modèle si disponible · agrégats limités uniquement · repli local déterministe",
  "Model-assisted evidence questions": "Questions fondées sur les preuves assistées par modèle",
  "Model-assisted operating review prepared with live-bound numbers; nothing writes until review":
    "Revue opérationnelle assistée par modèle préparée avec des chiffres liés en direct ; aucune écriture avant vérification",
  "One atomic transaction · compiled locally": "Une transaction atomique · compilée en local",
  "Review-question planner": "Planificateur de questions de revue",
  "The model is preparing review questions from bounded aggregate evidence…":
    "Le modèle prépare des questions de revue à partir de preuves agrégées limitées…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Bounded aggregates to your model · review before write":
    "Agregados acotados para tu modelo · revisión antes de escribir",
  "Data exceeds the model context safety limit; deterministic local operating review prepared for review":
    "Los datos superan el límite seguro de contexto del modelo; se ha preparado una revisión operativa local determinista para su revisión",
  "Deterministic local operating review prepared; nothing writes until review":
    "Revisión operativa local determinista preparada; no se escribe nada antes de revisarla",
  "Model unavailable; deterministic local operating review prepared for review":
    "Modelo no disponible; se ha preparado una revisión operativa local determinista para su revisión",
  "Model when available · bounded aggregates only · deterministic local fallback":
    "Modelo cuando esté disponible · solo agregados acotados · alternativa local determinista",
  "Model-assisted evidence questions": "Preguntas sobre la evidencia asistidas por modelo",
  "Model-assisted operating review prepared with live-bound numbers; nothing writes until review":
    "Revisión operativa asistida por modelo preparada con cifras vinculadas en vivo; no se escribe nada antes de revisarla",
  "One atomic transaction · compiled locally": "Una transacción atómica · compilada localmente",
  "Review-question planner": "Planificador de preguntas de revisión",
  "The model is preparing review questions from bounded aggregate evidence…":
    "El modelo está preparando preguntas de revisión a partir de evidencia agregada acotada…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Bounded aggregates to your model · review before write":
    "Ограниченные агрегаты для вашей модели · проверка до записи",
  "Data exceeds the model context safety limit; deterministic local operating review prepared for review":
    "Данные превышают безопасный предел контекста модели; для проверки подготовлен локальный детерминированный операционный обзор",
  "Deterministic local operating review prepared; nothing writes until review":
    "Локальный детерминированный операционный обзор подготовлен; до проверки ничего не записывается",
  "Model unavailable; deterministic local operating review prepared for review":
    "Модель недоступна; для проверки подготовлен локальный детерминированный операционный обзор",
  "Model when available · bounded aggregates only · deterministic local fallback":
    "Модель при наличии · только ограниченные агрегаты · детерминированный локальный резерв",
  "Model-assisted evidence questions": "Вопросы по доказательствам с помощью модели",
  "Model-assisted operating review prepared with live-bound numbers; nothing writes until review":
    "Операционный обзор с помощью модели и живыми числовыми связями подготовлен; до проверки ничего не записывается",
  "One atomic transaction · compiled locally": "Одна атомарная транзакция · локальная компиляция",
  "Review-question planner": "Планировщик вопросов обзора",
  "The model is preparing review questions from bounded aggregate evidence…":
    "Модель готовит вопросы обзора на основе ограниченных агрегированных доказательств…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Bounded aggregates to your model · review before write": "تجميعات محدودة إلى نموذجك · مراجعة قبل الكتابة",
  "Data exceeds the model context safety limit; deterministic local operating review prepared for review":
    "تتجاوز البيانات حد أمان سياق النموذج؛ أُعدت مراجعة تشغيلية محلية حتمية للمراجعة",
  "Deterministic local operating review prepared; nothing writes until review":
    "أُعدت مراجعة تشغيلية محلية حتمية؛ لن يُكتب شيء قبل المراجعة",
  "Model unavailable; deterministic local operating review prepared for review":
    "النموذج غير متاح؛ أُعدت مراجعة تشغيلية محلية حتمية للمراجعة",
  "Model when available · bounded aggregates only · deterministic local fallback":
    "النموذج عند توفره · تجميعات محدودة فقط · رجوع محلي حتمي",
  "Model-assisted evidence questions": "أسئلة أدلة بمساعدة النموذج",
  "Model-assisted operating review prepared with live-bound numbers; nothing writes until review":
    "أُعدت مراجعة تشغيلية بمساعدة النموذج بأرقام مرتبطة مباشرة؛ لن يُكتب شيء قبل المراجعة",
  "One atomic transaction · compiled locally": "معاملة ذرية واحدة · مجمّعة محليًا",
  "Review-question planner": "مخطط أسئلة المراجعة",
  "The model is preparing review questions from bounded aggregate evidence…":
    "يُعد النموذج أسئلة مراجعة من أدلة تجميعية محدودة…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Bounded aggregates to your model · review before write": "範囲を限定した集計をモデルへ · 書き込み前に確認",
  "Data exceeds the model context safety limit; deterministic local operating review prepared for review":
    "データがモデルの安全なコンテキスト上限を超えています。確認用に決定的なローカル業務レビューを準備しました",
  "Deterministic local operating review prepared; nothing writes until review":
    "決定的なローカル業務レビューを準備しました。確認するまで書き込みません",
  "Model unavailable; deterministic local operating review prepared for review":
    "モデルを利用できません。確認用に決定的なローカル業務レビューを準備しました",
  "Model when available · bounded aggregates only · deterministic local fallback":
    "利用可能な場合はモデル · 範囲を限定した集計のみ · 決定的なローカル代替",
  "Model-assisted evidence questions": "モデル支援の根拠確認質問",
  "Model-assisted operating review prepared with live-bound numbers; nothing writes until review":
    "ライブ連携された数値を使うモデル支援業務レビューを準備しました。確認するまで書き込みません",
  "One atomic transaction · compiled locally": "一つのアトミックなトランザクション · ローカルでコンパイル",
  "Review-question planner": "レビュー質問プランナー",
  "The model is preparing review questions from bounded aggregate evidence…":
    "モデルが範囲を限定した集計根拠からレビュー質問を準備しています…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Bounded aggregates to your model · review before write": "범위가 제한된 집계를 모델로 전송 · 쓰기 전 검토",
  "Data exceeds the model context safety limit; deterministic local operating review prepared for review":
    "데이터가 모델 컨텍스트 안전 한도를 초과했습니다. 검토할 결정적 로컬 운영 리뷰를 준비했습니다",
  "Deterministic local operating review prepared; nothing writes until review":
    "결정적 로컬 운영 리뷰를 준비했습니다. 검토 전에는 쓰지 않습니다",
  "Model unavailable; deterministic local operating review prepared for review":
    "모델을 사용할 수 없습니다. 검토할 결정적 로컬 운영 리뷰를 준비했습니다",
  "Model when available · bounded aggregates only · deterministic local fallback":
    "사용 가능할 때 모델 · 범위가 제한된 집계만 · 결정적 로컬 대체",
  "Model-assisted evidence questions": "모델 보조 근거 검토 질문",
  "Model-assisted operating review prepared with live-bound numbers; nothing writes until review":
    "실시간 연결 수치를 사용하는 모델 보조 운영 리뷰를 준비했습니다. 검토 전에는 쓰지 않습니다",
  "One atomic transaction · compiled locally": "하나의 원자적 트랜잭션 · 로컬 컴파일",
  "Review-question planner": "리뷰 질문 플래너",
  "The model is preparing review questions from bounded aggregate evidence…":
    "모델이 범위가 제한된 집계 근거에서 리뷰 질문을 준비하고 있습니다…",
});

// Human-reviewed copy for exact Data scope selection in repeatable operating reviews.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Data scope": "Périmètre des données",
  "All Data rows": "Toutes les lignes de données",
  "Exact scope value": "Valeur exacte du périmètre",
  "Choose one value": "Choisir une valeur",
  "No usable value in this field": "Aucune valeur utilisable dans ce champ",
  "Optional. When selected, local evidence, SQL, charts, and model context use only exact matching rows.":
    "Facultatif. Une fois sélectionné, les preuves locales, SQL, les graphiques et le contexte du modèle utilisent uniquement les lignes qui correspondent exactement.",
  "Only the first 100 distinct values are shown; choose a lower-cardinality period field if needed.":
    "Seules les 100 premières valeurs distinctes sont affichées ; choisissez si nécessaire un champ de période avec moins de valeurs distinctes.",
  "Choose one exact scope value, or return to all Data rows.":
    "Choisissez une valeur exacte pour le périmètre, ou revenez à toutes les lignes de données.",
  "Only fields that are numeric throughout the current Data scope are shown.":
    "Seuls les champs numériques dans tout le périmètre de données actuel sont affichés.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Data scope": "Ámbito de los datos",
  "All Data rows": "Todas las filas de datos",
  "Exact scope value": "Valor exacto del ámbito",
  "Choose one value": "Elige un valor",
  "No usable value in this field": "No hay valores utilizables en este campo",
  "Optional. When selected, local evidence, SQL, charts, and model context use only exact matching rows.":
    "Opcional. Al seleccionarlo, la evidencia local, SQL, los gráficos y el contexto del modelo usan solo las filas que coinciden exactamente.",
  "Only the first 100 distinct values are shown; choose a lower-cardinality period field if needed.":
    "Solo se muestran los primeros 100 valores distintos; si hace falta, elige un campo de periodo con menos valores distintos.",
  "Choose one exact scope value, or return to all Data rows.":
    "Elige un valor exacto para el ámbito o vuelve a todas las filas de datos.",
  "Only fields that are numeric throughout the current Data scope are shown.":
    "Solo se muestran los campos que son numéricos en todo el ámbito de datos actual.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Data scope": "Область данных",
  "All Data rows": "Все строки данных",
  "Exact scope value": "Точное значение области",
  "Choose one value": "Выберите значение",
  "No usable value in this field": "В этом поле нет подходящих значений",
  "Optional. When selected, local evidence, SQL, charts, and model context use only exact matching rows.":
    "Необязательно. После выбора локальные доказательства, SQL, диаграммы и контекст модели используют только строки с точным совпадением.",
  "Only the first 100 distinct values are shown; choose a lower-cardinality period field if needed.":
    "Показаны только первые 100 уникальных значений; при необходимости выберите поле периода с меньшим числом значений.",
  "Choose one exact scope value, or return to all Data rows.":
    "Выберите точное значение области или вернитесь ко всем строкам данных.",
  "Only fields that are numeric throughout the current Data scope are shown.":
    "Показаны только поля, которые являются числовыми во всей текущей области данных.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Data scope": "نطاق البيانات",
  "All Data rows": "كل صفوف البيانات",
  "Exact scope value": "قيمة النطاق المطابقة",
  "Choose one value": "اختر قيمة واحدة",
  "No usable value in this field": "لا توجد قيمة صالحة في هذا الحقل",
  "Optional. When selected, local evidence, SQL, charts, and model context use only exact matching rows.":
    "اختياري. عند التحديد، تستخدم الأدلة المحلية وSQL والرسوم البيانية وسياق النموذج الصفوف المطابقة تمامًا فقط.",
  "Only the first 100 distinct values are shown; choose a lower-cardinality period field if needed.":
    "تظهر أول 100 قيمة مختلفة فقط؛ اختر حقل فترة بعدد قيم أقل عند الحاجة.",
  "Choose one exact scope value, or return to all Data rows.": "اختر قيمة نطاق مطابقة، أو عُد إلى كل صفوف البيانات.",
  "Only fields that are numeric throughout the current Data scope are shown.":
    "تظهر فقط الحقول الرقمية في كامل نطاق البيانات الحالي.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Data scope": "データ範囲",
  "All Data rows": "すべてのデータ行",
  "Exact scope value": "完全一致する範囲値",
  "Choose one value": "値を選択",
  "No usable value in this field": "このフィールドに使用できる値がありません",
  "Optional. When selected, local evidence, SQL, charts, and model context use only exact matching rows.":
    "任意です。選択すると、ローカルの根拠、SQL、グラフ、モデルコンテキストには完全一致する行だけを使用します。",
  "Only the first 100 distinct values are shown; choose a lower-cardinality period field if needed.":
    "異なる値は先頭100件だけ表示します。必要に応じて、値の種類が少ない期間フィールドを選択してください。",
  "Choose one exact scope value, or return to all Data rows.":
    "完全一致する範囲値を選ぶか、すべてのデータ行に戻してください。",
  "Only fields that are numeric throughout the current Data scope are shown.":
    "現在のデータ範囲全体で数値になっているフィールドだけを表示します。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Data scope": "데이터 범위",
  "All Data rows": "모든 데이터 행",
  "Exact scope value": "정확히 일치하는 범위 값",
  "Choose one value": "값 선택",
  "No usable value in this field": "이 필드에 사용할 수 있는 값이 없습니다",
  "Optional. When selected, local evidence, SQL, charts, and model context use only exact matching rows.":
    "선택 사항입니다. 선택하면 로컬 근거, SQL, 차트, 모델 컨텍스트는 정확히 일치하는 행만 사용합니다.",
  "Only the first 100 distinct values are shown; choose a lower-cardinality period field if needed.":
    "서로 다른 값은 처음 100개만 표시합니다. 필요하면 값 종류가 더 적은 기간 필드를 선택하세요.",
  "Choose one exact scope value, or return to all Data rows.":
    "정확히 일치하는 범위 값을 선택하거나 모든 데이터 행으로 돌아가세요.",
  "Only fields that are numeric throughout the current Data scope are shown.":
    "현재 데이터 범위 전체에서 숫자인 필드만 표시합니다.",
});

// Human-reviewed copy for the compiler-derived pre-model evidence preview.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Aggregate evidence preview": "Aperçu des preuves agrégées",
  "Rune compiled these results locally from the current scope before any model request.":
    "Rune a compilé ces résultats localement à partir du périmètre actuel, avant toute requête au modèle.",
  "Eligible rows": "Lignes retenues",
  "Excluded rows": "Lignes exclues",
  "Source rows": "Lignes source",
  Showing: "Affichage de",
  of: "sur",
  groups: "groupes",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Aggregate evidence preview": "Vista previa de evidencia agregada",
  "Rune compiled these results locally from the current scope before any model request.":
    "Rune compiló estos resultados localmente a partir del ámbito actual, antes de cualquier solicitud al modelo.",
  "Eligible rows": "Filas incluidas",
  "Excluded rows": "Filas excluidas",
  "Source rows": "Filas de origen",
  Showing: "Mostrando",
  of: "de",
  groups: "grupos",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Aggregate evidence preview": "Предпросмотр агрегированных доказательств",
  "Rune compiled these results locally from the current scope before any model request.":
    "Rune локально скомпилировал эти результаты для текущей области до любого запроса к модели.",
  "Eligible rows": "Учтённые строки",
  "Excluded rows": "Исключённые строки",
  "Source rows": "Строки источника",
  Showing: "Показано",
  of: "из",
  groups: "групп",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Aggregate evidence preview": "معاينة الأدلة المجمّعة",
  "Rune compiled these results locally from the current scope before any model request.":
    "جمّع Rune هذه النتائج محليًا من نطاق البيانات الحالي قبل إرسال أي طلب إلى النموذج.",
  "Eligible rows": "الصفوف المشمولة",
  "Excluded rows": "الصفوف المستبعدة",
  "Source rows": "صفوف المصدر",
  Showing: "عرض",
  of: "من",
  groups: "مجموعات",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Aggregate evidence preview": "集計根拠のプレビュー",
  "Rune compiled these results locally from the current scope before any model request.":
    "Rune はモデルへリクエストする前に、現在のデータ範囲からこの結果をローカルで集計しました。",
  "Eligible rows": "対象行",
  "Excluded rows": "除外行",
  "Source rows": "元の行数",
  Showing: "表示",
  of: "/",
  groups: "件",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Aggregate evidence preview": "집계 근거 미리보기",
  "Rune compiled these results locally from the current scope before any model request.":
    "Rune이 모델에 요청하기 전에 현재 데이터 범위에서 이 결과를 로컬로 집계했습니다.",
  "Eligible rows": "포함된 행",
  "Excluded rows": "제외된 행",
  "Source rows": "원본 행",
  Showing: "표시",
  of: "/",
  groups: "개 그룹",
});

// Human-reviewed copy for paired exact-scope comparisons.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Compare with": "Comparer avec",
  "No comparison": "Aucune comparaison",
  "Comparison rows": "Lignes de comparaison",
  Change: "Variation",
  "Optional. Compare another exact value from the same field; change is primary minus comparison.":
    "Facultatif. Comparez une autre valeur exacte du même champ ; la variation correspond à la valeur principale moins la valeur de comparaison.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Compare with": "Comparar con",
  "No comparison": "Sin comparación",
  "Comparison rows": "Filas de comparación",
  Change: "Cambio",
  "Optional. Compare another exact value from the same field; change is primary minus comparison.":
    "Opcional. Compara otro valor exacto del mismo campo; el cambio es el valor principal menos el de comparación.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Compare with": "Сравнить с",
  "No comparison": "Без сравнения",
  "Comparison rows": "Строки сравнения",
  Change: "Изменение",
  "Optional. Compare another exact value from the same field; change is primary minus comparison.":
    "Необязательно. Сравните с другим точным значением того же поля; изменение равно основному значению минус сравнительное.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Compare with": "المقارنة مع",
  "No comparison": "بلا مقارنة",
  "Comparison rows": "صفوف المقارنة",
  Change: "التغيّر",
  "Optional. Compare another exact value from the same field; change is primary minus comparison.":
    "اختياري. قارن بقيمة مطابقة أخرى من الحقل نفسه؛ التغيّر هو القيمة الأساسية ناقص قيمة المقارنة.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Compare with": "比較対象",
  "No comparison": "比較しない",
  "Comparison rows": "比較対象の行",
  Change: "変化",
  "Optional. Compare another exact value from the same field; change is primary minus comparison.":
    "任意です。同じフィールドの別の完全一致値と比較します。変化は主範囲から比較範囲を引いて算出します。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Compare with": "비교 대상",
  "No comparison": "비교 안 함",
  "Comparison rows": "비교 행",
  Change: "변화",
  "Optional. Compare another exact value from the same field; change is primary minus comparison.":
    "선택 사항입니다. 같은 필드의 다른 정확한 값과 비교하며, 변화는 기본 범위에서 비교 범위를 뺀 값입니다.",
});

// Human-reviewed copy for optional seven-dimensional real-task evaluation.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "A sample counts only when every score is complete and the content is confirmed as authorized or redacted. A score of 1 needs work; 5 is excellent.":
    "Un échantillon n’est comptabilisé que si toutes les notes sont renseignées et si le contenu est confirmé comme autorisé ou anonymisé. Une note de 1 indique un résultat à améliorer ; 5, un excellent résultat.",
  "Add a detailed real-task evaluation": "Ajouter une évaluation détaillée sur une tâche réelle",
  "Change comprehensibility": "Compréhension des modifications",
  "Conclusion usefulness": "Utilité des conclusions",
  "Conclusions trace to sufficient supporting evidence.":
    "Les conclusions s’appuient sur des éléments probants suffisants.",
  "Detailed evaluation": "Évaluation détaillée",
  "Evidence completeness": "Exhaustivité des preuves",
  "I confirm this task is authorized for evaluation or its content is redacted.":
    "Je confirme que cette tâche est autorisée pour l’évaluation ou que son contenu a été anonymisé.",
  "Information hierarchy is clear and easy to scan.":
    "La hiérarchie de l’information est claire et facile à parcourir.",
  "Insights support a useful next decision.": "Les enseignements facilitent la prochaine décision.",
  "number checks below 4": "contrôles numériques inférieurs à 4",
  "Number correctness": "Exactitude des chiffres",
  "Number correctness below 4 always remains a visible blocker and is never hidden inside an average.":
    "Une exactitude des chiffres inférieure à 4 reste toujours un point bloquant visible et n’est jamais masquée dans une moyenne.",
  "Optional · seven dimensions · about one minute": "Facultatif · sept dimensions · environ une minute",
  "Overall time saved": "Gain de temps global",
  "real tasks reviewed": "tâches réelles évaluées",
  "Real-task evaluation": "Évaluation sur une tâche réelle",
  "Structure clarity": "Clarté de la structure",
  "The layout is usable without material rework.": "La mise en page est utilisable sans reprise importante.",
  "The result saves meaningful time over manual work.":
    "Le résultat fait gagner un temps notable par rapport au travail manuel.",
  "The user can understand what Rune changed and why.":
    "L’utilisateur peut comprendre ce que Rune a modifié et pourquoi.",
  "Values, definitions, and calculations are accurate.": "Les valeurs, les définitions et les calculs sont exacts.",
  "Visual deliverability": "Qualité visuelle livrable",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "A sample counts only when every score is complete and the content is confirmed as authorized or redacted. A score of 1 needs work; 5 is excellent.":
    "Una muestra solo cuenta cuando todas las puntuaciones están completas y se confirma que el contenido está autorizado o anonimizado. Un 1 necesita mejoras; un 5 es excelente.",
  "Add a detailed real-task evaluation": "Añadir una evaluación detallada de la tarea real",
  "Change comprehensibility": "Comprensión de los cambios",
  "Conclusion usefulness": "Utilidad de las conclusiones",
  "Conclusions trace to sufficient supporting evidence.": "Las conclusiones se apoyan en pruebas suficientes.",
  "Detailed evaluation": "Evaluación detallada",
  "Evidence completeness": "Integridad de las pruebas",
  "I confirm this task is authorized for evaluation or its content is redacted.":
    "Confirmo que esta tarea está autorizada para evaluación o que su contenido está anonimizado.",
  "Information hierarchy is clear and easy to scan.": "La jerarquía de la información es clara y fácil de revisar.",
  "Insights support a useful next decision.": "Los hallazgos ayudan a tomar una siguiente decisión útil.",
  "number checks below 4": "comprobaciones numéricas por debajo de 4",
  "Number correctness": "Exactitud numérica",
  "Number correctness below 4 always remains a visible blocker and is never hidden inside an average.":
    "Una exactitud numérica inferior a 4 siempre permanece como bloqueo visible y nunca se oculta en un promedio.",
  "Optional · seven dimensions · about one minute": "Opcional · siete dimensiones · alrededor de un minuto",
  "Overall time saved": "Ahorro de tiempo total",
  "real tasks reviewed": "tareas reales evaluadas",
  "Real-task evaluation": "Evaluación de tarea real",
  "Structure clarity": "Claridad de la estructura",
  "The layout is usable without material rework.": "El diseño puede usarse sin una reelaboración importante.",
  "The result saves meaningful time over manual work.":
    "El resultado ahorra un tiempo significativo frente al trabajo manual.",
  "The user can understand what Rune changed and why.": "El usuario puede entender qué cambió Rune y por qué.",
  "Values, definitions, and calculations are accurate.": "Los valores, las definiciones y los cálculos son correctos.",
  "Visual deliverability": "Calidad visual entregable",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "A sample counts only when every score is complete and the content is confirmed as authorized or redacted. A score of 1 needs work; 5 is excellent.":
    "Пример учитывается только после заполнения всех оценок и подтверждения, что содержимое разрешено для оценки или обезличено. 1 означает, что нужна доработка; 5 — отличный результат.",
  "Add a detailed real-task evaluation": "Добавить подробную оценку реальной задачи",
  "Change comprehensibility": "Понятность изменений",
  "Conclusion usefulness": "Полезность выводов",
  "Conclusions trace to sufficient supporting evidence.": "Выводы опираются на достаточные подтверждающие данные.",
  "Detailed evaluation": "Подробная оценка",
  "Evidence completeness": "Полнота доказательств",
  "I confirm this task is authorized for evaluation or its content is redacted.":
    "Подтверждаю, что задача разрешена для оценки или её содержимое обезличено.",
  "Information hierarchy is clear and easy to scan.": "Иерархия информации ясна, материал легко просматривать.",
  "Insights support a useful next decision.": "Выводы помогают принять следующее полезное решение.",
  "number checks below 4": "оценок точности чисел ниже 4",
  "Number correctness": "Точность чисел",
  "Number correctness below 4 always remains a visible blocker and is never hidden inside an average.":
    "Оценка точности чисел ниже 4 всегда остаётся видимым препятствием и не скрывается в среднем значении.",
  "Optional · seven dimensions · about one minute": "Необязательно · семь критериев · около минуты",
  "Overall time saved": "Общая экономия времени",
  "real tasks reviewed": "реальных задач оценено",
  "Real-task evaluation": "Оценка реальной задачи",
  "Structure clarity": "Ясность структуры",
  "The layout is usable without material rework.": "Макет пригоден без существенной переработки.",
  "The result saves meaningful time over manual work.":
    "Результат заметно экономит время по сравнению с ручной работой.",
  "The user can understand what Rune changed and why.": "Пользователь понимает, что и почему изменил Rune.",
  "Values, definitions, and calculations are accurate.": "Значения, определения и расчёты точны.",
  "Visual deliverability": "Визуальная готовность к передаче",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "A sample counts only when every score is complete and the content is confirmed as authorized or redacted. A score of 1 needs work; 5 is excellent.":
    "لا تُحتسب العينة إلا بعد اكتمال جميع الدرجات والتأكيد بأن المحتوى مصرح به للتقييم أو منقح. الدرجة 1 تعني أنه يحتاج إلى تحسين، و5 تعني ممتاز.",
  "Add a detailed real-task evaluation": "إضافة تقييم مفصل لمهمة حقيقية",
  "Change comprehensibility": "وضوح التغييرات",
  "Conclusion usefulness": "فائدة الاستنتاجات",
  "Conclusions trace to sufficient supporting evidence.": "تستند الاستنتاجات إلى أدلة داعمة كافية.",
  "Detailed evaluation": "تقييم مفصل",
  "Evidence completeness": "اكتمال الأدلة",
  "I confirm this task is authorized for evaluation or its content is redacted.":
    "أؤكد أن هذه المهمة مصرح بتقييمها أو أن محتواها منقح.",
  "Information hierarchy is clear and easy to scan.": "التسلسل الهرمي للمعلومات واضح وسهل التصفح.",
  "Insights support a useful next decision.": "تدعم الرؤى اتخاذ قرار تالٍ مفيد.",
  "number checks below 4": "تقييمات دقة الأرقام دون 4",
  "Number correctness": "دقة الأرقام",
  "Number correctness below 4 always remains a visible blocker and is never hidden inside an average.":
    "تظل دقة الأرقام الأقل من 4 عائقًا ظاهرًا دائمًا ولا تُخفى داخل المتوسط.",
  "Optional · seven dimensions · about one minute": "اختياري · سبعة أبعاد · نحو دقيقة",
  "Overall time saved": "إجمالي الوقت الموفر",
  "real tasks reviewed": "مهام حقيقية جرى تقييمها",
  "Real-task evaluation": "تقييم مهمة حقيقية",
  "Structure clarity": "وضوح البنية",
  "The layout is usable without material rework.": "التخطيط قابل للاستخدام دون إعادة عمل جوهرية.",
  "The result saves meaningful time over manual work.": "توفر النتيجة وقتًا ملحوظًا مقارنة بالعمل اليدوي.",
  "The user can understand what Rune changed and why.": "يستطيع المستخدم فهم ما غيّره Rune ولماذا.",
  "Values, definitions, and calculations are accurate.": "القيم والتعريفات والحسابات دقيقة.",
  "Visual deliverability": "الجاهزية البصرية للتسليم",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "A sample counts only when every score is complete and the content is confirmed as authorized or redacted. A score of 1 needs work; 5 is excellent.":
    "すべての評価を入力し、内容が評価を許可されているか匿名化済みであると確認した場合のみ、サンプルとして集計されます。1 は要改善、5 は優秀を表します。",
  "Add a detailed real-task evaluation": "実タスクの詳細評価を追加",
  "Change comprehensibility": "変更の分かりやすさ",
  "Conclusion usefulness": "結論の有用性",
  "Conclusions trace to sufficient supporting evidence.": "結論を十分な根拠までたどれます。",
  "Detailed evaluation": "詳細評価",
  "Evidence completeness": "根拠の完全性",
  "I confirm this task is authorized for evaluation or its content is redacted.":
    "このタスクが評価を許可されているか、内容が匿名化済みであることを確認します。",
  "Information hierarchy is clear and easy to scan.": "情報の階層が明確で、すばやく把握できます。",
  "Insights support a useful next decision.": "洞察が次の有用な意思決定を支えます。",
  "number checks below 4": "数値正確性が 4 未満",
  "Number correctness": "数値の正確性",
  "Number correctness below 4 always remains a visible blocker and is never hidden inside an average.":
    "数値の正確性が 4 未満の場合は常に明示的な阻害要因として残り、平均値には隠れません。",
  "Optional · seven dimensions · about one minute": "任意 · 7 項目 · 約 1 分",
  "Overall time saved": "全体の時間短縮",
  "real tasks reviewed": "件の実タスクを評価",
  "Real-task evaluation": "実タスク評価",
  "Structure clarity": "構成の明確さ",
  "The layout is usable without material rework.": "大幅な手直しなしでレイアウトを使用できます。",
  "The result saves meaningful time over manual work.": "手作業と比べて有意に時間を短縮できます。",
  "The user can understand what Rune changed and why.": "Rune が何をなぜ変更したかをユーザーが理解できます。",
  "Values, definitions, and calculations are accurate.": "値、定義、計算が正確です。",
  "Visual deliverability": "視覚的な納品可能性",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "A sample counts only when every score is complete and the content is confirmed as authorized or redacted. A score of 1 needs work; 5 is excellent.":
    "모든 점수를 입력하고 콘텐츠가 평가용으로 승인되었거나 비식별 처리되었음을 확인해야 표본으로 집계됩니다. 1점은 개선 필요, 5점은 매우 우수함을 뜻합니다.",
  "Add a detailed real-task evaluation": "실제 작업 상세 평가 추가",
  "Change comprehensibility": "변경 이해도",
  "Conclusion usefulness": "결론의 유용성",
  "Conclusions trace to sufficient supporting evidence.": "결론을 충분한 근거까지 추적할 수 있습니다.",
  "Detailed evaluation": "상세 평가",
  "Evidence completeness": "근거 완전성",
  "I confirm this task is authorized for evaluation or its content is redacted.":
    "이 작업이 평가용으로 승인되었거나 콘텐츠가 비식별 처리되었음을 확인합니다.",
  "Information hierarchy is clear and easy to scan.": "정보 계층이 명확하고 빠르게 훑어보기 쉽습니다.",
  "Insights support a useful next decision.": "인사이트가 유용한 다음 결정을 뒷받침합니다.",
  "number checks below 4": "숫자 정확성 4점 미만",
  "Number correctness": "숫자 정확성",
  "Number correctness below 4 always remains a visible blocker and is never hidden inside an average.":
    "숫자 정확성이 4점 미만이면 항상 눈에 띄는 차단 요인으로 남고 평균값에 가려지지 않습니다.",
  "Optional · seven dimensions · about one minute": "선택 사항 · 7개 항목 · 약 1분",
  "Overall time saved": "전체 시간 절감",
  "real tasks reviewed": "개의 실제 작업 평가",
  "Real-task evaluation": "실제 작업 평가",
  "Structure clarity": "구조 명확성",
  "The layout is usable without material rework.": "큰 재작업 없이 레이아웃을 사용할 수 있습니다.",
  "The result saves meaningful time over manual work.": "수작업보다 의미 있는 시간을 절약합니다.",
  "The user can understand what Rune changed and why.": "사용자가 Rune이 무엇을 왜 변경했는지 이해할 수 있습니다.",
  "Values, definitions, and calculations are accurate.": "값, 정의, 계산이 정확합니다.",
  "Visual deliverability": "시각적 전달 완성도",
});

// Human-reviewed repair guidance for structured Preview diagnostics.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Add source content": "Ajouter du contenu source",
  "Bind the Query to one exact Data artifact in the current workspace.":
    "Liez la Query à un seul artefact Data précis de l’espace de travail actuel.",
  "Check the binding syntax and choose one metric that exists in this workspace.":
    "Vérifiez la syntaxe de la liaison et choisissez une métrique présente dans cet espace de travail.",
  "Choose an existing Chart id or create and validate that Chart first.":
    "Choisissez l’identifiant d’un Chart existant, ou créez et validez d’abord ce Chart.",
  "Choose an existing metric key or an explicit Query output field.":
    "Choisissez une clé de métrique existante ou un champ de sortie Query explicite.",
  "Exact compiler detail": "Détail exact du compilateur",
  "Keep one SELECT or WITH statement and verify its explicit Data source.":
    "Conservez une seule instruction SELECT ou WITH et vérifiez sa source Data explicite.",
  "Keep readable Markdown structure and check unfinished syntax or bindings.":
    "Conservez une structure Markdown lisible et vérifiez les syntaxes ou liaisons inachevées.",
  "Keep valid Deck Markdown or script-free semantic HTML.":
    "Conservez un Deck Markdown valide ou un HTML sémantique sans script.",
  "Needs attention": "Nécessite votre attention",
  "Open Source to fix": "Ouvrir la source pour corriger",
  "Opened the source that needs attention": "La source à corriger est ouverte",
  "Reconnect existing Data or Query and exact category and value fields.":
    "Reconnectez une Data ou Query existante et les champs précis de catégorie et de valeur.",
  "Reconnect the missing Chart": "Reconnecter le Chart manquant",
  "Reconnect the missing metric": "Reconnecter la métrique manquante",
  "Reconnect the Query Data source": "Reconnecter la source Data de la Query",
  "Related reference": "Référence concernée",
  "Remove scripts or executable markup; Rune previews only script-free content.":
    "Supprimez les scripts ou le balisage exécutable ; Rune ne prévisualise que du contenu sans script.",
  "Remove unsafe content": "Supprimer le contenu non sûr",
  "Repair the Chart definition": "Corriger la définition du Chart",
  "Repair the Chart source": "Corriger la source du Chart",
  "Repair the Data source": "Corriger la source Data",
  "Repair the Document source": "Corriger la source du Document",
  "Repair the live value binding": "Corriger la liaison de valeur dynamique",
  "Repair the Presentation source": "Corriger la source de la Presentation",
  "Repair the read-only Query": "Corriger la Query en lecture seule",
  "Repair the SQL metric binding": "Corriger la liaison de métrique SQL",
  "Start with the repair direction, then reveal exact compiler evidence when needed.":
    "Commencez par la piste de correction, puis affichez la preuve exacte du compilateur si nécessaire.",
  "The original detail was too long and is truncated in this view.":
    "Le détail d’origine était trop long et a été tronqué dans cette vue.",
  "Use a supported mark, fields, format, and one existing Data or Query source.":
    "Utilisez un type de tracé, des champs et un format pris en charge, ainsi qu’une source Data ou Query existante.",
  "Use rectangular CSV with headers, or flat JSON containing scalar values.":
    "Utilisez un CSV rectangulaire avec en-têtes, ou un JSON plat contenant des valeurs scalaires.",
  "Verify that the Query, result field, and aggregate row still match this revision.":
    "Vérifiez que la Query, le champ de résultat et la ligne agrégée correspondent toujours à cette révision.",
  "Write in Source and the live output will recompile immediately.":
    "Écrivez dans Source ; le résultat en direct sera immédiatement recompilé.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Add source content": "Añadir contenido de origen",
  "Bind the Query to one exact Data artifact in the current workspace.":
    "Vincula la Query a un único artefacto Data exacto del espacio de trabajo actual.",
  "Check the binding syntax and choose one metric that exists in this workspace.":
    "Comprueba la sintaxis del enlace y elige una métrica que exista en este espacio de trabajo.",
  "Choose an existing Chart id or create and validate that Chart first.":
    "Elige el identificador de un Chart existente o crea y valida primero ese Chart.",
  "Choose an existing metric key or an explicit Query output field.":
    "Elige una clave de métrica existente o un campo de salida explícito de Query.",
  "Exact compiler detail": "Detalle exacto del compilador",
  "Keep one SELECT or WITH statement and verify its explicit Data source.":
    "Mantén una sola sentencia SELECT o WITH y comprueba su fuente Data explícita.",
  "Keep readable Markdown structure and check unfinished syntax or bindings.":
    "Mantén una estructura Markdown legible y revisa la sintaxis o los enlaces incompletos.",
  "Keep valid Deck Markdown or script-free semantic HTML.":
    "Mantén un Deck Markdown válido o HTML semántico sin scripts.",
  "Needs attention": "Requiere atención",
  "Open Source to fix": "Abrir el origen para corregir",
  "Opened the source that needs attention": "Se abrió el origen que requiere atención",
  "Reconnect existing Data or Query and exact category and value fields.":
    "Vuelve a conectar Data o Query existentes y los campos exactos de categoría y valor.",
  "Reconnect the missing Chart": "Volver a conectar el Chart ausente",
  "Reconnect the missing metric": "Volver a conectar la métrica ausente",
  "Reconnect the Query Data source": "Volver a conectar la fuente Data de Query",
  "Related reference": "Referencia relacionada",
  "Remove scripts or executable markup; Rune previews only script-free content.":
    "Elimina scripts o marcado ejecutable; Rune solo previsualiza contenido sin scripts.",
  "Remove unsafe content": "Eliminar contenido no seguro",
  "Repair the Chart definition": "Corregir la definición del Chart",
  "Repair the Chart source": "Corregir la fuente del Chart",
  "Repair the Data source": "Corregir la fuente Data",
  "Repair the Document source": "Corregir la fuente del Document",
  "Repair the live value binding": "Corregir el enlace de valor dinámico",
  "Repair the Presentation source": "Corregir la fuente de la Presentation",
  "Repair the read-only Query": "Corregir la Query de solo lectura",
  "Repair the SQL metric binding": "Corregir el enlace de métrica SQL",
  "Start with the repair direction, then reveal exact compiler evidence when needed.":
    "Empieza por la orientación de corrección y muestra después la evidencia exacta del compilador cuando haga falta.",
  "The original detail was too long and is truncated in this view.":
    "El detalle original era demasiado largo y se ha truncado en esta vista.",
  "Use a supported mark, fields, format, and one existing Data or Query source.":
    "Usa una marca, campos y formato compatibles, y una fuente Data o Query existente.",
  "Use rectangular CSV with headers, or flat JSON containing scalar values.":
    "Usa CSV rectangular con encabezados o JSON plano con valores escalares.",
  "Verify that the Query, result field, and aggregate row still match this revision.":
    "Comprueba que la Query, el campo de resultado y la fila agregada aún coincidan con esta revisión.",
  "Write in Source and the live output will recompile immediately.":
    "Escribe en Source y el resultado en directo se recompilará de inmediato.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Add source content": "Добавьте исходное содержимое",
  "Bind the Query to one exact Data artifact in the current workspace.":
    "Привяжите Query к одному конкретному артефакту Data в текущей рабочей области.",
  "Check the binding syntax and choose one metric that exists in this workspace.":
    "Проверьте синтаксис связи и выберите метрику, существующую в этой рабочей области.",
  "Choose an existing Chart id or create and validate that Chart first.":
    "Выберите идентификатор существующего Chart либо сначала создайте и проверьте этот Chart.",
  "Choose an existing metric key or an explicit Query output field.":
    "Выберите существующий ключ метрики или явно заданное выходное поле Query.",
  "Exact compiler detail": "Точное сообщение компилятора",
  "Keep one SELECT or WITH statement and verify its explicit Data source.":
    "Оставьте один запрос SELECT или WITH и проверьте его явно заданный источник Data.",
  "Keep readable Markdown structure and check unfinished syntax or bindings.":
    "Сохраните читаемую структуру Markdown и проверьте незавершённый синтаксис или связи.",
  "Keep valid Deck Markdown or script-free semantic HTML.":
    "Используйте корректный Deck Markdown или семантический HTML без скриптов.",
  "Needs attention": "Требует внимания",
  "Open Source to fix": "Открыть исходник для исправления",
  "Opened the source that needs attention": "Открыт исходник, требующий внимания",
  "Reconnect existing Data or Query and exact category and value fields.":
    "Повторно подключите существующие Data или Query и точные поля категории и значения.",
  "Reconnect the missing Chart": "Подключить отсутствующий Chart",
  "Reconnect the missing metric": "Подключить отсутствующую метрику",
  "Reconnect the Query Data source": "Подключить источник Data для Query",
  "Related reference": "Связанная ссылка",
  "Remove scripts or executable markup; Rune previews only script-free content.":
    "Удалите скрипты и исполняемую разметку: Rune показывает только содержимое без скриптов.",
  "Remove unsafe content": "Удалить небезопасное содержимое",
  "Repair the Chart definition": "Исправить определение Chart",
  "Repair the Chart source": "Исправить источник Chart",
  "Repair the Data source": "Исправить источник Data",
  "Repair the Document source": "Исправить исходник Document",
  "Repair the live value binding": "Исправить связь динамического значения",
  "Repair the Presentation source": "Исправить исходник Presentation",
  "Repair the read-only Query": "Исправить Query только для чтения",
  "Repair the SQL metric binding": "Исправить связь метрики SQL",
  "Start with the repair direction, then reveal exact compiler evidence when needed.":
    "Сначала следуйте рекомендации по исправлению, а при необходимости раскройте точное сообщение компилятора.",
  "The original detail was too long and is truncated in this view.":
    "Исходное сообщение слишком длинное и сокращено в этом представлении.",
  "Use a supported mark, fields, format, and one existing Data or Query source.":
    "Используйте поддерживаемый тип графика, поля и формат, а также существующий источник Data или Query.",
  "Use rectangular CSV with headers, or flat JSON containing scalar values.":
    "Используйте прямоугольный CSV с заголовками или плоский JSON со скалярными значениями.",
  "Verify that the Query, result field, and aggregate row still match this revision.":
    "Убедитесь, что Query, поле результата и агрегированная строка по-прежнему соответствуют этой версии.",
  "Write in Source and the live output will recompile immediately.":
    "Введите содержимое в Source — результат будет сразу перекомпилирован.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Add source content": "أضف محتوى المصدر",
  "Bind the Query to one exact Data artifact in the current workspace.":
    "اربط Query بعنصر Data واحد محدد في مساحة العمل الحالية.",
  "Check the binding syntax and choose one metric that exists in this workspace.":
    "تحقق من صياغة الربط واختر مقياسًا موجودًا في مساحة العمل هذه.",
  "Choose an existing Chart id or create and validate that Chart first.":
    "اختر معرّف Chart موجودًا، أو أنشئ ذلك Chart وتحقق منه أولًا.",
  "Choose an existing metric key or an explicit Query output field.":
    "اختر مفتاح مقياس موجودًا أو حقل إخراج صريحًا من Query.",
  "Exact compiler detail": "تفاصيل المصرّف الدقيقة",
  "Keep one SELECT or WITH statement and verify its explicit Data source.":
    "احتفظ بعبارة SELECT أو WITH واحدة وتحقق من مصدر Data الصريح لها.",
  "Keep readable Markdown structure and check unfinished syntax or bindings.":
    "حافظ على بنية Markdown مقروءة وتحقق من الصياغة أو الروابط غير المكتملة.",
  "Keep valid Deck Markdown or script-free semantic HTML.":
    "استخدم Deck Markdown صالحًا أو HTML دلاليًا خاليًا من البرامج النصية.",
  "Needs attention": "يحتاج إلى معالجة",
  "Open Source to fix": "افتح المصدر للإصلاح",
  "Opened the source that needs attention": "فُتح المصدر الذي يحتاج إلى معالجة",
  "Reconnect existing Data or Query and exact category and value fields.":
    "أعد ربط Data أو Query موجودين وحقلي الفئة والقيمة المحددين.",
  "Reconnect the missing Chart": "أعد ربط Chart المفقود",
  "Reconnect the missing metric": "أعد ربط المقياس المفقود",
  "Reconnect the Query Data source": "أعد ربط مصدر Data الخاص بـ Query",
  "Related reference": "المرجع المرتبط",
  "Remove scripts or executable markup; Rune previews only script-free content.":
    "أزل البرامج النصية أو الترميز القابل للتنفيذ؛ يعاين Rune المحتوى الخالي من البرامج النصية فقط.",
  "Remove unsafe content": "أزل المحتوى غير الآمن",
  "Repair the Chart definition": "أصلح تعريف Chart",
  "Repair the Chart source": "أصلح مصدر Chart",
  "Repair the Data source": "أصلح مصدر Data",
  "Repair the Document source": "أصلح مصدر Document",
  "Repair the live value binding": "أصلح ربط القيمة الحية",
  "Repair the Presentation source": "أصلح مصدر Presentation",
  "Repair the read-only Query": "أصلح Query للقراءة فقط",
  "Repair the SQL metric binding": "أصلح ربط مقياس SQL",
  "Start with the repair direction, then reveal exact compiler evidence when needed.":
    "ابدأ بإرشاد الإصلاح، ثم اعرض دليل المصرّف الدقيق عند الحاجة.",
  "The original detail was too long and is truncated in this view.":
    "كانت التفاصيل الأصلية طويلة جدًا وقد اختُصرت في هذا العرض.",
  "Use a supported mark, fields, format, and one existing Data or Query source.":
    "استخدم نوع رسم وحقولًا وتنسيقًا مدعومًا، ومصدر Data أو Query موجودًا.",
  "Use rectangular CSV with headers, or flat JSON containing scalar values.":
    "استخدم CSV مستطيلاً بعناوين، أو JSON مسطحًا يحتوي قيمًا قياسية.",
  "Verify that the Query, result field, and aggregate row still match this revision.":
    "تحقق من أن Query وحقل النتيجة والصف التجميعي ما زالت تطابق هذه المراجعة.",
  "Write in Source and the live output will recompile immediately.":
    "اكتب في Source وستُعاد ترجمة النتيجة الحية فورًا.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Add source content": "ソース内容を追加",
  "Bind the Query to one exact Data artifact in the current workspace.":
    "Query を現在のワークスペースにある 1 つの正確な Data アーティファクトへ接続してください。",
  "Check the binding syntax and choose one metric that exists in this workspace.":
    "バインディング構文を確認し、このワークスペースに存在する指標を選択してください。",
  "Choose an existing Chart id or create and validate that Chart first.":
    "既存の Chart ID を選ぶか、先にその Chart を作成して検証してください。",
  "Choose an existing metric key or an explicit Query output field.":
    "既存の指標キー、または明示的な Query 出力フィールドを選択してください。",
  "Exact compiler detail": "コンパイラの正確な詳細",
  "Keep one SELECT or WITH statement and verify its explicit Data source.":
    "SELECT または WITH 文を 1 つだけ残し、明示的な Data ソースを確認してください。",
  "Keep readable Markdown structure and check unfinished syntax or bindings.":
    "読みやすい Markdown 構造を保ち、未完了の構文やバインディングを確認してください。",
  "Keep valid Deck Markdown or script-free semantic HTML.":
    "有効な Deck Markdown、またはスクリプトを含まないセマンティック HTML を使用してください。",
  "Needs attention": "対応が必要です",
  "Open Source to fix": "ソースを開いて修正",
  "Opened the source that needs attention": "対応が必要なソースを開きました",
  "Reconnect existing Data or Query and exact category and value fields.":
    "既存の Data または Query と、正確なカテゴリ・値フィールドを再接続してください。",
  "Reconnect the missing Chart": "見つからない Chart を再接続",
  "Reconnect the missing metric": "見つからない指標を再接続",
  "Reconnect the Query Data source": "Query の Data ソースを再接続",
  "Related reference": "関連する参照",
  "Remove scripts or executable markup; Rune previews only script-free content.":
    "スクリプトや実行可能なマークアップを削除してください。Rune はスクリプトのない内容だけをプレビューします。",
  "Remove unsafe content": "安全でない内容を削除",
  "Repair the Chart definition": "Chart 定義を修正",
  "Repair the Chart source": "Chart ソースを修正",
  "Repair the Data source": "Data ソースを修正",
  "Repair the Document source": "Document ソースを修正",
  "Repair the live value binding": "ライブ値のバインディングを修正",
  "Repair the Presentation source": "Presentation ソースを修正",
  "Repair the read-only Query": "読み取り専用 Query を修正",
  "Repair the SQL metric binding": "SQL 指標バインディングを修正",
  "Start with the repair direction, then reveal exact compiler evidence when needed.":
    "まず修正方針を確認し、必要なときだけコンパイラの正確な根拠を表示します。",
  "The original detail was too long and is truncated in this view.":
    "元の詳細が長すぎるため、この表示では省略されています。",
  "Use a supported mark, fields, format, and one existing Data or Query source.":
    "対応するマーク、フィールド、形式と、既存の Data または Query ソースを使用してください。",
  "Use rectangular CSV with headers, or flat JSON containing scalar values.":
    "ヘッダー付きの矩形 CSV、またはスカラー値を含むフラット JSON を使用してください。",
  "Verify that the Query, result field, and aggregate row still match this revision.":
    "Query、結果フィールド、集計行がこのリビジョンと引き続き一致することを確認してください。",
  "Write in Source and the live output will recompile immediately.":
    "Source に入力すると、ライブ出力がすぐに再コンパイルされます。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Add source content": "소스 콘텐츠 추가",
  "Bind the Query to one exact Data artifact in the current workspace.":
    "Query를 현재 작업 공간의 정확한 Data 아티팩트 하나에 연결하세요.",
  "Check the binding syntax and choose one metric that exists in this workspace.":
    "바인딩 구문을 확인하고 이 작업 공간에 존재하는 지표를 선택하세요.",
  "Choose an existing Chart id or create and validate that Chart first.":
    "기존 Chart ID를 선택하거나 먼저 해당 Chart를 만들고 검증하세요.",
  "Choose an existing metric key or an explicit Query output field.":
    "기존 지표 키 또는 명시적인 Query 출력 필드를 선택하세요.",
  "Exact compiler detail": "정확한 컴파일러 세부 정보",
  "Keep one SELECT or WITH statement and verify its explicit Data source.":
    "SELECT 또는 WITH 문 하나만 유지하고 명시적인 Data 소스를 확인하세요.",
  "Keep readable Markdown structure and check unfinished syntax or bindings.":
    "읽기 쉬운 Markdown 구조를 유지하고 미완성 구문이나 바인딩을 확인하세요.",
  "Keep valid Deck Markdown or script-free semantic HTML.":
    "유효한 Deck Markdown 또는 스크립트 없는 시맨틱 HTML을 사용하세요.",
  "Needs attention": "확인이 필요합니다",
  "Open Source to fix": "소스를 열어 수정",
  "Opened the source that needs attention": "확인이 필요한 소스를 열었습니다",
  "Reconnect existing Data or Query and exact category and value fields.":
    "기존 Data 또는 Query와 정확한 범주 및 값 필드를 다시 연결하세요.",
  "Reconnect the missing Chart": "누락된 Chart 다시 연결",
  "Reconnect the missing metric": "누락된 지표 다시 연결",
  "Reconnect the Query Data source": "Query Data 소스 다시 연결",
  "Related reference": "관련 참조",
  "Remove scripts or executable markup; Rune previews only script-free content.":
    "스크립트나 실행 가능한 마크업을 제거하세요. Rune은 스크립트 없는 콘텐츠만 미리 봅니다.",
  "Remove unsafe content": "안전하지 않은 콘텐츠 제거",
  "Repair the Chart definition": "Chart 정의 수정",
  "Repair the Chart source": "Chart 소스 수정",
  "Repair the Data source": "Data 소스 수정",
  "Repair the Document source": "Document 소스 수정",
  "Repair the live value binding": "라이브 값 바인딩 수정",
  "Repair the Presentation source": "Presentation 소스 수정",
  "Repair the read-only Query": "읽기 전용 Query 수정",
  "Repair the SQL metric binding": "SQL 지표 바인딩 수정",
  "Start with the repair direction, then reveal exact compiler evidence when needed.":
    "먼저 수정 방향을 확인하고 필요할 때 정확한 컴파일러 근거를 펼쳐 보세요.",
  "The original detail was too long and is truncated in this view.":
    "원본 세부 정보가 너무 길어 이 보기에서 잘렸습니다.",
  "Use a supported mark, fields, format, and one existing Data or Query source.":
    "지원되는 마크, 필드, 형식과 기존 Data 또는 Query 소스를 사용하세요.",
  "Use rectangular CSV with headers, or flat JSON containing scalar values.":
    "헤더가 있는 직사각형 CSV 또는 스칼라 값을 포함한 플랫 JSON을 사용하세요.",
  "Verify that the Query, result field, and aggregate row still match this revision.":
    "Query, 결과 필드, 집계 행이 이 리비전과 계속 일치하는지 확인하세요.",
  "Write in Source and the live output will recompile immediately.":
    "Source에 입력하면 라이브 출력이 즉시 다시 컴파일됩니다.",
});

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Start from a cadence": "Commencer par une cadence",
  "Presets only fill task framing, audience, and deliverables. You still confirm an exact Data scope and reporting period.":
    "Les préréglages renseignent uniquement le cadrage de la tâche, le public et les livrables. Vous devez toujours confirmer un périmètre Data exact et une période de rapport.",
  "Weekly review": "Revue hebdomadaire",
  "A team report focused on the largest change and next owner":
    "Un rapport d’équipe axé sur le changement le plus important et le prochain responsable",
  "Monthly review": "Revue mensuelle",
  "A leadership report and slides focused on decisions":
    "Un rapport et une présentation pour la direction, axés sur les décisions",
  "Weekly operating review": "Revue opérationnelle hebdomadaire",
  "Identify the most material change since last week and assign the next decision or owner.":
    "Identifiez le changement le plus important depuis la semaine dernière et attribuez la prochaine décision ou le prochain responsable.",
  "Monthly operating review": "Revue opérationnelle mensuelle",
  "Explain the largest movements this month and the decisions leadership should make next.":
    "Expliquez les évolutions les plus importantes du mois et les prochaines décisions que la direction doit prendre.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Start from a cadence": "Empezar por una frecuencia",
  "Presets only fill task framing, audience, and deliverables. You still confirm an exact Data scope and reporting period.":
    "Los ajustes predefinidos solo completan el enfoque de la tarea, la audiencia y los entregables. Aún debes confirmar un ámbito de Data exacto y el período del informe.",
  "Weekly review": "Revisión semanal",
  "A team report focused on the largest change and next owner":
    "Un informe para el equipo centrado en el mayor cambio y el siguiente responsable",
  "Monthly review": "Revisión mensual",
  "A leadership report and slides focused on decisions":
    "Un informe y una presentación para la dirección centrados en las decisiones",
  "Weekly operating review": "Revisión operativa semanal",
  "Identify the most material change since last week and assign the next decision or owner.":
    "Identifica el cambio más importante desde la semana pasada y asigna la siguiente decisión o responsable.",
  "Monthly operating review": "Revisión operativa mensual",
  "Explain the largest movements this month and the decisions leadership should make next.":
    "Explica los cambios más importantes de este mes y las próximas decisiones que debe tomar la dirección.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Start from a cadence": "Начать с периодичности",
  "Presets only fill task framing, audience, and deliverables. You still confirm an exact Data scope and reporting period.":
    "Шаблоны заполняют только цель задачи, аудиторию и результаты. Точную область Data и отчётный период по-прежнему нужно подтвердить.",
  "Weekly review": "Еженедельный обзор",
  "A team report focused on the largest change and next owner":
    "Отчёт для команды о самом значимом изменении и следующем ответственном",
  "Monthly review": "Ежемесячный обзор",
  "A leadership report and slides focused on decisions": "Отчёт и презентация для руководства с акцентом на решениях",
  "Weekly operating review": "Еженедельный операционный обзор",
  "Identify the most material change since last week and assign the next decision or owner.":
    "Определите самое значимое изменение с прошлой недели и назначьте следующее решение или ответственного.",
  "Monthly operating review": "Ежемесячный операционный обзор",
  "Explain the largest movements this month and the decisions leadership should make next.":
    "Объясните самые значимые изменения за месяц и следующие решения, которые должно принять руководство.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Start from a cadence": "ابدأ من وتيرة التقارير",
  "Presets only fill task framing, audience, and deliverables. You still confirm an exact Data scope and reporting period.":
    "تملأ الإعدادات المسبقة إطار المهمة والجمهور والمخرجات فقط. وما زال عليك تأكيد نطاق Data دقيق وفترة التقرير.",
  "Weekly review": "مراجعة أسبوعية",
  "A team report focused on the largest change and next owner": "تقرير للفريق يركز على أكبر تغيير والمسؤول التالي",
  "Monthly review": "مراجعة شهرية",
  "A leadership report and slides focused on decisions": "تقرير وعرض للقيادة يركزان على القرارات",
  "Weekly operating review": "مراجعة تشغيلية أسبوعية",
  "Identify the most material change since last week and assign the next decision or owner.":
    "حدّد أهم تغيير منذ الأسبوع الماضي وعيّن القرار التالي أو المسؤول عنه.",
  "Monthly operating review": "مراجعة تشغيلية شهرية",
  "Explain the largest movements this month and the decisions leadership should make next.":
    "اشرح أكبر التغييرات هذا الشهر والقرارات التالية التي ينبغي على القيادة اتخاذها.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Start from a cadence": "レポート周期から始める",
  "Presets only fill task framing, audience, and deliverables. You still confirm an exact Data scope and reporting period.":
    "プリセットが入力するのはタスクの目的、対象者、成果物だけです。正確な Data 範囲と報告期間は引き続き確認が必要です。",
  "Weekly review": "週次レビュー",
  "A team report focused on the largest change and next owner":
    "最大の変化と次の担当者に焦点を当てたチーム向けレポート",
  "Monthly review": "月次レビュー",
  "A leadership report and slides focused on decisions": "意思決定に焦点を当てた経営層向けレポートとスライド",
  "Weekly operating review": "週次経営レビュー",
  "Identify the most material change since last week and assign the next decision or owner.":
    "先週からの最も重要な変化を特定し、次の意思決定または担当者を明確にします。",
  "Monthly operating review": "月次経営レビュー",
  "Explain the largest movements this month and the decisions leadership should make next.":
    "今月の最も大きな変化と、経営層が次に行うべき意思決定を説明します。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Start from a cadence": "보고 주기로 시작",
  "Presets only fill task framing, audience, and deliverables. You still confirm an exact Data scope and reporting period.":
    "프리셋은 작업 목적, 대상, 결과물만 채웁니다. 정확한 Data 범위와 보고 기간은 직접 확인해야 합니다.",
  "Weekly review": "주간 리뷰",
  "A team report focused on the largest change and next owner": "가장 큰 변화와 다음 담당자에 초점을 둔 팀 보고서",
  "Monthly review": "월간 리뷰",
  "A leadership report and slides focused on decisions": "의사결정에 초점을 둔 리더십 보고서와 슬라이드",
  "Weekly operating review": "주간 운영 리뷰",
  "Identify the most material change since last week and assign the next decision or owner.":
    "지난주 이후 가장 중요한 변화를 파악하고 다음 의사결정 또는 담당자를 지정합니다.",
  "Monthly operating review": "월간 운영 리뷰",
  "Explain the largest movements this month and the decisions leadership should make next.":
    "이번 달의 가장 큰 변화와 리더십이 다음에 내려야 할 결정을 설명합니다.",
});
