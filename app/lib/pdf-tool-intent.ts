const PDF_TOOL_INTENT_PATTERNS: readonly [string, RegExp][] = [
  ["merge", /(?:合并|combine|merge).{0,12}pdf|pdf.{0,12}(?:合并|combine|merge)/iu],
  ["split", /(?:拆分|split).{0,12}pdf|pdf.{0,12}(?:拆分|split)/iu],
  ["compress", /(?:压缩|compress).{0,12}pdf|pdf.{0,12}(?:压缩|compress)/iu],
  ["organize", /(?:整理|重排|reorder|organize).{0,12}(?:pdf|页面|pages?)/iu],
  ["remove-pages", /(?:删除|remove|delete).{0,12}(?:pdf )?(?:页面|pages?)/iu],
  ["extract-pages", /(?:提取|extract).{0,12}(?:pdf )?(?:页面|pages?)/iu],
  ["rotate", /(?:旋转|rotate).{0,12}(?:pdf|页面|pages?)/iu],
  ["crop", /(?:裁剪|crop).{0,12}pdf|pdf.{0,12}(?:裁剪|crop)/iu],
  ["watermark", /(?:水印|watermark).{0,12}pdf|pdf.{0,12}(?:水印|watermark)/iu],
  ["page-numbers", /(?:页码|page numbers?).{0,12}pdf|pdf.{0,12}(?:页码|page numbers?)/iu],
  ["protect", /(?:加密|保护|encrypt|protect).{0,12}pdf/iu],
  ["unlock", /(?:解锁|移除密码|unlock|decrypt).{0,12}pdf/iu],
  ["sign", /(?:签名|签署|sign).{0,12}pdf|pdf.{0,12}(?:签名|签署|sign)/iu],
  ["redact", /(?:涂黑|遮盖|redact).{0,12}pdf|pdf.{0,12}(?:涂黑|遮盖|redact)/iu],
  ["ocr", /(?:ocr|文字识别|扫描识别).{0,12}pdf|pdf.{0,12}(?:ocr|文字识别)/iu],
  ["summarize", /(?:总结|摘要|summari[sz]e).{0,12}pdf|pdf.{0,12}(?:总结|摘要|summari[sz]e)/iu],
  ["translate", /(?:翻译|translate).{0,12}pdf|pdf.{0,12}(?:翻译|translate)/iu],
  ["pdf-to-markdown", /pdf.{0,8}(?:转|to).{0,8}(?:markdown|md)/iu],
  ["pdf-to-word", /pdf.{0,8}(?:转|to).{0,8}(?:word|docx?)/iu],
  ["pdf-to-powerpoint", /pdf.{0,8}(?:转|to).{0,8}(?:powerpoint|pptx?)/iu],
  ["pdf-to-excel", /pdf.{0,8}(?:转|to).{0,8}(?:excel|xlsx?)/iu],
  ["images-to-pdf", /(?:图片|images?|jpe?g|png).{0,8}(?:转|to).{0,8}pdf/iu],
  ["compare", /(?:比较|对比|compare).{0,12}pdf/iu],
  ["repair", /(?:修复|repair).{0,12}pdf/iu],
  ["forms", /(?:表单|forms?).{0,12}pdf|pdf.{0,12}(?:表单|forms?)/iu],
];

export function matchPdfToolIntent(prompt: string) {
  return PDF_TOOL_INTENT_PATTERNS.find(([, pattern]) => pattern.test(prompt))?.[0] ?? null;
}
