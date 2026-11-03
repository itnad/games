import {build} from 'vite';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const baseline=resolve(process.argv[2]??'work/stark-rift-lab/baseline'),directory=await mkdtemp(join(tmpdir(),'stark-equivalence-'));
async function engine(root,name){
  const entry=join(directory,name+'.ts'),file=join(directory,name+'.mjs');
  const source=[
    'export {createScenario,queueScenarioMovement} from '+JSON.stringify(join(root,'tools/stark-rift-lab/scenarios.ts'))+';',
    'export {createMovementRules} from '+JSON.stringify(join(root,'app/stark-rift/core/movement-rules.ts'))+';',
    'export {stepSimulation} from '+JSON.stringify(join(root,'app/stark-rift/core/simulation.ts'))+';',
    'export {checksum} from '+JSON.stringify(join(root,'app/stark-rift/core/checksum.ts'))+';',
  ].join('\n');
  await writeFile(entry,source);
  await build({configFile:false,logLevel:'silent',build:{outDir:directory,emptyOutDir:false,lib:{entry,formats:['es'],fileName:()=>name+'.mjs'}}});
  return import(pathToFileURL(file).href);
}
try{
  const before=await engine(baseline,'before'),after=await engine(resolve('.'),'after'),results=[];
  for(const [id,ticks]of [['controls',200],['passage50',1200],['basin50',1200],['cross200',600]]){
    const a=before.createScenario(id),b=after.createScenario(id),ra=before.createMovementRules(a.map,()=>true),rb=after.createMovementRules(b.map,()=>true);
    before.queueScenarioMovement(a);after.queueScenarioMovement(b);const beforeMs=[],afterMs=[];
    for(let i=0;i<ticks;i++){
      const start=performance.now();before.stepSimulation(a.state,ra);const middle=performance.now();after.stepSimulation(b.state,rb);const end=performance.now();if(i>=20){beforeMs.push(middle-start);afterMs.push(end-middle);}
      if(before.checksum(a.state)!==after.checksum(b.state))throw new Error('State divergence: '+id+' tick '+(i+1));
    }
    const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
    results.push({scenario:id,ticks,equal:true,checksum:after.checksum(b.state),beforeMeanMs:mean(beforeMs),afterMeanMs:mean(afterMs)});console.log(id+': '+ticks+' ticks equal; before '+mean(beforeMs).toFixed(2)+' ms / after '+mean(afterMs).toFixed(2)+' ms');
  }
  await mkdir('work/stark-rift-lab',{recursive:true});
  await writeFile('work/stark-rift-lab/equivalence.json',JSON.stringify({baselineCommit:'a134c98d21d3f63b4eed710a42ada83a0e979701',results},null,2)+'\n');
}finally{await rm(directory,{recursive:true,force:true});}
