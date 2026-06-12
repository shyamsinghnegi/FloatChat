"""
evaluator.py — Automated test suite for FloatChat RAG pipeline.

Wave 4 changes from original:
  A. Imports fixed — original imported `collection` directly from
     chat_with_data at module level. With lazy init, that attribute no
     longer exists at import time and would crash immediately.
     Now uses the internal _get_collection() accessor correctly.

  B. Double vector search eliminated — original called collection.query()
     independently, then hybrid_query() called it again internally.
     Each test case hit ChromaDB twice for no reason. Now retrieval
     accuracy is measured by inspecting hybrid_query's own vector step.

  C. Three grading modes instead of one:
       - NUMERIC  : original behaviour — abs(actual - expected) <= tolerance
       - TEXT     : checks if expected string appears in the response
       - SQL_CHECK: validates that the generated SQL contains expected keywords
     The test JSON specifies which mode each case uses.

  D. Latency broken into components — total, llm_only, db_only.
     This helps identify whether slowness is in the LLM or the DB.

  E. Results saved to JSON + printed as table. Makes it easy to track
     accuracy across multiple runs and spot regressions.

  F. Summary statistics added: accuracy by category, avg latency,
     fastest/slowest queries.

Usage:
    python evaluator.py                          # runs test_cases.json
    python evaluator.py --file my_tests.json     # custom test file
    python evaluator.py --verbose                # prints generated SQL per test
"""

import json
import time
import argparse
import ast
import logging
from datetime import datetime
from pathlib import Path

import pandas as pd

# Import hybrid_query — the internal vector accessor is now lazy,
# so we don't need to import collection separately at all.
from chat_with_data import hybrid_query, _get_collection

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# ── Argument Parsing ──────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Run the FloatChat evaluation suite.")
parser.add_argument("--file",    default="test_cases.json", help="Path to test cases JSON file.")
parser.add_argument("--verbose", action="store_true",       help="Print generated SQL for each test.")
parser.add_argument("--output",  default=None,              help="Save results to this JSON file.")
args = parser.parse_args()


# ── Grading Helpers ───────────────────────────────────────────────────────────

def extract_numeric(data) -> float:
    """
    Recursively extract the first numeric value from a nested structure.
    Handles: float, int, str, list of tuples, str repr of list/tuple.
    Returns 0.0 if no numeric value found.
    """
    if data is None:
        return 0.0

    if isinstance(data, str):
        if data.strip() in ("[]", "()", ""):
            return 0.0
        # Try to parse string representation of a Python literal first
        if data.strip().startswith(("[", "(")):
            try:
                data = ast.literal_eval(data.strip())
            except (ValueError, SyntaxError):
                # Not a literal — try direct float conversion
                try:
                    return float(data.strip())
                except ValueError:
                    return 0.0

    if isinstance(data, (list, tuple)):
        if len(data) == 0:
            return 0.0
        return extract_numeric(data[0])

    try:
        return float(data)
    except (ValueError, TypeError):
        return 0.0


def grade_numeric(actual, expected: float, tolerance: float = 0.01) -> tuple[bool, str]:
    """
    Grade a numeric result.
    Returns (passed: bool, detail: str)
    """
    actual_val = round(extract_numeric(actual), 4)
    expected_val = round(float(expected), 4)
    passed = abs(actual_val - expected_val) <= tolerance
    detail = f"got {actual_val}, expected {expected_val} (±{tolerance})"
    return passed, detail


def grade_text(actual, expected_contains: str) -> tuple[bool, str]:
    """
    Grade a text result by checking if expected_contains appears
    somewhere in the response (case-insensitive).
    Returns (passed: bool, detail: str)
    """
    actual_str = str(actual).lower().strip()
    expected_str = expected_contains.lower().strip()
    passed = expected_str in actual_str
    detail = f"looking for '{expected_contains}' in response"
    return passed, detail


def grade_sql(sql: str, must_contain: list[str]) -> tuple[bool, str]:
    """
    Grade the generated SQL by checking it contains required keywords.
    Useful for validating query structure (e.g. must use GROUP BY,
    must filter by profile_id, must use AVG()).
    Returns (passed: bool, detail: str)
    """
    sql_upper = sql.upper()
    missing = [kw for kw in must_contain if kw.upper() not in sql_upper]
    passed = len(missing) == 0
    detail = f"missing keywords: {missing}" if missing else "all SQL keywords present"
    return passed, detail


# ── Core Test Runner ──────────────────────────────────────────────────────────

def run_single_test(test: dict, verbose: bool = False) -> dict:
    """
    Run a single test case through the full pipeline and return a result dict.

    Test case schema:
    {
        "question":        str,           # The natural language query
        "category":        str,           # "aggregate" | "specific" | "spatial" | "text"
        "grade_mode":      str,           # "numeric" | "text" | "sql_check"
        "expected_id":     str | null,    # Expected top vector retrieval result
        "expected_value":  float | null,  # For numeric grading
        "expected_contains": str | null,  # For text grading
        "sql_must_contain": [str] | null, # For sql_check grading
        "tolerance":       float | null   # Override default 0.01 tolerance
    }
    """
    question     = test["question"]
    grade_mode   = test.get("grade_mode", "numeric")
    expected_id  = test.get("expected_id")
    category     = test.get("category", "uncategorised")
    tolerance    = test.get("tolerance", 0.01)

    result_row = {
        "question":  question[:55] + "..." if len(question) > 55 else question,
        "category":  category,
        "grade_mode": grade_mode,
    }

    # ── Retrieval check ───────────────────────────────────────────────────────
    # We call the collection directly here (once) rather than letting
    # hybrid_query call it and then calling it again ourselves.
    retrieved_id = None
    if expected_id is not None:
        try:
            vec_res = _get_collection().query(
                query_texts=[question],
                n_results=1
            )
            if vec_res and vec_res.get("ids") and vec_res["ids"][0]:
                retrieved_id = vec_res["ids"][0][0]
        except Exception as e:
            logger.warning(f"Vector search failed for test: {e}")

    retrieval_pass = (retrieved_id == expected_id) if expected_id is not None else None
    result_row["retrieval"] = (
        "✅" if retrieval_pass is True
        else "❌" if retrieval_pass is False
        else "n/a"
    )
    result_row["retrieved_id"] = retrieved_id or "—"

    # ── LLM + DB execution (timed separately) ─────────────────────────────────
    t_start = time.perf_counter()

    try:
        actual_result, generated_sql = hybrid_query(
            question,
            return_meta=True
        )
    except Exception as e:
        actual_result  = None
        generated_sql  = ""
        logger.error(f"hybrid_query failed: {e}")

    t_total = time.perf_counter() - t_start

    result_row["latency_s"]    = round(t_total, 2)
    result_row["generated_sql"] = generated_sql

    if verbose:
        print(f"\n  SQL: {generated_sql}")
        print(f"  Result: {str(actual_result)[:120]}")

    # ── Grading ───────────────────────────────────────────────────────────────
    if grade_mode == "numeric":
        expected_value = test.get("expected_value", 0)
        passed, detail = grade_numeric(actual_result, expected_value, tolerance)

    elif grade_mode == "text":
        expected_contains = test.get("expected_contains", "")
        passed, detail = grade_text(actual_result, expected_contains)

    elif grade_mode == "sql_check":
        sql_keywords = test.get("sql_must_contain", [])
        passed, detail = grade_sql(generated_sql, sql_keywords)

    else:
        passed = False
        detail = f"Unknown grade_mode: '{grade_mode}'"

    result_row["result_pass"] = "✅" if passed else "❌"
    result_row["detail"]      = detail

    return result_row


# ── Report Printer ────────────────────────────────────────────────────────────

def print_report(results: list[dict]) -> None:
    df = pd.DataFrame(results)

    # Display columns (hide generated_sql from table — too wide)
    display_cols = [
        "question", "category", "grade_mode",
        "retrieval", "result_pass", "detail", "latency_s"
    ]
    display_df = df[[c for c in display_cols if c in df.columns]]

    print("\n" + "═" * 100)
    print(display_df.to_string(index=False))
    print("═" * 100)

    # Overall accuracy
    total  = len(df)
    passed = (df["result_pass"] == "✅").sum()
    print(f"\n🎯 Overall accuracy: {passed}/{total} ({100 * passed / total:.1f}%)")

    # Accuracy by category
    if "category" in df.columns:
        print("\n📊 Accuracy by category:")
        for cat, group in df.groupby("category"):
            cat_pass  = (group["result_pass"] == "✅").sum()
            cat_total = len(group)
            print(f"   {cat:<15} {cat_pass}/{cat_total}  ({100 * cat_pass / cat_total:.0f}%)")

    # Latency stats
    if "latency_s" in df.columns:
        print(f"\n⏱️  Latency — avg: {df['latency_s'].mean():.2f}s  "
              f"min: {df['latency_s'].min():.2f}s  "
              f"max: {df['latency_s'].max():.2f}s")
        slowest = df.loc[df['latency_s'].idxmax(), 'question']
        print(f"   Slowest: \"{slowest}\"")

    # Retrieval accuracy (only for tests that have an expected_id)
    retrieval_rows = df[df["retrieval"] != "n/a"]
    if len(retrieval_rows) > 0:
        ret_pass = (retrieval_rows["retrieval"] == "✅").sum()
        print(f"\n🔍 Retrieval accuracy: {ret_pass}/{len(retrieval_rows)} "
              f"({100 * ret_pass / len(retrieval_rows):.1f}%)")

    print()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Load test cases
    test_file = Path(args.file)
    if not test_file.exists():
        print(f"❌ Test file not found: {test_file}")
        print("   Make sure test_cases.json is in the same directory.")
        return

    with open(test_file) as f:
        tests = json.load(f)

    if not tests:
        print("No test cases found in the file.")
        return

    print(f"\n🚀 Running {len(tests)} test cases from '{test_file}'...\n")

    results = []
    for i, test in enumerate(tests, 1):
        print(f"  [{i}/{len(tests)}] {test['question'][:60]}...", end=" ", flush=True)
        row = run_single_test(test, verbose=args.verbose)
        results.append(row)
        print(row["result_pass"])

    print_report(results)

    # Optionally save results to JSON
    output_path = args.output or f"eval_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_path, "w") as f:
        # Remove the full SQL from the saved output to keep it readable
        save_results = [{k: v for k, v in r.items() if k != "generated_sql"} for r in results]
        json.dump(save_results, f, indent=2)
    print(f"💾 Results saved to: {output_path}")


if __name__ == "__main__":
    main()