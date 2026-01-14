import React, { useState, useEffect } from "react";
import { Layout as AntLayout, Menu, Button, Dropdown } from "antd";
import {
  WalletOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as styles from "./Layout.module.css";

const { Sider, Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);

  const menuItems = [
    {
      key: "/finance",
      icon: <WalletOutlined />,
      label: "Финансы",
    },
  ];

  const [isMobile, setIsMobile] = useState(false);

  // Определяем, мобильное ли устройство
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      } else {
        setMobileMenuVisible(false);
        setCollapsed(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === "logout") {
      logout();
      navigate("/login");
      return;
    }
    navigate(key);
    // Закрываем меню на мобильных после выбора пункта
    if (isMobile) {
      setMobileMenuVisible(false);
      setCollapsed(true);
    }
  };

  const selectedKey =
    location.pathname === "/" || location.pathname.startsWith("/finance")
      ? "/finance"
      : location.pathname;

  const userMenuItems = [
    {
      key: "user",
      label: (
        <div style={{ padding: "8px 0" }}>
          <div style={{ fontWeight: 500 }}>{user?.name || user?.email}</div>
          <div style={{ fontSize: "12px", color: "#8c8c8c" }}>
            {user?.email}
          </div>
        </div>
      ),
      disabled: true,
    },
    {
      type: "divider" as const,
    },
    {
      key: "logout",
      label: "Выйти",
      icon: <LogoutOutlined />,
    },
  ];

  return (
    <AntLayout className={styles.layout} hasSider>
      {/* Оверлей для мобильного меню */}
      <div
        className={`${styles.siderOverlay} ${
          mobileMenuVisible ? styles.visible : ""
        }`}
        onClick={() => {
          setMobileMenuVisible(false);
          setCollapsed(true);
        }}
      />
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className={`${styles.sider} ${
          mobileMenuVisible ? styles.mobileVisible : ""
        }`}
        width={250}
        breakpoint="lg"
        collapsedWidth={80}
        trigger={null}
      >
        <div className={styles.siderHeader}>
          <div className={styles.logo}>
            {!collapsed ? "💼 Рабочее пространство" : "💼"}
          </div>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className={styles.collapseButton}
          />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
        <div className={styles.footer}>
          {!collapsed && (
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleMenuClick }}
              placement="topLeft"
            >
              <div className={styles.userInfo}>
                <UserOutlined />
                <span>{user?.name || user?.email}</span>
              </div>
            </Dropdown>
          )}
        </div>
      </Sider>
      <AntLayout className={styles.siteLayout}>
        {/* Кнопка открытия меню на мобильных */}
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => {
            setMobileMenuVisible(true);
            setCollapsed(false);
          }}
          className={styles.mobileMenuButton}
        />
        <Content className={styles.content}>{children}</Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
