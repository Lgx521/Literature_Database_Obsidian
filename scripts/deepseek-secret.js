'use strict';
// Only authenticated ciphertext is synced. The passphrase and plaintext key are
// never stored in plugin data. Optional device retention uses Obsidian SecretStorage.
// Web Crypto works without Node on desktop and mobile.
const ITERATIONS=600000;
function cryptoApi(){if(!globalThis.crypto?.subtle)throw Error('CRYPTO_UNAVAILABLE');return globalThis.crypto;}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
function bytes(value,length){if(typeof value!=='string'||! /^[a-f0-9]+$/.test(value)||value.length!==length*2)throw Error('INVALID_SECRET');return Uint8Array.from(value.match(/../g),b=>parseInt(b,16));}
async function derive(passphrase,salt){
 if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>1024)throw Error('PASSPHRASE_LENGTH');
 const api=cryptoApi(),encoded=new TextEncoder().encode(passphrase);
 try{const material=await api.subtle.importKey('raw',encoded,'PBKDF2',false,['deriveKey']);return await api.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}finally{encoded.fill(0);}
}
async function encrypt(secret,passphrase){
 if(typeof secret!=='string'||! /^[A-Za-z0-9_-]{12,256}$/.test(secret))throw Error('INVALID_KEY');
 const api=cryptoApi(),salt=api.getRandomValues(new Uint8Array(16)),iv=api.getRandomValues(new Uint8Array(12)),key=await derive(passphrase,salt),plain=new TextEncoder().encode(secret);
 try{const cipher=await api.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('literature-database:deepseek:v1')},key,plain);return {v:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,algorithm:'AES-256-GCM',salt:hex(salt),iv:hex(iv),ciphertext:hex(new Uint8Array(cipher))};}finally{plain.fill(0);}
}
async function decrypt(envelope,passphrase){
 if(!envelope||envelope.v!==1||envelope.kdf!=='PBKDF2-SHA256'||envelope.iterations!==ITERATIONS||envelope.algorithm!=='AES-256-GCM'||typeof envelope.ciphertext!=='string'||envelope.ciphertext.length<56||envelope.ciphertext.length>544)throw Error('INVALID_SECRET');
 const api=cryptoApi(),salt=bytes(envelope.salt,16),iv=bytes(envelope.iv,12),cipher=bytes(envelope.ciphertext,envelope.ciphertext.length/2),key=await derive(passphrase,salt);
 let plain;try{plain=new Uint8Array(await api.subtle.decrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('literature-database:deepseek:v1')},key,cipher));const secret=new TextDecoder().decode(plain);if(!/^[A-Za-z0-9_-]{12,256}$/.test(secret))throw Error('INVALID_KEY');return secret;}catch(_){throw Error('UNLOCK_FAILED');}finally{plain?.fill(0);}
}
const DEVICE_ID='literature-database-deepseek';
function deviceAvailable(app){try{const s=app?.secretStorage;return !!s&&typeof s.setSecret==='function'&&typeof s.getSecret==='function'&&s.isEncryptionAvailable?.()===true;}catch(_){return false;}}
function stamp(envelope){return JSON.stringify(envelope||null);}
function rememberDevice(app,key,envelope){
 if(!deviceAvailable(app))throw Error('DEVICE_STORAGE_UNAVAILABLE');
 if(!/^[A-Za-z0-9_-]{12,256}$/.test(key))throw Error('INVALID_KEY');
 try{app.secretStorage.setSecret(DEVICE_ID,JSON.stringify({v:1,key,envelope:stamp(envelope)}));}catch(_){throw Error('DEVICE_STORAGE_FAILED');}
}
function deviceRecord(app,envelope){
 if(!deviceAvailable(app))return null;
 try{const raw=app.secretStorage.getSecret(DEVICE_ID);if(!raw)return null;const data=JSON.parse(raw);return data.v===1&&data.envelope===stamp(envelope)&&/^[A-Za-z0-9_-]{12,256}$/.test(data.key)?data:null;}catch(_){return null;}
}
function deviceState(app,envelope){const data=deviceRecord(app,envelope);return {remembered:!!data,locked:!!data?.locked};}
function restoreDevice(app,envelope){const data=deviceRecord(app,envelope);return data&&!data.locked?data.key:null;}
function lockDevice(app,envelope){const data=deviceRecord(app,envelope);if(!data)return;try{app.secretStorage.setSecret(DEVICE_ID,JSON.stringify({...data,locked:true}));}catch(_){throw Error('DEVICE_STORAGE_FAILED');}}
function forgetDevice(app){
 const s=app?.secretStorage;if(!s)return;
 try{if(typeof s.deleteSecret==='function')s.deleteSecret(DEVICE_ID);else if(typeof s.setSecret==='function')s.setSecret(DEVICE_ID,'');}catch(_){throw Error('DEVICE_STORAGE_FAILED');}
}
module.exports={encrypt,decrypt,deviceAvailable,rememberDevice,restoreDevice,forgetDevice,deviceState,lockDevice};
