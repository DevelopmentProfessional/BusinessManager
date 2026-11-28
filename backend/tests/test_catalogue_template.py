import json

from backend.routers.templates import _render_template, seed_standard_templates


class _EmptyResult:
    def all(self):
        return []


class _Session:
    def __init__(self):
        self.added = []
        self.committed = False

    def exec(self, _statement):
        return _EmptyResult()

    def add(self, row):
        self.added.append(row)

    def commit(self):
        self.committed = True

    def rollback(self):
        pass


def test_standard_catalogue_template_is_seeded_for_products_and_services():
    session = _Session()

    seed_standard_templates(session)

    templates = [template for template in session.added if template.name == "Catalogue"]
    assert len(templates) == 1
    template = templates[0]
    assert template.template_type == "catalogue"
    assert json.loads(template.accessible_pages) == ["services", "inventory"]
    assert "{{#catalogue.items}}" in template.content
    assert "{{/catalogue.items}}" in template.content
    assert "{{catalogue_item.name}}" in template.content
    assert session.committed


def test_catalogue_renderer_repeats_a_card_for_each_item():
    html = _render_template(
        "{{catalogue.title}}{{#catalogue.items}}<article>{{catalogue_item.name}}</article>{{/catalogue.items}}",
        {
            "catalogue.title": "Product Catalogue",
            "catalogue.items": [
                {"catalogue_item.name": "Item One"},
                {"catalogue_item.name": "Item Two"},
            ],
        },
    )

    assert html == "Product Catalogue<article>Item One</article><article>Item Two</article>"
