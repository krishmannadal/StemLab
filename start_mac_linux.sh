#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-local.txt
.venv/bin/python run.py
