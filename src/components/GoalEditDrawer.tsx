import React, { useEffect } from "react";
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
      placement="right"
      open={open}
      onClose={onClose}
      width={400}
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
