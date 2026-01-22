import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  WalletOutlined,
  DashboardOutlined,
  DollarOutlined,
  UserOutlined,
} from "@ant-design/icons";
import * as styles from "./BottomNavigation.module.css";

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      key: "transactions",
      label: "Операции",
      icon: <WalletOutlined />,
      path: "/finance/transactions",
    },
    {
      key: "dashboard",
      label: "Дашборд",
      icon: <DashboardOutlined />,
      path: "/finance/dashboard",
    },
    {
      key: "savings",
      label: "Накопления",
      icon: <DollarOutlined />,
      path: "/finance/savings",
    },
    {
      key: "profile",
      label: "Профиль",
      icon: <UserOutlined />,
      path: "/profile",
    },
  ];

  const getActiveKey = (): string => {
    const path = location.pathname;
    if (path.includes("/profile")) return "profile";
    if (path.includes("/transactions")) return "transactions";
    if (path.includes("/dashboard")) return "dashboard";
    if (path.includes("/savings")) return "savings";
    // По умолчанию показываем транзакции
    if (path.includes("/finance") || path === "/") return "transactions";
    return "transactions";
  };

  const activeKey = getActiveKey();

  const handleNavClick = (item: NavItem) => {
    navigate(item.path);
  };

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => {
        const isActive = activeKey === item.key;
        return (
          <button
            key={item.key}
            className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            onClick={() => handleNavClick(item)}
            aria-label={item.label}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavigation;
