"""Extract the stage-4 subset from BWAPI v4.4.0 UnitType/UpgradeType.cpp.
Input files are local source copies; no network access during normal builds.
"""
import hashlib,json,re,sys
from pathlib import Path
source=Path(sys.argv[1] if len(sys.argv)>1 else 'work/stage4-sources')
s=(source/'unit.cpp').read_text();u=(source/'upgrade.cpp').read_text()
def body(text,name):
 text=re.sub(r"//[^\n]*","",text)
 return re.search(re.escape(name)+r'\[[^\]]+\]\s*=\s*\{(.*?)\};',text,re.S).group(1)
def numbers(text,name):
 return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?',re.sub(r'//[^\n]*','',body(text,name)))]
names=re.findall(r'"([^"]*)"',body(s,'typeNames'))
columns={name:numbers(s,name) for name in ['defaultOreCost','defaultGasCost','defaultTimeCost','defaultMaxHP','defaultMaxSP','defaultArmorAmount','unitSupplyProvided','unitSupplyRequired','unitTopSpeeds','sightRangeTiles']}
assert all(len(v)==len(names) for v in columns.values())
dims=[[int(x) for x in re.findall(r'\d+',d)] for d in re.findall(r'\{([^{}]+)\}',body(s,'unitDimensions'))]
assert len(dims)==len(names)
selected=['Terran_SCV','Terran_Marine','Terran_Vulture','Terran_Siege_Tank_Tank_Mode','Terran_Command_Center','Terran_Supply_Depot','Terran_Barracks','Terran_Refinery','Terran_Engineering_Bay','Terran_Factory','Terran_Machine_Shop','Zerg_Drone','Zerg_Zergling','Zerg_Hydralisk','Zerg_Overlord','Zerg_Hatchery','Zerg_Spawning_Pool','Zerg_Extractor','Zerg_Creep_Colony','Zerg_Evolution_Chamber','Zerg_Hydralisk_Den','Protoss_Probe','Protoss_Zealot','Protoss_Dragoon','Protoss_Nexus','Protoss_Pylon','Protoss_Gateway','Protoss_Assimilator','Protoss_Forge','Protoss_Cybernetics_Core']
units=[]
for name in selected:
 i=names.index(name);v={k:(int(a[i]) if a[i].is_integer() else a[i]) for k,a in columns.items()};v.update(name=name,bwapiId=i,dimensions=dims[i]);units.append(v)
unames=re.findall(r'"([^"]*)"',body(u,'typeNames'))
upgrades=[]
for name in ['Terran_Infantry_Weapons','Zerg_Melee_Attacks','Protoss_Ground_Weapons']:
 i=unames.index(name);upgrades.append({'name':name,'bwapiId':i,**{k:int(numbers(u,k)[i]) for k in ['defaultOreCostBase','defaultOreCostFactor','defaultTimeCostBase','defaultTimeCostFactor','defaultMaxRepeats']}})
out={'source':{'version':'Brood War 1.16.1','reference':'BWAPI v4.4.0','url':'https://github.com/bwapi/bwapi/tree/v4.4.0/bwapi/BWAPILIB/Source','unitSourceSha256':hashlib.sha256(s.encode()).hexdigest(),'upgradeSourceSha256':hashlib.sha256(u.encode()).hexdigest()},'units':units,'upgrades':upgrades}
Path('app/stark-rift/data/economy-original.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(f'Extracted {len(units)} unit/building definitions and {len(upgrades)} upgrade tables')
