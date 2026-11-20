"""Run with Python Playwright and Chrome against a local or published site."""
import statistics
import sys
from playwright.sync_api import sync_playwright


def check_copy(browser, url):
    page = browser.new_page()
    page.goto(url)
    start_copy = page.locator("body").inner_text()
    assert "клавиши 1–4" in start_copy and "два блока по 32" in start_copy
    assert "Практика внимания к цвету" not in start_copy
    assert "Пока нет данных" not in start_copy
    page.locator("#btn-start").click()
    page.locator(".answer-swatch").first.click()
    game_copy = page.locator("body").inner_text()
    visible_lines = [line.strip() for line in game_copy.splitlines() if line.strip()]
    assert set(visible_lines[:4]) == {"Струп-тест", "Разминка", "2 / 8", page.locator("#stimulus").inner_text()}, visible_lines
    assert visible_lines[4:8] == ["1", "2", "3", "4"], visible_lines
    assert len(visible_lines) == 9 and visible_lines[-1].startswith("Верно "), visible_lines
    assert page.locator(".answer-swatch[title]").count() == 0
    print("Copy audit passed for start, empty history and all visible text during play.")
    page.close()


def check_burst(browser, url):
    page = browser.new_page(is_mobile=True, has_touch=True, viewport={"width":390,"height":844})
    page.goto(url)
    page.locator("#btn-start").tap()
    box = page.locator(".answer-swatch").first.bounding_box()
    page.evaluate("""() => { window.tapTimes = []; document.querySelector('#answers')
        .addEventListener('click', e => { if(e.isTrusted) tapTimes.push(performance.now()); }); }""")
    for _ in range(6):
        page.touchscreen.tap(box["x"] + 10, box["y"] + 10)
    times = page.evaluate("tapTimes")
    assert len(times) == 6 and page.locator("#progress").inner_text() == "7 / 8"
    print(f"6 consecutive touch taps registered in {times[-1] - times[0]:.0f} ms.")
    page.close()


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
    elapsed = []
    page.evaluate("""() => {
      for (const event of ['click', 'keydown']) {
        document.addEventListener(event, () => { window.inputTime = performance.now(); }, true);
        document.addEventListener(event, () => {
          window.afterInput = [document.querySelector('#progress').textContent,
            document.querySelector('#stimulus').textContent, performance.now() - window.inputTime];
        });
      }
    }""")
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
        if n not in (7, 39, 71):
            progress, word, ms = page.evaluate("window.afterInput")
            position = n if n < 8 else (n - 8) % 32
            assert progress == f"{position + 2} / {8 if n < 8 else 32}" and word in colors, (n, progress, word)
            elapsed.append(ms)
            assert page.locator("#screen-game").get_attribute("data-verdict") == ("wrong" if n in wrong else "correct")
            assert not page.locator("#screen-game [role=status]:visible").count()
    page.locator("#screen-result").wait_for()
    stats = page.locator("#result-stats")
    assert "61 из 64" in stats.inner_text()
    assert stats.locator("dt", has_text="Ошибки").locator("+ dd").inner_text() == "3"
    for _ in range(2):
        cells = page.locator("#history-body tr").first.locator("td").all_inner_texts()
        assert cells[1:4] == ["61 / 64", "3", "95%"], cells
        page.reload()
    assert not errors, errors
    print(f"72 trials, 61/64; {len(elapsed)} synchronous transitions. Input to DOM update: median {statistics.median(elapsed):.2f} ms; max {max(elapsed):.2f} ms.")
    context.close()


if __name__ == "__main__":
    with sync_playwright() as p:
        with p.chromium.launch(channel="chrome", chromium_sandbox=True) as browser:
            check_copy(browser, sys.argv[1])
            check_burst(browser, sys.argv[1])
            check(browser, sys.argv[1])
