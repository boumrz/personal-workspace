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
  const handleSubmit = async (goal: Omit<Goal, "id" | "createdAt" | "updatedAt">) => {
    try {
      await onSave(goal);
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
        styles={{ wrapper: { width: "100%", maxWidth: "100vw" } }}
      >
      <GoalForm
        onSave={handleSubmit}
        onCancel={onClose}
      />
    </Drawer>
  );
};

export default GoalAddDrawer;
