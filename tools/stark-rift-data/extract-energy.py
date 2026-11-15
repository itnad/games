"""Reproduce energy capacity upgrades from pinned BWAPI v4.4.0 and OpenBW sources."""
import hashlib,json,re,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else 'work/sources')
u=(root/'upgrade.cpp').read_text();engine=(root/'bwgame.h').read_text()
def body(name):
 clean=re.sub(r'//[^\n]*','',u);m=re.search(re.escape(name)+r'\[[^\]]+\]\s*=\s*\{(.*?)\};',clean,re.S);assert m,name;return m[1]
def nums(name):return [int(x) for x in re.findall(r'-?\d+',body(name))]
names=re.findall(r'"([^"]*)"',body('typeNames'));producers=re.findall(r'\b[A-Za-z_][A-Za-z_0-9]*\b',body('whatUpgrades'));rows=[]
for name,unit,title in [('Moebius_Reactor','Terran_Ghost','뫼비우스 반응로'),('Apollo_Reactor','Terran_Wraith','아폴로 반응로'),('Khaydarin_Core','Protoss_Arbiter','카이다린 코어')]:
 i=names.index(name);assert re.search(r'case UnitTypes::'+unit+r': return UpgradeTypes::'+name+r';',engine)
 rows.append({'name':name,'unitId':unit.lower().replace('_','-'),'title':title,'producer':producers[i].lower().replace('_','-'),'minerals':nums('defaultOreCostBase')[i],'gas':nums('defaultOreCostBase')[i],'frames':nums('defaultTimeCostBase')[i],'maxLevel':nums('defaultMaxRepeats')[i]})
capacity=engine[engine.index('fp8 unit_max_energy'):engine.index('bool visible_to_everyone')];assert 'return fp8::integer(250)' in capacity and 'return fp8::integer(200)' in capacity;assert 'else u->energy = unit_max_energy(u) / 4;' in engine
commit=json.loads((root/'openbw-commit.json').read_text())['sha'];out={'source':{'reference':'BWAPI v4.4.0 / Brood War1.16.1; pinned OpenBW capacity and initial-energy rules','bwapiUrl':'https://github.com/bwapi/bwapi/blob/v4.4.0/bwapi/BWAPILIB/Source/UpgradeType.cpp','openbwUrl':f'https://github.com/OpenBW/openbw/blob/{commit}/bwgame.h','sha256':{'UpgradeType.cpp':hashlib.sha256(u.encode()).hexdigest(),'bwgame.h':hashlib.sha256(engine.encode()).hexdigest()}},'upgrades':rows,'energy':{'baseMaximum':200,'upgradedMaximum':250,'initialDivisor':4}}
Path('app/stark-rift/data/energy-original.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False))
