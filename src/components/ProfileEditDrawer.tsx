import React, { useEffect } from "react";
import { Drawer, Form, Input, Button, Space, DatePicker } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { Profile } from "../services/api";
import dayjs from "dayjs";
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
        dateOfBirth: profile.dateOfBirth
          ? dayjs(profile.dateOfBirth)
          : undefined,
      });
    }
  }, [open, profile, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitValues = {
        ...values,
        dateOfBirth: values.dateOfBirth
          ? values.dateOfBirth.format("YYYY-MM-DD")
          : undefined,
      };
      await onSave(submitValues);
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
      placement="right"
      open={open}
      onClose={onClose}
      width={400}
      mask={true}
      closable={true}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
        <Space
          style={{ width: "100%", justifyContent: "flex-end", marginTop: 16 }}
        >
          <Button onClick={onClose}>Отмена</Button>
          <Button type="primary" htmlType="submit">
            Сохранить
          </Button>
        </Space>
      </Form>
    </Drawer>
  );
};

export default ProfileEditDrawer;
