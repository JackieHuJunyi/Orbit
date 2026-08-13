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
  description: "Rune found pages without selectable text. Confirm pages and language; image content is not read until you continue.",
  settings: "OCR settings",
  privacyFooter: "Page images stay on device · results remain reviewable",
  stop: "Stop",
  cancel: "Cancel",
  recognizing: "Recognizing…",
  recognize: "Recognize",
  page: "page",
  pages: "pages",
  onDevice: "On-device recognition",
  privacy: "PDF pages render only in this browser. Rune loads its bundled OCR runtime and language data from this site and the browser caches them; page images and recognized text are never sent.",
  detectedScanPages: "detected scan pages",
  pagesToRecognize: "Pages to recognize",
  ocrPagesFor: "OCR pages for",
  pageExample: "For example 1-3, 5; only detected scan pages can be selected.",
  pageLanguage: "Page language",
  ocrLanguageFor: "OCR language for",
  languageHint: "Choose the language actually used on the page to reduce errors.",
} as const;

type OcrCopy = Record<keyof typeof OCR_ENGLISH, string>;

function catalog(values: OcrCopy) {
  return Object.fromEntries(Object.entries(OCR_ENGLISH).map(([key, source]) => [source, values[key as keyof OcrCopy]]));
}

export const MANUAL_INTERFACE_TRANSLATIONS = {
  fr: catalog({
    changed: "Les pages numérisées détectées ont changé. Importez de nouveau le fichier.", reviewPages: "Vérifiez la sélection des pages OCR.",
    loadingModel: "Chargement et mise en cache du modèle linguistique", renderingPage: "Rendu de la page", locally: "en local", recognizingPage: "Reconnaissance de la page", preparing: "Préparation de l’OCR",
    kicker: "PDF numérisé · sélection explicite", title: "Choisissez les pages à reconnaître", description: "Rune a trouvé des pages sans texte sélectionnable. Confirmez les pages et la langue ; le contenu des images ne sera pas lu avant de continuer.", settings: "Réglages OCR",
    privacyFooter: "Les images restent sur l’appareil · les résultats restent vérifiables", stop: "Arrêter", cancel: "Annuler", recognizing: "Reconnaissance…", recognize: "Reconnaître", page: "page", pages: "pages", onDevice: "Reconnaissance sur l’appareil",
    privacy: "Les pages PDF sont rendues uniquement dans ce navigateur. Rune charge son moteur OCR intégré et les données linguistiques depuis ce site, puis le navigateur les met en cache ; les images et le texte reconnu ne sont jamais envoyés.", detectedScanPages: "pages numérisées détectées", pagesToRecognize: "Pages à reconnaître", ocrPagesFor: "Pages OCR pour",
    pageExample: "Par exemple 1-3, 5 ; seules les pages numérisées détectées peuvent être sélectionnées.", pageLanguage: "Langue de la page", ocrLanguageFor: "Langue OCR pour", languageHint: "Choisissez la langue réellement utilisée sur la page afin de réduire les erreurs.",
  }),
  es: catalog({
    changed: "Las páginas escaneadas detectadas han cambiado. Vuelve a importar el archivo.", reviewPages: "Revisa la selección de páginas para OCR.", loadingModel: "Cargando y almacenando en caché el modelo de idioma", renderingPage: "Renderizando la página", locally: "localmente", recognizingPage: "Reconociendo la página", preparing: "Preparando OCR",
    kicker: "PDF escaneado · selección explícita", title: "Elige las páginas para OCR", description: "Rune encontró páginas sin texto seleccionable. Confirma las páginas y el idioma; el contenido de las imágenes no se leerá hasta que continúes.", settings: "Ajustes de OCR", privacyFooter: "Las imágenes permanecen en el dispositivo · los resultados se pueden revisar",
    stop: "Detener", cancel: "Cancelar", recognizing: "Reconociendo…", recognize: "Reconocer", page: "página", pages: "páginas", onDevice: "Reconocimiento en el dispositivo", privacy: "Las páginas PDF se renderizan solo en este navegador. Rune carga su motor OCR integrado y los datos de idioma desde este sitio, y el navegador los almacena en caché; las imágenes y el texto reconocido nunca se envían.", detectedScanPages: "páginas escaneadas detectadas", pagesToRecognize: "Páginas para reconocer", ocrPagesFor: "Páginas OCR de", pageExample: "Por ejemplo 1-3, 5; solo se pueden seleccionar las páginas escaneadas detectadas.", pageLanguage: "Idioma de la página", ocrLanguageFor: "Idioma de OCR para", languageHint: "Elige el idioma que realmente usa la página para reducir errores.",
  }),
  ru: catalog({
    changed: "Набор обнаруженных сканированных страниц изменился. Импортируйте файл снова.", reviewPages: "Проверьте выбор страниц для OCR.", loadingModel: "Загрузка и кэширование языковой модели", renderingPage: "Локальная отрисовка страницы", locally: "локально", recognizingPage: "Распознавание страницы", preparing: "Подготовка OCR", kicker: "Сканированный PDF · явный выбор", title: "Выберите страницы для OCR", description: "Rune обнаружил страницы без выделяемого текста. Подтвердите страницы и язык; изображения не будут прочитаны до продолжения.", settings: "Настройки OCR", privacyFooter: "Изображения остаются на устройстве · результаты можно проверить", stop: "Остановить", cancel: "Отмена", recognizing: "Распознавание…", recognize: "Распознать", page: "страница", pages: "страниц", onDevice: "Распознавание на устройстве", privacy: "Страницы PDF отрисовываются только в этом браузере. Rune загружает встроенный модуль OCR и языковые данные с этого сайта, а браузер кэширует их; изображения и распознанный текст никогда не отправляются.", detectedScanPages: "обнаружены сканированные страницы", pagesToRecognize: "Страницы для распознавания", ocrPagesFor: "Страницы OCR для", pageExample: "Например, 1-3, 5; можно выбрать только обнаруженные сканированные страницы.", pageLanguage: "Язык страницы", ocrLanguageFor: "Язык OCR для", languageHint: "Выберите язык, который действительно используется на странице, чтобы уменьшить число ошибок.",
  }),
  ar: catalog({
    changed: "تغيّرت الصفحات الممسوحة المكتشفة. أعد استيراد الملف.", reviewPages: "راجع اختيار صفحات التعرّف الضوئي.", loadingModel: "جارٍ تحميل نموذج اللغة وتخزينه مؤقتًا", renderingPage: "جارٍ عرض الصفحة", locally: "على الجهاز", recognizingPage: "جارٍ التعرّف على الصفحة", preparing: "جارٍ إعداد التعرّف الضوئي", kicker: "PDF ممسوح ضوئيًا · اختيار صريح", title: "اختر الصفحات للتعرّف الضوئي", description: "وجد Rune صفحات بلا نص قابل للتحديد. أكّد الصفحات واللغة؛ لن تُقرأ الصور قبل المتابعة.", settings: "إعدادات التعرّف الضوئي", privacyFooter: "تبقى صور الصفحات على الجهاز · تظل النتائج قابلة للمراجعة", stop: "إيقاف", cancel: "إلغاء", recognizing: "جارٍ التعرّف…", recognize: "تعرّف على", page: "صفحة", pages: "صفحات", onDevice: "تعرّف على الجهاز", privacy: "تُعرض صفحات PDF داخل هذا المتصفح فقط. يحمّل Rune مشغّل التعرّف الضوئي المضمّن وبيانات اللغة من هذا الموقع ويخزّنهما المتصفح مؤقتًا؛ ولا تُرسل صور الصفحات أو النصوص المتعرّف عليها.", detectedScanPages: "الصفحات الممسوحة المكتشفة", pagesToRecognize: "الصفحات المراد التعرّف عليها", ocrPagesFor: "صفحات التعرّف الضوئي لـ", pageExample: "مثل 1-3، 5؛ لا يمكن اختيار سوى الصفحات الممسوحة المكتشفة.", pageLanguage: "لغة الصفحة", ocrLanguageFor: "لغة التعرّف الضوئي لـ", languageHint: "اختر اللغة المستخدمة فعليًا في الصفحة لتقليل الأخطاء.",
  }),
  ja: catalog({
    changed: "検出されたスキャンページが変わりました。ファイルをもう一度読み込んでください。", reviewPages: "OCR ページの選択を確認してください。", loadingModel: "言語モデルを読み込んでキャッシュしています", renderingPage: "ページをレンダリングしています", locally: "（ローカル）", recognizingPage: "ページを認識しています", preparing: "OCR を準備しています", kicker: "スキャン PDF · 明示的な選択", title: "OCR するページを選択", description: "Rune は選択可能なテキストがないページを検出しました。ページと言語を確認してください。続行するまで画像内容は読み取りません。", settings: "OCR 設定", privacyFooter: "ページ画像はデバイス内に保持 · 結果は確認可能", stop: "停止", cancel: "キャンセル", recognizing: "認識中…", recognize: "認識", page: "ページ", pages: "ページ", onDevice: "デバイス上で認識", privacy: "PDF ページはこのブラウザ内だけでレンダリングされます。Rune は内蔵 OCR ランタイムと言語データをこのサイトから読み込み、ブラウザがキャッシュします。ページ画像や認識されたテキストは送信されません。", detectedScanPages: "検出したスキャンページ", pagesToRecognize: "認識するページ", ocrPagesFor: "OCR ページ：", pageExample: "例：1-3, 5。検出されたスキャンページだけを選択できます。", pageLanguage: "ページの言語", ocrLanguageFor: "OCR 言語：", languageHint: "誤認識を減らすため、ページで実際に使われている言語を選択してください。",
  }),
  ko: catalog({
    changed: "감지된 스캔 페이지가 변경되었습니다. 파일을 다시 가져오세요.", reviewPages: "OCR 페이지 선택을 확인하세요.", loadingModel: "언어 모델을 불러와 캐시하는 중", renderingPage: "페이지 렌더링 중", locally: "(로컬)", recognizingPage: "페이지 인식 중", preparing: "OCR 준비 중", kicker: "스캔 PDF · 명시적 선택", title: "OCR 페이지 선택", description: "Rune이 선택 가능한 텍스트가 없는 페이지를 찾았습니다. 페이지와 언어를 확인하세요. 계속하기 전에는 이미지 내용을 읽지 않습니다.", settings: "OCR 설정", privacyFooter: "페이지 이미지는 기기에 유지 · 결과는 검토 가능", stop: "중지", cancel: "취소", recognizing: "인식 중…", recognize: "인식", page: "페이지", pages: "페이지", onDevice: "기기 내 인식", privacy: "PDF 페이지는 이 브라우저에서만 렌더링됩니다. Rune은 이 사이트에서 내장 OCR 런타임과 언어 데이터를 불러오고 브라우저가 이를 캐시합니다. 페이지 이미지와 인식된 텍스트는 전송되지 않습니다.", detectedScanPages: "감지된 스캔 페이지", pagesToRecognize: "인식할 페이지", ocrPagesFor: "OCR 페이지:", pageExample: "예: 1-3, 5. 감지된 스캔 페이지만 선택할 수 있습니다.", pageLanguage: "페이지 언어", ocrLanguageFor: "OCR 언어:", languageHint: "오류를 줄이려면 페이지에서 실제 사용하는 언어를 선택하세요.",
  }),
} as Record<"fr" | "es" | "ru" | "ar" | "ja" | "ko", Record<string, string>>;

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  Appearance: "Apparence", "Choose Rune's character color": "Choisissez la couleur de caractère de Rune", "Current theme": "Thème actuel",
  "More tools": "Plus d’outils", "Workspace tools": "Outils de l’espace de travail", "Help, models, folder, and appearance": "Aide, modèles, dossier et apparence",
  "Source and versions": "Source et versions",
  Sources: "Sources", Analysis: "Analyse", Deliverables: "Livrables",
  Version: "Version",
  "Mist Blue": "Bleu brume", Sage: "Sauge", Lavender: "Lavande", "Sky Blue": "Bleu ciel", "Light Gold": "Or clair", "Deep Blue": "Bleu profond", "Cosmic Orange": "Orange cosmique", Silver: "Argent", "Space Black": "Noir sidéral",
  "Show API key": "Afficher la clé API", "Hide API key": "Masquer la clé API",
  "Resize source and preview": "Redimensionner la source et l’aperçu", "Reset source and preview widths": "Rétablir les largeurs par défaut",
  "Workspace view": "Vue de l’espace de travail", Split: "Partagé", Source: "Source", Preview: "Aperçu",
  "Preview evidence": "Preuves de l’aperçu", "Source, bindings, and validation": "Source, liaisons et validation",
  "Show source and preview": "Afficher la source et l’aperçu", "Show source only": "Afficher uniquement la source", "Show preview only": "Afficher uniquement l’aperçu",
  "Try four shortcuts yourself": "Essayez vous-même quatre raccourcis", "Enter a focus view": "Passer à une vue ciblée", "Move instantly among Split, Source, and Preview without changing source": "Basculez instantanément entre Partagé, Source et Aperçu sans modifier la source",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |": "| Basculer entre Partagé / Source / Aperçu | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  Appearance: "Apariencia", "Choose Rune's character color": "Elige el color de carácter de Rune", "Current theme": "Tema actual",
  "More tools": "Más herramientas", "Workspace tools": "Herramientas del espacio de trabajo", "Help, models, folder, and appearance": "Ayuda, modelos, carpeta y apariencia",
  "Source and versions": "Fuente y versiones",
  Sources: "Fuentes", Analysis: "Análisis", Deliverables: "Entregables",
  Version: "Versión",
  "Mist Blue": "Azul bruma", Sage: "Salvia", Lavender: "Lavanda", "Sky Blue": "Azul cielo", "Light Gold": "Oro claro", "Deep Blue": "Azul profundo", "Cosmic Orange": "Naranja cósmico", Silver: "Plateado", "Space Black": "Negro espacial",
  "Show API key": "Mostrar clave API", "Hide API key": "Ocultar clave API",
  "Resize source and preview": "Cambiar el tamaño de la fuente y la vista previa", "Reset source and preview widths": "Restablecer los anchos predeterminados",
  "Workspace view": "Vista del espacio de trabajo", Split: "Dividida", Source: "Fuente", Preview: "Vista previa",
  "Preview evidence": "Evidencia de la vista previa", "Source, bindings, and validation": "Fuente, enlaces y validación",
  "Show source and preview": "Mostrar fuente y vista previa", "Show source only": "Mostrar solo la fuente", "Show preview only": "Mostrar solo la vista previa",
  "Try four shortcuts yourself": "Prueba cuatro atajos", "Enter a focus view": "Entrar en una vista de enfoque", "Move instantly among Split, Source, and Preview without changing source": "Cambia al instante entre Dividida, Fuente y Vista previa sin modificar la fuente",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |": "| Cambiar vista Dividida / Fuente / Vista previa | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  Appearance: "Оформление", "Choose Rune's character color": "Выберите характерный цвет Rune", "Current theme": "Текущая тема",
  "More tools": "Другие инструменты", "Workspace tools": "Инструменты рабочей области", "Help, models, folder, and appearance": "Справка, модели, папка и оформление",
  "Source and versions": "Исходник и версии",
  Sources: "Источники", Analysis: "Анализ", Deliverables: "Результаты",
  Version: "Версия",
  "Mist Blue": "Туманно-синий", Sage: "Шалфейный", Lavender: "Лавандовый", "Sky Blue": "Небесно-голубой", "Light Gold": "Светлое золото", "Deep Blue": "Глубокий синий", "Cosmic Orange": "Космический оранжевый", Silver: "Серебристый", "Space Black": "Космический чёрный",
  "Show API key": "Показать ключ API", "Hide API key": "Скрыть ключ API",
  "Resize source and preview": "Изменить ширину исходника и предпросмотра", "Reset source and preview widths": "Восстановить ширину по умолчанию",
  "Workspace view": "Вид рабочей области", Split: "Оба", Source: "Исходник", Preview: "Предпросмотр",
  "Preview evidence": "Доказательства предпросмотра", "Source, bindings, and validation": "Исходник, связи и проверка",
  "Show source and preview": "Показать исходник и предпросмотр", "Show source only": "Показать только исходник", "Show preview only": "Показать только предпросмотр",
  "Try four shortcuts yourself": "Попробуйте четыре сочетания клавиш", "Enter a focus view": "Перейти в режим фокуса", "Move instantly among Split, Source, and Preview without changing source": "Мгновенно переключайтесь между обоими окнами, исходником и предпросмотром, не меняя исходник",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |": "| Вид: оба окна / исходник / предпросмотр | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  Appearance: "المظهر", "Choose Rune's character color": "اختر لون طابع Rune", "Current theme": "السمة الحالية",
  "More tools": "المزيد من الأدوات", "Workspace tools": "أدوات مساحة العمل", "Help, models, folder, and appearance": "المساعدة والنماذج والمجلد والمظهر",
  "Source and versions": "المصدر والإصدارات",
  Sources: "المصادر", Analysis: "التحليل", Deliverables: "المخرجات",
  Version: "الإصدار",
  "Mist Blue": "أزرق ضبابي", Sage: "أخضر مريمي", Lavender: "خزامي", "Sky Blue": "أزرق سماوي", "Light Gold": "ذهبي فاتح", "Deep Blue": "أزرق داكن", "Cosmic Orange": "برتقالي كوني", Silver: "فضي", "Space Black": "أسود فلكي",
  "Show API key": "إظهار مفتاح API", "Hide API key": "إخفاء مفتاح API",
  "Resize source and preview": "تغيير عرض المصدر والمعاينة", "Reset source and preview widths": "استعادة العرض الافتراضي",
  "Workspace view": "عرض مساحة العمل", Split: "مقسّم", Source: "المصدر", Preview: "المعاينة",
  "Preview evidence": "أدلة المعاينة", "Source, bindings, and validation": "المصدر والروابط والتحقق",
  "Show source and preview": "إظهار المصدر والمعاينة", "Show source only": "إظهار المصدر فقط", "Show preview only": "إظهار المعاينة فقط",
  "Try four shortcuts yourself": "جرّب أربعة اختصارات بنفسك", "Enter a focus view": "انتقل إلى عرض التركيز", "Move instantly among Split, Source, and Preview without changing source": "انتقل فورًا بين العرض المقسّم والمصدر والمعاينة من دون تغيير المصدر",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |": "| تبديل عرض مقسّم / المصدر / المعاينة | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  Appearance: "外観", "Choose Rune's character color": "Rune のテーマカラーを選択", "Current theme": "現在のテーマ",
  "More tools": "その他のツール", "Workspace tools": "ワークスペースツール", "Help, models, folder, and appearance": "ヘルプ・モデル・フォルダ・外観",
  "Source and versions": "ソースとバージョン",
  Sources: "ソース", Analysis: "分析", Deliverables: "成果物",
  Version: "バージョン",
  "Mist Blue": "ミストブルー", Sage: "セージ", Lavender: "ラベンダー", "Sky Blue": "スカイブルー", "Light Gold": "ライトゴールド", "Deep Blue": "ディープブルー", "Cosmic Orange": "コズミックオレンジ", Silver: "シルバー", "Space Black": "スペースブラック",
  "Show API key": "API キーを表示", "Hide API key": "API キーを隠す",
  "Resize source and preview": "ソースとプレビューの幅を調整", "Reset source and preview widths": "既定の幅に戻す",
  "Workspace view": "ワークスペース表示", Split: "分割", Source: "ソース", Preview: "プレビュー",
  "Preview evidence": "プレビューの根拠", "Source, bindings, and validation": "ソース・バインディング・検証",
  "Show source and preview": "ソースとプレビューを表示", "Show source only": "ソースだけを表示", "Show preview only": "プレビューだけを表示",
  "Try four shortcuts yourself": "4 つのショートカットを試す", "Enter a focus view": "フォーカス表示に切り替える", "Move instantly among Split, Source, and Preview without changing source": "ソースを変更せずに、分割・ソース・プレビューをすぐ切り替えます",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |": "| 分割 / ソース / プレビュー表示を切り替える | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  Appearance: "화면 스타일", "Choose Rune's character color": "Rune의 테마 색상 선택", "Current theme": "현재 테마",
  "More tools": "도구 더 보기", "Workspace tools": "작업 공간 도구", "Help, models, folder, and appearance": "도움말, 모델, 폴더 및 화면 스타일",
  "Source and versions": "소스 및 버전",
  Sources: "소스", Analysis: "분석", Deliverables: "결과물",
  Version: "버전",
  "Mist Blue": "미스트 블루", Sage: "세이지", Lavender: "라벤더", "Sky Blue": "스카이 블루", "Light Gold": "라이트 골드", "Deep Blue": "딥 블루", "Cosmic Orange": "코스믹 오렌지", Silver: "실버", "Space Black": "스페이스 블랙",
  "Show API key": "API 키 표시", "Hide API key": "API 키 숨기기",
  "Resize source and preview": "소스와 미리보기 너비 조절", "Reset source and preview widths": "기본 너비로 복원",
  "Workspace view": "작업 공간 보기", Split: "분할", Source: "소스", Preview: "미리보기",
  "Preview evidence": "미리보기 근거", "Source, bindings, and validation": "소스, 바인딩 및 검증",
  "Show source and preview": "소스와 미리보기 표시", "Show source only": "소스만 표시", "Show preview only": "미리보기만 표시",
  "Try four shortcuts yourself": "네 가지 단축키 직접 사용해 보기", "Enter a focus view": "집중 보기로 전환", "Move instantly among Split, Source, and Preview without changing source": "소스를 변경하지 않고 분할, 소스, 미리보기 사이를 즉시 전환합니다",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |": "| 분할 / 소스 / 미리보기 전환 | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "A material error, omission, or rework still blocks delivery.": "Une erreur importante, une omission ou une reprise empêche encore la livraison.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.": "Un téléchargement ou une écriture dans un dossier réussis ne prouvent pas que le résultat est utile. Choisissez l’issue la plus proche afin que Rune distingue la réussite technique d’un livrable réel.",
  "Confirm outcome": "Confirmer le résultat", "Confirm real usability after a handoff": "Confirmez l’utilité réelle après une remise", "confirmed deliverables": "livrables confirmés", "Decide later": "Décider plus tard",
  Deliverable: "Livrable", "Deliverable after minor edits": "Livrable après quelques retouches", "Deliverable outcome": "Résultat du livrable", "Delivery confirmation · on device": "Confirmation de livraison · sur l’appareil", "Delivery outcome recorded on this device": "Résultat de livraison enregistré sur cet appareil",
  "Did this result become usable in real work?": "Ce résultat est-il devenu utilisable dans un travail réel ?", Handoff: "Remise", "Not ready to deliver": "Pas prêt à livrer", "Ready to deliver": "Prêt à livrer", "Recording…": "Enregistrement…", "Rune could not record this delivery outcome": "Rune n’a pas pu enregistrer ce résultat de livraison",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.": "Rune conserve uniquement le jugement, le format, le temps écoulé et l’empreinte de révision de la source sur cet appareil, jamais le texte du document ni les invites.",
  Task: "Tâche", "The direction is right and only limited manual changes remain.": "La direction est bonne et seules quelques modifications manuelles restent à faire.", "The numbers, structure, and language meet this task.": "Les chiffres, la structure et le langage répondent à cette tâche.", "usable or minor edits": "utilisables ou avec retouches mineures",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "A material error, omission, or rework still blocks delivery.": "Un error importante, una omisión o una reelaboración todavía impide la entrega.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.": "Una descarga o escritura en carpeta correcta no demuestra que el resultado sea útil. Elige el resultado más cercano para que Rune distinga el éxito técnico de un entregable real.",
  "Confirm outcome": "Confirmar resultado", "Confirm real usability after a handoff": "Confirma la utilidad real después de una entrega", "confirmed deliverables": "entregables confirmados", "Decide later": "Decidir más tarde",
  Deliverable: "Entregable", "Deliverable after minor edits": "Entregable tras pequeños ajustes", "Deliverable outcome": "Resultado del entregable", "Delivery confirmation · on device": "Confirmación de entrega · en el dispositivo", "Delivery outcome recorded on this device": "Resultado de entrega guardado en este dispositivo",
  "Did this result become usable in real work?": "¿Este resultado llegó a ser útil en un trabajo real?", Handoff: "Entrega", "Not ready to deliver": "Aún no se puede entregar", "Ready to deliver": "Listo para entregar", "Recording…": "Guardando…", "Rune could not record this delivery outcome": "Rune no pudo guardar este resultado de entrega",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.": "Rune guarda en este dispositivo solo la valoración, el formato, el tiempo transcurrido y la huella de revisión de la fuente; nunca el texto del documento ni las instrucciones.",
  Task: "Tarea", "The direction is right and only limited manual changes remain.": "La dirección es correcta y solo quedan cambios manuales limitados.", "The numbers, structure, and language meet this task.": "Las cifras, la estructura y el lenguaje cumplen esta tarea.", "usable or minor edits": "utilizables o con ajustes menores",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "A material error, omission, or rework still blocks delivery.": "Существенная ошибка, пропуск или необходимость переработки всё ещё мешают передаче результата.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.": "Успешное скачивание или запись в папку не доказывают полезность результата. Выберите наиболее близкий исход, чтобы Rune отличал технический успех от реального готового материала.",
  "Confirm outcome": "Подтвердить результат", "Confirm real usability after a handoff": "Подтвердите реальную пригодность после передачи", "confirmed deliverables": "подтверждённых материалов", "Decide later": "Решить позже",
  Deliverable: "Готовый материал", "Deliverable after minor edits": "Готово после небольших правок", "Deliverable outcome": "Итог готового материала", "Delivery confirmation · on device": "Подтверждение результата · на устройстве", "Delivery outcome recorded on this device": "Результат передачи сохранён на этом устройстве",
  "Did this result become usable in real work?": "Стал ли этот результат пригоден для реальной работы?", Handoff: "Передача", "Not ready to deliver": "Пока не готово", "Ready to deliver": "Готово к передаче", "Recording…": "Сохранение…", "Rune could not record this delivery outcome": "Rune не удалось сохранить итог передачи",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.": "Rune хранит на этом устройстве только оценку, формат, затраченное время и отпечаток версии исходника — без текста документа и запросов.",
  Task: "Задача", "The direction is right and only limited manual changes remain.": "Направление верное, остались лишь небольшие ручные правки.", "The numbers, structure, and language meet this task.": "Числа, структура и язык соответствуют задаче.", "usable or minor edits": "пригодны или требуют мелких правок",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "A material error, omission, or rework still blocks delivery.": "لا يزال خطأ جوهري أو نقص أو عمل إضافي يمنع التسليم.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.": "لا يثبت نجاح التنزيل أو الكتابة إلى المجلد أن النتيجة مفيدة. اختر النتيجة الأقرب كي يميّز Rune بين النجاح التقني والمخرج الحقيقي القابل للتسليم.",
  "Confirm outcome": "تأكيد النتيجة", "Confirm real usability after a handoff": "أكّد قابلية الاستخدام الفعلية بعد التسليم", "confirmed deliverables": "مخرجات مؤكدة", "Decide later": "القرار لاحقًا",
  Deliverable: "المخرج", "Deliverable after minor edits": "قابل للتسليم بعد تعديلات بسيطة", "Deliverable outcome": "نتيجة المخرج", "Delivery confirmation · on device": "تأكيد التسليم · على الجهاز", "Delivery outcome recorded on this device": "تم تسجيل نتيجة التسليم على هذا الجهاز",
  "Did this result become usable in real work?": "هل أصبحت هذه النتيجة قابلة للاستخدام في عمل حقيقي؟", Handoff: "التسليم", "Not ready to deliver": "غير جاهز للتسليم", "Ready to deliver": "جاهز للتسليم", "Recording…": "جارٍ التسجيل…", "Rune could not record this delivery outcome": "تعذّر على Rune تسجيل نتيجة التسليم",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.": "يخزّن Rune على هذا الجهاز التقييم والتنسيق والوقت المنقضي وبصمة إصدار المصدر فقط، ولا يخزّن نص المستند أو المطالبات.",
  Task: "المهمة", "The direction is right and only limited manual changes remain.": "الاتجاه صحيح ولا يتبقى سوى تعديلات يدوية محدودة.", "The numbers, structure, and language meet this task.": "الأرقام والبنية واللغة مناسبة لهذه المهمة.", "usable or minor edits": "قابلة للاستخدام أو تحتاج تعديلات بسيطة",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "A material error, omission, or rework still blocks delivery.": "重大な誤り、欠落、または手戻りがあり、まだ納品できません。",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.": "ダウンロードやフォルダへの書き込みが成功しても、結果が有用だったとは限りません。Rune が技術的な成功と実際の成果物を区別できるよう、最も近い結果を選んでください。",
  "Confirm outcome": "結果を確定", "Confirm real usability after a handoff": "受け渡し後に実際の有用性を確認", "confirmed deliverables": "件の確認済み成果物", "Decide later": "後で決める",
  Deliverable: "成果物", "Deliverable after minor edits": "軽微な修正後に納品可能", "Deliverable outcome": "成果物の結果", "Delivery confirmation · on device": "納品確認 · デバイス内", "Delivery outcome recorded on this device": "納品結果をこのデバイスに記録しました",
  "Did this result become usable in real work?": "この結果は実際の業務で使えるものになりましたか？", Handoff: "受け渡し", "Not ready to deliver": "まだ納品できない", "Ready to deliver": "そのまま納品できる", "Recording…": "記録中…", "Rune could not record this delivery outcome": "Rune はこの納品結果を記録できませんでした",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.": "Rune がこのデバイスに保存するのは、評価、形式、経過時間、ソース改訂の指紋だけです。文書本文やプロンプトは保存しません。",
  Task: "タスク", "The direction is right and only limited manual changes remain.": "方向性は正しく、残るのは限定的な手作業の修正だけです。", "The numbers, structure, and language meet this task.": "数値、構成、表現がこのタスクを満たしています。", "usable or minor edits": "利用可能または軽微な修正のみ",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "A material error, omission, or rework still blocks delivery.": "중대한 오류, 누락 또는 재작업이 남아 있어 아직 전달할 수 없습니다.",
  "A successful download or folder write does not prove the result was useful. Choose the closest outcome so Rune can separate technical success from a real deliverable.": "다운로드나 폴더 쓰기가 성공했다고 결과가 유용했다는 뜻은 아닙니다. Rune이 기술적 성공과 실제 결과물을 구분할 수 있도록 가장 가까운 결과를 선택하세요.",
  "Confirm outcome": "결과 확인", "Confirm real usability after a handoff": "전달 후 실제 사용 가능 여부 확인", "confirmed deliverables": "개 확인된 결과물", "Decide later": "나중에 결정",
  Deliverable: "결과물", "Deliverable after minor edits": "조금 수정하면 전달 가능", "Deliverable outcome": "결과물 평가", "Delivery confirmation · on device": "전달 확인 · 기기 내", "Delivery outcome recorded on this device": "전달 결과를 이 기기에 기록했습니다",
  "Did this result become usable in real work?": "이 결과를 실제 업무에 사용할 수 있었나요?", Handoff: "전달", "Not ready to deliver": "아직 전달할 수 없음", "Ready to deliver": "바로 전달 가능", "Recording…": "기록 중…", "Rune could not record this delivery outcome": "Rune이 전달 결과를 기록하지 못했습니다",
  "Rune stores only the judgment, format, elapsed time, and source revision fingerprint on this device—never document text or prompts.": "Rune은 이 기기에 판단, 형식, 경과 시간, 소스 리비전 지문만 저장하며 문서 내용이나 프롬프트는 저장하지 않습니다.",
  Task: "작업", "The direction is right and only limited manual changes remain.": "방향은 맞으며 제한적인 수동 수정만 남았습니다.", "The numbers, structure, and language meet this task.": "수치, 구조, 표현이 이 작업의 요구를 충족합니다.", "usable or minor edits": "사용 가능 또는 가벼운 수정 필요",
});

Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Proposal preview": "Aperçu de la proposition",
  "AI proposal · read-only until Apply": "Proposition de l’IA · lecture seule jusqu’à l’application",
  "Proposed source": "Source proposée",
  "Canonical source stays unchanged until Apply": "La source canonique reste inchangée jusqu’à l’application",
  "Proposal preview unavailable": "Aperçu de la proposition indisponible",
  "Proposed output · nothing written": "Résultat proposé · aucune écriture",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.": "Cette source est inchangée ; son résultat en direct est rendu à partir de l’espace de travail proposé complet.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Proposal preview": "Vista previa de la propuesta",
  "AI proposal · read-only until Apply": "Propuesta de IA · solo lectura hasta aplicar",
  "Proposed source": "Fuente propuesta",
  "Canonical source stays unchanged until Apply": "La fuente canónica permanece sin cambios hasta aplicar",
  "Proposal preview unavailable": "Vista previa de la propuesta no disponible",
  "Proposed output · nothing written": "Resultado propuesto · nada escrito",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.": "Esta fuente no cambia; su resultado en directo se renderiza con todo el espacio de trabajo propuesto.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Proposal preview": "Предпросмотр предложения",
  "AI proposal · read-only until Apply": "Предложение ИИ · только чтение до применения",
  "Proposed source": "Предлагаемый исходник",
  "Canonical source stays unchanged until Apply": "Канонический исходник не изменится до применения",
  "Proposal preview unavailable": "Предпросмотр предложения недоступен",
  "Proposed output · nothing written": "Предлагаемый результат · ничего не записано",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.": "Этот исходник не изменён; его живой результат построен на основе всего предлагаемого рабочего пространства.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Proposal preview": "معاينة الاقتراح",
  "AI proposal · read-only until Apply": "اقتراح الذكاء الاصطناعي · للقراءة فقط حتى التطبيق",
  "Proposed source": "المصدر المقترح",
  "Canonical source stays unchanged until Apply": "يبقى المصدر الأساسي بلا تغيير حتى التطبيق",
  "Proposal preview unavailable": "معاينة الاقتراح غير متاحة",
  "Proposed output · nothing written": "النتيجة المقترحة · لم تتم أي كتابة",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.": "هذا المصدر لم يتغير؛ وتُعرض نتيجته المباشرة استنادًا إلى مساحة العمل المقترحة كاملة.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Proposal preview": "提案プレビュー",
  "AI proposal · read-only until Apply": "AI の提案 · 適用するまで読み取り専用",
  "Proposed source": "提案されたソース",
  "Canonical source stays unchanged until Apply": "適用するまで正規ソースは変更されません",
  "Proposal preview unavailable": "提案をプレビューできません",
  "Proposed output · nothing written": "提案された成果物 · まだ書き込まれていません",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.": "このソース自体は変更されていません。ライブ成果物は提案されたワークスペース全体を基に再描画されています。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Proposal preview": "제안 미리보기",
  "AI proposal · read-only until Apply": "AI 제안 · 적용 전까지 읽기 전용",
  "Proposed source": "제안된 소스",
  "Canonical source stays unchanged until Apply": "적용 전까지 정규 소스는 변경되지 않습니다",
  "Proposal preview unavailable": "제안을 미리 볼 수 없음",
  "Proposed output · nothing written": "제안된 결과물 · 아직 쓰지 않음",
  "This source is unchanged; its live output is rendered against the complete proposed workspace.": "이 소스 자체는 변경되지 않았으며, 실시간 결과물은 제안된 전체 작업 공간을 기준으로 렌더링됩니다.",
});

// Human-reviewed copy for the task-first onboarding and import continuation.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.": "Après cet import vérifié, Rune ouvre la configuration de la revue opérationnelle avec cette source Data déjà sélectionnée.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.": "Choisissez CSV, JSON, XLSX ou ODS. Rune affiche d’abord l’import, puis vous guide à travers les champs, les mesures, les graphiques et les livrables.",
  "Create a review from data": "Créer une revue à partir des données",
  "Import and map review": "Importer et configurer la revue",
  "Import data, then continue directly to mapping and output setup": "Importez les données, puis passez directement à l’association des champs et à la configuration des livrables",
  "Import real data, review it, then map fields, measures, and deliverables": "Importez des données réelles, vérifiez-les, puis associez les champs, les mesures et les livrables",
  "Next step": "Étape suivante",
  "Next: choose fields and deliverables": "Ensuite : choisissez les champs et les livrables",
  "Open files": "Ouvrir des fichiers",
  "Or open something else": "Ou ouvrir autre chose",
  "Start with a real operating review, or read the local guide and explore the complete sample first.": "Commencez par une vraie revue opérationnelle, ou lisez d’abord le guide local et explorez l’exemple complet.",
  "Start with a real outcome": "Commencer par un résultat concret",
  "Turn data into a verifiable review.": "Transformez les données en une revue vérifiable.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.": "Vous pouvez aussi déposer ici tout fichier pris en charge. Chaque conversion de compatibilité est vérifiée avant l’écriture.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.": "Después de esta importación revisada, Rune abre la configuración de la revisión operativa con esta fuente Data ya seleccionada.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.": "Elige CSV, JSON, XLSX u ODS. Rune muestra primero la importación y después te guía por los campos, las medidas, los gráficos y los entregables.",
  "Create a review from data": "Crear una revisión a partir de datos",
  "Import and map review": "Importar y configurar la revisión",
  "Import data, then continue directly to mapping and output setup": "Importa datos y pasa directamente a la asignación de campos y la configuración de entregables",
  "Import real data, review it, then map fields, measures, and deliverables": "Importa datos reales, revísalos y después asigna los campos, las medidas y los entregables",
  "Next step": "Siguiente paso",
  "Next: choose fields and deliverables": "A continuación: elige los campos y los entregables",
  "Open files": "Abrir archivos",
  "Or open something else": "O abre otro contenido",
  "Start with a real operating review, or read the local guide and explore the complete sample first.": "Empieza con una revisión operativa real, o lee primero la guía local y explora el ejemplo completo.",
  "Start with a real outcome": "Empieza por un resultado real",
  "Turn data into a verifiable review.": "Convierte los datos en una revisión verificable.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.": "También puedes arrastrar aquí cualquier archivo compatible. Cada conversión de compatibilidad se revisa antes de escribir.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.": "После подтверждения импорта Rune откроет настройку управленческого отчёта с уже выбранным источником Data.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.": "Выберите CSV, JSON, XLSX или ODS. Rune сначала покажет результат импорта, а затем проведёт по полям, показателям, диаграммам и результатам.",
  "Create a review from data": "Создать отчёт на основе данных",
  "Import and map review": "Импортировать и настроить отчёт",
  "Import data, then continue directly to mapping and output setup": "Импортируйте данные и сразу переходите к сопоставлению полей и настройке результатов",
  "Import real data, review it, then map fields, measures, and deliverables": "Импортируйте реальные данные, проверьте их, затем сопоставьте поля, показатели и результаты",
  "Next step": "Следующий шаг",
  "Next: choose fields and deliverables": "Далее: выберите поля и результаты",
  "Open files": "Открыть файлы",
  "Or open something else": "Или откройте другой материал",
  "Start with a real operating review, or read the local guide and explore the complete sample first.": "Начните с реального управленческого отчёта или сначала прочитайте локальное руководство и изучите полный пример.",
  "Start with a real outcome": "Начните с реального результата",
  "Turn data into a verifiable review.": "Превратите данные в проверяемый отчёт.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.": "Сюда также можно перетащить любой поддерживаемый файл. Каждое преобразование совместимости проверяется до записи.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.": "بعد تأكيد هذا الاستيراد، يفتح Rune إعداد المراجعة التشغيلية مع تحديد مصدر Data هذا مسبقًا.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.": "اختر CSV أو JSON أو XLSX أو ODS. يعرض Rune الاستيراد أولًا، ثم يرشدك عبر الحقول والمقاييس والمخططات والمخرجات.",
  "Create a review from data": "إنشاء مراجعة من البيانات",
  "Import and map review": "استيراد المراجعة وإعدادها",
  "Import data, then continue directly to mapping and output setup": "استورد البيانات، ثم انتقل مباشرة إلى ربط الحقول وإعداد المخرجات",
  "Import real data, review it, then map fields, measures, and deliverables": "استورد بيانات حقيقية وراجعها ثم اربط الحقول والمقاييس والمخرجات",
  "Next step": "الخطوة التالية",
  "Next: choose fields and deliverables": "التالي: اختر الحقول والمخرجات",
  "Open files": "فتح ملفات",
  "Or open something else": "أو افتح محتوى آخر",
  "Start with a real operating review, or read the local guide and explore the complete sample first.": "ابدأ بمراجعة تشغيلية حقيقية، أو اقرأ الدليل المحلي واستكشف المثال الكامل أولًا.",
  "Start with a real outcome": "ابدأ بنتيجة حقيقية",
  "Turn data into a verifiable review.": "حوّل البيانات إلى مراجعة قابلة للتحقق.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.": "يمكنك أيضًا إسقاط أي ملف مدعوم هنا. ستُراجع كل عملية تحويل توافقية قبل الكتابة.",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.": "確認済みのインポート後、Rune はこの Data ソースを選択した状態で経営レビュー設定を開きます。",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.": "CSV、JSON、XLSX、ODS を選択してください。Rune はまずインポート内容を表示し、その後フィールド、指標、グラフ、成果物の設定へ案内します。",
  "Create a review from data": "データから経営レビューを作成",
  "Import and map review": "インポートしてレビューを設定",
  "Import data, then continue directly to mapping and output setup": "データをインポートし、そのままフィールドの対応付けと成果物の設定に進みます",
  "Import real data, review it, then map fields, measures, and deliverables": "実データをインポートして確認し、フィールド、指標、成果物を対応付けます",
  "Next step": "次のステップ",
  "Next: choose fields and deliverables": "次へ：フィールドと成果物を選択",
  "Open files": "ファイルを開く",
  "Or open something else": "または別の内容を開く",
  "Start with a real operating review, or read the local guide and explore the complete sample first.": "まず実際の経営レビューから始めるか、ローカルガイドを読んで完全なサンプルを確認してください。",
  "Start with a real outcome": "実際の成果から始める",
  "Turn data into a verifiable review.": "データを検証可能なレビューに変換。",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.": "対応ファイルをここにドロップすることもできます。互換変換は書き込み前に必ず確認できます。",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.": "검토된 가져오기를 확인하면 Rune이 이 Data 소스를 미리 선택한 상태로 운영 리뷰 설정을 엽니다.",
  "Choose CSV, JSON, XLSX, or ODS. Rune shows the import first, then guides you through fields, measures, charts, and deliverables.": "CSV, JSON, XLSX 또는 ODS를 선택하세요. Rune이 먼저 가져오기 결과를 보여 준 다음 필드, 지표, 차트와 결과물 설정을 안내합니다.",
  "Create a review from data": "데이터로 운영 리뷰 만들기",
  "Import and map review": "가져와서 리뷰 설정",
  "Import data, then continue directly to mapping and output setup": "데이터를 가져온 뒤 바로 필드 연결과 결과물 설정으로 이동합니다",
  "Import real data, review it, then map fields, measures, and deliverables": "실제 데이터를 가져와 검토한 뒤 필드, 지표와 결과물을 연결합니다",
  "Next step": "다음 단계",
  "Next: choose fields and deliverables": "다음: 필드와 결과물 선택",
  "Open files": "파일 열기",
  "Or open something else": "또는 다른 콘텐츠 열기",
  "Start with a real operating review, or read the local guide and explore the complete sample first.": "실제 운영 리뷰로 시작하거나 로컬 가이드를 읽고 전체 예제를 먼저 살펴보세요.",
  "Start with a real outcome": "실제 결과에서 시작",
  "Turn data into a verifiable review.": "데이터를 검증 가능한 리뷰로 전환하세요.",
  "You can also drop any supported file here. Every compatibility conversion is reviewed before writing.": "지원되는 파일을 여기에 놓을 수도 있습니다. 모든 호환 변환은 쓰기 전에 검토할 수 있습니다.",
});

// Human-reviewed copy for the Document-to-Presentation task. These strings stay
// curated because they describe source identity and the review-before-write contract.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.": "Après cet import vérifié, Rune ouvre la configuration de la présentation avec ce Document déjà sélectionné.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.": "Choisissez un document vérifié, un public et un objectif. Rune crée un Deck Markdown modifiable et conserve un lien explicite avec le document source.",
  "Create presentation from document": "Créer une présentation à partir d’un document", Customer: "Client", "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "Compilation locale déterministe · vérification avant écriture", "Document source": "Document source", "Document to presentation · source linked": "Document vers présentation · source liée", "Document-presentation task settings": "Réglages de la tâche document-présentation",
  "Editable output": "Résultat modifiable", "Existing exports": "Exports disponibles", "For example: Product launch briefing": "Par exemple : présentation de lancement produit", "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length": "Importez un document, vérifiez-le, puis choisissez le public, l’objectif et la longueur", "Import and shape presentation": "Importer et préparer la présentation", "Import Word, Markdown, or PDF, review it, then create a source-linked presentation": "Importez Word, Markdown ou PDF, vérifiez le contenu, puis créez une présentation liée à sa source",
  "Next: choose audience and presentation purpose": "Ensuite : choisissez le public et l’objectif de la présentation", "No usable Document in this workspace": "Aucun Document utilisable dans cet espace de travail", "Presentation length": "Longueur de la présentation", "Presentation title": "Titre de la présentation", slides: "diapositives", "Source identity": "Identité de la source",
  "State what the audience needs to understand and the decision the presentation should support.": "Indiquez ce que le public doit comprendre et la décision que la présentation doit soutenir.", Team: "Équipe", "Turn one document into a light presentation": "Transformez un document en une présentation légère", "Verifying source…": "Vérification de la source…", "What should this presentation move forward?": "Que doit faire avancer cette présentation ?",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.": "Después de esta importación revisada, Rune abre la configuración de la presentación con este Document ya seleccionado.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.": "Elige un documento revisado, el público y el objetivo. Rune crea un Deck Markdown editable y mantiene una relación explícita con el documento de origen.",
  "Create presentation from document": "Crear una presentación a partir de un documento", Customer: "Cliente", "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "Compilación local determinista · revisión antes de escribir", "Document source": "Documento de origen", "Document to presentation · source linked": "Documento a presentación · origen vinculado", "Document-presentation task settings": "Ajustes de la tarea documento-presentación",
  "Editable output": "Resultado editable", "Existing exports": "Exportaciones disponibles", "For example: Product launch briefing": "Por ejemplo: presentación del lanzamiento del producto", "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length": "Importa un documento, revísalo y elige el público, el objetivo y la extensión", "Import and shape presentation": "Importar y preparar la presentación", "Import Word, Markdown, or PDF, review it, then create a source-linked presentation": "Importa Word, Markdown o PDF, revísalo y crea una presentación vinculada a su origen",
  "Next: choose audience and presentation purpose": "A continuación: elige el público y el objetivo de la presentación", "No usable Document in this workspace": "No hay ningún Document utilizable en este espacio de trabajo", "Presentation length": "Extensión de la presentación", "Presentation title": "Título de la presentación", slides: "diapositivas", "Source identity": "Identidad del origen",
  "State what the audience needs to understand and the decision the presentation should support.": "Indica qué necesita comprender el público y qué decisión debe respaldar la presentación.", Team: "Equipo", "Turn one document into a light presentation": "Convierte un documento en una presentación ligera", "Verifying source…": "Verificando el origen…", "What should this presentation move forward?": "¿Qué debe impulsar esta presentación?",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.": "После подтверждения импорта Rune откроет настройку презентации с уже выбранным Document.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.": "Выберите проверенный документ, аудиторию и цель. Rune создаст редактируемый Deck Markdown и сохранит явную связь с исходным документом.",
  "Create presentation from document": "Создать презентацию из документа", Customer: "Клиенты", "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "Детерминированная локальная сборка · проверка до записи", "Document source": "Исходный документ", "Document to presentation · source linked": "Документ в презентацию · источник связан", "Document-presentation task settings": "Настройки задачи документ-презентация",
  "Editable output": "Редактируемый результат", "Existing exports": "Доступный экспорт", "For example: Product launch briefing": "Например: презентация запуска продукта", "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length": "Импортируйте документ, проверьте его, затем выберите аудиторию, цель и объём", "Import and shape presentation": "Импортировать и подготовить презентацию", "Import Word, Markdown, or PDF, review it, then create a source-linked presentation": "Импортируйте Word, Markdown или PDF, проверьте и создайте презентацию со связью с источником",
  "Next: choose audience and presentation purpose": "Далее: выберите аудиторию и цель презентации", "No usable Document in this workspace": "В рабочей области нет подходящего Document", "Presentation length": "Объём презентации", "Presentation title": "Название презентации", slides: "слайдов", "Source identity": "Идентификатор источника",
  "State what the audience needs to understand and the decision the presentation should support.": "Укажите, что должна понять аудитория и какое решение должна поддержать презентация.", Team: "Команда", "Turn one document into a light presentation": "Превратите документ в лёгкую презентацию", "Verifying source…": "Проверка источника…", "What should this presentation move forward?": "Какое решение должна продвинуть эта презентация?",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.": "بعد تأكيد هذا الاستيراد، يفتح Rune إعداد العرض مع تحديد هذا الـ Document مسبقًا.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.": "اختر مستندًا تمت مراجعته والجمهور والهدف. ينشئ Rune ملف Deck Markdown قابلًا للتحرير ويحافظ على علاقة صريحة بالمستند المصدر.",
  "Create presentation from document": "إنشاء عرض من مستند", Customer: "العميل", "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "تجميع محلي حتمي · مراجعة قبل الكتابة", "Document source": "المستند المصدر", "Document to presentation · source linked": "من مستند إلى عرض · المصدر مرتبط", "Document-presentation task settings": "إعدادات مهمة المستند إلى عرض",
  "Editable output": "مخرج قابل للتحرير", "Existing exports": "خيارات التصدير المتاحة", "For example: Product launch briefing": "مثل: موجز إطلاق المنتج", "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length": "استورد مستندًا وراجعه، ثم اختر الجمهور والهدف والطول", "Import and shape presentation": "استيراد العرض وإعداده", "Import Word, Markdown, or PDF, review it, then create a source-linked presentation": "استورد Word أو Markdown أو PDF وراجعه، ثم أنشئ عرضًا مرتبطًا بالمصدر",
  "Next: choose audience and presentation purpose": "التالي: اختر الجمهور وهدف العرض", "No usable Document in this workspace": "لا يوجد Document صالح في مساحة العمل", "Presentation length": "طول العرض", "Presentation title": "عنوان العرض", slides: "شرائح", "Source identity": "هوية المصدر",
  "State what the audience needs to understand and the decision the presentation should support.": "حدّد ما يحتاج الجمهور إلى فهمه والقرار الذي يجب أن يدعمه العرض.", Team: "الفريق", "Turn one document into a light presentation": "حوّل مستندًا واحدًا إلى عرض خفيف", "Verifying source…": "جارٍ التحقق من المصدر…", "What should this presentation move forward?": "ما الذي يجب أن يدفعه هذا العرض إلى الأمام؟",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.": "確認済みのインポート後、Rune はこの Document を選択した状態でプレゼンテーション設定を開きます。",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.": "確認済みの文書、対象者、目的を選択してください。Rune は編集可能な Deck Markdown を作成し、元文書との明示的な関係を保持します。",
  "Create presentation from document": "文書からプレゼンテーションを作成", Customer: "顧客", "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "決定的なローカルコンパイル · 書き込み前に確認", "Document source": "元文書", "Document to presentation · source linked": "文書からプレゼンへ · ソース連携", "Document-presentation task settings": "文書プレゼンテーションのタスク設定",
  "Editable output": "編集可能な成果物", "Existing exports": "利用可能な書き出し", "For example: Product launch briefing": "例：製品ローンチ説明会", "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length": "文書をインポートして確認し、対象者、目的、長さを選択します", "Import and shape presentation": "インポートしてプレゼンを構成", "Import Word, Markdown, or PDF, review it, then create a source-linked presentation": "Word、Markdown、PDF をインポートして確認し、元文書に紐づくプレゼンを作成します",
  "Next: choose audience and presentation purpose": "次へ：対象者とプレゼンの目的を選択", "No usable Document in this workspace": "このワークスペースに利用可能な Document がありません", "Presentation length": "プレゼンの長さ", "Presentation title": "プレゼンのタイトル", slides: "枚", "Source identity": "ソース ID",
  "State what the audience needs to understand and the decision the presentation should support.": "対象者に理解してほしいことと、プレゼンが支える判断を記述してください。", Team: "チーム", "Turn one document into a light presentation": "一つの文書を軽やかなプレゼンに", "Verifying source…": "ソースを検証中…", "What should this presentation move forward?": "このプレゼンで何を前に進めますか？",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.": "검토된 가져오기를 확인하면 Rune이 이 Document를 미리 선택한 상태로 프레젠테이션 설정을 엽니다.",
  "Choose a reviewed document, audience, and purpose. Rune creates editable Deck Markdown and keeps an explicit relationship to the source document.": "검토된 문서, 대상, 목적을 선택하세요. Rune이 편집 가능한 Deck Markdown을 만들고 원본 문서와의 명시적 관계를 유지합니다.",
  "Create presentation from document": "문서에서 프레젠테이션 만들기", Customer: "고객", "Deck Markdown": "Deck Markdown",
  "Deterministic local compile · review before write": "결정적 로컬 컴파일 · 쓰기 전 검토", "Document source": "원본 문서", "Document to presentation · source linked": "문서에서 프레젠테이션으로 · 소스 연결", "Document-presentation task settings": "문서 프레젠테이션 작업 설정",
  "Editable output": "편집 가능한 결과물", "Existing exports": "사용 가능한 내보내기", "For example: Product launch briefing": "예: 제품 출시 브리핑", "HTML · PPTX · ODP · PDF": "HTML · PPTX · ODP · PDF",
  "Import a document, review it, then choose audience, purpose, and length": "문서를 가져와 검토한 뒤 대상, 목적과 길이를 선택하세요", "Import and shape presentation": "가져와서 프레젠테이션 구성", "Import Word, Markdown, or PDF, review it, then create a source-linked presentation": "Word, Markdown 또는 PDF를 가져와 검토한 뒤 원본에 연결된 프레젠테이션을 만드세요",
  "Next: choose audience and presentation purpose": "다음: 대상과 프레젠테이션 목적 선택", "No usable Document in this workspace": "이 작업 공간에 사용할 수 있는 Document가 없습니다", "Presentation length": "프레젠테이션 길이", "Presentation title": "프레젠테이션 제목", slides: "슬라이드", "Source identity": "소스 ID",
  "State what the audience needs to understand and the decision the presentation should support.": "대상이 이해해야 할 내용과 프레젠테이션이 뒷받침할 결정을 적으세요.", Team: "팀", "Turn one document into a light presentation": "한 문서를 가벼운 프레젠테이션으로", "Verifying source…": "소스 확인 중…", "What should this presentation move forward?": "이 프레젠테이션으로 무엇을 진전시킬까요?",
});

// Human-reviewed refresh copy for repeatable source-linked presentations.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.": "Choisissez un document vérifié, un public et un objectif. Rune peut créer une présentation ou actualiser une présentation liée tout en conservant l’identité du fichier et sa relation avec la source.",
  "Create a new presentation": "Créer une nouvelle présentation", "Create or refresh a light presentation": "Créer ou actualiser une présentation légère", "New Deck Markdown": "Nouveau Deck Markdown", "Presentation destination": "Destination de la présentation", "Refresh linked presentation in place": "Actualiser la présentation liée sur place", "Update in place · identity preserved": "Mise à jour sur place · identité préservée",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.": "Elige un documento revisado, el público y el objetivo. Rune puede crear una presentación nueva o actualizar una vinculada conservando la identidad del archivo y su relación con el origen.",
  "Create a new presentation": "Crear una presentación nueva", "Create or refresh a light presentation": "Crear o actualizar una presentación ligera", "New Deck Markdown": "Nuevo Deck Markdown", "Presentation destination": "Destino de la presentación", "Refresh linked presentation in place": "Actualizar la presentación vinculada en el mismo archivo", "Update in place · identity preserved": "Actualización en el mismo archivo · identidad conservada",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.": "Выберите проверенный документ, аудиторию и цель. Rune может создать новую презентацию или обновить связанную, сохранив идентичность файла и связь с источником.",
  "Create a new presentation": "Создать новую презентацию", "Create or refresh a light presentation": "Создайте или обновите лёгкую презентацию", "New Deck Markdown": "Новый Deck Markdown", "Presentation destination": "Куда сохранить презентацию", "Refresh linked presentation in place": "Обновить связанную презентацию на месте", "Update in place · identity preserved": "Обновление на месте · идентичность сохранена",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.": "اختر مستندًا تمت مراجعته والجمهور والهدف. يستطيع Rune إنشاء عرض جديد أو تحديث عرض مرتبط مع الحفاظ على هوية الملف وعلاقته بالمصدر.",
  "Create a new presentation": "إنشاء عرض جديد", "Create or refresh a light presentation": "أنشئ عرضًا خفيفًا أو حدّثه", "New Deck Markdown": "Deck Markdown جديد", "Presentation destination": "وجهة العرض", "Refresh linked presentation in place": "تحديث العرض المرتبط في مكانه", "Update in place · identity preserved": "تحديث في المكان · الهوية محفوظة",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.": "確認済みの文書、対象者、目的を選択してください。Rune は新しいプレゼンテーションを作成することも、ファイル ID と元文書との関係を保ったまま既存の連携プレゼンテーションを更新することもできます。",
  "Create a new presentation": "新しいプレゼンテーションを作成", "Create or refresh a light presentation": "軽やかなプレゼンテーションを作成・更新", "New Deck Markdown": "新しい Deck Markdown", "Presentation destination": "プレゼンテーションの保存先", "Refresh linked presentation in place": "連携プレゼンテーションをそのまま更新", "Update in place · identity preserved": "同じファイルを更新 · ID を保持",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Choose a reviewed document, audience, and purpose. Rune can create a new presentation or refresh a linked one while preserving its file identity and source relationship.": "검토된 문서, 대상, 목적을 선택하세요. Rune은 새 프레젠테이션을 만들거나 파일 ID와 원본 문서 관계를 유지한 채 연결된 프레젠테이션을 갱신할 수 있습니다.",
  "Create a new presentation": "새 프레젠테이션 만들기", "Create or refresh a light presentation": "가벼운 프레젠테이션 만들기 또는 갱신", "New Deck Markdown": "새 Deck Markdown", "Presentation destination": "프레젠테이션 대상", "Refresh linked presentation in place": "연결된 프레젠테이션을 제자리에서 갱신", "Update in place · identity preserved": "제자리 업데이트 · ID 유지",
});

// Human-reviewed source-freshness copy for linked presentations.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Source freshness": "Actualité de la source", "Refresh available": "Actualisation disponible", "Review refresh": "Vérifier l’actualisation", "This presentation no longer needs a source refresh": "Cette présentation n’a plus besoin d’être actualisée depuis sa source", "Source changed · refresh available": "Source modifiée · actualisation disponible", "Baseline not recorded": "Version de référence non enregistrée", "Current source revision will be recorded": "La version actuelle de la source sera enregistrée",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Source freshness": "Actualidad del origen", "Refresh available": "Actualización disponible", "Review refresh": "Revisar actualización", "This presentation no longer needs a source refresh": "Esta presentación ya no necesita actualizarse desde el origen", "Source changed · refresh available": "El origen cambió · actualización disponible", "Baseline not recorded": "Versión de referencia no registrada", "Current source revision will be recorded": "Se registrará la versión actual del origen",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Source freshness": "Актуальность источника", "Refresh available": "Доступно обновление", "Review refresh": "Проверить обновление", "This presentation no longer needs a source refresh": "Этой презентации больше не требуется обновление из источника", "Source changed · refresh available": "Источник изменён · доступно обновление", "Baseline not recorded": "Исходная версия не записана", "Current source revision will be recorded": "Текущая версия источника будет записана",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Source freshness": "حداثة المصدر", "Refresh available": "يتوفر تحديث", "Review refresh": "مراجعة التحديث", "This presentation no longer needs a source refresh": "لم يعد هذا العرض بحاجة إلى تحديث من المصدر", "Source changed · refresh available": "تغيّر المصدر · يتوفر تحديث", "Baseline not recorded": "لم يُسجّل الإصدار المرجعي", "Current source revision will be recorded": "سيُسجّل إصدار المصدر الحالي",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Source freshness": "ソースの更新状態", "Refresh available": "更新できます", "Review refresh": "更新を確認", "This presentation no longer needs a source refresh": "このプレゼンテーションは元文書から更新する必要がなくなりました", "Source changed · refresh available": "元文書が変更されました · 更新できます", "Baseline not recorded": "基準バージョンは未記録です", "Current source revision will be recorded": "現在のソース版を記録します",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Source freshness": "원본 최신 상태", "Refresh available": "갱신 가능", "Review refresh": "갱신 검토", "This presentation no longer needs a source refresh": "이 프레젠테이션은 더 이상 원본에서 갱신할 필요가 없습니다", "Source changed · refresh available": "원본 변경됨 · 갱신 가능", "Baseline not recorded": "기준 버전이 기록되지 않음", "Current source revision will be recorded": "현재 원본 버전을 기록합니다",
});

// Human-reviewed copy for the bounded model-assisted Document briefing planner.
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.fr, {
  "Deterministic local compiler": "Compilateur local déterministe",
  "Deterministic local presentation prepared; nothing writes until review": "Présentation locale déterministe préparée ; aucune écriture avant vérification",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review": "Le document dépasse la limite de sécurité du contexte du modèle ; une présentation locale déterministe est prête à être vérifiée",
  "Model unavailable; deterministic local presentation prepared for review": "Modèle indisponible ; une présentation locale déterministe est prête à être vérifiée",
  "Model when available · bounded source evidence · deterministic local fallback": "Modèle si disponible · preuves sources limitées · repli local déterministe",
  "Model-assisted outline when available · Rune compile · review before write": "Plan assisté par modèle si disponible · compilation Rune · vérification avant écriture",
  "Model-assisted source outline": "Plan source assisté par modèle",
  "Model-assisted source-linked presentation prepared; nothing writes until review": "Présentation liée à la source et assistée par modèle préparée ; aucune écriture avant vérification",
  "Narrative planner": "Structure narrative", "Shaping and verifying…": "Structuration et vérification…",
  "The model is shaping this presentation from bounded source evidence…": "Le modèle structure cette présentation à partir de preuves sources limitées…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.es, {
  "Deterministic local compiler": "Compilador local determinista",
  "Deterministic local presentation prepared; nothing writes until review": "Presentación local determinista preparada; no se escribe nada antes de revisarla",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review": "El documento supera el límite seguro de contexto del modelo; se ha preparado una presentación local determinista para revisión",
  "Model unavailable; deterministic local presentation prepared for review": "Modelo no disponible; se ha preparado una presentación local determinista para revisión",
  "Model when available · bounded source evidence · deterministic local fallback": "Modelo cuando esté disponible · evidencia de origen acotada · alternativa local determinista",
  "Model-assisted outline when available · Rune compile · review before write": "Esquema asistido por modelo cuando esté disponible · compilación de Rune · revisión antes de escribir",
  "Model-assisted source outline": "Esquema de origen asistido por modelo",
  "Model-assisted source-linked presentation prepared; nothing writes until review": "Presentación vinculada al origen y asistida por modelo preparada; no se escribe nada antes de revisarla",
  "Narrative planner": "Planificador narrativo", "Shaping and verifying…": "Estructurando y verificando…",
  "The model is shaping this presentation from bounded source evidence…": "El modelo está estructurando esta presentación con evidencia de origen acotada…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ru, {
  "Deterministic local compiler": "Детерминированный локальный компилятор",
  "Deterministic local presentation prepared; nothing writes until review": "Локальная детерминированная презентация подготовлена; до проверки ничего не записывается",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review": "Документ превышает безопасный предел контекста модели; для проверки подготовлена локальная детерминированная презентация",
  "Model unavailable; deterministic local presentation prepared for review": "Модель недоступна; для проверки подготовлена локальная детерминированная презентация",
  "Model when available · bounded source evidence · deterministic local fallback": "Модель при наличии · ограниченные свидетельства источника · детерминированный локальный резерв",
  "Model-assisted outline when available · Rune compile · review before write": "План с помощью модели при наличии · компиляция Rune · проверка до записи",
  "Model-assisted source outline": "План источника с помощью модели",
  "Model-assisted source-linked presentation prepared; nothing writes until review": "Связанная с источником презентация с помощью модели подготовлена; до проверки ничего не записывается",
  "Narrative planner": "Планировщик повествования", "Shaping and verifying…": "Формирование и проверка…",
  "The model is shaping this presentation from bounded source evidence…": "Модель формирует презентацию на основе ограниченных свидетельств источника…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ar, {
  "Deterministic local compiler": "مُصرّف محلي حتمي",
  "Deterministic local presentation prepared; nothing writes until review": "أُعد عرض محلي حتمي؛ لن يُكتب شيء قبل المراجعة",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review": "يتجاوز المستند حد أمان سياق النموذج؛ أُعد عرض محلي حتمي للمراجعة",
  "Model unavailable; deterministic local presentation prepared for review": "النموذج غير متاح؛ أُعد عرض محلي حتمي للمراجعة",
  "Model when available · bounded source evidence · deterministic local fallback": "النموذج عند توفره · أدلة مصدر محدودة · رجوع محلي حتمي",
  "Model-assisted outline when available · Rune compile · review before write": "مخطط بمساعدة النموذج عند توفره · تجميع Rune · مراجعة قبل الكتابة",
  "Model-assisted source outline": "مخطط مصدر بمساعدة النموذج",
  "Model-assisted source-linked presentation prepared; nothing writes until review": "أُعد عرض مرتبط بالمصدر بمساعدة النموذج؛ لن يُكتب شيء قبل المراجعة",
  "Narrative planner": "مخطط السرد", "Shaping and verifying…": "جارٍ التشكيل والتحقق…",
  "The model is shaping this presentation from bounded source evidence…": "يشكّل النموذج هذا العرض من أدلة مصدر محدودة…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ja, {
  "Deterministic local compiler": "決定的なローカルコンパイラ",
  "Deterministic local presentation prepared; nothing writes until review": "決定的なローカルプレゼンテーションを準備しました。確認するまで書き込みません",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review": "文書がモデルの安全なコンテキスト上限を超えています。確認用に決定的なローカルプレゼンテーションを準備しました",
  "Model unavailable; deterministic local presentation prepared for review": "モデルを利用できません。確認用に決定的なローカルプレゼンテーションを準備しました",
  "Model when available · bounded source evidence · deterministic local fallback": "利用可能な場合はモデル · 範囲を限定したソース根拠 · 決定的なローカル代替",
  "Model-assisted outline when available · Rune compile · review before write": "利用可能な場合はモデル支援アウトライン · Rune がコンパイル · 書き込み前に確認",
  "Model-assisted source outline": "モデル支援のソースアウトライン",
  "Model-assisted source-linked presentation prepared; nothing writes until review": "モデル支援のソース連携プレゼンテーションを準備しました。確認するまで書き込みません",
  "Narrative planner": "構成プランナー", "Shaping and verifying…": "構成して検証中…",
  "The model is shaping this presentation from bounded source evidence…": "モデルが範囲を限定したソース根拠からプレゼンテーションを構成しています…",
});
Object.assign(MANUAL_INTERFACE_TRANSLATIONS.ko, {
  "Deterministic local compiler": "결정적 로컬 컴파일러",
  "Deterministic local presentation prepared; nothing writes until review": "결정적 로컬 프레젠테이션을 준비했습니다. 검토 전에는 쓰지 않습니다",
  "Document exceeds the model context safety limit; deterministic local presentation prepared for review": "문서가 모델 컨텍스트 안전 한도를 초과했습니다. 검토할 결정적 로컬 프레젠테이션을 준비했습니다",
  "Model unavailable; deterministic local presentation prepared for review": "모델을 사용할 수 없습니다. 검토할 결정적 로컬 프레젠테이션을 준비했습니다",
  "Model when available · bounded source evidence · deterministic local fallback": "사용 가능할 때 모델 · 범위가 제한된 원본 근거 · 결정적 로컬 대체",
  "Model-assisted outline when available · Rune compile · review before write": "사용 가능할 때 모델 보조 개요 · Rune 컴파일 · 쓰기 전 검토",
  "Model-assisted source outline": "모델 보조 원본 개요",
  "Model-assisted source-linked presentation prepared; nothing writes until review": "모델 보조 원본 연결 프레젠테이션을 준비했습니다. 검토 전에는 쓰지 않습니다",
  "Narrative planner": "내러티브 플래너", "Shaping and verifying…": "구성하고 확인하는 중…",
  "The model is shaping this presentation from bounded source evidence…": "모델이 범위가 제한된 원본 근거로 프레젠테이션을 구성하고 있습니다…",
});
