from typing import Any


INCOMING_SCHEMA: dict[str, Any] = {
    "columns": [
        {"name": "kabupaten", "element_name": "wilayah", "data_type": "text"},
        {"name": "jumlah", "element_name": "jumlah", "data_type": "number"},
    ],
    "years": [2024],
}

_SCENARIOS: dict[str, dict[str, Any]] = {
    "new_dataset": {
        "verdict": "new_dataset",
        "similarity": 0.32,
        "reason": "Tidak ditemukan dataset yang cukup serupa.",
        "job_status": "completed",
        "job_message": "Pemrosesan selesai; proposal dataset baru tersedia.",
    },
    "new_source": {
        "verdict": "new_source",
        "similarity": 0.78,
        "reason": "Struktur sesuai dengan dataset yang ada dan sumber berbeda.",
        "job_status": "completed",
        "job_message": "Pemrosesan selesai; sumber baru tersedia untuk ditinjau.",
    },
    "enrichment": {
        "verdict": "enrichment",
        "similarity": 0.92,
        "reason": "Kolom atau tahun baru dapat memperkaya entri yang cocok.",
        "job_status": "completed",
        "job_message": "Pemrosesan selesai; proposal pengayaan tersedia.",
    },
    "duplicate": {
        "verdict": "duplicate",
        "similarity": 1.0,
        "reason": "Data dan periode sudah tercakup pada entri yang cocok.",
        "job_status": "completed",
        "job_message": "Pemrosesan selesai; proposal duplikat tersedia.",
    },
    "needs_review": {
        "verdict": "needs_review",
        "similarity": 0.65,
        "reason": "Hasil pencocokan memerlukan peninjauan manual.",
        "job_status": "completed",
        "job_message": "Pemrosesan selesai; tinjauan manual diperlukan.",
    },
    "failed_job": {
        "verdict": "new_dataset",
        "similarity": 0.0,
        "reason": "Pemrosesan gagal pada skenario uji.",
        "job_status": "failed",
        "job_message": "Pemrosesan gagal pada skenario mock.",
    },
}


def scenario_for(name: str) -> dict[str, Any]:
    try:
        scenario = _SCENARIOS[name]
    except KeyError as exc:
        raise ValueError(f"Skenario mock tidak dikenal: {name}") from exc
    return {**scenario, "incoming": INCOMING_SCHEMA}


def scenario_names() -> set[str]:
    return set(_SCENARIOS)
