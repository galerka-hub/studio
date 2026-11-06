'use strict';
if(window.top!==window.self){document.body.replaceChildren();throw new Error('EMBEDDED_CONTEXT_DENIED');}
const BASE='http://127.0.0.1:18758';
const state={connected:false,session:null,videoUrl:null};
const el=id=>document.getElementById(id),status=s=>el('status').textContent=s;
async function call(path,{method='GET',body,auth=state.session}={}){
 const headers={};if(body!==undefined)headers['Content-Type']='application/json';
 if(auth)headers['X-BL056-Session']=auth;
 const r=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),mode:'cors',credentials:'omit',cache:'no-store',targetAddressSpace:'loopback'});
 if(!r.ok)throw Error('Локальный сервер HTTP '+r.status);
 return r;
}
el('connect').onclick=async()=>{
 try{
  let permission='prompt';try{permission=(await navigator.permissions.query({name:'loopback-network'})).state}catch{}
  if(permission==='denied')throw Error('Разреши Loopback network в настройках Chrome для этого сайта');
  state.connected=(await(await call('/status',{auth:null})).json()).ready===true;
  el('login').hidden=false;el('connection').textContent='Локальный сервер подключён';
  status('Для поиска требуется вход Owner.');
 }catch(e){status('Подключение: '+e.message)}
};
el('send').onclick=async()=>{
 try{
  if(!state.connected)throw Error('Сначала подключись');
  const email=el('email').value.trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Error('Неверный email');
  await call('/otp',{method:'POST',body:{email},auth:null});status('Код отправлен');
 }catch(e){status(e.message)}
};
el('verify').onclick=async()=>{
 try{
  const email=el('email').value.trim(),code=el('otp').value.trim();
  if(!/^\d{6,10}$/.test(code))throw Error('Введите одноразовый код');
  const r=await call('/session',{method:'POST',auth:null,body:{email,code}});
  state.session=(await r.json()).session;
  el('otp').value='';el('login').hidden=true;el('workspace').hidden=false;
  status('Owner вошёл. Сессия существует только в памяти этой вкладки.');
 }catch(e){status(e.message)}
};
el('search').onclick=async()=>{
 try{
  if(!state.session)throw Error('Сначала войди');
  const q=el('term').value.trim();if(q.length<2||q.length>100)throw Error('Неверный запрос');
  const hits=await(await call('/search?q='+encodeURIComponent(q))).json();
  el('results').textContent=hits.map(h=>h.editorial_text+' · '+h.source_relative_start+'–'+h.source_relative_end+' с').join('\n')||'Не найдено';
  if(!hits.length)return;
  const r=await call('/preview'),blob=await r.blob();if(blob.size>48*1024*1024)throw Error('Preview слишком большой');
  if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);
  state.videoUrl=URL.createObjectURL(blob);
  const v=el('player');v.hidden=false;v.src=state.videoUrl;
  await new Promise((resolve,reject)=>{v.addEventListener('loadedmetadata',resolve,{once:true});v.addEventListener('error',()=>reject(Error('Ошибка видео')),{once:true})});
  v.currentTime=Number(hits[0].source_relative_start);
  status('Найдено: '+hits.length+'. Видео открыто на '+hits[0].source_relative_start+' с.');
 }catch(e){status(e.message)}
};
el('logout').onclick=async()=>{
 try{if(state.session)await call('/logout',{method:'POST'});}catch{}finally{
  state.session=null;if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);state.videoUrl=null;
  const v=el('player');v.removeAttribute('src');v.load();v.hidden=true;
  el('results').textContent='';el('login').hidden=false;el('workspace').hidden=true;status('Вы вышли.');
 }
};