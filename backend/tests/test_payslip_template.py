from backend.company_scaffold import _load_template_seed_rows
from backend.routers.settings import _logo_media_type


def test_standard_payslip_template_is_seeded_with_required_branding_and_wage_fields():
    templates = _load_template_seed_rows()
    payslips = [template for template in templates if template.get("template_type") == "payslip"]

    assert len(payslips) == 1
    payslip = payslips[0]
    assert payslip["name"] == "Pay Slip"
    assert "employees" in payslip["accessible_pages"]
    for variable in (
        "{{company.logo}}",
        "{{company.name}}",
        "{{employee.first_name}}",
        "{{employee.last_name}}",
        "{{payslip.period_start}}",
        "{{payslip.period_end}}",
        "{{payslip.gross}}",
        "{{payslip.net}}",
        "{{payslip.paid_at}}",
    ):
        assert variable in payslip["content"]


def test_company_logo_media_type_detection():
    assert _logo_media_type(b"\x89PNG\r\n\x1a\nrest") == "image/png"
    assert _logo_media_type(b"\xff\xd8\xffrest") == "image/jpeg"
    assert _logo_media_type(b"GIF89arest") == "image/gif"
    assert _logo_media_type(b"RIFF1234WEBPrest") == "image/webp"
