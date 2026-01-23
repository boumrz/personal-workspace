import React, { useState } from "react";
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  message,
  Popconfirm,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  AdminUser,
  useGetAdminUsersQuery,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
} from "../store/api";
import PageHeader from "../components/PageHeader";
import * as styles from "./AdminPage.module.css";

const AdminPage: React.FC = () => {
  const {
    data: usersData,
    isLoading,
    refetch,
  } = useGetAdminUsersQuery();
  const [updateUser] = useUpdateAdminUserMutation();
  const [deleteUser] = useDeleteAdminUserMutation();

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();

  const users = usersData || [];

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    form.setFieldsValue({
      login: user.login,
      email: user.email,
      name: user.name,
      last_name: user.last_name,
      first_name: user.first_name,
      middle_name: user.middle_name,
      age: user.age,
      date_of_birth: user.date_of_birth ? dayjs(user.date_of_birth) : undefined,
      password: "",
    });
    setEditModalVisible(true);
  };

  const handleEditCancel = () => {
    setEditModalVisible(false);
    setEditingUser(null);
    form.resetFields();
  };

  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields();
      const updateData: any = { ...values };

      // Преобразуем date_of_birth в строку, если она есть
      if (updateData.date_of_birth) {
        updateData.date_of_birth = updateData.date_of_birth.format("YYYY-MM-DD");
      }

      // Удаляем пустой пароль
      if (!updateData.password || updateData.password.trim() === "") {
        delete updateData.password;
      }

      await updateUser({
        id: editingUser!.id,
        user: updateData,
      }).unwrap();

      message.success("Пользователь успешно обновлен");
      handleEditCancel();
      refetch();
    } catch (error: any) {
      message.error(
        error?.data?.error || error?.message || "Ошибка при обновлении пользователя"
      );
    }
  };

  const handleDelete = async (userId: number) => {
    try {
      await deleteUser(userId).unwrap();
      message.success("Пользователь успешно удален");
      refetch();
    } catch (error: any) {
      message.error(
        error?.data?.error || error?.message || "Ошибка при удалении пользователя"
      );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return dayjs(dateString).format("DD.MM.YYYY HH:mm");
  };

  const formatDateOnly = (dateString?: string) => {
    if (!dateString) return "-";
    return dayjs(dateString).format("DD.MM.YYYY");
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
      sorter: (a: AdminUser, b: AdminUser) => a.id - b.id,
    },
    {
      title: "Логин",
      dataIndex: "login",
      key: "login",
      width: 150,
      sorter: (a: AdminUser, b: AdminUser) =>
        (a.login || "").localeCompare(b.login || ""),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 200,
      sorter: (a: AdminUser, b: AdminUser) =>
        (a.email || "").localeCompare(b.email || ""),
    },
    {
      title: "Имя",
      dataIndex: "name",
      key: "name",
      width: 150,
      render: (_: any, record: AdminUser) => {
        if (record.first_name || record.last_name || record.middle_name) {
          return [
            record.last_name,
            record.first_name,
            record.middle_name,
          ]
            .filter(Boolean)
            .join(" ");
        }
        return record.name || "-";
      },
    },
    {
      title: "Дата регистрации",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (date: string) => formatDate(date),
      sorter: (a: AdminUser, b: AdminUser) =>
        dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
    },
    {
      title: "Последний вход",
      dataIndex: "last_login_at",
      key: "last_login_at",
      width: 180,
      render: (date: string) => formatDate(date),
      sorter: (a: AdminUser, b: AdminUser) => {
        const aDate = a.last_login_at ? dayjs(a.last_login_at).unix() : 0;
        const bDate = b.last_login_at ? dayjs(b.last_login_at).unix() : 0;
        return aDate - bDate;
      },
    },
    {
      title: "Количество входов",
      dataIndex: "login_count",
      key: "login_count",
      width: 150,
      render: (count: number) => count || 0,
      sorter: (a: AdminUser, b: AdminUser) =>
        (a.login_count || 0) - (b.login_count || 0),
    },
    {
      title: "Действия",
      key: "actions",
      width: 150,
      fixed: "right" as const,
      render: (_: any, record: AdminUser) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Редактировать
          </Button>
          {record.login !== "boumrz" && (
            <Popconfirm
              title="Удалить пользователя?"
              description="Это действие нельзя отменить. Все данные пользователя будут удалены."
              onConfirm={() => handleDelete(record.id)}
              okText="Да"
              cancelText="Нет"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              >
                Удалить
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.adminPage}>
      <PageHeader
        title="Админ-панель"
        subtitle="Управление пользователями"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Обновить
          </Button>
        }
      />

      <div className={styles.tableContainer}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Всего пользователей: ${total}`,
          }}
        />
      </div>

      <Modal
        title="Редактировать пользователя"
        open={editModalVisible}
        onCancel={handleEditCancel}
        onOk={handleEditSubmit}
        okText="Сохранить"
        cancelText="Отмена"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          className={styles.editForm}
        >
          <Form.Item
            label="Логин"
            name="login"
            rules={[
              { required: true, message: "Введите логин" },
              {
                pattern: /^[a-zA-Z0-9_]+$/,
                message: "Логин может содержать только буквы, цифры и подчеркивания",
              },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[{ type: "email", message: "Введите корректный email" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item label="Имя" name="name">
            <Input />
          </Form.Item>

          <Form.Item label="Фамилия" name="last_name">
            <Input />
          </Form.Item>

          <Form.Item label="Имя" name="first_name">
            <Input />
          </Form.Item>

          <Form.Item label="Отчество" name="middle_name">
            <Input />
          </Form.Item>

          <Form.Item
            label="Возраст"
            name="age"
            rules={[
              { type: "number", min: 0, max: 150, message: "Введите корректный возраст" },
            ]}
          >
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Дата рождения" name="date_of_birth">
            <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
          </Form.Item>

          <Form.Item
            label="Новый пароль (оставьте пустым, чтобы не менять)"
            name="password"
            rules={[
              { min: 6, message: "Пароль должен быть не менее 6 символов" },
            ]}
          >
            <Input.Password placeholder="Оставьте пустым, чтобы не менять пароль" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminPage;
