import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  AppState,
  AppStateStatus,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import Svg, { Path, G, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useTheme } from "../context";
import { usePreserveScrollOnThemeChange } from "../hooks";
import { ErrorView } from "../components";
import type { Transaction } from "@finance-assistant/shared";
import type { ThemeTokens } from "../context";

const chartColors = [
  "#af52de", "#ff9500", "#34c759", "#0a84ff",
  "#ff3b30", "#5856d6", "#ff2d55", "#8e8e93",
];

const screenWidth = Dimensions.get("window").width;

// Donut Chart
interface DonutChartProps {
  data: Array<{ name: string; amount: number; color: string }>;
  size: number;
  strokeWidth: number;
  selectedIndex: number | null;
  onSegmentPress: (index: number | null) => void;
}

function DonutChart({ data, size, strokeWidth, selectedIndex, onSegmentPress }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  if (total === 0) return null;

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const innerEdge = radius - strokeWidth / 2;
  const outerEdge = radius + strokeWidth / 2;

  const segmentAngles = useMemo(() => {
    const angles: Array<{ startAngle: number; endAngle: number }> = [];
    let cumulative = 0;
    data.forEach((item) => {
      const percent = item.amount / total;
      angles.push({ startAngle: cumulative * 360 - 90, endAngle: (cumulative + percent) * 360 - 90 });
      cumulative += percent;
    });
    return angles;
  }, [data, total]);

  const handleTouch = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const dx = locationX - center;
    const dy = locationY - center;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < innerEdge || distance > outerEdge) {
      onSegmentPress(null);
      return;
    }

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < -90) angle += 360;

    for (let i = 0; i < segmentAngles.length; i++) {
      const { startAngle, endAngle } = segmentAngles[i];
      if (angle >= startAngle && angle <= endAngle) {
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
    const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

    const isSelected = selectedIndex === index;
    const opacity = selectedIndex === null ? 1 : isSelected ? 1 : 0.4;

    return (
      <Path
        key={index}
        d={pathData}
        stroke={item.color}
        strokeWidth={isSelected ? strokeWidth + 6 : strokeWidth}
        fill="none"
        strokeLinecap="butt"
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

// Weekly Bar Chart
interface WeeklyBarChartProps {
  data: Array<{ week: number; income: number; expense: number }>;
  selectedWeek: number;
  onWeekSelect: (week: number) => void;
  theme: ThemeTokens;
}

function WeeklyBarChart({ data, selectedWeek, onWeekSelect, theme }: WeeklyBarChartProps) {
  const chartHeight = 120;
  const barWidth = 20;
  const gap = 8;
  const groupWidth = barWidth * 2 + gap;
  const groupSpacing = 16;
  const chartWidth = data.length * groupWidth + (data.length - 1) * groupSpacing;

  const maxValue = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);

  const handleBarTouch = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const groupTotalWidth = groupWidth + groupSpacing;
    const weekIndex = Math.floor(locationX / groupTotalWidth);
    if (weekIndex >= 0 && weekIndex < data.length) {
      onWeekSelect(data[weekIndex].week);
    }
  };

  return (
    <View style={{ alignItems: "center", paddingVertical: 16 }}>
      <View onTouchEnd={handleBarTouch}>
        <Svg width={chartWidth} height={chartHeight} style={{ alignSelf: "center" }}>
          {data.map((d, i) => {
            const x = i * (groupWidth + groupSpacing);
            const incomeHeight = (d.income / maxValue) * chartHeight;
            const expenseHeight = (d.expense / maxValue) * chartHeight;
            const isSelected = selectedWeek === d.week;

            return (
              <G key={i}>
                <Rect
                  x={x}
                  y={chartHeight - (incomeHeight || 2)}
                  width={barWidth}
                  height={incomeHeight || 2}
                  rx={4}
                  fill={isSelected ? "#34c759" : "rgba(52, 199, 89, 0.4)"}
                />
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
      <View style={{ flexDirection: "row", marginTop: 8, width: chartWidth, alignSelf: "center" }}>
        {data.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={{ width: groupWidth + groupSpacing, alignItems: "center" }}
            onPress={() => onWeekSelect(d.week)}
          >
            <Text
              style={{
                fontSize: 11,
                color: selectedWeek === d.week ? theme.textPrimary : theme.textSecondary,
                fontWeight: selectedWeek === d.week ? "600" : "400",
              }}
            >
              Нед {d.week}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { api } = useAuth();
  const { theme, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollRef, onScroll, scrollEventThrottle } = usePreserveScrollOnThemeChange(mode);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [chartType, setChartType] = useState<"expense" | "income">("expense");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [error, setError] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadData = useCallback(async () => {
    setError(false);
    try {
      const data = await api.getTransactions();
      setTransactions(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(loadData, 300);
      }
    });
    return () => { sub.remove(); clearTimeout(retryTimer.current); };
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  useEffect(() => {
    setSelectedCategoryIndex(null);
  }, [chartType]);

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedWeek(1);
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedWeek(1);
  };

  const monthName = useMemo(() => {
    const now = new Date();
    if (currentMonth.getMonth() === now.getMonth() && currentMonth.getFullYear() === now.getFullYear()) {
      return "Этот месяц";
    }
    return currentMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }, [currentMonth]);

  const monthTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
      }),
    [transactions, currentMonth]
  );

  const totalIncome = useMemo(
    () => monthTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions]
  );

  const totalExpenses = useMemo(
    () => monthTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions]
  );

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

    return { history, startingBalance, endingBalance, change: endingBalance - startingBalance };
  }, [transactions, monthTransactions, currentMonth]);

  const lineChartData = useMemo(() => {
    if (balanceTrendData.history.length === 0) {
      const v = balanceTrendData.startingBalance ?? 0;
      return {
        labels: ["", ""],
        datasets: [{ data: [v, v] }],
      };
    }

    const points = balanceTrendData.history;
    if (points.length === 1) {
      const p = points[0];
      const d = new Date(p.date);
      const label = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        labels: [label, label],
        datasets: [{ data: [p.balance, p.balance] }],
      };
    }

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

  const selectedCategoryInfo = useMemo(() => {
    if (selectedCategoryIndex === null || !categoryData[selectedCategoryIndex]) {
      return { label: "Все категории", value: categoryTotal };
    }
    const cat = categoryData[selectedCategoryIndex];
    return { label: cat.name, value: cat.amount };
  }, [selectedCategoryIndex, categoryData, categoryTotal]);

  const weeklyData = useMemo(() => {
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
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

      weeks.push({
        week: i + 1,
        income: weekTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
        expense: weekTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
      });
    }

    return weeks;
  }, [monthTransactions, currentMonth]);

  const selectedWeekData = useMemo(
    () => weeklyData.find((w) => w.week === selectedWeek) || { week: selectedWeek, income: 0, expense: 0 },
    [weeklyData, selectedWeek]
  );

  const chartConfig = useMemo(
    () => ({
      backgroundColor: theme.bgCard,
      backgroundGradientFrom: theme.bgCard,
      backgroundGradientTo: theme.bgCard,
      decimalPlaces: 0,
      color: () => theme.accentMuted,
      labelColor: () => theme.textSecondary,
      style: { borderRadius: 16 },
      propsForDots: { r: "4", strokeWidth: "2", stroke: theme.accentMuted },
      fillShadowGradient: theme.accentMuted,
      fillShadowGradientOpacity: 0.2,
    }),
    [theme]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.bgBase },
        content: { padding: 16, paddingBottom: Math.max(32, insets.bottom + 16) },
        centered: { flex: 1, justifyContent: "center", alignItems: "center" },
        periodSelector: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
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
        chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
        chartTitle: { fontSize: 18, fontWeight: "600", color: theme.textPrimary },
        chartBalance: { flexDirection: "row", alignItems: "center", gap: 4 },
        chartBalanceText: { fontSize: 16, fontWeight: "600" },
        balancePositive: { color: theme.income },
        balanceNegative: { color: theme.expense },
        balanceStats: { flexDirection: "row", gap: 16, marginBottom: 16 },
        balanceStat: { flex: 1 },
        balanceStatLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
        balanceStatValue: { fontSize: 14, fontWeight: "600", color: theme.textPrimary },
        lineChart: { borderRadius: 16, marginLeft: -16 },
        typeToggle: { flexDirection: "row", backgroundColor: theme.bgSurface, borderRadius: theme.radiusXl, padding: 4, marginBottom: 20 },
        toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radiusLg, alignItems: "center" },
        toggleBtnActive: { backgroundColor: theme.bgCard, shadowColor: theme.shadowMd, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2 },
        toggleBtnText: { fontSize: 14, fontWeight: "500", color: theme.textSecondary },
        toggleBtnTextActive: { color: theme.textPrimary },
        donutContainer: { alignItems: "center", justifyContent: "center", position: "relative" },
        donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
        donutCenterLabel: { fontSize: 13, color: theme.textSecondary, marginBottom: 4 },
        donutCenterValue: { fontSize: 18, fontWeight: "700", color: theme.textPrimary },
        emptyChart: { padding: 40, alignItems: "center" },
        emptyText: { fontSize: 14, color: theme.textSecondary },
        weekStats: { flexDirection: "row", gap: 12, marginTop: 8 },
        weekStatBox: { flex: 1, backgroundColor: theme.bgSurface, borderRadius: theme.radiusLg, padding: 12 },
        weekStatLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
        weekStatValue: { fontSize: 16, fontWeight: "600", color: theme.textPrimary },
      }),
    [theme, insets.bottom]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accentMuted} />
      </View>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorView onRetry={loadData} />
      </View>
    );
  }

  const donutSize = screenWidth - 80;

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
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
          <Text style={styles.statBoxValue}>₽{totalIncome.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>₽{totalExpenses.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
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
            <Text style={[styles.chartBalanceText, balanceTrendData.change >= 0 ? styles.balancePositive : styles.balanceNegative]}>
              ₽{Math.abs(balanceTrendData.change).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        <View style={styles.balanceStats}>
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Начальный баланс</Text>
            <Text style={styles.balanceStatValue}>₽{balanceTrendData.startingBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.balanceStat}>
            <Text style={styles.balanceStatLabel}>Конечный баланс</Text>
            <Text style={styles.balanceStatValue}>₽{balanceTrendData.endingBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {(balanceTrendData.history.length > 0 || balanceTrendData.startingBalance !== 0) && (
          <View style={{ width: screenWidth - 32, marginLeft: -8 }}>
            <LineChart
              data={lineChartData}
              width={screenWidth - 48}
              height={180}
              chartConfig={chartConfig}
              bezier
              style={styles.lineChart}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              withDots={true}
              fromZero={false}
              segments={4}
            />
          </View>
        )}
      </View>

      {/* Categories chart */}
      <View style={styles.chartCard}>
        <View style={styles.typeToggle}>
          <TouchableOpacity style={[styles.toggleBtn, chartType === "expense" && styles.toggleBtnActive]} onPress={() => setChartType("expense")}>
            <Text style={[styles.toggleBtnText, chartType === "expense" && styles.toggleBtnTextActive]}>Расходы</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, chartType === "income" && styles.toggleBtnActive]} onPress={() => setChartType("income")}>
            <Text style={[styles.toggleBtnText, chartType === "income" && styles.toggleBtnTextActive]}>Доходы</Text>
          </TouchableOpacity>
        </View>

        {categoryData.length > 0 ? (
          <TouchableOpacity style={styles.donutContainer} activeOpacity={1} onPress={() => setSelectedCategoryIndex(null)}>
            <DonutChart data={categoryData} size={donutSize} strokeWidth={32} selectedIndex={selectedCategoryIndex} onSegmentPress={setSelectedCategoryIndex} />
            <View style={styles.donutCenter}>
              <Text style={styles.donutCenterLabel}>{selectedCategoryInfo.label}</Text>
              <Text style={styles.donutCenterValue}>₽{selectedCategoryInfo.value.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
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
          <WeeklyBarChart data={weeklyData} selectedWeek={selectedWeek} onWeekSelect={setSelectedWeek} theme={theme} />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyText}>Нет данных</Text>
          </View>
        )}

        <View style={styles.weekStats}>
          <View style={styles.weekStatBox}>
            <Text style={styles.weekStatLabel}>Неделя {selectedWeek} — Доходы</Text>
            <Text style={styles.weekStatValue}>₽{selectedWeekData.income.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.weekStatBox}>
            <Text style={styles.weekStatLabel}>Неделя {selectedWeek} — Расходы</Text>
            <Text style={styles.weekStatValue}>₽{selectedWeekData.expense.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
