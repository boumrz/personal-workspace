import React, { useState, useEffect, useMemo } from "react";
import { Input, FloatButton, Button, Modal } from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  WalletOutlined,
  PieChartOutlined,
  RiseOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import SavingsForm from "../components/SavingsForm";
import PageHeader from "../components/PageHeader";
import * as styles from "./SavingsPage.module.css";
import dayjs from "dayjs";
import "dayjs/locale/ru";

dayjs.locale("ru");

const SavingsPage: React.FC = () => {
  const { savings, transactions, deleteSaving } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Общая сумма накоплений
  const totalSavings = useMemo(() => {
    return savings.reduce((sum, saving) => sum + saving.amount, 0);
  }, [savings]);

  // Общая сумма доходов
  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Общая сумма расходов
  const totalExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Общий баланс
  const totalBalance = useMemo(() => {
    return totalIncome - totalExpenses;
  }, [totalIncome, totalExpenses]);

  // Процент от дохода
  const savingsPercentage = useMemo(() => {
    if (totalIncome === 0) return 0;
    return (totalSavings / totalIncome) * 100;
  }, [totalSavings, totalIncome]);

  // Фильтрация накоплений
  const filteredSavings = useMemo(() => {
    if (!searchQuery.trim()) return savings;
    const query = searchQuery.toLowerCase();
    return savings.filter((s) =>
      s.description?.toLowerCase().includes(query)
    );
  }, [savings, searchQuery]);

  // Группировка по дате
  const groupedByDate = useMemo(() => {
    const grouped: Record<
      string,
      { savings: typeof savings; totalAmount: number }
    > = {};

    const sorted = [...filteredSavings].sort(
      (a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()
    );

    sorted.forEach((saving) => {
      const dateKey = saving.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = { savings: [], totalAmount: 0 };
      }
      grouped[dateKey].savings.push(saving);
      grouped[dateKey].totalAmount += saving.amount;
    });

    return grouped;
  }, [filteredSavings]);

  const sortedDates = Object.keys(groupedByDate).sort(
    (a, b) => dayjs(b).valueOf() - dayjs(a).valueOf()
  );

  const formatDate = (dateStr: string) => {
    const date = dayjs(dateStr);
    const today = dayjs();
    const yesterday = today.subtract(1, "day");

    if (date.isSame(today, "day")) {
      return "Сегодня";
    }
    if (date.isSame(yesterday, "day")) {
      return "Вчера";
    }
    return date.format("D MMMM, YYYY");
  };

  const formatTime = (dateStr: string) => {
    return dayjs(dateStr).format("H:mm");
  };

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

  return (
    <div className={styles.savingsPage}>
      <PageHeader title="Накопления" />

      <div className={styles.container}>
        {/* Карточки статистики */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <WalletOutlined />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Баланс</span>
              <span
                className={`${styles.statValue} ${
                  totalBalance >= 0 ? styles.statPositive : styles.statNegative
                }`}
              >
                ₽{totalBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
              <RiseOutlined />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Накоплено</span>
              <span className={`${styles.statValue} ${styles.statPositive}`}>
                ₽{totalSavings.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
              <PercentageOutlined />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>% от дохода</span>
              <span className={styles.statValue}>
                {savingsPercentage.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconPurple}`}>
              <PieChartOutlined />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Записей</span>
              <span className={styles.statValue}>{savings.length}</span>
            </div>
          </div>
        </div>

        {/* Поиск */}
        <div className={styles.searchContainer}>
          <Input
            placeholder="Поиск по описанию"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            allowClear
          />
          <button className={styles.searchBtn}>
            <SearchOutlined />
          </button>
        </div>

        {/* Список накоплений */}
        <div className={styles.savingsList}>
          {sortedDates.length === 0 ? (
            <div className={styles.emptyState}>
              {searchQuery ? "Ничего не найдено" : "Нет накоплений"}
            </div>
          ) : (
            sortedDates.map((dateKey) => {
              const { savings: daySavings, totalAmount } = groupedByDate[dateKey];
              return (
                <div key={dateKey} className={styles.dateGroup}>
                  <div className={styles.dateHeader}>
                    <span className={styles.dateLabel}>{formatDate(dateKey)}</span>
                    <div className={styles.dateBalance}>
                      + ₽{totalAmount.toLocaleString("ru-RU", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  {daySavings.map((saving) => (
                    <div key={saving.id} className={styles.savingItem}>
                      <div className={styles.savingIcon}>
                        <WalletOutlined />
                      </div>

                      <div className={styles.savingInfo}>
                        <span className={styles.savingName}>
                          {saving.description || "Накопление"}
                        </span>
                        <div className={styles.savingMeta}>
                          <span className={styles.savingTag}>Сбережение</span>
                        </div>
                      </div>

                      <div className={styles.savingRight}>
                        <span className={styles.savingAmount}>
                          + ₽{saving.amount.toLocaleString("ru-RU", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span className={styles.savingTime}>
                          {formatTime(saving.date)}
                        </span>
                      </div>

                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(saving.id)}
                      >
                        <DeleteOutlined />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Кнопка добавления накопления */}
      {isMobile ? (
        <FloatButton
          icon={<PlusOutlined />}
          type="primary"
          onClick={() => setShowForm(true)}
          className={styles.addButtonMobile}
        />
      ) : (
        <div className={styles.addButtonContainer}>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setShowForm(true)}
            className={styles.addButtonDesktop}
          >
            Добавить накопление
          </Button>
        </div>
      )}

      {showForm && (
        <SavingsForm open={showForm} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
};

export default SavingsPage;
