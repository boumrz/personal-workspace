#!/usr/bin/env python3
import io
import json
import shutil
import sys


def emit(payload, status=0):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.write("\n")
    raise SystemExit(status)


try:
    import cv2
    import numpy as np
    import pytesseract
    from PIL import Image, ImageOps
except Exception as exc:
    emit(
        {
            "ok": False,
            "code": "receipt_ocr_unavailable",
            "error": f"OCR dependencies are not available: {type(exc).__name__}",
            "statusCode": 503,
        },
        2,
    )


if shutil.which("tesseract") is None:
    emit(
        {
            "ok": False,
            "code": "receipt_ocr_unavailable",
            "error": "Tesseract binary is not available.",
            "statusCode": 503,
        },
        2,
    )


def image_from_bytes(data):
    try:
        pil_image = Image.open(io.BytesIO(data))
        pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")
        rgb = np.array(pil_image)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        array = np.frombuffer(data, dtype=np.uint8)
        return cv2.imdecode(array, cv2.IMREAD_COLOR)


def crop_by_ratio(gray, left, top, right, bottom):
    height, width = gray.shape[:2]
    x0 = max(0, min(width - 1, int(width * left)))
    y0 = max(0, min(height - 1, int(height * top)))
    x1 = max(x0 + 1, min(width, int(width * right)))
    y1 = max(y0 + 1, min(height, int(height * bottom)))
    return gray[y0:y1, x0:x1]


def prepare_variant(gray, scale=3, threshold=False):
    resized = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    normalized = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(resized)
    if threshold:
        return cv2.adaptiveThreshold(
            normalized,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            9,
        )
    return normalized


def ocr_image(image, *, lang="rus+eng", psm=6, timeout=4):
    config = f"--psm {psm}"
    return pytesseract.image_to_string(Image.fromarray(image), lang=lang, config=config, timeout=timeout)


def build_ocr_jobs(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape[:2]
    jobs = []

    jobs.append(("full", prepare_variant(gray, scale=2), "rus+eng", 6))

    # Product lines usually sit between sale header and totals.
    items = crop_by_ratio(gray, 0.08, 0.24, 0.95, 0.46)
    jobs.append(("items", prepare_variant(items, scale=3), "rus+eng", 6))

    # Total amount block is usually above merchant/fiscal fields.
    amount = crop_by_ratio(gray, 0.20, 0.29, 0.90, 0.48)
    jobs.append(("amount", prepare_variant(amount, scale=3), "rus+eng", 6))

    # Fiscal drive number tends to sit immediately above the QR code.
    fn = crop_by_ratio(gray, 0.42, 0.68, 0.92, 0.73)
    jobs.append(("fn", prepare_variant(fn, scale=4, threshold=True), "rus+eng", 6))

    # Fiscal document / sign fields are often printed left of the QR code.
    fiscal = crop_by_ratio(gray, 0.0, 0.70, 0.60, 0.82)
    jobs.append(("fd_fp_threshold", prepare_variant(fiscal, scale=3, threshold=True), "rus+eng", 6))
    jobs.append(("fd_fp", prepare_variant(fiscal, scale=3), "rus+eng", 6))

    lower = gray[height // 2 :, :]
    jobs.append(("lower", prepare_variant(lower, scale=2), "rus+eng", 6))

    if min(height, width) < 900:
        jobs.append(("full_upscaled", prepare_variant(gray, scale=3), "rus+eng", 6))

    return jobs


def read_ocr(data):
    image = image_from_bytes(data)
    if image is None:
        return None

    chunks = []
    for name, variant, lang, psm in build_ocr_jobs(image):
        try:
            text = ocr_image(variant, lang=lang, psm=psm)
        except RuntimeError:
            continue
        except Exception:
            continue
        text = str(text or "").strip()
        if text:
            chunks.append(f"--- {name} ---\n{text}")

    if not chunks:
        return None
    return "\n".join(chunks)


def main():
    data = sys.stdin.buffer.read()
    if not data:
        emit({"ok": False, "code": "receipt_ocr_not_found"}, 0)

    text = read_ocr(data)
    if not text:
        emit({"ok": False, "code": "receipt_ocr_not_found"}, 0)

    emit({"ok": True, "text": text, "engine": "tesseract", "confidence": 0.72}, 0)


if __name__ == "__main__":
    main()
