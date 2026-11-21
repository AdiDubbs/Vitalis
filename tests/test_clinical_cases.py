import unittest
from pathlib import Path

import yaml

from vitalis_engine import run_case


CASES_PATH = Path(__file__).resolve().parent / "clinical_cases.yaml"


def _load_cases():
    return yaml.safe_load(CASES_PATH.read_text())["cases"]


def _run(case):
    return run_case(
        features={fid: True for fid in case.get("features", [])},
        doctor_note=case.get("note"),
        age=case.get("age"),
        sex=case.get("sex"),
    )


class ClinicalCaseTests(unittest.TestCase):
    """Ranking, red-flag and note-extraction expectations from tests/clinical_cases.yaml."""

    def _check(self, case):
        result = _run(case)
        probs = result["fused_probabilities"]
        ranked = [dx for dx, _ in sorted(probs.items(), key=lambda kv: kv[1], reverse=True)]
        top5 = [(dx, round(probs[dx], 3)) for dx in ranked[:5]]
        fired = {flag["rule_id"] for flag in result["red_flags"]}
        extracted = {fid for fid, val in result["extracted_features"].items() if val}
        expect = case["expect"]

        for dx, k in expect.get("top_k", {}).items():
            self.assertIn(dx, ranked[:k], f"{dx} not in top {k}: {top5}")
        for dx, k in expect.get("not_top_k", {}).items():
            self.assertNotIn(dx, ranked[:k], f"{dx} in top {k}: {top5}")
        if "ranked_above" in expect:
            higher, lower = expect["ranked_above"]
            self.assertLess(ranked.index(higher), ranked.index(lower), f"{higher} below {lower}: {top5}")
        if "max_top_probability" in expect:
            self.assertLessEqual(probs[ranked[0]], expect["max_top_probability"], f"top5: {top5}")
        for dx, p in expect.get("max_probability", {}).items():
            self.assertLessEqual(probs[dx], p + 1e-9, f"{dx}={probs[dx]:.3f}: {top5}")
        for rule in expect.get("red_flags", []):
            self.assertIn(rule, fired)
        for rule in expect.get("no_red_flags", []):
            self.assertNotIn(rule, fired)
        for fid in expect.get("extracted", []):
            self.assertIn(fid, extracted)
        for fid in expect.get("not_extracted", []):
            self.assertNotIn(fid, extracted)


def _make_test(case):
    def test(self):
        self._check(case)

    test.__doc__ = case.get("known_failing") or case["id"]
    return unittest.expectedFailure(test) if case.get("known_failing") else test


for _case in _load_cases():
    setattr(ClinicalCaseTests, f"test_{_case['id']}", _make_test(_case))


if __name__ == "__main__":
    unittest.main()
