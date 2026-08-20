import { prepareWorkspaceImportReview, type PreparedWorkspaceImportReview } from "./imports.ts";
import { convertSemanticHtmlPresentationToDeck } from "./semantic-html-presentation-export.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

const EDITABLE_COPY_WARNING =
  "Rune will add an independent editable Deck Markdown copy. The original semantic HTML remains unchanged; later edits do not synchronize between the two artifacts.";

export function prepareSemanticHtmlEditableCopy(
  workspace: WorkspaceArtifact[],
  sourceArtifact: WorkspaceArtifact,
): PreparedWorkspaceImportReview {
  const current = workspace.find((artifact) => artifact.id === sourceArtifact.id);
  if (
    !current ||
    current !== sourceArtifact ||
    current.name !== sourceArtifact.name ||
    current.kind !== sourceArtifact.kind ||
    current.language !== sourceArtifact.language ||
    current.source !== sourceArtifact.source
  ) {
    return {
      review: null,
      errors: ["The semantic HTML source changed before Rune could prepare an editable copy."],
    };
  }
  try {
    const conversion = convertSemanticHtmlPresentationToDeck(sourceArtifact);
    return prepareWorkspaceImportReview(
      workspace,
      [{ ...conversion.artifact }],
      sourceArtifact.name,
      [EDITABLE_COPY_WARNING, ...conversion.warnings],
      [],
      "editable-copy",
    );
  } catch (error) {
    return {
      review: null,
      errors: [error instanceof Error ? error.message : "Rune could not prepare an editable presentation copy."],
    };
  }
}
