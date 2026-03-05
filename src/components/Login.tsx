import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, message, Tabs, Divider } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { VKIdWidget } from "./VKIdWidget";
import { TelegramLinkButton } from "./TelegramLinkButton";
import * as styles from "./Login.module.css";

// DefinePlugin подставляет значение при сборке (из .env или fallback)
const TELEGRAM_BOT_USERNAME = __TELEGRAM_BOT_USERNAME__ || "";
const VK_ID_APP_ID = __VK_ID_APP_ID__ || "";

const Login: React.FC = () => {
  const { login, register, loginWithTelegram, loginWithVkId, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [vkLoading, setVkLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Сообщение при редиректе из-за истёкшей сессии (401/403 → refresh не удался)
  useEffect(() => {
    if (sessionStorage.getItem("sessionExpired")) {
      sessionStorage.removeItem("sessionExpired");
      message.info("Сессия истекла. Войдите снова.");
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/finance/transactions", { replace: true });
    }
  }, [user, navigate]);

  const onLogin = async (values: { login: string; password: string }) => {
    try {
      setLoading(true);
      await login(values.login, values.password);
      message.success("Вход выполнен успешно");
      navigate("/finance/transactions", { replace: true });
    } catch (error: any) {
      message.error(error.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: {
    login: string;
    password: string;
    confirmPassword: string;
  }) => {
    try {
      setLoading(true);
      await register(values.login, values.password);
      message.success("Регистрация выполнена успешно");
      navigate("/finance/transactions", { replace: true });
    } catch (error: any) {
      message.error(error.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramAuth = async (telegramData: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  }) => {
    try {
      setTelegramLoading(true);
      await loginWithTelegram(telegramData);
      message.success("Вход через Telegram выполнен успешно");
      navigate("/finance/transactions", { replace: true });
    } catch (error: any) {
      message.error(
        error?.data?.error || error?.message || "Ошибка входа через Telegram",
      );
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleVkIdSuccess = async (accessToken: string) => {
    try {
      setVkLoading(true);
      await loginWithVkId(accessToken, VK_ID_APP_ID);
      message.success("Вход через VK ID выполнен успешно");
      navigate("/finance/transactions", { replace: true });
    } catch (error: any) {
      message.error(error?.message || "Ошибка входа через VK ID");
    } finally {
      setVkLoading(false);
    }
  };

  const tabItems = [
    {
      key: "login",
      label: "Вход",
      children: (
        <>
          <Form onFinish={onLogin} layout="vertical" size="large">
            <Form.Item
              name="login"
              rules={[{ required: true, message: "Введите логин" }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Логин" />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: "Введите пароль" }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                Войти
              </Button>
            </Form.Item>
          </Form>
          <>
            <Divider>или</Divider>
            <div className={styles.socialButtons}>
              {TELEGRAM_BOT_USERNAME ? (
                <div className={styles.telegramWrapper}>
                  <TelegramLinkButton
                    botUsername={TELEGRAM_BOT_USERNAME}
                    onAuthCallback={handleTelegramAuth}
                    loading={telegramLoading}
                    label="Войти через Telegram"
                  />
                  {telegramLoading && (
                    <div className={styles.telegramLoading}>Проверка...</div>
                  )}
                </div>
              ) : (
                <Button
                  type="default"
                  size="large"
                  block
                  className={styles.telegramPlaceholder}
                  onClick={() => message.error("Telegram не настроен на сервере")}
                >
                  Войти через Telegram
                </Button>
              )}
              {VK_ID_APP_ID ? (
                <VKIdWidget
                  appId={VK_ID_APP_ID}
                  onSuccess={handleVkIdSuccess}
                  onError={(e) => message.error(e?.message || "Ошибка VK ID")}
                  loading={vkLoading}
                  redirectUrl={typeof window !== "undefined" ? `${window.location.origin}/vk-id-callback.html` : undefined}
                />
              ) : (
                <Button
                  type="default"
                  size="large"
                  block
                  className={styles.vkPlaceholder}
                  onClick={() => message.error("VK ID не настроен на сервере")}
                >
                  Войти через VK
                </Button>
              )}
            </div>
          </>
        </>
      ),
    },
    {
      key: "register",
      label: "Регистрация",
      children: (
        <Form onFinish={onRegister} layout="vertical" size="large">
          <Form.Item
            name="login"
            rules={[
              { required: true, message: "Введите логин" },
              { min: 3, message: "Логин должен быть не менее 3 символов" },
              {
                pattern: /^[a-zA-Z0-9_]+$/,
                message:
                  "Логин может содержать только буквы, цифры и подчеркивание",
              },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Логин" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: "Введите пароль" },
              { min: 6, message: "Пароль должен быть не менее 6 символов" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
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
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Подтверждение пароля"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Зарегистрироваться
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div className={styles.loginContainer}>
      <Card className={styles.loginCard}>
        <h1 className={styles.title}>💰 Мой бюджет</h1>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as "login" | "register")}
          items={tabItems}
          centered
        />
      </Card>
    </div>
  );
};

export default Login;
