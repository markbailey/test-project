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
        for script in ("build", "dev", "lint", "test", "typecheck"):
            self.assertIn(f"turbo run {script}", pkg["scripts"][script])

    def test_packages_typecheck(self):
        for name in ("apps/wordfreq", "packages/wordcount"):
            pkg = self.load_json(f"{name}/package.json")
            self.assertEqual(pkg["scripts"]["typecheck"], "tsc --noEmit -p .", name)
            for dep in ("typescript", "@types/node"):
                self.assertIn(dep, pkg["devDependencies"], name)
            tsconfig = self.load_json(f"{name}/tsconfig.json")
            self.assertTrue(tsconfig["compilerOptions"]["strict"], name)
            self.assertIn("tests", tsconfig["include"], name)

    def test_lockfile_has_wordcount_types_node(self):
        text = (ROOT / "pnpm-lock.yaml").read_text(encoding="utf-8")
        section = text.split("  packages/wordcount:", 1)[1].split("\npackages:", 1)[0]
        self.assertIn("'@types/node':", section)

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
        self.assertEqual(tasks["typecheck"]["dependsOn"], ["^typecheck"])

    def test_workspace_dirs_exist(self):
        self.assertTrue((ROOT / "apps").is_dir())
        self.assertTrue((ROOT / "packages").is_dir())

    def test_gitignore(self):
        text = (ROOT / ".gitignore").read_text(encoding="utf-8")
        for entry in ("node_modules", ".turbo"):
            self.assertIn(entry, text)


if __name__ == "__main__":
    unittest.main()
