import json
import tempfile
import unittest
from pathlib import Path

import torch
import yaml
from PIL import Image

from vitalis_engine.inference import (
    MODEL_CONFIGS,
    _build_model,
    _load_model_state_dict,
    build_model_logits,
)


ROOT = Path(__file__).resolve().parents[1]


class ModelArtifactContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT / "models" / "manifest.json").read_text())["artifacts"]
        cls.dx_list = yaml.safe_load((ROOT / "configs" / "system.yaml").read_text())["dx_list"]

    def test_mri_checkpoint_matches_manifest_and_loads_strictly(self):
        artifact = self.manifest["imaging_mri"]
        checkpoint = torch.load(ROOT / artifact["path"], map_location="cpu", weights_only=True)

        self.assertEqual(artifact["labels"], checkpoint["classes"])
        self.assertEqual(artifact["input_size"], checkpoint["img_size"])
        self.assertIsNone(artifact["normalization"])

        state_dict = _load_model_state_dict(str(ROOT / artifact["path"]))
        model = _build_model(
            MODEL_CONFIGS["resnet18_mri"]["arch"],
            state_dict=state_dict,
            num_classes=len(artifact["labels"]),
        )
        self.assertEqual(tuple(model(torch.zeros(1, 3, 256, 256)).shape), (1, 2))

    def test_skin_model_only_fuses_supported_diagnoses(self):
        artifact = self.manifest["imaging_skin"]
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = Path(tmpdir) / "skin.png"
            Image.new("RGB", (32, 32), color="white").save(image_path)
            _, evidence = build_model_logits(
                {"imaging_skin": artifact},
                self.dx_list,
                upload_skin_image=str(image_path),
            )

        output = evidence["model_outputs"][0]
        self.assertEqual(
            {entry["diagnosis"] for entry in output["diagnoses"]},
            {"MELANOMA", "BASAL_CELL_CARCINOMA", "BENIGN_SKIN_LESION"},
        )
        self.assertNotIn("akiec", {entry["diagnosis"] for entry in output["diagnoses"]})
        self.assertEqual(evidence["upload_results"], [{
            "model_type": "imaging_skin",
            "status": "analyzed",
            "contributed": True,
            "message": "Image analysis contributed to the ranked results.",
        }])

    def test_missing_model_artifact_is_returned_as_a_safe_upload_failure(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = Path(tmpdir) / "skin.png"
            Image.new("RGB", (32, 32), color="white").save(image_path)
            _, evidence = build_model_logits(
                {},
                self.dx_list,
                upload_skin_image=str(image_path),
            )

        self.assertEqual(evidence["model_outputs"], [])
        self.assertEqual(evidence["upload_results"], [{
            "model_type": "imaging_skin",
            "status": "failed",
            "contributed": False,
            "message": "This uploaded image could not be prepared for analysis.",
        }])


if __name__ == "__main__":
    unittest.main()
