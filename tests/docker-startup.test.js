import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise the real launcher with a fake Docker CLI, since CI may not have a daemon.
function run(t, mode, port='3000', target='development') {
  const dir=mkdtempSync(join(tmpdir(),'helix-docker-test-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'docker'),`#!/usr/bin/env node
const fs=require('node:fs');
const args=process.argv.slice(2), file=process.env.FAKE_STATE;
let state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
const save=()=>fs.writeFileSync(file,JSON.stringify(state));
if(args[0]==='info')process.exit(0);
if(args[0]==='build'){state.buildArgs=args;save();process.exit(0);}
if(args[0]==='container')process.exit(state.exists?0:1);
if(args[0]==='inspect'){ console.log(process.env.FAKE_MODE==='foreign'?'someone-else':state.owner);process.exit(0); }
if(args[0]==='rm'){state.exists=false;save();process.exit(0);}
if(args[0]==='exec')process.exit(0);
if(args[0]==='port'){console.log('127.0.0.1:'+state.port);process.exit(0);}
if(args[0]==='run'){
 state.exists=true;
 state.runArgs=args;
 state.owner=args[args.indexOf('--label')+1].split('=')[1];
 state.port=Number(args[args.indexOf('--publish')+1].split(':')[1]);
 state.attempts=(state.attempts||[]).concat(state.port);save();
 if(process.env.FAKE_MODE==='error'){console.error('image platform is unsupported');process.exit(1);}
 if(state.port===3000){console.error('Bind for 127.0.0.1:3000 failed: port is already allocated');process.exit(1);}
 console.log('fake-container-id');process.exit(0);
}
process.exit(1);
`,{mode:0o755});
  const result=spawnSync('bash',['scripts/docker.sh','up',port,target],{encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,FAKE_STATE:join(dir,'state.json'),FAKE_MODE:mode}});
  return {...result,state:()=>JSON.parse(readFileSync(join(dir,'state.json')))};
}
test('occupied port retries the next port and reports the actual URL',t=>{
 const r=run(t,'conflict');assert.equal(r.status,0,r.stderr);assert.deepEqual(r.state().attempts,[3000,3001]);assert.match(r.stdout,/http:\/\/localhost:3001/);
});
test('non-port Docker errors stop without trying more ports',t=>{
 const r=run(t,'error');assert.equal(r.status,1);assert.deepEqual(r.state().attempts,[3000]);assert.match(r.stderr,/platform is unsupported/);assert.equal(r.state().exists,false);
});
test('foreign containers are never removed',t=>{
 const r=run(t,'foreign');assert.equal(r.status,1);assert.match(r.stderr,/Refusing to modify unrelated container/);assert.equal(r.state().exists,true);
});
test('invalid starting ports fail before starting a container',t=>{
 const r=run(t,'conflict','70000');assert.equal(r.status,1);assert.match(r.stderr,/between 1024 and 65535/);
});
test('an explicit free starting port is used directly',t=>{
 const r=run(t,'conflict','8080');assert.equal(r.status,0,r.stderr);assert.deepEqual(r.state().attempts,[8080]);assert.match(r.stdout,/localhost:8080/);
});

test('development mounts source and isolates image dependencies',t=>{
 const r=run(t,'conflict');assert.equal(r.status,0,r.stderr);
 assert.ok(r.state().buildArgs.includes('development'));
 assert.ok(r.state().runArgs.some(arg=>arg.startsWith('type=bind,src=') && arg.endsWith('dst=/app,readonly')));
 assert.ok(r.state().runArgs.includes('/app/node_modules'));
});
test('production runs the runtime image without development mounts',t=>{
 const r=run(t,'conflict','3000','runtime');assert.equal(r.status,0,r.stderr);
 assert.ok(r.state().buildArgs.includes('runtime'));
 assert.ok(!r.state().runArgs.includes('--mount'));
 assert.ok(!r.state().runArgs.includes('--volume'));
});
