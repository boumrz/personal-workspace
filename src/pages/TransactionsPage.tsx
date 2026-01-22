import React, { useState, useEffect } from "react";
import { Tabs, FloatButton, Button, Badge, Tag, Space } from "antd";
import { PlusOutlined, FilterOutlined, CloseOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import TransactionList from "../components/TransactionList";
import PlannedExpenses from "../components/PlannedExpenses";
import TransactionForm from "../components/TransactionForm";
import CategoryFilter from "../components/CategoryFilter";
import PageHeader from "../components/PageHeader";
import IconRenderer from "../components/IconRenderer";
import * as styles from "./TransactionsPage.module.css";

const TransactionsPage: React.FC = () => {
  const { transactions, plannedExpenses, categories } = useFinance();
  const [activeTab, setActiveTab] = useState<"actual" | "planned">("actual");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Определяем, мобильное ли устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const filteredTransactions =
    selectedCategories.length === 0 || selectedCategories.includes("all")
      ? transactions
      : transactions.filter((t) => selectedCategories.includes(t.category.id));

  const handleRemoveCategory = (categoryId: string) => {
    setSelectedCategories(selectedCategories.filter((id) => id !== categoryId));
  };

  const getCategoryById = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId);
  };

  const tabItems = [
    {
      key: "actual",
      label: "Актуальные",
      children: (
        <TransactionList
          transactions={filteredTransactions}
          selectedCategory={null}
          plannedExpenses={plannedExpenses}
        />
      ),
    },
    {
      key: "planned",
      label: "Планируемые",
      children: <PlannedExpenses expenses={plannedExpenses} />,
    },
  ];

  const hasActiveFilters = selectedCategories.length > 0 && !selectedCategories.includes("all");

  return (
    <div className={styles.transactionsPage}>
      <PageHeader
        title="Все операции"
        extra={
          <Badge count={hasActiveFilters ? selectedCategories.length : 0} size="small">
            <Button
              type="text"
              icon={<FilterOutlined />}
              onClick={() => setFilterDrawerOpen(true)}
              className={styles.filterButton}
            />
          </Badge>
        }
      />
      {hasActiveFilters && (
        <div className={styles.activeFilters}>
          <Space size={[8, 8]} wrap>
            {selectedCategories.map((categoryId) => {
              const category = getCategoryById(categoryId);
              if (!category) return null;
              return (
                <Tag
                  key={categoryId}
                  closable
                  onClose={() => handleRemoveCategory(categoryId)}
                  color={category.color}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 8px",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ marginRight: 4, display: "inline-flex", alignItems: "center" }}>
                    <IconRenderer iconName={category.icon} size={12} />
                  </span>
                  {category.name}
                </Tag>
              );
            })}
          </Space>
        </div>
      )}
      <div className={styles.content}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as "actual" | "planned")}
          items={tabItems}
        />
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
            Добавить операцию
          </Button>
        </div>
      )}

      {showForm && (
        <TransactionForm
          open={showForm}
          onClose={() => setShowForm(false)}
          type={activeTab === "planned" ? "planned" : "actual"}
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
