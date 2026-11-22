import importlib.util
import json
import shutil
import unittest
import uuid
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[2] / "scripts" / "media_trial.py"
SPEC = importlib.util.spec_from_file_location("media_trial", MODULE_PATH)
media_trial = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(media_trial)
TEST_TEMP = media_trial.ROOT / ".siftory" / "test-temp"
TEST_TEMP.mkdir(parents=True, exist_ok=True)


@contextmanager
def test_directory():
    path = TEST_TEMP / uuid.uuid4().hex
    path.mkdir()
    try:
        yield path
    finally:
        if path.resolve().is_relative_to(TEST_TEMP.resolve()):
            shutil.rmtree(path)


class MediaTrialTests(unittest.TestCase):
    def test_only_direct_https_instagram_media_links_are_accepted(self):
        url, key = media_trial.instagram_source("https://instagram.com/reel/Abc_123/?utm_source=share")
        self.assertEqual(url, "https://www.instagram.com/reel/Abc_123/")
        self.assertEqual(key, "instagram-reel-Abc_123")
        for bad in (
            "http://instagram.com/reel/Abc_123/",
            "https://instagram.com.evil.test/reel/Abc_123/",
            "https://user:pass@instagram.com/reel/Abc_123/",
            "https://instagram.com:444/reel/Abc_123/",
            "https://instagram.com/accounts/login/",
            "https://instagram.com/reel/Abc_123/extra/",
        ):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                media_trial.instagram_source(bad)

    def test_export_keeps_row_identity_and_deduplicates(self):
        with test_directory() as directory:
            path = directory / "saved.json"
            path.write_text(json.dumps([
                {"label_values": [{"href": "https://www.instagram.com/reel/Abc_123/"}]},
                {"label_values": [{"href": "https://www.instagram.com/reel/Abc_123/?x=1"}]},
                {"label_values": [{"href": "https://evil.test/reel/Nope123/"}]},
                {"label_values": [{"href": "https://www.instagram.com/p/Def_456/"}]},
            ]), encoding="utf-8")
            sources = media_trial.export_sources(path, 20)
            self.assertEqual([entry["rowIndex"] for entry in sources], [0, 3])
            self.assertEqual([entry["key"] for entry in sources], ["instagram-reel-Abc_123", "instagram-p-Def_456"])
            self.assertEqual(len(media_trial.export_sources(path, 1)), 1)

    def test_local_result_is_published_only_after_both_artifacts_exist(self):
        with test_directory() as root:
            source = root / "source.mp4"
            source.write_bytes(b"synthetic media")
            item = media_trial.local_source(source)

            def fake_extract(_source, audio):
                audio.write_bytes(b"RIFF synthetic audio")

            def fake_transcribe(_audio, srt, _model, _language):
                srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nHello\n", encoding="utf-8")
                return 1

            with patch.object(media_trial, "extract_audio", side_effect=fake_extract), patch.object(media_trial, "transcribe", side_effect=fake_transcribe):
                first = media_trial.process(item, root, "base", None, False, False)
                second = media_trial.process(item, root, "base", None, False, False)
                third = media_trial.process(item, root, "base", None, False, True)
            self.assertEqual(first["status"], "completed")
            self.assertEqual(second["status"], "already-exists")
            self.assertEqual(third["status"], "completed")
            self.assertNotEqual(first["folder"], third["folder"])
            self.assertTrue((Path(first["folder"]) / "audio.wav").is_file())
            self.assertTrue((Path(first["folder"]) / "transcript.srt").is_file())
            self.assertEqual(source.read_bytes(), b"synthetic media")

    def test_existing_audio_is_transcribed_without_download_again(self):
        with test_directory() as root:
            key = "instagram-reel-Abc_123"
            folder = root / key
            folder.mkdir()
            (folder / "audio.wav").write_bytes(b"RIFF synthetic audio")
            source = {"kind": "instagram", "key": key, "url": "https://www.instagram.com/reel/Abc_123/", "rowIndex": 4}

            def fake_transcribe(_audio, srt, _model, _language):
                srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nHello\n", encoding="utf-8")
                return 1

            with patch.object(media_trial, "download_public_video") as download, patch.object(media_trial, "transcribe", side_effect=fake_transcribe):
                result = media_trial.process(source, root, "base", None, False, False)
            download.assert_not_called()
            self.assertEqual(result["status"], "completed")
            self.assertEqual(result["rowIndex"], 4)
            self.assertTrue((folder / "transcript.srt").is_file())

    def test_failure_does_not_publish_partial_files_or_private_error_text(self):
        with test_directory() as root:
            source = root / "source.mp4"
            source.write_bytes(b"synthetic media")
            item = media_trial.local_source(source)
            with patch.object(media_trial, "extract_audio", side_effect=RuntimeError("private URL token=secret")):
                result = media_trial.process(item, root, "base", None, False, False)
            self.assertEqual(result["status"], "failed")
            self.assertNotIn("secret", json.dumps(result))
            self.assertFalse((root / item["key"]).exists())

    def test_subtitle_timing_rounds_to_milliseconds(self):
        self.assertEqual(media_trial.srt_timestamp(3661.2345), "01:01:01,234")


if __name__ == "__main__":
    unittest.main()
