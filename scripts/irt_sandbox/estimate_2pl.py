"""
Sandbox 2PL parameter estimation (joint MLE style iteration).

Model (D=1.7 logistic):
  P(theta) = 1 / (1 + exp(-D * a * (theta - b)))

Algorithm (simple, educational — not production MML/EM):
  1) Init person theta from z-scored proportion correct
  2) For each item, Newton updates for (a, b) given thetas
  3) For each person, Newton update theta given (a, b)
  4) Repeat

Writes ONLY under data/irt-sample/out/. Never merges into product banks.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "irt-sample" / "out"
MATRIX_PATH = OUT_DIR / "response_matrix.json"
LONG_PATH = OUT_DIR / "cat_responses_long.jsonl"

D = 1.7
MIN_A = 0.2
MAX_A = 2.5
MIN_B = -3.5
MAX_B = 3.5
MIN_THETA = -4.0
MAX_THETA = 4.0


def sigmoid_p(theta: float, a: float, b: float) -> float:
    x = D * a * (theta - b)
    # stable logistic
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def load_matrix(path: Path) -> tuple[list[str], list[str], list[list[int | None]]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["person_ids"], data["item_ids"], data["matrix"]


def init_theta(matrix: list[list[int | None]]) -> list[float]:
    scores = []
    for row in matrix:
        obs = [x for x in row if x is not None]
        if not obs:
            scores.append(0.0)
        else:
            scores.append(sum(obs) / len(obs))
    mean = sum(scores) / len(scores) if scores else 0.0
    var = sum((s - mean) ** 2 for s in scores) / max(1, len(scores) - 1)
    sd = math.sqrt(var) if var > 1e-9 else 1.0
    return [clamp((s - mean) / sd, MIN_THETA, MAX_THETA) for s in scores]


def init_items(matrix: list[list[int | None]], n_items: int) -> tuple[list[float], list[float]]:
    a = [1.0] * n_items
    b = [0.0] * n_items
    n_pers = len(matrix)
    for j in range(n_items):
        vals = [matrix[i][j] for i in range(n_pers) if matrix[i][j] is not None]
        if not vals:
            b[j] = 0.0
            continue
        p = sum(vals) / len(vals)
        p = min(0.99, max(0.01, p))
        # rough: b ≈ inverse-normal of p at mean ability 0
        # use logit transform / D
        b[j] = clamp(-math.log(p / (1 - p)) / D, MIN_B, MAX_B)
    return a, b


def update_item(
    j: int,
    matrix: list[list[int | None]],
    theta: list[float],
    a: float,
    b: float,
) -> tuple[float, float]:
    """One Newton step for item j (a, b)."""
    # gradients
    g_a = 0.0
    g_b = 0.0
    h_aa = 0.0
    h_bb = 0.0
    h_ab = 0.0
    for i, row in enumerate(matrix):
        y = row[j]
        if y is None:
            continue
        th = theta[i]
        p = sigmoid_p(th, a, b)
        p = min(1 - 1e-9, max(1e-9, p))
        q = 1 - p
        # dη/da = D*(th-b), dη/db = -D*a, p' = p*q * dη
        d_eta_a = D * (th - b)
        d_eta_b = -D * a
        resid = y - p
        w = p * q
        g_a += resid * d_eta_a
        g_b += resid * d_eta_b
        h_aa -= w * d_eta_a * d_eta_a
        h_bb -= w * d_eta_b * d_eta_b
        h_ab -= w * d_eta_a * d_eta_b

    # 2x2 Newton
    det = h_aa * h_bb - h_ab * h_ab
    if abs(det) < 1e-12:
        return a, b
    da = (h_bb * g_a - h_ab * g_b) / det
    db = (h_aa * g_b - h_ab * g_a) / det
    # step damping
    da = clamp(da, -0.5, 0.5)
    db = clamp(db, -0.5, 0.5)
    return clamp(a - da, MIN_A, MAX_A), clamp(b - db, MIN_B, MAX_B)


def update_theta(
    i: int,
    matrix: list[list[int | None]],
    a: list[float],
    b: list[float],
    th: float,
) -> float:
    g = 0.0
    h = 0.0
    row = matrix[i]
    for j, y in enumerate(row):
        if y is None:
            continue
        p = sigmoid_p(th, a[j], b[j])
        p = min(1 - 1e-9, max(1e-9, p))
        d_eta = D * a[j]
        g += (y - p) * d_eta
        h -= p * (1 - p) * d_eta * d_eta
    if abs(h) < 1e-12:
        return th
    step = clamp(g / h, -1.0, 1.0)
    return clamp(th - step, MIN_THETA, MAX_THETA)


def fit_2pl(
    matrix: list[list[int | None]],
    n_iter: int = 25,
) -> tuple[list[float], list[float], list[float]]:
    n_pers = len(matrix)
    n_items = len(matrix[0]) if matrix else 0
    theta = init_theta(matrix)
    a, b = init_items(matrix, n_items)

    for _ in range(n_iter):
        for j in range(n_items):
            a[j], b[j] = update_item(j, matrix, theta, a[j], b[j])
        for i in range(n_pers):
            # a few micro-steps
            for _k in range(3):
                theta[i] = update_theta(i, matrix, a, b, theta[i])
        # identify: center theta
        mean_th = sum(theta) / len(theta)
        theta = [t - mean_th for t in theta]
        b = [bj - mean_th for bj in b]
    return a, b, theta


def se_theta(i: int, matrix: list[list[int | None]], a: list[float], b: list[float], th: float) -> float:
    info = 0.0
    for j, y in enumerate(matrix[i]):
        if y is None:
            continue
        p = sigmoid_p(th, a[j], b[j])
        p = min(1 - 1e-9, max(1e-9, p))
        info += (D * a[j]) ** 2 * p * (1 - p)
    if info <= 1e-9:
        return 99.0
    return 1.0 / math.sqrt(info)


def main(argv: list[str]) -> int:
    matrix_path = Path(argv[1]) if len(argv) > 1 else MATRIX_PATH
    if not matrix_path.exists():
        print(f"ERROR: matrix not found: {matrix_path}", file=sys.stderr)
        print(
            "Run convert_to_cat_responses.py or from_cat_responses.py first.",
            file=sys.stderr,
        )
        return 1

    # Write next to the matrix (Dicht: out/, live: out-live/, fixture smoke: same).
    out_dir = matrix_path.resolve().parent
    long_path = out_dir / "cat_responses_long.jsonl"

    person_ids, item_ids, matrix = load_matrix(matrix_path)
    a, b, theta = fit_2pl(matrix, n_iter=30)

    item_params = []
    for j, iid in enumerate(item_ids):
        # observed p+
        vals = [matrix[i][j] for i in range(len(matrix)) if matrix[i][j] is not None]
        p_plus = sum(vals) / len(vals) if vals else None
        item_params.append(
            {
                "item_id": iid,
                "a": round(a[j], 4),
                "b": round(b[j], 4),
                "c": 0.0,  # 2PL — no guessing param
                "model": "2PL",
                "D": D,
                "n_obs": len(vals),
                "p_plus": round(p_plus, 4) if p_plus is not None else None,
                "irtSource": "sandbox_2pl_jmle",
                "sandbox": True,
                "product_bank_merge": False,
            }
        )

    persons = []
    for i, pid in enumerate(person_ids):
        se = se_theta(i, matrix, a, b, theta[i])
        persons.append(
            {
                "person_id": pid,
                # person axis is session_id for cat_responses; Dicht uses Student ID
                "session_id": pid,
                "theta": round(theta[i], 4),
                "se": round(se, 4),
                "sandbox": True,
            }
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "item_params_2pl.json").write_text(
        json.dumps(
            {
                "model": "2PL",
                "D": D,
                "algorithm": "joint_mle_newton_sandbox",
                "n_persons": len(person_ids),
                "n_items": len(item_ids),
                "source_matrix": str(matrix_path),
                "items": item_params,
                "product_bank_merge": False,
                "warning": (
                    "Sandbox estimates only. Not for production cut scores. "
                    "Do not merge into academy generated-bank or echobridge curated services."
                ),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    (out_dir / "person_theta.json").write_text(
        json.dumps({"persons": persons, "sandbox": True}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # patch long format theta_after if present
    if long_path.exists():
        theta_by_person = {p["person_id"]: p for p in persons}
        out_lines = []
        with long_path.open(encoding="utf-8") as f:
            for line in f:
                row = json.loads(line)
                # long uses session_id as person key for both Dicht-convert and live
                key = row.get("session_id") or row.get("person_id")
                info = theta_by_person.get(key)
                if info:
                    row["theta_after"] = info["theta"]
                    row["se_after"] = info["se"]
                out_lines.append(json.dumps(row, ensure_ascii=False))
        long_path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")

    # summary md
    bs = sorted(item_params, key=lambda x: x["b"])
    lines = [
        "# Sandbox 2PL estimates",
        "",
        f"- persons: {len(person_ids)}",
        f"- items: {len(item_ids)}",
        f"- model: 2PL (D={D})",
        f"- algorithm: joint Newton (sandbox)",
        f"- matrix: `{matrix_path}`",
        f"- out_dir: `{out_dir}`",
        "",
        "## b range",
        f"- min b: {bs[0]['item_id']} = {bs[0]['b']}" if bs else "-",
        f"- max b: {bs[-1]['item_id']} = {bs[-1]['b']}" if bs else "-",
        "",
        "## sample items",
        "",
        "| item_id | a | b | p+ | n |",
        "|---------|--:|--:|---:|--:|",
    ]
    for it in item_params[:15]:
        lines.append(
            f"| {it['item_id']} | {it['a']} | {it['b']} | {it['p_plus']} | {it['n_obs']} |"
        )
    if len(item_params) > 15:
        lines.append(f"| ... | ({len(item_params) - 15} more) | | | |")
    lines.extend(
        [
            "",
            "**Do not merge into product banks.**",
            "",
        ]
    )
    (out_dir / "estimate_2pl_report.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"items={len(item_ids)} persons={len(person_ids)}")
    print(f"wrote {out_dir / 'item_params_2pl.json'}")
    print(f"wrote {out_dir / 'person_theta.json'}")
    print("NOTE: product bank not modified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
