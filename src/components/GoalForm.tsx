import React, { useEffect, useCallback } from "react";
import { Form, Input, InputNumber, Button } from "antd";
import { Goal } from "../store/api";

interface GoalFormProps {
  goal?: Goal;
  onSave: (goal: Omit<Goal, "id" | "createdAt" | "updatedAt"> | Partial<Goal>) => void | Promise<void>;
  onCancel: () => void;
}

const GoalForm: React.FC<GoalFormProps> = ({ goal, onSave, onCancel }) => {
  const [form] = Form.useForm();
  const handleFormFocusCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.scrollIntoView) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
  }, []);

  useEffect(() => {
    if (goal) {
      form.setFieldsValue({
        title: goal.title,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        description: goal.description,
      });
    } else {
      form.resetFields();
    }
  }, [goal, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (goal) {
        await onSave(values);
      } else {
        await onSave({
          title: values.title,
          targetAmount: values.targetAmount,
          currentAmount: 0,
          description: values.description || "",
        });
      }
    } catch (error) {
      console.error("Form validation error:", error);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onFocusCapture={handleFormFocusCapture}
    >
      <Form.Item
        name="title"
        label="Название цели"
        rules={[{ required: true, message: "Введите название цели" }]}
      >
        <Input placeholder="Например: Новый телефон" />
      </Form.Item>

      <Form.Item
        name="targetAmount"
        label="Целевая сумма (₽)"
        rules={[
          { required: true, message: "Введите целевую сумму" },
          { type: "number", min: 1, message: "Сумма должна быть больше 0" },
        ]}
      >
        <InputNumber
          min={1}
          placeholder="100000"
          style={{ width: "100%" }}
        />
      </Form.Item>

      {goal && (
        <Form.Item
          name="currentAmount"
          label="Текущая сумма (₽)"
          rules={[
            { required: true, message: "Введите текущую сумму" },
            { type: "number", min: 0, message: "Сумма не может быть отрицательной" },
          ]}
        >
          <InputNumber
            min={0}
            placeholder="0"
            style={{ width: "100%" }}
          />
        </Form.Item>
      )}

      <Form.Item
        name="description"
        label="Описание (необязательно)"
      >
        <Input.TextArea
          rows={3}
          placeholder="Добавьте описание цели..."
        />
      </Form.Item>

      <div
        style={{
          display: "flex",
          gap: 8,
          width: "100%",
        }}
      >
        <Button style={{ flex: 1, minWidth: 0 }} type="primary" htmlType="submit">
          {goal ? "Сохранить" : "Создать"}
        </Button>
        <Button style={{ flex: 1, minWidth: 0 }} onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </Form>
  );
};

export default GoalForm;
