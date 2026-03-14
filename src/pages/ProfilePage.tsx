import React, { useState, useEffect, useMemo } from "react";
import {
  Form,
  InputNumber,
  Input,
  Button,
  Progress,
  Modal,
  Empty,
  message,
  App,
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
  UserOutlined,
  BulbOutlined,
  BulbFilled,
  DisconnectOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Goal } from "../store/api";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";
import { useTheme } from "../context/ThemeContext";
import {
  useGetProfileQuery,
  useGetGoalsQuery,
  useUpdateProfileMutation,
  useCreateGoalMutation,
  useUpdateGoalMutation,
  useDeleteGoalMutation,
  useLinkTelegramMutation,
  useUnlinkTelegramMutation,
  useLinkVkIdMutation,
  useUnlinkVkMutation,
  useSetPasswordMutation,
} from "../store/api";
import { VKIdWidget } from "../components/VKIdWidget";
import { TelegramLinkButton } from "../components/TelegramLinkButton";
import GoalForm from "../components/GoalForm";
import ProfileEditDrawer from "../components/ProfileEditDrawer";
import GoalEditDrawer from "../components/GoalEditDrawer";
import GoalAddDrawer from "../components/GoalAddDrawer";
import PageHeader from "../components/PageHeader";
import IconRenderer from "../components/IconRenderer";
import * as styles from "./ProfilePage.module.css";

const TELEGRAM_BOT_USERNAME = typeof __TELEGRAM_BOT_USERNAME__ !== "undefined" ? __TELEGRAM_BOT_USERNAME__ : "";
const VK_ID_APP_ID = typeof __VK_ID_APP_ID__ !== "undefined" ? __VK_ID_APP_ID__ : "";

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const { user, logout } = useAuth();
  const { transactions } = useFinance();
  const { theme, toggleTheme } = useTheme();

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
  const [linkTelegram, { isLoading: linkTelegramLoading }] = useLinkTelegramMutation();
  const [unlinkTelegram, { isLoading: unlinkTelegramLoading }] = useUnlinkTelegramMutation();
  const [linkVkId, { isLoading: linkVkLoading }] = useLinkVkIdMutation();
  const [unlinkVk, { isLoading: unlinkVkLoading }] = useUnlinkVkMutation();
  const [setPassword, { isLoading: setPasswordLoading }] = useSetPasswordMutation();
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
  const [setPasswordModalVisible, setSetPasswordModalVisible] = useState(false);
  const [setPasswordForm] = Form.useForm();

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
    modal.confirm({
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

  const handleLinkTelegram = async (telegramData: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    auth_date: number;
    hash: string;
  }) => {
    try {
      await linkTelegram(telegramData).unwrap();
      message.success("Telegram привязан");
      refetchProfile();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      message.error(e?.data?.error || e?.message || "Ошибка привязки Telegram");
    }
  };

  const handleUnlinkTelegram = () => {
    const canUnlink = (profile?.authMethodsCount ?? 0) > 1;
    if (!canUnlink) {
      modal.info({
        title: "Нельзя отвязать Telegram",
        content: "Чтобы отвязать Telegram, сначала добавьте пароль или привяжите VK. Иначе вы не сможете войти в аккаунт.",
        okText: "Добавить пароль",
        onOk: () => setSetPasswordModalVisible(true),
      });
      return;
    }
    modal.confirm({
      title: "Отвязать Telegram?",
      content: "Вы сможете войти через Telegram снова, только привязав его заново.",
      okText: "Отвязать",
      okType: "danger",
      cancelText: "Отмена",
      onOk: async () => {
        try {
          await unlinkTelegram().unwrap();
          message.success("Telegram отвязан");
          refetchProfile();
        } catch (err: unknown) {
          const e = err as { data?: { error?: string }; message?: string };
          message.error(e?.data?.error || e?.message || "Ошибка отвязки");
        }
      },
    });
  };

  const handleLinkVkId = async (accessToken: string) => {
    try {
      await linkVkId({ access_token: accessToken, app_id: VK_ID_APP_ID || undefined }).unwrap();
      message.success("VK привязан");
      refetchProfile();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      message.error(e?.data?.error || e?.message || "Ошибка привязки VK");
    }
  };

  const handleUnlinkVk = () => {
    const canUnlink = (profile?.authMethodsCount ?? 0) > 1;
    if (!canUnlink) {
      modal.info({
        title: "Нельзя отвязать VK",
        content: "Чтобы отвязать VK, сначала добавьте пароль или привяжите Telegram. Иначе вы не сможете войти в аккаунт.",
        okText: "Добавить пароль",
        onOk: () => setSetPasswordModalVisible(true),
      });
      return;
    }
    modal.confirm({
      title: "Отвязать VK?",
      content: "Вы сможете войти через VK снова, только привязав его заново.",
      okText: "Отвязать",
      okType: "danger",
      cancelText: "Отмена",
      onOk: async () => {
        try {
          await unlinkVk().unwrap();
          message.success("VK отвязан");
          refetchProfile();
        } catch (err: unknown) {
          const e = err as { data?: { error?: string }; message?: string };
          message.error(e?.data?.error || e?.message || "Ошибка отвязки");
        }
      },
    });
  };

  const handleSetPassword = async () => {
    try {
      const values = await setPasswordForm.validateFields();
      await setPassword({ password: values.password, login: values.login }).unwrap();
      message.success("Логин и пароль сохранены");
      setSetPasswordModalVisible(false);
      setPasswordForm.resetFields();
      refetchProfile();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      message.error(e?.data?.error || e?.message || "Ошибка установки пароля");
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
                      <span
                        className={`${styles.goalPercent} ${
                          percent >= 100 ? styles.goalPercentComplete : ""
                        }`}
                      >
                        {percent}%
                      </span>
                    </div>
                    <Progress
                      percent={percent}
                      showInfo={false}
                      strokeColor={percent >= 100 ? "var(--income)" : "var(--accent)"}
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
                  {[
                    (profile?.login || user?.login || user?.email) &&
                      `Логин: ${profile?.login || user?.login || user?.email}`,
                    displayName,
                    profile?.dateOfBirth &&
                      dayjs(profile.dateOfBirth).format("DD.MM.YYYY"),
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </span>
              </div>
              <RightOutlined className={styles.settingsItemArrow} />
            </button>
            <button
              className={styles.settingsItem}
              onClick={toggleTheme}
            >
              <div className={styles.settingsItemIcon}>
                {theme === "dark" ? <BulbFilled /> : <BulbOutlined />}
              </div>
              <div className={styles.settingsItemContent}>
                <span className={styles.settingsItemTitle}>Тема оформления</span>
                <span className={styles.settingsItemSubtitle}>
                  {theme === "dark" ? "Тёмная" : "Светлая"}
                </span>
              </div>
              <RightOutlined className={styles.settingsItemArrow} />
            </button>
          </div>
        </section>

        {/* Безопасность: добавить пароль */}
        {!profile?.hasPassword && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Безопасность</h2>
            </div>
            <div className={styles.linkedAccountItem}>
              <div className={styles.linkedAccountInfo}>
                <LockOutlined style={{ marginRight: 8 }} />
                <span>Пароль не установлен</span>
              </div>
              <Button
                type="primary"
                size="small"
                onClick={() => setSetPasswordModalVisible(true)}
              >
                Добавить пароль
              </Button>
            </div>
          </section>
        )}

        {/* Привязанные аккаунты */}
        {(TELEGRAM_BOT_USERNAME || VK_ID_APP_ID) && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Привязанные аккаунты</h2>
            </div>
            <div className={styles.linkedAccounts}>
              {TELEGRAM_BOT_USERNAME && (
                <div className={styles.linkedAccountItem}>
                  <div className={styles.linkedAccountInfo}>
                    <span className={styles.linkedAccountName}>Telegram</span>
                    <span className={styles.linkedAccountStatus}>
                      {profile?.telegramId ? "Привязан" : "Не привязан"}
                    </span>
                  </div>
                  <div className={styles.linkedAccountActions}>
                    {profile?.telegramId ? (
                      <Button
                        type="default"
                        danger
                        size="small"
                        icon={<DisconnectOutlined />}
                        onClick={handleUnlinkTelegram}
                        loading={unlinkTelegramLoading}
                      >
                        Отвязать
                      </Button>
                    ) : (
                      <div className={styles.telegramLinkWrapper}>
                        <TelegramLinkButton
                          botUsername={TELEGRAM_BOT_USERNAME}
                          onAuthCallback={handleLinkTelegram}
                          loading={linkTelegramLoading}
                          label="Привязать Telegram"
                        />
                        {linkTelegramLoading && (
                          <span className={styles.linkLoading}>Проверка...</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {VK_ID_APP_ID && (
                <div className={styles.linkedAccountItem}>
                  <div className={styles.linkedAccountInfo}>
                    <span className={styles.linkedAccountName}>VK</span>
                    <span className={styles.linkedAccountStatus}>
                      {profile?.vkId ? "Привязан" : "Не привязан"}
                    </span>
                  </div>
                  <div className={styles.linkedAccountActions}>
                    {profile?.vkId ? (
                      <Button
                        type="default"
                        danger
                        size="small"
                        icon={<DisconnectOutlined />}
                        onClick={handleUnlinkVk}
                        loading={unlinkVkLoading}
                      >
                        Отвязать
                      </Button>
                    ) : (
                      <VKIdWidget
                        appId={VK_ID_APP_ID}
                        onSuccess={handleLinkVkId}
                        onError={(e) => message.error(e?.message || "Ошибка VK ID")}
                        loading={linkVkLoading}
                        label="Привязать VK"
                        redirectUrl={typeof window !== "undefined" ? `${window.location.origin}/vk-id-callback.html` : undefined}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Кнопка выхода */}
        <button
          className={styles.logoutBtn}
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <LogoutOutlined />
          <span>Выйти из аккаунта</span>
        </button>
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

      {/* Модалка установки пароля */}
      <Modal
        title="Добавить пароль"
        open={setPasswordModalVisible}
        onOk={handleSetPassword}
        onCancel={() => {
          setSetPasswordModalVisible(false);
          setPasswordForm.resetFields();
        }}
        okText="Установить пароль"
        cancelText="Отмена"
        confirmLoading={setPasswordLoading}
      >
        <p style={{ marginBottom: 16 }}>
          Задайте новый логин и пароль. После этого вы сможете входить без соцсети.
        </p>
        <Form form={setPasswordForm} layout="vertical">
          <Form.Item
            name="login"
            label="Новый логин"
            rules={[
              { required: true, message: "Введите логин" },
              { min: 3, message: "Логин должен быть не менее 3 символов" },
              {
                pattern: /^[a-zA-Z0-9_]+$/,
                message: "Логин может содержать только буквы, цифры и подчеркивание",
              },
            ]}
          >
            <Input placeholder="Например: ivan_123" autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[
              { required: true, message: "Введите пароль" },
              { min: 6, message: "Пароль должен быть не менее 6 символов" },
            ]}
          >
            <Input.Password placeholder="Минимум 6 символов" />
          </Form.Item>
          <Form.Item
            name="passwordConfirm"
            label="Подтвердите пароль"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Подтвердите пароль" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Пароли не совпадают"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Повторите пароль" />
          </Form.Item>
        </Form>
      </Modal>

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
