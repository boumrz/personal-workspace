import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

export function navigateToOperations() {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Main", { screen: "Operations" });
  }
}
