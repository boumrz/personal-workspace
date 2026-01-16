import React, { useMemo } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Tabs } from "antd";
import DashboardPage from "./DashboardPage";
import TransactionsPage from "./TransactionsPage";
import SavingsPage from "./SavingsPage";
import * as styles from "./FinancePage.module.css";

const FinancePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Определяем активный таб на основе текущего роута
  const activeTab = useMemo(() => {
    if (location.pathname.includes("/transactions")) {
      return "transactions";
    }
    if (location.pathname.includes("/savings")) {
      return "savings";
    }
    return "dashboard";
  }, [location.pathname]);

  const tabItems = useMemo(
    () => [
      {
        key: "transactions",
        label: "Операции",
      },
      {
        key: "dashboard",
        label: "Дашборд",
      },
      {
        key: "savings",
        label: "Накопления",
      },
    ],
    []
  );

  const handleTabChange = (key: string) => {
    if (key === "dashboard") {
      navigate("/finance/dashboard");
    } else if (key === "transactions") {
      navigate("/finance/transactions");
    } else if (key === "savings") {
      navigate("/finance/savings");
    }
  };

  return (
    <div className={styles.financePage}>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        className={styles.tabs}
      />
      <Routes>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="savings" element={<SavingsPage />} />
        <Route path="" element={<Navigate to="transactions" replace />} />
      </Routes>
    </div>
  );
};

export default FinancePage;
