import test from 'node:test';import assert from 'node:assert/strict';
import {inferencePolicy} from '../src/inference-policy.mjs';import {assembleWeights} from '../src/model-loader.mjs';
test('mobile, tablet desktop mode and limited-memory browsers are blocked before model loading',()=>{
 for(const device of [{userAgent:'Mozilla Android Chrome',deviceMemory:8},{userAgent:'iPhone',deviceMemory:8},{userAgent:'Desktop',userAgentData:{mobile:true}},{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5},{userAgent:'Desktop',deviceMemory:4}])assert.equal(inferencePolicy(device).allowed,false);
 assert.equal(inferencePolicy({userAgent:'Windows Chrome',deviceMemory:8}).allowed,true);assert.equal(inferencePolicy({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0}).allowed,true);
 assert.equal(inferencePolicy({userAgent:'Linux desktop'}).maxSeconds,30);
});
test('weights assemble sequentially into one destination and reject incomplete parts',async()=>{
 const names=[];let active=0,peak=0;const out=await assembleWeights({bytes:4,parts:['part-00.bin','part-01.bin']},async name=>{names.push(name);active++;peak=Math.max(peak,active);await Promise.resolve();active--;return Uint8Array.from(name==='part-00.bin'?[1,2]:[3,4]).buffer});
 assert.deepEqual([...out],[1,2,3,4]);assert.equal(peak,1);assert.deepEqual(names,['part-00.bin','part-01.bin']);
 await assert.rejects(()=>assembleWeights({bytes:4,parts:['part-00.bin']},async()=>Uint8Array.from([1,2]).buffer),/Incomplete/);
});
