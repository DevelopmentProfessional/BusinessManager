from datetime import datetime
from uuid import uuid4

from backend.routers.payroll import _calculate_compensation_gross, _service_revenue_for_period


def test_compensation_starts_only_above_twice_base_pay():
    assert _calculate_compensation_gross(600, 600, 50) == 600
    assert _calculate_compensation_gross(1200, 600, 50) == 600
    assert _calculate_compensation_gross(1300, 600, 50) == 650


def test_base_pay_is_guaranteed_below_threshold():
    assert _calculate_compensation_gross(0, 600, 50) == 600
    assert _calculate_compensation_gross(500, 600, 50) == 600


def test_compensation_values_are_clamped_to_safe_ranges():
    assert _calculate_compensation_gross(-100, 500, 150) == 500
    assert _calculate_compensation_gross(1000, -50, -10) == 0


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
