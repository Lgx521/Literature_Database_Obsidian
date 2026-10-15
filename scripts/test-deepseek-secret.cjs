'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const crypt=require('node:crypto').webcrypto;
// Exercise the same browser-only module used on iOS, with no Node require.
const context={module:{exports:{}},crypto:crypt,TextEncoder,TextDecoder,Uint8Array};
vm.runInNewContext(fs.readFileSync('scripts/deepseek-secret.js','utf8'),context);
const {encrypt,decrypt,deviceAvailable,rememberDevice,restoreDevice,forgetDevice}=context.module.exports;
(async()=>{
 const key='sk-synthetic-test-key-123456',password='a long synthetic passphrase';
 const envelope=await encrypt(key,password),other=await encrypt(key,password);
 assert(!JSON.stringify(envelope).includes(key));assert(!JSON.stringify(envelope).includes(password));assert.notEqual(envelope.salt,other.salt);assert.notEqual(envelope.iv,other.iv);assert.notEqual(envelope.ciphertext,other.ciphertext);
 assert.equal(await decrypt(JSON.parse(JSON.stringify(envelope)),password),key);
 await assert.rejects(decrypt(envelope,'a different wrong passphrase'),/UNLOCK_FAILED/);
 const altered={...envelope,ciphertext:(envelope.ciphertext[0]==='0'?'1':'0')+envelope.ciphertext.slice(1)};await assert.rejects(decrypt(altered,password),/UNLOCK_FAILED/);
 await assert.rejects(decrypt({...envelope,iterations:1e10},password),/INVALID_SECRET/);await assert.rejects(decrypt({...envelope,iv:'bad'},password),/INVALID_SECRET/);
 await assert.rejects(encrypt(key,'short'),/PASSPHRASE_LENGTH/);await assert.rejects(encrypt('not a key',password),/INVALID_KEY/);
 const secrets=new Map(),app={secretStorage:{isEncryptionAvailable:()=>true,setSecret:(id,value)=>secrets.set(id,value),getSecret:id=>secrets.get(id)||null,deleteSecret:id=>secrets.delete(id)}};
 assert(deviceAvailable(app));assert(!deviceAvailable({}));assert(!deviceAvailable({secretStorage:{setSecret(){},getSecret(){},isEncryptionAvailable:()=>false}}));
 rememberDevice(app,key,envelope);assert.equal(restoreDevice(app,envelope),key);assert.equal(restoreDevice(app,other),null,'Synced key replacement invalidates this device cache');
 assert.equal(restoreDevice({},envelope),null);forgetDevice(app);assert.equal(restoreDevice(app,envelope),null);
 rememberDevice(app,key,null);assert.equal(restoreDevice(app,null),key);forgetDevice(app);
 assert.throws(()=>rememberDevice({},key,envelope),/DEVICE_STORAGE_UNAVAILABLE/);
 app.secretStorage.setSecret=()=>{throw Error('secret accidentally included');};assert.throws(()=>rememberDevice(app,key,envelope),e=>e.message==='DEVICE_STORAGE_FAILED');
 console.log('PASS: browser-only PBKDF2/AES-GCM sync envelope, randomized salts/nonces, wrong-passphrase/tamper rejection and bounded parameters.');
})().catch(e=>{console.error(e);process.exitCode=1;});
