import React, { useState, useEffect } from "react";
import { Space, Button } from "antd";
import { useFinance } from "../context/FinanceContext";
import IconRenderer from "./IconRenderer";
import * as styles from "./CategoryFilter.module.css";

interface CategoryFilterProps {
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  const { categories } = useFinance();
  const [isMobile, setIsMobile] = useState(false);

  // Определяем, мобильное ли устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className={styles.filter}>
      <div className={styles.categoriesContainer}>
        <Space 
          size={8} 
          wrap={!isMobile}
          className={styles.categoriesSpace}
        >
          <Button
            type={selectedCategory === null ? "primary" : "default"}
            onClick={() => onSelectCategory(null)}
            className={styles.categoryButton}
          >
            Все
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              type={selectedCategory === category.id ? "primary" : "default"}
              onClick={() =>
                onSelectCategory(
                  selectedCategory === category.id ? null : category.id
                )
              }
              className={styles.categoryButton}
              style={
                selectedCategory === category.id
                  ? {
                      backgroundColor: category.color,
                      borderColor: category.color,
                    }
                  : {}
              }
            >
              <span className={styles.categoryIcon}>
                <IconRenderer iconName={category.icon} size={16} />
              </span>
              {category.name}
            </Button>
          ))}
        </Space>
      </div>
    </div>
  );
};

export default CategoryFilter;
