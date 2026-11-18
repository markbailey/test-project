import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"


class TestCiWorkflow(unittest.TestCase):
    def setUp(self):
        self.assertTrue(WORKFLOW.is_file(), "missing .github/workflows/ci.yml")
        self.text = WORKFLOW.read_text(encoding="utf-8")

    def test_triggers(self):
        self.assertIn("pull_request:", self.text)
        self.assertIn("push:", self.text)
        self.assertIn("branches: [main]", self.text)

    def test_concurrency_cancels_in_progress(self):
        self.assertIn("concurrency:", self.text)
        self.assertIn("github.ref", self.text)
        self.assertIn("cancel-in-progress: true", self.text)

    def test_setup(self):
        self.assertIn("runs-on: ubuntu-latest", self.text)
        self.assertIn("actions/checkout@", self.text)
        self.assertIn("pnpm/action-setup@", self.text)
        # version comes from packageManager, so none is pinned in the workflow
        self.assertNotIn("version: 9", self.text)
        self.assertIn("actions/setup-node@", self.text)
        self.assertIn("node-version: 20", self.text)
        self.assertIn("cache: pnpm", self.text)
        self.assertIn("actions/setup-python@", self.text)

    def test_steps_in_order(self):
        steps = [
            "pnpm install --frozen-lockfile",
            "pnpm lint",
            "pnpm typecheck",
            "pnpm test",
            "python -m unittest discover -s tests",
            "pnpm build",
            "node apps/wordfreq/bin/wordfreq.js --version",
            "node apps/wordfreq/bin/wordfreq.js --help",
        ]
        positions = [self.text.find(s) for s in steps]
        for step, pos in zip(steps, positions):
            self.assertNotEqual(pos, -1, f"missing step: {step}")
        self.assertEqual(positions, sorted(positions))

    def test_no_failure_masking(self):
        self.assertNotIn("continue-on-error", self.text)
        self.assertNotIn("|| true", self.text)

    def test_readme_mentions_ci(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("## CI", readme)
        self.assertIn(".github/workflows/ci.yml", readme)


if __name__ == "__main__":
    unittest.main()
