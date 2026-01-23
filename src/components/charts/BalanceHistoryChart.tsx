import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import dayjs from "dayjs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface BalanceData {
  date: string;
  balance: number;
}

interface BalanceHistoryChartProps {
  data: BalanceData[];
}

const BalanceHistoryChart: React.FC<BalanceHistoryChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
        Нет данных о балансе
      </div>
    );
  }

  // Группируем по датам и берем последний баланс за день
  const dailyBalance = new Map<string, number>();
  data.forEach((item) => {
    const date = item.date;
    dailyBalance.set(date, item.balance);
  });

  const sortedDates = Array.from(dailyBalance.keys()).sort(
    (a, b) => dayjs(a).valueOf() - dayjs(b).valueOf()
  );

  const chartData = {
    labels: sortedDates.map((date) => dayjs(date).format("DD.MM")),
    datasets: [
      {
        label: "Баланс",
        data: sortedDates.map((date) => dailyBalance.get(date) || 0),
        borderColor: "#0A84FF",
        backgroundColor: "rgba(10, 132, 255, 0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#0A84FF",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y || 0;
            return `Баланс: ${value.toLocaleString("ru-RU")} ₽`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function (value: any) {
            return value.toLocaleString("ru-RU") + " ₽";
          },
          stepSize: (() => {
            // Вычисляем разницу между максимальным и минимальным значением
            const values = sortedDates.map((date) => dailyBalance.get(date) || 0);
            const max = Math.max(...values);
            const min = Math.min(...values);
            const range = max - min;
            
            // Если диапазон меньше 1000, шаг 100
            if (range < 1000) return 100;
            // Если диапазон меньше 10000, шаг 1000
            if (range < 10000) return 1000;
            // Если диапазон меньше 100000, шаг 10000
            if (range < 100000) return 10000;
            // Иначе шаг 50000
            return 50000;
          })(),
        },
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div style={{ height: "500px", position: "relative" }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default BalanceHistoryChart;
