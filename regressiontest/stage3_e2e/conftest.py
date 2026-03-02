"""
stage3_e2e/conftest.py — Browser + page fixtures for Playwright E2E tests.

Prerequisites:
  - Frontend dev server running at FRONTEND_URL (npm run dev in frontend/)
  - playwright install chromium
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext
from config import FRONTEND_URL, PLAYWRIGHT_HEADLESS, ADMIN_USERNAME, ADMIN_PASSWORD


@pytest.fixture(scope="session")
def browser_instance():
    """Session-wide browser instance."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=PLAYWRIGHT_HEADLESS)
        yield browser
        browser.close()


@pytest.fixture(scope="module")
def browser_context(browser_instance: Browser):
    """Module-wide browser context (fresh cookie jar per module)."""
    context = browser_instance.new_context(
        base_url=FRONTEND_URL,
        viewport={"width": 1280, "height": 800},
    )
    yield context
    context.close()


@pytest.fixture(scope="function")
def page(browser_context: BrowserContext) -> Page:
    """Function-scoped page."""
    pg = browser_context.new_page()
    yield pg
    pg.close()


def login_as_admin(page: Page) -> None:
    """Navigate to login page and authenticate as admin."""
    page.goto(f"{FRONTEND_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[name="username"], input[placeholder*="sername"], input[id*="username"]', ADMIN_USERNAME)
    page.fill('input[type="password"]', ADMIN_PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")


def login_as(page: Page, username: str, password: str) -> None:
    """Navigate to login page and authenticate with given credentials."""
    page.goto(f"{FRONTEND_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[name="username"], input[placeholder*="sername"], input[id*="username"]', username)
    page.fill('input[type="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
