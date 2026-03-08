import React, { useState, useEffect, useRef } from "react";
import { Layout, Button, Drawer, Menu, Dropdown } from "antd";
import {
  WalletOutlined,
  MenuOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  SafetyOutlined,
  AudioOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { VoiceAssistModal } from "./VoiceAssistModal";
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const closingFromClick = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenMenuRef = useRef<HTMLDivElement>(null);

  const sections = [
    {
      key: "/finance",
      icon: <WalletOutlined />,
      label: "Финансы",
    },
    ...(user?.login === "boumrz"
      ? [
          {
            key: "/admin",
            icon: <SafetyOutlined />,
            label: "Админка",
          },
        ]
      : []),
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
      const logoWidth =
        containerRef.current
          .querySelector(`.${styles.logo}`)
          ?.getBoundingClientRect().width || 200;
      const userButton = containerRef.current.querySelector(
        `.${styles.userButton}`
      );
      const userButtonWidth = userButton?.getBoundingClientRect().width || 150;
      const burgerWidth = 48; // Ширина бургера
      const padding = 48; // Отступы
      const gap = 16; // Отступы между элементами
      const availableWidth =
        containerWidth -
        logoWidth -
        userButtonWidth -
        burgerWidth -
        padding -
        gap * 2;

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
    closingFromClick.current = true;
    setUserMenuOpen(false);

    if (key === "logout") {
      logout();
      navigate("/login");
      return;
    }
    if (key === "profile") {
      navigate("/profile");
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
      : location.pathname.startsWith("/admin")
      ? "/admin"
      : location.pathname;

  const userMenuItems = [
    {
      key: "user",
      label: (
        <div style={{ padding: "8px 0" }}>
          <div style={{ fontWeight: 500 }}>{user?.name || user?.email}</div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
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
      key: "profile",
      label: "Профиль",
      icon: <SettingOutlined />,
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
      <AntHeader className={`${styles.header} ${isMobile ? styles.mobileHeader : ""}`} ref={containerRef}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            {!isMobile && <div className={styles.logo}>💼 Рабочее пространство</div>}
            {isMobile && <div className={styles.mobileLogo}>💼</div>}
          </div>
          <div className={`${styles.menuContainer} ${!isMobile ? styles.headerRight : ""}`}>
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
            {/* Кнопка голосового ввода */}
            <Button
              type="text"
              icon={<AudioOutlined />}
              className={styles.voiceButton}
              onClick={() => setVoiceModalOpen(true)}
              aria-label="Голосовой ввод"
            />
            {/* Меню пользователя */}
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: handleSectionClick,
              }}
              placement="bottomRight"
              open={userMenuOpen}
              onOpenChange={(open) => {
                // Если закрытие было вызвано из handleSectionClick, игнорируем onOpenChange
                if (closingFromClick.current && !open) {
                  closingFromClick.current = false;
                  return;
                }
                // В остальных случаях (клик вне меню, ESC и т.д.) разрешаем закрытие
                setUserMenuOpen(open);
              }}
              trigger={["click"]}
            >
              <Button
                type="text"
                icon={<UserOutlined />}
                className={styles.userButton}
              >
                {!isMobile && (user?.name || user?.email)}
              </Button>
            </Dropdown>
            {/* Бургер для мобильного (справа) - убираем, так как навигация теперь внизу */}
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

      {/* Drawer для мобильного - убираем, так как навигация теперь внизу */}

      <VoiceAssistModal
        open={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
      />
    </>
  );
};

export default Header;
