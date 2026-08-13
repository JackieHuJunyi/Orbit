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
  "Mist Blue": "Bleu brume", Sage: "Sauge", Lavender: "Lavande", "Deep Blue": "Bleu profond", "Cosmic Orange": "Orange cosmique",
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
  "Mist Blue": "Azul bruma", Sage: "Salvia", Lavender: "Lavanda", "Deep Blue": "Azul profundo", "Cosmic Orange": "Naranja cósmico",
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
  "Mist Blue": "Туманно-синий", Sage: "Шалфейный", Lavender: "Лавандовый", "Deep Blue": "Глубокий синий", "Cosmic Orange": "Космический оранжевый",
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
  "Mist Blue": "أزرق ضبابي", Sage: "أخضر مريمي", Lavender: "خزامي", "Deep Blue": "أزرق داكن", "Cosmic Orange": "برتقالي كوني",
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
  "Mist Blue": "ミストブルー", Sage: "セージ", Lavender: "ラベンダー", "Deep Blue": "ディープブルー", "Cosmic Orange": "コズミックオレンジ",
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
  "Mist Blue": "미스트 블루", Sage: "세이지", Lavender: "라벤더", "Deep Blue": "딥 블루", "Cosmic Orange": "코스믹 오렌지",
  "Show API key": "API 키 표시", "Hide API key": "API 키 숨기기",
  "Resize source and preview": "소스와 미리보기 너비 조절", "Reset source and preview widths": "기본 너비로 복원",
  "Workspace view": "작업 공간 보기", Split: "분할", Source: "소스", Preview: "미리보기",
  "Preview evidence": "미리보기 근거", "Source, bindings, and validation": "소스, 바인딩 및 검증",
  "Show source and preview": "소스와 미리보기 표시", "Show source only": "소스만 표시", "Show preview only": "미리보기만 표시",
  "Try four shortcuts yourself": "네 가지 단축키 직접 사용해 보기", "Enter a focus view": "집중 보기로 전환", "Move instantly among Split, Source, and Preview without changing source": "소스를 변경하지 않고 분할, 소스, 미리보기 사이를 즉시 전환합니다",
  "| Switch Split / Source / Preview view | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |": "| 분할 / 소스 / 미리보기 전환 | ⌘⌥ 1 / 2 / 3 | Ctrl Alt 1 / 2 / 3 |",
});
