import React, { useState, useEffect, useMemo } from "react";
import { Input, FloatButton, Button, Badge, Popconfirm, Segmented } from "antd";
import {
  PlusOutlined,
  FilterOutlined,
  SearchOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import TransactionForm from "../components/TransactionForm";
import CategoryFilter from "../components/CategoryFilter";
import PageHeader from "../components/PageHeader";
import IconRenderer from "../components/IconRenderer";
import * as styles from "./TransactionsPage.module.css";
import dayjs from "dayjs";
import "dayjs/locale/ru";

dayjs.locale("ru");

type TabType = "actual" | "planned";

const TransactionsPage: React.FC = () => {
  const { transactions, plannedExpenses, categories, deleteTransaction, deletePlannedExpense } = useFinance();
  const [activeTab, setActiveTab] = useState<TabType>("actual");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["all"]);
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Данные в зависимости от активного таба
  const currentData = activeTab === "actual" ? transactions : plannedExpenses;

  // Фильтрация транзакций
  const filteredTransactions = useMemo(() => {
    let filtered = currentData;

    // Фильтр по категориям
    if (selectedCategories.length > 0 && !selectedCategories.includes("all")) {
      filtered = filtered.filter((t) =>
        selectedCategories.includes(t.category.id)
      );
    }

    // Поиск
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description?.toLowerCase().includes(query) ||
          t.category.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [currentData, selectedCategories, searchQuery]);

  // Группировка по дате
  const groupedByDate = useMemo(() => {
    const grouped: Record<
      string,
      { transactions: typeof transactions; totalBalance: number }
    > = {};

    // Сортируем транзакции по дате (сначала новые)
    const sorted = [...filteredTransactions].sort(
      (a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()
    );

    sorted.forEach((transaction) => {
      const dateKey = transaction.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = { transactions: [], totalBalance: 0 };
      }
      grouped[dateKey].transactions.push(transaction);
      grouped[dateKey].totalBalance +=
        transaction.type === "income"
          ? transaction.amount
          : -transaction.amount;
    });

    return grouped;
  }, [filteredTransactions]);

  const sortedDates = Object.keys(groupedByDate).sort(
    (a, b) => dayjs(b).valueOf() - dayjs(a).valueOf()
  );

  const hasActiveFilters =
    selectedCategories.length > 0 && !selectedCategories.includes("all");

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
    if (activeTab === "actual") {
      deleteTransaction(id);
    } else {
      deletePlannedExpense(id);
    }
  };

  return (
    <div className={styles.transactionsPage}>
      <PageHeader
        title={activeTab === "actual" ? "Операции" : "Планируемые расходы"}
        extra={
          <Badge
            count={hasActiveFilters ? selectedCategories.length : 0}
            size="small"
          >
            <button
              className={styles.filterBtn}
              onClick={() => setFilterDrawerOpen(true)}
            >
              <FilterOutlined />
            </button>
          </Badge>
        }
      />

      <div className={styles.container}>
        {/* Табы */}
        <div className={styles.tabsContainer}>
          <Segmented
            value={activeTab}
            onChange={(value) => setActiveTab(value as TabType)}
            options={[
              { label: "Операции", value: "actual" },
              { label: "Планируемые", value: "planned" },
            ]}
            block
            className={styles.tabs}
          />
        </div>

        {/* Поиск */}
        <div className={styles.searchContainer}>
          <Input
            placeholder="Поиск по ключевым словам"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            allowClear
          />
          <button className={styles.searchBtn}>
            <SearchOutlined />
          </button>
        </div>

        {/* Список транзакций */}
        <div className={styles.transactionsList}>
          {sortedDates.length === 0 ? (
            <div className={styles.emptyState}>
              {searchQuery 
                ? "Ничего не найдено" 
                : activeTab === "actual" 
                  ? "Нет операций" 
                  : "Нет планируемых расходов"}
            </div>
          ) : (
            sortedDates.map((dateKey) => {
              const { transactions: dayTransactions, totalBalance } =
                groupedByDate[dateKey];
              return (
                <div key={dateKey} className={styles.dateGroup}>
                  <div className={styles.dateHeader}>
                    <span className={styles.dateLabel}>
                      {formatDate(dateKey)}
                    </span>
                    <div className={styles.dateBalance}>
                      {totalBalance >= 0 ? "△" : "▽"} ₽
                      {Math.abs(totalBalance).toLocaleString("ru-RU", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  {dayTransactions.map((transaction) => {
                    const category =
                      categories.find((c) => c.id === transaction.category.id) ||
                      transaction.category;

                    return (
                      <div
                        key={transaction.id}
                        className={styles.transactionItem}
                      >
                        <div
                          className={styles.transactionIcon}
                          style={{ backgroundColor: category.color + "20" }}
                        >
                          <IconRenderer
                            iconName={category.icon}
                            size={22}
                            color={category.color}
                          />
                        </div>

                        <div className={styles.transactionInfo}>
                          <span className={styles.transactionName}>
                            {transaction.description || "Без описания"}
                          </span>
                          <div className={styles.transactionMeta}>
                            <span className={styles.transactionWallet}>
                              {category.name}
                            </span>
                            <span className={styles.transactionTag}>
                              {activeTab === "planned" 
                                ? "План" 
                                : transaction.type === "income"
                                  ? "Доход"
                                  : "Расход"}
                            </span>
                          </div>
                        </div>

                        <div className={styles.transactionRight}>
                          <div className={styles.transactionAmountWrapper}>
                            <span
                              className={`${styles.transactionAmount} ${
                                activeTab === "planned"
                                  ? styles.amountPlanned
                                  : transaction.type === "income"
                                    ? styles.amountIncome
                                    : styles.amountExpense
                              }`}
                            >
                              {activeTab === "planned" 
                                ? "" 
                                : transaction.type === "income" ? "+ " : "- "}₽
                              {transaction.amount.toLocaleString("ru-RU", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            <span className={styles.transactionTime}>
                              {formatTime(transaction.date)}
                            </span>
                          </div>
                          <Popconfirm
                            title={activeTab === "actual" ? "Удалить операцию?" : "Удалить планируемый расход?"}
                            description="Это действие нельзя отменить."
                            onConfirm={() => handleDelete(transaction.id)}
                            okText="Удалить"
                            okType="danger"
                            cancelText="Отмена"
                            placement="left"
                          >
                            <button className={styles.deleteBtn}>
                              <DeleteOutlined />
                            </button>
                          </Popconfirm>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Кнопка добавления операции */}
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
            {activeTab === "actual" ? "Добавить операцию" : "Добавить план"}
          </Button>
        </div>
      )}

      {showForm && (
        <TransactionForm
          open={showForm}
          onClose={() => setShowForm(false)}
          type={activeTab}
        />
      )}

      <CategoryFilter
        selectedCategories={selectedCategories}
        onSelectCategories={setSelectedCategories}
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
      />
    </div>
  );
};

export default TransactionsPage;
