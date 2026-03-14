import React, { useState, useEffect, useCallback } from "react";
import { Modal, Drawer, Form, InputNumber, Input, Button, DatePicker } from "antd";
import dayjs from "dayjs";
import { useFinance } from "../context/FinanceContext";
import * as styles from "./SavingsForm.module.css";

interface SavingsFormProps {
  open: boolean;
  onClose: () => void;
  initialSaving?: { id: string; amount: number; description: string; date: string } | null;
}

const SavingsForm: React.FC<SavingsFormProps> = ({ open, onClose, initialSaving = null }) => {
  const { addSaving, updateSaving } = useFinance();
  const [form] = Form.useForm();
  const [isMobile, setIsMobile] = useState(false);
  const isEditMode = !!initialSaving;
  const handleFormFocusCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.scrollIntoView) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (open) {
      if (initialSaving) {
        form.setFieldsValue({
          amount: initialSaving.amount,
          description: initialSaving.description,
          date: dayjs(initialSaving.date),
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, initialSaving, form]);



  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const savingData = {
        amount: values.amount,
        description: values.description || "",
        date: values.date.format("YYYY-MM-DD"),
      };

      if (initialSaving) {
        await updateSaving(initialSaving.id, savingData);
      } else {
        await addSaving(savingData);
      }
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

  // РћРіСЂР°РЅРёС‡РёРІР°РµРј РґР°С‚С‹: РЅРµР»СЊР·СЏ РІРЅРѕСЃРёС‚СЊ РЅР° Р±СѓРґСѓС‰РёР№ РјРµСЃСЏС†
  const disabledDate = (current: dayjs.Dayjs | null) => {
    if (!current) return false;
    const today = dayjs();
    const currentMonth = today.month();
    const currentYear = today.year();
    const selectedMonth = current.month();
    const selectedYear = current.year();

    // Р—Р°РїСЂРµС‰Р°РµРј Р±СѓРґСѓС‰РёРµ РјРµСЃСЏС†С‹
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
      onFocusCapture={handleFormFocusCapture}
    >
      <Form.Item
        label="РЎСѓРјРјР°"
        name="amount"
        rules={[
          { required: true, message: "Р’РІРµРґРёС‚Рµ СЃСѓРјРјСѓ" },
          { type: "number", min: 0.01, message: "РЎСѓРјРјР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0" },
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

      <Form.Item label="Р”Р°С‚Р°" name="date" rules={[{ required: true, message: "Р’С‹Р±РµСЂРёС‚Рµ РґР°С‚Сѓ" }]}>
        <DatePicker
          format="DD.MM.YYYY"
          style={{ width: "100%" }}
          size="large"
          disabledDate={disabledDate}
          placeholder="Р’С‹Р±РµСЂРёС‚Рµ РґР°С‚Сѓ"
        />
      </Form.Item>

      <Form.Item label="РћРїРёСЃР°РЅРёРµ" name="description">
        <Input.TextArea
          placeholder="РћРїРёСЃР°РЅРёРµ РЅР°РєРѕРїР»РµРЅРёСЏ (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)"
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
          {isEditMode ? "РЎРѕС…СЂР°РЅРёС‚СЊ" : "Р”РѕР±Р°РІРёС‚СЊ РЅР°РєРѕРїР»РµРЅРёРµ"}
        </Button>
        <Button onClick={handleCancel} size="large" block className={styles.cancelButton}>
          РћС‚РјРµРЅР°
        </Button>
      </Form.Item>
    </Form>
  );

  if (isMobile) {
    return (
      <Drawer
        title={isEditMode ? "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РЅР°РєРѕРїР»РµРЅРёРµ" : "Р”РѕР±Р°РІРёС‚СЊ РЅР°РєРѕРїР»РµРЅРёРµ"}
        placement="right"
        onClose={handleCancel}
        open={open}
        width="100%"
        mask={true}
        styles={{
          wrapper: { width: "100%", maxWidth: "100vw", height: "100dvh" },
          body: {
            overflowY: "auto",
            paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
          },
        }}
      >
        {formContent}
      </Drawer>
    );
  }

  return (
    <Modal
      title={isEditMode ? "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РЅР°РєРѕРїР»РµРЅРёРµ" : "Р”РѕР±Р°РІРёС‚СЊ РЅР°РєРѕРїР»РµРЅРёРµ"}
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

