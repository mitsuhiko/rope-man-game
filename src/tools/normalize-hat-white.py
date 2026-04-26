#!/usr/bin/env python3
"""Normalize grayscale hat PNGs to neutral white assets.

The generated hat images are grayscale drawings on a white background, but the
"white" fill is scattered across #f5f5f5..#ffffff.  This script keeps the files
as neutral grayscale art and clamps near-white fill pixels to pure #ffffff.

At runtime the game tints this normalized grayscale ramp to PAPER, so changing
the in-game paper color later does not require regenerating the assets.
"""

from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path
from typing import Iterable

WHITE_POINT = 245
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def read_rgba_png(path: Path) -> tuple[int, int, bytearray]:
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError(f"{path}: not a PNG file")

    pos = len(PNG_SIGNATURE)
    idat = bytearray()
    width = height = bit_depth = color_type = interlace = None

    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        pos += 4
        kind = data[pos : pos + 4]
        pos += 4
        payload = data[pos : pos + length]
        pos += length
        pos += 4  # CRC

        if kind == b"IHDR":
            width, height, bit_depth, color_type, _compression, _filter, interlace = struct.unpack(
                ">IIBBBBB", payload
            )
        elif kind == b"IDAT":
            idat.extend(payload)
        elif kind == b"IEND":
            break

    if (bit_depth, color_type, interlace) != (8, 6, 0):
        raise ValueError(
            f"{path}: expected non-interlaced 8-bit RGBA PNG, "
            f"got bit_depth={bit_depth}, color_type={color_type}, interlace={interlace}"
        )

    assert width is not None and height is not None
    bytes_per_pixel = 4
    stride = width * bytes_per_pixel
    raw = zlib.decompress(bytes(idat))
    pixels = bytearray(width * height * bytes_per_pixel)
    prev = bytearray(stride)
    src = 0
    dst = 0

    for _y in range(height):
        filter_type = raw[src]
        src += 1
        row = bytearray(raw[src : src + stride])
        src += stride

        for x in range(stride):
            left = row[x - bytes_per_pixel] if x >= bytes_per_pixel else 0
            up = prev[x]
            up_left = prev[x - bytes_per_pixel] if x >= bytes_per_pixel else 0

            if filter_type == 0:
                pass
            elif filter_type == 1:
                row[x] = (row[x] + left) & 0xFF
            elif filter_type == 2:
                row[x] = (row[x] + up) & 0xFF
            elif filter_type == 3:
                row[x] = (row[x] + ((left + up) // 2)) & 0xFF
            elif filter_type == 4:
                row[x] = (row[x] + _paeth(left, up, up_left)) & 0xFF
            else:
                raise ValueError(f"unsupported PNG row filter {filter_type}")

        pixels[dst : dst + stride] = row
        dst += stride
        prev = row

    return width, height, pixels


def _filter_row(filter_type: int, row: bytes, prev: bytes, bytes_per_pixel: int) -> bytes:
    out = bytearray(len(row))
    for x, value in enumerate(row):
        left = row[x - bytes_per_pixel] if x >= bytes_per_pixel else 0
        up = prev[x]
        up_left = prev[x - bytes_per_pixel] if x >= bytes_per_pixel else 0

        if filter_type == 0:
            predictor = 0
        elif filter_type == 1:
            predictor = left
        elif filter_type == 2:
            predictor = up
        elif filter_type == 3:
            predictor = (left + up) // 2
        elif filter_type == 4:
            predictor = _paeth(left, up, up_left)
        else:
            raise AssertionError(filter_type)

        out[x] = (value - predictor) & 0xFF
    return bytes(out)


def write_rgba_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    bytes_per_pixel = 4
    stride = width * bytes_per_pixel
    raw = bytearray()
    prev = bytes(stride)

    for y in range(height):
        row = bytes(pixels[y * stride : (y + 1) * stride])
        candidates = []
        for filter_type in range(5):
            filtered = _filter_row(filter_type, row, prev, bytes_per_pixel)
            # Same heuristic used by many PNG encoders: choose the row filter
            # whose residuals are closest to zero when interpreted as signed.
            score = sum(byte if byte < 128 else 256 - byte for byte in filtered)
            candidates.append((score, filter_type, filtered))
        _score, filter_type, filtered = min(candidates, key=lambda item: item[0])
        raw.append(filter_type)
        raw.extend(filtered)
        prev = row

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = PNG_SIGNATURE + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + _chunk(b"IEND", b"")
    path.write_bytes(png)


def normalize_pixels(pixels: bytearray) -> int:
    changed = 0
    for i in range(0, len(pixels), 4):
        if pixels[i + 3] == 0:
            continue

        gray = round((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3)
        normalized = 255 if gray >= WHITE_POINT else gray
        mapped = (normalized, normalized, normalized)

        if (pixels[i], pixels[i + 1], pixels[i + 2]) != mapped:
            pixels[i], pixels[i + 1], pixels[i + 2] = mapped
            changed += 1

    return changed


def iter_targets(paths: Iterable[str]) -> list[Path]:
    targets: list[Path] = []
    for raw in paths:
        path = Path(raw)
        if path.is_dir():
            targets.extend(sorted(path.glob("*.png")))
        else:
            targets.append(path)
    return targets


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", default=["assets/hats"], help="PNG files or directories to normalize")
    args = parser.parse_args()

    for path in iter_targets(args.paths):
        width, height, pixels = read_rgba_png(path)
        changed = normalize_pixels(pixels)
        write_rgba_png(path, width, height, pixels)
        print(f"{path}: normalized {changed} pixels")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
