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
  const [drawerHeight, setDrawerHeight] = useState<number>(80);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Блокировка скролла страницы при открытии drawer
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, isMobile]);

  // Сброс высоты Drawer при закрытии формы
  useEffect(() => {
    if (!open) {
      setDrawerHeight(80);
    }
  }, [open]);

  // Обработка перетаскивания Drawer
  useEffect(() => {
    if (!isMobile || !open) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const windowHeight = window.innerHeight;
      const touchY = e.clientY;
      const newHeight = ((windowHeight - touchY) / windowHeight) * 100;
      const clampedHeight = Math.max(30, Math.min(95, newHeight));
      setDrawerHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const windowHeight = window.innerHeight;
      const touchY = e.touches[0].clientY;
      const newHeight = ((windowHeight - touchY) / windowHeight) * 100;
      const clampedHeight = Math.max(30, Math.min(95, newHeight));
      setDrawerHeight(clampedHeight);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, isMobile, open]);

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
        placement="bottom"
        onClose={handleCancel}
        open={open}
        className={styles.drawer}
        styles={{
          body: {
            padding: 24,
            overflow: "auto",
            maxHeight: "calc(85vh - 55px)",
            WebkitOverflowScrolling: "touch",
          },
          header: {
            position: "sticky",
            top: 0,
            zIndex: 1,
            background: "#fff",
            borderRadius: "16px 16px 0 0",
            paddingBottom: 16,
          },
          content: {
            borderRadius: "16px 16px 0 0",
            height: "85vh",
          },
          wrapper: {
            borderRadius: "16px 16px 0 0",
            height: "85vh",
          },
        }}
        extra={
          <div
            className={styles.drawerHandle}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
          />
        }
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
