import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useTheme } from "../../context/ThemeContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface WeeklyData {
  week: number;
  income: number;
  expense: number;
}

interface WeeklyBarChartProps {
  data: WeeklyData[];
  selectedWeek?: number;
  onWeekSelect?: (week: number) => void;
}

const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({
  data,
  selectedWeek,
  onWeekSelect,
}) => {
  const { theme } = useTheme();
  const tickColor = theme === "dark" ? "#aeaeb2" : "#6c6c70";

  if (data.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px",
          color: "var(--text-secondary)",
        }}
      >
        Нет данных
      </div>
    );
  }

  const chartData = {
    labels: data.map((d) => `Нед ${d.week}`),
    datasets: [
      {
        label: "Доходы",
        data: data.map((d) => d.income),
        backgroundColor: data.map((d) =>
          selectedWeek === d.week ? "#22c55e" : "rgba(34, 197, 94, 0.4)"
        ),
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      },
      {
        label: "Расходы",
        data: data.map((d) => d.expense),
        backgroundColor: data.map((d) =>
          selectedWeek === d.week ? "#ff6b6b" : "rgba(255, 107, 107, 0.4)"
        ),
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event: any, elements: any[]) => {
      if (elements.length > 0 && onWeekSelect) {
        const index = elements[0].index;
        onWeekSelect(data[index].week);
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: (context: any) => {
            const weekIndex = context[0].dataIndex;
            return `Неделя ${data[weekIndex].week}`;
          },
          label: (context: any) => {
            const label = context.dataset.label || "";
            const value = context.parsed.y || 0;
            return `${label}: ${value.toLocaleString("ru-RU")} ₽`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: tickColor,
          font: {
            size: 11,
          },
        },
      },
      y: {
        display: false,
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default WeeklyBarChart;
