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
