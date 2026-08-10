import Papa from "papaparse";

export type ArtifactKind = "document" | "data" | "slides";

export type WorkspaceArtifact = {
  id: string;
  name: string;
  kind: ArtifactKind;
  language: string;
  source: string;
};

export type DataCell = string | number | boolean | null;

export type ParsedData = {
  columns: string[];
  rows: Array<Record<string, DataCell>>;
  errors: string[];
  format: "CSV" | "JSON";
};

export type LocalPlan = {
  nextSource: string;
  summary: string;
  detail: string;
};

const documentSource = `# Q2 Business Review

> **Live source** · Updated from the same workspace as the data and board deck.

## Executive summary

Revenue reached **{{ metric("total_revenue") }}**, up **{{ metric("qoq_growth") }} quarter over quarter**. **{{ metric("top_region") }}** led growth while gross margin reached **{{ metric("gross_margin") }}**.

## What changed

- The leading region contributed {{ metric("region.apac.revenue") }} after the partner launch.
- Gross margin improved 2.8 points as infrastructure costs normalized.
- Enterprise retention held above 96%.

## Decisions

| Decision | Owner | Due |
| --- | --- | --- |
| Expand APAC partner program | Growth | Aug 22 |
| Reprice legacy startup tier | Finance | Sep 05 |

## Next actions

- [ ] Validate the Q3 pipeline assumptions.
- [ ] Turn the findings into a six-slide board narrative.
`;

const dataSource = `Region,Q2 Revenue,Q1 Revenue,Cost,Customers
APAC,1840000,1540000,1120000,148
North America,1560000,1490000,1010000,121
Europe,970000,920000,690000,84
LATAM,450000,340000,315000,39`;

const slidesSource = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { --ink: #18211c; --muted: #627068; --paper: #f4f1e8; --accent: #ff5c35; --line: #d8d4c8; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #dad7cf; color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    .deck { display: grid; gap: 32px; padding: 32px; }
    .slide { position: relative; width: min(1120px, 100%); aspect-ratio: 16 / 9; margin: auto; padding: 8%; overflow: hidden; background: var(--paper); border-radius: 10px; box-shadow: 0 18px 50px rgba(24,33,28,.14); }
    .eyebrow { margin: 0 0 20px; color: var(--accent); font-size: 15px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1 { max-width: 850px; margin: 0; font-size: clamp(42px, 6vw, 82px); line-height: .98; letter-spacing: -.055em; }
    h2 { margin: 0 0 28px; font-size: clamp(34px, 4.2vw, 64px); line-height: 1; letter-spacing: -.045em; }
    .lede { max-width: 690px; margin-top: 28px; color: var(--muted); font-size: clamp(18px, 2vw, 28px); line-height: 1.45; }
    .number { position: absolute; right: 7%; bottom: 6%; color: var(--muted); font-size: 14px; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 42px; }
    .metric { padding: 26px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,.38); }
    .metric strong { display: block; font-size: clamp(28px, 4vw, 54px); letter-spacing: -.05em; }
    .metric span { color: var(--muted); font-size: 14px; }
    .split { display: grid; grid-template-columns: 1.1fr .9fr; gap: 7%; align-items: center; height: 100%; }
    .bars { display: grid; gap: 16px; }
    .bar { display: grid; grid-template-columns: 112px 1fr 52px; gap: 12px; align-items: center; color: var(--muted); }
    .track { height: 12px; overflow: hidden; border-radius: 999px; background: var(--line); }
    .fill { height: 100%; border-radius: inherit; background: var(--accent); }
    @media (max-width: 700px) { .metric-grid { gap: 8px; } .metric { padding: 14px; } .slide { border-radius: 4px; } }
  </style>
</head>
<body>
  <main class="deck">
    <section class="slide" data-layout="cover">
      <p class="eyebrow">Q2 · Board Briefing</p>
      <h1>Growth became more durable.</h1>
      <p class="lede">A shared story compiled from the same source as the operating data and written report.</p>
      <span class="number">01 / 03</span>
    </section>
    <section class="slide" data-layout="metrics">
      <p class="eyebrow">The quarter at a glance</p>
      <h2>Momentum with healthier economics.</h2>
      <div class="metric-grid">
        <div class="metric"><strong>{{ metric("total_revenue") }}</strong><span>Q2 revenue</span></div>
        <div class="metric"><strong>{{ metric("qoq_growth") }}</strong><span>Quarter over quarter</span></div>
        <div class="metric"><strong>{{ metric("gross_margin") }}</strong><span>Gross margin</span></div>
      </div>
      <span class="number">02 / 03</span>
    </section>
    <section class="slide" data-layout="split">
      <div class="split">
        <div><p class="eyebrow">Regional signal</p><h2>{{ metric("top_region") }} is now the growth engine.</h2><p class="lede">Partner distribution created a repeatable acquisition channel.</p></div>
        <div class="bars">
          <div class="bar"><span>APAC</span><div class="track"><div class="fill" style="width:100%"></div></div><b>{{ metric("region.apac.revenue") }}</b></div>
          <div class="bar"><span>N. America</span><div class="track"><div class="fill" style="width:85%"></div></div><b>{{ metric("region.north_america.revenue") }}</b></div>
          <div class="bar"><span>Europe</span><div class="track"><div class="fill" style="width:53%"></div></div><b>{{ metric("region.europe.revenue") }}</b></div>
          <div class="bar"><span>LATAM</span><div class="track"><div class="fill" style="width:24%"></div></div><b>{{ metric("region.latam.revenue") }}</b></div>
        </div>
      </div>
      <span class="number">03 / 03</span>
    </section>
  </main>
</body>
</html>`;

export const defaultArtifacts: WorkspaceArtifact[] = [
  {
    id: "q2-review",
    name: "q2-review.md",
    kind: "document",
    language: "Markdown",
    source: documentSource,
  },
  {
    id: "regional-revenue",
    name: "regional-revenue.csv",
    kind: "data",
    language: "CSV / JSON",
    source: dataSource,
  },
  {
    id: "board-briefing",
    name: "board-briefing.html",
    kind: "slides",
    language: "Semantic HTML",
    source: slidesSource,
  },
];

export const quickCommands: Record<ArtifactKind, string[]> = {
  document: ["把摘要压缩成三条要点", "补充下一步行动"],
  data: ["按收入从高到低排序", "增加利润率列"],
  slides: ["把主题改成深色", "新增一页结论"],
};

export function cloneDefaultArtifacts(): WorkspaceArtifact[] {
  return defaultArtifacts.map((artifact) => ({ ...artifact }));
}

function normalizeJsonRows(value: unknown): Array<Record<string, DataCell>> {
  const items = Array.isArray(value) ? value : [value];
  return items.map((item, index) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item).map(([key, cell]) => [
          key,
          cell === null || ["string", "number", "boolean"].includes(typeof cell)
            ? (cell as DataCell)
            : JSON.stringify(cell),
        ]),
      );
    }
    return { row: index + 1, value: item == null ? null : String(item) };
  });
}

export function parseDataSource(source: string): ParsedData {
  const trimmed = source.trim();
  if (!trimmed) {
    return { columns: [], rows: [], errors: ["Add CSV or JSON to create a data view."], format: "CSV" };
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const rows = normalizeJsonRows(JSON.parse(trimmed));
      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
      return { columns, rows, errors: [], format: "JSON" };
    } catch (error) {
      return {
        columns: [],
        rows: [],
        errors: [error instanceof Error ? error.message : "Invalid JSON."],
        format: "JSON",
      };
    }
  }

  const result = Papa.parse<Record<string, DataCell>>(source, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
  });
  const columns = result.meta.fields ?? [];
  return {
    columns,
    rows: result.data,
    errors: result.errors.map((error) => `Row ${error.row ?? "?"}: ${error.message}`),
    format: "CSV",
  };
}

export function validateArtifact(artifact: WorkspaceArtifact): string[] {
  if (!artifact.source.trim()) return ["The source is empty."];
  if (artifact.kind === "data") return parseDataSource(artifact.source).errors;
  if (artifact.kind === "slides") {
    const errors: string[] = [];
    if (!/<main[\s>]/i.test(artifact.source)) errors.push("Slides need a <main> element.");
    if (!/<section[\s>]/i.test(artifact.source)) errors.push("Add at least one <section> slide.");
    if (/<script[\s>]/i.test(artifact.source)) errors.push("Scripts are blocked in the slide preview.");
    return errors;
  }
  return [];
}

export function artifactStats(artifact: WorkspaceArtifact): string {
  if (artifact.kind === "data") {
    const parsed = parseDataSource(artifact.source);
    return `${parsed.rows.length} rows · ${parsed.columns.length} columns`;
  }
  if (artifact.kind === "slides") {
    const slides = artifact.source.match(/<section[\s>]/gi)?.length ?? 0;
    return `${slides} slides · ${artifact.source.length.toLocaleString()} chars`;
  }
  const words = artifact.source.trim() ? artifact.source.trim().split(/\s+/).length : 0;
  return `${words} words · ${artifact.source.split("\n").length} lines`;
}

function insertAfterTitle(source: string, block: string): string {
  const title = source.match(/^# .+$/m);
  if (!title || title.index == null) return `${block}\n\n${source}`;
  const end = title.index + title[0].length;
  return `${source.slice(0, end)}\n\n${block}${source.slice(end)}`;
}

function planDocument(source: string, prompt: string): LocalPlan {
  if (/三条|要点|summary|摘要/i.test(prompt)) {
    const block = `## Executive summary\n\n- Revenue reached **{{ metric("total_revenue") }}**, with **{{ metric("qoq_growth") }}** quarter-over-quarter growth.\n- **{{ metric("top_region") }}** became the leading growth engine after the partner launch.\n- Gross margin reached **{{ metric("gross_margin") }}**, increasing confidence in Q3.`;
    const pattern = /## Executive summary[\s\S]*?(?=\n## |$)/i;
    return {
      nextSource: pattern.test(source) ? source.replace(pattern, block) : insertAfterTitle(source, block),
      summary: "Rewrite the executive summary as three decision-ready points",
      detail: "One section will be replaced; the rest of the document stays untouched.",
    };
  }

  if (/行动|next action|todo|下一步/i.test(prompt)) {
    const actions = `## Next actions\n\n- [ ] Validate Q3 pipeline assumptions with Sales.\n- [ ] Confirm APAC partner capacity before the next board update.\n- [ ] Publish a single metric definition for revenue and margin.`;
    const pattern = /## Next actions[\s\S]*?(?=\n## |$)/i;
    return {
      nextSource: pattern.test(source) ? source.replace(pattern, actions) : `${source.trim()}\n\n${actions}\n`,
      summary: "Turn the analysis into owned next actions",
      detail: "The Next actions section will be created or replaced.",
    };
  }

  return {
    nextSource: `${source.trim()}\n\n> **Agent note** · ${prompt.trim()}\n`,
    summary: "Add the instruction as an explicit review note",
    detail: "The local planner only performs deterministic edits; a model provider can replace this planner later.",
  };
}

function planData(source: string, prompt: string): LocalPlan {
  const parsed = parseDataSource(source);
  if (parsed.errors.length || !parsed.columns.length) {
    throw new Error(parsed.errors[0] ?? "The data could not be parsed.");
  }
  if (parsed.format !== "CSV") {
    throw new Error("The local data actions currently modify CSV; JSON preview remains fully supported.");
  }

  const revenueColumn = parsed.columns.find((column) => /q2.*revenue|revenue|收入/i.test(column));
  const costColumn = parsed.columns.find((column) => /cost|成本/i.test(column));

  if (/排序|sort|高到低|descending/i.test(prompt)) {
    if (!revenueColumn) throw new Error("No revenue column was found for sorting.");
    const rows = [...parsed.rows].sort(
      (left, right) => Number(right[revenueColumn] ?? 0) - Number(left[revenueColumn] ?? 0),
    );
    return {
      nextSource: Papa.unparse(rows, { columns: parsed.columns }),
      summary: `Sort all rows by ${revenueColumn}`,
      detail: "Headers and row values remain intact; only row order changes.",
    };
  }

  if (/利润率|margin|profit/i.test(prompt)) {
    if (!revenueColumn || !costColumn) throw new Error("Revenue and cost columns are required.");
    const rows = parsed.rows.map((row) => {
      const revenue = Number(row[revenueColumn] ?? 0);
      const cost = Number(row[costColumn] ?? 0);
      const margin = revenue ? `${(((revenue - cost) / revenue) * 100).toFixed(1)}%` : "0.0%";
      return { ...row, Margin: margin };
    });
    const columns = [...parsed.columns.filter((column) => column !== "Margin"), "Margin"];
    return {
      nextSource: Papa.unparse(rows, { columns }),
      summary: "Add a deterministic gross-margin column",
      detail: `Margin is calculated from ${revenueColumn} and ${costColumn} for every row.`,
    };
  }

  throw new Error("Try sorting by revenue or adding a margin column in this local prototype.");
}

function planSlides(source: string, prompt: string): LocalPlan {
  if (/深色|dark|night/i.test(prompt)) {
    const themed = source
      .replace(/--ink:\s*#[0-9a-f]{3,8}/i, "--ink: #f5f1e8")
      .replace(/--muted:\s*#[0-9a-f]{3,8}/i, "--muted: #a9b5ad")
      .replace(/--paper:\s*#[0-9a-f]{3,8}/i, "--paper: #17201b")
      .replace(/--line:\s*#[0-9a-f]{3,8}/i, "--line: #344139")
      .replace(/background:\s*#dad7cf/i, "background: #0d120f");
    return {
      nextSource: themed,
      summary: "Switch the deck to the Rune night theme",
      detail: "Only shared design tokens and the stage background change.",
    };
  }

  if (/结论|conclusion|summary slide|新增.*页/i.test(prompt)) {
    const slideCount = (source.match(/<section[\s>]/gi)?.length ?? 0) + 1;
    const conclusion = `    <section class="slide" data-layout="conclusion">\n      <p class="eyebrow">Decision</p>\n      <h2>Scale the repeatable channel, protect the margin.</h2>\n      <p class="lede">Fund APAC partner growth while standardizing the revenue model used by every artifact.</p>\n      <span class="number">0${slideCount} / 0${slideCount}</span>\n    </section>\n`;
    return {
      nextSource: source.replace(/\s*<\/main>/i, `\n${conclusion}  </main>`),
      summary: "Add a decision-led conclusion slide",
      detail: "A semantic section is inserted before the deck closes.",
    };
  }

  throw new Error("Try changing the theme to dark or adding a conclusion slide.");
}

export function planLocalChange(artifact: WorkspaceArtifact, prompt: string): LocalPlan {
  if (!prompt.trim()) throw new Error("Describe the change you want Rune to make.");
  if (artifact.kind === "document") return planDocument(artifact.source, prompt);
  if (artifact.kind === "data") return planData(artifact.source, prompt);
  return planSlides(artifact.source, prompt);
}

export function detectArtifact(name: string, source: string): WorkspaceArtifact | null {
  const extension = name.split(".").pop()?.toLowerCase();
  const common = { id: `import-${Date.now()}`, name, source };
  if (extension === "md" || extension === "markdown") {
    return { ...common, kind: "document", language: "Markdown" };
  }
  if (extension === "csv" || extension === "json") {
    return { ...common, kind: "data", language: extension === "json" ? "JSON" : "CSV" };
  }
  if (extension === "html" || extension === "htm") {
    return { ...common, kind: "slides", language: "Semantic HTML" };
  }
  return null;
}
