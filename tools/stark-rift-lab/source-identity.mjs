import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export async function sourceIdentity(){
  try{
    const [commit,status]=await Promise.all([run('git',['rev-parse','HEAD']),run('git',['status','--porcelain'])]);
    return {commit:commit.stdout.trim(),dirty:!!status.stdout.trim()};
  }catch{return {commit:null,dirty:null};}
}
