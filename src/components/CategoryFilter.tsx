import React from "react";
import { Space, Button } from "antd";
import { useFinance } from "../context/FinanceContext";
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

  return (
    <div className={styles.filter}>
      <Space size={8} wrap>
        <Button
          type={selectedCategory === null ? "primary" : "default"}
          onClick={() => onSelectCategory(null)}
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
            style={
              selectedCategory === category.id
                ? { backgroundColor: category.color, borderColor: category.color }
                : {}
            }
          >
            <span className={styles.categoryIcon}>{category.icon}</span>
            {category.name}
          </Button>
        ))}
      </Space>
    </div>
  );
};

export default CategoryFilter;
