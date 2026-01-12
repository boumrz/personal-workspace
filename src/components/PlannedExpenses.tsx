import React from "react";
import { List, Card, Empty, Tag, Button, Statistic } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import { Transaction } from "../context/FinanceContext";
import * as styles from "./PlannedExpenses.module.css";

interface PlannedExpensesProps {
  expenses: Transaction[];
}

const PlannedExpenses: React.FC<PlannedExpensesProps> = ({ expenses }) => {
  const { deletePlannedExpense, categories } = useFinance();

  if (expenses.length === 0) {
    return (
      <Empty
        description="Нет планируемых трат"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  const totalPlanned = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className={styles.planned}>
      <Card className={styles.plannedTotal} bordered={false}>
        <Statistic
          title="Запланировано всего"
          value={totalPlanned}
          precision={0}
          suffix="₽"
          formatter={(value) => value?.toLocaleString("ru-RU")}
        />
      </Card>
      <List
        dataSource={expenses}
        renderItem={(expense) => {
          const category = categories.find(
            (c) => c.id === expense.category.id
          ) || expense.category;

          return (
            <List.Item className={styles.listItem}>
              <Card className={styles.expense} bordered={false}>
                <div className={styles.expenseLeft}>
                  <div
                    className={styles.categoryBadge}
                    style={{ backgroundColor: category.color + "20" }}
                  >
                    <span className={styles.categoryIcon}>
                      {category.icon}
                    </span>
                  </div>
                  <div className={styles.expenseInfo}>
                    <div className={styles.expenseDescription}>
                      {expense.description || "Без описания"}
                    </div>
                    <div className={styles.expenseDetails}>
                      <Tag color={category.color}>{category.name}</Tag>
                      <span className={styles.expenseDate}>
                        {new Date(expense.date).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.expenseRight}>
                  <div className={styles.expenseAmount}>
                    {expense.amount.toLocaleString("ru-RU")} ₽
                  </div>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deletePlannedExpense(expense.id)}
                    className={styles.deleteButton}
                  />
                </div>
              </Card>
            </List.Item>
          );
        }}
      />
    </div>
  );
};

export default PlannedExpenses;
