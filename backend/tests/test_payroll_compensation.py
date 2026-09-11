from datetime import datetime
from uuid import uuid4

from backend.routers.payroll import _calculate_compensation_gross, _service_revenue_for_period


def test_base_included_pays_base_until_revenue_exceeds_base():
    assert _calculate_compensation_gross(500, 500, 50, True) == 500
    assert _calculate_compensation_gross(1000, 500, 50, True) == 750


def test_base_excluded_uses_greater_of_base_or_full_revenue_percentage():
    assert _calculate_compensation_gross(500, 500, 50, False) == 500
    assert _calculate_compensation_gross(1000, 500, 50, False) == 500
    assert _calculate_compensation_gross(2000, 500, 50, False) == 1000


def test_compensation_values_are_clamped_to_safe_ranges():
    assert _calculate_compensation_gross(-100, 500, 150, True) == 500
    assert _calculate_compensation_gross(1000, -50, -10, False) == 0


def test_service_revenue_sums_paid_service_line_totals():
    class Result:
        def all(self):
            return [400.0, 350.5, None]

    class Session:
        def exec(self, statement):
            compiled = str(statement)
            assert "sale_transaction_item" in compiled
            assert "schedule" in compiled
            return Result()

    revenue = _service_revenue_for_period(
        Session(),
        uuid4(),
        "company-a",
        datetime(2026, 9, 1),
        datetime(2026, 9, 7),
    )

    assert revenue == 750.5
