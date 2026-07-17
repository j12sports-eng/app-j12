import type { ComponentType } from "react";

export type PreviewReloadHandler = () => Promise<unknown> | unknown;

export type CommandCenterPreviewDefinition<TId extends string = string> = {
  component: ComponentType;
  id: TId;
  title: string;
};
