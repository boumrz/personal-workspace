import React, { useState, useEffect } from "react";
import { Drawer, Modal, Form, Input, InputNumber, Button, Space, Divider, Empty, Progress, Card, Popconfirm } from "antd";
import { UserOutlined, EditOutlined, DeleteOutlined, PlusOutlined, MinusOutlined } from "@ant-design/icons";
import { apiService, Profile, Goal } from "../services/api";
import GoalForm from "./GoalForm";
import * as styles from "./ProfileDrawer.module.css";

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ open, onClose }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [profileForm] = Form.useForm();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);


  useEffect(() => {
    if (open) {
      loadData();
    } else {
      setEditingProfile(false);
      setShowGoalForm(false);
      setEditingGoal(null);
      profileForm.resetFields();
    }
  }, [open]);

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
        fullName: profileData.fullName || "",
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

  const handleGoalAdd = async (goal: Omit<Goal, "id" | "createdAt" | "updatedAt">) => {
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
      setGoals(goals.map(g => g.id === id ? updated : g));
      setEditingGoal(null);
    } catch (error) {
      console.error("Error updating goal:", error);
    }
  };

  const handleGoalDelete = async (id: string) => {
    try {
      await apiService.deleteGoal(id);
      setGoals(goals.filter(g => g.id !== id));
    } catch (error) {
      console.error("Error deleting goal:", error);
    }
  };

  const handleAmountChange = async (goal: Goal, delta: number) => {
    const newAmount = Math.max(0, goal.currentAmount + delta);
    await handleGoalUpdate(goal.id, { currentAmount: newAmount });
  };


  const content = (
    <div className={styles.content}>
      {/* Профиль */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>
            <UserOutlined /> Данные профиля
          </h3>
          {!editingProfile && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => setEditingProfile(true)}
            >
              Редактировать
            </Button>
          )}
        </div>

        {editingProfile ? (
          <Form
            form={profileForm}
            layout="vertical"
            onFinish={handleProfileSubmit}
          >
            <Form.Item
              name="fullName"
              label="ФИО"
            >
              <Input placeholder="Введите ФИО" />
            </Form.Item>
            <Form.Item
              name="age"
              label="Возраст"
            >
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
              <Button onClick={() => {
                setEditingProfile(false);
                profileForm.resetFields();
              }}>
                Отмена
              </Button>
            </Space>
          </Form>
        ) : (
          <div className={styles.profileInfo}>
            <div className={styles.profileField}>
              <strong>ФИО:</strong> {profile?.fullName || "Не указано"}
            </div>
            <div className={styles.profileField}>
              <strong>Возраст:</strong> {profile?.age || "Не указан"}
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* Цели */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Цели</h3>
          {!showGoalForm && !editingGoal && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowGoalForm(true)}
            >
              Добавить цель
            </Button>
          )}
        </div>

        {showGoalForm && (
          <GoalForm
            onSave={handleGoalAdd}
            onCancel={() => {
              setShowGoalForm(false);
              setEditingGoal(null);
            }}
          />
        )}

        {goals.length === 0 && !showGoalForm ? (
          <Empty description="Нет целей. Добавьте первую цель!" />
        ) : (
          <div className={styles.goalsList}>
            {goals.map((goal) => (
              <Card key={goal.id} className={styles.goalCard}>
                {editingGoal?.id === goal.id ? (
                  <GoalForm
                    goal={goal}
                    onSave={(updates) => handleGoalUpdate(goal.id, updates)}
                    onCancel={() => setEditingGoal(null)}
                  />
                ) : (
                  <>
                    <div className={styles.goalHeader}>
                      <h4>{goal.title}</h4>
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
                      <p className={styles.goalDescription}>{goal.description}</p>
                    )}
                    <div className={styles.goalProgress}>
                      <Progress
                        percent={Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}
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
                        onClick={() => handleAmountChange(goal, -1000)}
                      >
                        -1000
                      </Button>
                      <Button
                        icon={<PlusOutlined />}
                        type="primary"
                        onClick={() => handleAmountChange(goal, 1000)}
                      >
                        +1000
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer
        title="Профиль"
        placement="right"
        open={open}
        onClose={onClose}
        width={400}
        mask={true}
        closable={true}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Modal
      title="Профиль"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      className={styles.modal}
    >
      {content}
    </Modal>
  );
};

export default ProfileDrawer;
