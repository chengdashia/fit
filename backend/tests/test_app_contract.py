import importlib
import os
import sys
import unittest

from fastapi.testclient import TestClient


def load_app_with_test_settings():
    os.environ["DATABASE_URL_OVERRIDE"] = "sqlite:////private/tmp/fit-contract-test.db"
    os.environ["AUTO_CREATE_TABLES"] = "false"
    os.environ["SEED_FOODS_ON_STARTUP"] = "false"

    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    return importlib.import_module("app.main").app


class AppContractTest(unittest.TestCase):
    def test_app_import_does_not_require_remote_database(self):
        app = load_app_with_test_settings()
        self.assertEqual(app.title, "健身饮食记录")

    def test_health_uses_standard_response_wrapper(self):
        app = load_app_with_test_settings()
        response = TestClient(app).get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"code": 0, "message": "success", "data": {"status": "ok"}},
        )

    def test_prd_routes_are_registered(self):
        app = load_app_with_test_settings()
        routes = {
            ((method.upper(),), path)
            for path, operations in app.openapi()["paths"].items()
            if path.startswith("/api/")
            for method in operations
        }

        expected_routes = {
            (("GET",), "/api/health"),
            (("POST",), "/api/auth/wechat-login"),
            (("GET",), "/api/user/profile"),
            (("PUT",), "/api/user/profile"),
            (("GET",), "/api/user/goal"),
            (("PUT",), "/api/user/goal"),
            (("GET",), "/api/home/dashboard"),
            (("POST",), "/api/diet/recognize"),
            (("GET",), "/api/diet/foods/search"),
            (("POST",), "/api/diet/records/confirm"),
            (("GET",), "/api/diet/records"),
            (("PUT",), "/api/diet/records/{record_id}"),
            (("DELETE",), "/api/diet/records/{record_id}"),
            (("POST",), "/api/diet/records/{record_id}/revoke"),
            (("GET",), "/api/diet/frequent-foods"),
            (("POST",), "/api/diet/frequent-foods"),
            (("DELETE",), "/api/diet/frequent-foods/{food_id}"),
            (("POST",), "/api/weight/records"),
            (("GET",), "/api/weight/records"),
            (("PUT",), "/api/weight/records/{record_id}"),
            (("DELETE",), "/api/weight/records/{record_id}"),
            (("GET",), "/api/weight/trend"),
            (("POST",), "/api/training/templates"),
            (("GET",), "/api/training/templates"),
            (("GET",), "/api/training/templates/{template_id}"),
            (("PUT",), "/api/training/templates/{template_id}"),
            (("DELETE",), "/api/training/templates/{template_id}"),
            (("POST",), "/api/training/templates/copy-last-session"),
            (("POST",), "/api/training/sessions/start"),
            (("GET",), "/api/training/sessions/unfinished"),
            (("GET",), "/api/training/sessions/history"),
            (("GET",), "/api/training/sessions/{session_id}/history-detail"),
            (("GET",), "/api/training/sessions/{session_id}"),
            (("POST",), "/api/training/sessions/{session_id}/items/add-temp-set"),
            (("POST",), "/api/training/sessions/{session_id}/items/{item_id}/complete"),
            (("POST",), "/api/training/sessions/{session_id}/items/{item_id}/skip"),
            (("POST",), "/api/training/sessions/{session_id}/rest/{rest_id}/skip"),
            (("POST",), "/api/training/sessions/{session_id}/rest/{rest_id}/complete"),
            (("POST",), "/api/training/sessions/{session_id}/rest/{rest_id}/extend"),
            (("POST",), "/api/training/sessions/{session_id}/finish"),
        }

        self.assertTrue(expected_routes.issubset(routes))


if __name__ == "__main__":
    unittest.main()
