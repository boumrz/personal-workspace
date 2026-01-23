import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Divider,
  Empty,
  Progress,
  Card,
  Modal,
  DatePicker,
} from "antd";
import dayjs from "dayjs";
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  MinusOutlined,
  LogoutOutlined,
  FileAddOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Profile, Goal } from "../store/api";
import { useAuth } from "../context/AuthContext";
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
import * as styles from "./ProfilePage.module.css";

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

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

  const handleProfileSubmit = async () => {
    try {
      const values = await profileForm.validateFields();
      const submitValues = {
        ...values,
        dateOfBirth: values.dateOfBirth
          ? values.dateOfBirth.format("YYYY-MM-DD")
          : undefined,
      };
      await updateProfile(submitValues).unwrap();
      setEditingProfile(false);
      refetchProfile();
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

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

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div className={styles.profilePage}>
      <PageHeader title="Мой профиль" />
      <div className={styles.container}>
        {/* Профиль */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>
              <UserOutlined /> Данные профиля
            </h2>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setEditingProfile(true)}
              className="circle-icon-btn"
              title="Редактировать"
              aria-label="Редактировать"
            />
          </div>

          {editingProfile && !isMobile ? (
            <Card>
              <Form
                form={profileForm}
                layout="vertical"
                onFinish={handleProfileSubmit}
              >
                <Form.Item name="lastName" label="Фамилия">
                  <Input placeholder="Введите фамилию" />
                </Form.Item>
                <Form.Item name="firstName" label="Имя">
                  <Input placeholder="Введите имя" />
                </Form.Item>
                <Form.Item name="middleName" label="Отчество">
                  <Input placeholder="Введите отчество" />
                </Form.Item>
                <Form.Item name="dateOfBirth" label="Дата рождения">
                  <DatePicker
                    placeholder="Выберите дату рождения"
                    style={{ width: "100%" }}
                    format="DD.MM.YYYY"
                  />
                </Form.Item>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  <Button
                    style={{ flex: 1, minWidth: 0 }}
                    type="primary"
                    htmlType="submit"
                  >
                    Сохранить
                  </Button>
                  <Button
                    style={{ flex: 1, minWidth: 0 }}
                    onClick={() => {
                      setEditingProfile(false);
                      profileForm.resetFields();
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </Form>
            </Card>
          ) : (
            <Card>
              <div className={styles.profileInfo}>
                <div className={styles.profileField}>
                  <span className={styles.profileLabel}>Фамилия:</span>
                  <span className={styles.profileValue}>
                    {profile?.lastName || "Не указана"}
                  </span>
                </div>
                <div className={styles.profileField}>
                  <span className={styles.profileLabel}>Имя:</span>
                  <span className={styles.profileValue}>
                    {profile?.firstName || "Не указано"}
                  </span>
                </div>
                <div className={styles.profileField}>
                  <span className={styles.profileLabel}>Отчество:</span>
                  <span className={styles.profileValue}>
                    {profile?.middleName || "Не указано"}
                  </span>
                </div>
                <div className={styles.profileField}>
                  <span className={styles.profileLabel}>Дата рождения:</span>
                  <span className={styles.profileValue}>
                    {profile?.dateOfBirth
                      ? dayjs(profile.dateOfBirth).format("DD.MM.YYYY")
                      : "Не указана"}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>

        <Divider />

        {/* Цели */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Цели</h2>
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              onClick={() => setShowGoalForm(true)}
              className="circle-icon-btn"
              title="Добавить цель"
              aria-label="Добавить цель"
            />
          </div>

          {showGoalForm && !isMobile && (
            <Card style={{ marginBottom: 16 }}>
              <GoalForm
                onSave={handleGoalAdd}
                onCancel={() => {
                  setShowGoalForm(false);
                  setEditingGoal(null);
                }}
              />
            </Card>
          )}

          {goals.length === 0 && !showGoalForm ? (
            <Card>
              <Empty description="Нет целей. Добавьте первую цель!" />
            </Card>
          ) : (
            <div className={styles.goalsList}>
              {goals.map((goal) => (
                <Card key={goal.id} className={styles.goalCard}>
                  {editingGoal?.id === goal.id && !isMobile ? (
                    <GoalForm
                      goal={goal}
                      onSave={(updates) => handleGoalUpdate(goal.id, updates)}
                      onCancel={() => setEditingGoal(null)}
                    />
                  ) : (
                    <>
                      <div className={styles.goalHeader}>
                        <h3>{goal.title}</h3>
                        <Space>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => setEditingGoal(goal)}
                          />
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleGoalDelete(goal.id)}
                          />
                        </Space>
                      </div>
                      {goal.description && (
                        <p className={styles.goalDescription}>
                          {goal.description}
                        </p>
                      )}
                      <div className={styles.goalProgress}>
                        <Progress
                          percent={Math.min(
                            100,
                            (goal.currentAmount / goal.targetAmount) * 100
                          )}
                          format={(percent) => `${Math.round(percent || 0)}%`}
                        />
                        <div className={styles.goalAmounts}>
                          <span>{goal.currentAmount.toLocaleString()} ₽</span>
                          <span>из {goal.targetAmount.toLocaleString()} ₽</span>
                        </div>
                      </div>
                      <div className={styles.goalActions}>
                        <Button
                          icon={<MinusOutlined />}
                          onClick={() =>
                            handleAmountButtonClick(goal, "subtract")
                          }
                        />
                        <Button
                          icon={<PlusOutlined />}
                          type="primary"
                          onClick={() => handleAmountButtonClick(goal, "add")}
                        />
                      </div>
                    </>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Кнопка выхода */}
        <div className={styles.logoutSection}>
          <Button
            danger
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className={styles.logoutButton}
            size={isMobile ? "large" : "middle"}
            block={isMobile}
          >
            Выйти из аккаунта
          </Button>
        </div>
      </div>

      {/* Swipeable Drawer для редактирования профиля на мобилке */}
      {isMobile && (
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
      )}

      {/* Swipeable Drawer для редактирования цели на мобилке */}
      {isMobile && (
        <>
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
        </>
      )}

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
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
              }
              parser={(value) => parseFloat(value!.replace(/\s?/g, "")) || 0}
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
