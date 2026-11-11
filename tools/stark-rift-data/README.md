# Economy data extraction

Normal builds use the checked-in `app/stark-rift/data/economy-original.json` and need no source download. The file contains factual unit/building/upgrade values for the stage-4 subset, not original game assets.

To reproduce, put BWAPI v4.4.0 `bwapi/BWAPILIB/Source/UnitType.cpp` and `UpgradeType.cpp` at `work/stage4-sources/unit.cpp` and `upgrade.cpp`, then run:

```sh
python tools/stark-rift-data/extract-economy.py work/stage4-sources
git diff -- app/stark-rift/data/economy-original.json
```

Upstream: https://github.com/bwapi/bwapi/tree/v4.4.0/bwapi/BWAPILIB/Source . Hashes record UTF-8 source after Python universal newline normalization. The upgrade table explicitly shares mineral/gas price bases and factors. The extractor asserts table lengths and preserves original frame counts; `economy-catalog.ts` applies nearest-integer 20Hz/50% economic duration conversion. Decimal movement speeds are converted once to integer world units/second without the economic speedup.

Gather timers, cancellation refunds, larva natural regeneration, psi mask and creep-neighbor selection were cross-checked against OpenBW `bwgame.h` (https://github.com/OpenBW/openbw/blob/master/bwgame.h, consulted 2026-11-11). Its LCG is not adopted: Stark Rift retains its versioned saved RNG stream contract. Destruction-specific creep recession and full combat entities belong to the combat/content stages.
