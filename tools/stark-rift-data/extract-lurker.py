"""Extract lurker, egg, spines and research facts without changing earlier data bundles."""
import hashlib,json,re,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else 'work/sources')
u=(root/'unit.cpp').read_text(); w=(root/'weapon.cpp').read_text(); t=(root/'tech.cpp').read_text(); engine=(root/'bwgame.h').read_text()
def body(s,n):
 s=re.sub(r'//[^\n]*','',s); m=re.search(re.escape(n)+r'\[[^\]]+\]\s*=\s*\{(.*?)\};',s,re.S); assert m,n; return m.group(1)
def nums(s,n): return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?',body(s,n))]
def words(s,n): return re.findall(r'\b[A-Za-z_][A-Za-z_0-9]*\b',body(s,n))
def names(s): return re.findall(r'"([^"]*)"',body(s,'typeNames'))
un=names(u); wn=names(w); tn=names(t)
selected=['Zerg_Lurker','Zerg_Lurker_Egg']
columns=['defaultOreCost','defaultGasCost','defaultTimeCost','defaultMaxHP','defaultMaxSP','defaultArmorAmount','unitSupplyProvided','unitSupplyRequired','unitTopSpeeds','sightRangeTiles']
dims=[[int(x) for x in re.findall(r'\d+',d)] for d in re.findall(r'\{([^{}]+)\}',body(u,'unitDimensions'))]
units=[]; profiles=[]; traits=[]; flags=body(u,'unitFlags').split(',')
for name in selected:
 i=un.index(name); values={k:nums(u,k)[i] for k in columns}; values={k:int(v) if v.is_integer() else v for k,v in values.items()}
 units.append({'name':name,'bwapiId':i,**values,'dimensions':dims[i]})
 profiles.append({'name':name,'size':words(u,'unitSize')[i].lower(),'bounds':dims[i][2:],'groundWeapon':words(u,'groundWeapon')[i],'airWeapon':words(u,'airWeapon')[i],'hits':int(nums(u,'groundWeaponHits')[i])})
 traits.append({'name':name,'spaceRequired':int(nums(u,'unitSpaceRequired')[i]),'spaceProvided':int(nums(u,'unitSpaceProvided')[i]),'flyer':'Flyer' in flags[i],'detector':'Detector' in flags[i],'permanentCloak':'PermanentCloak' in flags[i]})
weapons=[]
for name in ['Subterranean_Spines']:
 i=wn.index(name); weapons.append({'name':name,'bwapiId':i,**{n:int(nums(w,n)[i]) for n in ['defaultWpnDamageAmt','defaultWpnDamageBonus','wpnDamageCooldowns','wpnDamageFactor','wpnMinRange','wpnMaxRange','wpnSplashRangeInner','wpnSplashRangeMid','wpnSplashRangeOuter']},'damageType':words(w,'damageType')[i],'upgrade':words(w,'upgrade')[i],'explosionType':words(w,'explosionType')[i]})
i=tn.index('Lurker_Aspect')
tech={'name':'Lurker_Aspect','bwapiId':i,'minerals':int(nums(t,'defaultOreCost')[i]),'gas':int(nums(t,'defaultOreCost')[i]),'frames':int(nums(t,'defaultTimeCost')[i]),'energy':int(nums(t,'defaultEnergyCost')[i]),'producer':words(t,'whatResearches')[i].lower().replace('_','-')}
commit=json.loads((root/'openbw-commit.json').read_text())['sha']
out={'source':{'reference':'BWAPI v4.4.0 / Brood War 1.16.1; OpenBW lurker behavior','bwapiUrl':'https://github.com/bwapi/bwapi/tree/v4.4.0/bwapi/BWAPILIB/Source','openbwUrl':f'https://github.com/OpenBW/openbw/blob/{commit}/bwgame.h','sha256':{n:hashlib.sha256(v.encode()).hexdigest() for n,v in [('UnitType.cpp',u),('WeaponType.cpp',w),('TechType.cpp',t),('bwgame.h',engine)]}},'units':units,'profiles':profiles,'traits':traits,'weapons':weapons,'technology':tech,'requiredUnit':'zerg-lair'}
Path('app/stark-rift/data/lurker-original.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(out,ensure_ascii=False))
