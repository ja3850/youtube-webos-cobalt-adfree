#!/usr/bin/env python3
"""Rebuild a released starterless IPK with fresh webapp assets and a new version.

The native Cobalt runtime, ownership, modes and every other archive entry are
copied verbatim from the source IPK; only the adblock web assets and the
version fields are replaced. Nothing is extracted to disk, so no host metadata
(AppleDouble files, local uid/gid) can leak into the package.

Usage: repack-webapp-ipk.py SOURCE.ipk WEBAPP_OUTPUT_DIR VERSION OUT.ipk
"""

from __future__ import annotations

import copy
import gzip
import io
import json
import re
import sys
import tarfile
import time
from pathlib import Path

AR_MAGIC = b"!<arch>\n"
APP_DIR = "usr/palm/applications/youtube.leanback.v4/"
ASSETS = {
    APP_DIR + "content/web/adblock/adblockMain.js": "adblockMain.js",
    APP_DIR + "content/web/adblock/adblockMain.css": "adblockMain.css",
    APP_DIR + "content/web/adblock/adblockPreload.js": "adblockPreload.js",
}
VERSIONED_JSON = (
    APP_DIR + "appinfo.json",
    "usr/palm/packages/youtube.leanback.v4/packageinfo.json",
)


def read_ar(contents: bytes) -> list[tuple[bytes, bytes]]:
    if not contents.startswith(AR_MAGIC):
        raise ValueError("Missing ar archive magic")
    offset, members = len(AR_MAGIC), []
    while offset < len(contents):
        header = contents[offset : offset + 60]
        size = int(header[48:58].decode("ascii").strip())
        offset += 60
        members.append((header, contents[offset : offset + size]))
        offset += size + (size & 1)
    return members


def write_ar(members: list[tuple[bytes, bytes]]) -> bytes:
    out = bytearray(AR_MAGIC)
    for header, data in members:
        out += header[:48] + f"{len(data):<10}".encode("ascii") + header[58:60]
        out += data
        if len(data) & 1:
            out += b"\n"
    return bytes(out)


def set_json_version(raw: bytes, version: str) -> bytes:
    data = json.loads(raw)
    data["version"] = version
    return (json.dumps(data, indent=2) + "\n").encode("utf-8")


def rewrite_tar(blob: bytes, replace) -> tuple[bytes, int]:
    """Copy a .tar.gz, letting replace(name, bytes) return new file bytes."""
    src = tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz")
    raw = io.BytesIO()
    dst = tarfile.open(fileobj=raw, mode="w", format=src.format)
    now, delta = int(time.time()), 0
    for member in src.getmembers():
        info = copy.copy(member)
        if not member.isfile():
            dst.addfile(info)
            continue
        data = src.extractfile(member).read()
        new = replace(member.name, data)
        if new is not None and new != data:
            delta += len(new) - len(data)
            data, info.mtime = new, now
        info.size = len(data)
        dst.addfile(info, io.BytesIO(data))
    dst.close()
    gz = io.BytesIO()
    with gzip.GzipFile(fileobj=gz, mode="wb", mtime=now, compresslevel=9) as stream:
        stream.write(raw.getvalue())
    return gz.getvalue(), delta


def main() -> int:
    if len(sys.argv) != 5:
        print(__doc__, file=sys.stderr)
        return 2
    source, webapp_dir, version, out = sys.argv[1:]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise SystemExit("VERSION must be MAJOR.MINOR.PATCH")
    assets = {name: (Path(webapp_dir) / file).read_bytes() for name, file in ASSETS.items()}
    seen: set[str] = set()

    def replace_data(name: str, data: bytes):
        if name in assets:
            seen.add(name)
            return assets[name]
        if name in VERSIONED_JSON:
            seen.add(name)
            return set_json_version(data, version)
        return None

    members = read_ar(Path(source).read_bytes())
    names = [header[:16].decode("ascii").strip().rstrip("/") for header, _ in members]
    if names != ["debian-binary", "control.tar.gz", "data.tar.gz"]:
        raise SystemExit(f"Unexpected IPK members: {names}")

    data_blob, delta = rewrite_tar(members[2][1], replace_data)
    missing = (set(assets) | set(VERSIONED_JSON)) - seen
    if missing:
        raise SystemExit(f"Source IPK lacks expected entries: {sorted(missing)}")

    def replace_control(name: str, data: bytes):
        if not name.endswith("control"):
            return None
        text = data.decode("utf-8")
        text = re.sub(r"(?m)^Version: .*$", f"Version: {version}", text)
        size = re.search(r"(?m)^Installed-Size: (\d+)$", text)
        if size:
            text = text.replace(size.group(0), f"Installed-Size: {int(size.group(1)) + delta}")
        return text.encode("utf-8")

    control_blob, _ = rewrite_tar(members[1][1], replace_control)
    Path(out).write_bytes(
        write_ar([members[0], (members[1][0], control_blob), (members[2][0], data_blob)])
    )
    print(f"Wrote {out} (version {version}, payload delta {delta:+d} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
