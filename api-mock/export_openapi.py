import json
from pathlib import Path
from app.main import app

# Target output path inside the project root
out = Path(__file__).resolve().parent.parent / "contract" / "openapi.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(
    json.dumps(app.openapi(), indent=2, ensure_ascii=False), encoding="utf-8"
)
print("Wrote OpenAPI spec to", out)
