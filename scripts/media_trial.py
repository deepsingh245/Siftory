"""Local, opt-in media-to-audio/transcript trial for Siftory.

This command never uses Instagram credentials or browser cookies. Its URL
extractor may fail when Instagram does not expose a public video.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / ".siftory" / "media"
os.environ.setdefault("HF_HOME", str(ROOT / ".siftory" / "model-cache"))
MAX_EXPORT_BYTES = 10 * 1024 * 1024
MAX_ROWS = 5_000
MAX_BATCH = 20
MAX_MEDIA_BYTES = 250 * 1024 * 1024
MAX_TRANSCRIPT_CHARACTERS = 100_000
SHORTCODE = re.compile(r"^[A-Za-z0-9_-]{5,32}$")
KINDS = {"p", "reel", "tv"}


def instagram_source(value: str) -> tuple[str, str]:
    """Return a canonical URL and filesystem-safe key for an Instagram post."""
    try:
        parts = urlsplit(value)
        path = parts.path.strip("/").split("/")
        valid = (
            parts.scheme == "https"
            and parts.hostname in {"instagram.com", "www.instagram.com"}
            and parts.port is None
            and not parts.username
            and not parts.password
            and len(path) == 2
            and path[0] in KINDS
            and SHORTCODE.fullmatch(path[1]) is not None
        )
    except ValueError:
        valid = False
    if not valid:
        raise ValueError("Expected a direct HTTPS Instagram post or Reel URL.")
    kind, code = path
    return f"https://www.instagram.com/{kind}/{code}/", f"instagram-{kind}-{code}"


def export_sources(file_path: Path, max_items: int) -> list[dict]:
    if not file_path.is_file() or file_path.stat().st_size > MAX_EXPORT_BYTES:
        raise ValueError("Choose an Instagram JSON export up to 10 MiB.")
    try:
        rows = json.loads(file_path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError("The Instagram JSON export could not be read.") from error
    if not isinstance(rows, list) or len(rows) > MAX_ROWS:
        raise ValueError("Expected an Instagram JSON array with at most 5,000 rows.")
    sources: list[dict] = []
    seen: set[str] = set()
    for index, row in enumerate(rows):
        if len(sources) >= max_items:
            break
        if not isinstance(row, dict):
            continue
        labels = row.get("label_values")
        if not isinstance(labels, list):
            continue
        for label in labels:
            if not isinstance(label, dict) or not isinstance(label.get("href"), str):
                continue
            try:
                url, key = instagram_source(label["href"])
            except ValueError:
                continue
            if key in seen:
                break
            seen.add(key)
            sources.append({"kind": "instagram", "key": key, "url": url, "rowIndex": index})
            break
    return sources


def local_source(file_path: Path) -> dict:
    if not file_path.is_file() or not file_path.stat().st_size or file_path.stat().st_size > MAX_MEDIA_BYTES:
        raise ValueError("Choose a non-empty local media file up to 250 MiB.")
    digest = hashlib.sha256()
    with file_path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"kind": "file", "key": f"local-{digest.hexdigest()[:20]}", "path": str(file_path.resolve())}


def download_public_video(url: str, work: Path) -> Path:
    try:
        import yt_dlp
    except ImportError as error:
        raise RuntimeError("Install scripts/media-requirements.txt to try Instagram links.") from error
    # No cookie, login, proxy, or bypass options. Do not repeatedly probe failures.
    class QuietLogger:
        def debug(self, _message: str) -> None: pass
        def warning(self, _message: str) -> None: pass
        def error(self, _message: str) -> None: pass

    options = {
        "outtmpl": str(work / "source.%(ext)s"),
        "format": "bestaudio/best",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 0,
        "fragment_retries": 0,
        "extractor_retries": 0,
        "ignoreerrors": False,
        "overwrites": False,
        "max_filesize": MAX_MEDIA_BYTES,
        "cookiefile": None,
        "cookiesfrombrowser": None,
        "logger": QuietLogger(),
    }
    with yt_dlp.YoutubeDL(options) as downloader:
        downloader.download([url])
    files = [path for path in work.iterdir() if path.is_file() and path.name.startswith("source.")]
    if len(files) != 1 or files[0].stat().st_size > MAX_MEDIA_BYTES:
        raise RuntimeError("No single video was available within the 250 MiB limit.")
    return files[0]


def extract_audio(source: Path, destination: Path) -> None:
    try:
        import imageio_ffmpeg
    except ImportError as error:
        raise RuntimeError("Install scripts/media-requirements.txt to extract audio.") from error
    result = subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
         "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(destination)],
        capture_output=True, text=True, check=False, timeout=600,
    )
    if result.returncode or not destination.is_file() or not destination.stat().st_size:
        raise RuntimeError("The media has no usable audio stream or FFmpeg could not extract it.")


def srt_timestamp(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def transcribe(audio: Path, destination: Path, model_name: str, language: str | None) -> int:
    try:
        from faster_whisper import WhisperModel
    except ImportError as error:
        raise RuntimeError("Install scripts/media-requirements.txt to transcribe audio.") from error
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(str(audio), language=language, vad_filter=True, condition_on_previous_text=False)
    cues: list[str] = []
    total = 0
    for segment in segments:
        words = segment.text.strip()
        if not words or segment.end <= segment.start:
            continue
        total += len(words)
        if total > MAX_TRANSCRIPT_CHARACTERS:
            raise RuntimeError("The generated transcript exceeds Siftory's 100,000-character limit.")
        cues.append(f"{len(cues) + 1}\n{srt_timestamp(segment.start)} --> {srt_timestamp(segment.end)}\n{words}\n")
    if cues:
        destination.write_text("\n".join(cues), encoding="utf-8")
    return len(cues)


def process(source: dict, output_root: Path, model: str, language: str | None, audio_only: bool, rerun: bool) -> dict:
    key = source["key"]
    target = output_root / key
    if target.exists():
        if not rerun:
            audio = target / "audio.wav"
            subtitles = target / "transcript.srt"
            if not audio_only and target.is_dir() and target.resolve().is_relative_to(output_root.resolve()) and audio.is_file() and not subtitles.exists():
                pending = target / f".transcript-{uuid.uuid4().hex}.srt"
                try:
                    cues = transcribe(audio, pending, model, language)
                    if cues:
                        os.replace(pending, subtitles)
                    return {"key": key, "rowIndex": source.get("rowIndex"), "status": "completed" if cues else "no-speech-detected", "folder": str(target), "cues": cues}
                except Exception as error:
                    return {"key": key, "rowIndex": source.get("rowIndex"), "status": "failed", "reason": failure_reason(error)}
                finally:
                    pending.unlink(missing_ok=True)
            return {"key": key, "rowIndex": source.get("rowIndex"), "status": "already-exists", "folder": str(target)}
        suffix = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        target = output_root / f"{key}-{suffix}"
    work = output_root / f".processing-{uuid.uuid4().hex}"
    try:
        work.mkdir()
        media = Path(source["path"]) if source["kind"] == "file" else download_public_video(source["url"], work)
        if media.stat().st_size > MAX_MEDIA_BYTES:
            raise RuntimeError("Media exceeds the 250 MiB limit.")
        audio = work / "audio.wav"
        extract_audio(media, audio)
        cues = 0 if audio_only else transcribe(audio, work / "transcript.srt", model, language)
        if source["kind"] == "instagram":
            media.unlink(missing_ok=True)
        work.rename(target)
        status = "audio-only" if audio_only else "completed" if cues else "no-speech-detected"
        return {"key": key, "rowIndex": source.get("rowIndex"), "status": status, "folder": str(target), "cues": cues}
    except Exception as error:
        # The full extractor exception can include private URLs or account details.
        return {"key": key, "rowIndex": source.get("rowIndex"), "status": "failed", "reason": failure_reason(error)}
    finally:
        if work.exists() and work.resolve().is_relative_to(output_root.resolve()):
            shutil.rmtree(work)


def failure_reason(error: Exception) -> str:
    message = str(error).lower()
    if "install scripts/media-requirements.txt" in message:
        return "Optional media dependencies are not installed."
    if any(word in message for word in ("login", "private", "403", "401", "429", "rate limit", "sign in")):
        return "Instagram requires access or limited this request; no retry or bypass was attempted."
    if "no usable audio" in message:
        return "The source has no usable audio stream."
    if "transcript exceeds" in message:
        return "The generated transcript exceeds Siftory's character limit."
    if isinstance(error, subprocess.TimeoutExpired):
        return "Local audio extraction timed out."
    return "The source could not be processed. See the local tool documentation and try an accessible media file."


def write_manifest(path: Path, manifest: dict) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    choice = parser.add_mutually_exclusive_group(required=True)
    choice.add_argument("--file", type=Path, help="Local video or audio file")
    choice.add_argument("--url", help="Public direct Instagram post or Reel URL")
    choice.add_argument("--instagram-json", type=Path, help="Instagram saved-links JSON export")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--max-items", type=int, default=10, help="JSON rows to attempt, 1-20 (default: 10)")
    parser.add_argument("--audio-only", action="store_true", help="Extract audio without downloading a speech model")
    parser.add_argument("--model", choices=["tiny", "base", "small"], default="base")
    parser.add_argument("--language", help="Optional speech language code, e.g. en or hi")
    parser.add_argument("--rerun", action="store_true", help="Create a new result folder if one already exists")
    args = parser.parse_args(argv)
    if not 1 <= args.max_items <= MAX_BATCH:
        parser.error("--max-items must be between 1 and 20.")
    try:
        if args.file:
            sources = [local_source(args.file)]
        elif args.url:
            url, key = instagram_source(args.url)
            sources = [{"kind": "instagram", "key": key, "url": url}]
        else:
            sources = export_sources(args.instagram_json, args.max_items)
    except ValueError as error:
        parser.error(str(error))
    if not sources:
        parser.error("No supported direct Instagram post or Reel links were found.")
    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / f"run-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}.json"
    manifest = {"version": 1, "startedAt": datetime.now(timezone.utc).isoformat(), "inputKind": "file" if args.file else "url" if args.url else "instagram-json", "transcriptionModel": None if args.audio_only else args.model, "language": args.language, "results": []}
    write_manifest(manifest_path, manifest)
    for source in sources:
        result = process(source, args.output, args.model, args.language, args.audio_only, args.rerun)
        manifest["results"].append(result)
        write_manifest(manifest_path, manifest)
        print(f"{result['key']}: {result['status']}", flush=True)
    print(f"Manifest: {manifest_path}")
    return 1 if any(result["status"] == "failed" for result in manifest["results"]) else 0


if __name__ == "__main__":
    sys.exit(main())
