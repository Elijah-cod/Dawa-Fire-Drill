"""The local demo session scripts refuse non-local use and never reveal the token or secret."""

import os
import stat
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
TOKEN = "synthetic-demo.token-payload.token-signature"


def fake(path: Path, body: str) -> None:
    path.write_text("#!/bin/sh\n" + body)
    path.chmod(0o755)


@pytest.fixture
def tools(tmp_path: Path) -> Path:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    log = tmp_path / "calls.log"
    secret = tmp_path / "secret-seen"
    seen = tmp_path / "token-seen"
    fake(
        bin_dir / "docker",
        'printf "docker %s switcher=%s limit=%s\\n" "$*" "$DEMO_ROLE_SWITCHER" '
        f'"$RATE_LIMIT_PER_MINUTE" >> {log}\n'
        f'printf "%s" "$SUPABASE_JWT_SECRET" > {secret}\n',
    )
    fake(bin_dir / "curl", "exit 0\n")
    fake(bin_dir / "lsof", "exit 1\n")
    fake(bin_dir / "uv", f"printf '%s\\n' '{TOKEN}'\n")
    fake(
        bin_dir / "npm",
        f'printf "npm %s\\n" "$*" >> {log}\n'
        'case "$*" in *start*)\n'
        f'  if [ "$DEMO_API_TOKEN" = "{TOKEN}" ]; then echo yes > {seen};\n'
        f"  else echo no > {seen}; fi\n"
        "  echo 'Next server ready'\n"
        "  exec sleep 30 ;;\n"
        "esac\n"
        "echo 'build done'\n",
    )
    return tmp_path


def run(script: str, tmp_path: Path, *args: str, **extra: str) -> subprocess.CompletedProcess[str]:
    env = os.environ | {
        "PATH": f"{tmp_path / 'bin'}:{os.environ['PATH']}",
        "DAWA_DEMO_STATE_DIR": str(tmp_path / "state"),
    }
    env.pop("APP_ENV", None)
    env.update(extra)
    return subprocess.run(
        ["bash", str(ROOT / "scripts" / script), *args],
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )


@pytest.mark.parametrize("script", ["demo-up.sh", "demo-down.sh"])
def test_refuses_production(script: str, tools: Path) -> None:
    result = run(script, tools, APP_ENV="production")
    assert result.returncode != 0
    assert "Refusing" in result.stderr
    assert not (tools / "calls.log").exists()


@pytest.mark.parametrize("script", ["demo-up.sh", "demo-down.sh"])
def test_refuses_other_compose_file(script: str, tools: Path) -> None:
    other = tools / "compose.yaml"
    other.write_text("services: {}\n")
    result = run(script, tools, DAWA_COMPOSE_FILE=str(other))
    assert result.returncode != 0
    assert "only the local infra/compose.yaml" in result.stderr
    assert not (tools / "calls.log").exists()


def test_refuses_when_web_port_is_busy(tools: Path) -> None:
    fake(tools / "bin" / "lsof", "exit 0\n")
    result = run("demo-up.sh", tools)
    assert result.returncode != 0
    assert "port 3300 is in use" in result.stderr
    assert not (tools / "calls.log").exists()


def test_up_passes_token_by_environment_only_and_down_restores(tools: Path) -> None:
    up = run("demo-up.sh", tools)
    state = tools / "state"
    try:
        assert up.returncode == 0, up.stderr
        secret = (tools / "secret-seen").read_text()
        assert len(secret) >= 40
        assert (tools / "token-seen").read_text().strip() == "yes"
        written = "".join(p.read_text() for p in state.iterdir() if p.is_file())
        for value in (TOKEN, secret):
            assert value not in up.stdout + up.stderr
            assert value not in written
            assert value not in (tools / "calls.log").read_text()
        assert stat.S_IMODE(state.stat().st_mode) == 0o700
        assert not (state / "build.log").exists()
        calls = (tools / "calls.log").read_text()
        assert "up -d --no-deps --no-build api switcher=true limit=600" in calls
        assert "npm run build" in calls
        assert "npm run start -- -p 3300" in calls
        assert "http://localhost:3300/kisumu" in up.stdout
        pid = int((state / "web.pid").read_text())
    finally:
        down = run("demo-down.sh", tools)
    assert down.returncode == 0, down.stderr
    assert "API restored to default settings" in down.stdout
    assert "switcher=false limit=60" in (tools / "calls.log").read_text().splitlines()[-1]
    assert (tools / "secret-seen").read_text() == ""
    assert not state.exists()
    with pytest.raises(ProcessLookupError):
        os.kill(pid, 0)


def test_up_passes_canary_only_to_an_explicit_local_check(tools: Path) -> None:
    check = 'test "$E2E_DEMO_TOKEN" = "' + TOKEN + '" && pwd && echo canary-ok'
    up = run("demo-up.sh", tools, "--", "sh", "-c", check)
    try:
        assert up.returncode == 0, up.stderr
        assert "canary-ok" in up.stdout
        assert up.stdout.rstrip().splitlines()[-2].endswith("apps/web")
        assert TOKEN not in up.stdout + up.stderr
        failing = run("demo-down.sh", tools)
        assert failing.returncode == 0
        up = run("demo-up.sh", tools, "--", "sh", "-c", "exit 3")
        assert up.returncode == 3
    finally:
        run("demo-down.sh", tools)
