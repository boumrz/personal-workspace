import React, { useState, useEffect, useMemo } from "react";
import {
  Form,
  InputNumber,
  Button,
  Progress,
  Modal,
  Empty,
} from "antd";
import dayjs from "dayjs";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  MinusOutlined,
  LogoutOutlined,
  FileAddOutlined,
  RightOutlined,
  WalletOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Goal } from "../store/api";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import {
  useGetProfileQuery,
  useGetGoalsQuery,
  useUpdateProfileMutation,
  useCreateGoalMutation,
  useUpdateGoalMutation,
  useDeleteGoalMutation,
} from "../store/api";
import GoalForm from "../components/GoalForm";
import ProfileEditDrawer from "../components/ProfileEditDrawer";
import GoalEditDrawer from "../components/GoalEditDrawer";
import GoalAddDrawer from "../components/GoalAddDrawer";
import PageHeader from "../components/PageHeader";
import IconRenderer from "../components/IconRenderer";
import * as styles from "./ProfilePage.module.css";

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { transactions } = useFinance();

  // RTK Query хуки
  const {
    data: profileData,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useGetProfileQuery();
  const {
    data: goalsData = [],
    isLoading: goalsLoading,
    refetch: refetchGoals,
  } = useGetGoalsQuery();
  const [updateProfile] = useUpdateProfileMutation();
  const [createGoal] = useCreateGoalMutation();
  const [updateGoal] = useUpdateGoalMutation();
  const [deleteGoal] = useDeleteGoalMutation();

  const profile = profileData || null;
  const goals = goalsData;
  const loading = profileLoading || goalsLoading;

  const [editingProfile, setEditingProfile] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [profileForm] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);
  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [selectedGoalForAmount, setSelectedGoalForAmount] =
    useState<Goal | null>(null);
  const [amountType, setAmountType] = useState<"add" | "subtract">("add");
  const [amountForm] = Form.useForm();
  const [showAllGoals, setShowAllGoals] = useState(false);

  // Расчёт баланса
  const balance = useMemo(() => {
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return totalIncome - totalExpenses;
  }, [transactions]);

  useEffect(() => {
    if (profile) {
      profileForm.setFieldsValue({
        lastName: profile.lastName || "",
        firstName: profile.firstName || "",
        middleName: profile.middleName || "",
        dateOfBirth: profile.dateOfBirth
          ? dayjs(profile.dateOfBirth)
          : undefined,
      });
    }
  }, [profile, profileForm]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleGoalAdd = async (
    goal: Omit<Goal, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      await createGoal(goal).unwrap();
      setShowGoalForm(false);
      setEditingGoal(null);
      refetchGoals();
    } catch (error) {
      console.error("Error creating goal:", error);
      throw error;
    }
  };

  const handleGoalUpdate = async (
    id: string,
    updates: Partial<Omit<Goal, "id" | "createdAt" | "updatedAt">>
  ) => {
    try {
      await updateGoal({ id, goal: updates }).unwrap();
      setEditingGoal(null);
      refetchGoals();
    } catch (error) {
      console.error("Error updating goal:", error);
    }
  };

  const handleGoalDelete = (id: string) => {
    Modal.confirm({
      title: "Удалить цель?",
      content: "Это действие нельзя отменить.",
      okText: "Удалить",
      okType: "danger",
      cancelText: "Отмена",
      onOk: async () => {
        try {
          await deleteGoal(id).unwrap();
          refetchGoals();
        } catch (error) {
          console.error("Error deleting goal:", error);
        }
      },
    });
  };

  const handleAmountButtonClick = (goal: Goal, type: "add" | "subtract") => {
    setSelectedGoalForAmount(goal);
    setAmountType(type);
    setAmountModalVisible(true);
    amountForm.resetFields();
  };

  const handleAmountSubmit = async () => {
    if (!selectedGoalForAmount) return;

    try {
      const values = await amountForm.validateFields();
      const amount = values.amount;
      const delta = amountType === "add" ? amount : -amount;
      const newAmount = Math.max(
        0,
        selectedGoalForAmount.currentAmount + delta
      );
      await handleGoalUpdate(selectedGoalForAmount.id, {
        currentAmount: newAmount,
      });
      setAmountModalVisible(false);
      setSelectedGoalForAmount(null);
      amountForm.resetFields();
    } catch (error) {
      console.error("Error updating amount:", error);
    }
  };

  // Получаем имя пользователя для отображения
  const displayName = useMemo(() => {
    if (profile?.firstName) {
      return profile.firstName;
    }
    if (profile?.name) {
      return profile.name.split(" ")[0];
    }
    return "Пользователь";
  }, [profile]);

  // Отображаемые цели (максимум 3 если не показываем все)
  const displayedGoals = showAllGoals ? goals : goals.slice(0, 3);

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div className={styles.profilePage}>
      <PageHeader title="Мой профиль" />
      <div className={styles.container}>
        {/* Карточка баланса */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Кошелёк</h2>
          </div>
          <div className={styles.balanceCard}>
            <div className={styles.balanceIcon}>
              <WalletOutlined />
            </div>
            <div className={styles.balanceInfo}>
              <span className={styles.balanceLabel}>Баланс</span>
              <span className={styles.balanceAmount}>
                {balance.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        </section>

        {/* Цели */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Цели</h2>
            <div className={styles.sectionActions}>
              {goals.length > 3 && (
                <button
                  className={styles.viewAllBtn}
                  onClick={() => setShowAllGoals(!showAllGoals)}
                >
                  {showAllGoals ? "Скрыть" : "Все"}
                  <RightOutlined />
                </button>
              )}
              <Button
                type="primary"
                icon={<FileAddOutlined />}
                onClick={() => setShowGoalForm(true)}
                className={styles.addBtn}
                title="Добавить цель"
                aria-label="Добавить цель"
              />
            </div>
          </div>

          {goals.length === 0 ? (
            <div className={styles.emptyCard}>
              <Empty description="Нет целей" />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setShowGoalForm(true)}
                style={{ marginTop: 16 }}
              >
                Добавить первую цель
              </Button>
            </div>
          ) : (
            <div className={styles.goalsList}>
              {displayedGoals.map((goal) => {
                const percent = Math.min(
                  100,
                  Math.round((goal.currentAmount / goal.targetAmount) * 100)
                );
                return (
                  <div key={goal.id} className={styles.goalCard}>
                    <div className={styles.goalTop}>
                      <div className={styles.goalIcon}>
                        <IconRenderer iconName="Target" />
                      </div>
                      <div className={styles.goalInfo}>
                        <span className={styles.goalTitle}>{goal.title}</span>
                        <span className={styles.goalAmounts}>
                          {goal.currentAmount.toLocaleString("ru-RU")} ₽ /{" "}
                          {goal.targetAmount.toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                      <span className={styles.goalPercent}>{percent}%</span>
                    </div>
                    <Progress
                      percent={percent}
                      showInfo={false}
                      strokeColor="var(--accent)"
                      trailColor="var(--border)"
                      className={styles.goalProgress}
                    />
                    <div className={styles.goalActions}>
                      <button
                        className={styles.goalActionBtn}
                        onClick={() =>
                          handleAmountButtonClick(goal, "subtract")
                        }
                        title="Убавить"
                      >
                        <MinusOutlined />
                      </button>
                      <button
                        className={`${styles.goalActionBtn} ${styles.goalActionBtnPrimary}`}
                        onClick={() => handleAmountButtonClick(goal, "add")}
                        title="Добавить"
                      >
                        <PlusOutlined />
                      </button>
                      <button
                        className={styles.goalActionBtn}
                        onClick={() => setEditingGoal(goal)}
                        title="Редактировать"
                      >
                        <EditOutlined />
                      </button>
                      <button
                        className={`${styles.goalActionBtn} ${styles.goalActionBtnDanger}`}
                        onClick={() => handleGoalDelete(goal.id)}
                        title="Удалить"
                      >
                        <DeleteOutlined />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Настройки */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Настройки</h2>
          </div>
          <div className={styles.settingsList}>
            <button
              className={styles.settingsItem}
              onClick={() => setEditingProfile(true)}
            >
              <div className={styles.settingsItemIcon}>
                <UserOutlined />
              </div>
              <div className={styles.settingsItemContent}>
                <span className={styles.settingsItemTitle}>Данные профиля</span>
                <span className={styles.settingsItemSubtitle}>
                  {displayName}
                  {profile?.dateOfBirth &&
                    ` • ${dayjs(profile.dateOfBirth).format("DD.MM.YYYY")}`}
                </span>
              </div>
              <RightOutlined className={styles.settingsItemArrow} />
            </button>

            <button
              className={`${styles.settingsItem} ${styles.settingsItemDanger}`}
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <div
                className={`${styles.settingsItemIcon} ${styles.settingsItemIconDanger}`}
              >
                <LogoutOutlined />
              </div>
              <span className={styles.settingsItemTitle}>Выйти из аккаунта</span>
              <RightOutlined className={styles.settingsItemArrow} />
            </button>
          </div>
        </section>
      </div>

      {/* Drawer для редактирования профиля */}
      <ProfileEditDrawer
        open={editingProfile}
        onClose={() => {
          setEditingProfile(false);
          profileForm.resetFields();
        }}
        profile={profile}
        onSave={async (values) => {
          await updateProfile(values).unwrap();
          setEditingProfile(false);
          refetchProfile();
        }}
      />

      {/* Drawer для добавления/редактирования целей */}
      <GoalAddDrawer
        open={showGoalForm}
        onClose={() => {
          setShowGoalForm(false);
          setEditingGoal(null);
        }}
        onSave={handleGoalAdd}
      />
      <GoalEditDrawer
        open={editingGoal !== null}
        onClose={() => setEditingGoal(null)}
        goal={editingGoal}
        onSave={(updates) => handleGoalUpdate(editingGoal!.id, updates)}
      />

      {/* Модалка для ввода суммы изменения цели */}
      <Modal
        title={amountType === "add" ? "Добавить к цели" : "Убавить от цели"}
        open={amountModalVisible}
        onOk={handleAmountSubmit}
        onCancel={() => {
          setAmountModalVisible(false);
          setSelectedGoalForAmount(null);
          amountForm.resetFields();
        }}
        okText="Применить"
        cancelText="Отмена"
      >
        <Form form={amountForm} layout="vertical">
          <Form.Item
            name="amount"
            label="Сумма (₽)"
            rules={[
              { required: true, message: "Введите сумму" },
              {
                type: "number",
                min: 0.01,
                message: "Сумма должна быть больше 0",
              },
            ]}
          >
            <InputNumber
              min={0.01}
              step={0.01}
              precision={2}
              placeholder="Введите сумму"
              style={{ width: "100%" }}
            />
          </Form.Item>
          {selectedGoalForAmount && (
            <div
              style={{
                marginTop: 8,
                color: "var(--text-secondary)",
                fontSize: 14,
              }}
            >
              Текущая сумма:{" "}
              {selectedGoalForAmount.currentAmount.toLocaleString()} ₽
              <br />
              {amountType === "add" ? (
                <>
                  После добавления:{" "}
                  {(
                    selectedGoalForAmount.currentAmount +
                    (amountForm.getFieldValue("amount") || 0)
                  ).toLocaleString()}{" "}
                  ₽
                </>
              ) : (
                <>
                  После вычитания:{" "}
                  {Math.max(
                    0,
                    selectedGoalForAmount.currentAmount -
                      (amountForm.getFieldValue("amount") || 0)
                  ).toLocaleString()}{" "}
                  ₽
                </>
              )}
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ProfilePage;
