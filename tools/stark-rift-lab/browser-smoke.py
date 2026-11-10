"""Optional Chromium/CDP touch checks for the internal lab; requires Python Playwright.

Build the lab and run npm run preview:stark-rift-lab separately. This does not certify physical Android/iOS or GPU performance.
"""
import argparse
import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


# Observe real Worker traffic without modifying game state or production entry points.
OBSERVER = """window.__qa={commands:[],events:[],snapshot:null,session:null,live:0,confirmations:0};
// Synthetic fixtures accept group replacement deterministically; a native modal can block CDP touchEnd.
window.confirm=()=>{window.__qa.confirmations++;return true;};
const OriginalWorker=window.Worker; window.Worker=class extends OriginalWorker {
  constructor(...args) {
    super(...args); window.__qa.live++; this.__qaClosed=false;
    this.addEventListener('message', ({data:m})=>{
      if(m.kind==='renderSnapshot')window.__qa.snapshot=m.payload;
      if(m.kind==='uiState')window.__qa.ui=m.payload;
      if(['snapshotLoaded','saveSnapshotReady','phaseChanged','commandAck','fatalError'].includes(m.kind))
        window.__qa.events.push({kind:m.kind,payload:m.kind==='saveSnapshotReady'?{requestId:m.payload.requestId,tick:m.payload.snapshot.simulation.tick}:m.payload});
    });
  }
  postMessage(m,...rest) {
    if(m.kind==='commandBatch')window.__qa.commands.push(...structuredClone(m.payload.commands));
    if(m.kind==='loadSnapshot')window.__qa.session=structuredClone(m.payload.snapshot.session);
    if(m.kind==='saveSnapshot')window.__qa.session=structuredClone(m.payload.session);
    return super.postMessage(m,...rest);
  }
  terminate() {
    if(!this.__qaClosed){window.__qa.live--;this.__qaClosed=true;}
    return super.terminate();
  }
};"""


def state(page):
    return page.evaluate("window.__qa")


def center(box):
    return {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}


def touch(cdp, page, start, end=None, hold=0, cancel=False):
    def send(kind, point=None):
        points = [{**point, "id": 1}] if point else []
        cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": points})

    send("touchStart", start)
    if hold:
        page.wait_for_timeout(hold)
    if end:
        for step in range(1, 9):
            send("touchMove", {axis: start[axis] + (end[axis] - start[axis]) * step / 8 for axis in ("x", "y")})
            page.wait_for_timeout(20)
    send("touchCancel" if cancel else "touchEnd")
    page.wait_for_timeout(200)


def world(page, entity):
    box = page.locator(".sr-viewport canvas").bounding_box()
    camera = state(page)["session"]["camera"]
    columns, rows = [(14, 16), (18, 20), (24, 27)][camera["zoomLevel"]]
    scale = max(box["width"] / columns, box["height"] / rows) / 256
    return {
        "x": box["x"] + box["width"] / 2 + (entity["x"] - camera["centerX"]) * scale,
        "y": box["y"] + box["height"] / 2 + (entity["y"] - camera["centerY"]) * scale,
    }


def resume(page):
    page.get_by_role("button", name="이어서 진행", exact=True).click()
    page.wait_for_function("window.__qa.ui?.phase==='running'")


def save(page):
    previous = len(state(page)["events"])
    page.get_by_role("button", name="저장", exact=True).click()
    page.wait_for_function("n=>window.__qa.events.slice(n).some(e=>e.kind==='saveSnapshotReady')", arg=previous)


def reset(page):
    page.get_by_role("combobox", name="검증 시나리오").select_option("passage50")
    page.get_by_role("button", name="초기화", exact=True).click()
    page.wait_for_function("window.__qa.snapshot?.entities.length===50&&window.__qa.ui?.phase==='paused'")
    page.locator(".sr-viewport canvas").wait_for(state="visible")
    expect(page.get_by_role("button", name="기본", exact=True)).to_be_enabled()


def check_case(page, context, checks):
    page.locator(".sr-viewport canvas").wait_for(state="visible")
    expect(page.get_by_role("button", name="기본", exact=True)).to_be_enabled()
    cdp = context.new_cdp_session(page)
    assert page.locator(".sr-viewport canvas").count() == page.locator(".sr-minimap canvas").count() == 1
    checks["worker_and_webgl"] = True
    for button in page.locator(".sr-battle button").all():
        box = button.bounding_box()
        assert box["height"] >= 52 and box["width"] >= 52, "game touch target below 52px"
    checks["game_touch_targets_52px"] = True

    page.locator(".sr-viewport canvas").scroll_into_view_if_needed()
    unit = next(e for e in state(page)["snapshot"]["entities"] if e["id"] == 5)
    touch(cdp, page, world(page, unit))
    expect(page.locator(".sr-commands")).to_contain_text("선택 1")
    checks["single_select"] = True
    before = len(state(page)["commands"])
    touch(cdp, page, world(page, unit), hold=360)
    expect(page.locator(".sr-commands")).to_contain_text("선택 10")
    assert len(state(page)["commands"]) == before, "paused group selection sent a command"
    expect(page.get_by_role("button", name="정지", exact=True)).to_be_disabled()
    checks["paused_group_selection_no_command"] = True

    resume(page)
    page.locator(".sr-viewport canvas").scroll_into_view_if_needed()
    touch(cdp, page, world(page, unit), hold=360)
    page.wait_for_function("window.__qa.events.some(e=>e.kind==='commandAck'&&e.payload.accepted)")
    assert state(page)["commands"][-1]["kind"] == "assignGroup"
    expect(page.locator(".sr-commands")).to_contain_text("선택 10")
    checks["running_group_registration"] = True
    save(page)
    saved_session = state(page)["session"]
    page.get_by_role("button", name="선택 해제", exact=True).click()
    previous = len(state(page)["events"])
    page.get_by_role("button", name="복원", exact=True).click()
    page.wait_for_function("n=>window.__qa.events.slice(n).some(e=>e.kind==='snapshotLoaded')", arg=previous)
    expect(page.locator(".sr-commands")).to_contain_text("선택 10")
    save(page)
    assert state(page)["session"] == saved_session, "restored selection/slots/camera differ"
    expect(page.get_by_role("button", name="정지", exact=True)).to_be_disabled()
    checks["save_restore_selection_slots_camera"] = True

    reset(page)
    resume(page)
    first = page.locator('button[data-slot="0"]')
    first.scroll_into_view_if_needed()
    third = page.locator('button[data-slot="2"]')
    touch(cdp, page, center(first.bounding_box()), center(third.bounding_box()))
    expect(page.locator(".sr-commands")).to_contain_text("선택 30")
    checks["slot_union_swipe"] = True
    before = len(state(page)["commands"])
    start = center(first.bounding_box())
    box = page.locator(".sr-viewport canvas").bounding_box()
    end = {"x": start["x"], "y": box["y"] + box["height"] - 24}
    assert 0 <= end["y"] < page.viewport_size["height"], "swipe destination is offscreen"
    touch(cdp, page, start, end)
    commands = state(page)["commands"][before:]
    assert len(commands) == 1 and commands[0]["kind"] == "attackMove", "slot swipe must emit one attackMove"
    sequence = commands[0]["sequence"]
    page.wait_for_function("s=>window.__qa.events.some(e=>e.kind==='commandAck'&&e.payload.sequence===s&&e.payload.accepted)", arg=sequence)
    checks["slot_attack_swipe_accepted_once"] = True
    before = len(state(page)["commands"])
    touch(cdp, page, center(first.bounding_box()), cancel=True)
    assert len(state(page)["commands"]) == before, "cancelled slot touch sent a command"
    checks["cancelled_slot_no_command"] = True
    checks["rotation_blocks_and_preserves_state"] = check_rotation(page)
    first.focus()
    first.press("Enter")
    expect(page.locator(".sr-commands")).to_contain_text("선택 10")
    checks["keyboard_slot_selection"] = True
    assert state(page)["live"] == 1, "old Worker leaked across scenario reset"
    checks["one_worker_after_reset"] = True
    failures = [e for e in state(page)["events"] if e["kind"] == "fatalError" or (e["kind"] == "commandAck" and not e["payload"]["accepted"])]
    assert not failures, f"Worker failures: {failures}"
    checks["no_worker_error_or_rejection"] = True


def check_rotation(page):
    save(page)
    previous = state(page)["session"]
    commands = len(state(page)["commands"])
    viewport = page.viewport_size
    page.set_viewport_size({"width": 844, "height": 390})
    expect(page.get_by_text("세로 화면으로 돌려 주세요", exact=True)).to_be_visible()
    page.wait_for_function("window.__qa.ui?.phase==='paused'")
    tick = state(page)["ui"]["tick"]
    page.wait_for_timeout(400)
    assert state(page)["ui"]["tick"] == tick, "landscape did not pause simulation"
    assert page.locator(".sr-portrait-content").evaluate("e=>e.inert"), "landscape game controls must be inert"
    page.keyboard.press("Enter")
    assert len(state(page)["commands"]) == commands, "landscape keyboard sent a command"
    page.set_viewport_size(viewport)
    expect(page.get_by_text("세로 화면으로 돌려 주세요", exact=True)).to_be_hidden()
    page.wait_for_timeout(200)
    assert state(page)["ui"]["phase"] == "paused", "return to portrait automatically resumed"
    save(page)
    assert state(page)["session"] == previous, "rotation changed camera/selection/slots"
    resume(page)
    return True


def check_initial_landscape(page, context, checks):
    expect(page.get_by_text("세로 화면으로 돌려 주세요", exact=True)).to_be_visible()
    page.wait_for_function("window.__qa.ui?.phase==='paused'&&window.__qa.snapshot?.entities.length===16")
    assert page.locator(".sr-portrait-content").evaluate("e=>e.inert")
    assert state(page)["ui"]["tick"] == 0
    page.wait_for_timeout(400)
    page.keyboard.press("Enter")
    assert state(page)["ui"]["tick"] == 0 and not state(page)["commands"]
    checks["initial_landscape_paused_and_inert"] = True
    page.set_viewport_size({"width": 390, "height": 844})
    expect(page.get_by_role("button", name="기본", exact=True)).to_be_enabled()
    expect(page.get_by_text("세로 화면으로 돌려 주세요", exact=True)).to_be_hidden()
    assert state(page)["ui"]["phase"] == "paused"
    resume(page)
    page.wait_for_function("window.__qa.snapshot.tick>0")
    assert not any(e["kind"] == "fatalError" for e in state(page)["events"])
    checks["portrait_ready_requires_explicit_resume"] = True


def process_memory():
    roles = {}
    for status in Path("/proc").glob("[0-9]*/status"):
        try:
            raw = status.read_text()
            if not raw.startswith("Name:\tchromium\n"):
                continue
            rss = next((int(line.split()[1]) * 1024 for line in raw.splitlines() if line.startswith("VmRSS:")), 0)
            command = status.with_name("cmdline").read_bytes().decode(errors="replace").split("\0")
            role_match = re.search(r"--type=([^\s\x00]+)", " ".join(command))
            role = role_match.group(1) if role_match else "browser"
            roles[role] = roles.get(role, 0) + rss
        except (OSError, ValueError):
            pass
    return {"chromiumRssByRole": roles, "cgroupBytes": int(Path("/sys/fs/cgroup/memory.current").read_text()), "cgroupEvents": Path("/sys/fs/cgroup/memory.events").read_text()}


def check_soak(page, context, checks, args):
    page.get_by_role("combobox", name="검증 시나리오").select_option("basin50")
    page.wait_for_function("window.__qa.snapshot?.entities.length===50&&window.__qa.ui?.phase==='paused'")
    expect(page.get_by_role("button", name="기본", exact=True)).to_be_enabled()
    resume(page)
    cdp = context.new_cdp_session(page)
    cdp.send("Performance.enable")
    cdp.send("HeapProfiler.collectGarbage")
    started = time.monotonic()
    samples = []
    waves = 0
    while time.monotonic() - started < args.soak_seconds:
        elapsed = time.monotonic() - started
        if elapsed >= waves * 90:
            goal = 81 if waves % 2 == 0 else 14
            minimap = page.locator(".sr-minimap canvas")
            minimap.scroll_into_view_if_needed()
            box = minimap.bounding_box()
            touch(cdp, page, {"x": box["x"] + box["width"] * goal / 96, "y": box["y"] + box["height"] * goal / 96})
            canvas = page.locator(".sr-viewport canvas")
            canvas.scroll_into_view_if_needed()
            before = len(state(page)["commands"])
            touch(cdp, page, center(canvas.bounding_box()))
            commands = state(page)["commands"][before:]
            assert len(commands) == 1 and commands[0]["kind"] == "move" and len(commands[0]["entityIds"]) == 50
            waves += 1
            print(f"soak {elapsed:.0f}s: movement wave {waves}", flush=True)
        observed = state(page)
        assert observed["live"] == 1 and len(observed["snapshot"]["entities"]) == 50
        assert observed["ui"]["phase"] == "running"
        assert not any(e["kind"] == "fatalError" or (e["kind"] == "commandAck" and not e["payload"]["accepted"]) for e in observed["events"])
        metrics = {m["name"]: m["value"] for m in cdp.send("Performance.getMetrics")["metrics"]}
        samples.append({"elapsedSeconds": elapsed, "tick": observed["snapshot"]["tick"], "heapBytes": metrics.get("JSHeapUsedSize"), "dom": cdp.send("Memory.getDOMCounters"), "processMemory": process_memory(), "userTimingEntries": page.evaluate("performance.getEntriesByType('measure').length")})
        (args.output / "stark-rift-browser-soak-progress.json").write_text(json.dumps(samples, indent=2) + "\n")
        page.wait_for_timeout(min(5000, max(1, (args.soak_seconds - (time.monotonic() - started)) * 1000)))
    cdp.send("HeapProfiler.collectGarbage")
    final = {m["name"]: m["value"] for m in cdp.send("Performance.getMetrics")["metrics"]}
    report = {"scope": "Chromium SwiftShader; main-page heap/DOM only; excludes Worker/GPU memory; physical device performance unverified", "seconds": time.monotonic() - started, "waves": waves, "postGcMainHeapBytes": final.get("JSHeapUsedSize"), "samples": samples}
    (args.output / "stark-rift-browser-soak.json").write_text(json.dumps(report, indent=2) + "\n")
    page.locator(".lab-details summary").click()
    with page.expect_download() as pending:
        page.get_by_role("button", name="검증 기록 JSON 저장", exact=True).click()
    pending.value.save_as(str(args.output / "stark-rift-browser-soak-session.json"))
    checks["repeated_50_unit_moves"] = True
    checks["continuous_running_no_error_single_worker"] = True
    checks["observed_seconds"] = round(report["seconds"], 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only-soak", action="store_true")
    parser.add_argument("--soak-seconds", type=int, default=0, help="Optional repeated 50-unit movement observation; 600 for ten minutes")
    parser.add_argument("--url", default="http://127.0.0.1:4175/")
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--output", type=Path, default=Path("work/stage3-browser"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=args.chromium, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for width, height in ([] if args.only_soak else [(390, 844), (360, 640)]):
            print(f"Checking {width}x{height}", flush=True)
            context = browser.new_context(viewport={"width": width, "height": height}, is_mobile=True, has_touch=True, device_scale_factor=1)
            context.add_init_script(OBSERVER)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("dialog", lambda dialog: dialog.accept())
            case = {"viewport": [width, height], "checks": {}, "errors": errors}
            results.append(case)
            try:
                page.goto(args.url, wait_until="networkidle")
                check_case(page, context, case["checks"])
                assert not errors, f"JavaScript errors: {errors}"
                case["checks"]["no_runtime_error"] = True
            except Exception as error:
                case["failure"] = str(error)
            finally:
                try:
                    page.screenshot(path=str(args.output / f"stark-rift-browser-{width}x{height}.png"), full_page=True)
                except Exception as error:
                    case["screenshotError"] = str(error)
                context.close()
        for name, viewport, test in [
            *([] if args.only_soak else [("landscape_initial_block", {"width": 844, "height": 390}, check_initial_landscape)]),
            *(([("portrait_soak", {"width": 390, "height": 844}, lambda page, context, checks: check_soak(page, context, checks, args))]) if args.soak_seconds else []),
        ]:
            print(f"Checking {name}", flush=True)
            context = browser.new_context(viewport=viewport, is_mobile=True, has_touch=True, device_scale_factor=1)
            context.add_init_script(OBSERVER)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            case = {"case": name, "checks": {}, "errors": errors}
            results.append(case)
            try:
                page.goto(args.url, wait_until="networkidle")
                test(page, context, case["checks"])
                assert not errors, f"JavaScript errors: {errors}"
                case["checks"]["no_runtime_error"] = True
            except Exception as error:
                case["failure"] = str(error)
            finally:
                try:
                    page.screenshot(path=str(args.output / f"stark-rift-browser-{name}.png"), full_page=True)
                except Exception as error:
                    case["screenshotError"] = str(error)
                context.close()
        version = browser.version
        browser.close()
    report = {
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "scope": "Chromium headless; mobile viewport and synthetic CDP touch; software WebGL; not physical Android/iOS",
        "browserVersion": version,
        "sourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "sourceDirty": bool(subprocess.check_output(["git", "status", "--porcelain"], text=True).strip()),
        "results": results,
    }
    (args.output / "stark-rift-browser-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return int(any("failure" in case for case in results))


if __name__ == "__main__":
    raise SystemExit(main())
