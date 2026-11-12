"""Extract factual stage-5a weapon/size values from BWAPI v4.4.0, offline after download."""
import re,json,hashlib,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else 'work/combat-sources');u=(root/'unit.cpp').read_text();w=(root/'weapon.cpp').read_text()
def body(s,name):
 s=re.sub(r'//[^\n]*','',s);m=re.search(re.escape(name)+r'\[[^\]]+\]\s*=\s*\{(.*?)\};',s,re.S);assert m,name;return m.group(1)
def nums(s,name):return [int(x) for x in re.findall(r'-?\d+',body(s,name))]
def words(s,name):return re.findall(r'\b[A-Za-z_][A-Za-z_0-9]*\b',body(s,name))
unames=re.findall(r'"([^"]*)"',body(u,'typeNames'));wnames=re.findall(r'"([^"]*)"',body(w,'typeNames'))
raw=json.loads(Path('app/stark-rift/data/economy-original.json').read_text());size=words(u,'unitSize');gw=words(u,'groundWeapon');aw=words(u,'airWeapon');hits=nums(u,'groundWeaponHits');assert len(size)==len(unames)==len(gw)==len(aw)==len(hits)
weapons=[]
for name in ['Gauss_Rifle','Fusion_Cutter','Claws','Spines','Particle_Beam','Psi_Blades','Fragmentation_Grenade','Arclite_Cannon','Needle_Spines','Phase_Disruptor']:
 i=wnames.index(name);v={'name':name,'bwapiId':i,**{n:nums(w,n)[i] for n in ['defaultWpnDamageAmt','defaultWpnDamageBonus','wpnDamageCooldowns','wpnDamageFactor','wpnMinRange','wpnMaxRange']},'damageType':words(w,'damageType')[i],'upgrade':words(w,'upgrade')[i]};v.update({"explosionType":words(w,"explosionType")[i]}) if name in ["Fragmentation_Grenade","Arclite_Cannon","Needle_Spines","Phase_Disruptor"] else None;weapons.append(v)
profiles=[]
for item in raw['units']:
 i=item['bwapiId'];profiles.append({'name':item['name'],'size':size[i].lower(),'bounds':item['dimensions'][2:],'groundWeapon':gw[i],'airWeapon':aw[i],'hits':hits[i]})
out={'source':{'reference':'BWAPI v4.4.0 / Brood War 1.16.1','url':'https://github.com/bwapi/bwapi/tree/v4.4.0/bwapi/BWAPILIB/Source','unitSourceSha256':hashlib.sha256(u.encode()).hexdigest(),'weaponSourceSha256':hashlib.sha256(w.encode()).hexdigest()},'weapons':weapons,'profiles':profiles};Path('app/stark-rift/data/combat-original.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(weapons))
