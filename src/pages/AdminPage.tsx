import React, { useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  message,
  Popconfirm,
  Tabs,
  Select,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  RobotOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  AdminUser,
  LlmProvider,
  useGetAdminUsersQuery,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useGetAdminLlmProvidersQuery,
  useUpdateAdminUserLlmMutation,
} from "../store/api";
import * as styles from "./AdminPage.module.css";

const AdminPage: React.FC = () => {
  const {
    data: usersData,
    isLoading,
    refetch,
  } = useGetAdminUsersQuery();
  const [updateUser] = useUpdateAdminUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteAdminUserMutation();
  const { data: llmData } = useGetAdminLlmProvidersQuery();
  const [updateUserLlm] = useUpdateAdminUserLlmMutation();

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [llmModalVisible, setLlmModalVisible] = useState(false);
  const [selectedUserForLlm, setSelectedUserForLlm] = useState<AdminUser | null>(null);
  const [form] = Form.useForm();
  const [llmForm] = Form.useForm();

  const users = usersData || [];
  const llmProviders: LlmProvider[] = llmData?.providers || [];

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    form.setFieldsValue({
      login: user.login,
      email: user.email,
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
      const updateData: Record<string, unknown> = { ...values };

      if (updateData.date_of_birth) {
        updateData.date_of_birth = (updateData.date_of_birth as dayjs.Dayjs).format("YYYY-MM-DD");
      }

      if (!updateData.password || String(updateData.password).trim() === "") {
        delete updateData.password;
      }

      await updateUser({
        id: editingUser!.id,
        user: updateData,
      }).unwrap();

      message.success("Пользователь успешно обновлен");
      handleEditCancel();
      refetch();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string }; message?: string };
      message.error(
        err?.data?.error || err?.message || "Ошибка при обновлении пользователя"
      );
    }
  };

  const handleDelete = async (userId: number) => {
    try {
      await deleteUser(userId).unwrap();
      message.success("Пользователь успешно удален");
      refetch();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string }; message?: string };
      message.error(
        err?.data?.error || err?.message || "Ошибка при удалении пользователя"
      );
    }
  };

  const handleOpenLlmModal = (user: AdminUser) => {
    setSelectedUserForLlm(user);
    const chain = user.voice_llm_provider_chain
      ? user.voice_llm_provider_chain.split(",").map((p) => p.trim()).filter(Boolean)
      : ["gpt4free", "heuristic"];
    const enabled = user.voice_llm_enabled_providers
      ? user.voice_llm_enabled_providers.split(",").map((p) => p.trim()).filter(Boolean)
      : llmProviders.map((p) => p.id);
    llmForm.setFieldsValue({
      voice_llm_provider_chain: chain,
      voice_llm_enabled_providers: enabled,
    });
    setLlmModalVisible(true);
  };

  const handleLlmCancel = () => {
    setLlmModalVisible(false);
    setSelectedUserForLlm(null);
    llmForm.resetFields();
  };

  const handleLlmSubmit = async () => {
    if (!selectedUserForLlm) return;
    try {
      const values = await llmForm.validateFields();
      await updateUserLlm({
        id: selectedUserForLlm.id,
        voice_llm_provider_chain: values.voice_llm_provider_chain,
        voice_llm_enabled_providers: values.voice_llm_enabled_providers,
      }).unwrap();
      message.success("Настройки LLM обновлены");
      handleLlmCancel();
      refetch();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string }; message?: string };
      message.error(
        err?.data?.error || err?.message || "Ошибка при обновлении LLM"
      );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return dayjs(dateString).format("DD.MM.YYYY HH:mm");
  };

  const getDisplayName = (record: AdminUser) => {
    if (record.last_name || record.first_name || record.middle_name) {
      return [record.last_name, record.first_name, record.middle_name]
        .filter(Boolean)
        .join(" ");
    }
    return record.name || "-";
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 70,
      sorter: (a: AdminUser, b: AdminUser) => a.id - b.id,
    },
    {
      title: "Логин",
      dataIndex: "login",
      key: "login",
      width: 130,
      sorter: (a: AdminUser, b: AdminUser) =>
        (a.login || "").localeCompare(b.login || ""),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 180,
      ellipsis: true,
      sorter: (a: AdminUser, b: AdminUser) =>
        (a.email || "").localeCompare(b.email || ""),
    },
    {
      title: "ФИО",
      key: "name",
      width: 200,
      render: (_: unknown, record: AdminUser) => getDisplayName(record),
    },
    {
      title: "Регистрация",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (date: string) => formatDate(date),
      sorter: (a: AdminUser, b: AdminUser) =>
        dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
    },
    {
      title: "Первый вход",
      dataIndex: "first_login_at",
      key: "first_login_at",
      width: 150,
      render: (date: string) =>
        date ? formatDate(date) : <span className={styles.emptyDate}>—</span>,
    },
    {
      title: "Последний вход",
      dataIndex: "last_login_at",
      key: "last_login_at",
      width: 150,
      render: (date: string) =>
        date ? formatDate(date) : <span className={styles.emptyDate}>—</span>,
      sorter: (a: AdminUser, b: AdminUser) => {
        const aDate = a.last_login_at ? dayjs(a.last_login_at).unix() : 0;
        const bDate = b.last_login_at ? dayjs(b.last_login_at).unix() : 0;
        return aDate - bDate;
      },
    },
    {
      title: "Входы (всего)",
      dataIndex: "login_count",
      key: "login_count",
      width: 100,
      render: (count: number) => count ?? 0,
      sorter: (a: AdminUser, b: AdminUser) =>
        (a.login_count || 0) - (b.login_count || 0),
    },
    {
      title: "Веб (входы / последний)",
      key: "web_stats",
      width: 140,
      render: (_: unknown, record: AdminUser) => {
        const n = record.login_count_web ?? 0;
        const last = formatDate(record.last_login_web_at);
        return n > 0 ? `${n} — ${last}` : <span className={styles.emptyDate}>—</span>;
      },
    },
    {
      title: "Мобильное (входы / последний)",
      key: "mobile_stats",
      width: 160,
      render: (_: unknown, record: AdminUser) => {
        const n = record.login_count_mobile ?? 0;
        const last = formatDate(record.last_login_mobile_at);
        return n > 0 ? `${n} — ${last}` : <span className={styles.emptyDate}>—</span>;
      },
    },
    {
      title: "Действия",
      key: "actions",
      width: 220,
      fixed: "right" as const,
      render: (_: unknown, record: AdminUser) => (
        <div className={styles.actionsCell}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
            onClick={() => handleEdit(record)}
          >
            <EditOutlined /> Редактировать
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnLlm}`}
            onClick={() => handleOpenLlmModal(record)}
          >
            <RobotOutlined /> LLM
          </button>
          {record.login !== "boumrz" && (
            <Popconfirm
              title="Удалить пользователя?"
              description="Это действие нельзя отменить. Все данные пользователя будут удалены."
              onConfirm={() => handleDelete(record.id)}
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
              confirmLoading={isDeleting}
            >
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
              >
                <DeleteOutlined /> Удалить
              </button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.adminPage}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>Админ-панель</h1>
          <p className={styles.headerSubtitle}>Управление пользователями и настройками LLM</p>
        </div>
        <Button
          type="primary"
          className={styles.refreshBtn}
          icon={<ReloadOutlined />}
          onClick={() => refetch()}
          loading={isLoading}
        >
          Обновить
        </Button>
      </header>

      <div className={styles.tabsWrapper}>
        <Tabs
          defaultActiveKey="users"
          size="large"
          items={[
          {
            key: "users",
            label: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <UserOutlined /> Пользователи
              </span>
            ),
            children: (
              <div className={styles.tableContainer}>
                <Table
                  columns={columns}
                  dataSource={users}
                  rowKey="id"
                  loading={isLoading}
                  scroll={{ x: "max-content" }}
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showTotal: (total) => `Всего: ${total}`,
                  }}
                  size="small"
                />
              </div>
            ),
          },
          {
            key: "llm",
            label: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <RobotOutlined /> LLM провайдеры
              </span>
            ),
            children: (
              <div className={styles.llmTab}>
                <div className={styles.llmCard}>
                  <h3 className={styles.llmCardTitle}>Как настроить LLM</h3>
                  <p className={styles.llmHint}>
                    Откройте вкладку «Пользователи», найдите нужного пользователя и нажмите кнопку «LLM».
                    В открывшемся окне выберите разрешённые провайдеры и порядок их использования.
                  </p>
                </div>
                <div className={styles.llmCard}>
                  <h3 className={styles.llmCardTitle}>Доступные провайдеры</h3>
                  <p className={styles.llmHint}>
                    Список всех провайдеров, которые можно назначить пользователям:
                  </p>
                  <div className={styles.providersList}>
                    {llmProviders.length > 0
                      ? llmProviders.map((p) => (
                          <span key={p.id} className={styles.providerTag}>
                            {p.label}
                          </span>
                        ))
                      : "—"}
                  </div>
                </div>
              </div>
            ),
          },
        ]}
        />
      </div>

      <Modal
        title="Редактировать пользователя"
        open={editModalVisible}
        onCancel={handleEditCancel}
        onOk={handleEditSubmit}
        okText="Сохранить"
        cancelText="Отмена"
        width={540}
        className={styles.modal}
      >
        <Form form={form} layout="vertical" className={styles.editForm}>
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

          <div className={styles.fioRow}>
            <Form.Item label="Фамилия" name="last_name" className={styles.fioItem}>
              <Input placeholder="Фамилия" />
            </Form.Item>
            <Form.Item label="Имя" name="first_name" className={styles.fioItem}>
              <Input placeholder="Имя" />
            </Form.Item>
            <Form.Item label="Отчество" name="middle_name" className={styles.fioItem}>
              <Input placeholder="Отчество" />
            </Form.Item>
          </div>

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

      <Modal
        title={`LLM для пользователя: ${selectedUserForLlm?.login || ""}`}
        open={llmModalVisible}
        onCancel={handleLlmCancel}
        onOk={handleLlmSubmit}
        okText="Сохранить"
        cancelText="Отмена"
        width={560}
        className={styles.modal}
      >
        <Form form={llmForm} layout="vertical" className={styles.editForm}>
          <Form.Item
            label="Разрешённые провайдеры (какие LLM доступны пользователю)"
            name="voice_llm_enabled_providers"
            rules={[{ required: true, message: "Выберите хотя бы один провайдер" }]}
          >
            <Select
              mode="multiple"
              placeholder="Выберите провайдеры"
              options={llmProviders.map((p) => ({ label: p.label, value: p.id }))}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="Цепочка провайдеров (порядок использования, первый — основной)"
            name="voice_llm_provider_chain"
          >
            <Select
              mode="multiple"
              placeholder="Порядок: первый — основной, при ошибке — следующий"
              options={llmProviders.map((p) => ({ label: p.label, value: p.id }))}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminPage;
