import React from "react";
import { Layout as AntLayout } from "antd";
import Header from "./Header";
import BottomNavigation from "./BottomNavigation";
import { useIsMobile } from "../hooks/useIsMobile";
import * as styles from "./Layout.module.css";

const { Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();

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
