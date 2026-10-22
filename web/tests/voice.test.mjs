import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceRequest,cleanSettings,defaults} from '../src/tuning-settings.mjs';

test('vocal destination requests select an audible pitch/formant treatment, including same-note requests',()=>{
 assert.deepEqual(voiceRequest('change vocals to female').settings,{...defaults,pitch:5,formant:3,low:-2,mid:1,high:2,compression:20});
 assert.equal(voiceRequest('change female to male').settings.pitch,-4);
 assert.equal(voiceRequest('make male vocals feminine').settings.formant,3);
 assert.equal(voiceRequest('a female voice but keep the pitch').settings.pitch,0);
 assert.equal(voiceRequest('make it female pitch +4.5 formant +2.5').settings.pitch,4.5);
 assert.equal(voiceRequest('make it female pitch +4.5 formant +2.5').settings.formant,2.5);
 for(const prompt of ['warm drums','what is a female voice?','do not change to female','explain male voices'])assert.equal(voiceRequest(prompt),null);
});
test('older saved six-control mixes keep their sound and new vocal settings stay finite and bounded',()=>{
 assert.deepEqual(cleanSettings({low:2}),{...defaults,low:2});
 const value=cleanSettings({pitch:30,formant:-30,mid:Infinity,high:NaN});
 assert.equal(value.pitch,12);assert.equal(value.formant,-8);assert.equal(value.mid,0);assert.equal(value.high,0);
});
