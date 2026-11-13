"""Extract the stage-6B content subset from local BWAPI v4.4.0 source copies."""
import re,json,hashlib,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else 'work/sources')
u=(root/'unit.cpp').read_text();w=(root/'weapon.cpp').read_text();up=(root/'upgrade.cpp').read_text()
def body(s,n):
 s=re.sub(r'//[^\n]*','',s);m=re.search(re.escape(n)+r'\[[^\]]+\]\s*=\s*\{(.*?)\};',s,re.S);assert m,n;return m.group(1)
def nums(s,n):return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?',body(s,n))]
def words(s,n):return re.findall(r'\b[A-Za-z_][A-Za-z_0-9]*\b',body(s,n))
names=re.findall(r'"([^"]*)"',body(u,'typeNames'))
columns={n:nums(u,n) for n in ['defaultOreCost','defaultGasCost','defaultTimeCost','defaultMaxHP','defaultMaxSP','defaultArmorAmount','unitSupplyProvided','unitSupplyRequired','unitTopSpeeds','sightRangeTiles','unitSpaceRequired','unitSpaceProvided']}
assert all(len(v)==len(names) for v in columns.values())
dims=[[int(x) for x in re.findall(r'\d+',d)] for d in re.findall(r'\{([^{}]+)\}',body(u,'unitDimensions'))]
selected=['Terran_Starport','Terran_Control_Tower','Terran_Dropship','Zerg_Lair','Protoss_Citadel_of_Adun','Protoss_Templar_Archives','Protoss_Dark_Templar','Protoss_Robotics_Facility','Protoss_Observatory','Protoss_Observer','Protoss_Shuttle']
units=[]
for name in selected:
 i=names.index(name);v={k:(int(a[i]) if a[i].is_integer() else a[i]) for k,a in columns.items()};v.update(name=name,bwapiId=i,dimensions=dims[i]);units.append(v)
wnames=re.findall(r'"([^"]*)"',body(w,'typeNames'));i=wnames.index('Warp_Blades')
weapon={'name':'Warp_Blades','bwapiId':i,**{n:int(nums(w,n)[i]) for n in ['defaultWpnDamageAmt','defaultWpnDamageBonus','wpnDamageCooldowns','wpnDamageFactor','wpnMinRange','wpnMaxRange']},'damageType':words(w,'damageType')[i],'upgrade':words(w,'upgrade')[i]}
size=words(u,'unitSize');gw=words(u,'groundWeapon');aw=words(u,'airWeapon');hits=nums(u,'groundWeaponHits');profiles=[]
for item in units:
 i=item['bwapiId'];profiles.append({'name':item['name'],'size':size[i].lower(),'bounds':item['dimensions'][2:],'groundWeapon':gw[i],'airWeapon':aw[i],'hits':int(hits[i])})
unames=re.findall(r'"([^"]*)"',body(up,'typeNames'));i=unames.index('Ventral_Sacs')
upgrade={'name':'Ventral_Sacs','bwapiId':i,**{n:int(nums(up,n)[i]) for n in ['defaultOreCostBase','defaultOreCostFactor','defaultTimeCostBase','defaultTimeCostFactor','defaultMaxRepeats']}}
old=json.loads(Path('app/stark-rift/data/economy-original.json').read_text())['units']
flags=body(u,'unitFlags').split(',');assert len(flags)==len(names),(len(flags),len(names))
traits=[]
for name in [i['name'] for i in old]+selected:
 i=names.index(name);traits.append({'name':name,'spaceRequired':int(columns['unitSpaceRequired'][i]),'spaceProvided':int(columns['unitSpaceProvided'][i]),'flyer':'Flyer' in flags[i],'detector':'Detector' in flags[i],'permanentCloak':'PermanentCloak' in flags[i]})
out={'source':{'reference':'BWAPI v4.4.0 / Brood War 1.16.1','url':'https://github.com/bwapi/bwapi/tree/v4.4.0/bwapi/BWAPILIB/Source','unitSourceSha256':hashlib.sha256(u.encode()).hexdigest(),'weaponSourceSha256':hashlib.sha256(w.encode()).hexdigest(),'upgradeSourceSha256':hashlib.sha256(up.encode()).hexdigest()},'units':units,'weapons':[weapon],'profiles':profiles,'upgrades':[upgrade],'traits':traits}
Path('app/stark-rift/data/special-original.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'units':[(a['name'],a['defaultOreCost'],a['defaultGasCost'],a['defaultTimeCost']) for a in units],'weapon':weapon,'upgrade':upgrade,'transports':[t for t in traits if t['spaceProvided']>0]},ensure_ascii=False))
