import React, { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context";

interface SwipeActionRowProps {
  children: React.ReactNode;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete: () => void;
}

type OpenedRowRef = {
  key: symbol;
  close: () => void;
};

let openedRowRef: OpenedRowRef | null = null;

export default function SwipeActionRow({ children, onPress, onEdit, onDelete }: SwipeActionRowProps) {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const rowKeyRef = useRef(Symbol("swipe-row"));
  const actionsWidth = onEdit ? 176 : 84;
  const maxTranslate = -actionsWidth;

  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      currentXRef.current = value;
    });
    return () => {
      translateX.removeListener(id);
    };
  }, [translateX]);

  const animateTo = (toValue: number) => {
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start(({ finished }) => {
      if (finished) {
        currentXRef.current = toValue;
      }
    });
  };

  const closeSelf = () => {
    animateTo(0);
    if (openedRowRef?.key === rowKeyRef.current) {
      openedRowRef = null;
    }
  };

  const openSelf = () => {
    if (openedRowRef?.key !== rowKeyRef.current) {
      openedRowRef?.close();
    }
    openedRowRef = {
      key: rowKeyRef.current,
      close: closeSelf,
    };
    animateTo(maxTranslate);
  };

  const closeAndRun = (action: () => void) => {
    closeSelf();
    action();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          startXRef.current = currentXRef.current;
          translateX.stopAnimation((value) => {
            startXRef.current = value;
            currentXRef.current = value;
          });
        },
        onPanResponderMove: (_, g) => {
          const nextValue = startXRef.current + g.dx;
          const clampedX = Math.max(maxTranslate, Math.min(0, nextValue));
          translateX.setValue(clampedX);
        },
        onPanResponderRelease: (_, g) => {
          const currentX = startXRef.current + g.dx;
          const shouldOpen = currentX < maxTranslate / 2 || g.vx < -0.25;
          if (shouldOpen) {
            openSelf();
          } else {
            closeSelf();
          }
        },
        onPanResponderTerminate: () => {
          translateX.stopAnimation((value) => {
            currentXRef.current = value;
            if (value < maxTranslate / 2) {
              openSelf();
            } else {
              closeSelf();
            }
          });
        },
      }),
    [maxTranslate, translateX]
  );

  useEffect(() => {
    return () => {
      if (openedRowRef?.key === rowKeyRef.current) {
        openedRowRef = null;
      }
    };
  }, []);

  const styles = StyleSheet.create({
    container: {
      overflow: "hidden",
      borderRadius: theme.radiusLg,
    },
    row: {
      backgroundColor: theme.bgBase,
    },
    rightActions: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "stretch",
      borderRadius: theme.radiusLg,
      overflow: "hidden",
    },
    actionBtn: {
      width: 84,
      justifyContent: "center",
      alignItems: "center",
    },
    editBtn: {
      backgroundColor: theme.accentMutedLight,
    },
    deleteBtn: {
      backgroundColor: theme.expenseLight,
    },
    actionText: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    divider: {
      width: 1,
      backgroundColor: theme.bgBase,
      opacity: 0.35,
    },
  });

  const renderRightActions = () => (
    <View style={styles.rightActions}>
      {onEdit && (
        <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} activeOpacity={0.85} onPress={() => closeAndRun(onEdit)}>
          <Ionicons name="create-outline" size={18} color={theme.accentMuted} />
          <Text style={styles.actionText}>Изменить</Text>
        </TouchableOpacity>
      )}
      {onEdit && <View style={styles.divider} />}
      <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} activeOpacity={0.85} onPress={() => closeAndRun(onDelete)}>
        <Ionicons name="trash-outline" size={18} color={theme.expense} />
        <Text style={styles.actionText}>Удалить</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderRightActions()}
      <Animated.View style={[styles.row, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <Pressable onPress={onPress} style={styles.row} android_ripple={{ color: theme.bgSurface }}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
