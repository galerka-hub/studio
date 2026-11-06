'use strict';
if(window.top!==window.self){document.body.replaceChildren();throw new Error('EMBEDDED_CONTEXT_DENIED');}
const BASE='http://127.0.0.1:18758';
const state={connected:false,session:null,videoUrl:null,searchId:0,loading:false};
const el=id=>document.getElementById(id);
const status=s=>{el('status').textContent=s};
function setLoading(loading,label='Поиск и подготовка видео…'){
 state.loading=loading;
 el('loader').hidden=!loading;
 el('loader-label').textContent=label;
 el('search').disabled=loading;
 el('search').setAttribute('aria-busy',String(loading));
}
function clearVideo(){
 const v=el('player');
 v.pause();v.removeAttribute('src');v.load();v.hidden=true;
 if(state.videoUrl){URL.revokeObjectURL(state.videoUrl);state.videoUrl=null}
}
function updateInterface(){
 const authorized=!!state.session;
 el('connect-panel').hidden=authorized;
 el('login').hidden=authorized||!state.connected;
 el('workspace').hidden=!authorized;
}
async function call(path,{method='GET',body,auth=state.session}={}){
 const headers={};
 if(body!==undefined)headers['Content-Type']='application/json';
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
  el('connection').textContent=state.connected?'Локальный сервер подключён':'Нет подключения';
  updateInterface();
  status(state.connected?'Для поиска требуется вход Owner.':'Не удалось подключиться.');
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
  if(!/^\d{6,10}$/.test(code)&&!code.startsWith('https://'))throw Error('Введите код или исходную ссылку из письма');
  const r=await call('/session',{method:'POST',auth:null,body:{email,code}});
  state.session=(await r.json()).session;
  el('otp').value='';
  updateInterface();
  status('Owner вошёл. Сессия существует только в памяти этой вкладки.');
 }catch(e){status(e.message)}
};
el('search-form').onsubmit=async event=>{
 event.preventDefault();
 const current=++state.searchId;
 setLoading(true);
 clearVideo();
 el('results').textContent='';
 try{
  if(!state.session)throw Error('Сначала войди');
  const q=el('term').value.trim();
  if(q.length<2||q.length>100)throw Error('Неверный запрос');
  const hits=await(await call('/search?q='+encodeURIComponent(q))).json();
  if(current!==state.searchId)return;
  el('results').textContent=hits.map(h=>h.editorial_text+' · '+h.source_relative_start+'–'+h.source_relative_end+' с').join('\n')||'Не найдено';
  if(!hits.length){status('Совпадений нет.');return}
  setLoading(true,'Загрузка видео…');
  const r=await call('/preview'),blob=await r.blob();
  if(current!==state.searchId)return;
  if(blob.size>48*1024*1024)throw Error('Preview слишком большой');
  state.videoUrl=URL.createObjectURL(blob);
  const v=el('player');
  const ready=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{cleanup();reject(Error('Видео загружается слишком долго'))},30000);
   function cleanup(){clearTimeout(timer);v.removeEventListener('loadedmetadata',onReady);v.removeEventListener('error',onError)}
   function onReady(){cleanup();resolve()}
   function onError(){cleanup();reject(Error('Ошибка загрузки видео'))}
   v.addEventListener('loadedmetadata',onReady,{once:true});
   v.addEventListener('error',onError,{once:true});
  });
  v.src=state.videoUrl;
  v.hidden=false;
  await ready;
  if(current!==state.searchId)return;
  v.currentTime=Number(hits[0].source_relative_start);
  status('Найдено: '+hits.length+'. Видео открыто на '+hits[0].source_relative_start+' с.');
 }catch(e){
  if(current===state.searchId){clearVideo();status(e.message)}
 }finally{
  if(current===state.searchId)setLoading(false);
 }
};
el('logout').onclick=async()=>{
 ++state.searchId;
 setLoading(false);clearVideo();
 const session=state.session;
 state.session=null;
 el('results').textContent='';
 updateInterface();
 status('Вы вышли.');
 try{if(session)await call('/logout',{method:'POST',auth:session})}catch(_){}
};
updateInterface();
