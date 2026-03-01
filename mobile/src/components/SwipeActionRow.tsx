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
  const rowWidthRef = useRef(0);
  const rowKeyRef = useRef(Symbol("swipe-row"));
  const actionsWidth = onEdit ? 176 : 84;
  const revealTranslate = -actionsWidth;

  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      currentXRef.current = value;
    });
    return () => {
      translateX.removeListener(id);
    };
  }, [translateX]);

  const getFullSwipeTranslate = () => {
    if (!rowWidthRef.current) return revealTranslate - 96;
    return -rowWidthRef.current;
  };

  const getDeleteTriggerTranslate = () => {
    if (!rowWidthRef.current) return revealTranslate - 84;
    // Пользователю не нужно доводить до самого края: ~75-80% ширины свайпа достаточно.
    return getFullSwipeTranslate() + Math.min(96, rowWidthRef.current * 0.24);
  };

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
    animateTo(revealTranslate);
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
          const fullSwipeTranslate = getFullSwipeTranslate();
          const nextValue = startXRef.current + g.dx;
          const clampedX = Math.max(fullSwipeTranslate, Math.min(0, nextValue));
          translateX.setValue(clampedX);
        },
        onPanResponderRelease: (_, g) => {
          const currentX = startXRef.current + g.dx;
          const deleteTriggerTranslate = getDeleteTriggerTranslate();
          const shouldDelete = currentX <= deleteTriggerTranslate;
          const shouldOpen = currentX < revealTranslate / 2 || g.vx < -0.25;

          if (shouldDelete) {
            closeSelf();
            onDelete();
          } else if (shouldOpen) {
            openSelf();
          } else {
            closeSelf();
          }
        },
        onPanResponderTerminate: () => {
          translateX.stopAnimation((value) => {
            currentXRef.current = value;
            if (value < revealTranslate / 2) {
              openSelf();
            } else {
              closeSelf();
            }
          });
        },
      }),
    [revealTranslate, translateX, onDelete]
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
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    actionWrapper: {
      height: "100%",
    },
    editActionBtn: {
      width: 84,
    },
    deleteActionBtn: {
      width: 84,
    },
    editBtn: {
      backgroundColor: theme.accentMutedLight,
    },
    deleteBtn: {
      backgroundColor: theme.expenseLight,
    },
    deleteBtnFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.expense,
    },
    actionContent: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    actionLayer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    actionText: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    actionTextDanger: {
      color: "#fff",
    },
    divider: {
      width: 1,
      height: "100%",
      backgroundColor: theme.bgBase,
      opacity: 0.35,
    },
  });

  const deleteTriggerTranslate = getDeleteTriggerTranslate();
  const deleteReadyProgress = translateX.interpolate({
    inputRange: [deleteTriggerTranslate, revealTranslate],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const deepSwipeProgress = deleteReadyProgress;
  const editPresence = deepSwipeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const animatedEditButtonStyle = onEdit
    ? {
        opacity: editPresence,
        transform: [{ scale: editPresence.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1], extrapolate: "clamp" }) }],
      }
    : undefined;

  const renderRightActions = () => (
    <View style={styles.rightActions}>
      {onEdit && (
        <Animated.View style={[styles.actionWrapper, animatedEditButtonStyle]}>
          <TouchableOpacity style={[styles.actionBtn, styles.editActionBtn, styles.editBtn]} activeOpacity={0.85} onPress={() => closeAndRun(onEdit)}>
            <Ionicons name="create-outline" size={18} color={theme.accentMuted} />
            <Text style={styles.actionText}>Изменить</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      {onEdit && (
        <Animated.View
          style={[
            styles.divider,
            {
              opacity: editPresence,
            },
          ]}
        />
      )}
      <Animated.View style={styles.actionWrapper}>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteActionBtn, styles.deleteBtn]} activeOpacity={0.85} onPress={() => closeAndRun(onDelete)}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.deleteBtnFill,
              {
                opacity: deleteReadyProgress,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.actionContent,
              {
                transform: [
                  {
                    scale: deleteReadyProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.08],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.actionLayer,
                {
                  opacity: deleteReadyProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            >
              <Ionicons name="trash-outline" size={18} color={theme.expense} />
              <Text style={styles.actionText}>Удалить</Text>
            </Animated.View>
            <Animated.View
              style={[styles.actionLayer, { opacity: deleteReadyProgress }]}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={[styles.actionText, styles.actionTextDanger]}>Удалить</Text>
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        rowWidthRef.current = event.nativeEvent.layout.width;
      }}
    >
      {renderRightActions()}
      <Animated.View style={[styles.row, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <Pressable onPress={onPress} style={styles.row} android_ripple={{ color: theme.bgSurface }}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
