import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, message, Tabs } from "antd";
// Google OAuth - временно отключено
// import { Divider } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
// Google OAuth - временно отключено
// import { GoogleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as styles from "./Login.module.css";

const Login: React.FC = () => {
  const { login, register, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // Google OAuth - временно отключено
  // const [googleLoading, setGoogleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

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

  const onRegister = async (values: { fullName: string; login: string; password: string }) => {
    try {
      setLoading(true);
      await register(values.fullName, values.login, values.password);
      message.success("Регистрация выполнена успешно");
      navigate("/finance/transactions", { replace: true });
    } catch (error: any) {
      message.error(error.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth - временно отключено
  /*
  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      await loginWithGoogle();
      message.success("Вход через Google выполнен успешно");
      navigate("/finance/transactions", { replace: true });
    } catch (error: any) {
      message.error(error.message || "Ошибка входа через Google");
    } finally {
      setGoogleLoading(false);
    }
  };
  */

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
          {/* Google OAuth - временно отключено
          <Divider>или</Divider>
          <Button
            type="default"
            icon={<GoogleOutlined />}
            block
            size="large"
            loading={googleLoading}
            onClick={handleGoogleLogin}
            className={styles.googleButton}
          >
            Войти через Google
          </Button>
          */}
        </>
      ),
    },
    {
      key: "register",
      label: "Регистрация",
      children: (
        <Form onFinish={onRegister} layout="vertical" size="large">
          <Form.Item
            name="fullName"
            rules={[{ required: true, message: "Введите ФИО" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="ФИО" />
          </Form.Item>
          <Form.Item
            name="login"
            rules={[
              { required: true, message: "Введите логин" },
              { min: 3, message: "Логин должен быть не менее 3 символов" },
              { pattern: /^[a-zA-Z0-9_]+$/, message: "Логин может содержать только буквы, цифры и подчеркивание" },
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
        <h1 className={styles.title}>💰 Финансовый помощник</h1>
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
