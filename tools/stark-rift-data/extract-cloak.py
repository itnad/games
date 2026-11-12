"""Offline extraction from BWAPI v4.4.0 and a pinned OpenBW bwgame.h copy."""
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
selected=['Terran_Ghost','Terran_Wraith','Terran_Academy','Terran_Science_Facility','Terran_Covert_Ops']
columns=['defaultOreCost','defaultGasCost','defaultTimeCost','defaultMaxHP','defaultMaxSP','defaultArmorAmount','unitSupplyProvided','unitSupplyRequired','unitTopSpeeds','sightRangeTiles']
dims=[[int(x) for x in re.findall(r'\d+',d)] for d in re.findall(r'\{([^{}]+)\}',body(u,'unitDimensions'))]
units=[]; profiles=[]; traits=[]; flags=body(u,'unitFlags').split(',')
for name in selected:
 i=un.index(name); values={k:nums(u,k)[i] for k in columns}; values={k:int(v) if v.is_integer() else v for k,v in values.items()}
 units.append({'name':name,'bwapiId':i,**values,'dimensions':dims[i]})
 profiles.append({'name':name,'size':words(u,'unitSize')[i].lower(),'bounds':dims[i][2:],'groundWeapon':words(u,'groundWeapon')[i],'airWeapon':words(u,'airWeapon')[i],'hits':int(nums(u,'groundWeaponHits')[i])})
 traits.append({'name':name,'spaceRequired':int(nums(u,'unitSpaceRequired')[i]),'spaceProvided':int(nums(u,'unitSpaceProvided')[i]),'flyer':'Flyer' in flags[i],'detector':'Detector' in flags[i],'permanentCloak':'PermanentCloak' in flags[i]})
weapons=[]
for name in ['C_10_Canister_Rifle','Burst_Lasers','Gemini_Missiles']:
 i=wn.index(name); weapons.append({'name':name,'bwapiId':i,**{n:int(nums(w,n)[i]) for n in ['defaultWpnDamageAmt','defaultWpnDamageBonus','wpnDamageCooldowns','wpnDamageFactor','wpnMinRange','wpnMaxRange']},'damageType':words(w,'damageType')[i],'upgrade':words(w,'upgrade')[i]})
techs=[]
for name in ['Personnel_Cloaking','Cloaking_Field']:
 i=tn.index(name); techs.append({'name':name,'bwapiId':i,'minerals':int(nums(t,'defaultOreCost')[i]),'gas':int(nums(t,'defaultOreCost')[i]),'frames':int(nums(t,'defaultTimeCost')[i]),'energy':int(nums(t,'defaultEnergyCost')[i]),'producer':words(t,'whatResearches')[i].lower().replace('_','-')})
cost=engine[engine.index('fp8 unit_cloak_energy_cost'):engine.index('void set_secondary_order')]
drains=[int(n) for n in re.findall(r'return (\d+)_fp8;',cost)][:2]; assert drains==[10,13]
regen=re.search(r'u->energy \+ (\d+)_fp8',engine); assert regen and int(regen[1])==8
assert 'else u->energy = unit_max_energy(u) / 4;' in engine
commit=json.loads((root/'openbw-commit.json').read_text())['sha']
out={'source':{'reference':'BWAPI v4.4.0 / Brood War 1.16.1; OpenBW energy frame behavior','bwapiUrl':'https://github.com/bwapi/bwapi/tree/v4.4.0/bwapi/BWAPILIB/Source','openbwUrl':f'https://github.com/OpenBW/openbw/blob/{commit}/bwgame.h','sha256':{n:hashlib.sha256(s.encode()).hexdigest() for n,s in [('UnitType.cpp',u),('WeaponType.cpp',w),('TechType.cpp',t),('bwgame.h',engine)]}},'units':units,'profiles':profiles,'traits':traits,'weapons':weapons,'technologies':techs,'energy':{'scale':256,'initial':50,'maximum':200,'regenerationPerFrame':8,'ghostDrainPerFrame':drains[0],'wraithDrainPerFrame':drains[1],'originalFramesPerSecond':24,'simulationTicksPerSecond':20}}
Path('app/stark-rift/data/cloak-original.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'units':units,'technologies':techs,'weapons':weapons,'energy':out['energy']},ensure_ascii=False))
