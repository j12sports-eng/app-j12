import { ExecutiveDashboardContainer } from "../containers";
import type { DashboardBridgeProps } from "./DashboardBridge.types";

/**
 * Boundary between the legacy dashboard runtime and the Command Center.
 * It intentionally forwards props without fetching, calculating or adapting data.
 */
export function DashboardBridge(props: DashboardBridgeProps) {
  const { filterControls, ...bridgeProps } = props;

  return <ExecutiveDashboardContainer {...bridgeProps} filters={filterControls} />;
}
