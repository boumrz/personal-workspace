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

  // Блокировка скролла страницы при открытии drawer
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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
      placement="bottom"
      open={open}
      onClose={onClose}
      className={styles.drawer}
      styles={{
        body: {
          padding: 16,
          overflow: "auto",
          maxHeight: "calc(85vh - 55px)",
          WebkitOverflowScrolling: "touch",
        },
        content: {
          borderRadius: "16px 16px 0 0",
          height: "85vh",
        },
        wrapper: {
          borderRadius: "16px 16px 0 0",
          height: "85vh",
        },
        header: {
          borderRadius: "16px 16px 0 0",
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "#fff",
        },
      }}
      mask={true}
      closable={true}
      getContainer={false}
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
