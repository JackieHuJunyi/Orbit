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
