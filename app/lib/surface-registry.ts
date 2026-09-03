export type OrbitSurfaceKind = "single" | "list";

export type OrbitSurfaceDefinition<SurfaceId extends string> = {
  id: SurfaceId;
  kind: OrbitSurfaceKind;
};

export type OrbitSurfaceContribution<SurfaceId extends string, Value> = {
  id: string;
  surface: SurfaceId;
  order?: number;
  value: Value;
};

export type OrbitSurfaceEntry<Value> = Readonly<{
  id: string;
  order: number;
  value: Value;
}>;

const CONTRIBUTION_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * A small React-free composition seam for Orbit's interface chrome.
 *
 * Surface owners declare cardinality. Features contribute ordered values and
 * receive a disposer, so hot reload, tests, and future desktop modules can
 * remove everything they added without patching the shell.
 */
export function createOrbitSurfaceRegistry<SurfaceId extends string, Value>(
  definitions: readonly OrbitSurfaceDefinition<SurfaceId>[],
) {
  const surfaceKinds = new Map<SurfaceId, OrbitSurfaceKind>();
  const records = new Map<SurfaceId, Array<OrbitSurfaceEntry<Value> & { sequence: number }>>();
  let sequence = 0;

  definitions.forEach((definition) => {
    if (surfaceKinds.has(definition.id)) {
      throw new Error(`Orbit surface "${definition.id}" is declared more than once.`);
    }
    surfaceKinds.set(definition.id, definition.kind);
    records.set(definition.id, []);
  });

  function register(contribution: OrbitSurfaceContribution<SurfaceId, Value>) {
    const kind = surfaceKinds.get(contribution.surface);
    if (!kind) throw new Error(`Orbit surface "${contribution.surface}" is not declared.`);
    if (!CONTRIBUTION_ID_PATTERN.test(contribution.id)) {
      throw new Error(`Orbit surface contribution "${contribution.id}" must use lowercase kebab-case.`);
    }
    const order = contribution.order ?? 0;
    if (!Number.isFinite(order)) {
      throw new Error(`Orbit surface contribution "${contribution.id}" has an invalid order.`);
    }
    const surfaceRecords = records.get(contribution.surface)!;
    if (surfaceRecords.some((entry) => entry.id === contribution.id)) {
      throw new Error(
        `Orbit surface contribution "${contribution.id}" is already registered on "${contribution.surface}".`,
      );
    }
    if (kind === "single" && surfaceRecords.length > 0) {
      throw new Error(`Orbit single surface "${contribution.surface}" already has an occupant.`);
    }

    const entry = Object.freeze({
      id: contribution.id,
      order,
      value: contribution.value,
      sequence: sequence++,
    });
    surfaceRecords.push(entry);
    let live = true;
    return () => {
      if (!live) return;
      live = false;
      const index = surfaceRecords.indexOf(entry);
      if (index >= 0) surfaceRecords.splice(index, 1);
    };
  }

  function entries(surface: SurfaceId): readonly OrbitSurfaceEntry<Value>[] {
    if (!surfaceKinds.has(surface)) throw new Error(`Orbit surface "${surface}" is not declared.`);
    return Object.freeze(
      [...records.get(surface)!]
        .sort((left, right) => left.order - right.order || left.sequence - right.sequence)
        .map(({ id, order, value }) => Object.freeze({ id, order, value })),
    );
  }

  return Object.freeze({ register, entries });
}
