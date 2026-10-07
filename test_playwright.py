import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(record_video_dir="/home/jules/verification/videos")
        page = await context.new_page()

        await page.goto("http://localhost:9002/")
        await page.evaluate("window.localStorage.setItem('nutrisnap_user', JSON.stringify({'id': '1', 'name': 'Test User', 'email': 'test@example.com'}))")
        await context.add_cookies([{
            "name": "nutrisnap_session_id",
            "value": "1",
            "domain": "localhost",
            "path": "/"
        }])

        await page.goto("http://localhost:9002/finance")
        await page.wait_for_selector("text=Transactions")

        # Click on transactions tab if available, else skip
        try:
            await page.click("text=Transactions", timeout=2000)
            await page.wait_for_timeout(2000)
        except Exception:
            pass

        # Try finding a delete button and trigger alert dialog
        try:
            await page.hover("text=Delete transaction")
            await page.wait_for_timeout(500)
        except Exception:
            try:
                # Hover over the first transaction row to reveal the delete button
                await page.hover(".group")
                await page.wait_for_timeout(500)
                await page.click("[aria-label='Delete transaction']")
                await page.wait_for_timeout(1000)
            except Exception:
                pass

        await page.screenshot(path="/home/jules/verification/screenshots/finance_transaction_delete.png", full_page=True)
        await browser.close()

asyncio.run(run())
