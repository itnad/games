import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export async function sourceIdentity(directory=process.cwd()){
  try{
    const [commit,status,tree]=await Promise.all([run('git',['rev-parse','HEAD'],{cwd:directory}),run('git',['status','--porcelain'],{cwd:directory}),run('git',['rev-parse','HEAD^{tree}'],{cwd:directory})]);
    return {commit:commit.stdout.trim(),tree:tree.stdout.trim(),dirty:!!status.stdout.trim()};
  }catch{return {commit:null,tree:null,dirty:null};}
}
