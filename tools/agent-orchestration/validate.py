#!/usr/bin/env python3
"""Static validation of Champion Life project-scoped Codex agent files; no network or Git writes."""
from pathlib import Path
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = {
    "church_core", "outreach", "giving_nmi", "partner_platform",
    "discipleship_comms", "global_propel", "security_reviewer",
}
REQUIRED = {"name", "description", "developer_instructions"}

def validate(root: Path) -> list[str]:
    errors: list[str] = []
    cfg_path = root / ".codex" / "config.toml"
    try:
        cfg = tomllib.loads(cfg_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return [f"Invalid or missing .codex/config.toml: {e}"]
    settings = cfg.get("agents", {})
    if settings.get("enabled") is not True:
        errors.append("Project multi-agent support must be explicitly enabled")
    limit = settings.get("max_concurrent_threads_per_session")
    if type(limit) is not int or not 1 <= limit <= 3:
        errors.append("Use an integer concurrency limit of 1 through 3 for the initial rollout")
    definitions = root / ".codex" / "agents"
    files = sorted(definitions.glob("*.toml"))
    if len(files) != len(EXPECTED):
        errors.append(f"Expected exactly {len(EXPECTED)} specialist definitions, found {len(files)}")
    names = []
    for path in files:
        try:
            data = tomllib.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            errors.append(f"{path.name}: invalid TOML: {e}")
            continue
        missing = REQUIRED - data.keys()
        if missing:
            errors.append(f"{path.name}: missing {', '.join(sorted(missing))}")
        name = data.get("name")
        if type(name) is not str or not name:
            errors.append(f"{path.name}: invalid name")
            continue
        names.append(name)
        if path.stem.replace("-", "_") != name:
            errors.append(f"{path.name}: filename/name mismatch ({name})")
        for field in ("description", "developer_instructions"):
            value = data.get(field)
            if type(value) is not str or not value.strip():
                errors.append(f"{path.name}: empty or invalid {field}")
    if len(names) != len(set(names)):
        errors.append("Duplicate custom agent name")
    if set(names) != EXPECTED:
        errors.append("Agent roster mismatch: " + repr(sorted(set(names).symmetric_difference(EXPECTED))))
    for path in ("AGENTS.md", "docs/MASTER-CODEX-OPERATIONS.md"):
        content = (root / path)
        if not content.is_file() or len(content.read_text(encoding="utf-8").strip()) < 500:
            errors.append(f"{path}: missing or incomplete master operating requirements")
    return errors

if __name__ == "__main__":
    bad = validate(ROOT)
    if bad:
        print("Master Codex configuration FAIL:")
        for error in bad:
            print(" -", error)
        sys.exit(1)
    print("Master Codex configuration PASS: 7 project agents, concurrency cap 3, TOML valid.")
    print("This is a static check only: no agent sessions started, no provider authorization verified.")
