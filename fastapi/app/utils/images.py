import io

from PIL import Image, ImageOps


def compress_image(
    content: bytes,
    max_width: int,
    max_height: int,
    crop: bool = False,
) -> tuple[bytes, str, str]:
    with Image.open(io.BytesIO(content)) as image:
        image = ImageOps.exif_transpose(image)
        width, height = image.size

        if crop:
            target_ratio = max_width / max_height
            source_ratio = width / height
            if source_ratio > target_ratio:
                new_width = int(height * target_ratio)
                offset_x = (width - new_width) // 2
                box = (offset_x, 0, offset_x + new_width, height)
            else:
                new_height = int(width / target_ratio)
                offset_y = (height - new_height) // 2
                box = (0, offset_y, width, offset_y + new_height)
            image = image.crop(box).resize((max_width, max_height), Image.Resampling.LANCZOS)
        else:
            image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")

        output = io.BytesIO()
        image.save(output, format="JPEG", quality=85, optimize=True)
        return output.getvalue(), "image/jpeg", ".jpg"
