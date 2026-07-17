import type { CommandCenterPreviewDefinition } from "./types";

export function createCommandCenterPreviewRegistry<
  const TDefinitions extends readonly CommandCenterPreviewDefinition[],
>(definitions: TDefinitions) {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  return Object.freeze({
    get(id: TDefinitions[number]["id"]) {
      return byId.get(id);
    },
    list() {
      return definitions;
    },
  });
}
