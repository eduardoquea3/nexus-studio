#!/usr/bin/env python3
"""Focused, data-only regression checks for confirmed repository findings."""

import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent.parent
FONT_MAGIC = {
    ".ttf": (b"\x00\x01\x00\x00", b"OTTO"),
    ".otf": (b"\x00\x01\x00\x00", b"OTTO"),
    ".woff": (b"wOFF",),
    ".woff2": (b"wOF2",),
}


class RepositorySafetyTests(unittest.TestCase):
    def test_package_entrypoints_are_restored(self):
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(package["scripts"]["dev"], "vite")
        self.assertEqual(package["scripts"]["build"], "tsc && vite build")

    def test_confirmed_loader_files_are_absent(self):
        self.assertFalse((ROOT / "init").exists())
        self.assertFalse((ROOT / "public/fonts/fa-solid-300.ttf").exists())

    def test_vite_has_no_known_remote_eval_markers(self):
        source = (ROOT / "vite.config.ts").read_text(encoding="utf-8").lower()
        for marker in ("eval(",):
            self.assertNotIn(marker, source)

    def test_font_binaries_have_expected_container_signatures(self):
        for path in (ROOT / "public/fonts").iterdir():
            if path.suffix.lower() not in FONT_MAGIC:
                continue
            with self.subTest(font=path.name):
                data = path.read_bytes()
                self.assertTrue(any(data.startswith(magic) for magic in FONT_MAGIC[path.suffix.lower()]),
                                f"unexpected font signature: {path.name}")

    def test_current_editor_configs_have_no_confirmed_task_or_loader_refs(self):
        candidates = (
            ROOT / ".vscode/tasks.json",
            ROOT / ".vscode/settings.json",
            ROOT / ".zed/tasks.json",
            ROOT / ".zed/settings.json",
        )
        for path in candidates:
            if path.is_file():
                data = path.read_text(encoding="utf-8").lower()
                for marker in ("folderopen", "node init", "init.js", "fa-solid-300.ttf"):
                    with self.subTest(config=path.relative_to(ROOT), marker=marker):
                        self.assertNotIn(marker, data)

    def test_ignore_rules_cover_environment_variants_without_self_ignore(self):
        lines = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
        active = {line.strip() for line in lines if line.strip() and not line.lstrip().startswith("#")}
        self.assertNotIn(".gitignore", active)
        self.assertIn(".env", active)
        self.assertIn(".env.*", active)


if __name__ == "__main__":
    unittest.main(verbosity=2)
