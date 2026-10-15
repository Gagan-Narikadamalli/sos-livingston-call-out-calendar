import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeDayColors} from '../lib/schedule-colors.mjs';
test('colors accept only valid weekday hex colors and normalize case',()=>{
 assert.deepEqual(normalizeDayColors({monday:'#800000',tuesday:'#ab1234',saturday:'#123456',wednesday:'red',thursday:'url(evil)',friday:'#123'}),{monday:'#800000',tuesday:'#AB1234'});
});
test('reset, old records and invalid values use default text color',()=>{
 for(const value of [undefined,null,[],{},'bad'])assert.deepEqual(normalizeDayColors(value),{});
 assert.deepEqual(normalizeDayColors({monday:'',tuesday:'#17305e'}),{});
});
