#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


HOST = "127.0.0.1"
PORT = 8787
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-20250514"
VERSION = "2023-06-01"
KEY_FILE = Path(__file__).with_name(".resumeiq_api_key")
LEGACY_KEY_FILE = Path(__file__).with_name("resume anazyaler") / ".resumeiq_api_key"


def load_api_key() -> str:
    env_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if env_key:
        return env_key
    if KEY_FILE.exists():
        key = KEY_FILE.read_text(encoding="utf-8").strip()
        if key:
            return key
    if LEGACY_KEY_FILE.exists():
        key = LEGACY_KEY_FILE.read_text(encoding="utf-8").strip()
        if key:
            return key
    return ""


def build_prompt(text: str, job_role: str, exp_level: str, industry: str) -> str:
    return f"""You are an expert resume analyst and career coach. Analyze this resume and return ONLY a valid JSON object (no markdown, no backticks, no extra text).

Resume:
\"\"\"
{text[:3000]}
\"\"\"

Target Role: {job_role}
Experience Level: {exp_level}
Industry: {industry}

Return this exact JSON structure:
{{
  "overallScore": <number 0-100>,
  "verdict": "<one of: Exceptional|Strong|Average|Needs Work>",
  "title": "<2-5 word punchy title like 'Strong Tech Profile' or 'Needs More Impact'>",
  "summary": "<2 sentence honest assessment>",
  "metrics": [
    {{"icon": "🎯", "name": "Impact Statements", "score": <0-100>, "color": "#8be9ff"}},
    {{"icon": "🔑", "name": "Keywords Match", "score": <0-100>, "color": "#7c8cff"}},
    {{"icon": "📐", "name": "Formatting", "score": <0-100>, "color": "#ff6b81"}},
    {{"icon": "📊", "name": "Quantified Results", "score": <0-100>, "color": "#f6c36b"}},
    {{"icon": "🛠️", "name": "Technical Skills", "score": <0-100>, "color": "#67e8f9"}},
    {{"icon": "✍️", "name": "Writing Quality", "score": <0-100>, "color": "#a8ff78"}}
  ],
  "presentSkills": ["<skill1>","<skill2>","<skill3>","<skill4>","<skill5>"],
  "missingSkills": ["<gap1>","<gap2>","<gap3>","<gap4>"],
  "strongPoints": ["<point1>","<point2>","<point3>"],
  "weakPoints": ["<weak1>","<weak2>","<weak3>"],
  "atsScore": <number 0-100>,
  "atsChecks": [
    {{"icon": "📄", "text": "Single-column layout", "status": "<pass|fail|warn>"}},
    {{"icon": "🔤", "text": "Standard section headings", "status": "<pass|fail|warn>"}},
    {{"icon": "📏", "text": "Resume length appropriate", "status": "<pass|fail|warn>"}},
    {{"icon": "🔗", "text": "Contact info present", "status": "<pass|fail|warn>"}},
    {{"icon": "📅", "text": "Dates formatted correctly", "status": "<pass|fail|warn>"}},
    {{"icon": "🎯", "text": "Job title keywords included", "status": "<pass|fail|warn>"}}
  ],
  "suggestions": [
    {{"title": "<action title>", "text": "<2 sentence specific advice>"}},
    {{"title": "<action title>", "text": "<2 sentence specific advice>"}},
    {{"title": "<action title>", "text": "<2 sentence specific advice>"}},
    {{"title": "<action title>", "text": "<2 sentence specific advice>"}},
    {{"title": "<action title>", "text": "<2 sentence specific advice>"}}
  ]
}}"""


def parse_model_json(raw_text: str) -> dict:
    clean = raw_text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)


class ResumeIQHandler(BaseHTTPRequestHandler):
    server_version = "ResumeIQProxy/1.0"

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return

    def _set_headers(self, status_code: int = 200) -> None:
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._set_headers(204)

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/analyze":
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Route not found."}).encode("utf-8"))
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "Invalid JSON payload."}).encode("utf-8"))
            return

        text = str(payload.get("text", "")).strip()
        job_role = str(payload.get("jobRole", "Software Developer")).strip() or "Software Developer"
        exp_level = str(payload.get("expLevel", "junior")).strip() or "junior"
        industry = str(payload.get("industry", "tech")).strip() or "tech"

        if len(text) < 50:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "Resume text must be at least 50 characters."}).encode("utf-8"))
            return

        api_key = load_api_key()
        if not api_key:
            self._set_headers(500)
            self.wfile.write(
                json.dumps(
                    {
                        "error": (
                            "ERROR! Backend API Key is not ready, so wait until the further update."
                        )
                    }
                ).encode("utf-8")
            )
            return

        anthropic_payload = {
            "model": MODEL,
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": build_prompt(text, job_role, exp_level, industry)}],
        }

        request = urllib.request.Request(
            ANTHROPIC_URL,
            data=json.dumps(anthropic_payload).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": VERSION,
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read().decode("utf-8")
                data = json.loads(raw)
        except urllib.error.HTTPError as exc:
            error_text = exc.read().decode("utf-8", errors="replace")
            try:
                error_data = json.loads(error_text)
                message = error_data.get("error", {}).get("message", error_text)
            except Exception:
                message = error_text or f"Anthropic request failed with status {exc.code}."
            self._set_headers(exc.code)
            self.wfile.write(json.dumps({"error": message}).encode("utf-8"))
            return
        except Exception as exc:  # noqa: BLE001
            self._set_headers(502)
            self.wfile.write(json.dumps({"error": f"Upstream request failed: {exc}"}).encode("utf-8"))
            return

        try:
            model_text = data["content"][0]["text"]
            result = parse_model_json(model_text)
        except Exception as exc:  # noqa: BLE001
            self._set_headers(502)
            self.wfile.write(json.dumps({"error": f"Could not parse AI response: {exc}"}).encode("utf-8"))
            return

        self._set_headers(200)
        self.wfile.write(json.dumps({"result": result}).encode("utf-8"))


if __name__ == "__main__":
    print(f"ResumeIQ proxy listening on http://{HOST}:{PORT}")
    print(f"API key source: environment, {KEY_FILE}, or {LEGACY_KEY_FILE}")
    ThreadingHTTPServer((HOST, PORT), ResumeIQHandler).serve_forever()
