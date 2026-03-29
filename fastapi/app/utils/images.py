import io

from PIL import Image, ImageOps


def compress_image(
    content: bytes,
    max_width: int | None,
    max_height: int | None,
    crop: bool = False,
    *,
    output_format: str,
) -> bytes:
    with Image.open(io.BytesIO(content)) as image:
        image = ImageOps.exif_transpose(image)
        width, height = image.size
        max_w = int(max_width) if max_width and max_width > 0 else None
        max_h = int(max_height) if max_height and max_height > 0 else None

        if not max_w and not max_h:
            return content

        over_bounds = (bool(max_w) and width > max_w) or (bool(max_h) and height > max_h)
        if not over_bounds:
            return content

        target_width = width
        target_height = height
        crop_box: tuple[int, int, int, int] | None = None

        if crop and max_w and max_h:
            cover_scale = max(max_w / width, max_h / height)
            if cover_scale <= 1:
                scaled_width = int(round(width * cover_scale))
                scaled_height = int(round(height * cover_scale))
                offset_x = max(0, (scaled_width - max_w) // 2)
                offset_y = max(0, (scaled_height - max_h) // 2)
                src_crop_width = int(round((max_w / scaled_width) * width))
                src_crop_height = int(round((max_h / scaled_height) * height))
                src_x = int(round((offset_x / scaled_width) * width))
                src_y = int(round((offset_y / scaled_height) * height))
                src_x = min(max(src_x, 0), max(0, width - src_crop_width))
                src_y = min(max(src_y, 0), max(0, height - src_crop_height))
                crop_box = (src_x, src_y, src_x + src_crop_width, src_y + src_crop_height)
                target_width = max_w
                target_height = max_h
            else:
                fit_scale = min(max_w / width, max_h / height, 1)
                target_width = int(round(width * fit_scale))
                target_height = int(round(height * fit_scale))
        else:
            fit_scale = min(
                (max_w / width) if max_w else 1,
                (max_h / height) if max_h else 1,
                1,
            )
            target_width = int(round(width * fit_scale))
            target_height = int(round(height * fit_scale))

        if crop_box:
            image = image.crop(crop_box)

        if image.size != (target_width, target_height):
            image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)

        if image.size == (width, height) and crop_box is None:
            return content

        if output_format.upper() == "JPEG" and image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")

        output = io.BytesIO()
        save_kwargs: dict = {"format": output_format}
        if output_format.upper() == "JPEG":
            save_kwargs.update({"quality": 85, "optimize": True})
        image.save(output, **save_kwargs)
        return output.getvalue()
