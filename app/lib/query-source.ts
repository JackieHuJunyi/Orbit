export type QuerySourceArtifactLike = {
  id: string;
  name: string;
  kind: string;
  source: string;
};

export type QueryDataSourceDirective = {
  artifactId?: string;
  explicit: boolean;
  errors: string[];
};

export type QueryDataSourceResolution<T extends QuerySourceArtifactLike = QuerySourceArtifactLike> =
  QueryDataSourceDirective & {
    artifact?: T;
  };

const QUERY_DATA_DIRECTIVE_PREFIX = "-- rune:data";
const MAX_QUERY_DATA_ARTIFACT_ID_CHARS = 120;

function validArtifactId(value: string) {
  return value.length > 0 && value.length <= MAX_QUERY_DATA_ARTIFACT_ID_CHARS && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function formatQueryDataSourceDirective(artifactId: string) {
  if (!validArtifactId(artifactId)) throw new Error("A Query Data source id must be 1–120 visible characters.");
  return `${QUERY_DATA_DIRECTIVE_PREFIX} ${JSON.stringify(artifactId)}`;
}

export function parseQueryDataSourceDirective(source: string): QueryDataSourceDirective {
  const lines = source.split(/\r?\n/u);
  const directiveLines = lines.flatMap((line, index) => (/^\s*--\s*rune:data\b/iu.test(line) ? [{ line, index }] : []));
  if (!directiveLines.length) return { explicit: false, errors: [] };
  if (directiveLines.length > 1) {
    return { explicit: true, errors: ["A Query can declare only one -- rune:data source."] };
  }

  const directive = directiveLines[0];
  const firstContentLine = lines.findIndex((line) => Boolean(line.trim()));
  if (directive.index !== firstContentLine) {
    return { explicit: true, errors: ["Put -- rune:data on the first non-empty Query line."] };
  }
  const match = directive.line.match(/^\s*--\s*rune:data\s+(.+?)\s*$/iu);
  if (!match) {
    return { explicit: true, errors: ['Use -- rune:data "artifact-id" to bind workspace_data.'] };
  }

  let artifactId: unknown;
  try {
    artifactId = JSON.parse(match[1]);
  } catch {
    return { explicit: true, errors: ['Use a quoted artifact id: -- rune:data "artifact-id".'] };
  }
  if (typeof artifactId !== "string" || !validArtifactId(artifactId)) {
    return { explicit: true, errors: ["A Query Data source id must be a quoted 1–120 character string."] };
  }
  return { artifactId, explicit: true, errors: [] };
}

export function resolveQueryDataArtifact<T extends QuerySourceArtifactLike>(
  queryArtifact: QuerySourceArtifactLike,
  artifacts: T[],
): QueryDataSourceResolution<T> {
  if (queryArtifact.kind !== "query") {
    return { explicit: false, errors: ["Choose a Query artifact before resolving workspace_data."] };
  }
  const directive = parseQueryDataSourceDirective(queryArtifact.source);
  if (directive.errors.length) return directive;
  if (!directive.explicit) {
    const artifact = artifacts.find((candidate) => candidate.kind === "data");
    return artifact
      ? { ...directive, artifact }
      : { ...directive, errors: ["Add a CSV or JSON artifact before running SQL."] };
  }

  const target = artifacts.find((candidate) => candidate.id === directive.artifactId);
  if (!target) {
    return { ...directive, errors: [`Query Data source not found: ${directive.artifactId}`] };
  }
  if (target.kind !== "data") {
    return { ...directive, errors: [`Query Data source must reference a Data artifact: ${directive.artifactId}`] };
  }
  return { ...directive, artifact: target };
}
