import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  GestureResponderEvent,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import Svg, { Path, G, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme";
import type { Transaction } from "@finance-assistant/shared";

const chartColors = [
  "#af52de", // purple
  "#ff9500", // orange  
  "#34c759", // green
  "#0a84ff", // blue
  "#ff3b30", // red
  "#5856d6", // indigo
  "#ff2d55", // pink
  "#8e8e93", // gray
];

const screenWidth = Dimensions.get("window").width;

// Custom Donut Chart Component with touch interaction
interface DonutChartProps {
  data: Array<{ name: string; amount: number; color: string }>;
  size: number;
  strokeWidth: number;
  selectedIndex: number | null;
  onSegmentPress: (index: number | null) => void;
}

function DonutChart({ data, size, strokeWidth, selectedIndex, onSegmentPress }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const innerRadius = radius - strokeWidth;

  if (total === 0) return null;

  // Calculate segment angles for touch detection
  const segmentAngles = useMemo(() => {
    const angles: Array<{ startAngle: number; endAngle: number }> = [];
    let cumulative = 0;
    data.forEach((item) => {
      const percent = item.amount / total;
      const startAngle = cumulative * 360 - 90;
      const endAngle = (cumulative + percent) * 360 - 90;
      angles.push({ startAngle, endAngle });
      cumulative += percent;
    });
    return angles;
  }, [data, total]);

  const handleTouch = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const dx = locationX - center;
    const dy = locationY - center;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if touch is in the donut ring area
    if (distance < innerRadius || distance > radius + strokeWidth / 2) {
      onSegmentPress(null);
      return;
    }

    // Calculate angle (in degrees, starting from top)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Normalize to 0-360 starting from -90 (top)
    if (angle < -90) angle += 360;
    
    // Find which segment was touched
    for (let i = 0; i < segmentAngles.length; i++) {
      const { startAngle, endAngle } = segmentAngles[i];
      // Normalize angles for comparison
      const normalizedAngle = angle;
      const normalizedStart = startAngle;
      const normalizedEnd = endAngle;
      
      if (normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd) {
        onSegmentPress(selectedIndex === i ? null : i);
        return;
      }
    }
    onSegmentPress(null);
  };

  let cumulativePercent = 0;

  const segments = data.map((item, index) => {
    const percent = item.amount / total;
    const startAngle = cumulativePercent * 360 - 90;
    const endAngle = (cumulativePercent + percent) * 360 - 90;
    cumulativePercent += percent;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArcFlag = percent > 0.5 ? 1 : 0;

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    ].join(" ");

    const isSelected = selectedIndex === index;
    const opacity = selectedIndex === null ? 1 : isSelected ? 1 : 0.4;

    return (
      <Path
        key={index}
        d={pathData}
        stroke={item.color}
        strokeWidth={isSelected ? strokeWidth + 6 : strokeWidth}
        fill="none"
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  });

  return (
    <View onTouchEnd={handleTouch}>
      <Svg width={size} height={size}>
        <G>{segments}</G>
      </Svg>
    </View>
  );
}

// Weekly Bar Chart Component
interface WeeklyBarChartProps {
  data: Array<{ week: number; income: number; expense: number }>;
  selectedWeek: number;
  onWeekSelect: (week: number) => void;
}

function WeeklyBarChart({ data, selectedWeek, onWeekSelect }: WeeklyBarChartProps) {
  const chartHeight = 120;
  const barWidth = 20;
  const gap = 8;
  const groupWidth = barWidth * 2 + gap;
  const groupSpacing = 16;
  const chartWidth = data.length * groupWidth + (data.length - 1) * groupSpacing;
  
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.income, d.expense)),
    1
  );

  const handleBarTouch = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const groupTotalWidth = groupWidth + groupSpacing;
    const weekIndex = Math.floor(locationX / groupTotalWidth);
    if (weekIndex >= 0 && weekIndex < data.length) {
      onWeekSelect(data[weekIndex].week);
    }
  };

  return (
    <View style={weeklyStyles.container}>
      <View onTouchEnd={handleBarTouch}>
        <Svg width={chartWidth} height={chartHeight} style={{ alignSelf: "center" }}>
          {data.map((d, i) => {
            const x = i * (groupWidth + groupSpacing);
            const incomeHeight = (d.income / maxValue) * chartHeight;
            const expenseHeight = (d.expense / maxValue) * chartHeight;
            const isSelected = selectedWeek === d.week;

            return (
              <G key={i}>
                {/* Income bar */}
                <Rect
                  x={x}
                  y={chartHeight - (incomeHeight || 2)}
                  width={barWidth}
                  height={incomeHeight || 2}
                  rx={4}
                  fill={isSelected ? "#34c759" : "rgba(52, 199, 89, 0.4)"}
                />
                {/* Expense bar */}
                <Rect
                  x={x + barWidth + gap}
                  y={chartHeight - (expenseHeight || 2)}
                  width={barWidth}
                  height={expenseHeight || 2}
                  rx={4}
                  fill={isSelected ? "#ff6b6b" : "rgba(255, 107, 107, 0.4)"}
                />
              </G>
            );
          })}
        </Svg>
      </View>
      {/* Labels */}
      <View style={[weeklyStyles.labels, { width: chartWidth }]}>
        {data.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[weeklyStyles.labelContainer, { width: groupWidth + groupSpacing }]}
            onPress={() => onWeekSelect(d.week)}
          >
            <Text style={[
              weeklyStyles.label,
              selectedWeek === d.week && weeklyStyles.labelActive
            ]}>
              Нед {d.week}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const weeklyStyles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 16 },
  labels: { flexDirection: "row", marginTop: 8, alignSelf: "center" },
  labelContainer: { alignItems: "center" },
  label: { fontSize: 11, color: theme.textSecondary },
  labelActive: { color: theme.textPrimary, fontWeight: "600" },
});

export default function DashboardScreen() {
  const { api } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [chartType, setChartType] = useState<"expense" | "income">("expense");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);

  const loadData = async () => {
    try {
      const data = await api.getTransactions();
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Reset selection when chart type changes
  useEffect(() => {
    setSelectedCategoryIndex(null);
  }, [chartType]);

  // Navigation
  const goToPrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedWeek(1);
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedWeek(1);
  };

  // Month name
  const monthName = useMemo(() => {
    const now = new Date();
    if (currentMonth.getMonth() === now.getMonth() && currentMonth.getFullYear() === now.getFullYear()) {
      return "Этот месяц";
    }
    return currentMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }, [currentMonth]);

  // Filter transactions by month
  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = new Date(t.date);
      return date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
    });
  }, [transactions, currentMonth]);

  // Totals
  const totalIncome = useMemo(
    () => monthTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions]
  );

  const totalExpenses = useMemo(
    () => monthTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions]
  );

  // Balance trend data
  const balanceTrendData = useMemo(() => {
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    const beforeMonthTransactions = transactions.filter((t) => new Date(t.date) < monthStart);
    const startingBalance = beforeMonthTransactions.reduce(
      (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
      0
    );

    const sortedTransactions = [...monthTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const history: { date: string; balance: number }[] = [];
    let runningBalance = startingBalance;

    sortedTransactions.forEach((t) => {
      runningBalance += t.type === "income" ? t.amount : -t.amount;
      history.push({ date: t.date, balance: runningBalance });
    });

    const endingBalance = history.length > 0 ? history[history.length - 1].balance : startingBalance;

    return {
      history,
      startingBalance,
      endingBalance,
      change: endingBalance - startingBalance,
    };
  }, [transactions, monthTransactions, currentMonth]);

  // Line chart data
  const lineChartData = useMemo(() => {
    if (balanceTrendData.history.length === 0) {
      return {
        labels: [""],
        datasets: [{ data: [balanceTrendData.startingBalance || 0] }],
      };
    }

    const points = balanceTrendData.history;
    const step = Math.max(1, Math.floor(points.length / 6));
    const selectedPoints = points.filter((_, i) => i % step === 0 || i === points.length - 1);

    return {
      labels: selectedPoints.map((p) => {
        const d = new Date(p.date);
        return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      }),
      datasets: [{ data: selectedPoints.map((p) => p.balance) }],
    };
  }, [balanceTrendData]);

  // Category data for donut chart
  const categoryData = useMemo(() => {
    const filteredTransactions = monthTransactions.filter((t) => t.type === chartType);
    const categoryMap = new Map<string, { name: string; amount: number; color: string }>();

    filteredTransactions.forEach((t) => {
      const id = t.category.id;
      const existing = categoryMap.get(id);
      const color = t.category.color || chartColors[categoryMap.size % chartColors.length];
      if (existing) {
        categoryMap.set(id, { ...existing, amount: existing.amount + t.amount });
      } else {
        categoryMap.set(id, { name: t.category.name, amount: t.amount, color });
      }
    });

    return Array.from(categoryMap.values());
  }, [monthTransactions, chartType]);

  const categoryTotal = useMemo(() => categoryData.reduce((sum, c) => sum + c.amount, 0), [categoryData]);

  // Selected category info for center display
  const selectedCategoryInfo = useMemo(() => {
    if (selectedCategoryIndex === null || !categoryData[selectedCategoryIndex]) {
      return { label: "Все категории", value: categoryTotal };
    }
    const cat = categoryData[selectedCategoryIndex];
    return { label: cat.name, value: cat.amount };
  }, [selectedCategoryIndex, categoryData, categoryTotal]);

  // Weekly data
  const weeklyData = useMemo(() => {
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    // Calculate number of weeks
    const daysInMonth = endOfMonth.getDate();
    const weeksInMonth = Math.ceil(daysInMonth / 7);

    const weeks: Array<{ week: number; income: number; expense: number }> = [];

    for (let i = 0; i < Math.min(weeksInMonth, 5); i++) {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(1 + i * 7);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      if (weekEnd > endOfMonth) weekEnd.setTime(endOfMonth.getTime());

      const weekTransactions = monthTransactions.filter((t) => {
        const date = new Date(t.date);
        return date >= weekStart && date <= weekEnd;
      });

      const income = weekTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = weekTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      weeks.push({ week: i + 1, income, expense });
    }

    return weeks;
  }, [monthTransactions, currentMonth]);

  // Selected week data
  const selectedWeekData = useMemo(() => {
    return weeklyData.find((w) => w.week === selectedWeek) || { week: selectedWeek, income: 0, expense: 0 };
  }, [weeklyData, selectedWeek]);

  const chartConfig = {
    backgroundColor: theme.bgCard,
    backgroundGradientFrom: theme.bgCard,
    backgroundGradientTo: theme.bgCard,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(74, 158, 214, ${opacity})`,
    labelColor: () => theme.textSecondary,
    style: { borderRadius: 16 },
    propsForDots: { r: "4", strokeWidth: "2", stroke: theme.accentMuted },
    fillShadowGradient: theme.accentMuted,
    fillShadowGradientOpacity: 0.2,
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accentMuted} />
      </View>
    );
  }

  const donutSize = screenWidth - 80;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Period selector */}
      <View style={styles.periodSelector}>
        <Text style={styles.periodLabel}>{monthName}</Text>
        <View style={styles.periodNav}>
          <TouchableOpacity style={styles.navBtn} onPress={goToPrevMonth}>
            <Ionicons name="chevron-back" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={goToNextMonth}>
            <Ionicons name="chevron-forward" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary stats */}
      <View style={styles.summaryStats}>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>
            ₽{totalIncome.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>
            ₽{totalExpenses.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Balance trend */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Динамика баланса</Text>
          <View style={styles.chartBalance}>
            <Ionicons
              name={balanceTrendData.change >= 0 ? "caret-up" : "caret-down"}
              size={16}
              color={balanceTrendData.change >= 0 ? theme.income : theme.expense}
            />
            <Text
              style={[
                styles.chartBalanceText,
                balanceTrendData.change >= 0 ? styles.balancePositive : styles.balanceNegative,
              ]}
            >
              ₽{Math.abs(balanceTrendData.change).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        <View style={styles.balanceStats}>
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Начальный баланс</Text>
            <Text style={styles.balanceStatValue}>
              ₽{balanceTrendData.startingBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Конечный баланс</Text>
            <Text style={styles.balanceStatValue}>
              ₽{balanceTrendData.endingBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {balanceTrendData.history.length > 0 && (
          <LineChart
            data={lineChartData}
            width={screenWidth - 64}
            height={180}
            chartConfig={chartConfig}
            bezier
            style={styles.lineChart}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            fromZero={false}
          />
        )}
      </View>

      {/* Categories chart */}
      <View style={styles.chartCard}>
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, chartType === "expense" && styles.toggleBtnActive]}
            onPress={() => setChartType("expense")}
          >
            <Text style={[styles.toggleBtnText, chartType === "expense" && styles.toggleBtnTextActive]}>
              Расходы
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, chartType === "income" && styles.toggleBtnActive]}
            onPress={() => setChartType("income")}
          >
            <Text style={[styles.toggleBtnText, chartType === "income" && styles.toggleBtnTextActive]}>
              Доходы
            </Text>
          </TouchableOpacity>
        </View>

        {categoryData.length > 0 ? (
          <TouchableOpacity
            style={styles.donutContainer}
            activeOpacity={1}
            onPress={() => setSelectedCategoryIndex(null)}
          >
            <DonutChart
              data={categoryData}
              size={donutSize}
              strokeWidth={32}
              selectedIndex={selectedCategoryIndex}
              onSegmentPress={setSelectedCategoryIndex}
            />
            <View style={styles.donutCenter}>
              <Text style={styles.donutCenterLabel}>{selectedCategoryInfo.label}</Text>
              <Text style={styles.donutCenterValue}>
                ₽{selectedCategoryInfo.value.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyText}>Нет данных за этот период</Text>
          </View>
        )}
      </View>

      {/* Weekly chart */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>По неделям</Text>
        </View>

        {weeklyData.length > 0 ? (
          <WeeklyBarChart
            data={weeklyData}
            selectedWeek={selectedWeek}
            onWeekSelect={setSelectedWeek}
          />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyText}>Нет данных</Text>
          </View>
        )}

        {/* Week stats */}
        <View style={styles.weekStats}>
          <View style={styles.weekStatBox}>
            <Text style={styles.weekStatLabel}>Неделя {selectedWeek} — Доходы</Text>
            <Text style={styles.weekStatValue}>
              ₽{selectedWeekData.income.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.weekStatBox}>
            <Text style={styles.weekStatLabel}>Неделя {selectedWeek} — Расходы</Text>
            <Text style={styles.weekStatValue}>
              ₽{selectedWeekData.expense.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBase },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Period selector
  periodSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  periodLabel: { fontSize: 22, fontWeight: "700", color: theme.textPrimary },
  periodNav: { flexDirection: "row", gap: 8 },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.bgCard,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.shadowSm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },

  // Summary stats
  summaryStats: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: theme.bgCard,
    borderRadius: theme.radiusXl,
    padding: 16,
    alignItems: "center",
    shadowColor: theme.shadowSm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  statBoxValue: { fontSize: 16, fontWeight: "700", color: theme.textPrimary },

  // Chart card
  chartCard: {
    backgroundColor: theme.bgCard,
    borderRadius: theme.radius2xl,
    padding: 20,
    marginBottom: 16,
    shadowColor: theme.shadowSm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: { fontSize: 18, fontWeight: "600", color: theme.textPrimary },
  chartBalance: { flexDirection: "row", alignItems: "center", gap: 4 },
  chartBalanceText: { fontSize: 16, fontWeight: "600" },
  balancePositive: { color: theme.income },
  balanceNegative: { color: theme.expense },

  // Balance stats
  balanceStats: { flexDirection: "row", gap: 16, marginBottom: 16 },
  balanceStat: { flex: 1 },
  balanceStatLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  balanceStatValue: { fontSize: 14, fontWeight: "600", color: theme.textPrimary },

  lineChart: { borderRadius: 16, marginLeft: -16 },

  // Type toggle
  typeToggle: {
    flexDirection: "row",
    backgroundColor: theme.bgSurface,
    borderRadius: theme.radiusXl,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radiusLg,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: theme.bgCard,
    shadowColor: theme.shadowMd,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleBtnText: { fontSize: 14, fontWeight: "500", color: theme.textSecondary },
  toggleBtnTextActive: { color: theme.textPrimary },

  // Donut chart
  donutContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenterLabel: { fontSize: 13, color: theme.textSecondary, marginBottom: 4 },
  donutCenterValue: { fontSize: 18, fontWeight: "700", color: theme.textPrimary },

  emptyChart: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: theme.textSecondary },

  // Week stats
  weekStats: { flexDirection: "row", gap: 12, marginTop: 8 },
  weekStatBox: {
    flex: 1,
    backgroundColor: theme.bgSurface,
    borderRadius: theme.radiusLg,
    padding: 12,
  },
  weekStatLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  weekStatValue: { fontSize: 16, fontWeight: "600", color: theme.textPrimary },
});
