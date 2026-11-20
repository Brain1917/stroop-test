"""Run with Python Playwright and Chrome against a local or published site."""
import sys
from playwright.sync_api import sync_playwright


def check(browser, url):
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)
    page.set_default_timeout(5000)
    page.locator("#btn-start").click()
    colors = ["красный", "синий", "зелёный", "жёлтый"]
    wrong = {0, 7, 8, 39, 71}
    for n in range(72):
        if n in (8, 40):
            page.locator("#continue").click()
        page.wait_for_function("(colors) => colors.includes(document.querySelector('#stimulus').textContent)", arg=colors)
        idx = page.evaluate("""() => [...document.querySelectorAll('.answer-swatch')]
            .findIndex(b => b.style.backgroundColor === document.querySelector('#stimulus').style.color)""")
        assert 0 <= idx < 4
        choice = (idx + int(n in wrong)) % 4
        if n % 2:
            page.keyboard.press(str(choice + 1))
        else:
            page.locator(".answer-swatch").nth(choice).click()
        feedback = page.locator("#feedback")
        expected = "Ошибка" if n in wrong else "Верно"
        assert feedback.is_visible() and expected in feedback.inner_text(), (n, expected, feedback.inner_text())
        panel = page.locator("#screen-game")
        expected_bg = "rgb(253, 230, 229)" if n in wrong else "rgb(225, 245, 231)"
        assert panel.evaluate("(e) => getComputedStyle(e).backgroundColor") == expected_bg
        offset = 0 if n < 8 else 8
        mistakes = sum(offset <= i <= n for i in wrong)
        assert f"Ошибок {mistakes}" in page.locator("#counts").inner_text()
        if n in wrong:
            assert colors[idx] in feedback.inner_text()
        page.keyboard.press(str(choice + 1))  # stray second press during feedback
    page.locator("#screen-result").wait_for()
    stats = page.locator("#result-stats")
    assert "61 из 64" in stats.inner_text()
    assert stats.locator("dt", has_text="Ошибки").locator("+ dd").inner_text() == "3"
    for _ in range(2):
        cells = page.locator("#history-body tr").first.locator("td").all_inner_texts()
        assert cells[1:4] == ["61 / 64", "3", "95%"], cells
        page.reload()
    assert not errors, errors
    print("72 trials, five deliberate errors (two practice, three scored), repeated inputs ignored; results and persisted history agree.")
    context.close()


if __name__ == "__main__":
    with sync_playwright() as p:
        with p.chromium.launch(channel="chrome", chromium_sandbox=True) as browser:
            check(browser, sys.argv[1])
