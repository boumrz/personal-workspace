import React, { useMemo } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Tabs } from "antd";
import DashboardPage from "./DashboardPage";
import TransactionsPage from "./TransactionsPage";
import * as styles from "./FinancePage.module.css";

const FinancePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Определяем активный таб на основе текущего роута
  const activeTab = useMemo(() => {
    if (location.pathname.includes("/transactions")) {
      return "transactions";
    }
    return "dashboard";
  }, [location.pathname]);

  const tabItems = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Дашборд",
      },
      {
        key: "transactions",
        label: "Операции",
      },
    ],
    []
  );

  const handleTabChange = (key: string) => {
    if (key === "dashboard") {
      navigate("/finance/dashboard");
    } else if (key === "transactions") {
      navigate("/finance/transactions");
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
        <Route path="" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  );
};

export default FinancePage;
