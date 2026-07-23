import io
import json
import stat
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

from werkzeug.datastructures import FileStorage, MultiDict

from form_app import INTAKE_SCHEMA, _validate_submission, app


class SubmissionValidationTests(unittest.TestCase):
    def setUp(self):
        self.case_storage = tempfile.TemporaryDirectory()
        self.original_case_storage = app.config["CASE_STORAGE_ROOT"]
        self.original_testing = app.config.get("TESTING")
        app.config.update(CASE_STORAGE_ROOT=Path(self.case_storage.name), TESTING=True)
        self.client = app.test_client()

    def tearDown(self):
        app.config.update(
            CASE_STORAGE_ROOT=self.original_case_storage,
            TESTING=self.original_testing,
        )
        self.case_storage.cleanup()

    @staticmethod
    def _analysis_result():
        return {
            "fused_probabilities": {"INFLUENZA": 0.5},
            "model_outputs": [],
        }

    def test_intake_schema_is_available_to_the_client(self):
        response = self.client.get("/api/intake-schema")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), INTAKE_SCHEMA)

    def test_health_endpoint_reports_required_runtime_assets(self):
        response = self.client.get("/api/health")

        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["status"], "ok")
        self.assertTrue(all(check["ok"] for check in payload["checks"].values()))

    def test_valid_optional_demographics_and_empty_symptoms_are_accepted(self):
        submission, errors = _validate_submission(
            MultiDict({"age": "30", "sex": "FEMALE", "symptoms": "[]"}),
            MultiDict(),
        )

        self.assertEqual(errors, {})
        self.assertEqual(submission["age"], 30)
        self.assertEqual(submission["sex"], "FEMALE")
        self.assertEqual(submission["symptoms"], [])

    def test_invalid_age_sex_and_symptoms_return_structured_errors(self):
        response = self.client.post(
            "/api/submit",
            data={"age": "121", "sex": "OTHER", "symptoms": json.dumps(["unknown"])},
        )

        payload = response.get_json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["status"], "error")
        self.assertEqual(set(payload["errors"]), {"age", "sex", "symptoms"})

    def test_unsupported_upload_is_rejected_before_inference(self):
        response = self.client.post(
            "/api/submit",
            data={
                "symptoms": "[]",
                "upload_image": (io.BytesIO(b"not a DICOM image"), "scan.dcm"),
            },
        )

        payload = response.get_json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["errors"]["upload_image"], "Supported formats: PNG, JPG.")

    def test_fracture_upload_requires_a_supported_body_part(self):
        upload = FileStorage(
            stream=io.BytesIO(b"image"),
            filename="fracture.png",
            content_type="image/png",
        )
        _, errors = _validate_submission(
            MultiDict({"symptoms": "[]"}),
            MultiDict({"upload_fracture": upload}),
        )

        self.assertEqual(
            errors["fracture_body_part"],
            "Select the body part shown in the fracture image.",
        )

    def test_case_storage_uses_session_bound_uuid_and_excludes_raw_inputs(self):
        with patch("form_app.run_case", return_value=self._analysis_result()):
            response = self.client.post(
                "/api/submit",
                data={
                    "age": "30",
                    "sex": "FEMALE",
                    "symptoms": "[]",
                    "doctor_note": "Sensitive clinical note",
                    "doctor_note_upload": (io.BytesIO(b"Sensitive uploaded note"), "note.txt"),
                    "upload_image": (io.BytesIO(b"image data"), "scan.png"),
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        case_id = response.get_json()["case_id"]
        self.assertEqual(str(UUID(case_id)), case_id)

        result_path = Path(self.case_storage.name) / case_id / "result.json"
        self.assertTrue(result_path.exists())
        self.assertEqual(stat.S_IMODE(result_path.parent.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(result_path.stat().st_mode), 0o600)
        self.assertFalse((result_path.parent / "inference-inputs").exists())
        saved_case = json.loads(result_path.read_text(encoding="utf-8"))
        self.assertNotIn("doctor_note", saved_case)
        self.assertNotIn("attachments", saved_case)
        self.assertNotIn("Sensitive clinical note", result_path.read_text(encoding="utf-8"))
        self.assertNotIn("Sensitive uploaded note", result_path.read_text(encoding="utf-8"))

        authorized_response = self.client.get(f"/api/cases/{case_id}")
        self.assertEqual(authorized_response.status_code, 200)
        self.assertEqual(authorized_response.headers["Cache-Control"], "no-store")

        other_browser_response = app.test_client().get(f"/api/cases/{case_id}")
        self.assertEqual(other_browser_response.status_code, 404)

    def test_real_submit_then_session_bound_result_retrieval(self):
        response = self.client.post("/api/submit", data={"symptoms": "[]"})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "success")
        self.assertIn("fused_probabilities", payload["analysis"])
        self.assertEqual(payload["analysis"]["upload_results"], [])

        restored = self.client.get(f"/api/cases/{payload['case_id']}")
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.get_json()["analysis"], payload["analysis"])

    def test_unreadable_image_returns_a_visible_upload_failure(self):
        response = self.client.post(
            "/api/submit",
            data={
                "symptoms": "[]",
                "upload_image": (io.BytesIO(b"not a real PNG"), "scan.png"),
            },
        )

        self.assertEqual(response.status_code, 200)
        upload_results = response.get_json()["analysis"]["upload_results"]
        self.assertEqual(upload_results, [{
            "model_type": "imaging_xray",
            "status": "failed",
            "contributed": False,
            "message": "This uploaded image could not be analyzed. Try a clear PNG or JPG.",
        }])

    def test_failed_case_removes_temporary_inputs_and_partial_storage(self):
        with patch("form_app.run_case", side_effect=RuntimeError("model failure")):
            response = self.client.post(
                "/api/submit",
                data={
                    "symptoms": "[]",
                    "doctor_note_upload": (io.BytesIO(b"Sensitive uploaded note"), "note.txt"),
                },
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(list(Path(self.case_storage.name).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
