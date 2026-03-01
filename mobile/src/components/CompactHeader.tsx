import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { useTheme } from "../context";

const HEADER_HEIGHT = 44;
const STATUS_BAR_HEIGHT =
  Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 0;

export default function CompactHeader({
  options,
  navigation,
  back,
}: NativeStackHeaderProps) {
  const { theme } = useTheme();
  const title =
    typeof options.headerTitle === "string"
      ? options.headerTitle
      : (options.title ?? "");

  const canGoBack = back !== undefined;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: options.headerStyle?.backgroundColor ?? theme.bgCard,
          paddingTop: STATUS_BAR_HEIGHT,
          height: HEADER_HEIGHT + STATUS_BAR_HEIGHT,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={styles.content}>
        {canGoBack && (
          <TouchableOpacity
            onPress={navigation.goBack}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.backText,
                { color: options.headerTintColor ?? theme.accent },
              ]}
            >
              ‹
            </Text>
          </TouchableOpacity>
        )}

        <Text
          style={[
            styles.title,
            { color: options.headerTintColor ?? theme.textPrimary },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        <View style={styles.right}>
          {options.headerRight?.({
            canGoBack,
            tintColor: options.headerTintColor ?? theme.textPrimary,
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  title: {
    flex: 1,
    textAlign: "left",
    fontSize: 16,
    fontWeight: "600",
  },
  right: {
    marginLeft: 12,
    alignItems: "flex-end",
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  backText: {
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 30,
  },
});
