#!/usr/bin/env python3
import io
import json
import sys


def emit(payload, status=0):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.write("\n")
    raise SystemExit(status)


try:
    import cv2
    import numpy as np
    from PIL import Image, ImageOps
except Exception as exc:
    emit(
        {
            "ok": False,
            "code": "receipt_qr_decoder_unavailable",
            "error": f"OpenCV QR decoder dependencies are not available: {type(exc).__name__}",
            "statusCode": 503,
        },
        2,
    )


try:
    import zxingcpp
except Exception:
    zxingcpp = None


def image_from_bytes(data):
    try:
        pil_image = Image.open(io.BytesIO(data))
        pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")
        rgb = np.array(pil_image)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        array = np.frombuffer(data, dtype=np.uint8)
        return cv2.imdecode(array, cv2.IMREAD_COLOR)


def resized_variants(image):
    height, width = image.shape[:2]
    if min(height, width) >= 900:
        return []
    return [
        cv2.resize(image, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC),
    ]


def add_white_border(image, border=32):
    value = 255 if len(image.shape) == 2 else (255, 255, 255)
    return cv2.copyMakeBorder(
        image,
        border,
        border,
        border,
        border,
        cv2.BORDER_CONSTANT,
        value=value,
    )


def normalize_points(points):
    if points is None:
        return None
    array = np.array(points, dtype=np.float32).reshape(-1, 2)
    if array.shape[0] < 4:
        return None
    return array[:4]


def warp_from_points(image, points, scale=1.0):
    points = normalize_points(points)
    if points is None:
        return None

    center = points.mean(axis=0)
    scaled = ((points - center) * scale + center).astype(np.float32)
    side = int(
        max(
            np.linalg.norm(scaled[0] - scaled[1]),
            np.linalg.norm(scaled[1] - scaled[2]),
            np.linalg.norm(scaled[2] - scaled[3]),
            np.linalg.norm(scaled[3] - scaled[0]),
        )
    )
    if side < 32:
        return None

    target_side = max(240, min(720, side * 3))
    destination = np.array(
        [
            [0, 0],
            [target_side - 1, 0],
            [target_side - 1, target_side - 1],
            [0, target_side - 1],
        ],
        dtype=np.float32,
    )
    matrix = cv2.getPerspectiveTransform(scaled, destination)
    return cv2.warpPerspective(
        image,
        matrix,
        (target_side, target_side),
        borderValue=(255, 255, 255) if len(image.shape) == 3 else 255,
    )


def threshold_variants(gray):
    variants = []
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(otsu)
    variants.append(
        cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            5,
        )
    )
    return variants


def detected_warp_variants(detector, image):
    variants = []
    sources = [image]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    sources.append(gray)

    for source in sources:
        ok, points = detector.detect(source)
        if not ok:
            continue
        base = image if len(source.shape) == 2 else source
        for scale in (1.0, 1.08, 1.18):
            warped = warp_from_points(base, points, scale)
            if warped is None:
                continue
            variants.append(add_white_border(warped, 40))
            warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY) if len(warped.shape) == 3 else warped
            variants.append(add_white_border(warped_gray, 40))
            variants.extend(add_white_border(item, 40) for item in threshold_variants(warped_gray))
    return variants


def build_variants(image):
    variants = [image]
    variants.extend(resized_variants(image))

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variants.append(gray)

    height = image.shape[0]
    if height >= 2:
        lower = image[height // 2 :, :]
        variants.append(lower)
        variants.append(cv2.cvtColor(lower, cv2.COLOR_BGR2GRAY))

    equalized = cv2.equalizeHist(gray)
    variants.append(equalized)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    variants.append(clahe.apply(gray))

    sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    variants.append(cv2.filter2D(gray, -1, sharpen_kernel))

    variants.extend(threshold_variants(gray))

    return variants


def decode_one(detector, image):
    decoded, _, _ = detector.detectAndDecode(image)
    if decoded:
        return decoded.strip()
    return None


def decode_with_zxing(image):
    if zxingcpp is None:
        return None
    try:
        barcodes = zxingcpp.read_barcodes(
            image,
            formats=zxingcpp.BarcodeFormat.QRCode,
            try_rotate=True,
            try_downscale=False,
            text_mode=zxingcpp.TextMode.Plain,
        )
    except TypeError:
        barcodes = zxingcpp.read_barcodes(image)
    except Exception:
        return None

    for barcode in barcodes:
        text = str(getattr(barcode, "text", "") or "").strip()
        if text:
            return text
    return None


def decode_with_wechat(image):
    factory = getattr(cv2, "wechat_qrcode_WeChatQRCode", None)
    if factory is None:
        return None, False
    try:
        detector = factory()
        decoded, points = detector.detectAndDecode(image)
    except Exception:
        return None, False
    if decoded:
        first = decoded[0] if isinstance(decoded, (tuple, list)) else decoded
        text = str(first or "").strip()
        if text:
            return text, True
    return None, bool(points)


def decode_qr(data):
    image = image_from_bytes(data)
    if image is None:
        return {"payload": None, "detected": False}

    detector = cv2.QRCodeDetector()
    detected = False
    variants = build_variants(image)
    variants.extend(detected_warp_variants(detector, image))

    for variant in variants:
        ok, _ = detector.detect(variant)
        detected = detected or bool(ok)

        decoded = decode_one(detector, variant)
        if decoded:
            return {"payload": decoded, "detected": True}

        decoded = decode_with_zxing(variant)
        if decoded:
            return {"payload": decoded, "detected": True}

    decoded, wechat_detected = decode_with_wechat(image)
    detected = detected or wechat_detected
    if decoded:
        return {"payload": decoded, "detected": True}

    return {"payload": None, "detected": detected}


def main():
    data = sys.stdin.buffer.read()
    if not data:
        emit({"ok": False, "code": "receipt_qr_not_found"}, 0)

    result = decode_qr(data)
    payload = result.get("payload") if isinstance(result, dict) else None
    if not payload:
        if isinstance(result, dict) and result.get("detected"):
            emit(
                {
                    "ok": False,
                    "code": "receipt_qr_unreadable",
                    "error": "QR-код чека найден, но не читается. Сфотографируйте QR крупнее, ровнее и без перекрывающего текста.",
                    "statusCode": 422,
                },
                0,
            )
        emit({"ok": False, "code": "receipt_qr_not_found"}, 0)

    emit({"ok": True, "payload": payload}, 0)


if __name__ == "__main__":
    main()
