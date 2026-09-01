import pandas as pd

import sys
from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    client = TestClient(app)

    # 1. Health check
    res = client.get('/api/health')
    assert res.status_code == 200, f"Health check failed: {res.text}"
    data = res.json()
    assert "disclaimer" in data, "Disclaimer missing in health endpoint"
    assert "499" in data["disclaimer"], "Historical event count missing in disclaimer"
    print("Test 1: Health endpoint OK (Disclaimer verified)")

    # 2. Key locations
    res = client.get('/api/key-locations')
    assert res.status_code == 200, f"Key locations failed: {res.text}"
    locations = res.json()["locations"]
    assert len(locations) >= 10, f"Expected 10 locations, got {len(locations)}"
    print(f"Test 2: Key locations OK ({len(locations)} landmark hubs loaded)")

    # 3. Single Prediction (Option B - Random Forest Default)
    res = client.post('/api/predict', json={
        "lat": 6.4698,
        "lon": 3.5852,
        "rainfall_mm": 60.0,
        "rainfall_3d_sum": 120.0,
        "rainfall_7d_sum": 220.0,
        "is_rainy_season": 1,
        "blockage_multiplier": 1.5,
        "model_choice": "random_forest"
    })
    assert res.status_code == 200, f"Predict failed: {res.text}"
    p_data = res.json()
    assert "flood_probability" in p_data, "Flood probability missing"
    assert "risk_tier" in p_data, "Risk tier missing"
    assert "disclaimer" in p_data, "Disclaimer missing in predict response"
    print(f"Test 3: Predict OK (Lekki simulated risk: {p_data['risk_tier']} - {p_data['flood_probability_pct']})")

    # 4. Simulation Batch
    res = client.post('/api/simulate', json={
        "rainfall_mm": 40.0,
        "rainfall_3d_sum": 90.0,
        "rainfall_7d_sum": 160.0,
        "is_rainy_season": 1,
        "blockage_multiplier": 1.0,
        "model_choice": "random_forest"
    })
    assert res.status_code == 200, f"Simulation failed: {res.text}"
    s_data = res.json()
    assert len(s_data["grid_predictions"]) > 0, "No grid predictions in simulation"
    print(f"Test 4: Simulation OK ({len(s_data['grid_predictions'])} grid cells simulated across Lagos)")
    print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()

