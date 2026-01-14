import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, message, Tabs } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as styles from "./Login.module.css";

const Login: React.FC = () => {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/finance/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const onLogin = async (values: { email: string; password: string }) => {
    try {
      setLoading(true);
      await login(values.email, values.password);
      message.success("Вход выполнен успешно");
      navigate("/finance/dashboard", { replace: true });
    } catch (error: any) {
      message.error(error.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: { email: string; password: string; name?: string }) => {
    try {
      setLoading(true);
      await register(values.email, values.password, values.name);
      message.success("Регистрация выполнена успешно");
      navigate("/finance/dashboard", { replace: true });
    } catch (error: any) {
      message.error(error.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: "login",
      label: "Вход",
      children: (
        <Form onFinish={onLogin} layout="vertical" size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "Введите email" },
              { type: "email", message: "Введите корректный email" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" />
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
      ),
    },
    {
      key: "register",
      label: "Регистрация",
      children: (
        <Form onFinish={onRegister} layout="vertical" size="large">
          <Form.Item
            name="name"
            rules={[{ required: false }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Имя (необязательно)" />
          </Form.Item>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "Введите email" },
              { type: "email", message: "Введите корректный email" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" />
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
