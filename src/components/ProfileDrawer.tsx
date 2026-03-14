import React, { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  Modal,
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
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { Profile, Goal } from "../store/api";
import {
  useGetProfileQuery,
  useGetGoalsQuery,
  useUpdateProfileMutation,
  useCreateGoalMutation,
  useUpdateGoalMutation,
  useDeleteGoalMutation,
} from "../store/api";
import GoalForm from "./GoalForm";
import * as styles from "./ProfileDrawer.module.css";

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ open, onClose }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [profileForm] = Form.useForm();

  // RTK Query С…СѓРєРё
  const {
    data: profileData,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useGetProfileQuery(undefined, { skip: !open });
  const {
    data: goalsData = [],
    isLoading: goalsLoading,
    refetch: refetchGoals,
  } = useGetGoalsQuery(undefined, { skip: !open });
  const [updateProfile] = useUpdateProfileMutation();
  const [createGoal] = useCreateGoalMutation();
  const [updateGoal] = useUpdateGoalMutation();
  const [deleteGoal] = useDeleteGoalMutation();
  const handleFocusCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.scrollIntoView) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
  }, []);

  const profile = profileData || null;
  const goals = goalsData;
  const loading = profileLoading || goalsLoading;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (open && profile) {
      profileForm.setFieldsValue({
        fullName: profile.name || "",
        age: profile.age || undefined,
      });
    } else {
      setEditingProfile(false);
      setShowGoalForm(false);
      setEditingGoal(null);
      profileForm.resetFields();
    }
  }, [open, profile, profileForm]);

  const handleProfileSubmit = async () => {
    try {
      const values = await profileForm.validateFields();
      await updateProfile(values).unwrap();
      setEditingProfile(false);
      refetchProfile();
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const handleGoalAdd = async (
    goal: Omit<Goal, "id" | "createdAt" | "updatedAt"> | Partial<Goal>
  ) => {
    const payload: Omit<Goal, "id" | "createdAt" | "updatedAt"> = {
      title: String(goal.title || "").trim(),
      targetAmount: Number(goal.targetAmount || 0),
      currentAmount: Number(goal.currentAmount || 0),
      description: String(goal.description || ""),
    };
    try {
      await createGoal(payload).unwrap();
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

  const handleGoalDelete = async (id: string) => {
    try {
      await deleteGoal(id).unwrap();
      refetchGoals();
    } catch (error) {
      console.error("Error deleting goal:", error);
    }
  };

  const handleAmountChange = async (goal: Goal, delta: number) => {
    const newAmount = Math.max(0, goal.currentAmount + delta);
    await handleGoalUpdate(goal.id, { currentAmount: newAmount });
  };

  const content = (
    <div className={styles.content} onFocusCapture={handleFocusCapture}>
      {/* РџСЂРѕС„РёР»СЊ */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>
            <UserOutlined /> Р”Р°РЅРЅС‹Рµ РїСЂРѕС„РёР»СЏ
          </h3>
          {!editingProfile && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setEditingProfile(true)}
              className="circle-icon-btn"
              title="Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ"
              aria-label="Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ"
            />
          )}
        </div>

        {editingProfile ? (
          <Form
            form={profileForm}
            layout="vertical"
            onFinish={handleProfileSubmit}
          >
            <Form.Item name="fullName" label="Р¤РРћ">
              <Input placeholder="Р’РІРµРґРёС‚Рµ Р¤РРћ" />
            </Form.Item>
            <Form.Item name="age" label="Р’РѕР·СЂР°СЃС‚">
              <InputNumber
                min={0}
                max={150}
                placeholder="Р’РІРµРґРёС‚Рµ РІРѕР·СЂР°СЃС‚"
                style={{ width: "100%" }}
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
                РЎРѕС…СЂР°РЅРёС‚СЊ
              </Button>
              <Button
                style={{ flex: 1, minWidth: 0 }}
                onClick={() => {
                  setEditingProfile(false);
                  profileForm.resetFields();
                }}
              >
                РћС‚РјРµРЅР°
              </Button>
            </div>
          </Form>
        ) : (
          <div className={styles.profileInfo}>
            <div className={styles.profileField}>
              <strong>Р¤РРћ:</strong> {profile?.name || "РќРµ СѓРєР°Р·Р°РЅРѕ"}
            </div>
            <div className={styles.profileField}>
              <strong>Р’РѕР·СЂР°СЃС‚:</strong> {profile?.age || "РќРµ СѓРєР°Р·Р°РЅ"}
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* Р¦РµР»Рё */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Р¦РµР»Рё</h3>
          {!showGoalForm && !editingGoal && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowGoalForm(true)}
              className="circle-icon-btn"
              title="Р”РѕР±Р°РІРёС‚СЊ С†РµР»СЊ"
              aria-label="Р”РѕР±Р°РІРёС‚СЊ С†РµР»СЊ"
            />
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
          <Empty description="РќРµС‚ С†РµР»РµР№. Р”РѕР±Р°РІСЊС‚Рµ РїРµСЂРІСѓСЋ С†РµР»СЊ!" />
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
                          title="РЈРґР°Р»РёС‚СЊ С†РµР»СЊ?"
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
                        <span>{goal.currentAmount.toLocaleString()} в‚Ѕ</span>
                        <span>РёР· {goal.targetAmount.toLocaleString()} в‚Ѕ</span>
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
        title="РџСЂРѕС„РёР»СЊ"
        placement="right"
        open={open}
        onClose={onClose}
        width="100%"
        mask={true}
        closable={true}
        styles={{
          wrapper: { width: "100%", maxWidth: "100vw", height: "100dvh" },
          body: {
            overflowY: "auto",
            paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Modal
      title="РџСЂРѕС„РёР»СЊ"
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

