export type RuneArtifactCreationMetadata = Readonly<{
  label: string;
  format: string;
  extension: string;
  description: string;
}>;

export type RuneArtifactDetection<Kind extends string> = Readonly<{
  kind: Kind;
  language: string;
}>;

export type RuneArtifactAdapter<Kind extends string, Artifact, StarterRequest> = Readonly<{
  kind: Kind;
  order: number;
  creation: RuneArtifactCreationMetadata;
  quickCommands: readonly string[];
  detectLanguage: (name: string, source: string) => string | null;
  starterSource: (request: StarterRequest) => string;
  validate: (artifact: Artifact) => string[];
  stats: (artifact: Artifact) => string;
}>;

/**
 * Rune's artifact kinds are a closed product vocabulary, not runtime plugins.
 * This registry makes that vocabulary exhaustive and gives every kind one
 * adapter-owned home for detection, creation, validation, and display facts.
 */
export function createRuneArtifactAdapterRegistry<
  Kind extends string,
  Artifact,
  StarterRequest,
>(
  requiredKinds: readonly Kind[],
  definitions: readonly RuneArtifactAdapter<Kind, Artifact, StarterRequest>[],
) {
  if (!requiredKinds.length) throw new Error("Rune requires at least one artifact kind.");

  const required = new Set<Kind>();
  requiredKinds.forEach((kind) => {
    if (required.has(kind)) throw new Error(`Rune artifact kind "${kind}" is required more than once.`);
    required.add(kind);
  });

  const adapters = new Map<Kind, RuneArtifactAdapter<Kind, Artifact, StarterRequest>>();
  const ordered = definitions.map((definition, sequence) => {
    if (!required.has(definition.kind)) {
      throw new Error(`Rune artifact adapter "${definition.kind}" is not a declared kind.`);
    }
    if (adapters.has(definition.kind)) {
      throw new Error(`Rune artifact adapter "${definition.kind}" is registered more than once.`);
    }
    if (!Number.isFinite(definition.order)) {
      throw new Error(`Rune artifact adapter "${definition.kind}" has an invalid order.`);
    }
    if (!definition.creation.extension.startsWith(".")) {
      throw new Error(`Rune artifact adapter "${definition.kind}" needs a dotted extension.`);
    }
    const adapter = Object.freeze({
      ...definition,
      creation: Object.freeze({ ...definition.creation }),
      quickCommands: Object.freeze([...definition.quickCommands]),
    });
    adapters.set(definition.kind, adapter);
    return { adapter, sequence };
  });

  requiredKinds.forEach((kind) => {
    if (!adapters.has(kind)) throw new Error(`Rune artifact adapter "${kind}" is missing.`);
  });

  const snapshot = Object.freeze(
    ordered
      .sort((left, right) => left.adapter.order - right.adapter.order || left.sequence - right.sequence)
      .map(({ adapter }) => adapter),
  );

  function forKind(kind: Kind) {
    const adapter = adapters.get(kind);
    if (!adapter) throw new Error(`Rune artifact adapter "${kind}" is not registered.`);
    return adapter;
  }

  function detect(name: string, source: string): RuneArtifactDetection<Kind> | null {
    for (const adapter of snapshot) {
      const language = adapter.detectLanguage(name, source);
      if (language) return Object.freeze({ kind: adapter.kind, language });
    }
    return null;
  }

  return Object.freeze({
    all: () => snapshot,
    forKind,
    detect,
  });
}
