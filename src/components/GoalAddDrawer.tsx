import React from "react";
import { Drawer } from "antd";
import { Goal } from "../services/api";
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
      placement="bottom"
      height="100vh"
      open={open}
      onClose={onClose}
      className={styles.drawer}
      styles={{
        body: { padding: 16, overflow: "auto" },
        content: { borderRadius: "16px 16px 0 0" },
        wrapper: { borderRadius: "16px 16px 0 0" },
        header: { borderRadius: "16px 16px 0 0" },
      }}
      mask={true}
      closable={true}
    >
      <GoalForm
        onSave={handleSubmit}
        onCancel={onClose}
      />
    </Drawer>
  );
};

export default GoalAddDrawer;
