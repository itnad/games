"""Pinned BWAPI4.4.0/OpenBW Parasite cost/range/target, shared vision/detection and dispel facts."""
import re,json,hashlib,sys
from pathlib import Path
root=Path(sys.argv[1]if len(sys.argv)>1 else'work/sources');t=(root/'tech.cpp').read_text();w=(root/'weapon.cpp').read_text();e=(root/'bwgame.h').read_text()
def body(s,n):return re.search(re.escape(n)+r'\[[^\]]+\]\s*=\s*\{(.*?)\};',re.sub(r'//[^\n]*','',s),re.S)[1]
def names(s):return re.findall(r'"([^"]*)"',body(s,'typeNames'))
def ints(s,n):return list(map(int,re.findall(r'\d+',body(s,n))))
i=names(t).index('Parasite');j=names(w).index('Parasite');flags=body(w,'wpnFlags').split(',')[j].strip();cost=ints(t,'defaultEnergyCost')[i];distance=ints(w,'wpnMaxRange')[j];assert(cost,distance,ints(t,'defaultTimeCost')[i])==(75,384,0);assert re.findall(r'\w+',body(t,'whatResearches'))[i]=='None';assert flags=='TARG_AIR | TARG_GROUND | TARG_NOBUILD'
assert 'u->parasite_flags |= 1 << owner'in e[e.index('void parasite_unit'):e.index('void stasis_unit')];assert 'u->parasite_flags = 0'in e[e.index('void restore_unit'):e.index('void emp_shockwave')];assert '| u->parasite_flags'in e[e.index('void refresh_unit_vision'):e.index('void turn_turret')];assert '| detector->parasite_flags'in e[e.index('uint32_t unit_calculate_detected_flags'):e.index('void remove_target_references')];assert 'ems.refresh_vision = false'in e[e.index('bool movement_UM_Hidden'):e.index('bool movement_UM_Bunker')]
out={'source':{'bwapiTag':'v4.4.0','openbwCommit':json.loads((root/'openbw-commit.json').read_text())['sha'],'sha256':{n:hashlib.sha256((root/n).read_bytes()).hexdigest()for n in ['tech.cpp','weapon.cpp','bwgame.h']}},'ability':{'id':'parasite','title':'패러사이트','energy':cost,'rangePixels':distance,'requiresResearch':False,'targetFlags':flags},'status':{'permanent':True,'sourceOwnerMask':True,'sharesCurrentSight':True,'sharesDetection':True,'detectsInfectedCloakedVictim':True,'restorable':True,'cargoSharesSight':False,'buildingCompletionClears':True}}
Path('app/stark-rift/data/parasite-original.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False))
