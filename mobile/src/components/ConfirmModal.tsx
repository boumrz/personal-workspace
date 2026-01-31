import React, { useMemo } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from "react-native";
import { useTheme } from "../context";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Удалить",
  cancelText = "Отмена",
  onConfirm,
  onCancel,
  destructive = true,
}: ConfirmModalProps) {
  const { theme } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
    container: { backgroundColor: theme.bgCard, borderRadius: theme.radiusXl, padding: 24, width: "100%", maxWidth: 320, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    title: { fontSize: 18, fontWeight: "600", color: theme.textPrimary, marginBottom: 8, textAlign: "center" },
    message: { fontSize: 15, color: theme.textSecondary, marginBottom: 24, textAlign: "center", lineHeight: 22 },
    buttons: { flexDirection: "row", gap: 12 },
    button: { flex: 1, paddingVertical: 12, borderRadius: theme.radiusMd, alignItems: "center", justifyContent: "center" },
    cancelBtn: { backgroundColor: theme.bgSurface, borderWidth: 1, borderColor: theme.border },
    confirmBtn: { backgroundColor: theme.expense },
    confirmBtnNormal: { backgroundColor: theme.accentMuted },
    cancelText: { fontSize: 15, fontWeight: "500", color: theme.textPrimary },
    confirmText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  }), [theme]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
              <View style={styles.buttons}>
                <TouchableOpacity style={[styles.button, styles.cancelBtn]} onPress={onCancel}>
                  <Text style={styles.cancelText}>{cancelText}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, destructive ? styles.confirmBtn : styles.confirmBtnNormal]} onPress={onConfirm}>
                  <Text style={styles.confirmText}>{confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
