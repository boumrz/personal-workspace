import React from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip);

interface CategoryData {
  categoryId: string;
  categoryName: string;
  amount: number;
  color: string;
  icon: string;
}

interface ExpensesByCategoryChartProps {
  data: CategoryData[];
}

const ExpensesByCategoryChart: React.FC<ExpensesByCategoryChartProps> = ({
  data,
}) => {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
        Нет данных о расходах
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.amount, 0);

  const chartData = {
    labels: data.map((item) => item.categoryName),
    datasets: [
      {
        data: data.map((item) => item.amount),
        backgroundColor: data.map((item) => item.color),
        borderColor: "#ffffff",
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "75%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || "";
            const value = context.parsed || 0;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value.toLocaleString("ru-RU")} ₽ (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height: "300px", position: "relative" }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
};

export default ExpensesByCategoryChart;
