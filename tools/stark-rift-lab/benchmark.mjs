import {build} from 'vite';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir,cpus,platform,arch} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceIdentity} from './source-identity.mjs';
const target=resolve('work/stark-rift-lab/benchmark.json'),directory=await mkdtemp(join(tmpdir(),'stark-lab-bench-'));
try{
  await build({configFile:false,logLevel:'silent',build:{outDir:directory,emptyOutDir:false,lib:{entry:'tools/stark-rift-lab/benchmark.ts',formats:['es'],fileName:()=> 'benchmark.mjs'}}});
  const {runBenchmark,runTrafficCheck}=await import(pathToFileURL(join(directory,'benchmark.mjs')).href);
  const results=[];
  for(const [scenario,ticks] of [['controls',200],['passage50',1200],['basin50',1200],['cross200',600]]){
    const result=runBenchmark(scenario,ticks);results.push(result);
    console.log('Systems '+scenario+': '+JSON.stringify(result.systems));
    console.log('Phases '+scenario+': '+JSON.stringify(result.phases));
    console.log(`${scenario}: tick mean ${result.ticks.mean.toFixed(2)} ms / p95 ${result.ticks.p95.toFixed(2)} ms; path mean ${(result.systems.pathfinding?.mean??0).toFixed(2)} ms; remaining ${result.remainingOrders}; sample checks ${result.sampleChecksPassed?'pass':'FAIL'}; arrival gate ${result.arrivalGatePassed===null?'not evaluated':result.arrivalGatePassed?'pass':'FAIL'}`);
  }
  const traffic=['basin50','cross200'].map(id=>{const result=runTrafficCheck(id);console.log('Traffic: '+JSON.stringify(result));return result;});
  const report={format:'stark-rift-headless-benchmark-v1',recordedAt:new Date().toISOString(),source:await sourceIdentity(),traffic,environment:{node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model,logicalCpus:cpus().length},scope:'Node synthetic fixtures; no GPU, touch, transport or real mobile timing',results};
  console.log('Environment: '+JSON.stringify(report.environment));
  await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(report,null,2)+'\n');console.log(`Report: ${target}`);
  if(results.some(result=>!result.sampleChecksPassed||result.arrivalGatePassed===false)||traffic.some(result=>!result.completed))process.exitCode=1;
}finally{await rm(directory,{recursive:true,force:true});}
