import React, { useEffect } from "react";
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
      <GoalForm
        onSave={handleSubmit}
        onCancel={onClose}
      />
    </Drawer>
  );
};

export default GoalAddDrawer;
