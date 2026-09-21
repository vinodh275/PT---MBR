import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "metrics.json"
OUTPUT_PATH = ROOT / "data" / "mbr.json"

def request_json(url, method="GET", payload=None, headers=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, method=method)
    request.add_header("Accept", "application/json")
    if body is not None:
        request.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Metabase returned HTTP {error.code}: {detail[:500]}") from error

def auth_headers(base_url):
    api_key = os.environ.get("METABASE_API_KEY")
    if api_key:
        return {"X-API-KEY": api_key}
    username = os.environ.get("METABASE_USERNAME")
    password = os.environ.get("METABASE_PASSWORD")
    if not username or not password:
        raise RuntimeError("Set METABASE_API_KEY or METABASE_USERNAME + METABASE_PASSWORD")
    session = request_json(f"{base_url}/api/session", method="POST", payload={"username": username, "password": password})
    return {"X-Metabase-Session": session["id"]}

def rows_from_result(result):
    data = result.get("data", result)
    columns = [col.get("name") for col in data.get("cols", [])]
    rows = data.get("rows", [])
    if not columns or not rows:
        raise RuntimeError("Query returned no tabular columns/rows")
    return [dict(zip(columns, row)) for row in rows]

def normalize_month(value):
    if value is None:
        return None
    text = str(value)[:10]
    return text[:7] if len(text) >= 7 and text[4] == "-" else text

def main():
    base_url = os.environ.get("METABASE_URL", "https://metabase.curefit.co").rstrip("/")
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    headers = auth_headers(base_url)
    output = {owner: {} for owner in config["ownerships"]}
    errors = []
    for key, metric in config["metrics"].items():
        card_id = metric.get("card_id")
        if not card_id:
            errors.append(f"{key}: missing card_id in config/metrics.json")
            continue
        try:
            result = request_json(f"{base_url}/api/card/{card_id}/query", method="POST", payload={"parameters": []}, headers=headers)
            for row in rows_from_result(result):
                owner = row.get(metric.get("ownership_column", "ownership_type"))
                month = normalize_month(row.get(metric.get("month_column", "dt")))
                value = row.get(metric.get("value_column"))
                if owner not in output or month is None or value is None:
                    continue
                output[owner].setdefault(month, {})[key] = value
        except Exception as error:
            errors.append(f"{key}: {error}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        raise SystemExit("Metabase data pull stopped; no possibly-wrong partial output was published.")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"source": "metabase", "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "data": output}
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Published {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
