import type { WorkspaceArtifact } from "./workspace.ts";

function artifactNameParts(name: string) {
  const lower = name.toLowerCase();
  const compound = [".deck.md", ".chart.json"].find((extension) => lower.endsWith(extension));
  if (compound) return { stem: name.slice(0, -compound.length), extension: name.slice(-compound.length) };
  const dot = name.lastIndexOf(".");
  return dot > 0 ? { stem: name.slice(0, dot), extension: name.slice(dot) } : { stem: name, extension: "" };
}

export function resolveArtifactConflicts(existing: WorkspaceArtifact[], incoming: WorkspaceArtifact[]) {
  const names = new Set(existing.map((artifact) => artifact.name.normalize("NFKC").toLocaleLowerCase("en-US")));
  const ids = new Set(existing.map((artifact) => artifact.id));
  return incoming.map((artifact) => {
    const parts = artifactNameParts(artifact.name);
    let suffix = 1;
    let name = artifact.name;
    let id = artifact.id;
    while (names.has(name.normalize("NFKC").toLocaleLowerCase("en-US")) || ids.has(id)) {
      suffix += 1;
      name = `${parts.stem}-${suffix}${parts.extension}`;
      id = `${artifact.id}-${suffix}`;
    }
    names.add(name.normalize("NFKC").toLocaleLowerCase("en-US"));
    ids.add(id);
    return { ...artifact, id, name };
  });
}
