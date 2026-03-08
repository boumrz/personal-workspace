import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  WalletOutlined,
  DashboardOutlined,
  DollarOutlined,
  UserOutlined,
  AudioOutlined,
} from "@ant-design/icons";
import { VoiceAssistModal } from "./VoiceAssistModal";
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
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

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
      key: "voice",
      label: "Голос",
      icon: <AudioOutlined />,
      path: "__voice__",
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
    if (path.includes("/finance") || path === "/") return "transactions";
    return "transactions";
  };

  const activeKey = getActiveKey();

  const handleNavClick = (item: NavItem) => {
    if (item.path === "__voice__") {
      setVoiceModalOpen(true);
      return;
    }
    navigate(item.path);
  };

  return (
    <>
    <nav className={styles.bottomNav}>
      {navItems.map((item) => {
        const isActive = activeKey === item.key;
        const isVoice = item.key === "voice";
        if (isVoice) {
          return (
            <div key={item.key} className={styles.voiceTabWrapper}>
              <span className={styles.voicePulse} />
              <button
                className={styles.voiceButton}
                onClick={() => handleNavClick(item)}
                aria-label={item.label}
              >
                <span className={styles.voiceButtonCore}>
                  <AudioOutlined className={styles.voiceButtonIcon} />
                </span>
              </button>
            </div>
          );
        }
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

    <VoiceAssistModal
      open={voiceModalOpen}
      onClose={() => setVoiceModalOpen(false)}
    />
  </>
  );
};

export default BottomNavigation;
