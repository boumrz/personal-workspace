import React, { useEffect } from "react";
import { Drawer } from "antd";
import { Goal } from "../store/api";
import GoalForm from "./GoalForm";
import * as styles from "./GoalAddDrawer.module.css";

interface GoalAddDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (goal: Omit<Goal, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

const GoalAddDrawer: React.FC<GoalAddDrawerProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const handleSubmit = async (
    goal: Omit<Goal, "id" | "createdAt" | "updatedAt"> | Partial<Goal>
  ) => {
    const payload: Omit<Goal, "id" | "createdAt" | "updatedAt"> = {
      title: String(goal.title || "").trim(),
      targetAmount: Number(goal.targetAmount || 0),
      currentAmount: Number(goal.currentAmount || 0),
      description: String(goal.description || ""),
    };
    try {
      await onSave(payload);
      onClose();
    } catch (error) {
      throw error;
    }
  };

  return (
      <Drawer
        title="Добавление цели"
        placement="right"
        open={open}
        onClose={onClose}
        width="100%"
        mask={true}
        closable={true}
        styles={{
          wrapper: { width: "100%", maxWidth: "100vw", height: "100dvh" },
          body: {
            overflowY: "auto",
            paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
          },
        }}
      >
      <GoalForm
        onSave={handleSubmit}
        onCancel={onClose}
      />
    </Drawer>
  );
};

export default GoalAddDrawer;

