import React, { useState, useEffect, useRef } from "react";
import { Layout, Button, Drawer, Menu, Dropdown } from "antd";
import {
  WalletOutlined,
  MenuOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as styles from "./Header.module.css";

const { Header: AntHeader } = Layout;

interface HeaderProps {
  children?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [showBurger, setShowBurger] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenMenuRef = useRef<HTMLDivElement>(null);

  const sections = [
    {
      key: "/finance",
      icon: <WalletOutlined />,
      label: "Финансы",
    },
  ];

  // Определяем, мобильное ли устройство
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setShowBurger(true);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Проверяем, помещаются ли разделы в шапку (только для десктопа)
  useEffect(() => {
    if (isMobile) {
      setShowBurger(true);
      return;
    }

    const checkFit = () => {
      if (!hiddenMenuRef.current || !containerRef.current) return;

      // Используем скрытый элемент для измерения реальной ширины меню
      const menuWidth = hiddenMenuRef.current.scrollWidth;
      const containerWidth = containerRef.current.offsetWidth;
      const logoWidth = containerRef.current.querySelector(`.${styles.logo}`)?.getBoundingClientRect().width || 200;
      const userButton = containerRef.current.querySelector(`.${styles.userButton}`);
      const userButtonWidth = userButton?.getBoundingClientRect().width || 150;
      const burgerWidth = 48; // Ширина бургера
      const padding = 48; // Отступы
      const gap = 16; // Отступы между элементами
      const availableWidth = containerWidth - logoWidth - userButtonWidth - burgerWidth - padding - gap * 2;

      setShowBurger(menuWidth > availableWidth);
    };

    // Небольшая задержка для правильного измерения после рендера
    const timeoutId = setTimeout(checkFit, 100);
    window.addEventListener("resize", checkFit);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkFit);
    };
  }, [isMobile]);

  const handleSectionClick = ({ key }: { key: string }) => {
    if (key === "logout") {
      logout();
      navigate("/login");
      return;
    }
    navigate(key);
    if (isMobile) {
      setDrawerVisible(false);
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

  const menuItems = sections.map((section) => ({
    key: section.key,
    icon: section.icon,
    label: section.label,
  }));

  return (
    <>
      {/* Скрытое меню для измерения ширины */}
      {!isMobile && (
        <div ref={hiddenMenuRef} className={styles.hiddenMenu}>
          <Menu
            mode="horizontal"
            items={menuItems}
            className={styles.menuItems}
          />
        </div>
      )}
      <AntHeader className={styles.header} ref={containerRef}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>💼 Рабочее пространство</div>
          <div className={styles.menuContainer}>
            {/* Меню разделов - показываем только если помещается (для десктопа) */}
            {!isMobile && !showBurger && (
              <div ref={menuRef} className={styles.menu}>
                <Menu
                  mode="horizontal"
                  selectedKeys={[selectedKey]}
                  items={menuItems}
                  onClick={handleSectionClick}
                  className={styles.menuItems}
                />
              </div>
            )}
            {/* Меню пользователя */}
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleSectionClick }}
              placement="bottomRight"
            >
              <Button
                type="text"
                icon={<UserOutlined />}
                className={styles.userButton}
              >
                {!isMobile && (user?.name || user?.email)}
              </Button>
            </Dropdown>
            {/* Бургер для мобильного (справа) */}
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setDrawerVisible(true)}
                className={styles.mobileBurgerButton}
              />
            )}
            {/* Бургер для десктопа (справа, если не помещается) */}
            {!isMobile && showBurger && (
              <Dropdown
                menu={{ items: menuItems, onClick: handleSectionClick }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  className={styles.burgerButton}
                />
              </Dropdown>
            )}
          </div>
        </div>
      </AntHeader>

      {/* Drawer для мобильного */}
      <Drawer
        title="Разделы"
        placement="bottom"
        size="50vh"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        className={styles.drawer}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: "8px 8px 0 0" },
          wrapper: { borderRadius: "8px 8px 0 0" },
          header: { borderRadius: "8px 8px 0 0" },
        }}
      >
        <Menu
          mode="vertical"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleSectionClick}
          className={styles.drawerMenu}
        />
      </Drawer>
    </>
  );
};

export default Header;
