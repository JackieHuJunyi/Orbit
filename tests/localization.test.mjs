import assert from "node:assert/strict";
import test from "node:test";

import {
  createRuneGuideArtifact,
  detectPreferredLocale,
  localeDisplayName,
  localeDirection,
  localeMonogram,
  localizeRuneStatus,
  normalizeRuneLocale,
  runeGreetingSequence,
  runeQuickCommands,
  runeText,
  runeUICopy,
  workspaceSplitValueLabel,
  RUNE_GUIDE_ID,
  RUNE_LOCALE_REGISTRY,
} from "../app/lib/localization.ts";
import { validateArtifact } from "../app/lib/workspace.ts";

test("uses the first supported language in the device's ordered preferences", () => {
  assert.equal(detectPreferredLocale(["en-US", "zh-Hans-CN"]), "en");
  assert.equal(detectPreferredLocale(["zh-Hans-CN", "en-US"]), "zh-CN");
  assert.equal(detectPreferredLocale(["zh-Hant"]), "zh-TW");
  assert.equal(detectPreferredLocale(["zh-HK", "zh-CN"]), "zh-TW");
  assert.equal(detectPreferredLocale(["fr-FR", "en-GB"]), "fr");
  assert.equal(detectPreferredLocale(["es-MX"]), "es");
  assert.equal(detectPreferredLocale(["ru-RU"]), "ru");
  assert.equal(detectPreferredLocale(["ar-SA"]), "ar");
  assert.equal(detectPreferredLocale(["ja-JP"]), "ja");
  assert.equal(detectPreferredLocale(["ko-KR"]), "ko");
  assert.equal(detectPreferredLocale([]), "en");
});

test("normalizes only supported Rune interface locales", () => {
  assert.equal(normalizeRuneLocale("zh-CN"), "zh-CN");
  assert.equal(normalizeRuneLocale("en"), "en");
  assert.equal(normalizeRuneLocale("zh-TW"), "zh-TW");
  for (const locale of ["fr", "es", "ru", "ar", "ja", "ko"]) assert.equal(normalizeRuneLocale(locale), locale);
  assert.equal(normalizeRuneLocale("en-US"), null);
  assert.equal(normalizeRuneLocale(null), null);
  assert.equal(localeDisplayName("zh-CN"), "简体中文");
  assert.equal(localeDisplayName("zh-TW"), "繁體中文");
  assert.equal(localeMonogram("en"), "A");
  assert.equal(localeDisplayName("ar"), "العربية");
  assert.equal(localeDirection("ar"), "rtl");
  assert.equal(localeDirection("ja"), "ltr");
  assert.equal(RUNE_LOCALE_REGISTRY.length, 9);
  assert.deepEqual(["zh-CN", "en", "fr", "es", "ru", "ar"].every((locale) => RUNE_LOCALE_REGISTRY.some((entry) => entry.locale === locale)), true);
});

test("keeps welcome greetings identical to the complete interface locale registry", () => {
  const registeredGreetings = RUNE_LOCALE_REGISTRY.map((entry) => `${entry.locale}:${entry.greeting}`).sort();
  for (const entry of RUNE_LOCALE_REGISTRY) {
    const sequence = runeGreetingSequence(entry.locale);
    assert.equal(sequence.length, RUNE_LOCALE_REGISTRY.length);
    assert.deepEqual(RUNE_LOCALE_REGISTRY.map(({ locale, greeting }) => `${locale}:${greeting}`).sort(), registeredGreetings);
    assert.equal(runeGreetingSequence(entry.locale)[0], entry.greeting);
    assert.ok(runeUICopy(entry.locale).workbench.livePreview);
    assert.ok(createRuneGuideArtifact(entry.locale).source.length > 100);
  }
});

test("creates a valid editable local guide in the selected language", () => {
  const chinese = createRuneGuideArtifact("zh-CN");
  const traditionalChinese = createRuneGuideArtifact("zh-TW");
  const english = createRuneGuideArtifact("en");
  assert.equal(chinese.id, RUNE_GUIDE_ID);
  assert.equal(english.id, RUNE_GUIDE_ID);
  assert.match(chinese.source, /欢迎使用 Rune/);
  assert.match(traditionalChinese.source, /歡迎使用 Rune/);
  assert.match(traditionalChinese.source, /文件/);
  assert.match(chinese.source, /文档草稿加粗/);
  assert.match(english.source, /Welcome to Rune/);
  assert.match(english.source, /Bold a Document draft/);
  assert.match(chinese.source, /⌘ Enter/);
  assert.deepEqual(validateArtifact(chinese), []);
  assert.deepEqual(validateArtifact(traditionalChinese), []);
  assert.deepEqual(validateArtifact(english), []);
  for (const locale of ["fr", "es", "ru", "ar", "ja", "ko"]) {
    const guide = createRuneGuideArtifact(locale);
    assert.notEqual(guide.source, english.source);
    assert.match(guide.source, /Rune/);
    assert.match(guide.source, /⌘ Enter/);
    assert.deepEqual(validateArtifact(guide), []);
  }
});

function catalogShape(value) {
  if (typeof value === "function") return "function";
  if (!value || typeof value !== "object") return typeof value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, catalogShape(value[key])]));
}

test("keeps one complete typed UI contract across all nine interface locales", () => {
  const chinese = runeUICopy("zh-CN");
  const traditionalChinese = runeUICopy("zh-TW");
  const english = runeUICopy("en");
  assert.deepEqual(catalogShape(chinese), catalogShape(english));
  assert.deepEqual(catalogShape(traditionalChinese), catalogShape(english));
  for (const { locale } of RUNE_LOCALE_REGISTRY) assert.deepEqual(catalogShape(runeUICopy(locale)), catalogShape(english));
  assert.equal(chinese.workbench.livePreview, "实时预览");
  assert.equal(english.workbench.livePreview, "Live preview");
  assert.equal(traditionalChinese.workbench.livePreview, "即時預覽");
  assert.equal(chinese.preview.saveSlide, "保存演示页");
  assert.equal(english.preview.saveSlide, "Save slide");
  assert.equal(chinese.importReview.title, "审核导入后的可读源");
  assert.equal(english.exportReview.title("pdf"), "Review PDF export");
  for (const locale of ["fr", "es", "ru", "ar", "ja", "ko"]) {
    assert.notEqual(runeUICopy(locale).workbench.livePreview, english.workbench.livePreview);
    assert.notEqual(runeUICopy(locale).workbench.appearance, english.workbench.appearance);
    assert.notEqual(runeUICopy(locale).workbench.deliveryOutcomeRecorded, english.workbench.deliveryOutcomeRecorded);
    assert.notEqual(runeUICopy(locale).workbench.deliveryRatings.ready, english.workbench.deliveryRatings.ready);
    assert.notEqual(runeUICopy(locale).workbench.proposalPreview, english.workbench.proposalPreview);
    assert.notEqual(runeUICopy(locale).workbench.proposalSourceUnchanged, english.workbench.proposalSourceUnchanged);
  }
});

test("formats dynamic review copy without fragile token replacement", () => {
  const chinese = runeUICopy("zh-CN");
  const traditionalChinese = runeUICopy("zh-TW");
  const english = runeUICopy("en");
  assert.equal(chinese.importReview.description("经营数据.xlsx", 2), "经营数据.xlsx 已生成 2 份可读内容。确认前不会写入。");
  assert.equal(english.importReview.description("metrics.xlsx", 1), "metrics.xlsx produced 1 readable artifact. Nothing is written until you confirm.");
  assert.equal(chinese.transaction.summary(3, 4, 2), "3 项修改 · 4 个源节点 · 2 项绑定变化");
  assert.equal(english.transaction.summary(1, 2, 1), "1 change · 2 source nodes · 1 binding change");
  assert.equal(traditionalChinese.importReview.description("经营数据.xlsx", 2), "经营数据.xlsx 已生成 2 份可讀內容。確認前不會寫入。");
  assert.equal(runeText("zh-TW", "", "正在读取 经营数据.xlsx", ["经营数据.xlsx"]), "正在讀取 经营数据.xlsx");
  assert.equal(chinese.preview.queryFootnote("DuckDB", "收入.csv", true, true), "DuckDB · 收入.csv 始终留在此浏览器 · 可证明时，结果行号与直接字段可打开规范源内容；派生单元格保持只读 · 预览最多显示 500 行。");
});

test("localizes suggested actions and high-frequency live status without altering English evidence", () => {
  assert.equal(runeQuickCommands("en", "artifact", "chart")[1], "Change the accent to purple");
  assert.equal(runeQuickCommands("zh-CN", "selection", "document")[0], "把选中内容压缩成一句话");
  assert.equal(localizeRuneStatus("zh-CN", "Local workspace ready"), "本地工作区已就绪");
  assert.equal(localizeRuneStatus("zh-TW", "Local workspace ready"), "本地工作區已就緒");
  assert.equal(localizeRuneStatus("zh-CN", "report.md updated in canonical source · Push when ready"), "report.md 已更新到规范源内容 · 可随时写回文件夹");
  assert.equal(localizeRuneStatus("en", "DuckDB could not run this query."), "DuckDB could not run this query.");
});

test("localizes the adjustable workspace split value in every interface language", () => {
  for (const { locale } of RUNE_LOCALE_REGISTRY) {
    const label = workspaceSplitValueLabel(locale, 47);
    assert.match(label, /47/);
    assert.match(label, /%|٪/);
  }
  assert.equal(workspaceSplitValueLabel("ar", 47), "عرض المصدر 47٪");
  assert.equal(workspaceSplitValueLabel("ja", 47), "ソース幅 47%");
});
