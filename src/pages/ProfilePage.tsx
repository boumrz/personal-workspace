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
  Popconfirm,
  Modal,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { apiService, Profile, Goal } from "../services/api";
import GoalForm from "../components/GoalForm";
import ProfileEditDrawer from "../components/ProfileEditDrawer";
import GoalEditDrawer from "../components/GoalEditDrawer";
import GoalAddDrawer from "../components/GoalAddDrawer";
import * as styles from "./ProfilePage.module.css";

const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
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
    loadData();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileData, goalsData] = await Promise.all([
        apiService.getProfile(),
        apiService.getGoals(),
      ]);
      setProfile(profileData);
      setGoals(goalsData);
      profileForm.setFieldsValue({
        lastName: profileData.lastName || "",
        firstName: profileData.firstName || "",
        middleName: profileData.middleName || "",
        age: profileData.age || undefined,
      });
    } catch (error) {
      console.error("Error loading profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async () => {
    try {
      const values = await profileForm.validateFields();
      const updated = await apiService.updateProfile(values);
      setProfile(updated);
      setEditingProfile(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const handleGoalAdd = async (
    goal: Omit<Goal, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      const newGoal = await apiService.createGoal(goal);
      setGoals([newGoal, ...goals]);
      setShowGoalForm(false);
      setEditingGoal(null);
    } catch (error) {
      console.error("Error creating goal:", error);
      throw error;
    }
  };

  const handleGoalUpdate = async (id: string, updates: Partial<Goal>) => {
    try {
      const updated = await apiService.updateGoal(id, updates);
      setGoals(goals.map((g) => (g.id === id ? updated : g)));
      setEditingGoal(null);
    } catch (error) {
      console.error("Error updating goal:", error);
    }
  };

  const handleGoalDelete = async (id: string) => {
    try {
      await apiService.deleteGoal(id);
      setGoals(goals.filter((g) => g.id !== id));
    } catch (error) {
      console.error("Error deleting goal:", error);
    }
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
            >
              Редактировать
            </Button>
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
                <Form.Item name="age" label="Возраст">
                  <InputNumber
                    min={0}
                    max={150}
                    placeholder="Введите возраст"
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    Сохранить
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingProfile(false);
                      profileForm.resetFields();
                    }}
                  >
                    Отмена
                  </Button>
                </Space>
              </Form>
            </Card>
          ) : (
            <Card>
              <div className={styles.profileInfo}>
                <div className={styles.profileField}>
                  <strong>Фамилия:</strong> {profile?.lastName || "Не указана"}
                </div>
                <div className={styles.profileField}>
                  <strong>Имя:</strong> {profile?.firstName || "Не указано"}
                </div>
                <div className={styles.profileField}>
                  <strong>Отчество:</strong>{" "}
                  {profile?.middleName || "Не указано"}
                </div>
                <div className={styles.profileField}>
                  <strong>Возраст:</strong> {profile?.age || "Не указан"}
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
              icon={<PlusOutlined />}
              onClick={() => setShowGoalForm(true)}
            >
              Добавить цель
            </Button>
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
                          <Popconfirm
                            title="Удалить цель?"
                            onConfirm={() => handleGoalDelete(goal.id)}
                          >
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                            />
                          </Popconfirm>
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
            const updated = await apiService.updateProfile(values);
            setProfile(updated);
            setEditingProfile(false);
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
              parser={(value) => value!.replace(/\s?/g, "")}
            />
          </Form.Item>
          {selectedGoalForAmount && (
            <div style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
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
