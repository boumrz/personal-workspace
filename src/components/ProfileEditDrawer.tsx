import React, { useEffect } from "react";
import { Drawer, Form, Input, InputNumber, Button, Space } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { Profile } from "../services/api";
import * as styles from "./ProfileEditDrawer.module.css";

interface ProfileEditDrawerProps {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  onSave: (values: Partial<Profile>) => Promise<void>;
}

const ProfileEditDrawer: React.FC<ProfileEditDrawerProps> = ({
  open,
  onClose,
  profile,
  onSave,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && profile) {
      form.setFieldsValue({
        lastName: profile.lastName || "",
        firstName: profile.firstName || "",
        middleName: profile.middleName || "",
        age: profile.age || undefined,
      });
    }
  }, [open, profile, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSave(values);
      onClose();
    } catch (error) {
      console.error("Form validation error:", error);
    }
  };

  return (
    <Drawer
      title={
        <div className={styles.drawerTitle}>
          <UserOutlined /> Редактирование профиля
        </div>
      }
      placement="bottom"
      height="100vh"
      open={open}
      onClose={onClose}
      className={styles.drawer}
      styles={{
        body: { padding: 16, overflow: "auto" },
        content: { borderRadius: "16px 16px 0 0" },
        wrapper: { borderRadius: "16px 16px 0 0" },
        header: { borderRadius: "16px 16px 0 0" },
      }}
      mask={true}
      closable={true}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="lastName"
          label="Фамилия"
        >
          <Input placeholder="Введите фамилию" />
        </Form.Item>
        <Form.Item
          name="firstName"
          label="Имя"
        >
          <Input placeholder="Введите имя" />
        </Form.Item>
        <Form.Item
          name="middleName"
          label="Отчество"
        >
          <Input placeholder="Введите отчество" />
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
        <Space style={{ width: "100%", justifyContent: "flex-end", marginTop: 16 }}>
          <Button onClick={onClose}>
            Отмена
          </Button>
          <Button type="primary" htmlType="submit">
            Сохранить
          </Button>
        </Space>
      </Form>
    </Drawer>
  );
};

export default ProfileEditDrawer;
