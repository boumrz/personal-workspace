import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function HomeScreen() {
  const { user, logout } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Добро пожаловать</Text>
      {user?.name ? (
        <Text style={styles.name}>{user.name}</Text>
      ) : (
        <Text style={styles.name}>{user?.login ?? ""}</Text>
      )}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Выйти</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 24,
  },
  welcome: {
    fontSize: 20,
    color: "#333",
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1976d2",
    marginBottom: 32,
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 16,
    color: "#333",
  },
});
