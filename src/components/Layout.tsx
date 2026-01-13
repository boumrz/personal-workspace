import React, { useState } from "react";
import { Layout as AntLayout, Menu } from "antd";
import { DashboardOutlined, CalculatorOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import * as styles from "./Layout.module.css";

const { Sider, Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: "/dashboard",
      icon: <DashboardOutlined />,
      label: "Дашборд",
    },
    {
      key: "/transactions",
      icon: <CalculatorOutlined />,
      label: "Расчет",
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const selectedKey = location.pathname === "/" ? "/dashboard" : location.pathname;

  return (
    <AntLayout className={styles.layout} hasSider>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className={styles.sider}
        width={250}
        breakpoint="lg"
        collapsedWidth={80}
      >
        <div className={styles.logo}>
          {!collapsed ? "💰 Финансы" : "💰"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <AntLayout className={styles.siteLayout}>
        <Content className={styles.content}>{children}</Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
