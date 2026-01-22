import React, { useState, useEffect } from "react";
import { Layout as AntLayout } from "antd";
import Header from "./Header";
import BottomNavigation from "./BottomNavigation";
import * as styles from "./Layout.module.css";

const { Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <AntLayout className={styles.layout}>
      {!isMobile && <Header />}
      <Content className={`${styles.content} ${isMobile ? styles.mobileContent : ""}`}>
        {children}
      </Content>
      {isMobile && <BottomNavigation />}
    </AntLayout>
  );
};

export default Layout;
