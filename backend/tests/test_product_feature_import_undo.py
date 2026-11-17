import json
from types import SimpleNamespace
from uuid import uuid4

from backend.models import (
    DescriptiveFeature,
    FeatureOption,
    InventoryFeature,
    InventoryFeatureCombination,
    InventoryFeatureOptionData,
    UserUndoAction,
)
from backend.routers import isud
from backend.routers.products import BulkFeatureIn, _merge_bulk_features


class _Result:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value


class _UndoSession:
    def __init__(self, action):
        self.action = action
        self.added = []
        self.deleted = []
        self.committed = False
        self.rolled_back = False

    def exec(self, _query):
        return _Result(self.action)

    def get(self, _model, _record_id):
        return None

    def add(self, record):
        self.added.append(record)

    def delete(self, record):
        self.deleted.append(record)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


def test_bulk_feature_definitions_reuse_names_and_options_case_insensitively():
    features = _merge_bulk_features([
        BulkFeatureIn(name=" Size ", options=["Small", "Medium"]),
        BulkFeatureIn(name="size", options=["small", "Large"]),
    ])

    assert len(features) == 1
    assert features[0].name == "Size"
    assert features[0].options == ["Small", "Medium", "Large"]


def test_undo_restores_deleted_feature_bundle_in_dependency_order():
    feature_id = uuid4()
    option_id = uuid4()
    inventory_id = uuid4()
    bundle = {
        "feature": [{"id": str(feature_id), "name": "Size", "company_id": "company-a"}],
        "options": [{"id": str(option_id), "feature_id": str(feature_id), "name": "Small"}],
        "inventory_features": [{
            "id": str(uuid4()),
            "inventory_id": str(inventory_id),
            "feature_id": str(feature_id),
            "company_id": "company-a",
        }],
        "option_data": [{
            "id": str(uuid4()),
            "inventory_id": str(inventory_id),
            "feature_id": str(feature_id),
            "option_id": str(option_id),
            "quantity": 3,
            "is_enabled": True,
            "company_id": "company-a",
        }],
        "combinations": [{
            "id": str(uuid4()),
            "inventory_id": str(inventory_id),
            "combination_key": str(option_id),
            "option_ids_json": json.dumps([str(option_id)]),
            "quantity": 3,
            "company_id": "company-a",
        }],
    }
    action = UserUndoAction(
        user_id=uuid4(),
        action_type="DELETE_FEATURE_BUNDLE",
        table_name="descriptive_feature_bundle",
        record_id=str(feature_id),
        entity_title="Size",
        before_state=json.dumps(bundle),
    )
    session = _UndoSession(action)

    result = isud.undo_last_action(session, SimpleNamespace(id=uuid4(), company_id="company-a"))

    assert result == {"success": True, "message": "Undid deletion of feature Size"}
    assert [type(record) for record in session.added] == [
        DescriptiveFeature,
        FeatureOption,
        InventoryFeature,
        InventoryFeatureOptionData,
        InventoryFeatureCombination,
    ]
    assert session.deleted == [action]
    assert session.committed is True
    assert session.rolled_back is False
