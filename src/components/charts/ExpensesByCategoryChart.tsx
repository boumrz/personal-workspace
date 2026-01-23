import React from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

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
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          padding: 12,
          usePointStyle: true,
          font: {
            size: 11,
          },
          boxWidth: 12,
          boxHeight: 12,
          generateLabels: (chart: any) => {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels;
            const labels = original(chart);
            return labels.map((label: any, index: number) => {
              const item = data[index];
              const percentage = ((item.amount / total) * 100).toFixed(1);
              return {
                ...label,
                text: `${item.categoryName} (${percentage}%)`,
              };
            });
          },
        },
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
    <div style={{ height: "500px", position: "relative" }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
};

export default ExpensesByCategoryChart;
