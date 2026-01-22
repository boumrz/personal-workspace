import React from "react";
import { Drawer } from "antd";
import { Goal } from "../services/api";
import GoalForm from "./GoalForm";
import * as styles from "./GoalEditDrawer.module.css";

interface GoalEditDrawerProps {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  onSave: (updates: Partial<Goal>) => Promise<void>;
}

const GoalEditDrawer: React.FC<GoalEditDrawerProps> = ({
  open,
  onClose,
  goal,
  onSave,
}) => {
  const handleSubmit = async (updates: Partial<Goal>) => {
    try {
      await onSave(updates);
      onClose();
    } catch (error) {
      throw error;
    }
  };

  return (
    <Drawer
      title="Редактирование цели"
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
      {goal && (
        <GoalForm
          goal={goal}
          onSave={handleSubmit}
          onCancel={onClose}
        />
      )}
    </Drawer>
  );
};

export default GoalEditDrawer;
