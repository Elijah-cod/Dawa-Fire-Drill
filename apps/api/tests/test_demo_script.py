"""Exercise the demo script with synthetic command responses only."""

import os
import subprocess
from pathlib import Path


def test_demo_script_drives_seed_run_and_ranking(tmp_path: Path) -> None:
    curl = tmp_path / "curl"
    curl.write_text("""#!/bin/sh
case "$*" in
  *"/mitigations"*) printf '%s' '{"synthetic":true,"selected_ids":["synthetic-emergency"]}' ;;
  *"/scenarios/"*"/runs"*) printf '%s' '{"id":"run-demo"}' ;;
  *"/runs/run-demo"*) printf '%s' '{"status":"succeeded","result":{"stockouts":[
  {"facility_id":"SYN-KE-F001","commodity_id":"SYN-C01","day":30}]}}' ;;
  *"/scenarios"*) printf '%s' '{"id":"scenario-demo"}' ;;
  *) exit 1 ;;
esac
""")
    curl.chmod(0o755)
    python = tmp_path / "seed-python"
    python.write_text("#!/bin/sh\nprintf '%s\\n' '{\"synthetic\":true}'\n")
    python.chmod(0o755)
    root = Path(__file__).resolve().parents[3]
    env = os.environ | {
        "PATH": f"{tmp_path}:{os.environ['PATH']}",
        "API_TOKEN": "demo.header.signature",
        "DATABASE_URL": "postgresql+asyncpg://example.invalid/dawa",
        "SEED_PYTHON": str(python),
    }
    result = subprocess.run(
        ["bash", str(root / "scripts" / "demo.sh")],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    assert '"selected_ids"' in result.stdout
    assert env["API_TOKEN"] not in result.stdout + result.stderr
