import React from "react";
import { Card, Button, Empty, Modal } from "antd";
import { DeleteOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import { Saving } from "../context/FinanceContext";
import dayjs from "dayjs";
import * as styles from "./SavingsList.module.css";

interface SavingsListProps {
  savings: Saving[];
  selectedMonth: string;
  months: string[];
  onMonthChange: (month: string) => void;
}

const SavingsList: React.FC<SavingsListProps> = ({
  savings,
  selectedMonth,
  months,
  onMonthChange,
}) => {
  const { deleteSaving } = useFinance();

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: "Удалить накопление?",
      content: "Это действие нельзя отменить.",
      okText: "Удалить",
      okType: "danger",
      cancelText: "Отмена",
      onOk: async () => {
        try {
          await deleteSaving(id);
        } catch (error) {
          console.error("Error deleting saving:", error);
        }
      },
    });
  };

  const currentMonthIndex = months.indexOf(selectedMonth);
  const hasPrevMonth = currentMonthIndex < months.length - 1;
  const hasNextMonth = currentMonthIndex > 0;

  const handlePrevMonth = () => {
    if (hasPrevMonth) {
      onMonthChange(months[currentMonthIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    if (hasNextMonth) {
      onMonthChange(months[currentMonthIndex - 1]);
    }
  };

  // Фильтруем накопления по выбранному месяцу
  const filteredSavings = selectedMonth
    ? savings.filter((saving) => {
        const savingDate = new Date(saving.date);
        const savingMonthKey = savingDate.toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        });
        return savingMonthKey === selectedMonth;
      })
    : savings;

  if (filteredSavings.length === 0) {
    return (
      <Card>
        <Empty description="Нет накоплений за этот месяц" />
      </Card>
    );
  }

  return (
    <Card className={styles.savingsCard}>
      <div className={styles.monthSelector}>
        <Button
          icon={<LeftOutlined />}
          onClick={handlePrevMonth}
          disabled={!hasPrevMonth}
          className={styles.monthButton}
        />
        <h3 className={styles.monthTitle}>{selectedMonth}</h3>
        <Button
          icon={<RightOutlined />}
          onClick={handleNextMonth}
          disabled={!hasNextMonth}
          className={styles.monthButton}
        />
      </div>

      <div className={styles.savingsList}>
        {filteredSavings.map((saving) => (
          <div key={saving.id} className={styles.savingItem}>
            <div className={styles.savingContent}>
              <div className={styles.savingHeader}>
                <span className={styles.savingAmount}>
                  +
                  {saving.amount.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {"\u00A0"}₽
                </span>
                <span className={styles.savingDate}>
                  {dayjs(saving.date).format("D MMMM YYYY")}
                </span>
              </div>
              {saving.description && (
                <div className={styles.savingDescription}>
                  {saving.description}
                </div>
              )}
            </div>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(saving.id)}
              className={styles.deleteButton}
            />
          </div>
        ))}
      </div>
    </Card>
  );
};

export default SavingsList;
