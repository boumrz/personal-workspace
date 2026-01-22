import React from "react";
import * as styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  extra?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, extra }) => {
  return (
    <div className={styles.pageHeader}>
      <h1 className={styles.title}>{title}</h1>
      {extra && <div className={styles.extra}>{extra}</div>}
    </div>
  );
};

export default PageHeader;
