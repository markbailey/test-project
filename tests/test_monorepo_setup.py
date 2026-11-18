import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class TestMonorepoSetup(unittest.TestCase):
    def load_json(self, name):
        return json.loads((ROOT / name).read_text(encoding="utf-8"))

    def test_root_package_json(self):
        pkg = self.load_json("package.json")
        self.assertTrue(pkg["private"])
        self.assertTrue(pkg["packageManager"].startswith("pnpm@"))
        self.assertIn("turbo", pkg["devDependencies"])
        for script in ("build", "dev", "lint", "test"):
            self.assertIn(f"turbo run {script}", pkg["scripts"][script])

    def test_pnpm_workspace(self):
        text = (ROOT / "pnpm-workspace.yaml").read_text(encoding="utf-8")
        self.assertIn("packages:", text)
        self.assertIn('"apps/*"', text)
        self.assertIn('"packages/*"', text)

    def test_turbo_json(self):
        turbo = self.load_json("turbo.json")
        self.assertIn("$schema", turbo)
        tasks = turbo["tasks"]
        self.assertEqual(tasks["build"]["dependsOn"], ["^build"])
        self.assertFalse(tasks["dev"]["cache"])
        self.assertTrue(tasks["dev"]["persistent"])
        self.assertIn("lint", tasks)
        self.assertIn("test", tasks)

    def test_eslint_setup(self):
        root = self.load_json("package.json")
        for dep in ("eslint", "@eslint/js", "typescript-eslint"):
            self.assertIn(dep, root["devDependencies"])
        self.assertTrue(root["devDependencies"]["eslint"].startswith("^9"))
        config = (ROOT / "eslint.config.js").read_text(encoding="utf-8")
        self.assertIn("js.configs.recommended", config)
        self.assertIn("tseslint.configs.recommended", config)
        self.assertNotIn("recommendedTypeChecked", config)
        for ignored in ("node_modules", "dist", ".turbo", "coverage"):
            self.assertIn(ignored, config)
        for pkg in ("apps/wordfreq", "packages/wordcount"):
            pkg_json = self.load_json(f"{pkg}/package.json")
            self.assertEqual(pkg_json["scripts"]["lint"], "eslint .")
            for dep in ("eslint", "@eslint/js", "typescript-eslint"):
                self.assertNotIn(dep, pkg_json.get("devDependencies", {}))

    def test_workspace_dirs_exist(self):
        self.assertTrue((ROOT / "apps").is_dir())
        self.assertTrue((ROOT / "packages").is_dir())

    def test_gitignore(self):
        text = (ROOT / ".gitignore").read_text(encoding="utf-8")
        for entry in ("node_modules", ".turbo"):
            self.assertIn(entry, text)


if __name__ == "__main__":
    unittest.main()
