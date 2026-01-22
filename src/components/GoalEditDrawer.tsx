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
  // Блокировка скролла страницы при открытии drawer
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
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
      open={open}
      onClose={onClose}
      className={styles.drawer}
      styles={{
        body: { 
          padding: 16, 
          overflow: "auto",
          maxHeight: "calc(85vh - 55px)",
          WebkitOverflowScrolling: "touch",
        },
        content: { 
          borderRadius: "16px 16px 0 0",
          height: "85vh",
        },
        wrapper: { 
          borderRadius: "16px 16px 0 0",
          height: "85vh",
        },
        header: { 
          borderRadius: "16px 16px 0 0",
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "#fff",
        },
      }}
      mask={true}
      closable={true}
      getContainer={false}
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
