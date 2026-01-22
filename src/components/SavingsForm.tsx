import React, { useState, useEffect } from "react";
import { Modal, Drawer, Form, InputNumber, Input, Button, DatePicker } from "antd";
import dayjs from "dayjs";
import { useFinance } from "../context/FinanceContext";
import * as styles from "./SavingsForm.module.css";

interface SavingsFormProps {
  open: boolean;
  onClose: () => void;
}

const SavingsForm: React.FC<SavingsFormProps> = ({ open, onClose }) => {
  const { addSaving } = useFinance();
  const [form] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);



  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const savingData = {
        amount: values.amount,
        description: values.description || "",
        date: values.date.format("YYYY-MM-DD"),
      };

      await addSaving(savingData);
      form.resetFields();
      onClose();
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  // Ограничиваем даты: нельзя вносить на будущий месяц
  const disabledDate = (current: dayjs.Dayjs | null) => {
    if (!current) return false;
    const today = dayjs();
    const currentMonth = today.month();
    const currentYear = today.year();
    const selectedMonth = current.month();
    const selectedYear = current.year();

    // Запрещаем будущие месяцы
    if (selectedYear > currentYear) return true;
    if (selectedYear === currentYear && selectedMonth > currentMonth) return true;

    return false;
  };

  const formContent = (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{ date: dayjs() }}
      className={styles.form}
    >
      <Form.Item
        label="Сумма"
        name="amount"
        rules={[
          { required: true, message: "Введите сумму" },
          { type: "number", min: 0.01, message: "Сумма должна быть больше 0" },
        ]}
      >
        <InputNumber
          placeholder="0.00"
          min={0.01}
          step={0.01}
          precision={2}
          style={{ width: "100%" }}
          size="large"
        />
      </Form.Item>

      <Form.Item label="Дата" name="date" rules={[{ required: true, message: "Выберите дату" }]}>
        <DatePicker
          format="DD.MM.YYYY"
          style={{ width: "100%" }}
          size="large"
          disabledDate={disabledDate}
          placeholder="Выберите дату"
        />
      </Form.Item>

      <Form.Item label="Описание" name="description">
        <Input.TextArea
          placeholder="Описание накопления (необязательно)"
          rows={3}
          maxLength={500}
          showCount
        />
      </Form.Item>

      <Form.Item className={styles.buttonGroup}>
        <Button
          type="primary"
          htmlType="submit"
          size="large"
          block
          className={styles.submitButton}
        >
          Добавить накопление
        </Button>
        <Button onClick={handleCancel} size="large" block className={styles.cancelButton}>
          Отмена
        </Button>
      </Form.Item>
    </Form>
  );

  if (isMobile) {
    return (
      <Drawer
        title="Добавить накопление"
        placement="right"
        onClose={handleCancel}
        open={open}
        width={400}
        mask={true}
      >
        {formContent}
      </Drawer>
    );
  }

  return (
    <Modal
      title="Добавить накопление"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={500}
      className={styles.modal}
    >
      {formContent}
    </Modal>
  );
};

export default SavingsForm;
