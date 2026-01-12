import React from "react";
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
      <button
        className={`${styles.filterButton} ${
          selectedCategory === null ? styles.active : ""
        }`}
        onClick={() => onSelectCategory(null)}
      >
        Все
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          className={`${styles.filterButton} ${
            selectedCategory === category.id ? styles.active : ""
          }`}
          onClick={() =>
            onSelectCategory(
              selectedCategory === category.id ? null : category.id
            )
          }
          style={
            selectedCategory === category.id
              ? { backgroundColor: category.color, color: "white" }
              : {}
          }
        >
          <span className={styles.categoryIcon}>{category.icon}</span>
          {category.name}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
