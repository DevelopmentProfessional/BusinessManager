import pytest

from backend.models import Supplier, SupplierRead


@pytest.mark.parametrize("is_hidden", [False, True])
def test_supplier_serialization_includes_hidden_status(is_hidden):
    supplier = Supplier(name="Test supplier", is_hidden=is_hidden)

    serialized = SupplierRead.model_validate(supplier).model_dump(mode="json")

    assert serialized["is_hidden"] is is_hidden
