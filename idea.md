## 结论

这个方向**值得做，而且核心判断是成立的**。但我会把产品定义从：

> “用 Markdown / CSV / JSON / HTML 替代 Word / Excel / PPT”

升级成：

> **一个 AI-native 的办公内容运行时：人和 AI 共同编辑结构化、文本化的 Source of Truth，再实时编译成文档、表格和演示。**

真正的创新不是文件后缀，而是整个工作流从：

[
\text{GUI} \rightarrow \text{复杂私有文档} \rightarrow \text{AI 解析} \rightarrow \text{修改}
]

变成：

[
\text{Human Intent + AI} \rightarrow \text{Semantic Source} \rightarrow \text{Compiler} \rightarrow \text{Visual Output}
]

我认为这是你这个产品最重要的理论基础。

---

# 一、为什么这个命题成立

你说“Office/WPS 的 AI 不够 native”，方向是对的，但需要稍微修正论据。

截至 2026 年，Microsoft 已经提供 Word、Excel、PowerPoint Agents，可以直接从自然语言创建文档、表格和演示，所以未来不能再用“Office 只是加了个聊天框”作为核心差异点。([微软支持][1])

真正的问题是：

**它们仍然以 Word / Excel / PowerPoint 文件为最终世界模型。**

而 AI-native 软件应该反过来：

**AI 可操作的语义结构是 source of truth，Word / Excel / PPT 只是 export format。**

OpenAI Prism 很能说明这个趋势。Prism 明确采用 LaTeX-native workspace，让模型直接理解并修改论文的结构、公式、引用、图表和上下文，而不是把 AI 作为编辑器外面的聊天工具。([OpenAI][2])

所以你对 Prism 的观察很有价值，但我不认为 Prism “选错了格式”。对于论文这个垂直市场，LaTeX 很合理；问题在于 **LaTeX 无法扩张到大众办公市场**。你的机会相当于：

> Prism 把 AI-native 模式应用到了 scientific writing；你把这个模式扩展到整个 knowledge work。

市场上已经有一些产品在逼近局部答案：Gamma 在统一 presentation / document / webpage，并通过一个共享设计系统处理内容和视觉；Rows 则在 spreadsheet 里面让 AI 做公式、分析、图表、清洗和多步操作。([Gamma][3])

因此市场空缺不是“没人做 AI 文档”，而是：

> **还缺一个开放、文本化、跨文档/数据/演示、真正可以被 Agent 原生读写的 workspace。**

这个定位要比“新 Office 三件套”更强。

---

# 二、但不要真的做 Markdown + CSV + HTML 三个裸格式

这是我认为你现在方案里最需要调整的地方。

最合理的结构大概是：

| 内容           | 用户看到             | AI 的 Source of Truth    | 运行时      | 对外输出              |
| ------------ | ---------------- | ----------------------- | -------- | ----------------- |
| Document     | 富文本/WYSIWYG      | Markdown + metadata     | HTML     | DOCX / PDF / MD   |
| Spreadsheet  | Spreadsheet/Grid | CSV + SQL + schema/view | DuckDB   | XLSX / CSV        |
| Presentation | Slide Canvas     | Markdown + Slide DSL    | HTML/CSS | PPTX / PDF / HTML |

也就是说：

**Markdown / CSV / HTML 是底层技术的重要组成部分，但不应该三个都直接作为最终语义模型。**

---

# 三、Word → Markdown，这部分最直接

这是三件套里面最容易做的。

大概 80% 的知识型文档其实只需要：

标题、段落、列表、表格、图片、引用、链接、公式、脚注、callout、分页和一些 metadata。

这些完全可以用：

```text
report.md
assets/
references.json
comments.json
document.yaml
```

表示。

例如：

```markdown
---
title: Q2 Business Review
author: Alice
status: draft
---

# Executive Summary

Revenue increased **18.4% YoY**, mainly driven by APAC.

:::callout{type="warning"}
Gross margin declined by 2.1 percentage points.
:::

## Revenue

{{ chart("revenue_by_region") }}
```

这里有一个非常重要的设计决定：

**不要做 MDX。**

MDX 把 React/JSX 甚至任意代码能力引进来了，对 AI 来说虽然表达能力强，但会迅速产生复杂度和安全问题。

更好的方案是：

> CommonMark/GFM + 少量你自己定义的 directives。

Markdown 的 AST 生态已经非常成熟，remark/rehype 可以把 Markdown 解析成结构化 AST 再转换成 HTML。([unified][4]) Tiptap 现在也已经支持 Markdown 与其编辑器 JSON 之间的双向转换，所以“用户富文本编辑、底层保存 Markdown”已经是可以直接工程实现的。([Tiptap][5])

因此文档部分我不会从零造编辑器。

---

# 四、Excel → CSV / JSON，是整个项目最需要重新思考的部分

**CSV 不是 Excel 的替代品。**

因为 Excel 不只是数据。

Excel 实际上包含：

[
\text{Data} + \text{Formula} + \text{Model} + \text{View} + \text{Chart} + \text{Interaction}
]

CSV 只有 Data。

JSON 也主要只有 Data + Structure。

所以如果简单地做：

> Excel → CSV

你会立即丢掉公式、多个 sheet、pivot、图表、格式、依赖关系、计算逻辑等。

我的建议是，把传统 spreadsheet 重新定义成：

> **Table + Query + View**

例如一个项目不是：

```text
sales.xlsx
```

而是：

```text
sales/
  raw.csv
  schema.json
  revenue.sql
  forecast.sql
  dashboard.view.json
  revenue.chart.json
```

其中 `raw.csv`：

```csv
date,region,revenue,cost
2026-01,CN,1200000,700000
2026-01,US,900000,600000
```

然后：

```sql
SELECT
  region,
  SUM(revenue) AS revenue,
  SUM(revenue - cost) AS gross_profit
FROM sales
GROUP BY region
ORDER BY revenue DESC
```

这件事情特别适合 AI。

因为相比：

```excel
=SUMIFS($D$2:$D$5000,$B$2:$B$5000,A2)
```

AI 处理 SQL / relational model 要自然得多。

用户仍然可以看到 Excel 一样的 Grid，但 AI 看到的是：

```text
sales.csv
revenue.sql
dashboard.view.json
```

而不是上万个 cell 的坐标。

浏览器端甚至可以直接用 DuckDB-Wasm 对 CSV、JSON 等数据执行 SQL，而无需把所有数据上传给模型；DuckDB-Wasm 本身支持浏览器内分析，并能读取 CSV、JSON 等格式。([DuckDB][6])

这会产生一个非常强的 AI 架构：

[
\text{LLM writes SQL}
\rightarrow
\text{DuckDB executes SQL}
\rightarrow
\text{LLM sees result}
\rightarrow
\text{LLM writes analysis}
]

而不是：

[
\text{把 100,000 行数据塞给 LLM}
]

这两者的成本、可靠性和 scalability 完全不同。

---

# 五、所以第一版不要挑战“完整 Excel”

这是非常重要的产品取舍。

如果你一开始说：

> “我们替代 Excel。”

你会掉进一个极深的坑。

Excel 包括财务模型、VBA、Solver、pivot、PowerQuery、大量函数、格式、宏、插件、数据连接、打印以及几十年的兼容性负担。

你的第一目标应该是：

> **AI-native analytical spreadsheet，而不是 Excel clone。**

重点覆盖：

CSV/XLSX 数据导入 → 清洗 → 查询 → 计算 → 图表 → 分析 → 报告。

暂时不要覆盖复杂 investment banking financial model。

这样产品难度会降低一个数量级。

---

# 六、PPT → HTML：方向正确，但不要让 AI 直接写任意 HTML

这是第二个需要调整的地方。

浏览器实际上是非常理想的 presentation runtime：

HTML + CSS 可以实时渲染、响应式、动画、交互、嵌入网页、视频、图表，而且天然可以分享。

已有的 Reveal.js 可以直接从 Markdown 制作 HTML slides；Marp 甚至已经支持 Markdown → HTML / PDF / PowerPoint。([reveal.js][7])

所以：

> PPT → Web Runtime

这个判断我非常赞同。

但 **raw HTML 不应该成为主要 source format**。

因为模型最后会生成：

```html
<div class="container">
  <div class="left">
    <div class="title">
      ...
```

然后 CSS 越积越多：

```css
margin-left: 13px;
transform: translateY(-5px);
position: absolute;
...
```

很快就会变成另一个不可维护的 PPT。

正确设计是：

[
\text{Slide Semantic DSL}
\rightarrow
\text{Layout Engine}
\rightarrow
\text{HTML/CSS}
]

比如 source：

```markdown
---
theme: acme
ratio: 16:9
---

:::slide{layout="hero"}

# AI-native Office

The file becomes source code.

:::

---

:::slide{layout="split"}

# Why now?

::left

- AI can directly manipulate source
- Text formats are versionable
- Browser becomes the runtime

::right

{{ chart("ai_adoption") }}

:::
```

最终编译：

```text
deck.md
        ↓
Slide AST
        ↓
Layout Engine
        ↓
HTML + CSS
        ↓
Browser
```

这样 AI 修改的是：

```text
layout="split"
```

而不是：

```css
left: 482px;
top: 137px;
width: 536px;
```

这是整个 presentation 产品成败的关键。

---

# 七、最大的产品创新其实不是三个编辑器，而是它们共享同一个 Workspace

假设项目叫：

```text
Q2 Board Meeting/
```

里面是：

```text
project.json

data/
  sales.csv
  customers.csv

models/
  revenue.sql
  churn.sql

docs/
  q2-report.md

decks/
  board-meeting.deck.md

charts/
  revenue.chart.json

assets/
  logo.svg
  market-map.png

theme/
  brand.json
  brand.css
```

突然你得到一个 Office 从来没有真正解决的问题：

### 所有内容都可以引用同一个 source of truth。

报告写：

```text
{{ metric("revenue") }}
```

PPT 写：

```text
{{ chart("revenue_by_region") }}
```

两者都来自：

```text
models/revenue.sql
```

于是销售数据更新以后：

[
CSV
\rightarrow SQL
\rightarrow Chart
\rightarrow Document
\rightarrow Presentation
]

全部自动更新。

这其实比“AI 帮你做 PPT”强得多。

因为传统工作流是：

```text
Excel
  ↓ copy
Word
  ↓ copy
PowerPoint
```

数字改了以后，三份东西经常不一致。

而你的产品可以做到：

> **Document、Data、Presentation 都只是同一个知识图谱/项目的不同 View。**

我认为这反而可能是最大的长期 moat。

---

# 八、这才是我会定义的“AI Native”

我会给内部团队定一个很严格的标准。

一个操作只有满足下面这些条件才算 AI-native：

AI 能直接读取 canonical source；能够通过结构化工具修改 source；修改可以表示成 patch/diff；修改之后可以自动执行/编译；系统能够验证结果；错误时 AI 能看到错误并自动修复；所有 AI 操作都能 undo/checkpoint；跨文件引用保持一致。

因此核心不是：

> Chat + Editor。

而是：

> **Agent + Compiler + Runtime。**

架构可以想成：

```text
               User
                 │
        "把华东销售下降
        分析一下并做6页deck"
                 │
                 ▼
          ┌─────────────┐
          │    Agent    │
          └──────┬──────┘
                 │
         structured tools
                 │
   ┌─────────────┼──────────────┐
   ▼             ▼              ▼
 read/write     query          render
 files          data           preview
   │             │              │
   ▼             ▼              ▼
Markdown       DuckDB        HTML Runtime
CSV/SQL
Slide DSL
   │             │              │
   └─────────────┼──────────────┘
                 ▼
             Validators
                 │
          ┌──────┴──────┐
          │             │
        success       error
          │             │
          │          Agent fix
          ▼
      checkpoint
          │
        preview
```

这其实跟 Cursor/Codex 类型 coding agent 的思想非常接近：

代码为什么特别适合 Agent？

因为代码有：

```text
source
compiler
runtime
tests
errors
git diff
```

你需要做的事情是：

> **给办公内容创造同样的环境。**

这是我认为你这个 idea 最深层的价值。

---

# 九、Agent 不应该“重新生成文件”，而应该操作工具

例如用户说：

> 把收入部分缩短一点，然后把 Q3 forecast 加进去。

不应该：

```text
LLM → 输出完整 report.md
```

而应该：

```text
read_document()
find_section("Revenue")
replace_section(...)
query_model("forecast.sql")
insert_chart(...)
validate_document()
render_document()
```

对于 slides：

```text
add_slide()
move_slide()
change_layout()
bind_chart()
set_theme()
shorten_text()
```

对于 data：

```text
create_query()
filter_rows()
join_tables()
add_computed_column()
create_chart()
```

这样 hallucination 会下降很多，而且每个操作都有明确的 deterministic semantics。

最终 AI 应该像一个“有文件系统和编译器权限的知识工作者”。

---

# 十、AI 必须能够“看自己的结果”

这是很多 AI PPT 产品目前非常容易做差的地方。

模型生成：

```text
deck.md
```

之后不能就结束。

应该：

[
\text{Generate}
\rightarrow
\text{Render}
\rightarrow
\text{Inspect}
\rightarrow
\text{Fix}
]

Slides renderer 可以检测：

文本 overflow、元素 overlap、字号过小、图表 label 截断、图片 crop、contrast、页面密度。

然后把浏览器 screenshot 再交给 vision model：

> “检查这页是否存在视觉问题。”

然后自动修改。

最终形成一个类似编译器反馈循环：

```text
AI writes slide
     ↓
browser renders
     ↓
layout tests
     ↓
vision inspection
     ↓
AI fixes
```

这会是 slide quality 能不能超过普通 AI PPT generator 的核心技术之一。

---

# 十一、你说的 Overleaf 式左右结构是对的，但我会稍微改 UI

不是永久：

```text
AI Chat | Preview
```

而是：

```text
Workspace / Source       Preview
─────────────────        ─────────────
files                    rendered doc
editor                   spreadsheet
agent actions             presentation
diff
```

Agent 是一个 **interaction layer**，不应该只是固定聊天框。

例如：

```text
Cmd/Ctrl + K
```

直接选中一句：

> 改得更像投资人 memo。

选中 spreadsheet：

> 对这些客户做 cohort analysis。

选中一张 slide：

> 信息密度降低 30%，保留三个数字。

同时可以有项目级 Agent：

> 根据最新 sales.csv 更新 board deck 和 Q2 report。

也就是说交互层次最好是：

[
\text{Selection Agent}
+
\text{File Agent}
+
\text{Project Agent}
]

---

# 十二、但普通用户绝对不能被迫看 Markdown / SQL / JSON

这一点非常重要。

“AI 可读”与“人必须编辑源码”完全是两回事。

对于开发者：

```text
Source | Preview
```

很好。

但对于普通 Office 用户，应该默认：

Document → 富文本编辑器
Spreadsheet → Grid
Presentation → Canvas / outline

下面偷偷对应：

```text
Markdown
CSV + SQL
Slide DSL
```

提供一个：

```text
</> Source
```

按钮给高级用户就够了。

换句话说：

> **文本格式是产品 architecture，不一定是产品 UI。**

这是从 VSCode/Overleaf 模式走向大众办公市场必须做的转变。

---

# 十三、实现技术上其实已经非常成熟

如果现在做 Web-first，我会倾向这样的技术栈。

文档编辑可以采用 Tiptap/ProseMirror，再用 Markdown AST 作为 canonical representation；Tiptap 已经具备双向 Markdown 能力。([Tiptap][5]) Source editor 可以直接使用 CodeMirror。

协同层可以直接建立在 Yjs 之上。Yjs 本身就是为 collaborative shared editing 设计的 CRDT，并且已经有大量编辑器 bindings。([Yjs Docs][8])

Data Runtime 用 DuckDB / DuckDB-Wasm 是很自然的方案。浏览器小数据本地计算，大数据再切 server worker。([DuckDB][6])

Document renderer：

```text
Markdown
→ remark/mdast
→ rehype/hast
→ HTML
→ Browser
```

现成 AST 工具链已经支持这个转换过程。([unified][9])

Slide renderer 第一版甚至可以借鉴 Marp/Reveal.js 的实现思想，然后逐渐换成自己的 semantic layout engine。Reveal.js 本身就支持 Markdown slides，而 Marp 已经验证了 Markdown → HTML/PDF/PPTX 这条路径。([reveal.js][7])

兼容 Office 生态时，Document 可以通过 Pandoc 做大量 Markdown/HTML/DOCX 转换；Pandoc 本身支持 Markdown、HTML、DOCX 等大量格式。([Pandoc][10]) XLSX 可以使用 SheetJS 做 import/export。([SheetJS][11])

PPTX 导出我反而建议：

**不要 HTML → PPTX。**

应该：

```text
Slide AST
   ├──→ HTML Renderer
   └──→ PPTX Renderer
```

也就是一份 semantic scene graph 同时有两个 backend。

PPTX backend 可以基于 PptxGenJS，它支持 JavaScript 环境生成标准 PowerPoint 文件、slide master、图片、表格等。([GitBrent][12])

这会比任意 HTML 转 PowerPoint 稳定得多。

---

# 十四、最值得做的 MVP 不是分别造 Word / Excel / PPT

如果让我决定产品第一刀，我不会先做：

> Markdown Word editor

因为很容易变成另一个 Notion。

也不会先做：

> AI PPT

因为 Gamma 这一类产品已经非常成熟。Gamma 目前甚至已经把 presentations、documents 和 webpages 放在一个统一的 AI design system 里。([Gamma][3])

也不会单独做：

> AI spreadsheet

因为 Rows 等产品已经在把 AI 深入 spreadsheet workflow。([rows.com][13])

**我会直接做一个 data → analysis → document → deck 的垂直闭环。**

比如用户上传：

```text
sales.xlsx
```

系统转换为：

```text
sales.csv
schema.json
```

用户说：

> 分析 Q2 业务表现，找出收入下滑原因，写一份管理层 memo，并做一个 8 页董事会 deck。

Agent 自动完成：

```text
sales.csv
      │
      ▼
analysis.sql
      │
 ┌────┴─────┐
 ▼          ▼
charts    insights
 │           │
 ├───────────┤
 ▼           ▼
Q2.md     Q2.deck.md
 │           │
 ▼           ▼
Report    Presentation
```

然后用户说：

> 华东的下降不要看同比，改成环比。

只修改一处 query。

memo、chart、deck 全部更新。

**这个 demo 一出来，产品价值几乎不用解释。**

---

# 十五、第一版我会把产品能力压缩到这一组

这是我认为最合理的一份 MVP scope：

1. 一个 project/workspace 可以管理 Markdown、CSV、SQL、deck 和 assets。
2. 可以导入 XLSX / DOCX，第一阶段只追求 semantic fidelity。
3. Markdown 有实时 WYSIWYG preview。
4. CSV 有 Grid，可以自然语言创建 SQL transformation。
5. SQL 通过 DuckDB 执行。
6. 可以从数据生成 chart。
7. 可以用简单的 Markdown Slide DSL 制作 deck。
8. deck 实时 HTML preview。
9. Project Agent 能同时创建/修改多个文件。
10. 每次 Agent 操作都有 diff、undo、checkpoint。
11. 一键导出 PDF / DOCX / XLSX / PPTX / HTML。
12. 所有 chart/table/metric 可以跨 document 和 deck 引用。

这十二个东西如果体验打磨好，已经能证明整个 thesis。

---

# 十六、暂时不要做的东西同样重要

第一版不要追求 Excel 100% compatibility，不要实现 VBA，不要做 PowerPoint 任意像素级自由排版，不要做 Word 完整 pagination/layout engine，不要造自己的模型，不要上来做复杂 enterprise permission，不要做插件市场，也不要同时兼容几十种 Markdown 方言。

否则会很容易把：

> 一个非常清晰的新范式产品

做成：

> 一个功能残缺的 Microsoft Office Clone。

---

# 十七、真正困难的其实有四件事

**第一是 round-trip compatibility。**

DOCX → Markdown → DOCX 不可能对所有复杂文档保持像素级一致。

所以不要承诺：

> Perfect Word compatibility。

应该承诺：

> Import content, continue working natively, export anywhere.

Old Office 是 compatibility layer，而不是你的 internal model。

---

**第二是 spreadsheet semantics。**

这是三个产品里最困难的。

所以先抢：

> analysis / reporting / operations / strategy

而不是：

> investment banking / actuarial / hardcore financial modeling。

---

**第三是 slide layout quality。**

这个必须靠：

[
\text{Constrained DSL}
+
\text{Design System}
+
\text{Layout Engine}
+
\text{Vision QA}
]

不能单纯靠 prompt engineering。

---

**第四是用户敢不敢让 Agent 改文件。**

因此 Git 式体验会变得非常重要：

```diff
Revenue increased 12%.
- Growth was driven by North America.
+ Growth was driven primarily by APAC and enterprise customers.
```

以及：

```text
Accept
Reject
Undo
Restore checkpoint
```

AI productivity software最终竞争的不是：

> AI 能不能改。

而是：

> **用户敢不敢让 AI 改。**

---

# 十八、长期 moat 在哪里

绝对不要把 moat 定义成 Markdown/CSV/HTML，因为这些东西谁都能做。

真正可能形成壁垒的是：

[
\boxed{
\text{Semantic Workspace}
+
\text{Agent Runtime}
+
\text{Cross-file Dependency Graph}
+
\text{Design Compiler}
}
]

其中我尤其看重 **cross-file dependency graph**。

例如 Agent 知道：

```text
sales.csv
   ↓
revenue.sql
   ↓
revenue.chart
   ├── q2-report.md
   └── board.deck.md
```

用户问：

> 为什么 deck 第 4 页写的是 28.3%？

系统可以直接回答：

```text
board.deck.md
→ revenue.chart
→ revenue.sql
→ sales.csv
→ 12,481 source rows
```

这相当于给所有知识工作建立：

> provenance / lineage / dependency graph。

传统 Office 基本是三个互相 copy-paste 的孤岛。

这是一个很大的范式变化。

---

# 十九、商业定位上，我不会叫它“Office replacement”

至少初期不要。

“Office replacement”意味着别人马上问你：

> 能不能打开我这个 200MB Excel？

> PowerPoint animation 支持吗？

> Word 修订模式呢？

然后产品就被 Microsoft 的 feature checklist 拖死了。

我会把它定义成：

> **AI-native workspace for creating business artifacts.**

或者中文：

> **让 AI 和人共同完成数据、文档和演示的工作台。**

更锋利一点甚至可以是：

> **Cursor for knowledge work。**

但内部产品哲学最好是：

> **Office 把文档当文件；我们把文档当可执行 source。**

---

# 二十、如果是我来设计这个公司，我会围绕一个概念建所有东西

这个概念不是 Markdown。

不是 HTML。

甚至不是 Agent。

而是：

# **Artifact as Code**

软件世界：

```text
source code
→ compiler
→ application
```

你的世界：

```text
semantic source
→ AI + compiler
→ business artifact
```

Document：

```text
Markdown → Document Compiler → PDF/DOCX/Web
```

Data：

```text
CSV + SQL → Data Runtime → Grid/Charts/XLSX
```

Presentation：

```text
Deck DSL → Design Compiler → HTML/PPTX/PDF
```

然后 Agent 横跨所有 compiler：

```text
                    Agent
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
     Document        Data          Deck
     Compiler       Runtime       Compiler
        │             │             │
        └─────────────┼─────────────┘
                      ▼
                 Workspace
```

**如果把这一层做好，你做的就不是“AI 版 WPS”，而是在重新定义 AI 时代业务内容的 source format 和 runtime。**

我的综合判断是：**技术可行性很高，产品命题成立，最大的风险不是实现，而是 scope 和定位。** 最危险的路径是同时复制 Word、Excel、PowerPoint；最有机会的路径则是先打穿 **“数据 → 分析 → 报告 → Presentation”** 这一条完整 workflow，让三种 artifact 原生共享数据、上下文、设计系统和 Agent。这个闭环一旦成立，再逐步扩张到真正的 AI Office，会比三个孤立编辑器更有产品壁垒。

[1]: https://support.microsoft.com/en-us/office/365-copilot-app/get-started-with-word-excel-and-powerpoint-agents-in-microsoft-365-copilot "Get started with Word, Excel, and PowerPoint Agents in Microsoft 365 Copilot | Microsoft Support"
[2]: https://openai.com/index/introducing-prism/ "Introducing Prism | OpenAI"
[3]: https://gamma.app/explore/content/guides/ai-presentation-tool-one-platform-for-presentations-documents-and-websites "AI Presentation Tool: One Platform for Presentations, Documents & Websites | Gamma.app"
[4]: https://unifiedjs.com/explore/package/rehype-remark/?utm_source=chatgpt.com "rehype-remark - unified"
[5]: https://tiptap.dev/docs/editor/markdown?utm_source=chatgpt.com "Markdown Introduction | Tiptap Editor Docs"
[6]: https://duckdb.org/2021/10/29/duckdb-wasm?utm_source=chatgpt.com "DuckDB-Wasm: Efficient Analytical SQL in the Browser – DuckDB"
[7]: https://revealjs.com/markdown/?utm_source=chatgpt.com "Markdown | reveal.js"
[8]: https://docs.yjs.dev/?utm_source=chatgpt.com "Yjs Docs: Introduction"
[9]: https://unifiedjs.com/explore/package/remark-rehype/?utm_source=chatgpt.com "remark-rehype - unified"
[10]: https://pandoc.org/MANUAL.html?utm_source=chatgpt.com "Pandoc User's Guide"
[11]: https://docs.sheetjs.com/?utm_source=chatgpt.com "SheetJS Community Edition"
[12]: https://gitbrent.github.io/PptxGenJS/docs/introduction/?utm_source=chatgpt.com "Introduction | PptxGenJS"
[13]: https://rows.com/ai "Rows AI: Analyze and Transform Data with AI."

---

# 二十一、Rune 的第一阶段实施决策

前面的分析定义了长期方向；下面把它收敛成现在就能执行、以后不必推倒重来的工程边界。

## 1. 第一阶段只证明一个核心循环

Rune v0 不承诺替代 Word、Excel 或 PowerPoint，而是证明同一个工作台里可以完成：

```text
自然语言意图
  → 修改可读的 source
  → 实时编译成 artifact
  → 人检查结果和变更
  → 继续迭代
```

首版现在提供五种 artifact adapter：

| 模式 | Canonical source | 首版 runtime | 现在验证什么 |
| --- | --- | --- | --- |
| Document | GFM Markdown | React/HTML document renderer | 文本 source 与成品文档可以同步工作 |
| Data | CSV 或 JSON | 本地 parser + grid | 结构化数据可被人和 Agent 直接理解 |
| Query | DuckDB SQL | Browser Worker + DuckDB-Wasm | AI 写出的分析可以真实执行并验证，而不是只生成公式文本 |
| Chart | 受约束的 `.chart.json` | 本地 projection + React/static HTML | 同一份数据视图可同时进入报告和演示 |
| Slides | 受约束的 `.deck.md` | escaped static HTML + sandboxed browser frame | 文本化演示源可以安全编译成浏览器 runtime |

Slides 已从任意 `.html` 源迁移到 Deck Markdown：严格 frontmatter、`---` 分页、受控 layout/eyebrow metadata 和有限 Markdown block 共同形成首个可版本化 Deck AST 边界。HTML 现在是编译产物，不是默认 canonical source；旧 `.html` 仍可导入并运行在无脚本 sandbox 中，作为迁移兼容层。未来 HTML、PPTX 与 PDF 都应从同一个 deck model 生成，避免任意 CSS 逐渐退化成另一个 PPT。

## 2. 从 ColaMD 借鉴什么

ColaMD 最值得复用的不是 Electron 或 Milkdown 本身，而是三个产品原则：文件仍然是用户拥有的 source of truth；外部 Agent 改文件后界面立即更新；AI 的活动和修改需要被用户看见。

Rune 会保留这些原则，同时把范围从单个 Markdown 文件扩成 workspace。当前工作台已经加入 patch 预览、accept/reject、持久 checkpoint、安全 restore 与 File System Access storage port；ColaMD 的自动同目录监听仍更适合未来桌面端。Rune 现在采用 Web-first、本地优先的 adapter 边界，浏览器用显式 Pull/Push，未来 Tauri/Electron shell 再实现 watching，而不把文件系统能力耦合进 renderer。

## 3. 基础设施决策

- Web-first：先用 React + vinext 建立可分享、可部署、Cloudflare Worker 兼容的产品壳。
- Local-first：草稿默认保存在当前设备，不为首版引入数据库、账号或持续服务成本。
- Adapter-first：编辑器只依赖统一的 Artifact 接口；Markdown、Data、Query、Chart、Slides 各自负责 parse、validate、render。
- Provider-agnostic：Agent UI 与模型供应商解耦；没有模型密钥时也可用确定性的本地操作演示完整交互。
- Safe preview：Markdown 不执行任意 HTML；Deck Markdown 拒绝 raw HTML、转义文本并编译到无脚本 iframe，旧 Slides HTML 只走 sandboxed 兼容路径。
- Progressive persistence：设备草稿 → 浏览器文件系统 → Git workspace → 协作后端，按真实需求逐级增加。
- Git-shaped trust：所有 Agent 写入最终都应表达成 patch，并进入可撤销 checkpoint。

更详细的模块边界和演进路线见 `docs/ARCHITECTURE.md`。

## 4. 近期里程碑

1. Foundation：五种 artifact 可切换、可编辑、可实时预览、可在设备上保存。
2. Agent loop：自然语言指令生成结构化 patch，展示 diff 后再应用。
3. Data workflow：CSV/JSON 导入、schema inference、SQL transformation 与 chart binding。
4. Workspace graph：文档和演示可引用同一份数据或 metric，并显示 lineage。
5. Compatibility：已加入 DOCX/XLSX/PPTX 的 semantic import；下一步按使用频率补 export 与 fidelity diagnostics。

判断每一阶段是否值得继续的标准不是功能数量，而是用户完成一次“数据 → 分析 → 文档 → 演示”的时间是否显著下降、以及用户是否愿意接受 Agent 的修改。

## 5. SQL runtime 与 checkpoint 的已验证实现

2026-08-11 的实现把 Data workflow 从“规划项”推进到了可运行的纵向切片：`.sql` 本身是可读、可下载、可被 Agent 修改的 canonical source；打开 Query artifact 时才懒加载 DuckDB-Wasm；CSV/JSON 会在浏览器 Worker 内变成统一表 `workspace_data`；SQL 结果回到同一个 Grid renderer。默认示例已经用真实 DuckDB 内核回归测试，不只是 mock parser。

首版刻意收紧三个边界：只接受单条 `SELECT` 或 `WITH`，把查询包成 subquery 以保证只读语义，界面最多展示 500 行。这个约束既降低浏览器内存风险，也给 Agent 明确、可验证的输出协议。大文件阶段再按阈值切到远程 worker，而不改变 `.sql → result table` 的 artifact contract。

Checkpoint 也从内存撤销栈升级成设备持久日志：Agent patch 应用前保存旧 source，⌘S 保存人工节点，restore 前先保存当前 source，因此恢复动作本身也可逆。每个 artifact 最多保留最近 24 个不同 source，并受 50 万字符预算约束；超过 20 万字符的单文件先要求导出，不冒险挤爆 localStorage。连续重复版本会去重，损坏条目会被忽略，容量失败会明确显示。这个模型成本为零，但已经建立了以后迁移到 Git commit、operation log 或 CRDT snapshot 所需的 revision 边界。

这一轮没有引入账号、D1 或 R2。新增运行成本只有首次打开 SQL 时下载固定版本的 Wasm 二进制；用户数据不需要离开浏览器。等到真实用户需要跨设备同步，再把 checkpoint port 接到持久后端，比现在预建协作基础设施更符合低成本原则。

## 6. Project Agent 的原子多文件修改

2026-08-11 的下一次实现把“Project Agent 能同时创建/修改多个文件”从愿景推进成可操作闭环。Agent 现在有 File 与 Workspace 两个 scope：File 仍生成单个完整 source；Workspace 可以针对当前 2–6 个 canonical artifacts 返回最多 4 个带 `artifactId` 的完整 source patch。模型输出只进入 pending review，用户可以逐个切换文件查看摘要、增删行统计与真实 source diff，再决定整体接受或放弃。

这里最重要的工程决定不是“让模型一次返回更多文本”，而是建立事务边界。应用前会验证目标 ID 存在且不重复、source 确实变化、SQL 仍是只读查询、Deck Markdown 符合受限语法（旧 Slides HTML 仍不得含脚本）、各 adapter 能解析，并用完整的 next workspace 重新编译所有 metric binding。任何一个检查失败，返回的 next workspace 就不可用；本地存储容量不足同样会让整次操作保持零写入。只有全部通过后，系统才为每个受影响 artifact 保存 pre-change checkpoint，并用一次持久化写入替换 workspace。

这个边界使“数据 → 分析 → 报告 → 演示”真正能由一个意图协调，同时没有引入协作服务器、数据库或新的常驻成本。当前确定性 fallback 已经能同步季度 SQL 汇总、报告摘要和结论页；配置模型后仍复用同一份 schema、review UI 和事务验证器。未来把完整 source 替换升级为 range/AST operation、加入 revision hash 或 Git commit 时，不需要改变用户对“先审查、后原子应用、每个文件可恢复”的信任模型。

## 7. 可复用 Chart artifact 与跨成品编译

2026-08-11 的后续实现补上了 Data workflow 中缺失的可视化层。Chart 不是保存在文档或 PPT 里的截图，也不是让 Agent 任意生成的一段 JavaScript，而是一份严格、版本化、可读的 `.chart.json`：它只声明 data artifact ID、精确的 category/value 列、bar mark、排序、数字格式、颜色 token 与最多 20 个 marks。浏览器本地把这份 spec 与 CSV/JSON 投影成同一个 chart model，不上传行数据，也不增加服务端图表基础设施。

报告和演示现在都用 `{{ chart("regional-revenue-chart") }}` 引用同一个 artifact。Markdown renderer 把 model 变成 React 元素；Slides compiler 则把同一 model 转成经过转义的静态 HTML，再交给无脚本 sandbox。标题、描述与数据标签在两条渲染路径都不能变成可执行 markup。用户直接打开 Chart artifact 时仍能左侧编辑 JSON、右侧看 live chart，并让 File Agent 生成受 schema 约束的修改。

这也把 workspace transaction 的价值从“同时改多个文件”提升成“保护依赖图”。如果 Data patch 重命名了图表正在使用的列，完整 next workspace 会重新编译所有 Chart 并拒绝整笔写入；文档或演示引用不存在的 chart 同样不能应用。成本仍为零，但已经形成 `CSV/JSON → Chart model → Markdown/Deck Markdown → HTML runtime` 的稳定 compiler boundary，未来加入 line/area/scatter、SQL result source 或 PPTX export 时只扩展 spec 与 renderer，不改变引用协议。

## 8. 用户拥有的真实目录与 storage port

2026-08-11 的下一步实现把“source of truth 属于用户”从下载按钮推进成 workspace 级文件系统合同。支持 File System Access API 的浏览器可以连接一个真实目录：每个 artifact 继续使用原来的 `.md`、`.csv/.json`、`.sql`、`.chart.json`、`.deck.md` 文件，旧 `.html` 仍可识别；额外的 `rune.workspace.json` 只保存 version、顺序、ID、kind、文件名和 language，不保存正文，也不是新的私有内容格式。没有 manifest 的目录也能按扩展名扫描并生成稳定 ID。

浏览器版本刻意采用显式同步。Pull 先读取最多 50 个文件，并执行单文件 2 MB、总计 8 MB、文件名安全、唯一 ID/name、adapter parse、metric/chart dependency 等完整验证；只有用户确认后，才为当前每个 artifact 建 pre-pull checkpoint，并用一次 localStorage 写入替换设备 workspace。Push 同样需要确认，只覆盖同名 artifact 文件，不删除无关文件，最后写 manifest。由于浏览器文件 API 没有跨文件 transaction，中断的 Push 会报告停在哪个文件，而不会伪装成原子成功。

这个选择比首版直接引入云盘、账号或 Git server 更符合低成本原则，也比静默 auto-save 更尊重本地文件。目录 handle 只在当前 session 保留，刷新后需要重新授权；这既符合浏览器权限模型，也让产品先验证“用户是否真的希望外部 Agent 与 Rune 共享目录”。未来桌面 shell 可以复用同一 manifest/validation/storage port，再补 watching、临时文件 + atomic rename 和 Git commit，而 renderer、Agent patch 与 dependency compiler 无需变化。

## 9. Deck Markdown 与安全演示编译器

2026-08-11 的下一轮实现把演示从“人和 Agent 直接写完整 HTML/CSS”推进成真正的 artifact-as-code。默认演示现在是 `board-briefing.deck.md`：frontmatter 只接受 `version: 1`、标题、`rune/rune-dark` 主题、16:9 比例和受限语言；最多 40 页、12 万字符；每页用 `---` 分隔，并只接受 cover/content/metrics/split/conclusion 布局、eyebrow、标题、段落、列表、表格、强调、代码和已有 metric/chart binding。模型合同也明确禁止 raw HTML 和人工页码。

编译顺序保持可解释：先从 canonical Data 解析 named metrics，再解析/验证 Deck Markdown，随后由确定性 compiler 生成布局、设计 token 与自动页码，最后把 chart reference 替换成经过转义的静态图表 HTML。用户文本始终 HTML-escape；runtime 继续使用没有 `allow-scripts` 的 iframe。这样既保留 Overleaf 式“左侧 source、右侧成品”的即时反馈，又让 presentation source 能被 Git diff、Agent patch、目录同步和 checkpoint 直接理解。

旧 semantic `.html` 没有被破坏：导入、目录识别、验证和 sandbox preview 都继续保留，已有浏览器草稿也不会因默认格式迁移而丢失。但它只是兼容 bridge；新演示统一走 `.deck.md`。这一边界不增加服务端、数据库或常驻成本，同时为后续 layout diagnostics、主题包、Deck AST operation、PPTX/PDF export 建立了稳定入口。

## 10. Office Open XML semantic import

2026-08-11 的下一轮实现第一次接通了旧 Office 世界与 Rune canonical source。现代 DOCX、XLSX、PPTX 本质上都是由关系和 XML parts 组成的 ZIP package；WordprocessingML 把正文组织成 paragraph/run/text 和 table，SpreadsheetML 用 workbook/sheet/shared strings 表达工作簿，PresentationML 则把每一页拆成独立 slide part。([ECMA-376][14])([WordprocessingML 结构][15])([SpreadsheetML 结构][16])([PresentationML 结构][17]) 因此首版不需要上传文件或运行 LibreOffice server，只在用户点击 Import 后 lazy-load ZIP/XML adapter，就能在浏览器里完成 semantic extraction。

具体合同是：DOCX 的 paragraph、heading style、bold/italic/strike run、外链、编号和 table 转成 Markdown；XLSX 的每个可见 worksheet 分别转成 CSV，并处理 shared/inline string、boolean、number、常见日期格式与 formula cached value，以 `= + - @` 开头的文本会加 apostrophe 并提示，避免下载 CSV 后触发公式解释；PPTX 按 presentation relationship 顺序提取 title/body placeholder、bullet 和 table，生成经过验证的 Deck Markdown，再走现有 compiler 变成 HTML。导入多个 worksheet 时是一笔 workspace transaction：先解决 ID/name 冲突，再验证所有 adapter 与依赖图，最后只写一次 localStorage；任一 sheet、deck 或存储步骤失败，当前 workspace 保持不变。

这里必须明确“semantic fidelity”的边界。DOCX 图片/评论、XLSX hidden sheet/实时公式、PPTX 图片/图表/动画/master styling 都不会被伪装成已成功转换；界面会给出 omission warning。旧二进制 `.doc/.xls/.ppt`、宏格式和像素级 round trip 也不在首版合同里。安全上，压缩文件限制 12 MB，并限制 entry 数、单 XML part、总展开 XML、输出字符、Word block、worksheet/row/column/cell 与 slide 数；path traversal、DTD/entity 和无效 adapter 输出会在写入前拒绝。

这个实现新增的生产成本仍为零：原文件和解析结果都留在浏览器，转换依赖单独成为约 100 KB 的动态 chunk，普通用户不会为兼容层支付首屏下载成本。下一步如果真实 12 MB 文件产生 UI 卡顿，可以把相同的 package port 搬到 Web Worker；如果用户需要更高 fidelity，再按格式引入专门 converter，而不改变 `Office input → canonical source → Rune renderer` 的产品模型。

[14]: https://ecma-international.org/publications-and-standards/standards/ecma-376/ "ECMA-376 Office Open XML"
[15]: https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document "Structure of a WordprocessingML document"
[16]: https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document "Structure of a SpreadsheetML document"
[17]: https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document "Structure of a PresentationML document"

## 11. Import review as a trust boundary

v0.6 证明了 Office 文件可以低成本转成 Rune canonical source，但“adapter 验证通过后立即写入”仍然不符合产品最重要的承诺：所有有损或 Agent-like transformation 都应该先可见、再应用。v0.7 因此把 import 拆成两个明确阶段。第一阶段只在内存中建立 pending transaction，保存原文件名、导入开始时的 workspace 引用、冲突解决后的 artifact batch、完整 fidelity warning 和验证后的 next workspace；第二阶段必须由用户点击确认才执行唯一一次设备写入。

Review surface 会列出每个生成文件的最终名称、canonical language、行数和字符数，并显示最多 12 行/1,600 字符的 source preview。这个上限只约束 DOM 渲染，不截断真正待导入的 source；即使 XLSX 生成十个 worksheet，也能快速判断 sheet 是否正确拆分、CSV header 是否合理、PPTX 是否形成预期的 Deck Markdown。所有 omission warning 都直接展开，而不是只把第一条塞进短暂状态栏。弹层使用 `role="dialog"`、modal semantics、初始 focus、Tab 循环和 Escape 取消，让 review gate 不依赖鼠标。

事务完整性也覆盖转换期间的并发变化。Import 在 device draft hydrate 之前不可用，同一时刻只允许一个 FileReader/OOXML converter；pending transaction 通过 base workspace 对象身份检测 editing、folder pull 或 reset 导致的上下文替换。若上下文已经改变，确认会要求重新导入；若 localStorage quota 写入失败，review 保持打开且 React workspace 不变。取消同样不产生 checkpoint，因为没有任何现有 source 被改写。这样把“看到了什么”和“最终写入什么”锁在同一笔可审查操作里，同时仍然不新增服务器、账号、数据库或常驻运行成本。

这个模式也为后续 export 提供了对称设计：先生成并预览 export plan/fidelity report，再让用户下载二进制结果。若真实大文件测试表明主线程转换造成卡顿，可以把第一阶段移入 Web Worker，而 review transaction 和确认写入合同无需改变。

## 12. Deterministic semantic Office export

v0.8 把 Rune 的兼容边界从“旧 Office 文件可以进来”推进成“canonical source 也可以交付给仍在 Office 生态里的同事”。这里没有引入 Pandoc、LibreOffice server、SheetJS 或 PPTX SaaS；现有 `fflate` 足以把确定性的 XML parts 组装成标准 OOXML ZIP。Microsoft 的一手文档确认了最小图：DOCX 以 main document part 和 `document/body/paragraph/run/text` 为核心；XLSX 至少需要 workbook 和一个 worksheet；PPTX 则必须具备 presentation、slide、slide layout、slide master 与 theme。([创建 Word 文档][18])([创建 Spreadsheet][19])([创建 Presentation][20]) 这使三种导出可以继续遵循 `canonical source → isolated adapter → disposable binary`，而不是让二进制格式重新成为 source of truth。

具体实现是：Markdown 的 heading、paragraph、quote、bold/italic/strike、code、HTTP/mailto link、ordered/bullet list 和 table 生成 DOCX 的 styles、numbering、relationship 与 main document parts；CSV/JSON 先经过现有 canonical parser，再把 column 和 typed value 写成带 frozen header、autofilter 与基础 Rune style 的单 worksheet XLSX；Deck Markdown 先验证 AST 并解析 slide order、eyebrow、title、body、bullet 和 table，再生成 16:9 slide parts，以及 PowerPoint 要求的 layout/master/theme relationship graph。文档和演示里的 workspace metric 在导出前编译成当前值，所以接收者不会看到 `{{ metric(...) }}` template token；live chart 因没有稳定的可编辑 OOXML 对应物，会被明确列为 fidelity note 而不是偷偷栅格化或伪造成数据图表。

安全与可复现性也是 export contract 的一部分。XML 1.0 非法字符会被替换，文本统一 entity escape，Word hyperlink 只允许 HTTP、HTTPS 和 mailto；XLSX 所有字符串都写成 `inlineStr`，即使以 `= + - @` 开头也不会生成 formula node。ZIP entry 名由实现固定、输出文件名经过跨平台清洗、ZIP timestamp 固定到同一 epoch，因此相同 source 会得到逐字节相同的 package。DOCX 限 200,000 字符/10,000 blocks，XLSX 限 2,000,000 source 字符/10,000 rows/256 columns/50,000 cells，PPTX 继承 120,000 字符/40 slides，最终三种 ZIP 都限制 12 MB。

下载也沿用 v0.7 的信任模型。浏览器先 lazy-load exporter，在内存里生成 bytes、MIME、最终文件名和完整 fidelity notes，然后展示可键盘操作的 review；用户确认才创建一次 object URL，取消不触发下载，也不改 workspace、checkpoint 或 localStorage。若生成期间 workspace 引用发生变化，旧 package 不能确认。Importer 和 exporter 互相独立又能 round-trip：测试会把每个生成包重新送入 Rune importer，检查语义、XML well-formed 与 deterministic bytes；本轮还使用这台机器已安装的 Microsoft Office/Quick Look handler 成功渲染了 DOCX、XLSX 和 PPTX，避免只用自己的 parser 自证正确。

首版明确不是像素级 round-trip。Word comments/media/page design、Excel formulas/charts/source formatting、PowerPoint animation/notes/live chart/master 精确复刻都仍是 fidelity note。下一步应根据真实分享场景决定先补 PDF、图表静态图片嵌入，还是把大文件 generation 搬进 Worker；三者都不会改变 canonical source 与 review-before-download 合同。

[18]: https://learn.microsoft.com/en-us/office/open-xml/word/how-to-create-a-word-processing-document-by-providing-a-file-name "Create a word processing document"
[19]: https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/how-to-create-a-spreadsheet-document-by-providing-a-file-name "Create a spreadsheet document"
[20]: https://learn.microsoft.com/en-us/office/open-xml/presentation/how-to-create-a-presentation-document-by-providing-a-file-name "Create a presentation document"

## 13. Shared chart snapshots across the Office boundary

v0.9 解决 v0.8 最明显的交付断点：报告与演示虽然都能引用同一份 `.chart.json`，导出 Office 时却只能显示 omission note。直接生成 Office 原生 chart part 看似更“正统”，实际上会额外复制 chart cache、embedded workbook、style/color parts 和 relationship graph，并制造一个看似仍与 Rune 数据相连、实则已经脱离 canonical CSV/JSON 的第二份模型。首版更诚实的合同是 **current-data snapshot**：导出开始时用现有严格 Chart schema 解析当前 workspace data，保留 title、description、排序后的 label、formatted value、ratio 和 color，但明确告诉接收者这个 Office 副本不再 live。

DOCX 采用语义优先的三列表：category、relative bar、formatted value。bar 由带 Rune accent 的可选中文字和浅色 cell shading 构成，因此无需字体栅格化、图片 relationship 或 Canvas，也能在 Word 中直接复制标签和值；重新导入 Rune 时仍会成为可读 Markdown table。PPTX 则采用视觉优先的原生 shape tree：chart title/description、每行 label/value 是 text shape，track 与 bar 是带 `xfrm`、preset geometry 和 solid fill 的 rectangle shape。Microsoft 的 PresentationML 结构文档明确允许 slide shape tree 包含 shape、picture 和 table，Shape Properties 也把 transform、preset geometry、solid fill 与 outline 定义为标准子元素。([PresentationML structure][21])([Shape Properties][22]) 这意味着图表可以缩放和编辑，而不需要 PNG、SVG fallback 或第三方渲染服务。

布局合同同样受限而明确。单独一行的 chart directive 才会生成 snapshot；inline directive 保留 omission marker，提醒作者把图表独占一行。DOCX 可以顺序容纳多个 chart table；PPTX 每页只放第一个 chart，并在 chart 与 table 同页时优先 chart，全部通过 fidelity notes 暴露。split layout 把正文放左半、图表放右半，其他 layout 把图表放在正文下方。最多 20 个 marks 沿用 Chart schema；所有 shape 的 `x/y/cx/cy` 都在测试中验证不越过 16:9 canvas。

这个增强没有增加依赖、服务器、上传或持久化状态。相同 source 与 workspace context 仍生成逐字节相同的 OOXML；workspace 在 review 期间变化仍会拒绝旧 package。自动测试检查 DOCX/PPTX 中的 title、label、formatted value、bar geometry、XML well-formed、Rune import round-trip 和 slide bounds；独立 QA 又用本机 Microsoft Office Quick Look 实际渲染了 Word bar table 与 chart-first PowerPoint，确认 track、bar、label 和 value 都可见且没有越界。下一步如果真实用户要求在 Office 中继续编辑数据，应设计显式的 embedded-workbook export mode，而不是悄悄把静态快照伪装成 live chart。

[21]: https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document "Structure of a PresentationML document"
[22]: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.shapeproperties?view=openxml-3.0.1 "ShapeProperties class"

## 14. Portable scriptless HTML handoff

v0.10 直接补上目标链条里 `PPTX → Deck Markdown → standalone HTML` 的最后一段。Rune 早已把 Deck Markdown 编译成 iframe 内的 HTML 预览，但预览仍依附 workbench：离开应用就没有完整文档，也不适合发给没有 Rune 的人。为这个问题先建分享服务、账号、数据库和静态资源托管，会把一个“交付文件”的需求错误地升级成协作基础设施。更小且更可逆的答案是把当前已验证的 Deck、metric 和 Chart model 冻结成一个普通浏览器就能打开的单文件 `.html`。

导出流水线保持单向且可解释：从确认时的 canonical workspace 编译所有 `metric(...)`，验证 Deck AST，再用相同的严格 Chart JSON schema 从当前 CSV/JSON 构建 model，最后复用预览 compiler 和静态 chart renderer。最终文件内联 Rune theme、布局、页码与图表样式，并加入 print CSS，让每张 16:9 slide 在打印或“另存为 PDF”时独占一页。模板和图表引用只在交付副本中变成当前值，原 `.deck.md`、数据文件和 Chart artifact 均不改写；因此 Git diff、Agent patch、checkpoint 与目录同步仍只面对可读 source，而接收者拿到的是明确标注为 frozen snapshot 的成品。

“standalone”在这里是安全合同，不只是把 CSS 放进同一文件。输出不得含 script、iframe、object、embed、外链 stylesheet，也不得残留任何 `src` 或 `href` 外部资源属性；Deck 用户文本仍在 compiler 层统一 escape，最终边界再扫描完整文档，任一未解析 metric/chart token 或可执行/外部内容都会中止导出。文件在 UTF-8 编码后限制 2 MB，避免大量图表标签或未来 renderer 变化绕过 source 上限。相同 workspace context 产生逐字节相同的输出，测试覆盖恶意 metadata、缺失依赖、超限结果和 determinism，并由系统 Quick Look 的独立 HTML handler 实际渲染默认 deck 与 chart-first deck，避免只用 Rune 自己的 preview 自证。

交互上，HTML 与 Office 共用一份 export result 和 review dialog，而不是再造一条隐蔽下载路径。prepare 阶段只 lazy-load 对应 adapter，在内存里保存 bytes、文件名、MIME、fidelity notes 和开始时的 workspace 对象；review 明确说明文件没有 live binding、Agent、checkpoint 或 editor controls。用户确认才建立一次 object URL，取消不写设备；若期间 editing、Pull、reset 等替换 workspace，旧结果会被拒绝并要求重新生成。这既把 v0.7/v0.8 建立的“先审查、后产生副作用”原则扩展到开放 Web 格式，也为后续 PDF adapter 留出清晰路径：近期可以零服务地使用浏览器 print-to-PDF，只有真实需求证明跨浏览器排版不够稳定时，才考虑专门 PDF renderer。

## 15. Revision-bound Agent source operations

v0.11 处理的是 AI Native 编辑器最容易被普通“聊天框 + 生成全文”掩盖的问题：此前即使只把报告中的一句结论缩短，模型也必须重新输出完整 `nextSource`。这不仅浪费输出 token，还扩大了遗漏未修改段落、悄悄移除 metric/chart binding、覆盖用户并发编辑的概率。多文件 workspace 计划会把这个问题放大四倍。Review 和 checkpoint 能降低写入后的损失，却不应成为低质量变更协议的借口；模型输出本身应该只描述它真正想改变的最小 source surface。

新的 provider contract 因此不再接受模型编写的完整文件，而是每个文件 1–8 个按顺序执行的 `{ find, replace }`。`find` 必须是当前步骤 source 中精确出现一次的非空字面量，模型需要复制足够上下文使其唯一；`replace` 是精确替换，空字符串表示删除。这里刻意不用行号，因为前一个 edit 会改变后续行号；也不用 regex，因为转义、匹配范围和 catastrophic pattern 会形成另一套不透明语言。字面锚点可以直接解释给用户，也能在 Markdown、CSV/JSON、SQL、Chart JSON、Deck Markdown 和旧 semantic HTML 之间复用。单个锚点限 8,000 字符、replacement 限 16,000 字符、最终 source 限 120,000 字符，provider 输出预算从 16,000 降到 8,000 tokens。

编译器在服务端对请求携带的精确 source revision 顺序应用 operations。找不到、出现多次、find/replace 相同、多个 edit 最终互相抵消、目标 artifact 重复或越界，都会拒绝整个计划；任何一个 workspace 文件失败也不会返回其他文件的部分结果。成功后才生成现有 review UI 所需的完整 `nextSource`、具体 diff 和 operation count，并先在服务端执行 artifact 或 whole-workspace safety gate。客户端同时捕获规划开始时每个 artifact 的 `id + source` revision；模型等待期间发生编辑、Pull、reset 或另一笔 Agent 写入，旧 review 即使已经生成也不能确认。确认时会再次执行原有 adapter parse、只读 SQL、Deck raw-HTML、Chart dependency、metric binding、checkpoint 和单次 localStorage transaction，operations 没有获得绕过安全门的特权。

这一步还不是最终的 Markdown AST、table cell 或 slide-node operation，但它是兼容所有可读 source 的稳定中间层，也让后续 typed operations 有清晰落点：例如 `replace_section(heading)`、`upsert_row(key)`、`replace_slide(id)` 最终仍可编译成同一份 concrete patch 和 review transaction。当前实现不增加数据库、队列、协作服务或客户端依赖，只缩小模型输出与误改半径；真正需要 CRDT 时，也可以把这些已验证 operations 写入 operation log，而不必从“整文件覆盖”重新设计信任模型。

## 16. Artifact-aware semantic operations across the three suites

v0.11 的字面锚点已经解决整文件覆盖，但遇到结构性任务仍然过于脆弱：重写一个 Markdown 小节需要模型复制足够长的旧正文，修改 CSV 单元格需要正确引用整行，替换演示页还必须带上恰好唯一的 slide source。内容越长、重复句越多，`find` 越容易因为格式化或并发修改失效。AI Native 编辑器应该让模型表达“改哪个结构”，再由可信的本地代码决定“具体哪些字节变化”，而不是要求模型模拟文本编辑器。

v0.12 因此在同一份严格 discriminated union 中加入三组语义操作。Markdown document 可以按 exact heading 替换该节正文，或在该节之后插入一个自带 heading 的完整新节；section 边界延伸到下一个同级或更高层 heading，因此嵌套子节会和父节一起被替换。CSV 与 JSON data 可以用 `keyColumn + typed keyValue` 定位唯一行，再写入显式的 typed cells；字符串、数字、布尔和 null 不再通过模型猜测 CSV 文本类型，序列化保留 CSV/JSON 格式以及 JSON array/single-object shape。Deck Markdown 可以按第一个 `#`/`##` title 替换一页，或在其后插入一页；fragment 必须是一张完整 slide，不能携带 `---` 去注入额外页面。对 SQL、Chart JSON、旧 semantic HTML、Deck frontmatter 和精确 inline 修改，`replace_text` 继续作为通用回退。

这些操作仍然只是一种 provider plan，不是写入权限。服务端把 heading、typed key 或 slide title 对请求中的当前 artifact source 做唯一解析，按顺序编译成完整 `nextSource`；任何找不到、重复、类型不兼容、未知 column、duplicate key/cell、nested JSON、无 heading slide 或 separator injection 都让整份 workspace plan 失败。编译结果继续经过 adapter validation、只读 SQL、Deck raw-HTML、Chart/metric dependency 和 whole-workspace safety gate。UI 仍只展示 concrete per-file diff 与 operation count，确认时仍检查 captured revision、建立每个文件的 checkpoint，并执行一次 localStorage transaction。因此语义能力没有绕开 v0.11 的 review-before-write 信任边界。

边界是刻意保守的。Heading、key 和 slide title 当前必须唯一；JSON 只支持 object 或 object array 的扁平 scalar cells；没有任意 JSONPath、嵌套对象 mutation、模糊标题、正则匹配或模型定义的 parser。这样的限制让失败明确、实现无新依赖、生产服务成本仍为零，也避免把格式知识复制进另一个隐藏数据模型。后续可以给 Markdown/Deck AST 节点分配稳定 ID、增加 table cell/column operation，或在真实协作需求出现后把已验证 operation 写入 CRDT log；这些演进都可以继续编译到现有 concrete patch、review 和事务安全层，而无需重写用户信任模型。

## 17. Blank artifact creation as the beginning of a real workspace

到 v0.12，Rune 已经可以编辑、导入、导出、同步和让 Agent 修改五类 artifact，但一个最基础的产品动作仍然缺失：用户不能直接从空白开始。文件栏里的 `+` 实际打开 Import，意味着创建一份新报告仍要先去 Finder 或其他编辑器写 `.md`；创建新表格或演示更依赖用户记住 CSV header 与 Deck frontmatter。这会让产品停留在“优秀的示例 workspace viewer”，而不是能够替代 Word、Excel、PowerPoint 起点的编辑器。继续增加 Agent operation 而不补这个入口，会把内部智能建立在不完整的人工工作流上。

v0.13 把 New 定义为 canonical-source transaction，而不是文档对象向导。用户选择 Document、Data table 或 Presentation，输入一个最多 80 字符的单行标题；界面立即展示最终 filename、language 和完整初始 source。Document 只有一个 Markdown heading，Data 只有 `Item,Value` 两列且零行，Presentation 只有严格 version/theme/ratio/lang frontmatter 和一张 cover slide。没有隐藏 block tree、sheet model 或 slide JSON，创建结果从第一字节起就能直接交给 Agent、Git、folder sync、preview 和 Office export。

Identity 也必须在创建时稳定。标题保留 Unicode 可读性，filename/id 则经过 NFKC/NFKD 规范化、portable slug、Windows reserved-name 防护和长度限制；同名比较不区分大小写，冲突通过确定性 `-2`、`-3` 后缀解决。Import 与 New 现在共用同一个 conflict resolver，避免两条入口逐渐产生不同命名规则。完整 next workspace 会重新跑 artifact validation、metric/chart binding 和 Chart source resolution；最多 50 个 artifact，与真实目录 port 的上限一致。

交互继续沿用 Rune 的信任模型。New dialog 有 radio semantics、初始输入焦点、Tab focus trap、Escape cancel、source preview 和明确的本地写入说明。确认时先把完整 next workspace、selected id 与 checkpoint map 一次写入 localStorage，成功后才更新 React；quota 或 validation 失败时 dialog 保持可见，当前 workspace 对象不变。若已经连接真实目录，新文件只进入 device workspace，必须由用户明确 Push 才写到目录，从而不把“New”偷偷升级成外部文件副作用。

这一步同时为真正 AI Native 的下一阶段建立创建边界。未来 workspace Agent 可以返回受限的 `create_artifact` plan，但模型不应自行决定任意 id、扩展名、隐藏 metadata 或直接写状态；它只需要给出 kind、title 与受限初始内容，Rune 仍复用同一 identity factory、full-workspace validation、concrete preview 和 atomic persistence。下一步应让 Agent 能从现有报告或数据创建一份新的 Deck/Document，而不是要求 workspace 预先存在所有目标文件。

## 18. Workspace Agent 创建文件：意图不是写权限

v0.14 把上一节留下的边界真正闭合了。此前 Workspace Agent 最多只能修改已经存在的 4 个文件，所以“根据当前报告做一份董事会演示”必须先由用户手工 New 一个空 Deck，再要求 Agent 填充。这不是 AI Native workflow：用户仍在替 Agent 准备目标容器。反过来，让模型直接返回一个带任意 `id`、文件名、扩展名、language 和完整 source 的对象虽然省代码，却等于重新引入 v0.11 已经移除的整文件生成问题，还会让模型绕过 v0.13 的命名、模板和持久化合同。

新的 workspace provider contract 因此不是“允许模型创建文件”，而是允许模型提出两类受限动作：`patch_artifact` 指向请求中已有且唯一的 artifact；`create_artifact` 只包含 `document | data | slides`、最多 80 字符的 title、说明和 1–8 个 typed edits。两者合计最多 4 个动作。创建动作没有 `artifactId`、name、extension、language、source 或 `nextSource` 字段；Structured Outputs 在 provider 边界就排除它们。System instruction 同时把三个精确初始模板告诉模型：`# {title}` Markdown、`Item,Value` CSV、严格 frontmatter 加同名 cover slide 的 Deck Markdown。模型只需要针对这些可见锚点表达 section、row、slide 或 exact-text operation，不需要猜 Rune 的内部身份规则。

服务端编译时先把 kind/title 送进 v0.13 的同一 identity/template factory，再把 typed edits 顺序应用到生成的 canonical source。重复标题会在真实 evolving identity set 上得到确定性的 `-2`、`-3`，而不是由模型协调；创建后的完整 artifact 才进入响应。一个计划可以同时修改旧报告并创建新演示，但确认前它们只是内存中的 concrete mutation。最终 safety gate 把 patched originals 与 creations 合成完整 next workspace，统一检查 adapter、只读 SQL、Deck raw HTML、metric/chart dependency、重复 id/name 和动作上限；任一 created file 不合法，已有文件的有效 patch 也不会泄漏成部分结果。

Review UI 也没有把 creation 伪装成“Agent 已经做完”。新文件带明确的 `New file` 标记，并以空 source 为 before-side 展示真实增删行；用户可以在同一列表切换现有 patch 与 creation，再整体 Apply 或 Discard。确认时仍先比较规划开始时捕获的整个 workspace revision。已有文件逐一写入 pre-change checkpoint；新文件没有旧 source，因此不制造虚假的 checkpoint。随后完整 workspace、selected id 和 checkpoint map 只写一次 localStorage，成功后才交换 React state并打开第一个新文件；连接目录时仍只提示显式 Push，Agent Create 不获得外部文件系统副作用。

生产环境没有配置模型密钥时也不能退化成无法验证的按钮。确定性 local workspace planner 现在能从可见 artifact 名称建立 context-aware Document、Data index 或 Deck，其中快捷命令“根据当前报告新建一份演示”会生成一份可解析的多页 Deck，并走相同 factory、diff、whole-workspace mutation 和 atomic apply。这不是用模板假装智能，而是把 provider 能力的安全与交互骨架在零服务成本路径上持续可测。真正的模型只替换“从上下文决定 title 与 edits”这一段，不能替换 identity、compiler、review 或 persistence。

这轮仍刻意不允许 create Query/Chart、让同一计划再次 patch 刚创建的 artifact、模型定义自有模板、自动 Push 到目录，或跨会话后台执行。Query/Chart 的创建需要先证明 schema-aware intent 不会产生空壳；同计划对新文件的全部编辑已经可以放进 creation action，没有第二次定位的必要；自动外部写入则会改变权限模型。下一步更有价值的是给新文档/Deck 的结构节点稳定 identity、让 Agent 能引用明确的 selected source range，或为一次 create-from-context 建立可重复 eval，而不是扩大模型可写字段。

## 19. Selection Agent：把人的指向变成可证明的写入边界

v0.15 补的是 File 与 Workspace 两种 scope 之间最常见、也最接近真实写作的动作：用户已经指着一句话、一个 CSV 单元格值或一段 slide source 说“只改这里”。只有 File scope 时，Agent 即使理解了指代，技术合同仍允许它改完整文件；只有 Workspace scope 时，误改半径更大。把 selection 只当 prompt 中的一段引用也不够，因为“请只改这段”仍是自然语言愿望，不是可以在写入前验证的约束。AI Native 编辑器应该把人的光标和选区提升为一等上下文，同时把“选区之外不得变化”变成机器可证明的规则。

选区坐标采用 textarea 原生的 UTF-16 `selectionStart`/`selectionEnd`，而不是行号、DOM Range 或重新计算的 code-point index。行号会被前序 operation 改写，DOM Range 与 canonical source 没有稳定映射，code point 又和浏览器控件报告的 offset 不一致。请求同时绑定 `artifactId`、完整 source revision 和半开区间 `[start, end)`；空选区、越界、超过 16,000 个 code units、revision 已变化，以及恰好切开 emoji surrogate pair 的范围都会在 provider 调用前失败。16,000 的限制既控制模型上下文和本地替换成本，也让“选了整份超长文件”不能伪装成精确 selection。

模型获得完整 artifact 作为结构上下文，同时明确获得 `start`、`end` 和 `selectedSource`，但它没有新的直接写入 API，仍只能返回现有的 section、typed row、slide 或 exact-text operation。这样不会复制第二套编辑语言，也允许模型在选中的 Markdown section 内使用结构操作。服务端先把 operation 顺序编译成完整 `nextSource`，再验证原 source 的精确 prefix 与 suffix 在结果中逐字不变；因此一个语义操作即使本身合法，只要实际范围跨过 selection 边界，整个请求也会失败。这里比较的是 canonical source，不依赖模型声称自己改了哪里。

客户端确认时重复同一条证明。Review 保存规划时的 source revision 与 selection；Apply 先要求只有一个 patch、没有 creation，再检查选区外 prefix/suffix，之后才建立 pre-change checkpoint，并进入既有 adapter validation、metric/chart dependency、完整 workspace 编译和单次 localStorage transaction。即使网络响应或内存中的 pending review 被篡改，第二道边界也会在任何持久化之前拒绝。选区能力因此缩小了模型权限，却没有削弱 v0.11–v0.14 已建立的 concrete diff、review-before-write、checkpoint 和 atomic apply。

交互保持接近普通编辑器：在左侧 source textarea 选中文字会自动切到 Selection scope，并显示绑定字符数；键盘原生 Shift 选区同样有效。Document/Slides 提供“压缩成一句”和“三个要点”，Data/Query/Chart 提供“转大写”和“去除两端空白”的零密钥快捷命令；本地 planner 也必须生成具体 patch 并通过完整 workspace safety gate，不能因为没有 provider 就绕过 review。编辑 source、切换 artifact、Pull、reset、New、import 或成功 Apply 都会使旧选区失效，避免把屏幕上的旧高亮误当作当前 revision 的权限。

这轮刻意没有把 selection 持久化、做跨文件多选、在 revision 变化后 fuzzy rebase，或把它伪装成稳定 AST node。当前选区是一次短生命周期的精确 source capability：简单、可解释、失败安全。下一步若真实使用表明用户常常反复引用同一段，可以给 Markdown block、data row 和 slide 分配稳定 identity，再让 selection 升级为可重定位的结构引用；在那之前，宁可让过期选区明确失败，也不猜测用户还想改哪一段。

## 20. Preview-to-source targeting：让“我看到的这里”成为精确上下文

v0.15 让用户在左侧源码中选一段并把 Agent 权限限制在其中，但真实的 Word、Excel、PowerPoint 工作方式通常从右侧成品开始：人先看到一段结论、一行数据或某张 slide，再决定“改这里”。如果必须先回到源码里寻找对应字符，左源右预览就仍然是两个并排窗口，而不是一个 AI Native 编辑器。更危险的捷径是把点击到的 DOM 文本或 iframe 坐标直接塞进 prompt；编译后的 metric、chart、Markdown 标签和 layout 已经改变了文本与层级，它们没有资格代表 canonical source offset。

v0.16 因此把 preview target 定义为一种本地、短生命周期的 source map。它只有 `kind + index + label + [start,end)`，从当前 artifact revision 重新推导，不写进 Markdown、CSV/JSON 或 Deck，也不进入 localStorage。点击 target 后，Rune 只做一件有权威性的事：把原生 textarea 设到这段 UTF-16 range，并启用 v0.15 的 Selection scope。后续 provider input、operation compile、prefix/suffix 证明、diff review、checkpoint 和 atomic apply 完全不变。右侧预览负责帮助人指向，左侧 canonical source 仍负责定义权限。

三类 source map 不能共用一个草率的“按行切割”。Markdown 以 fenced-code-aware heading scanner 找到可见 section；每个 heading 到下一个可见 heading 是一个不重叠 target，因此 code fence 里的 `##` 不会制造假段落。CSV scanner 维护 quote 状态，允许一个 record 跨多行、处理 `""` 转义和 CRLF，并与 parser 的 greedy-empty row 行为对齐。JSON scanner 从顶层 array 逐个读取完整 value，跟踪 string escape 与嵌套 `{}`/`[]`，所以字符串里的括号不会提前截断。Deck 则先通过严格 parser，再从 frontmatter closing delimiter 之后切出 slide，target 保留 layout/eyebrow metadata，却不包含 `---` separator。

交互也遵守“看得见、可撤销”。文档在 paper metadata 下显示可横向滚动、键盘可操作的 section outline，并继续把完整 Markdown 一次编译，避免为了点击能力破坏跨段 reference 等语义；数据表每一行支持 click、Enter 和 Space；演示因为 iframe 保持 `sandbox=""` 且禁止脚本，不注入 postMessage bridge，而是在 iframe 外显示带标题的 slide target strip。激活后左侧立即获得真实 selection highlight，Selection scope 与字符数随之更新。超过 16,000 字符或已经不匹配当前 revision 的 target 会明确失败，不能退化成 File scope 后悄悄扩大权限。

这项能力还刻意拒绝三种假映射。SQL result row 是 query 的派生结果，不一定对应 SQL source 的一段字符；Chart mark 对应数据 artifact，而不是当前 Chart JSON 的一个连续 range；legacy semantic HTML iframe 也没有经过可证明的 source target compiler。因此它们暂时不显示可点击 target。这样的缺口比错误地告诉用户“只会改这里”更诚实，未来可以通过 lineage-aware cross-artifact targeting 让 chart bar 指向数据行，或让 query result 指向可追踪的 provenance record，而不是把屏幕坐标伪装成 source identity。

当前 target 仍不是稳定结构 ID：在 heading 前插入文字、格式化 JSON 或重新排序 CSV 后 offset 会变化，旧 target 立即失效并重新计算。这与一次编辑意图的生命周期相符，也保持零新依赖、零服务成本。下一步若要支持评论、长期引用或协作，应把 Markdown block、data row 和 Deck slide 的稳定 identity 设计成可选 metadata 或独立 operation log；在那之前，preview-to-source map 已经把视觉浏览与可证明的 Agent 权限接通，而没有引入第二套文档模型。

## 21. Chart-to-row provenance：派生视图也要能回到事实

v0.16 有意不让 Chart mark 变成 target，因为柱形是派生结果，不属于当前 `.chart.json` 的某段连续 source。这个保守决定是正确的，但也暴露了数据产品的核心断点：用户在报告里看到 APAC 柱形异常，真正想编辑的是 `regional-revenue.csv` 中产生它的那一行。如果只能手工打开数据文件再搜索，lineage strip 只是说明文字，不是可操作的数据血缘。AI Native Office 应该允许人从成品一路回到事实，同时不能把“看起来相同”误当成 identity。

最容易犯的错误是用 bar label 反查 category column。分类值可以重复，图表还可能排序、截断、格式化；两个 `Shared` label 没有任何理由被猜成同一行。v0.17 在 chart compiler 读取每行时就记录零基 `sourceRowIndex`，然后把它与 label/value 一起经过 sort 和 `maxItems`。显示顺序可以从 `[0,1,2]` 变成 `[1,2,0]`，但每个 datum 的 provenance 不变。重复 label 因而完全不影响定位，也不需要给 CSV 注入隐藏 id。

点击时，Rune 使用 chart model 的 `sourceArtifactId + sourceRowIndex`，在当前 workspace 中重新取得引用的数据 artifact，再运行 v0.16 的 CSV/JSON target compiler。只有对应 index 仍然产生一个 exact `data-row` range 时，这根柱形才获得交互；data source 缺失、parser error、row mapping 数量不一致或 index 越界都会让它保持普通只读 mark。HTML 上的 `data-chart-source-row` 只用于可观察性和测试，不是权限来源；label、排序位置、bar 宽度更不会参与 source resolution。

成功激活后是一次显式的跨 artifact 导航：workbench 切到真实 CSV/JSON 文件，等待 textarea 呈现新 revision，再选择精确 row range，并启用 Selection Agent。报告中的 embedded React chart 与独立 Chart preview 都支持 click、Enter 和 Space，footer 明确提示可以打开 canonical row。之后的 prompt 只看这行 selection，provider operations 仍要通过服务端与客户端 prefix/suffix proof、完整 data parser、chart dependency recompile、diff review、checkpoint 和 atomic persistence。因此“从图表改数据”没有变成图表直接写数据。

Deck iframe、standalone HTML、DOCX 和 PPTX 中的 chart 仍是静态交付副本。为了让演示里的柱形可点而给 `sandbox=""` 注入脚本，会破坏此前建立的无脚本边界；Office 文件也没有 Rune runtime。当前更诚实的体验是在编辑 workbench 的 React chart 上提供 provenance，导出物保持 frozen snapshot。未来若需要交互式分享，应单独定义带可信 runtime 与只读 provenance payload 的发布格式，而不是悄悄改变现有 standalone 合同。

这轮也没有声称解决 SQL result provenance。Query 可能聚合、join、filter，一行结果可能来自多行甚至多个 source，单个 `sourceRowIndex` 不够表达。下一步可以让 DuckDB query adapter返回 bounded provenance set，或先实现 column/cell-level data target，让 Chart mark 精确到 category/value cells；只有能够证明 lineage 时才扩展 target。这个原则比“所有东西都能点”更重要：视觉对象可以帮助用户指向，但写入权限必须始终落在可验证的 canonical source 上。

## 22. Cell-level context：表格不是一组行，而是一组可指向的事实

v0.17 让图表能够回到产生它的数据行，已经解决了“这个柱形来自哪条记录”，却还没有解决用户更常见的意图：“把这个数改成 190 万”或“只统一这个状态值”。整行 selection 会把同一记录里的客户数、成本和地区名也交给 Agent；即使 prefix/suffix proof 能保证行外不变，行内的权限仍然比人的指向更大。一个要替代 Excel 的 AI Native 表格不能只把 row 当成最小对象，可见 cell 必须成为与 Markdown section、Deck slide 同等级的一等上下文。

这里不能用 `String(value)` 去原文搜索。CSV 中的 `"Line one, exact\nLine two"` 同时包含逗号、换行与引号语法，相同文本也可能出现在多个列；JSON 的字符串值带引号，数字/boolean/null 没有引号，嵌套 object 又有自己的括号层级。v0.18 因此把 cell target 定义为 lexical source token，而不是解析后的 display value。CSV scanner 在完整 record range 内继续维护 quote 与 `""` escape 状态，只在引号外的逗号处分列；JSON scanner 逐个解析 object key，并用 string escape 与嵌套栈找到对应 value 的完整范围。选中 quoted CSV 或 JSON string 时，语法引号也留在 selection 内，让任何 replacement 都必须继续生成合法 canonical source。

cell target 仍然只在可以证明时存在。空 CSV 字段没有非空 range，JSON 中缺失的 property 根本没有 source token，primitive array 的合成 `row` 序号也只是 UI 列；这些位置不伪造 collapsed selection。JSON duplicate key 更危险：`{"Region":"old","Region":"new"}` 的 parser 通常采用最后一个值，但用户看到的单元格无法说明应该授权哪一个 lexical occurrence，所以该 object 只保留完整 row target，不产生任何 cell capability。row 数量与 parser 结果、CSV field 数与 columns 不一致时也整体拒绝 cell map。失败仍然是只读或退回用户显式点击行号，而不是猜测。

表格交互据此分成两个清楚的权限层级：每个可证明的非空 cell 是原生 button，click、Enter 或 Space 只选择该 value token；固定行号也是 button，但明确表示选择完整 canonical record。这样用户仍能说“整理这一行”，也可以把权限缩到一个值。零密钥路径新增“把选中数值乘以 1.1”的确定性动作，让默认收入 cell 可以实际走完选择、具体 patch、依赖重编译和 review，而不是只展示一个不可验证的高亮；它只接受单个未加引号的有限数字，格式不明确时直接拒绝。激活继续复用原生 textarea range、Selection Agent、双重 outside-selection proof、concrete diff、checkpoint、dependency recompile 与 atomic write，没有新增 cell mutation back door。cell 的 row/column metadata 只用于当前 revision 的定位和可访问标签，不进入持久化文档模型。

图表血缘也从 row-level 收紧到 field-level。chart compiler 已经保存排序与 `maxItems` 之前的 `sourceRowIndex`；v0.18 再把它与严格 spec 中的 `category`、`value` column 组合。点击 APAC label 会选择 Region cell，点击 bar 或格式化金额会选择 Q2 Revenue cell，即使两个 label 都叫 `Shared`，也由原始 row index 区分。DOM 的 label、宽度、格式化金额和 `data-chart-source-row` 继续只是展示与测试信号，真正 target 只能由当前 data artifact 的 cell compiler 产生。独立 Chart 与报告内 React chart 使用相同原生按钮，Deck/HTML/DOCX/PPTX frozen snapshot 仍不获得脚本权限。

这一步让“我看到的这个值”成为可证明的最小 Agent capability，但还没有把表格变成隐藏 spreadsheet model，也没有声称每个空格都可编辑。下一步可以增加 schema-aware column operation、显式的空 cell insertion target，或让 selection review 显示 `artifact → row → column` breadcrumb；更大的未解问题仍是 SQL provenance，因为 aggregate/join result cell 可能对应一个 source set 而不是单个 token。Rune 应先让 DuckDB adapter产出有界、可验证的 lineage set，再决定是否允许 query result 反向导航，不能把本轮的一对一 cell contract错误套到多对一计算结果上。

## 23. Proof-safe SQL result lineage：只在能证明一对一时允许回写上下文

v0.18 已经让原始表格和图表精确到 cell，但 Query 仍是断开的派生视图。最诱人的实现是拿结果值或列名回到 CSV/JSON 中搜索；这在重复金额、别名、排序、格式化、过滤和空值存在时都会产生假血缘。更危险的是 aggregate、join 或 window result：一个可见单元格可能来自多行、多列甚至多个 relation，硬塞一个 `sourceRowIndex` 会把“看起来像来源”伪装成 Agent 的真实写入权限。v0.19 因此不追求让所有查询都可点，而是先定义一条可机械证明的窄通道；任何证明失败都只影响导航能力，不影响 SQL 本身的只读执行。

第一条证明发生在数据进入 DuckDB 之前。Rune 先用现有 `parseDataSource` 得到 canonical columns 与 rows，再给每一条解析成功的记录附加一个碰撞安全的临时 import-order 字段，以 JSON 形式装载并按该字段建立 `workspace_data`。这样 DuckDB 的 `rowid` 与 Rune cell compiler 使用的 parser row index 完全一致，即使 CSV 原文里存在会被 greedy parser 跳过的空记录，也不会把结果误指到下一行。临时字段不会出现在用户表、query result 或持久化 source 中。没有列的 source 会先要求用户定义 schema；大小写不唯一的列 identity、用户声明的 `rowid` 或保留 provenance 名称则关闭血缘能力，但查询仍照常运行。

第二条证明由一个保守、quote-aware、parenthesis-depth-aware 的 SELECT compiler 完成。它只接受以单个 `workspace_data` 为 relation、保持逐行语义的顶层 SELECT，并在查询的第一列注入带 relation qualifier 的隐藏 `rowid AS __rune_source_row_index__`。WHERE、ORDER BY、LIMIT/OFFSET 和确定性的 scalar expression 可以保留，因为它们不会把一个输出行扩成多个来源；CTE、DISTINCT、GROUP BY/HAVING、aggregate、JOIN 或逗号 relation、set operation、pivot/unpivot、sample、window/QUALIFY、subquery 与未知 row-expanding function 都停留在 read-only。这里采用有限白名单是刻意的：DuckDB 新增函数不应该自动扩大 Rune 的写入能力。

第三条证明落在 projection，而不是显示值。compiler 按 SELECT projection 顺序区分直接字段、qualified/unqualified star 与 derived expression；运行后再检查可见结果列数是否与展开后的投影严格一致。直接字段映射到同一 source row 的精确 column cell，别名不改变它的身份；算术、CASE、CAST、ROUND 等计算列即使逐行执行，也只显示结果，不获得 target。结果行号只有在隐藏 rowid 合法、范围内且整套 projection arity 证明通过时才可以打开 canonical record。这样 `Revenue AS amount` 能回到 Revenue cell，而 `Revenue * 1.1 AS forecast` 永远不会把计算值冒充原始事实。

Query preview 还必须绑定完整 revision。ready/error state 同时保存 query source、data artifact id 与 data source；任一侧编辑后，旧结果立即变回 loading，并由新执行重新建立血缘，不能把旧 rowid 套到新数据上。点击可证明的 result cell 或 row number 后，Rune 通过当前数据 artifact 的 lexical target map 导航到真实 CSV/JSON token，再复用 Selection Agent 的 prefix/suffix proof、review、checkpoint 与 atomic write。所有未证明形状仍然可以得到 DuckDB 结果，但 footer 会明确说明 read-only，而不是让不可点击看起来像故障。

这轮没有把 aggregate 或 join 粗暴降格成“永远不能有血缘”，只是拒绝在缺少集合语义时假装完成。未来可以为聚合单元格返回有界 provenance set，并把它呈现为“查看 8 个来源”而不是单一写入 target；join 则需要 relation-qualified artifact/row/column identity、cardinality 上限和明确的歧义 UI。只有这些集合在 query revision、data revisions 和 parser identity 上都可验证后，才应该扩大 Agent capability。v0.19 选择的窄边界让 SQL result 第一次接入视觉到事实的完整链路，同时保持最重要的不变量：派生视图可以帮助人指向，但永远不能自行发明 canonical source。

## 24. Workspace context graph：让模型看到关系，而不是吞下整个目录

v0.19 之前，Rune 已经分别知道 metric 来自第一份 Data、Query 读取 `workspace_data`、Chart JSON 指向某个 Data id、文档和 Deck 又嵌入哪些 Chart，但这些关系只散落在 preview badge、validation 和各自 compiler 里。左侧 activity rail 的 Data graph 甚至还是一个没有行为的按钮。更实质的问题在 Agent 边界：Workspace scope 直接把全部 artifact 交给 provider，所以第七个文件出现后，整条模型路径只能退回本地规则。把上限简单提高到 20 或 50 既增加 token 成本，也会把与当前意图无关的文件扩大成模型权限；这不是可扩展的 AI Native workspace。

v0.20 把已有事实收敛成一个纯函数图谱，而不是新建数据库或把 graph metadata 写进 manifest。每次 source revision 都重新编译四类有向边：canonical Data → metric consumer、canonical Data → Query、Chart 指定的 Data → Chart、Chart → 使用 `{{ chart(...) }}` 的 consumer。edge 只包含 artifact identity、kind 和已经存在于 source 的 reference names，不复制数据值。无效 Chart JSON、缺失 Data、未解析 metric/chart id 会成为显式 issue；Rune 不为一个拼错的 id 制造 ghost node。用户打开 Data graph 后可以用原生 button 从边的 source 或 consumer 进入真实 artifact，当前文件和 Agent context 都有可见状态。

图谱同时解决大 workspace 的模型上下文，但“相关”不能只用无向距离粗略截断。Rune 从当前 artifact 探索其 connected component，却按有向依赖执行 **upstream closure**：一个 report、deck、chart 或 query 只有在它已知的上游 source 全部能进入包时才可发送。没有关系的文件不会为了凑够数量被塞进去；selected artifact 的依赖闭包若装不下，也不会偷偷丢掉一个 source 后继续调用模型。包最多 6 个 artifact，非 selected 单文件最多 100,000 字符，总计最多 180,000 字符，并最终恢复原 workspace 顺序，确保“第一份 Data”在 metric compiler 与 `workspace_data` 中的语义不会因 context packing 改变。

图谱不是客户端可以任意声称的 prompt hint。请求只携带 context 内部的边；compiled metric values 也只有在其 canonical Data 已进入包时才能同行。API 会从随请求发送的 canonical sources 独立重编译，拒绝 unresolved upstream，并逐边精确比较；省略、伪造、过期、端点不属于 context 或重复 edge 都会在 provider 调用前失败。即使图谱和模型 plan 都合法，服务端只能编译这几个文件的 typed operations，不能直接写状态。浏览器 Apply 仍绑定规划开始时的完整 50-file workspace revision，并在真实全量 workspace 上重跑 adapter、metric、Chart 和 identity validation；因此被 context cap 省略的 downstream consumer 仍然可以否决一个破坏它的 Data patch。

这个边界把 Data graph 从装饰升级为成本与权限控制面：小 workspace 的行为不变，大 workspace 不再因为总文件数超过 6 就必然失去模型能力，而 provider 只支付与当前关系相符的 source token。没有新增 D1、R2、账号、embedding、向量库或后台索引；刷新和编辑后图谱由同一份可读文件立即重建。它也刻意不声称理解自然语言中的隐式关系：两个没有 metric/chart/query binding 的 Markdown 文件仍是 unlinked，不能仅凭相似标题自动连边。

下一步可以在不改变安全合同的前提下增加用户显式 pin/context set，让一次跨越无绑定文件的任务也可审查；更重要的是把 user-defined metric 与 Query output 变成正式 dependency source，这样 `CSV → SQL → Chart → Report/Deck` 会进入同一张图。目前图谱不是持久评论系统、稳定 node identity 或协作 CRDT，也不会用 embedding 猜测依赖。Rune 先证明显式 source relationship 足以同时改善可解释性、token 成本和模型权限，再决定哪些隐式关系值得引入。

## 25. Explicit context pins：让用户补充意图，但不让模型自行扩大视野

v0.20 的 dependency graph 解决了“已经写进 source 的关系如何进入 Agent context”，却故意不猜自然语言里的隐式关系。这个保守选择会产生一个真实断点：两份独立 Markdown 简报可能没有 metric、query 或 chart binding，但用户仍然会提出“把这两份文档合并成一个董事会版本”；一份 CSV 和一份没有显式 binding 的新 Deck 也可能需要共同参与一次创建任务。如果 Rune 因为图上没有边就只能使用单文件模型，用户会被迫往正文里添加虚假 token；如果 Rune 自动用标题相似度、embedding 或最近打开记录补齐，又会把概率相关性伪装成权限。

v0.21 因此把 **pin** 定义成一次由用户明确授予的短生命周期 context capability。Workspace 文件列表中的每个 artifact 都有独立的原生 pin button；按下后，该文件成为 selected artifact 之外的 required root。最多允许五个 pin，加上当前文件后仍受六文件模型包上限约束。Data graph 的 context card 会同时显示自动纳入与手动 pin 的文件，并允许一次清空；文件列表、Agent identity、planning notice 和模型完成提示都显示 pin 数量，用户不必从不可见请求中猜模型究竟看到了什么。

pin 不是一条新的 dependency edge。真实 edge 继续只能从 metric、`workspace_data`、Chart source 和 chart embed 的可读 source 编译；pin 只说明“这次任务也需要看这个 root”。选包算法对 selected 与所有 pin 求 upstream closure 的并集，再从这些 root 的 connected components 中按确定性顺序补足相关文件，最后恢复原 workspace 顺序。一个被 pin 的 report 如果依赖 Data 和 Chart，这些 source 必须整体进入；若闭包超过六文件、单文件 100,000 字符或总计 180,000 字符，Rune 会保留 required roots 的可见性并关闭 provider path，而不是悄悄丢掉某个 pin 后声称模型拥有完整上下文。

服务端不能只相信一个任意的六文件数组。请求现在必须显式携带 `workspacePinnedArtifactIds` 和内部 dependency edges；API 从收到的 canonical sources 重新编图、拒绝 unresolved upstream、逐边比较，然后以 selected id 与 pin ids 重新运行同一个 context selector。任何既不在 selected component、也不能从某个 pin root 到达的 disconnected artifact 都会在 provider 调用前失败。这样显式 pin 可以跨图，但不能被客户端借来给无解释的 padding 打掩护。provider instructions 同时说明 pin 是 intentional context，不等于必须修改每个 pinned file。

无模型密钥时也不能退回旧的“读取整个 workspace”语义。确定性 local planner 现在同时接收完整 workspace 与选中的 context pack：前者只负责创建时的 collision-safe identity 和最终安全校验，后者决定内容综合或同步时真正可见、可修改的文件。无论 provider 还是 local plan，Apply 仍然绑定规划开始时的完整 workspace revision，在所有真实 artifact 上执行 adapter、binding、identity 与 dependency validation；pin 改变模型读权限，不改变写入事务的否决范围。

这些 pin 不写入 localStorage、checkpoint、folder manifest、source、Git 或 dependency graph；刷新即消失，Folder Pull 和 Reset 也会清空。短生命周期是产品语义而不是暂时偷懒：用户表达的是“本次请求需要这些材料”，并未声明永久架构关系。未来若高频工作流确实需要稳定 context set，应设计一个可读、可审查、可版本化的 workspace source artifact，而不是悄悄把 pin 持久化为隐藏 UI 状态。下一条更重要的数据链路仍是 Query output 和 user-defined metric 成为正式 dependency source，让真正有长期语义的 `CSV → SQL → Chart → Report/Deck` 关系继续回到 canonical files，而不是依赖手工 pin。

## 26. Query-backed Chart：让 SQL 成为可复用视图，而不是隐藏的数据副本

v0.21 的图谱已经能说明 Data 如何进入 Query、Data 如何进入 Chart、Chart 又如何进入报告和演示，但这仍是两条并行支线：SQL 结果只能在 Query preview 里看，Chart 只能直接读取原始 CSV/JSON。真实分析工作却常常先计算利润率、同比或分组结果，再把这个派生视图画成图。如果用户必须手工复制 SQL 结果到另一份 CSV，Rune 不仅打断了 live loop，还制造了一个没有来源证明、很快会过期的第二事实表。v0.22 因此让 Chart 的 `source` 可以直接指向 Query，第一次把 `Data → SQL → Chart → Markdown/Deck` 编译成一条完整且可导航的链。

最关键的设计不是“如何把二维数组传给图表”，而是 Query result 到底是不是 artifact。当前答案是否定的：`.sql`、Data source 和 `.chart.json` 才是可读、可 diff、可同步的 canonical files；执行结果只是绑定这些 source revision 的运行时证据。Rune 创建的 `WorkspaceQuerySnapshot` 同时记录 Query id/source、canonical Data id/source、结果、截断状态和 cell lineage，只留在组件内存中。任一 SQL 或 Data 字符变化都会使旧 snapshot 失效，consumer 回到 loading 并重新执行；结果不会进入 localStorage、folder manifest、checkpoint 或 Git。这样既避免重复事实，也不用引入数据库、后台 job 或缓存失效服务。

workspace safety gate 又不能在每次键入 Chart JSON 或应用 Agent patch 时都启动 DuckDB。为此 v0.22 增加一个刻意保守的静态 Query output contract：只分析一个顶层 SELECT 的 projection；直接字段沿用字段名，直接读取 `workspace_data` 时可以展开 `*`，计算表达式必须写显式 `AS` alias。重复且大小写不唯一的输出名、隐式派生列名、无法判断 relation 的 star、set query 或超过 256 列都会拒绝成为 Chart source。这里的静态 compiler 只证明“这个名字会存在”，绝不伪造运行值或血缘；不支持的 SQL 仍可在 Query preview 中只读执行，只是不能被下游 Chart 当成稳定 schema。

真正渲染时，preview coordinator 只执行当前 Query、Chart、Document 或 Deck 实际引用到的 Query，并让同一个 Query 的多个 consumer 共享一份 revision-keyed snapshot。Chart resolver 再检查 snapshot 是否对应当前 SQL 与当前 Data，且结果没有超过 500 行边界；missing、running、error、stale 或 truncated 都显示明确状态，不回退到旧图。这个区分也解决了同步 validation 与异步 runtime 的职责：前者阻止一次 patch 破坏下游字段合同，后者证明当前可视图确实来自当前输入。默认 workspace 新增的 margin chart 就直接读取 `regional-analysis.sql` 的 `margin_pct`，同时被报告和第四页 Deck 引用。

血缘能力没有因为中间多了一层 SQL 就被放宽。Query snapshot 中的每个 direct cell 仍携带原始 Data row/column；Chart datum 分别保存 category 和 value provenance。若 `Region` 是直接 projection，点击 Query-backed Chart 的 label 可以跳到 canonical CSV 中准确的 Region token；若 `margin_pct` 来自除法和 rounding，它保持可见但没有写入 target，bar/value 只读。Chart 的排序、格式化和 `maxItems` 不会改变这个判断，重复 label 也不会触发 fuzzy lookup。派生结果帮助用户理解和定位，但不能冒充 canonical fact，这继续遵守 v0.19 的 proof-safe 原则。

导出不能依赖某个 preview 恰好已经打开。准备 DOCX、PPTX 或 standalone HTML 时，Rune 会从目标的 chart references 收集 Query source，使用同一 DuckDB path 对当前 revision 重新执行，拒绝截断，再把这些 snapshot 显式传给 Office/HTML chart compiler。最终包中的表格或 vector bars 是确定性的 frozen handoff，不包含 worker、脚本或 live binding；导出 review 仍绑定完整 workspace reference，编辑后不能下载旧文件。这样线上 preview 和离线交付共享同一计算语义，却不会把 ephemeral execution state 偷渡进 source。

这一轮没有增加 hosted compute、数据库或新的 production service，DuckDB 仍只在需要 Query consumer 时 lazy-load。长期可以把 user-defined metric 也建模为显式 Query output binding，或为多 Data/JOIN 引入 relation-qualified provenance set；但那需要先定义 cardinality、集合导航和多 source revision 合同。现在的窄实现先证明了一件更重要的事：SQL 可以成为 Rune 的可复用视图层，同时保持 canonical files、运行时证据、Agent 权限和导出快照四者边界清楚。

## 27. Explicit Query Data binding：文件顺序不应该决定分析事实

v0.22 完成了 `Data → SQL → Chart → Document/Deck`，却继承了最早 demo 的一个隐藏前提：`workspace_data` 永远由 workspace 中第一份 Data artifact 构建。只有一份 CSV 时这很方便；一旦用户导入第二个 worksheet、Folder Pull 按 manifest 重排，或 Workspace Agent 创建另一张表，同一段没有变化的 SQL 就可能改读另一份数据。preview、Query-backed Chart、导出和 Agent graph 甚至可能一起“自洽地出错”，因为它们都遵守同一个错误的顺序假设。可读文件如果不能说明自己的输入是谁，就还不是真正的 artifact-as-code。

最直接的方案是把每个 Data 都注册成 SQL table name，但 artifact id 可能包含 Unicode、标点和未来的重命名语义，DuckDB identifier quoting 又会和 Rune identity 混在一起；更复杂的 `JOIN` 还需要多 source lineage。v0.23 先选择更窄的 source header：Query 第一条非空行可以写 `-- rune:data "regional-revenue"`，正文继续只读稳定的 `workspace_data`。artifact id 使用 JSON quoted string，因此 Unicode 和转义有确定语法；directive 仍是普通 SQL comment，文件离开 Rune 后可以直接交给 DuckDB。它只声明“装载哪份 Data”，不发明新的查询语言。

parser 对这行采取 fail-closed 合同。directive 必须是第一条非空行、只能出现一次、id 必须是 1–120 个可见字符的 quoted string；未加引号、放在普通注释之后、重复、控制字符、找不到目标或目标不是 Data 都产生明确错误。`validateArtifact` 负责语法，whole-workspace safety gate 负责 identity resolution。Agent instruction 要求保留已有 directive；只有 Workspace scope 能从可见 context 中选择另一个真实 Data id。模型不能因为看到一个相似文件名就发明 binding，任何无效修改仍在 concrete review 应用前被完整 workspace 否决。

同一个 resolver 现在服务所有运行路径。Query preview 为每个需要执行的 Query 单独解析 Data，不再把一份全局 canonical Data 传给全部任务；revision key 同时包含 Query source、resolved Data id/source 和 resolution errors。两个 Query 可以各自读取不同 CSV，并继续通过串行 DuckDB queue 避免 worker race。Query preview 的 row/cell target、Query-backed Chart 的 snapshot current check、category/value provenance、DOCX/PPTX/HTML export 的重执行都使用 snapshot 中那份确切 Data。`runWorkspaceQuerySnapshot` 还会拒绝调用者传入与 directive 不同的 artifact，避免组件接错线后“执行成功”。

dependency graph 也从顺序推断升级成 identity edge。显式 Query 产生 `bound Data → Query`，再通过已有 `Query → Chart → consumer` 形成 upstream closure；Workspace Agent request 在客户端和服务端都会从 source 重编这条边，所以缺失 bound Data 的 context 不能到达 provider。File order 仍用于 UI 和兼容语义，但不会改变新 Query 的事实来源。lineage strip 明确显示 `Explicit Data binding`；旧 SQL 则显示 `Legacy first-Data binding`，用户能区分稳定合同和兼容回退，而不是让两者看起来同样可靠。

兼容不能靠静默重写用户 SQL。已经导入、同步或保存在设备上的 directive-free Query 继续读取第一份 Data，已有 source byte 不变；只有新的默认 Query 和本地 planner 生成的后续版本使用或保留显式 directive。这个回退仍进入 graph、snapshot revision 和完整校验，因此不会比旧版更危险，只是会在 UI 中诚实标注顺序依赖。缺失或错误的显式 target 不会降级到第一份 Data，因为那会把拼写错误变成另一份看似正常的结果。

这一轮没有新增数据库、索引、manifest metadata 或 hosted service，binding 只存在于已经可 diff 的 `.sql`。它也没有假装解决多表 JOIN：当前每个 Query 仍只装载一个 `workspace_data`，从而保留一对一 lineage 的安全边界。下一步可以让 user-defined metric 从显式 Query output 读取一个 scalar，逐步移除 metrics 对第一份 Data 的最后一处硬编码；只有在 relation-qualified provenance set 设计完成后，才应该让一条 Query 同时绑定多份 Data。

## 28. Query scalar metric：让每个 KPI 都能指出自己的 SQL 证据

v0.23 已让 Query 明确绑定 Data，但报告和 Deck 中的数字仍大多来自最早 demo 的一参数 `metric("name")`。这些 legacy metrics 由 workspace 中第一份 Data 直接计算，只有一张表时足够简洁；当用户导入多个 worksheet、重排 manifest 或需要用 SQL 聚合时，它们既无法说明选择了哪份 Data，也无法表达筛选、分组和业务公式。更危险的是，展示出来的 KPI 可能继续“看起来正确”，却没有一条可导航、可审查的计算链。v0.24 的目标因此不是增加更多硬编码 metric 名，而是让数字直接引用一份可读 Query 的一个输出列。

新的 source 形式刻意保持窄而明确：`{{ metric("query-id", "column", "currency|number|percent") }}`。三个参数都必须是 quoted string；Query id 和 output column 使用精确 identity，format 只能从三个展示枚举中选择。这个语法没有嵌入 SQL、公式表达式或任意 formatter，因此正文仍适合阅读和 diff，计算逻辑只存在于 `.sql`，格式只影响呈现。原有一参数 `metric("top_region")` 继续兼容，Rune 不静默改写旧文件，也不把两种语义伪装成同一种 binding。

scalar 必须同时通过静态合同和运行时证据。静态阶段不启动 DuckDB，只解析 Query 的显式 Data source 和保守 output schema；缺失 Query/Data、无显式 alias、重复列名、字段改名或错误 format 会在 workspace mutation review 前否决整笔事务。运行阶段只接受绑定当前 Query source 与当前 resolved Data id/source 的 snapshot，并要求结果未截断、恰好一行、目标列唯一且值是 finite number。零行、多行、字符串、`NaN`、无穷值、旧 revision 或尚未完成的执行都 fail closed，preview 显示 pending/error，而不会沿用旧数字。

preview coordinator 现在收集目标 Document/Deck 中 Chart 和 scalar metric 所需 Query 的并集，同一 Query 的所有 consumer 共享一个 revision-keyed snapshot。Office 和 standalone HTML export 不依赖用户是否打开过 preview，而是在准备交付时重新执行这份并集，再把格式化数字与 Chart 一起冻结。运行结果仍只是一份 ephemeral evidence：不会进入 localStorage、checkpoint、folder manifest、Git 或新的数据库，canonical truth 仍是 Data、SQL 和消费它们的 Markdown/Deck source。

dependency graph 为每组 scalar reference 增加 `Query → consumer` 的 `query-metric` edge，并复用已有的 `bound Data → Query` edge，于是默认报告第一次拥有完整的 `regional-revenue.csv → regional-summary.sql → report/deck` 数字链。Workspace Agent context 会沿这条链纳入确切 Query 和 Data，客户端与服务端都从 canonical source 重编并比对 edge。Selection/File scope 不能新建或改指跨文件 Query metric；只有 Workspace scope 在相关文件确实位于可验证 context 时才能这样做。无论模型计划是否合理，最终 Apply 仍在完整 device workspace 上重跑 schema 和 binding safety，所以被 context cap 省略的 consumer 仍保有否决权。

默认 workspace 新增 `regional-summary.sql`，用一行聚合输出总收入、环比、毛利率、APAC 收入和客户数；报告与 Deck 的数值 KPI 已迁移到这份 Query，`top_region` 则故意保留为 legacy compatibility 示例。完整默认闭包因此多了一个真实上游文件。为了仍允许用户在默认六文件链之外 pin 一份独立材料，Workspace Agent 文件上限从 6 提到 7、pin 上限从 5 提到 6，总字符上限仍保持 180,000；这是一项显式 capability 调整，而不是放宽 provider 可见性的通用理由。

这一轮仍没有引入 hosted compute、多表 JOIN、文本 scalar 或用户自定义脚本 formatter。numeric-only 与 exactly-one-row 是为了先把 cardinality、revision 和失败语义做实；文本标签仍可暂时使用兼容 metric，集合结果应继续用 Chart 或表格。下一步若支持 text scalar，应先定义空值、locale 与 escaping 合同；若支持多 Data Query，则必须先把 relation-qualified revision/provenance set 纳入 snapshot 和 graph。Rune 先保证每个可见数字都能回答“来自哪份 SQL、哪一列、哪一版 Data”，再扩大表达能力。

## 29. Direct PDF：把“可预览”推进到可确定交付

v0.10 的 standalone HTML 已经能让 Deck 离开 Rune，并通过浏览器打印成 PDF，但“先导出 HTML、再打开、再选择打印机和边距”仍不是一条确定的产品交付链。不同浏览器、字体和打印设置会改变分页，Document 甚至没有对应路径。对报告和董事会演示来说，PDF 不是另一个可编辑 source，而是最常见的冻结交付物；如果 Rune 只能把最后一步交给用户手工拼接，三件套闭环就仍缺一环。v0.25 因此让 Markdown Document 和 Deck Markdown 都能直接生成 PDF，并复用现有 fidelity review，而不是增加一个 hosted conversion service。

两种 artifact 需要两个不同且明确的页面合同。Document 使用 A4，编译 headings、paragraphs、quotes、lists、code、bounded tables、header/footer 和 page number，并在空间不足时创建新页。Deck 不尝试重新分页正文，而是严格保持一张 source slide 对应一张 960×540 的 16:9 PDF page，继续使用 cover、metrics、split、content 和 conclusion 的 Rune 视觉语义。Data 没有被勉强塞进分页 PDF：可编辑、可计算的表格交付仍由 values-only XLSX 承担，直到我们能定义一套真正可审查的 print-area、重复表头和宽表分页合同。

PDF 也必须遵守同一份事实证据。准备导出时，workbench 收集目标中 Query scalar 和 Query-backed Chart 所需 Query 的并集，用当前 Query source 与显式 Data source 重新执行并生成 revision-bound snapshot；missing、pending、stale、truncated、multi-row 或 nonnumeric scalar 都 fail closed。Chart resolver 只接受这些确切 snapshot，并把 bar、track、label 和 formatted value 画成本地 vector geometry。最终文件没有 DuckDB worker、live binding 或第二份数据表，但它能说明自己冻结的是哪一次当前 workspace 编译结果。

字体是浏览器 PDF 中不能假装不存在的兼容边界。只使用 PDF 内建字体会让中文报表报错或出现方框，只依赖系统字体又会让接收方结果不确定。Rune 因此随应用分发 OFL 1.1 的 Unifont WOFF2：普通 Latin 文本使用标准 PDF 字体，包含中文或其他非 WinAnsi 字符的 text run 使用内嵌 Unicode font；接收方不需要联网，也不需要安装字体。字体文件先验证 WOFF2 header 并限制为 4 MB，不支持的字符被替换成可见问号并进入 fidelity warning，绝不悄悄输出黑框。这个选择优先保证可读与可携带，未来可以在不改变 export contract 的前提下换成更精细的 CJK typography 或更小的 subset pipeline。

确定性不是一句“本地生成”就自动成立。PDF metadata 的 creation/modification date 被固定，writer 输入只来自 canonical source、明确的 workspace artifacts、snapshot bytes 和版本化字体；相同输入必须生成相同 bytes。最终文件限制为 12 MB，source 限制 200,000 字符。导出结果继续绑定准备时的完整 artifacts object：用户在 review 打开后编辑、Pull、Reset 或替换 workspace，确认下载会被拒绝，必须重新生成。Cancel 不写 source、localStorage、checkpoint 或 folder；Confirm 只创建一次浏览器 object URL。

固定页面也意味着必须诚实描述 fidelity。Markdown link 保留可读 label 但不生成 active annotation，image 变成带 alt text 的可见 marker；Document 宽表最多展示八列，Deck 宽表最多六列、八行；超长 cell、slide text 或超出 frame 的 block 会显式截断或省略并记录 warning。Deck animation、speaker notes、editable shapes，Document comments、track changes，以及所有 live runtime 都不属于这份 PDF。这里不做“像 Office 一样什么都支持”的承诺，而是让每一项损失在下载前可见，让 fixed handoff 和 editable Office export 各自承担清楚的用途。

安全边界同样保持窄。PDF adapter 只接受经过现有 validation 的 Markdown Document 或 Deck Markdown；不会解释 raw HTML、远程图片、附件、表单或脚本，也不会产生外部资源引用、JavaScript、encryption 或 AcroForm。Release QA 不只让 pdf-lib 读取自己的输出，而是用独立 parser 检查 page count/geometry/security flags，再由 Poppler 把每一页 rasterize，逐页检查 overlap、clipping、乱码和黑框。默认报告验证 A4 分页与两张 current-data chart，默认 Deck 验证四张固定 16:9 slide。这样 PDF 成为一条可测试的兼容 port，而不是浏览器打印菜单的别名。

这一轮仍没有新增数据库、队列、对象存储、账号或后台 renderer；字体是随静态应用发布的版本化 asset，PDF bytes 只存在于准备导出后的内存和用户确认的本地下载。未来若加入 image embedding、active links、accessible tagging、page templates 或 desktop-native font discovery，仍应沿用当前三条约束：canonical source 不变、current evidence 可证明、任何 fidelity loss 在 handoff 前可见。先把确定交付做实，再扩大视觉兼容面。

## 30. Runtime-verified Agent：模型既要看见结果，也必须证明提议能运行

v0.25 让 Query 的结果进入 preview 和导出，却没有真正进入 Workspace Agent 的推理回路。模型能看到 Data、SQL、Chart 和消费它们的 Markdown/Deck source，也能看到旧的 compiled metric 字符串，但看不到 DuckDB 对当前 Query/Data revision 实际返回的行、列或错误。它可能正确理解 SQL 文本，也可能错过运行时 cardinality、类型、空值和引擎 binder error；更糟的是，模型改写 SQL 后，Rune 只做 read-only 与静态 output schema 校验，仍可能把一条运行即失败的 Query 放进 diff review。用户看到“可审阅”不等于系统已经证明“可执行”。AI Native 的 Generate → Render → Inspect → Fix 闭环因此缺少最关键的 Inspect 端口。

审查还发现一处由 capability 演进造成的真实回归：v0.24 把默认 workspace 扩展为七份闭合文件，并把共享常量 `MAX_WORKSPACE_AGENT_ARTIFACTS` 提到 7；workbench 的 provider eligibility 却仍保留旧的 `length <= 6` literal。结果是最完整、最有价值的默认 `Data → two Queries → two Charts → Document/Deck` context 永远不会到达已配置模型，只会静默落到 local planner。v0.26 删除这处平行常量，客户端和请求 schema 统一使用七文件合同，并用 fixture 明确证明默认七文件可以、八文件不可以。容量边界必须只有一个来源，否则“安全限制”会在版本演进中变成隐蔽功能开关。

让模型看到 Query 结果不能简单地在每次点击 Agent 时先启动 DuckDB。Hosted Sites 当前故意没有 provider key，本地 deterministic fallback 也不需要运行结果；若客户端先算再请求，就会为最终 503 的路径下载 Wasm、启动 worker、处理 Data，还模糊了“何时把运行证据交给外部 provider”的授权时刻。v0.26 因此采用两步握手：第一份 Workspace request 仍只包含 graph-verified canonical sources、edges、pins 与兼容 metrics；服务端完成 graph 校验后先检查 provider configuration。没有 key 就立即返回 `MODEL_UNCONFIGURED`。只有 provider 确实可用且 context 中存在 Query，服务端才在调用模型前返回 428 `QUERY_EVIDENCE_REQUIRED` 和按 workspace 顺序排列的 Query ids。浏览器随后本地执行并只重试一次。这样 no-key 路径没有额外 SQL 成本，configured 路径又不会在缺少 inspection evidence 时误调模型。

证据边界刻意比 Query preview 更窄。每个 Query 必须恰好对应一条 record，并携带 Query id 与 resolved Data id；成功结果最多 20 行、32 列、400 个 cell、每个 string cell 500 字符，整包 JSON 最多 20,000 字符，同时说明当前可见结果总行数、总列数、Query 自身是否超过 500 行以及 evidence 是否再次截断。执行失败不会被包装成空表，而是成为最多 500 字符的 error evidence，让模型知道应修 SQL。服务端再次检查 schema、顺序、唯一性和 Query/Data identity；missing、extra、reordered 或 fabricated identity 都不能调用 provider。Workspace scope 之外完全不接受 evidence，因为 File/Selection 并没有获得跨文件 Data capability。

这里必须诚实区分“revision-bound”与“attested”。证据由请求浏览器根据同一份 Query/Data source 计算，服务端可以验证 identity 和边界，却无法在没有 hosted DuckDB 的前提下密码学证明这些 cell 真由 SQL 产生；而客户端本来就是用户控制的输入端。因此 evidence 是给模型的 advisory observation，不是授权、事实数据库或写入依据。模型 instruction 明确要求：截断或 error 不能被当成完整结果，不要把 snapshot 数值粘进正文替代 live metric/Chart binding，不要编辑 evidence 本身，只能提出 canonical source operation。Data、SQL、binding source 和 Rune deterministic compiler 仍是 authority；evidence 不进入 localStorage、checkpoint、folder manifest、Git 或任何新数据库。

第二条边界发生在模型或 local planner 已经提出具体 source 之后。只要 plan 改动一份 Query，不论它来自 Selection、File 还是 Workspace scope，Rune 先用已有 `prepareWorkspaceMutation` 在内存构造完整 proposed workspace，确保静态 adapter、identity、binding 与 dependency 合同都通过；然后根据 proposed Query directive 解析 exact proposed Data，调用 browser-local DuckDB 生成新的 `WorkspaceQuerySnapshot`。任意 binder、parser 或 execution error 都直接终止，不创建 `pendingChange`，因此用户不会被要求审阅一个系统自己已经知道跑不起来的 diff。

“SQL 能跑”仍不是完整成功。一条聚合 Query 改成按 Region 分组后会返回合法多行，但引用它的 `metric("query-id", "column", ...)` 需要 exactly one row；一条计算列变成字符串也可能继续被 DuckDB 接受，却无法成为 numeric Chart value。preflight 因此继续扫描完整 proposed workspace：对 changed Query 的每个 scalar consumer，用同一组 current proposed snapshot 运行 `compileArtifactSource` 并检查 runtime error；对每个直接以 changed Query 为 source 的 Chart，运行真实 `resolveChartModel` 并检查 truncation、column、row label 与 finite numeric value。与 changed Query 无关、尚未运行的其他 Query 只保持 pending，不能错误阻止这次提议。通过后 review 显示执行过的 Query 名、scalar consumer 数和 Chart 数；失败时 source、checkpoint、device storage、folder 和 React workspace state 全部不变。

这次实现没有声称已经完成自动 self-repair。模型收到的是“修改前”的 current evidence；如果它提出的 SQL preflight 失败，Rune 会给用户具体错误并拒绝进入 review，但不会在后台把错误和 proposed source 再发给模型进行第二轮无界循环。视觉输出也还没有截图或 layout critic。v0.26 做的是更基础、也更可验证的一步：把当前结果作为受限 inspection port，把 proposed SQL 的真实 runtime 和 downstream compiler 作为 review 前的硬 gate。后续若增加一次或多次自动修复，必须复用同一 revision、预算、次数、privacy 与 review 合同，而不是绕开它。

成本边界保持不变：没有 hosted compute、数据库、队列、结果缓存服务或新的 production secret；DuckDB 仍按需 dynamic import，并用既有串行 queue 避免 worker race。默认无 key 的 owner-only Sites 部署继续秒级进入 local fallback。新增复杂度集中在两个可单测模块：`agent-evidence` 负责 bounded observation 与 context identity，`query-preflight` 负责 proposed workspace runtime/downstream proof。Rune 由此第一次让 Agent 不只“读 artifact source”，还要在 diff 出现前面对 artifact compiler 的实际反馈；这是从聊天式生成器走向可验证创作系统的一小步，但也是后续自动 inspect/fix loop 必须站稳的地基。

## 31. Runtime impact graph：Data 改动也必须证明整个下游仍然成立

v0.26 解决了“模型改 SQL，但 SQL 其实跑不起来”的直接问题，却把 runtime gate 触发条件绑定在 Query source 是否变化。对三件套来说，这仍然不是完整的数据闭环：Agent 只把 CSV 中一个数值改成文本、增加一列、调整行顺序或创建另一份 Data 时，SQL source 可以一个字节都不变，DuckDB 的类型推断、aggregate cardinality、scalar metric 和 Chart value 却可能全部改变。原有 whole-workspace validation 能证明列名和引用 identity 仍存在，但不执行 SQL，无法证明当前数据值真的满足运行语义。一个 Data diff 若能进入 review、Apply 后才让报告和 Deck 显示错误，用户仍然承担了本该由编译器先发现的影响。

v0.27 因此把 `Query mutation preflight` 提升为 `runtime impact preflight`。根节点不再只有 changed Query，也包括每一份 proposed Data。Rune 先用普通 `prepareWorkspaceMutation` 构造完整 proposed workspace，验证 CSV/JSON parser、artifact identity、read-only SQL、metric syntax、Chart schema 和所有静态 dependency；只有这一步成功才计算运行集合。这样直接 Data Chart 已经因为 nonnumeric value 失效时，会在下载 DuckDB 之前被完整 workspace gate 拒绝，不用启动 worker 来重复证明一个更早就知道的失败。

运行集合必须来自 source identity，而不能粗暴执行目录里所有 `.sql`。每一份 directly changed Query 一定进入集合；除此之外，Rune 对 proposed workspace 中每个 Query 重新运行 `resolveQueryDataArtifact`，只有 resolved Data id 属于 changed Data 集合时才加入。显式 `-- rune:data "artifact-id"` 因此保持顺序无关；旧的 directive-free Query 继续按 proposed workspace 的第一份 Data 兼容解析。新建但尚未被任何 Query/Chart/legacy metric 引用的 Data 只需要完成 parser 和 whole-workspace validation，不会借“安全检查”扩大本地 SQL 执行范围。

每个 impacted Query 都必须用 proposed Query source 和 proposed resolved Data source 生成 snapshot，随后再用 `workspaceQuerySnapshotIsCurrent` 做双 revision proof。runner 报错、返回旧 Query source、接错 Data 或执行期间 revision 漂移都会让整条 impact graph 失败。Query 本身超过 preview 的 500 行仍可以作为独立只读结果存在；但只要下游 scalar 或 Chart 需要完整集合，既有 consumer compiler 会按自己的更强合同拒绝 truncation，而不是让 preflight 另造一套不一致规则。

下游验证现在覆盖四类消费者。若 changed Data 是 proposed workspace 的 canonical first Data，Rune 会重新编译每个一参数 legacy metric consumer，并记录精确 artifact/metric 数；所有引用 impacted Query 的三参数 scalar 都用同一 snapshot 验证 exactly-one-row、unique column 与 finite number；以 changed Data 为 source 的直接 Chart 用 proposed rows 验证 category/value；以 impacted Query 为 source 的 Chart 则验证 snapshot current、truncation、schema、label 和 numeric value。Document/Deck 中的 chart embed 继续通过其 Chart artifact 间接受保护，不需要为同一 visual 重复运行 SQL。

审阅界面不再只说“某条 SQL 运行成功”。`Runtime impact preflight passed` 会显示 proposed Data 数、实际执行的 impacted Query 数、legacy metric、SQL scalar 和 Chart consumer 数，以及涉及的 Data/Query 文件名。默认 `regional-revenue.csv` 的本地“增加利润率列”动作在无 provider key 的 Sites 上也会触发完整闭环：一份 Data change → 两份 Query execution → 七个 SQL scalar binding → 两张 direct/Query Chart → report/deck 依赖继续成立，之后 diff 才出现。失败则没有 `pendingChange`，也不会创建 checkpoint、写 localStorage、写 folder 或替换 React state。

这里仍然区分 Agent proposal 和人的直接编辑。人在 source textarea 输入时需要即时、可恢复的 compiler feedback，不能每个 keystroke 都启动两次 DuckDB；preview coordinator 会像以前一样按 revision 显示 loading/error。Agent 是离散、可审阅的事务，因此有条件在 review 前支付一次完整 impact cost。未来若增加批量粘贴 review、spreadsheet formula editor 或自动修复循环，可以复用这条 proposed-workspace port，而不是把昂贵运行时塞进所有编辑事件。

v0.27 没有引入多 Data JOIN、hosted compute、结果缓存或新的持久 graph。impact set 每次都从 proposed canonical source 解析，snapshot 仍只活在一次预检 promise 中；没有 Data/Query 变化的文档、Deck 和 Chart-only Agent plan完全不加载 DuckDB。这个里程碑把“Excel 那一层的数据变化会影响 Word/PPT”从 UI 上的 live preview 提升成 Agent transaction 的可证明不变量：AI 不仅要改三种 source，还必须在用户看到 diff 前证明这些 source 编译成的是同一个仍可运行的事实世界。

## 32. Hydration 也是编译合同：显示文本不能由运行环境决定

v0.27 的真实浏览器运行暴露了一个单元测试很容易漏掉、但对 source-first 编辑器非常关键的问题：同一份 `970000`，Cloudflare/服务端的 compact `Intl.NumberFormat` 输出 `$970K`，本地浏览器却输出 `$970.00K`。两边都符合各自的 ICU 实现，数据、Chart schema 和 React 组件也都没有错，但 SSR HTML 与客户端首次 render 的文本不同，React 只能抛出 hydration mismatch 并重建整棵预览树。对普通营销页这也许只是闪烁；对 Rune 来说，重建会让 source target、选择范围和运行证据的首屏身份失去可信的共同基线。

问题的本质不是“指定 `en-US` 就够了”。locale 固定了语言规则，却没有固定不同 JS/ICU 版本对 compact notation、significant digits、minimum fraction digits 和 trailing zeros 的组合解释。只要服务端、浏览器、sandboxed HTML 和导出器各自调用环境 formatter，所谓 deterministic compiler 就仍留着一个不可审查的 ambient input。把服务端结果塞进 hydration snapshot 只能掩盖首屏，Deck HTML、DOCX/PPTX/PDF 和后续客户端重编仍可能产生不同文案。

v0.27.1 因此增加一个很小但明确的 Rune-owned display compiler。普通数字由十进制 `toFixed` 后去尾零并按三位分组；compact 值显式选择 K/M/B/T、最多两位小数，并在四舍五入跨过 1000 时提升单位；货币符号与负号位置固定；百分比固定保留一位。它不读取 `navigator.language`、服务器 locale、时区或 ICU 数据。`$970K`、`$1.84M`、`-$1.2K`、`10K` 和 `30.0%` 因而是源值与版本化 formatter 的纯函数，而不是部署环境的意见。

这条 formatter 同时服务 legacy metric、Query scalar、Data/Query Chart、React preview、Deck static HTML、Office/PDF snapshot、文件大小和字符计数。最后两项看似无关，却同样可能出现在 SSR 首屏；去掉无参数 `toLocaleString()` 是为了不留下下一处同类 hydration 断点。格式字符串仍然只是 projection，不进入 CSV、JSON、SQL 或 Markdown canonical source，也不参与 provenance 和数值比较。

回归不能只断言“Node 输出了什么”。新增 fixture 明确规定边界值、负数、单位提升、尾零和非有限值；默认 golden workspace 同时断言服务端 HTML 包含 `$970K` 且不含 `$970.00K`。客户端 bundle 与服务端都导入同一份无 `Intl.NumberFormat` 的实现，因此跨运行时一致性来自代码共享与算法确定性，而不是测试机恰好和生产浏览器使用同一 ICU。

未来若需要人民币、欧元、中文万/亿、会计负数或用户 locale，应该把 format/locale 变成 Chart 或 workspace 中可读、可 diff、可迁移的显式 source contract，再由 Rune compiler 实现和版本化；不能重新退回 ambient browser locale。AI Native 编辑器要求模型、预览和交付看到同一份事实，而“这个事实最后显示成什么文字”也是编译结果的一部分。

## 33. 一次有界自修复：让编译器反馈回到模型，但不把 Rune 变成失控 Agent

v0.26 和 v0.27 已经完成 Generate → Render/Execute → Inspect 的硬边界：模型可以看见当前 Query evidence，Data/SQL 提议则必须跑过 proposed workspace 的完整 runtime impact graph。但闭环在失败处仍然中断。模型第一次把列名写错、误判 aggregate cardinality，或让 Chart 的 value 变成字符串时，Rune 明明已经拥有非常具体的 binder、scalar 或 Chart compiler error，却只把它展示给用户。用户必须复制错误、重新描述目标、再次等待模型规划；这不是 AI Native，而是把一个本可机器消费的诊断端口重新变成人工聊天中转站。

最直接的反应是“让 Agent 一直改到通过”，但这会破坏 Rune 当前最重要的成本与信任模型。无界循环无法预估 token、延迟和本地 DuckDB 执行次数；后续尝试可能越来越偏离原始 source；错误字符串和失败 proposal 也可能被当成新指令，形成间接 prompt injection。更重要的是，只要系统在后台连续替用户改写，就很容易把“编译通过”偷换成“意图正确”，最后让 review 退化成对一长串不可复现历史的追认。Rune 需要的是一次明确的 compiler-guided retry，而不是 autonomous coding agent。

v0.28 因此把自动预算固定为字面量 `attempt: 1`。触发条件也很窄：只有已配置 provider 返回了合法、经服务端编译的具体 Data/Query proposal，而浏览器对完整 device workspace 的 runtime impact preflight 失败时才触发。文档-only、Deck-only、Chart-only 计划没有运行失败就不会触发；确定性 local planner 失败也直接停止，不会为了“更聪明”突然扩大到外部模型。第一次 proposal 始终保持 unapplied，不创建 pending review、checkpoint、localStorage 写入、folder 写入或 React workspace mutation。

修复反馈不是完整对话 transcript。它只包含本轮第一次 proposal 中 1–4 份 Rune 已编译的候选 source、Rune-owned 文件身份与一条清洗后最多 1,000 字符的失败信息。每份 source 最多 100,000 字符，Workspace 总计仍不超过 180,000；已有文件必须精确匹配当前 context 的 id/name/kind/language，新建文件必须使用 Rune 已生成且不碰撞的 Office-core identity；id 与 name 都不能重复，并且至少包含一份 Data 或 Query。Selection scope 还要证明第一次 proposal 的 prefix/suffix 没越界。这样 repair 不能借错误通道偷偷塞入更多文件、另一份 revision 或第二种写能力。

同一份反馈同时具有 prompt-injection 风险，所以 provider instruction 明确把 `failure` 和 `proposedSource` 定义为 untrusted advisory data。模型必须拿它们和仍然存在的 canonical current source 对比，返回一份完整 replacement typed-operation plan；不能“编辑错误对象”、不能假设第一次 proposal 已经 Apply，也不能声称 replacement 已通过 compiler。原始 prompt、scope、selection、workspace graph、pins、metrics 和已经通过身份验证的 Query evidence 原样保留。模型由此得到足够的局部反例，却没有获得比第一次请求更大的 source capability。

修复响应不是客户端可以凭形状猜测的普通成功。服务端仍从原始 canonical revision 编译 typed operations，重新执行 artifact/workspace safety gate，并只对修复请求回传 `repairAttempt: 1`。浏览器要求 marker 与 plan 同时成立，再对 replacement 从头运行同一条完整 impact graph：构造 proposed workspace、解析 changed Data、执行全部 identity-bound impacted Query、验证 legacy metric、Query scalar、direct Data Chart 与 Query Chart。只有第二轮全部成立才生成 diff，审阅卡明确显示 `Recovered after one compiler-guided repair`，保留第一次 bounded failure，并说明第一次 proposal 从未应用。

任何中间问题都 fail closed：反馈无法在预算内构造、provider 网络失败、API 返回错误、marker 缺失、replacement shape 不合法、服务端 operation compiler 拒绝，或第二次 runtime preflight 再失败，都会显示“一次自动修复已停止”，没有 pending change，也不会静默切换成 local planner。这里拒绝 fallback 很重要：一旦用户的 configured model 已经生成具体计划并收到 compiler feedback，再用另一套 deterministic heuristic 伪装成同一条修复结果，会丢失 provenance，也让错误看起来被处理了。用户可以修改 prompt 后主动发起下一次独立动作，但 Rune 不会把它算作当前动作的第二次后台 retry。

这一设计把一次动作的最坏外部成本从一次 provider call 提高到最多两次，把 runtime gate 从最多一次提高到最多两次，但仍是可解释的常数。Workspace Query evidence 的 428 握手不会重复计算：repair request 复用同一份 exact current evidence 和同一 canonical revision；第二轮只重新执行 replacement 的 proposed impact。没有 provider key 的 owner-only Sites 路径继续不为模型 evidence 启动 DuckDB，非 runtime source 的计划继续不加载 preflight chunk，`agent-evidence` 与 `query-preflight` 也保持 dynamic import，避免为了少数失败拖慢首屏。

v0.28 仍不声称可以自动评价叙事质量、版式美感或事实正确性。Compiler 能证明 SQL 可执行、binding 有效、数值类型与 cardinality 合同成立，却不能证明“这份董事会结论是否合理”。一次 self-repair 只消除系统已经有确定反例的 proposal，不替代人的 review。未来若加入 screenshot critic、semantic eval、预算可配置的多轮 Agent 或跨设备后台任务，应当显式增加新的 evidence 类型、次数预算、取消能力与审计日志；不能把当前字面量一次重试悄悄改成循环。AI Native 的关键不是让 AI 永不停下，而是让每一次自动前进都有清晰证据、有限成本和不变的用户确认边界。

## 34. 列是 AI 表格的一等操作：用可验证键替代整份 CSV 重写

Rune 已经能让 Agent 通过 `upsert_data_row` 修改或插入一条 CSV/扁平 JSON 记录，但很多真实 Excel 意图天然是按列表达的：“给每个地区增加毛利率”“把状态列中的两项更新为 approved”“把 Revenue 改名为 Net revenue”。此前模型只能对这类任务使用 `replace_text`，要么复制整段 header/多行 source，要么发出多个逐行操作。前者把一个结构化意图退化成脆弱的大字符串匹配，后者浪费 operation/token 预算，也更容易漏行、重复 key 或在中间步骤产生暂时不合法的表。

v0.29 把 Data 列提升为 provider contract 中的一等语义对象，但没有引入隐藏 spreadsheet model。`upsert_data_column` 仍只引用 canonical source 中一个现有 `keyColumn`、一个目标 `column` 和最多 200 对 `{ keyValue, value }`。key 必须在当前 CSV/JSON 中全局唯一且非空，类型也必须精确匹配；Rune 不按可见行号、排序位置或字符串化值猜测记录。模型看到和返回的仍是普通 JSON operation，compiler 才负责把它投影为完整可审阅 source。

“新增列”和“更新列”故意采用不同完整性约束。目标列不存在时，每一条当前记录必须恰好收到一个值；少一行就拒绝，而不是把遗漏静默写成空值。这样“增加利润率”不会因模型漏掉 LATAM 而制造一个看似成功的半成品。空 CSV 模板是唯一自然例外：它可以用空 values 新增一个 header，因为当前确实没有任何 row 需要覆盖。目标列已经存在时，operation 可以只携带需要改变的 keyed subset，但空 update、全部 no-op、重复 key 或不存在的 key 都失败；列操作永远不能插入记录，也不能修改用于定位记录的 key column。

`rename_data_column` 则解决 schema evolution 的最小原语。它只接受一个精确存在的旧列名和一个非空、单行、去除首尾空白且不与现有列碰撞的新名称。CSV 保留列顺序和原有换行风格；扁平 JSON 在每个 object 中就地替换 property name，保留 array 与 single-object shape、属性顺序和 scalar 类型。嵌套 JSON 继续失败关闭，因为任意深度 property rename 会立即引入 JSONPath、父节点 identity 和数组展开语义，超出当前可证明边界。

列名能安全改写 source，并不代表它能安全改写 workspace。Data 是 SQL、legacy metric 和 Chart 的上游：只把 `Q2 Revenue` 改成 `Q2 Net Revenue` 会让 Query binder 和 direct Chart schema 同时失效。v0.29 没有在 column compiler 中偷偷级联字符串替换；它先生成一份 honest proposal，再复用 v0.27 的完整 runtime impact graph。Workspace Agent 若同时协调 SQL/Chart 可以让整笔事务通过；File Agent 若只改 Data，则下游 compiler 会在 DuckDB 启动前或执行时拒绝，并可进入 v0.28 的一次有界修复。依赖关系仍由 source 明示，而不是由一个“智能重命名”黑箱改写。

Selection scope 也不获得例外权限。CSV header rename 如果 serializer 能证明 header 外的 bytes 完全不变，就可以落在一个精确 header selection 内；更新整列值必须把每个受影响 row 包含在 selection 中。JSON pretty-print 或 property rename 通常会重写更大范围，原有 prefix/suffix proof 会自然拒绝过窄 selection。换言之，semantic operation 描述“想改什么”，Selection revision proof 仍决定“这次是否被授权改这些 bytes”，二者不能互相替代。

这一能力还让新建 Data 的模型路径更 source-native。Rune 的空表模板仍是 `Item,Value`；模型可以先精确 rename 两个 starter columns，再按 row 或 column operation 填入数据，而不必用一段完整 CSV replacement 夺回文件作者权。所有结果继续经过同一个 `parseDataSource`、flat JSON gate、120,000 字符输出上限、concrete diff、revision check、checkpoint 和 atomic persistence transaction。没有新增 npm dependency、数据库、后台 worker 或服务器状态，复杂度集中在已有 `agent-operations` compiler 和 Structured Output schema。

v0.29 仍不是 Excel formula engine。列值由模型作为有界、显式 scalar 提议，Rune 可以证明它们与每个当前 key 一一对应、类型可序列化、下游仍可运行，却不能证明 `0.34` 真的是 source 中 Revenue 与 Cost 的正确商。当前 instruction 要求 derived value 只能来自可见 source；真正可重算的公式应继续写进 DuckDB SQL，并通过 Query/Chart/metric binding消费。未来若需要公式列，可以定义可读的 Data transform artifact 或受限 expression AST，让公式成为 canonical source，而不是把 Excel 式隐藏公式塞回 CSV cell。先把列级结构操作做成可验证原语，才能在不牺牲 source-first 原则的前提下逐步接近 AI Native spreadsheet。

## 35. 折线图不是另一个组件：它必须共享同一条 source、血缘和交付链

到 v0.29 为止，Rune 的 Chart artifact 已经证明一份可读 `.chart.json` 能跨越 Data、SQL、Markdown、Deck、Office 和 PDF，但视觉语法仍只有 `bar`。柱状图适合地区、产品或渠道之间的离散比较，却无法诚实表达月份、版本或实验轮次的有序变化。如果 AI 为“展示最近六个月趋势”生成一串柱子，文件虽然合法，意图却被降格；如果允许模型直接写 SVG/HTML，又会重新打开任意代码、不可审查布局和多运行时不一致的问题。v0.30 因此不是在 React 页面里临时加一条 polyline，而是把 `line` 纳入原有严格 Chart compiler 的完整边界。

source 合同只扩大一个枚举：`mark` 从字面量 `bar` 变成 `bar | line`，其余 source identity、category/value column、sort、format、color 和 1–20 mark 上限全部不变。折线顺序明确来自 Chart 的 post-sort rows：`sort: source` 保留 canonical Data 或 Query result 的顺序，ascending/descending 则是作者显式选择的 value order。Rune 不尝试把 `Jan`、`2026-Q2` 或任意字符串偷偷解析成日期，也不按标签相似度重排；Agent instruction 要求只有在 source 顺序或显式 sort 具有序列意义时才使用 line。这样顺序仍是 source 中可读、可 diff 的决定，而不是 renderer 的猜测。

折线几何也需要确定的失败与退化语义。compiler 继续先拒绝空 category、非数值或非 finite value，再对 maxItems 截断后的可见序列计算 minimum/maximum。每个 point 的横坐标按序列均匀分布，纵坐标按 `(value - min) / (max - min)` 归一化；负数、零和正数可以出现在同一范围内。全部值相等时所有点稳定放在中线，单点放在水平与垂直中心，而不是除以零、制造虚假的斜率或依赖 SVG 的异常行为。bar 继续使用绝对值相对最大值的旧 ratio，两个 mark 共享数据与格式化模型，但不偷换彼此的几何语义。

血缘能力没有因为 SVG 出现而改变。每个 line datum 和 bar datum 一样，在 sort 与 truncation 之前记录 canonical source row，并分别携带 category/value cell provenance。React 折线只把 compiler 给出的 normalized position 投影成只读 SVG path；覆盖在 point 上的原生 button 仍解析到确切 value token，下面的 label button 解析到确切 category token。Query 派生值没有 cell lineage 时 point 仍可见但只读。DOM/SVG 坐标、可见 label、格式化数字和 point index 都不是写权限，点击后仍进入同一个 Selection revision、server/client confinement、review、checkpoint 和 atomic Apply 边界。

Deck 与 standalone HTML 复用同一组 point geometry，生成 inline、scriptless SVG。title、description、label 和 value 继续 escape；颜色只能来自六位 hex schema；最终 standalone boundary 仍拒绝 script、iframe、外链资源以及 `src`/`href`。这使折线可以在 sandboxed slide、下载的单文件 HTML 和浏览器打印中保持相同形状，却不会加入事件桥、第三方 chart runtime 或网络字体。SSR 的 React 视图与静态 SVG 都读取 Rune-owned deterministic number strings，所以此前修复的 hydration 合同不会因新 mark 回退到 ambient locale。

Office 需要按目标格式承认自己的语义边界。DOCX 不适合用大量 drawing shape 模拟一个难以编辑的图，因此 line snapshot 变成可选择的 semantic trend table：每行保留 category、精确 formatted value，并相对前一行写出 Start、Increase、Decrease 或 No change；fidelity review 明确它是当前数据的静态趋势表。PPTX 则真正生成 native DrawingML line segments、point circles、category labels 和 values，所有 shape 仍经过 16:9 canvas bounds 验证，接收者可以在 PowerPoint 中继续移动或改色。bar 的 semantic table 与 track/rectangle path 保持原样，两种 mark 不互相伪装。

PDF 同样使用本地 vector line 和 circles，不截图、不启动 headless browser。Document 的 A4 chart box 与 Deck 的固定 16:9 frame 都从同一 normalized points 生成；密集序列最多显示一组有界标签，但全部 1–20 个 point 仍进入 vector path。相同 source、Data/Query snapshot 和 bundled font 继续产生逐字节相同的文件，Query-backed line chart 也必须先重跑并绑定 exact Query/Data revisions。预览是否曾经打开，不影响 frozen handoff 的正确性。

v0.30 仍故意只有单 series、单 category、单 numeric value、单 color，没有连续时间轴、双 Y 轴、堆叠、面积、散点、missing-value interpolation 或图例布局。多 series 不是简单增加一个数组：它需要定义列组 identity、颜色序列、point-level provenance、空值连接策略、Office legend 和窄屏可读性。scatter 还需要独立 numeric X contract，而不能把 category position 冒充连续尺度。Rune 先证明第二种 mark 能在不分叉 source、运行时、Agent 权限和六种交付面之间语义的情况下落地，再用真实需求决定下一种图表；这比引入一个功能很多但边界不可控的通用 chart library 更符合 AI Native 编辑器的长期成本结构。

## 36. 创建也是依赖编译：补齐 Data → SQL → Chart → Report/Deck 的入口

v0.30 已经能编辑、执行、追踪和导出完整的 `Data → SQL → Chart → Document/Deck` 链，却有一个会直接阻断新用户的产品矛盾：默认 workspace 里有 Query 和 Chart，所以能力看起来完整；但 **New** 和 Workspace Agent 实际只能创建 Document、Data、Presentation。用户从一张刚导入的 CSV 开始时，必须先在 Rune 外部手写 `.sql` 或 `.chart.json` 再导入，AI 也只能修改已有分析文件。这不是少两个按钮，而是把最重要的 source-first 分析入口留成了 demo fixture。v0.31 因而把“创建”从三种空白模板提升为五类 artifact 的依赖编译器。

Query 创建不接受一个含糊的“使用当前数据”开关。用户必须从当前 workspace 选择一份精确 Data artifact，Rune 随即生成 collision-safe `.sql` identity、第一行 JSON-quoted `-- rune:data "artifact-id"` 和最小的 `SELECT * FROM workspace_data;`。文件顺序改变不会改读另一份表，Unicode source id 也有确定转义。Chart 创建同样要求一份精确 Data 或 Query、一个 category、一个 value、`bar | line` 与 `number | currency | percent`；Rune 再生成完整 strict `.chart.json`。Data source 的全部字段和能够从当前行证明为 numeric 的字段会在 UI 中显示，Query source 则只暴露保守静态 output compiler 能证明的列。默认值可以帮助开始，但最终 source id 与列名始终由用户可见、由 schema 精确保存，而不是由 UI 猜测后隐藏。

这五类创建继续共用一个 identity/template factory。Document、Data 和 Deck 保留既有最小 source；Query 与 Chart 的输入被建模为 discriminated creation contract，缺失 source、错误 kind、invented id、unknown/ambiguous field、非法 mark/format 都在 artifact 出现前失败。factory 生成的 source 仍要经过完整 `validateWorkspaceArtifacts`，所以一个静态字段存在但 direct Data value 非数值的 Chart 不能被创建成“稍后再说”的坏文件。对 Query-backed Chart，静态阶段只证明 schema；真正的值仍属于 runtime evidence，不能被解析器伪造。

人类创建 Chart 时可以选择暂不消费它，也可以在同一个确认动作里选择一份 Markdown Document 或 Deck Markdown。后一种路径不是把图表画面复制进正文：Rune 先创建可复用 `.chart.json`，再向目标 source 追加一个普通 `{{ chart("id") }}`。Document 得到一个可读二级标题，Deck 得到一个受限 `layout: split` slide；两者随后与 Chart creation 一起进入同一个 full-workspace mutation。目标已有相同绑定、目标不是 canonical Markdown/Deck、Chart 无效或任何 downstream compiler 报错时，整个操作都不写入。成功前先为被修改的 consumer 建立 manual checkpoint，然后只调用一次 device persistence；连接文件夹仍需用户显式 Push。这样“创建并嵌入”是一个可撤销的 source transaction，而不是两个可能中途失败的 UI side effect。

Chart reference grammar 同时从 ASCII-only id 扩展为 Unicode letter/number 加 `._-`，并由一个 formatter 生成 JSON-quoted binding。此前中文标题可以产生中文 artifact id，却无法被旧正则识别为 chart reference；这会让看似成功的创建在嵌入后变成 unresolved text。v0.31 用同一条 id grammar 服务 formatter、parser、dependency graph 和 compiler，并保留对现有 ASCII binding 的完全兼容。控制字符、空白和任意括号/引号仍不能进入 id，因此扩大语言支持没有扩大模板注入面。

Workspace Agent 的 Structured Output 也不再只有一个宽泛 `kind` 枚举。Document/Data/Deck creation 只携带 title；Query 必须额外携带一个可见 Data id；Chart 必须携带可见 Data/Query id 与精确字段、mark、format。Rune 仍独占 id、filename、extension、language 和完整 initial source。若 typed template 已经满足“新建一份读取这张表的 Query”或“按这两个字段画柱状图”，creation 可以有 0 个 edit；模型不需要制造一次无意义 replace 来证明自己参与过。若需要改 SQL projection、Chart description 或颜色，0–8 个 typed edits 仍在 Rune-owned template 上顺序编译。模型不能引用同一计划中刚创建的文件，因为碰撞后的真实 id 尚未暴露；新的依赖链必须跨一次已审阅创建再继续，这比允许模型猜 slug 更诚实。

运行时安全门也随创建能力扩大。此前 preflight 只由 changed Data/Query 触发，因此单独新建或修改一个 Query-backed Chart 可能通过静态 schema，却在 Review 后才发现选择的列实际包含字符串。现在 changed/new Chart 本身也是 impact root：direct Data Chart 直接用 proposed workspace 的 canonical rows 验证，不启动 DuckDB；Query-backed Chart 将其精确 Query 加入 execution set，取得绑定当前 Query/Data revisions 的 snapshot，再验证所有受影响 Chart consumer。失败的 Chart creation 可以进入既有的一次 bounded repair feedback，但仍必须用完整 replacement plan 重新通过 server compiler 和第二次本地 preflight。没有 preview、pending review、checkpoint 或 device write 能绕过这条证据边界。

无密钥路径也使用同一合同。本地 Workspace Agent 能从显式 context pack 选择 Data 创建 Query，或选择 Data/Query 的静态字段创建 Chart；收入、比例和趋势等窄关键词只决定可见的 format/mark starter，不扩大 context，也不读隐藏结果。创建 identity 仍对完整 workspace 做碰撞解析，最终 transaction 仍让完整 workspace 的 downstream consumer 保留否决权。v0.31 没有增加数据库、服务端执行器、通用可视化库或后台 Agent；它只是终于让已经存在的五种 canonical source 能从零进入同一条低基础设施编译链。

这还不是完整的“数据建模向导”。Query 仍绑定一份 Data，Chart 仍是单 series，用户仍需在创建后的 SQL source 中表达聚合、筛选与 alias；Agent 也不能在一个未审阅计划里创建 Data、Query、Chart 和报告并猜测所有生成 id。下一步若要缩短多步分析，应设计一种 Rune-owned transaction reference（例如 action-local symbolic handle），让后续 creation/patch 能引用同一计划中尚未分配的 identity，并在编译时统一解析、在 review 中完整展开。那应是一套显式、可证明的依赖规划协议，而不是放开模型直接写 id。

## 37. 事务内引用不是临时 ID：让 Agent 一次规划完整的数据到成品链

v0.31 补齐了五类创建，却仍把最重要的工作流切成多轮：先创建 Data，审查后模型才能看见真实 id；再创建 Query；再创建 Chart；最后才把 Chart 放进报告或演示。每一轮都安全，但用户必须反复描述同一个目标，模型也会在轮次之间丢失“这是一个整体交付物”的结构意图。最危险的捷径是让模型按标题猜 `forecast-data`、`forecast-query` 之类的 slug：只要 workspace 已有同名文件，Rune 实际分配 `-2` 后缀，猜测就会指向旧文件、变成 unresolved binding，或偶然连到错误事实。v0.32 因而实现的不是“允许临时 id”，而是一种由编译器独占解释权的事务内引用语言。

每个 `create_artifact` 现在必须声明一个 1–40 字符、以小写字母开头的 action-local `handle`。它只在这次 provider response 内存在，不是 artifact id、filename、manifest metadata 或 source token。Query/Chart 的 `source` 也不再是一个容易混淆的字符串，而是严格 discriminated reference：`{ kind: "artifact", artifactId }` 只能指向请求中原本可见的 canonical file；`{ kind: "creation", handle }` 只能指向同一计划里更早、并且已经成功编译的创建。Chart embedding 使用完全相同的 reference 结构。重复 handle、前向引用、缺失 handle、错误 artifact kind、非法字符或把生成 slug 填进 `artifactId` 都会拒绝完整 operation plan。

“只能引用更早 action”是有意的拓扑约束。一个四步计划可以按 `Data → Query → Chart → Document/Deck` 排列，Rune 每完成一步才把 handle 记录到内存 map；某一步的 template、typed edits 或 workspace validation 失败时，该 handle 从未获得能力，后续动作也不能继续。这样不需要实现任意 DAG 排序、循环检测或模型自定义 dependency solver，Structured Output 的数组顺序就是可读的执行顺序。真实 id 仍由原有 collision resolver 对当时 evolving workspace 分配，所以两个同标题创建可以得到 `brief` 与 `brief-2`，后续 handle 都会准确解析到各自结果，而模型从未看到或控制这个命名决定。

把新 Chart 接入成品不能依赖在任意 `replace_text` 中塞占位符，否则 placeholder grammar 会渗进 Markdown、Deck、SQL 和 JSON 的每个字符串位置，也很难证明模型究竟授权了哪条依赖。v0.32 新增的 `append_chart` 因而是 Workspace-only typed operation：它接收一个现有 Chart 或更早的 Chart handle，再接收一行纯文本 heading。对 Markdown，它追加二级标题和一个由 Rune formatter 生成的 JSON-quoted `{{ chart(...) }}`；对 Deck Markdown，它追加受限 `layout: split` slide。File/Selection provider schema 不暴露这个 operation，legacy HTML、Data、Query、Chart 自身和重复 embedding 都明确失败。模型仍不能 patch 一份刚创建的文件；若要让新 Document/Deck 使用新 Chart，就把 `append_chart` 直接放进该 consumer 的 creation edits。

编译器还会在 source 完成后重建一次完整 dependency graph。所有 `created artifact → touched consumer` 边必须能对应某个已经解析的 creation handle；如果模型在普通 `replace_text` 中碰巧猜中了 Rune 最终生成的 slug，图上虽然会出现一条“可解析”边，但没有 handle authorization，整个计划仍被拒绝。这个二次证明把“引用结果合法”和“模型有权建立这条同事务依赖”分开：whole-workspace validator负责 artifact/schema 正确性，handle ledger 负责能力来源。编译结果只包含真实 source、真实 id 和 operation count；handle 与授权 ledger 在 response、review、localStorage、folder、Git 和 export 中都不存在。

运行时证明没有因为多文件创建而缩短。若计划新建 Data、绑定它的 Query 和绑定 Query 的 Chart，client preflight 会先构造完整 proposed workspace，把新 Data 计入 changed set、只执行精确绑定的新 Query，再用同一个 revision-bound snapshot 验证新 Chart 的 category/value 和 finite numeric rows。最后的 Document/Deck 只消费已经验证的 Chart。任一 SQL runtime、字段、数值、Chart 或 downstream binding 错误都会在 review 出现前拒绝整笔事务；一次 bounded repair 仍必须返回完整 replacement plan。测试同时覆盖 provider route 的四文件 concrete output、编译器 handle stripping、猜测/前向/错误 kind 失败，以及新 Data → Query → Chart impact graph 的实际执行集合。

无密钥模式不能只展示协议而无法完成同样的用户任务。新的 Workspace 快捷指令“根据收入数据创建分析、图表和报告”会从显式 context pack 选择一份有效 Data，由 Rune 自己顺序创建并绑定 Query、Chart 与 Markdown report；若指令同时要求演示，第四个 creation 会加入 Deck，并复用同一 Chart。这个 deterministic planner 不伪造 provider handles，因为所有 identity 本来就由本地 Rune 代码持有，但它产生与远端编译器同形的 concrete creation batch，进入相同的 runtime preflight、review、revision check 和单次 device persistence。由此，默认没有 API key 的产品也能直接演示“一句话产生可继续编辑的完整 source chain”，而不是退回单文件 demo。

v0.32 仍保持明确上限：一次最多四个 action，只支持向 Document/Deck 追加整个 Chart，不支持在同一计划 patch 刚创建的 artifact、前向 handle、任意位置插入、Query scalar handle、多个 Data relation、任意 DAG 或后台自动 Apply。若真实使用证明“同时创建两份数据、三份查询、多个成品”是高频需求，下一步应先把 review 从平面文件列表升级为可折叠 transaction graph，并定义 action budget 与分阶段 commit 语义；不能只把上限从 4 改成 40。当前版本选择最小但完整的核心链，新增的复杂度只在 Zod contract、顺序 compiler 和 deterministic local planner，不增加数据库、队列、常驻 worker、production secret 或第三方 workflow engine。

## 38. 审核不是文件清单：把一次 AI 修改重新编译成可解释的事务图

v0.32 让一句话第一次可以产生 `Data → Query → Chart → Report/Deck` 的完整 source chain，但原有审核卡仍按文件逐行排列。用户能看到四份 diff，却必须自己打开 SQL、Chart JSON 和 Markdown 才能回答三个最重要的问题：这张图到底读取哪份数据、报告新增了哪条 live binding、改动一份 Data 会让哪些未修改文件重新面对运行时验证。平面列表能证明“改了什么文本”，不能直接表达“这些改动为何必须作为一个原子事务被一起批准”。v0.33 因而没有增加模型权限，而是把已经存在的 source relationship 变成审核本身的一部分。

事务图不能复用 provider 的 action-local handle、summary 或自然语言 rationale。handle 在服务端编译后已经完成使命，rationale 也只是未经证明的解释；若 UI 直接画模型声称的依赖，就可能展示一张与最终 canonical source 不一致的漂亮假图。Rune 现在分别对 current workspace 和完整 proposed workspace 运行同一个 dependency compiler，只读取 Query directive、metric binding、Chart source 和 chart embed。审核图是 canonical source 的另一份编译产物，和左侧长期 Data graph 共用六类 edge grammar，却没有持久化第二份图状态。

仅把 proposed graph 画出来仍然不够。删除 `{{ chart(...) }}` 后，那条边已经不在 proposed source 中；若审核只看未来图，“解除关系”反而会完全消失。v0.33 因此对 current/proposed edge 取 union，以 source id、consumer id 和 dependency kind 作为稳定关系 identity：只在 proposed 出现的是 `added`，只在 current 出现的是 `removed`，两边 identity 相同但字段/引用合同变化的是 `updated`，完全相同的是 `retained`。例如 Chart 从 `Revenue` 改读 `Cost` 不会伪装成无变化；旧 `Region → Revenue` 与新 `Region → Cost` 会同时出现在一条 updated relation 上。

聚焦范围也必须有方向。若新 Query 读取默认 `regional-revenue.csv`，对整张图做无向连通遍历会把这份 Data 已有的两条 Query、两张 Chart、报告和 Deck 全部拉进来，看起来像十几份文件都被新建事务影响。实际上 Data 没变，那些兄弟消费者没有风险。Rune 只从 changed roots 向上遍历其精确输入，再独立向下遍历其消费者：新建 Query 的共享 Data 只是 `Input`，不会以它为新 root 扩散到无关兄弟；若 Data 本身被修改，它就是 root，所有 Query、Chart、scalar、Document/Deck 下游才会进入 `Validated` 集合。这个有向闭包同时避免漏报真实影响和制造虚假爆炸。

节点只有四种状态。`New` 与 `Edited` 是本次会写入的 canonical source，点击仍然只切换现有 bounded concrete diff；`Input` 是保持 byte-for-byte 不变但解释 changed source 所必需的上游；`Validated` 是未被写入、却因 changed root 而进入完整 proposed workspace 或 runtime downstream proof 的消费者。图不会把 Input/Validated 变成可编辑 target，也不会改变 revision、checkpoint 或 Apply 权限。无跨文件 binding 的单文件 patch 仍诚实显示为一个节点和零条边，而不是为“看起来像 Agent”发明依赖。

静态事务图与运行时证据必须相邻但不能混为一谈。图证明的是 source contract：哪份 Query 指向哪份 Data、Chart 选择哪些字段、成品嵌入哪张 Chart；原有 runtime preflight 卡证明的是这次 proposed revision 实际执行了哪些 Query，以及多少 legacy metric、SQL scalar 和 Chart consumer 通过本地 compiler。绿色图不意味着模型的商业结论正确，`Validated` 也不意味着用户已经 Apply。任一 graph/compiler/runtime 错误仍会在 pending review 出现前失败关闭。

交互使用原生 `details/summary`，多文件或有依赖的事务默认展开，键盘可以折叠；节点与 edge list 都有明确的 ARIA label。没有引入 canvas layout、第三方 graph 库或 DOM 连线坐标，因为这些只会增加初始 bundle 与无障碍成本，却不能增强 source truth。当前最多四个 changed action，纵向 edge list 已足以完整呈现；未来若 action budget 真正扩大，再考虑分层布局、节点折叠和分阶段 commit，而不是提前把审核变成不可读的流程设计器。

v0.33 仍不支持文件删除、部分 Apply、跨阶段回滚、多人 approval 或持久 audit log，也没有把四 action 上限提高。事务图只是当前原子提议的可解释投影，关闭 review 后不会留在 localStorage、folder manifest 或 Git。这个限制是有意的：先证明用户能在一次批准前看懂完整 source chain，再决定是否需要更大 transaction、staged commit 或 CRDT。AI Native Office 的信任基础不是“AI 一次改得更多”，而是每次改动都能同时回答文本差异、依赖变化和运行时影响。

## 39. 从工作台直接出现，转向被欢迎、被教会、再进入任务

v0.33 以前的 Rune 一打开就是完整工作台：文件列表、source editor、preview、Agent、graph、导入导出和同步控件同时出现。这对已经理解 artifact-as-code 的开发者有效，却要求新用户先理解 Rune 的内部架构，才能知道第一步做什么。它也让产品看起来像常见的深色侧栏 AI 工具，而不是有自身秩序和气质的内容产品。v0.34 因而没有扩张 Agent 权限，而是第一次把“用户如何进入 Rune”作为完整产品路径。

视觉上借鉴 Apple 的克制、留白、材料层级、系统语言建议和 setup assistant 节奏，但不复制系统控件或品牌。Rune 选择朱砂红作为自己的主色：它既像编辑批注和确认印记，也能与雾白画布、石墨侧栏和 Artifact 语义色形成稳定识别。原来占主导的森林绿退出品牌主色，只保留 Data 的含义；通用 AI 星云渐变不再承担产品身份。顶部材料使用轻模糊和细边框，动效只解释页面进入、快捷键完成和拖放状态，并服从 reduced-motion。

首次启动先从 navigator languages 中保守推荐简体中文或 English，再由人确认，选择只作为设备偏好保存在独立 localStorage key。SSR 始终先输出不带 welcome 的稳定英文壳，hydration 后才读取设备信息并挂载 setup assistant，避免重演 locale 导致的 hydration mismatch。欢迎流程依次解释本地优先、先审后写和实时编译；快捷键页不是静态说明，而是在 capture phase 监听用户实际按下打开、checkpoint 和 Agent plan 组合键并逐项确认。完成后可打开指南、导入自己的文件或探索示例，帮助按钮可以重新进入，不把教程变成一次性不可找回的弹层。

说明文档不是外部 help center。Rune 生成一份普通 rune-guide.md Artifact，跟其他 source 一样可编辑、可预览、可下载、可同步到用户目录，也能演示右侧 heading 到左侧精确 source selection。更改界面语言时，只在指南仍等于 Rune 原始模板时切换内容；用户改过的指南不会被偏好更新覆盖。这让 onboarding 本身遵守 source ownership，而不是引入另一套隐藏内容系统。

“工作区存在文件”和“当前打开文件”也被拆开。按 Cmd/Ctrl-W 或 source header 的关闭按钮只关闭当前视图，不删除任何 Artifact；中央出现系统式 drop zone，同时保留 Sources rail。点击或拖放最多二十个文件会进入一次 import transaction：每个文件独立通过大小、格式和本地转换边界，Office warning 带来源文件名，所有生成 Artifact 合并后经过一次完整 workspace validation 和同一个 review dialog，确认前零写入。Cmd/Ctrl-O 与中央按钮共享同一 file input，所以快捷键、点击和拖放不会形成三条不一致的导入路径。

Gemini Notebook 类产品值得借鉴的是 Sources 作为所有回答和产物的证据基础、基于来源的提问、可回到原文的引用与引导式产物入口，而不是复制聊天加笔记布局。Rune 的长期信息流仍是 Sources → Analysis → Deliverables → Review → Apply。任何引用或右侧交互都必须由 source range、SQL lineage 或 Chart provenance 证明，不能信任模型编造的页码和文件名。

v0.34 只建立中英文 welcome/tutorial/empty state 与指南，并不假装整个旧工作台已完成国际化。它也不因为用户希望打开 DOC、PPT、PDF、ODF 就把扩展名加入 accept 列表：DOC/PPT 是旧二进制格式，需要未来桌面壳或受控 conversion service；PDF 到 Markdown 是语义提取/OCR，不是原版式 round-trip；ODF 要分别实现 ODT、ODS、ODP。每一种格式仍必须有 parser limit、review、fidelity warning、fixture 和独立 handler QA。

双向编辑同样保持 source-first。当前左侧修改已经实时重编译右侧，右侧 heading、cell、row、Query direct field、Chart datum 和 Deck slide 已能定位精确 source；Data cell、Document section/block、Deck slide 与 Chart spec 也已通过 typed visual editor 编译回同一 source。v0.51 进一步让这些右侧草稿在保存前就把完整 source candidate 实时镜像并高亮到左侧，但镜像不获得持久化权。Rune 不会把整个 preview 设成 contenteditable 后猜测如何还原 Markdown，因为那会制造第二份状态、格式漂移和不可证明的写入范围。所谓双向同步，是两个受控投影修改同一个 canonical source。

## 40. 语言之后先决定模型边界，并让第一种右侧编辑回到 source

语言确认后立即进入模型设置，比把 API 配置藏进后续 Preferences 更符合首次启动的心理顺序：语言回答“Rune 怎样和我说话”，模型回答“Rune 会把什么交给谁处理”。如果先教快捷键、最后才解释可能发生的远端请求，用户在第一次触发 Agent 时才发现数据边界，信任已经被透支。因此 v0.35 把 setup assistant 固定为欢迎、语言、模型、快捷键、开始五步；帮助入口允许以后重新进入模型页，首次跳过也只代表选择本地模式，不代表默许远端传输。

模型设置必须把“个人 API”和“把 key 交给浏览器可读持久层”分开。OpenAI 的官方认证说明要求 API Key 作为秘密保存在服务端环境或密钥管理系统中，不能嵌入客户端代码。v0.35 因而最初只向 `GET /api/model-status` 读取 `configured`、`provider`、`model` 三个非秘密字段，展示部署模型或本地规划器；v0.46 在不改变该边界的前提下允许用户在 password draft 中短暂输入 key，立刻通过同源 HTTPS 交给服务端加密为浏览器脚本不可读的 HttpOnly credential。用户偏好仍只在 localStorage 保存 `auto` / `local`，密钥不能进入 workspace、Artifact、localStorage、checkpoint、文件夹 manifest、Git、URL、日志、分析事件或模型输入。

这也解释了 Web、部署和未来桌面版的三种产品路径。本地开发可以在未提交的 `.env.local` 放部署 key，也可以配置独立加密主密钥后使用个人 profile；托管 Web 把每位用户的 credential 保存在同源、可撤销的加密 HttpOnly cookie 中；桌面 BYOK 则必须把同一 secret-storage port 接入 macOS Keychain / Windows Credential Manager，React 仍只拿脱敏状态。当前版本没有假装 Web cookie 已经是跨设备账号 vault。无模型时 deterministic planner 仍能完成核心任务，是隐私选择和可用降级，不是错误页。

模型状态与模型权限仍是两件事。连接成功只让 Rune 可以调用 provider；provider 依旧只能返回有界 typed operation，不能接触 localStorage、文件系统 handle 或写入 API。请求仍由 graph-bounded context 决定，Data/Query/Chart 改动仍要通过本地 runtime preflight，所有结果仍需 review、revision check、checkpoint 与原子写入。用户选“仅本地”后，client 不发送 Agent 请求到远端 route，而是明确运行内置规划器；刷新后只恢复这个非秘密选择。

同一版本实现了右侧到左侧的第一种真实写入：Data scalar cell。此前点击 cell 已能通过 parser-derived source target 选中左侧精确 token；现在 Enter 或显式铅笔按钮可以打开 typed editor。这个入口不使用双击，因为单击定位会在下一个 animation frame 聚焦 textarea，容易与双击产生的 editor autofocus 冲突；独立按钮把“定位”和“修改”变成两个可理解、键盘可达的动作。

视觉编辑没有直接改 React table rows。提交时 Rune 用 row index、column index、column name、start/end 与当前 source revision 重新证明 target；CSV 通过现有 parser 做自动 scalar typing，JSON 要求用户显式选择 string、number、boolean 或 null。嵌套 object/array、重复 JSON key、missing property、非有限数字、相同值、超过 10,000 字符、旧 offset 和跨出 token 边界的修改全部拒绝。序列化后还要重新 parse 完整 source，证明目标值 round-trip，并重新生成新 source range。

单个 cell 看起来是局部写入，但它可能改变 Query、metric、Chart 和成品，所以不能在 editor blur 时立刻落盘。Rune 先基于 captured workspace revision 构造完整 proposed workspace，运行静态 adapter/dependency validation，再执行受影响 Query 并验证所有相关 Chart；过程中 source editor、Import、Export 和 Agent 暂停新的写入。只有全部通过，才为旧 Data source 建 checkpoint、执行一次 device persistence，并同时更新 source、preview、精确选择和 Selection Agent context。任何错误都把信息留在 cell editor 内，canonical source 保持 byte-for-byte 不变。

v0.35 的限制是有意的：Query result 和 Chart datum 即使具有跨 Artifact provenance，也只导航到 Data，不直接写；嵌套 JSON 只定位不编辑；Document、Deck 和 Chart 视觉写入还未开放。下一阶段先设计 Markdown heading/block operation 与 preview block identity，沿用相同的 stale-range、outside-boundary、whole-workspace、checkpoint 和 atomic persistence 合同，而不是把 document preview 设为 contenteditable。这样每扩展一种右侧交互，Rune 增加的是一个可测试 compiler operation，而不是一套新的隐藏文档模型。

## 41. Document 双向编辑不是富文本反向猜测，而是 section capability

Data cell 能依靠 CSV/JSON lexer 找到一个 scalar token，Document 却没有天然的“一个可见段落等于一个连续 Markdown range”保证。ReactMarkdown 可能把引用、列表、表格、链接定义和 fenced code 组合成不同 DOM；compiled metric 与 Chart 又会把 source token 投影成运行结果。如果直接监听右侧 DOM 或使用 contenteditable，Rune 必须从浏览器重写后的 HTML 反推 Markdown，空白、列表编号、引用层级和 binding 很快会漂移。v0.36 因而没有承诺任意 WYSIWYG，而是先把已经可证明的 `document-section` target 提升成一种有界写 capability。

一个 section target 来自当前 canonical revision 的 fence-aware heading scanner。preamble 是第一个可见标题之前的连续内容；每个标题 section 从该 ATX heading 开始，到下一个可见标题之前结束；没有标题时全文是一个 body。代码围栏中的 `#` 永远不创建 section。target 包含 artifact、id、index、label 和 UTF-16 start/end，但仍只在当前渲染中存在。为了不把四空格 code block 的缩进当成“可清理空白”，Document target 只移除边界上的完整空白行，不再逐字符 trim 内容。

右侧交互保持两个动作：点击 section 名称仍然执行精确 source 定位并进入 Selection Agent；旁边的铅笔打开 section editor。编辑器左侧是最多 16,000 字符的 Markdown 草稿，右侧通过 Rune 现有安全 compiler 即时展示 draft preview。草稿只是组件内的临时输入，不进 localStorage、checkpoint、folder 或 workspace graph；取消立即丢弃。这里仍展示 Markdown，是有意的过渡：它让用户在成品侧工作并获得实时反馈，却不伪装已经解决所有富文本 round-trip。

Save 会从零重做授权证明，而不信任打开 editor 时缓存的 fragment。Rune 要求当前 artifact source 与 UI revision 相同，再用 target id、index、label、start/end 找到完全一致的 section。标题型 section 的 draft 必须仍只有一个位于 offset 0 的可见标题，标题层级必须不变；标题文字和正文可以修改。preamble 或无标题全文必须继续无标题。这样 section rename 是局部内容操作，而增加/删除 section、改变 hierarchy 仍是显式结构操作。空 draft、no-op、超限、stale target、额外标题、缺失标题和越界替换全部失败关闭。

live binding 需要更严格的权限。视觉 editor 中出现的每个 `{{ ... }}` token 必须与原 section 按顺序 byte-for-byte 相同；用户可以改它周围的论述，却不能在一个看似文本编辑器里悄悄新增、删除或重定向 metric/Chart dependency。依赖变更继续通过 canonical source 或 Agent review，让 transaction map 和运行时证据有清楚入口。这也避免 Document-only patch 因为临时换到另一张 Query-backed Chart 而需要隐藏启动 DuckDB。

compiler 只用 replacement 替换 exact range，并再次证明 prefix 与 suffix 完全不变；随后通过完整 proposed workspace 的 adapter、metric、Chart 与 dependency validation。共享 visual-commit pipeline 捕获全工作区 revision，暂停 source、Import、Export 和 Agent 并发写入，为旧 Document 建 manual checkpoint，再执行一次 device persistence。只有成功后 React workspace 才切换，新 section range 同时成为左侧 textarea selection、右侧 active target 和 Selection Agent capability；失败时旧 source 和恢复历史都不改变。Data 与 Document 共用这一 commit pipeline，为下一步 Deck slide 和 Chart property 避免复制一套不一致事务。

v0.36 仍没有 paragraph-level DOM selection、拖拽重排 section、可视化表格结构编辑、图片 block 或多人光标。下一步不是立刻引入通用 rich-text framework，而是先观察 section editor 的三个事实：普通用户是否理解 section 名称，是否能在 draft preview 中更快完成真实报告修改，是否高频需要 bold/list/link 等可逆 formatting controls。只有这些证据成立，才为单个 Markdown AST block 增加稳定 identity 与 typed operation；否则保留 section/source 两级就比维护第三套文档模型更低成本、更可信。

## 42. Deck 双向编辑从受限 slide grammar 开始，而不是做一块缩水版 PowerPoint

演示预览运行在无脚本 sandbox iframe 中，它天然不能像 React 文档或表格一样把 click 事件直接带回 workbench；更重要的是，iframe 中的 HTML 是 Deck Markdown、metric 和 Chart snapshot 的编译结果，不是可逆编辑模型。让用户直接拖动编译后的标题或图形，再尝试从 CSS/DOM 反推 Deck Markdown，会立刻制造第三份 layout state，并破坏 Rune “source 是事实”的核心。因此 v0.37 继续使用 iframe 外、由 canonical source 派生的 `deck-slide` target strip：主按钮只定位 source，独立铅笔才授予该页的受控写权限。

单页 editor 不复制完整 PowerPoint 功能，只呈现 strict Deck grammar 已经拥有的三个旋钮：五种 layout enum、最多 100 字符的单行 eyebrow、最多 16,000 字符的 Markdown body。打开时 parser 从当前 source revision 读出语义字段，而不是把 metadata comment 当普通正文交给用户；输入过程只保存在 React state。草稿预览也不复用整份 source：Rune 从当前已验证 frontmatter 合成一份临时单页 Deck，先解析、编译 live binding，再用相同 escaped static HTML 进入一个新的空 sandbox iframe。这样用户看到真实主题与布局，同时临时草稿不污染 workspace、checkpoint、folder、localStorage 或 dependency graph。

Save 不信任打开时的解析结果。compiler 用 artifact kind/language、target id/index/label/start/end 再次证明当前页；拒绝空白、no-op、过长 body、未知 layout、换行或 `<>`/`--` eyebrow、独立 `---` 和 raw HTML。每个 `{{ ... }}` binding 必须与原页按顺序 byte-for-byte 相同，所以改文案/版式不会顺手换掉数据来源。replacement 使用源文件的 CRLF/LF 约定和 Rune-owned metadata 顺序，只覆盖 exact slide range；随后重解析整份 Deck，证明页数不变、目标新 range 可派生、prefix/suffix 完全不动。

通过上述局部证明后，Deck 写入不走快捷路径，而是复用 Data/Document 已有的共享 transaction：验证完整 proposed workspace、捕获并复核全工作区 revision、为旧 Deck 建立 manual checkpoint、单次 device persistence，成功后将左侧 textarea 选到新 slide 并让右侧 target 同步 active。任何错误都留在 editor 内，源、恢复历史和 folder 都零写入。frontmatter/theme、增删/重排页、binding 修改、旧 Semantic HTML 仍属于 canonical source 或 Agent review；这是刻意的 capability boundary，不是遗漏。

这一阶段真正验证的问题不是“Rune 能否像 PowerPoint 一样拖框”，而是用户能否在一个 page-sized preview 旁快速完成大多数叙事修改，并理解 layout 是受控选择而非任意画布。如果高频需求集中在改标题、要点、eyebrow 和 layout，这个小 grammar 会比自由画布更可靠；如果真实用户持续需要图片、演讲者备注、母版和坐标布局，再用数据决定扩展 AST，而不是预先背负完整演示引擎。

## 43. Chart 编辑要分开“数据点来源”和“图表规格权限”

Chart 右侧早已有精确点击：标签和 mark 通过 compiler provenance 跳到 Data cell。但这种 lineage 只证明“这个显示值来自哪里”，不证明用户点击一个 bar 就授权修改 Chart JSON，更不证明 Query 结果可以被反向写入。v0.38 因而没有把点按数据 mark 变成就地数值编辑，而是在独立 Chart 页面增加单独的 Source/Configure toolbar。Source 选择完整 JSON；Configure 才授予一份完整、严格、当前 revision 的 chart-spec write capability。

Chart spec 很适合受控表单，因为它本来就是一个 strict JSON schema，而不是自由 DOM。表单一一对应 title、description、mark、category、value、sort、format、color 和 maxItems；没有任意 CSS、表达式、回调或 JSON 文本插槽。category/value 选项不是从画面标签猜测，而是从绑定 Data parser 的列，或 Query 的 conservative static output contract 得出。每次输入都会临时生成完整 spec，并用当前 Data 或 revision-bound Query snapshot 走正常 Chart resolver；因此 bar/line、排序、格式、颜色和 mark 数量的草稿都对应真实运行数据。

`source` identity 被刻意锁定。换 source 会改变 graph edge、需要的 Query 证据、Workspace Agent context、嵌入报告/Deck 的语义以及运行权限，这不是普通外观设置。如果把它藏进一个下拉框，用户可能只想换配色，却无意中把整份报告改到另一组数据。现阶段 dependency identity 变化继续通过左侧 canonical JSON 或 Agent transaction map；将来若用户测试证明直接切换是高频任务，也应设计一个明确显示旧/新 edge 与影响消费者的独立 binding flow，而不是静默扩展 Configure。

保存时 `prepareVisualChartSpecEdit` 从当前 source 重新派生完整 target，要求 artifact kind/language、id/index/label、0..source.length range 全部一致。输入先通过同一 `ChartSpecSchema`，Rune 再以固定字段顺序和两空格缩进重写完整 JSON；source identity 始终来自 current spec 而非浏览器草稿。no-op、stale、超限或 invalid schema 立即失败。之后共享 visual transaction 会验证完整 workspace，执行 changed Chart 所需的 Query 和 Chart runtime impact，创建 checkpoint 并单次持久化。成功后左侧选中完整新 JSON，右侧用同一 revision 重绘；失败时图表、source、历史和 folder 都不动。

这个设计把两种“实时”区分清楚：输入过程中的 draft preview 是可丢弃的预测，Save 后的 live preview 才是 canonical projection。它也完成了 Data cell、Document section、Deck slide、Chart spec 四类右侧写入的共同架构验证：每一类都先获得窄 capability，再由确定性 compiler 生成 source patch，最后进入相同 revision/checkpoint/validation/persistence 边界。下一步应优先补真实文件格式覆盖和普通用户格式工具，而不是为每种 preview 再造一套状态机。

## 44. PDF 导入不是“打开一个 PDF”，而是一次有损、可证明的语义迁移

PDF 的内部目标是固定呈现，不是可逆的段落模型。即使页面看起来像一篇文章，文件里也可能只是许多带坐标的字形：列顺序、表格单元格、标题层级、页眉页脚和段落边界并没有统一语义。若产品把 `.pdf` 加进文件选择器后直接宣称“支持编辑”，用户会自然期待原排版、图片和表格都被保留，而 Rune 实际只能猜测。这一轮因此把承诺明确写成 **selectable text → reviewable Markdown**，并让每一类无法恢复的信息在 Apply 前可见。

解析使用按需加载的 PDF.js display layer 和本地 worker。它只在用户选择 PDF 后进入浏览器，不上传 bytes，也不进入首屏包。输入先检查扩展名、12 MB 上限与前 1,024 bytes 内的 PDF signature；运行时关闭 eval、stream、range 和 auto-fetch，遇到错误停止。加密文件明确要求用户先导出无密码副本，页面不新增一个短命的 secret 输入面。文档 JavaScript只被检测并写成 warning，绝不执行。页数、文字片段和 Markdown 输出分别限制为 200、100,000 和 200,000，避免一份敌意或异常 PDF 把 UI 和 localStorage 拖垮。

语义转换只使用可以审查的有界 heuristic。坐标接近的 fragment 合成一行，dominant RTL 决定行内排序，CJK 相邻字符不强行插入空格；跨行根据垂直间距、缩进和断词规则组成段落。字体高度相对正文中位数只推断二到四级标题，常见 bullet/number 变成 Markdown list。至少半数页面顶部或底部重复的标准化文本视为页眉页脚；每个页面仍写入 `<!-- PDF page N -->`，让用户和未来 OCR 能回到来源。所有原文花括号先编码，因此 PDF 中看似 `{{ metric(...) }}` 的文字不能获得 Rune binding 权限。

这些规则的价值不在“猜得像人”，而在错误模式清楚：大水平间距提示可能存在列或表格；空页在没有授权时保留 OCR 未执行标记；annotation、bookmark、JavaScript、重复页眉页脚都有独立 warning。v0.50 以后，完全没有可选择文本会进入单独的 OCR 授权面，而不是自动读取像素或生成一篇空文档。图片、字体、精确版式、链接、评论、表单、列和表格结构仍不保留；OCR 只输出用户明确选择页的转录，并携带页码、平均置信度与原 PDF 对照提示，再进入同一 import review transaction。区域级来源仍是后续增强，不在当前合同中伪装完成。

验证同时包含合成 snapshot、由独立 PDF writer 生成后再经真实 PDF.js 读取的双页文件、密码/伪 header/超大/超页数/纯扫描失败路径，以及 Poppler 逐页渲染和系统文本提取对照。只有 converter 输出通过 canonical artifact 验证、完整 workspace 验证和 stale-context 检查，用户确认才产生一次设备写入。这样 PDF 是一个诚实的兼容 port，不会变成新的 source of truth，也不削弱 Rune“先看见，再接受”的信任边界。

## 45. OpenDocument 支持不是加一个 `.odf`，而是三个有界语义端口

用户说“支持 ODF”时，实际期待的是 Writer 的 ODT、Calc 的 ODS 和 Impress 的 ODP，而不是一个可互换的通用文件。三者虽然共用 ZIP、XML namespace、manifest 和 `mimetype` 包装，但内容模型分别对应文档流、稀疏二维表和页面/绘图树。若只根据 ZIP 内出现的标签猜格式，错误扩展名、伪装包和混合内容会在 UI 中被当成另一类 capability。v0.40 因此把扩展名、首个未压缩 `mimetype`、manifest root MIME 与目标 parser 四者绑定，并以 OASIS ODF 1.3 package/schema 作为机器可验证合同。([ODF 1.3 Packages][23])([ODF 1.3 Schema][24])

导入继续服从 `compatibility bytes → canonical readable source → Rune renderer`。ODT 只提取标题、段落、继承文字样式、安全外链、列表和表格；ODS 把每个可见 table 变成独立 CSV，保留 typed cached value；ODP 按 page 顺序提取 title/body/list/table，再交给现有 Deck parser。图片、comments、tracked changes、hidden sheet、live formula、notes、animation、embedded object 和 master fidelity 不是“以后再说”的静默丢失，而是 Apply 前必须看见的 warning。原文件不上传、不持久化，也不进入 canonical graph。

ODS 暴露了一个不能只靠普通 fixture 发现的资源问题：标准办公软件常用 `table:number-rows-repeated="1048574"` 或 `table:number-columns-repeated="16380"` 压缩尾部空白。如果 parser 看到 repeat 就 `Array.from`，一份很小的合法文件也会制造巨大内存分配。正确实现是维护 row/column cursor，只为非空 cell 建稀疏值，空 repeat 只推进坐标；一旦非空值越过 10,000×256 或总体 50,000 cells 才拒绝。这个规则同时说明为什么 package 压缩大小、expanded XML 大小和 semantic output budget 必须分别限制。

安全处理不止 XML entity。加密声明直接失败；Basic/Scripts 和 document script 元素只记 warning、永不执行；数字公式只拿 `office:value` 的缓存结果，不把 formula 带进 CSV；用户字符串若以 `= + - @` 开头会加 apostrophe；内容中的 `{}` 编码，不能伪造 Rune metric/chart binding。ZIP 路径穿越、重复 part、2,000-entry、6 MB 单 XML、24 MB 总 XML、12 MB 输入、200,000 字符单 artifact 和 500,000 字符 workbook budget 都在 adapter 内失败关闭，而不是寄希望于后续 localStorage 报错。

导出则是新的 deterministic compiler，不复用“把 OOXML 标签换名字”的错觉。ODT 从 Markdown semantic block 生成段落、heading、span、list 与 table；ODS 生成 typed values-only cells，绝不输出 OpenFormula；ODP 从已验证 Deck 生成 16:9 page、原生文字、列表和表格。Query scalar 与 Chart 先沿现有 revision-bound snapshot pipeline 编译，Chart 在 ODT/ODP 中成为可选择的 current-data table，并明确失去 live binding。固定 XML 次序与 1980 ZIP 时间，同一 context 得到逐字节相同输出；首个 `mimetype` 不压缩，manifest、content、styles、meta 都显式存在。

产品上不能把“能打开”写成“原样保真”。当前 ODT 不承诺分页、图片、批注或修订；ODS 不承诺公式、过滤器、图表或格式；ODP 不承诺动画、notes、图片或复杂母版。导出前 review 列出这些边界，workspace revision 变化会使旧二进制失效。验证也不让 Rune 自己证明自己：独立 fixture 覆盖三类输入与敌意 package，Rune 导出后重新导入验证语义 round-trip，十二个 XML/manifest 部件全部通过 OASIS Relax NG，系统 handler 均确认 MIME；ODT/ODS 另由 Word/Excel 独立打开。若 PowerPoint automation 不可用，ODP 明确停在 schema、系统类型和 Rune 往返证据，不把它写成已做过视觉打开。这个阶段增加零 hosted service 和零首屏依赖，却完成了开放标准的双向迁移通道。

[23]: https://docs.oasis-open.org/office/OpenDocument/v1.3/OpenDocument-v1.3-part2-packages.html "OpenDocument v1.3 Part 2: Packages"
[24]: https://docs.oasis-open.org/office/OpenDocument/v1.3/os/part3-schema/OpenDocument-v1.3-os-part3-schema.html "OpenDocument v1.3 Part 3: Schema"

## 46. 普通用户格式化仍要生成 source operation，而不是接管 DOM

v0.36 留下的关键产品假设是：用户愿意在右侧 section editor 工作，但不应该为了加粗一句话或建一个列表而记 Markdown 标点。v0.41 给这个假设一个最小实验，不引入通用 rich-text framework，也不把右侧预览设为 `contenteditable`。编辑器的左半仍明确叫 Source draft，右半仍是 Draft preview；新增的八个图标只是把用户选区编译成可读 Markdown。这样降低表达门槛，但没有引入一份与 canonical source 竞争的 JSON/HTML 文档模型。

格式命令必须是可逆、局部、确定的。粗体、斜体、删除线会识别选区自身或相邻位置已有的 delimiter，再决定包裹还是解除；行内代码扫描选区内最长的反引号 run，使用更长 delimiter，避免用户文字截断 code span；链接只接受一行文本，生成后把安全的 `https://` 草稿选中。列表和引用不依赖 DOM：compiler 扩展到选区覆盖的完整 source lines，保留最多三字符 Markdown indent，把同类 marker 移除或在 bullet/numbered 之间切换，并把原来的 caret/selection 映射到新字符串。

选区本身也是 capability。浏览器 toolbar 的 `mousedown` 会夺走 textarea focus，所以 UI 在按下按钮前阻止默认聚焦，并在 React 更新后的 animation frame 恢复 exact UTF-16 range。按钮和 `⌘/Ctrl B/I/K` 共用同一 pure function，图标全部有可读 `aria-label`、title 和原生 toolbar 语义。空选区不会插入“在这里输入”之类可能被误保存的占位内容；它只生成 delimiter 并把 caret 留在中间。链接因为需要两个可编辑字段，默认保留当前 label 并选中 URL。

live sync 仍需分清预测与事实。每次格式命令会立即更新 Source draft 和安全 Markdown preview，这是同一临时字符串的双投影；草稿不写入 localStorage、folder、checkpoint 或 workspace graph。只有 Save 才进入已有的 revision-bound section compiler，继续拒绝超长、空白、no-op、结构变化、binding 变化和越界，再走完整 workspace validation、checkpoint 与单次 persistence。工具栏不会因此获得改 heading hierarchy、表格结构、图片或 dependency identity 的权限。

这轮刻意不实现 active-format 状态、富文本光标、DOM 段落选择、拖拽 block、复杂嵌套 list 或 undo stack。Markdown 标记可能来自不同等价写法，伪造一个“粗体按钮已激活”反而要求完整 AST/source-position 合同。下一阶段应先采集三个事实：用户使用 button 与 shortcut 的比例、格式操作后的取消/保存率、以及表格/标题/图片需求是否明显高于普通 inline/list 操作。只有 block 级需求被真实使用证明，才为 Markdown AST 建稳定 identity 和 inspector；否则这组薄 compiler controls 已经能覆盖高频编辑，又保留 Rune 最重要的可核验 source。

## 47. Overleaf 式同步的关键不是滚动，而是 compiler provenance

此前 Document 的右→左只有 section outline，用户点击右侧正文里的某句话并不会定位左侧对应段落。这离用户设想的 Overleaf 体验仍有明显距离：section 能回答“在哪一章”，不能回答“这一个可见块来自哪段 source”。v0.42 把 heading、paragraph、list、blockquote、fenced code、GFM table 和 thematic break 提升为 `document-block` capability；它们来自与 ReactMarkdown 相同的 CommonMark/GFM AST top-level node position，不是另一套正则或浏览器 DOM 文本搜索。

真正困难的不是 Markdown AST，而是编译改变了字符串坐标。一个 67 字符的 Query metric token 可能显示成 6 字符，后面的 paragraph offset 全部左移；如果直接把 rendered AST offset 写进 textarea selection，看似正确的点击会悄悄选到另一段。Rune 现在让 metric compiler 同时输出长度为 `compiledSource.length + 1` 的 canonical boundary map。未替换字符每个边界一一前进；replacement 内部的边界保守地指向 token 开头，最后一个边界才指向 token 末尾。preview AST range 先通过这个 map 回到 canonical range，再要求它与 canonical AST target 的 start/end 完全相同。映射不能证明就没有按钮权限。

这种设计保留了两层交互。顶部 section chips 适合文档大纲、section 编辑与结构感；正文 block 本身适合“我看到这段结论，带我去它的源码”，点击后激活同一个 Selection Agent capability。hover 只有轻微朱红底色，active 更明确；所有 block 使用原生 focus、Enter/Space 和可读 label。并没有监听用户在 DOM 中划出的任意 Range，因为跨 inline markup、metric replacement 和嵌套结构时，那仍需要更精确的 source-map 合同。

Chart 是重要的反例。含 `{{ chart(...) }}` 的 Markdown paragraph 在 AST 中仍只是普通段落，但画面中的 label/bar 已经能追到真正 Data cell；若外层 paragraph 再截获点击，粒度反而退化。因此任何包含 Chart binding 的 paragraph 都不获得普通 Document block target，事件继续由 Chart provenance 处理。v0.42 也暂不拆分 list item、table cell 或 inline span；下一阶段若增加 block inspector，应以这些已证明 target 为输入，编译 typed Markdown operation，而不是让 DOM 成为第二份文档。

## 48. Block inspector 的权限边界必须比 section editor 更窄

v0.42 已经知道右侧每个顶层 Markdown block 的 exact source range，但“知道它来自哪里”不自动等于“可以随意重写它”。若一个 paragraph editor 接受 `第一段\n\n第二段`，用户表面上仍在改一个块，实际却新增了结构；若 heading 从 `##` 变成 `#`，文档层级也被改变。v0.43 因此把 block editor 定义成 same-type compiler：草稿必须被同一 CommonMark/GFM parser 解析为恰好一个顶层 node，而且 node type 必须与 target 相同；heading depth 也必须相同。解析结果不满足就停在草稿层，canonical source 不动。

这个约束让视觉入口和结构入口分离。heading、paragraph、list、blockquote、fenced code 与 GFM table 可以通过 hover/focus 后的铅笔或 `F2` 打开；thematic break 仍只有定位，因为它没有可编辑正文，允许空草稿会把 edit 模糊成 delete。按钮不是套在 heading/list/table 上的伪 `role=button`：每个语义 block 保留自己的 HTML 元素，外层只负责 hover 与 active 投影，旁边两个原生 button 分别承担 locate 和 edit。链接、task checkbox 等内部控件不会被定位事件截获，触控环境始终显示操作条。

格式命令也不能无条件复用 section toolbar。paragraph、heading、quote 与 table 可获得 inline bold/italic/strike/code/link；list 额外允许 bullet/number 互换；fenced code 不显示任何 Markdown formatting command。即使某个按钮能生成合法字符串，最终 same-type parser 仍是权限门。例如对 paragraph 使用 list command 会改变 node type，因此在 UI 和 compiler 两层都不允许；这比“先让用户点，再报错”更符合克制的 Apple 式交互。

草稿实时预览只证明“当前输入将如何渲染”，不是已经保存的事实。Save 重新派生 exact target、证明所有 `{{ ... }}` binding byte-stable、证明 source range 外 prefix/suffix 不变，再复用 Data/section/Deck/Chart 已共同验证的 visual transaction：完整 workspace static/runtime validation、全局 revision recheck、manual checkpoint、一次 device persistence。成功后新 block range 同时成为左侧 selection、右侧 active state 和 Selection Agent context；任何 stale、no-op、多块、类型变化、heading depth、binding、下游或存储错误都零写入。

v0.43 仍不把 block target 持久化成 UUID，也不支持拖拽、增删、跨块合并、nested list item、单个 table cell 或 DOM contenteditable。当前 `index + range + type + label + headingLevel` 只服务一个 revision；source 一变就重新计算。下一阶段更值得做的是显式的 insert/move/delete block typed operations与 transaction preview，或让左侧 source selection 与右侧滚动互相跟随；不能因为已有铅笔按钮就把所有结构修改偷偷塞进同一个 textarea。

## 49. 结构编辑必须先回答“操作了什么范围”，再追求拖拽手感

一旦用户能在右侧改写一个块，最自然的下一步就是新增、删除和排序。但它们和文字修改的风险不同：改 paragraph 内容只替换一个 exact range，move 会同时改两个 source range 的相对顺序，delete 可能移除 live dependency，heading 的移动更容易被误解为“整节跟着走”。如果直接上拖拽，drop indicator 的像素位置会被误当成语义授权，用户也很难在松手前知道是移动标题还是整个 section。

v0.44 因此先把结构操作做成显式 command。每个 AST-proven 顶层块旁有 insert-before/after、move-up/down、delete；首尾动作按当前 revision 禁用。新增不是把任意 Markdown 粘进文档，而是要求草稿经同一 CommonMark/GFM parser 得到恰好一个受支持 node，且不能在这个窄入口获得新增 metric/Chart dependency 的权限。move 只允许跨一个相邻且同样有 position 的受支持 sibling，使用两段原始 source fragment 加原间隔确定性换位；raw HTML 等未授权 node 会形成 fail-closed 边界。delete 必须连同一个可证明的 whitespace gap 移除，并拒绝删除最后一个 node，保证 Document validator 不被绕过。

这里最重要的产品层不是四个图标，而是结构 transaction review。命令先生成完整 proposed source，再展示具体的行级增删；binding 删除和 heading-only 行为用独立 warning 解释。用户确认后，系统重新在当前 artifact 派生完整 target identity，重新运行 compiler，并要求新的 `nextSource` 与已审阅版本 byte-for-byte 一致。只有随后完整 workspace validation、revision recheck、checkpoint 和 atomic persistence 都通过，结构才成为事实。成功选择新块或最近存活块，Selection Agent 也随同前进；Escape、Cancel、stale、unsupported neighbor、runtime 或 storage failure 不留下半个操作。

这一设计暂时牺牲自由拖拽的顺滑，换来三项可测的假设：用户是否真正常用块排序；他们想移动的是一个块还是 heading subtree；精确 diff 是否足以建立删除信任。只有证据表明跨距离拖拽是高频，才把同一 typed operation 接到 pointer interaction；只有证据表明“章节”是主要心智模型，才新增 section-subtree identity。这样 UI 可以渐进变得自然，但 canonical Markdown 不会因为手势而产生隐藏结构规则。

## 50. 左侧到右侧的同步也必须从 source identity 出发

Overleaf 式体验经常被概括成“两边一起滚动”，但滚动百分比只是视觉近似：Markdown 一个段落可能渲染成多行，GFM table、列表、代码、Chart 和 Deck iframe 的高度也完全不同。若拿两个 scrollTop 做比例换算，长表格后面的 source 会定位到错误正文；若在右侧搜同样文字，重复句子、格式标记与 metric replacement 又会产生歧义。v0.45 因此把反向同步定义成 `current source offsets → proven preview target → DOM destination`，而不是两个像素坐标之间的联动。

用户每次移动 canonical textarea 的 caret 或改变 selection，Rune 都在该时刻的 artifact source 上复用现有 parser target。Document 同时拥有 block 与 section 范围，Data 同时拥有 scalar cell 与 row 范围，所以 resolver 按“完全包含当前选区、范围最小、粒度最细”的规则选择；共享边界优先刚开始的目标。跨多个块或 cell 时只能降级到完整包含它的 section 或 row。Deck 只在 slide body 内定位，Chart 因完整 JSON 都映射到一个 spec 而整份可定位。Query source、CSV header、Deck frontmatter、跨 section/row selection 都返回 null；Chart-binding paragraph、unsupported Markdown node 和 block 间空白本身没有细粒度 capability，最多得到它们所在 section 的导航。没有证据时安静地不联动，比把错误对象涂红更可信。

解析结果的 id 被放到对应 React 元素的 data attribute，唯一用途是让右侧容器找到目标并滚动到中部。DOM 自己不参与推断，也不能授予编辑权限；section 没有额外包裹时，可以通过起始 block 上的独立 section id 滚到该节。高亮、顶部 badge 与滚动共享同一个 target object，系统减少动态效果时关闭平滑动画。用户只是放置 caret 时，Selection Agent 仍保持 File scope；只有非空且通过 revision、UTF-16 和长度验证的 selection 才获得原来的窄 Agent capability。

这完成的是身份同步，不是滚动锁定。连续按像素同步容易和用户主动浏览冲突，也会在 iframe、表格和折叠 UI 中漂移；v0.45 当时尚无嵌套 list item、table cell 与 inline span source map，v0.48 已沿同一 compiler-provenance 原则补齐这些可证明对象。派生 Query 结果仍只有现有 direct lineage 能定位。Rune 以后可以观察用户是否需要 source-scroll 驱动的“当前可见块”同步，但任何扩展都必须继续从 compiler provenance 出发。

## 51. 模型配置不是一个 Key 输入框，而是一套可切换的信任边界

CC Switch 最值得借鉴的不是界面形状，而是把供应商当作可命名、可编辑、可启用、可删除的配置对象：预设自动填端点，自定义配置显式填写地址，模型列表可以从供应商读取，当前配置可以一键切换。Rune v0.46 把这套心智模型放进语言之后的 onboarding，也在工作台顶部提供独立设置入口；个人配置与部署者提供的 OpenAI 配置并存，最多保存三份个人 profile，任一时刻只有一份 active。删除 active profile 后回退到下一份个人配置；没有个人配置时才回退到部署模型或确定性本地模式。

Web BYOK 不能照搬桌面程序把明文 key 写进配置文件。输入框中的 key 只存在于当前 React draft，保存时通过同源 HTTPS 发到 `/api/model-profiles`，服务端以 `RUNE_CREDENTIAL_ENCRYPTION_KEY` 派生 AES-GCM key，把 profile metadata 与 credential 一起加密、认证后写入 `HttpOnly; SameSite=Strict; Path=/api` cookie。浏览器脚本、localStorage、workspace、Artifact、checkpoint、folder manifest、Git、URL、日志与模型 prompt 都无法读回或持久化明文。服务器主密钥缺失时，生产环境直接关闭个人凭据库；密文被改动或主密钥轮换后按空 vault 处理。当前三份/30 天上限是 cookie-backed 单设备阶段的明确产品限制，不是假装已有账号云同步。

端点能力也必须诚实。v0.46 首版只支持 OpenAI Responses、当时的 OpenRouter Responses 路径和用户明确声明兼容 Responses 的自定义 HTTPS 基础地址；v0.58 已把 OpenAI Responses、OpenRouter/兼容 Chat Completions、Anthropic Messages、Gemini generateContent 拆成四个显式协议 adapter，自定义端点也必须选择协议。自定义地址始终要求公共 DNS、标准 443 端口、无 userinfo/query/fragment，不能是 localhost、IP literal、`.local` 或 `.internal` 等私网名称，也不能填最终 generation path，以减少 SSRF 和路径误配。读取模型只调用该供应商的模型目录，设置 8 秒超时、1 MB 响应上限和最多 80 个唯一模型 ID，不发送 workspace 内容，也不触发生成；真正是否兼容所选结构化协议仍由第一次受约束 Agent plan 证明。多端点故障转移、费用/延迟路由继续等待明确的数据授权与 capability contract，不能藏进一个“兼容”标签。

这仍不改变 Agent 权限。active profile 只决定 `provider + protocol + apiKey + baseURL + model` 的 transport，供应商仍只能返回既有 typed operations；source revision、context graph、Query evidence、runtime impact、一次修复、review、checkpoint 和 atomic Apply 全部保持原样。用户选择 local 后浏览器不会调用远端 Agent route。个人配置优先于部署配置，但响应只返回脱敏的 provider、protocol、profile name 与 model 等元数据，绝不返回 credential；跨 origin 的配置写请求也被拒绝。

## 52. 一小时设计冻结：全功能地图、依赖与发布门槛

2026-08-13 的设计冲刺把“所有功能”定义为所有已提出能力都有明确产品合同，而不是宣称所有长期工程已在一小时内完成。状态只有四种：**已交付**、**本版交付**、**下一阶段**、**暂不做**。每一项都必须先满足上一层依赖，任何视觉入口都不能早于 parser/compiler、安全边界和可验证 fixture。

| 产品层 | 功能与状态 | 必须依赖 | 可发布验收 |
| --- | --- | --- | --- |
| 进入 Rune | 设备语言推荐、欢迎、快捷键实操、本地指南、空态拖放，以及 v0.49 主要工作面统一中英文：已交付 | hydration 稳定壳、本地偏好、typed copy contract | 首次/再次打开都可进入；SSR/CSR 文本一致；语言切换覆盖专业操作；指南是普通可编辑 Artifact |
| 模型 | 多 profile BYOK、OpenAI Responses、OpenRouter/兼容 Chat、Anthropic Messages、Gemini generateContent、自定义协议、读取模型、启用/编辑/删除：已交付 | 同源 API、AES-GCM vault、显式 protocol、端点验证、local fallback | UI/route 实测；四协议 adapter；响应与 cookie 不出现明文；篡改失败关闭；旧部署模型兼容 |
| Artifact 核心 | Document/Data/Query/Chart/Deck 可读 source、实时 preview、依赖图：已交付 | strict adapters、revision identity | 完整 workspace 每次变化都可重新编译；无隐藏 graph state |
| 双向同步 | source → preview 与 preview → source 定位；v0.48 已细化到 Markdown list item/table cell/inline semantics；Data cell、Document section/block/structure、Deck slide、Chart spec 受控写入：已交付 | parser-derived ranges、outside-range proof | fragment→block→section 最小范围；stale/no-op/越界零写入；成功先 checkpoint 再一次持久化 |
| Agent | Selection/File/Workspace typed operation、创建完整 Data→Query→Chart→成品链、review、一次修复：已交付 | bounded context、query evidence、runtime impact | provider 不能直接写；所有 concrete diff 可解释且 Apply 原子化 |
| 导入 | `.md/.csv/.json/.sql/.html`、DOCX/XLSX/PPTX、ODT/ODS/ODP、selectable PDF 与显式扫描页 OCR：已交付 | 本地 parser、大小/像素上限、fidelity review | 多文件单事务；脚本/OCR/丢失项明确；取消零写入 |
| 导出 | source、DOCX/XLSX/PPTX、ODT/ODS/ODP、Deck HTML、Document/Data/Deck PDF，以及 Rune Desktop 的 DOC/PPT 兼容交付：已交付 | deterministic compiler、当前 Query snapshot、窄 desktop bridge | review 后一次下载；byte/结构 fixture；旧格式真实 Office 往返；canonical source 不变 |
| 通用经营汇报向导 | Data→Query→Chart→报告/演示的任务式入口：v0.47 已交付 | 明确字段映射、周期/对象/重点、workflow review | 用户确认源、严格数值字段与产物；整链 runtime preflight；一次 transaction Apply；错误字段和中途版本变化零写入 |
| 原生 `.doc/.ppt` | Rune Desktop 已支持受限本地导入与经审核导出；Web 明确不支持 | 本机 Word/PowerPoint、宏禁用、私有临时目录、12 MB/30 秒边界 | 真实 Office 双向往返 QA；导入/导出均有 fidelity review；`.xls` 不支持 |
| 扫描 PDF OCR | v0.50 已交付英文/简中本地端口；区域框选与更多语言待真实需求 | 同源 Tesseract worker/WASM/语言数据、明确页码授权与数据披露 | 页面图像不上传；页级 provenance；置信度与遗漏可见；停止零写入 |
| 富媒体 | 图片、附件、来源摘录：下一阶段 | asset store、hash identity、引用许可 | 不把 base64 混入 source；导入/导出/删除/同步可追踪 |
| 多人协作 | 下一阶段且晚于单人价值验证 | account、ACL、operation log/CRDT、presence | 冲突可复现；角色与审计成立；不会削弱本地所有权 |
| 云与桌面 | 先桌面 Keychain/系统文件能力，再可选端到端加密云同步 | storage port、secret port、账号恢复 | Web cookie profile 不假装跨设备；桌面 key 不进 renderer；云端无法读取明文 workspace |
| 供应商路由 | OpenAI Responses、OpenRouter/兼容 Chat、Anthropic Messages、Gemini generateContent 显式 adapter 与真实 token usage：已交付；fallback、预算/延迟/健康度待后续 | protocol adapters、capability manifest、usage ledger | 每个 model 声明 Structured Outputs/tool/context 能力；失败不自动泄露到新供应商 |
| 商业与治理 | 预算、额度、用量、数据地域、审计：下一阶段 | identity、provider usage、policy engine | 单任务预算可见；模型/供应商切换需符合数据政策；key 从不入日志 |

实现顺序被冻结为四条串行主线。第一，先用真实经营汇报任务验证“来源到成品”的时间节省，而不是继续横向加格式；第二，补桌面安全存储、旧 Office 转换和 OCR，使目标用户的现实输入可进入同一 canonical model；第三，在重复使用成立后做资产、模板、连接器与自动刷新；第四，只有多人重复协作和付费证据同时出现，才引入账号、云同步、CRDT 与组织治理。停止条件同样明确：不能建立 source provenance 的入口不做可视化回写，不能安全持有 credential 的平台不开放 BYOK，不能在 compiler fixture 中 round-trip 的格式不标“支持”，没有实际用户复用证据不建设 marketplace 或企业后台。

## 53. v0.47 从“AI 功能工作台”转向 Rune 自己的任务与视觉语言

[ColaMD](https://github.com/marswaveai/ColaMD) 值得学习的是 content-first：默认界面安静、永久控件少、内容宽度受控、文件与编辑模式按需出现；[MarkText](https://github.com/marktext/marktext) 和 [Moraya](https://github.com/zouwei/moraya) 证明 Source/Visual/Split 模式必须让用户理解当前编辑对象；[Slidev](https://github.com/slidevjs/slidev) 证明演示的长期优势来自 Markdown、主题、预览和导出共享一份 source。Rune 不复制它们的窗口、图标或排版，而采用自己的朱砂印记、雾白材料、石墨文字和 Artifact 语义浅色。v0.47 因而移除仿 macOS 三色窗钮和黑色 AI 活动栏，降低渐变、彩色实心块、机器人头像与胶囊标签的视觉权重；工作区名称不再硬编码成 Q2 demo，模型入口也退回工具位置。AI 仍是能力层，但产品第一眼是一个人的内容工作区。

首次启动把“欢迎”和“语言”合并为同一决策页。Hello、你好、Bonjour、Hola、こんにちは、안녕하세요与 Halo 在本地按固定节奏轮换，设备语言只决定首次推荐，不替用户确认；reduced-motion 用户不轮换。首屏不读取时间、随机数或运行时 locale formatter，平台快捷键只在 onboarding 客户端挂载后确定，因此不会再次制造 SSR hydration 文本分叉。语言之后仍先设置模型 profile，再亲手完成快捷键，最后进入可编辑本地指南、导入或示例。

真正的产品推进不是再加一个 Agent prompt，而是新增“创建经营汇报”任务。用户必须显式选择一份当前 Data、一个原样 category 字段、一个全行 finite numeric value 字段、sum/average、bar/line、数字格式、周期、对象、任务重点以及 Document/Slides 交付物。Rune 用这些选择确定性编译 Query、Chart 与成品的 collision-safe id 和 readable source，Query 保留 exact Data directive，Chart 保留 exact Query/field contract，成品只写审核问题和待填写结论，不伪造业务洞察。整条链先通过完整 workspace mutation 与本地 DuckDB/downstream impact preflight，再作为一个带 transaction map 和逐文件 source diff 的 pending review 出现；用户确认才一次写入，并优先打开最终报告。取消、字段大小写不一致、格式化数值、重复产物、运行失败或验证期间 revision 改变都保持所有输入不变。

v0.47 当时也明确没有完成的边界。`.doc/.ppt` 是旧二进制容器，不能通过在 file picker 增加后缀来伪装支持；这项等待桌面壳或隔离转换服务的工作后来由 v0.53 的受限本地导入与 v0.57 的经审核本地导出完成，Web 仍不伪装支持。v0.50 已交付带明确页面范围、英文/简中语言选择、置信度和 provenance 的浏览器本地扫描 PDF OCR，但不宣称区域级框选、任意语言、版式重建或确定事实。v0.49 已把主工作区、专业 review 与可视化编辑器纳入统一中英文合同；parser、模型、SQL 和格式转换器的原始技术证据仍等待稳定错误码后再完整本地化。连续像素 scroll-lock 仍不做；v0.48 已把现有 source-identity 双向同步扩展到可证明的 inline/list/table fragments。

## 54. v0.48 细粒度同步仍然来自 Markdown AST，而不是点击坐标

v0.45 已经证明左侧 caret 可以回到右侧 block，但一个整张 GFM 表或整份列表仍太粗。v0.48 在同一 CommonMark/GFM AST 上增加 `document-fragment`：单个 list item、表头/表体 cell、strong、emphasis、delete、inline code、link 与 image 都携带 exact UTF-16 source range。表格 fragment 额外保留 row/column，链接 target 包含完整 `[label](url)`，行内格式 target 包含标记符，嵌套 list item 按更小 source span 胜出。这样右侧选中的不是一段相似文字，而是 parser 已证明的 source capability。

渲染端只把这些 target id 附在对应 React Markdown 元素上。普通点击、Enter 或 Space 选择 canonical range、聚焦左侧并进入既有 Selection scope；链接普通点击用于定位，⌘/Ctrl 点击仍保留打开行为。反向链路从当前 source revision 的 caret/selection 选择最小包含范围，顺序是 fragment → block → section，再用 DOM id 做居中滚动。DOM 文本、浏览器 Range、元素坐标、标签文案和像素位置都不参与推断。

编译后的 live metric 仍经过 monotonic offset map 返回完整 canonical binding syntax，只有映射结果与 canonical fragment exact match 才能交互；任何包含 Chart binding 的 fragment 都主动让位给 Chart → Query/Data cell 的更精确跨文件 provenance。跨 fragment 的选择只在同一 block 或 section 完整包含时回退，普通未格式化文字继续以 paragraph block 为最小粒度。连续像素 scroll-lock 和任意 rendered-text selection 仍不做，因为它们不能提高 source 可证明性，反而会制造滚动争夺和错误权限。

## 55. v0.49 语言是显式产品状态，不是散落字符串

只翻译欢迎页会制造一种更差的体验：用户确认中文后，刚进入导入审核、图表配置或文档块编辑就突然回到英文，语言选择因此像一次没有兑现的承诺。v0.49 把主要产品文案收敛到 `runeUICopy(locale)`：工作台 chrome、依赖与事务图、恢复点、Agent 建议审核、导入/导出/新建/文档结构弹窗，以及 Document/Data/Query/Chart/Deck 预览和可视化编辑器都必须显式接收同一个 `RuneLocale`。动态数量、文件名、目标和绑定使用函数插值，不能靠 `replace("files", ...)` 之类易碎拼接；测试递归比较两套 catalog 的完整形状。

语言同时影响可执行建议，而不只影响按钮。过去英文界面仍显示中文 quick commands，用户可以点击，但产品心智已经断裂；现在 Selection、File 和 Workspace 三种范围都有等价的双语确定性指令，既保留本地 planner 的意图匹配，也让模型请求与界面一致。高频状态在渲染边界按当前 locale 转换，因此用户切换语言时当前状态立即变化，workspace、checkpoint 和 source 不需要被改写。

稳定渲染仍优先。SSR 输出英文壳且 `<html lang="en">` 与首屏内容一致，hydration 后才读取已确认的设备偏好并更新根 `lang`；catalog 不读取时间、随机数或 ambient ICU formatter。技术证据保留一条明确边界：parser、provider、DuckDB 和 import/export adapter 的原始错误可能仍是英文，因为没有稳定 code 时翻译自由文本可能掩盖真正修复动作。下一步不是补一个巨型模糊词典，而是让这些端口返回 `code + parameters + original detail`，再由 UI 翻译标题与建议、保留可展开的原始证据。

## 56. v0.51 双向同步必须同时展示完整源，但不能制造第二个事实

过去的右侧编辑已经实时渲染局部草稿，保存后也会精确回写左侧；用户仍看不到保存前完整 Markdown/CSV/JSON/Deck source 会变成什么，这会让“左右实时同步”在操作感受上只完成一半。v0.51 因此给每个已证明写 capability 增加纯内存 projection：Document section/block、Data scalar cell、Deck slide 与 Chart property controls 都把当前输入编译成完整 source candidate，并附带 exact replacement range 和 errors。左侧以同一字体、换行和滚动显示整个 candidate，高亮唯一被替换的范围；状态明确区分未改变、可保存和需要修正。

projection 不是 canonical source。右侧仍是这次草稿的唯一 writer，左侧只读；artifact state、localStorage、checkpoint、依赖图、Agent context、folder Push 与各种 export 始终读取原 revision。Cancel/Escape 只销毁 projection，不需要 undo；Save 不信任已有 mirror，而是对当前 base revision 再编译一次，运行完整 workspace/downstream proof，创建 checkpoint 后才单次持久化。编辑期间暂停文件切换、导入导出、目录同步、Agent 和全局保存，避免异步上下文把临时草稿误当成已保存事实。

这不是任意 contenteditable。右侧只能编辑已有 compiler 已授权的语义范围，invalid draft 即使可以显示文本候选也会标红、禁用保存；Query 派生值、legacy HTML、嵌套 JSON、不可证明 DOM selection 和连续像素 scroll lock 仍不获得写权限。下一步若要允许左侧在同一临时 session 继续改，必须引入统一 draft document 与 selection transform，而不是让两个 textarea 分别维护自己的字符串。

## 57. v0.52 导出首先是一项明确的交付选择，而不是工具栏图标集合

过去 DOCX/XLSX/PPTX、ODF、HTML、PDF 和原始 source 各占一个顶部按钮，格式能力越完整，界面越像开发工具栏。v0.52 把它们收进一个 contextual Export 菜单：第一项始终是 canonical source，其余只显示当前 artifact 的真实 adapter。Data 因而明确拥有 CSV、JSON、XLSX、ODS 与 PDF 五条交付路径，而不是要求用户通过改扩展名猜测转换。菜单只改变入口，不放松原有 review、revision 和零写入边界。

CSV/JSON 不是复制原字符串。适配器先用 Rune 当前 parser 得到 typed rows 与 stable column order，再构造矩形输出；JSON 缺失字段成为可见 `null`，CSV 通过标准 quoting 生成 UTF-8 文本并明确不包含 schema。相同输入逐 byte 确定，invalid/empty/oversized source fail closed，生成文件仍需人确认 fidelity notes。原 source 下载保持 byte-preserving，因此“保留原貌”和“格式转换”是两个不同动作。

Data PDF 则补齐此前明确等待的打印合同：landscape A4、每页重复 header、最多 12 列与 5,000 行、固定 row/column geometry、两行 cell wrapping、visible ellipsis warning、footer page count。它不声称是一张可编辑表格，也不携带公式、筛选、类型或 binding。默认 fixture 已由独立 PDF parser 验证页面尺寸与 byte determinism，再由 Poppler 以 144 DPI 渲染并检查表格边线、留白、表头和 footer；这才把状态矩阵中的“计划：表格 PDF”改为已交付。

## 58. v0.53 桌面格式兼容与语言承诺都必须通过真实边界

浏览器不能诚实解析旧二进制 `.doc/.ppt`。v0.53 因此增加首个 macOS Electron 壳，但 renderer 仍没有 Node 权限：`contextIsolation` 与 sandbox 开启，preload 只暴露一个 `convertLegacyOffice` 请求，导航锁定临时 `127.0.0.1` 同源，本地静态文件路径防穿越并带 CSP。桌面首次运行在 main process 生成 32-byte 随机模型 vault 主密钥，用 Electron `safeStorage` 交给 macOS Keychain 保护，再以 0600 原子文件持久化密文；renderer、preload、workspace 和日志都不能读到它，现有 onboarding 的个人 API profile 因而可在桌面真实使用。转换输入限 12 MB、执行限 30 秒；文件写入 0600 的独立临时目录，只以参数数组调用系统 `osascript`，通过已安装 Word/PowerPoint 将旧格式保存成 DOCX/PPTX，强制禁用 Office 自动化宏，并在成功或失败后递归清理临时目录。转换结果没有直接写工作区，而是进入现有 OOXML parser、fidelity warning、完整 workspace validation 与一次 import review。

这条链不能靠 mock 声称完成。QA 先用 Rune 自己的 deterministic exporter 生成 DOCX/PPTX，再让本机 Word/PowerPoint 真实降级成 OLE `.doc/.ppt`，随后调用与 desktop IPC 相同的转换函数恢复 OOXML，最后用 Rune importer 验证 `Q2 Business Review` 和 `Q2 Board Briefing` 语义仍能成为有效 Markdown/Deck Markdown。两条链均在宏禁用和临时清理条件下通过。Web 端虽然允许用户选择后缀，但没有窄 desktop bridge 时明确拒绝，不上传、不猜测、不假装支持；`.xls` 仍未交付，因为当前产品只授权了用户提出的旧 Word/PPT 路径。

欢迎页此前轮播七种问候、却只提供中英文界面，是视觉承诺与产品事实不一致。v0.53 将 BCP 47 前缀、设备偏好顺序、native name、monogram 和 greeting 合并到唯一 `RUNE_LOCALE_REGISTRY`，欢迎轮播与语言选择都由它派生。自动测试要求每个问候恰好对应一个真实可选择 locale，同时该 locale 必须拥有完整 typed UI contract 和本地指南；因此当前只轮播已完整交付的“你好 / Hello”。Français、日本語、한국어、Español、Bahasa Indonesia 只有在教程、菜单、空态、review、错误、导出提示和指南全部完成后，才能同时加入 registry 与动画。Apple 式欢迎由此不是多语言装饰，而是一项可验证的界面承诺。

Apple 的学习方向也在这一版进一步成为工程规则：尊重系统语言的有序 preference，不自行覆盖用户选择；使用原生 macOS 隐私授权而不申请无关的辅助功能/全盘权限；用最小 capability bridge 和渐进披露代替万能 renderer；尊重 reduced motion、键盘操作、同源安全与清晰反馈。Rune 学习的是层级、节奏、材料、原生平台行为与可访问性，不复制 Apple 商标、资产或某一代外观。

## 59. v0.54 经营汇报只有可重复运行，才从生成器变成工作系统

一次性生成 Data → Query → Chart → 报告/演示只证明格式链能工作，不能证明 Rune 能进入周报/月报。v0.54 因此在首次事务真正 Apply 后保存一份有界 workflow definition：用户选择的来源、精确字段、聚合、图表、周期、受众、重点和交付物，以及 Rune 首次创建的 Query、Chart、Document、Deck 稳定 ID。它与设备工作区一同保存，最多八条，不包含 API key、Query 结果或隐藏模型状态；损坏、重复、过量或交付物映射不一致的记录在恢复时丢弃。

侧栏的“已保存任务”不是后台自动化。重新运行会打开同一任务表单，允许调整本期周期、重点、受众、口径和图表，但锁定既有 Document/Slides 集合；编译器在完整当前工作区中生成一条 collision-safe 候选链，再把新 Query/Chart/成品 source 映射回原 ID。Chart 的 source 与成品的 chart binding 会显式重写到原稳定身份，绝不引用临时生成 ID。最终计划只有既有文件 patch，没有重复 creation；仍需 runtime preflight、逐文件 diff、dependency transaction map、显式 Apply、每个旧文件 checkpoint 与一次设备持久化。

复用不以静默容错换顺滑。Data 字段大小写或类型漂移、来源缺失、任一成品被删除、任务记录被篡改、工作区验证失败、运行失败、审核期间 revision 改变或存储失败都保持 canonical source 不变。当前保存的是设备级任务，不是跨设备账号、定时器、目录监听或自动发布；这些能力只有在真实用户连续复用并要求自动刷新后才进入下一阶段。这样 v0.54 完成的是“同一任务下一周期再做一次”的核心循环，而不是新增一个看似自动化的按钮。

## 60. v0.55 指标必须对应一次可验证结果，而不是一次点击

Rune 不能只记录“用户打开过几次”或“Agent 调用过几次”。v0.55 因此把 outcome 绑定到 saved operating review：只有任务准备后被明确 Apply，才记录一次 applied；审核取消、旧 revision、完整 workspace validation 或本机持久化失败记录 stopped，并携带有界原因。每条记录包含周期、确认完成时间、从准备到结果的本地耗时、变更文件数、runtime preflight 实际覆盖的 Query/Chart 数与 local/model planner。模型端只把 provider response 自带的 input/output token 数作为脱敏 usage 返回；本地规则明确记为无模型调用，不估算、不伪造 token。

运行历史与任务一同留在设备，单任务最多十二条；恢复时拒绝非法时间、负数、越界计数、状态/停止原因矛盾和重复 ID。记录不包含 source、CSV 行、Query 结果、prompt、provider 响应正文、API key、用户身份或文件路径。侧栏可以展示最近状态、成功率、平均确认耗时、运行影响和 token，但这些只是当前设备的产品证据。它不能证明 PMF、节省时间或愿意付费；真实价值仍需在真实任务中对比原工作流并由用户确认结果。

## 61. v0.56 问候有多少种语言，界面就必须兑现多少种完整语言

“多语言欢迎”不能只是一段全球化装饰。v0.56 在同一个 `RUNE_LOCALE_REGISTRY` 中加入 `zh-TW`：设备偏好按最长 BCP 47 前缀优先匹配，因此 `zh-Hant`、`zh-TW`、`zh-HK` 和 `zh-MO` 不会被宽泛的 `zh` 抢先归入简体。欢迎轮播、语言选择、根节点 `lang`、动态工作台文案、快捷建议、本地指南、模型配置、空态、专业 review 和经营汇报编译器都读取这一个 locale 身份；Deck frontmatter 也正式接受 `zh-TW`。

繁体不是在 DOM 渲染后做字符串替换。Rune 用固定版本、纯本地的 OpenCC 台湾短语转换从完整简体 typed catalog 生成第三套同形契约，函数返回的数量、文件名和错误建议也在调用后转换；源文件 ID、CSV/JSON 字段、SQL identifier、Chart binding 和用户输入永不经过翻译。繁体经营汇报测试同时证明 `lang: zh-TW`、繁体成品和精确字段 identity 可以共存。以后新增日语、韩语、西语或印尼语时，也必须交付完整 catalog、指南和任务链测试后才能把对应问候放入动画。

视觉上继续学习 Apple 的原则而不是复制外观：首屏只保留一个主决策，原来的三块“本地优先 / 先审后写 / 实时编译”功能徽章被收成一句低噪音信任说明；移除装饰渐变，降低阴影，语言列表使用可滚动的标准选择行。动效仍短、可取消且服从 `prefers-reduced-motion`。这遵循 Apple 对 onboarding 的“短、可选、通过实际操作学习”和对 motion 的“有目的、精确、可减少”原则，同时保留 Rune 的朱砂品牌与 source-first 心智，而不是把界面伪装成 macOS。

## 62. v0.57 旧格式导出必须建立在现代包和真实 Office 之上

Rune 不直接把 Markdown 拼成不可验证的 OLE 二进制，也不通过改后缀制造 DOC/PPT。Document 和 Deck 导出继续先走既有 `canonical source → compiled metrics/charts → deterministic DOCX/PPTX` 端口，冻结当前 Query snapshot 并保留现代包的全部 fidelity warnings；只有在 hydration 后检测到 Rune Desktop 的窄 `exportLegacyOffice` capability，导出菜单才增加 DOC 或 PPT。用户确认的仍是一份完整 `ArtifactExportResult`，旧格式只是一次兼容 handoff，不反向成为 workspace source of truth。

桌面 main process 把现代包写入 0600 的独立临时目录，通过参数数组调用 `/usr/bin/osascript`，让本机 Word 使用 `format document97`、PowerPoint 使用 legacy presentation 格式保存。两条自动化链均强制 `msoAutomationSecurityForceDisable`，输入输出各限 12 MB、转换限 30 秒，成功与失败都递归清理临时目录。renderer 没有 Node 权限；preload 只暴露一次请求/一次结果，没有任意路径、命令或文件系统能力。Web 既不显示旧格式菜单，也不上传或伪造输出；Data 的 `.xls` 没有被顺手扩大进合同。

这条链用真实安装的 Word 和 PowerPoint 验收，而不是只测 AppleScript 字符串。默认 Document 经生产 `exportLegacyOffice` 得到 35,328-byte DOC，再经生产 import bridge 恢复 DOCX 并解析回 Markdown；默认 Deck 得到 69,120-byte PPT，再恢复 PPTX 并解析回 Deck Markdown，两者核心标题与内容均保留。测试同时覆盖 Web 不可用、类型不匹配、空/超限结果、IPC 暴露、宏禁用和 review-before-download。产品仍明确提醒字体、分页、布局、矢量图表、表格、媒体和可访问性可能变化，交付前必须在 Office 中复核。

## 63. v0.58 CC Switch 式配置首先要诚实区分协议

同一个“API Key + Base URL + Model”表单不能证明供应商兼容。[OpenAI Responses](https://platform.openai.com/docs/api-reference/responses) 把 JSON Schema 放在 `text.format`；[OpenAI-compatible Chat Completions](https://platform.openai.com/docs/api-reference/chat) 使用 `response_format.json_schema`；[Anthropic Messages](https://docs.anthropic.com/en/api/messages) 使用 `x-api-key` 与版本头，并可把 schema 作为一个被强制选择的 tool input；[Gemini generateContent](https://ai.google.dev/api/generate-content) 使用 `x-goog-api-key` 与 `generationConfig.responseJsonSchema`。v0.58 因而把 `protocol` 作为每个加密 profile 的显式字段，内置 OpenAI、OpenRouter、Anthropic、Gemini 预设固定到官方协议，自定义端点则要求用户明确选择。既有 profile 在 vault normalization 时按 provider 迁移到固定默认协议，不根据 model 字符串猜测。

四个 adapter 的输出都必须成为同一个 Rune-owned operation schema，而不是各自获得写权限。Responses/Chat/Gemini 的文本先作为 JSON 解析，再由既有 Zod schema验证；Anthropic 只接受名字精确匹配的强制 tool input。之后仍由相同 operation compiler 生成 concrete source、证明 selection/workspace 边界、执行完整 artifact/dependency/runtime gate，并停在 Review。真实 provider token usage 映射为统一 input/output 字段；无法提供时写 null，不估算。

安全边界也跟协议显式化一起收紧：模型目录和生成请求都拒绝 redirect，目录响应限 1 MB、Agent 响应限 2 MB、调用限 60 秒，供应商错误只向前端返回状态而不回显可能含敏感信息的正文。认证头按协议隔离，密钥仍只存在加密 HttpOnly vault 或桌面 Keychain。Rune 不自动把失败任务转发到另一家供应商，因为 fallback 本质上是一次新的数据授权；未来若做故障转移，必须由用户为明确的供应商链和数据范围单独确认。隔离测试与完整 Agent route 测试证明四条 transport 都落回相同 Markdown typed operation 和安全编译器。

## 64. v0.59 视觉转向不是复制 Apple，而是建立 Rune 自己的材料、节奏与颜色层级

Apple 当前产品页仍用大留白、少量清晰动作、内容主导的分区和克制动效建立层级；Rune 学习这些方法，但不复制 Apple 的商标、图片、系统控件或具体页面。工作台从连续灰色工具栏改成云白画布上的四个轻材质区域，弱化分割线与“AI 面板”感；首启页把动图问候、语言决定和模型配置作为依次展开的真实任务。所有过渡都短、可中断，并继续服从 `prefers-reduced-motion`。

颜色分成两种不同职责。朱砂 `#dc4b36` 是 Rune mark，只用于品牌身份和少量 source 信号；用户外观色负责按钮、焦点、选择与环境氛围。首批雾蓝、鼠尾草绿、薰衣草、深蓝、宇宙橙参考当前 iPhone 17、iPhone Air 与 iPhone 17 Pro 的低饱和蓝绿紫和高辨识橙蓝方向，再重新校准为 Rune 自己可访问、适合长时间工作的界面 token。主题只保存枚举 id 到本机，不修改 Artifact、导出文件或工作区事实。

语言注册表现在包含 `zh-CN / zh-TW / en / fr / es / ru / ar / ja / ko`，覆盖联合国六种官方语言并增加日语、韩语。问候动画严格从这个注册表生成，所以每个问候都有真实的语言选择、完整同形 UI contract 和本地指南。简繁转换与六种新增静态目录均在开发期生成并提交，运行时不请求翻译服务；关键 OCR 流程另有人工校对目录。阿拉伯语会把界面切成 RTL，但 Markdown/CSV/JSON/SQL 源、代码、URL、model id 和 API key 始终保持 LTR。机器生成目录仍需母语审校，不把“测试有文本”误报为语言质量已经终结。

## 65. v0.60 左右实时同步也必须允许用户决定当下的注意力比例

固定 47:53 的编辑器会迫使所有任务使用同一种注意力分配：写长文时 source 太窄，检查成品时 preview 又不够大。v0.60 在两个语义 pane 之间加入真正的 `role="separator"`；鼠标或触控笔拖动可在 35%–65% 之间连续调整，左右键以 2% 微调、Shift 加速到 5%，Home 或双击恢复默认。阿拉伯语 RTL 下物理方向与 source 比例的含义保持一致，960px 以下继续使用原来的上下堆叠并隐藏分隔器。

## 66. v0.61 注意力模式是显示状态，不是第二份文档状态

用户写长文、核对成品和做逐段对照时需要不同的画布，但“隐藏一边”不能让同步模型分叉。v0.61 增加 Split、Source、Preview 三种本机持久化视图：Split 保留可调比例，Source 和 Preview 让所选 pane 占满内容区域；窄屏下 Split 仍上下排列，单 pane 模式只保留一层画布。切换只改变 CSS presentation state，源码编辑器、成品编译器、草稿 projection、selection 和 revision 都保持同一棵已挂载的 React 工作区，因此重新显示时不需要复制、恢复或重新解释内容。

定位仍比视觉模式优先。source caret 在 Source 模式产生的精确目标会保留，用户切回 Split/Preview 后成品自动滚到当前 target；在 Preview-only 中点击 section、block、cell、slide 或 Chart provenance 时，Rune 自动切回 Split，再选择、滚动并聚焦精确 canonical range。三态控件使用原生 button、`aria-pressed` 和完整 9-locale label；选择存入独立的 device preference，不进入 artifact、checkpoint、folder manifest、Agent context 或 export。视图是用户注意力偏好，不是事实，也不会扩大任何写能力。

## 67. v0.62 高频注意力切换必须被教会，而不是藏在 tooltip

Split、Source、Preview 如果只能用鼠标点击，就仍然像临时加在工作台上的功能。v0.62 把三态映射为一组稳定、跨平台且不侵占 macOS 截图组合的快捷键：`⌘⌥ 1/2/3` 或 `Ctrl Alt 1/2/3`。键位按物理 `Digit` 识别，不依赖当前输入语言产生的字符；只有没有 review、导入、导出、模型设置或视觉草稿阻塞时才生效，而且 Empty Workspace 不会因按键凭空打开 pane。

首启教程从三个动作扩展为四个，必须亲自按一次视图快捷键才能显示完成；本地说明文档的九种语言也包含同一合同。按钮通过 `aria-keyshortcuts` 告知辅助技术，title 同时显示 macOS 与 Windows/Linux 组合。快捷键仍只调用同一个 presentation-state setter，所以教学和实际产品不是两套模拟逻辑，canonical source、恢复点与写入边界均不受影响。

## 68. v0.63 可信证据不等于把所有证据永久铺在标题栏

成品 header 曾同时显示当前 source target、Data/Query source、legacy/query metric、Chart binding 与 validation 结果。这些状态都是真实的，但同时常驻会把 Rune 拉回工程仪表盘的气质，也让 artifact 名称和成品本身失去主次。v0.63 只保留一个始终可见的 Valid 或 issue count；点击后用原生 `details/summary` 展开完整来源、binding 和 validation badges，键盘与辅助技术无需自定义事件即可访问。

证据只是渐进披露，没有被降级或重新计算。popover 读取的仍是当前 artifact revision、binding compiler 与 validation result；没有新缓存，也不影响 source linking、Agent scope 或写入。Split 模式下三态视图切换缩成可辨识图标，Source/Preview 专注模式仍显示文字，形成“日常对照更轻、单项任务更明确”的层级。RTL、窄屏固定定位和 reduced-motion 都沿用同一视觉合同。

## 69. v0.64 工具栏首先表达产品的任务，而不是功能库存

过去顶部把帮助、主题、模型、创建汇报、新建、导入、文件夹、Pull、Push、导出全部同级排开；功能越完整越像工程控制台。v0.64 常驻保存状态与五个直接任务：创建汇报、新建、导入、导出，加上一个轻量 More Tools。帮助、模型配置、连接文件夹、Pull/Push 和主题色进入同一面板；目录已经连接时仍显示确切目录名，连接、读取与写回仍是三个明确动作。

主题不再弹出第二层菜单，而是在工具面板底部直接呈现五个色点与当前选择；每个选项仍是 `menuitemradio`，拥有 9-locale label。More Tools 与 Export 互斥打开，点击外部或 Escape 都关闭，RTL 与窄屏有明确落点。这里只移动入口，不修改任何 command、permission 或 source transaction；高频任务变得可见，低频工具仍一击可达。

## 70. v0.65 工作区应该像一台工具，而不是五张并排的卡片

活动栏、文件栏、源编辑器、分隔器和成品此前各有独立圆角、边框、阴影与间距，整体像 dashboard widgets。v0.65 在桌面把它们合成一块连续材料：只有最左和最右外缘拥有 18px 圆角，相邻栏去掉重复边线，分隔器本身成为同一表面内可抓取的中缝。Source-only 与 Preview-only 仍让最后可见 pane 接管右外缘，隐藏文件栏不会留下断裂。

连续不等于混淆。文件 rail 保持独立背景层级，source 与 preview 继续有各自 header、滚动和语义 label，separator 的 pointer/keyboard 行为完全不变；960px 以下恢复 8px 间距、完整 16px 圆角与独立阴影，因为上下长页面需要更明确的分区。RTL 只镜像物理外缘，不改变 canonical source 方向或列语义。空态仍保留中央 drop surface，不被强行嵌成编辑 pane。

## 71. v0.66 源类型、恢复点与撤销属于一个版本心智

源码标题过去依次放置 language badge、恢复点数量和独立撤销按钮，用户需要自己理解三者关系。v0.66 合并为一个 Source and Versions 入口：常态显示 source language 与 checkpoint count；展开原有 checkpoint panel 后，同时提供保存当前版本、撤销到最近不同版本和任意历史恢复。没有新增 history store，也没有改变 checkpoint identity、current detection 或 restore transaction。

这个入口仍使用原生 button、`aria-expanded` 和九语言 label；窄屏隐藏 language 与分隔符，只保留 history icon 和数量。撤销按钮并没有因为被收进去而改变禁用条件，视觉草稿时仍不可恢复；保存、恢复和 Agent 写入继续走原来的 checkpoint/persistence 边界。标题栏因此只剩视图、版本和关闭三个任务域，而不是一排相邻但缺少关系的控件。

## 72. v0.67 状态栏应该回答“现在发生什么”，不是常驻工程诊断

状态栏以前同时重复显示 legacy/query/chart binding 数、UTF-8、制品统计和产品版本；其中来源与 binding 已经能在成品证据面板按需查看，编码也不是当前工作区可切换的用户任务。v0.67 因此只保留当前保存、导入或 Agent 操作提示，以及当前制品的字数、行数、行列数或幻灯片数。没有操作时，它安静地承担一条低噪音环境边界，而不是持续展示实现细节。

产品版本仍然可发现，但移动到 More Tools 的底部，并使用九语言 `Version` 标签与固定 `Rune 0.67` 值。该调整没有新增或复制任何状态：操作提示继续来自现有 `visibleNotice`，制品统计继续由当前 source 派生，完整来源与 validation 继续属于 Preview 证据面板。状态栏因此更接近 Apple 式“按任务显露”的层级，同时保持 Rune 对真实来源、错误与当前结果的可验证性。

## 73. v0.68 智能能力应该融入编辑动作，而不是占据一张“机器人卡片”

常驻机器人头像、Assistant 标题、能力说明和整排建议会先让用户看见“AI 产品”，再看见正在编辑的内容。v0.68 移除这层人格化包装，让输入框直接成为 source 画布底部的一层轻工具；只有获得焦点时才用用户所选气质色加强边界。它仍然先准备修改、再进入同一 patch/transaction review，不能绕过 selection、artifact 或 workspace 范围。

范围选择保留为输入框下方的紧凑原生按钮，因为授权边界必须始终可见；模型/本地状态继续诚实显示。快捷建议和 Workspace Query 证据进入原生 `details/summary`，用户需要时一击展开，键盘和辅助技术不依赖自定义弹层。pending patch、runtime preflight、repair 证据与错误仍完整展开，因为它们属于一次正在发生的审核任务，不是装饰。这里只改变信息出现的时机和材料关系，没有减少可验证性或创建第二套 Agent 状态。

这项状态只是一条经验证的本机外观偏好，不进入 Artifact、workspace manifest、checkpoint、folder sync、export 或 Agent context。拖动时暂时关闭 iframe pointer events，避免 Deck preview 抢走 pointer；结束后才持久化，损坏或越界值回到默认。分隔器不改变既有 preview-to-source 与 source-to-preview 的 AST identity、scroll target 或写权限，因此“更灵活”没有制造第二套事实或像素级授权。
