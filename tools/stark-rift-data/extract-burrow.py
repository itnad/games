"""Extract checked Burrowing facts from a local BWAPI v4.4.0 TechType.cpp copy."""
import hashlib
import json
import re
import sys
from pathlib import Path

source = Path(sys.argv[1])
text = source.read_text()
clean = re.sub(r"//[^\n]*", "", text)

def body(name):
    return re.search(re.escape(name) + r"\[[^\]]+\]\s*=\s*\{(.*?)\};", clean, re.S).group(1)

names = re.findall(r'"([^\"]*)"', body("typeNames"))
index = names.index("Burrowing")
def number(name):
    return int(re.findall(r"\d+", body(name))[index])

result = {
    "source": {
        "reference": "BWAPI v4.4.0 / Brood War 1.16.1",
        "url": "https://github.com/bwapi/bwapi/blob/v4.4.0/bwapi/BWAPILIB/Source/TechType.cpp",
        "sha256": hashlib.sha256(text.encode()).hexdigest(),
    },
    "name": "Burrowing", "bwapiId": index,
    "minerals": number("defaultOreCost"), "gas": number("defaultOreCost"),
    "frames": number("defaultTimeCost"), "energy": number("defaultEnergyCost"),
    "producer": "zerg-hatchery", "units": ["zerg-drone", "zerg-zergling", "zerg-hydralisk"],
}
Path("app/stark-rift/data/burrow-original.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print("Extracted Burrowing:", result["minerals"], result["gas"], result["frames"])
