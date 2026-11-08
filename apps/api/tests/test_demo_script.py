"""The shell demo exercises the synthetic county workflow without leaking its token."""

import os
import subprocess
from pathlib import Path


def test_demo_script_drives_county_workflow(tmp_path: Path) -> None:
    curl = tmp_path / "curl"
    curl.write_text("""#!/bin/sh
case "$*" in
  *"/overview"*) printf '%s' '{"items":[{"county_code":"042"}]}' ;;
  *"/forecast"*) printf '%s' '{"stockout_period":0}' ;;
  *"/trace"*) printf '%s' '{"bottlenecks":[]}' ;;
  *"/mitigations"*) printf '%s' '{"selected_ids":["transfer"],"explanation":"transfer"}' ;;
  *"/confirm"*) printf '%s' '{"synthetic":true}' ;;
  *"/captures"*) printf '%s' '{"id":"capture-demo"}' ;;
  *"/runs/run-demo"*) printf '%s' '{"status":"succeeded","result":{"stockouts":[
  {"facility_id":"SYN-KE-042-F001","commodity_id":"SYN-C01","day":1}],
  "pre_shock_stockouts":[{"facility_id":"SYN-KE-042-F001","commodity_id":"SYN-C01","day":1}],
  "shock_caused_stockouts":[{"facility_id":"SYN-KE-042-F001","commodity_id":"SYN-C02","day":48}],
  "demo_cases":{"near_expiry_transfer":{"donor_facility_id":"SYN-KE-042-F002",
  "facility_id":"SYN-KE-042-F001","commodity_id":"SYN-C02","quantity":100,
  "available_units":600,"dispatch_day":45,"arrival_day":46,"expiry_day":90,
  "minimum_shelf_days":7,"distance_km":7,"maximum_distance_km":30}}}}' ;;
  *"/runs"*) printf '%s' '{"id":"run-demo"}' ;;
  *) exit 1 ;;
esac
""")
    curl.chmod(0o755)
    docker = tmp_path / "docker"
    docker.write_text("#!/bin/sh\nprintf '%s\\n' '{\"synthetic\":true}'\n")
    docker.chmod(0o755)
    root = Path(__file__).resolve().parents[3]
    env = os.environ | {
        "PATH": f"{tmp_path}:{os.environ['PATH']}",
        "API_TOKEN": "demo.header.signature",
    }
    result = subprocess.run(
        ["bash", str(root / "scripts" / "demo.sh")],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    assert '"selected_ids"' in result.stdout
    assert "Transfer versus emergency for the first shock-caused stockout" in result.stdout
    assert "capture-demo" in result.stdout
    assert env["API_TOKEN"] not in result.stdout + result.stderr
