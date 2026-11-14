"""Extract Arbiter, Stargate, Tribunal and weapon facts without changing earlier data bundles."""
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
technologies=[]
for name in ['Recall','Stasis_Field']:
 i=tn.index(name);technologies.append({'name':name,'minerals':int(nums(t,'defaultOreCost')[i]),'gas':int(nums(t,'defaultOreCost')[i]),'frames':int(nums(t,'defaultTimeCost')[i]),'energy':int(nums(t,'defaultEnergyCost')[i]),'producer':words(t,'whatResearches')[i].lower().replace('_','-')})
i=wn.index('Stasis_Field');range_pixels=int(nums(w,'wpnMaxRange')[i])
commit=json.loads((root/'openbw-commit.json').read_text())['sha']
out={'source':{'reference':'BWAPI v4.4.0 / Brood War1.16.1; OpenBW Recall/Stasis','bwapiUrl':'https://github.com/bwapi/bwapi/tree/v4.4.0/bwapi/BWAPILIB/Source','openbwUrl':f'https://github.com/OpenBW/openbw/blob/{commit}/bwgame.h','sha256':{n:hashlib.sha256(v.encode()).hexdigest() for n,v in [('TechType.cpp',t),('WeaponType.cpp',w),('bwgame.h',engine)]}},'technologies':technologies,'recall':{'delayFrames':22,'halfWidthPixels':64},'stasis':{'rangePixels':range_pixels,'halfWidthPixels':48,'statusCycles':131,'framesPerCycle':8}}
Path('app/stark-rift/data/spells-original.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(out,ensure_ascii=False))
