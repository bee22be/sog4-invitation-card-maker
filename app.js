/* INVITATION CARD MAKER - vanilla JS + Fabric.js */
(() => {
  const W = 1280, H = 720;
  const DB_NAME = 'profile-card-maker-db', STORE = 'state', KEY = 'project';
  const FONT = 'cinecaption';

  const DEV_CONFIG = {
    assets: {
      background: './assets/background.png',
      frame: './assets/frame.png'
    },
    textPosition: {
      name: { centerX: 220, centerY: 600 },
      ruby: { centerX: 220, centerY: 565 }
    },
    textSize: {
      name: 40,
      ruby: 20
    }
  };

  const canvas = new fabric.Canvas('canvas', { preserveObjectStacking: true, selection: false, uniScaleKey: 'shiftKey' });
  canvas.setDimensions({ width: W, height: H });
  canvas.upperCanvasEl.style.touchAction = 'none';

  const $ = id => document.getElementById(id);
  const els = {
    saveState:$('saveState'), toast:$('toast'), profileInput:$('profileInput'),
    nameInput:$('nameInput'), rubyInput:$('rubyInput'), nameSize:$('nameSize'), rubySize:$('rubySize'), textColor:$('textColor'), textColorHex:$('textColorHex'),
    scaleRange:$('scaleRange'), scaleValue:$('scaleValue'), canvasWrap:$('canvasWrap'), canvasStage:$('canvasStage')
  };
  els.nameSize.value = DEV_CONFIG.textSize.name;
  els.rubySize.value = DEV_CONFIG.textSize.ruby;
  let profile, bg, frame, nameText, rubyText;
  let state = { name:'', ruby:'', nameSize:DEV_CONFIG.textSize.name, rubySize:DEV_CONFIG.textSize.ruby, color:'#fff8e8', profileScale:100 };
  let db;
  let history = [], historyIndex = -1, historyTimer = null, restoring = false;

  function toast(msg){ els.toast.textContent=msg; els.toast.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>els.toast.classList.remove('show'),1700); }
  function openDB(){ return new Promise((resolve,reject)=>{ const r=indexedDB.open(DB_NAME,1); r.onupgradeneeded=()=>r.result.createObjectStore(STORE); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
  async function getSaved(){ if(!db) db=await openDB(); return new Promise((res,rej)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)}); }
  async function putSaved(data){ if(!db) db=await openDB(); return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(data,KEY);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)}); }
  async function clearSaved(){ if(!db) db=await openDB(); return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(KEY);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)}); }

  function imgFromData(src){ return new Promise((resolve,reject)=>{ fabric.Image.fromURL(src,(im)=>im?resolve(im):reject(new Error('image load failed')), { crossOrigin:'anonymous' }); }); }
  function fileToData(file){ return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file)}); }
  function fitCover(im){ const s=Math.max(W/im.width,H/im.height); im.scale(s); im.set({left:W/2,top:H/2,originX:'center',originY:'center'}); }
  function addStatic(im, role){ im.set({selectable:false,evented:false,hasControls:false,hasBorders:false,data:{role}}); canvas.add(im); return im; }

  function circleClip(){
    return new fabric.Circle({ radius:154, left:219, top:332, originX:'center', originY:'center', absolutePositioned:true });
  }
  function setupProfile(im, saved){
    im.set({originX:'center',originY:'center',left:219,top:332,data:{role:'profile'},clipPath:circleClip(),cornerStyle:'circle',cornerColor:'#e9c979',borderColor:'#e9c979',transparentCorners:false,cornerSize:18,padding:8,lockRotation:true});
    im.setControlsVisibility({mtr:false});
    if(saved){ im.set(saved); im.clipPath=circleClip(); }
    profile=im; canvas.add(profile); canvas.setActiveObject(profile);
  }
  function makeTextObjects(){
    nameText=new fabric.Text(state.name||'', {left:DEV_CONFIG.textPosition.name.centerX,top:DEV_CONFIG.textPosition.name.centerY,originX:'center',originY:'center',fontFamily:FONT,fontSize:+state.nameSize,fill:state.color,stroke:'#000',strokeWidth:2,paintFirst:'stroke',data:{role:'name'},selectable:true,evented:true,hasControls:false,hasBorders:true,lockScalingX:true,lockScalingY:true,lockRotation:true,padding:6});
    rubyText=new fabric.Text(state.ruby||'', {left:DEV_CONFIG.textPosition.ruby.centerX,top:DEV_CONFIG.textPosition.ruby.centerY,originX:'center',originY:'center',fontFamily:FONT,fontSize:+state.rubySize,fill:state.color,stroke:'#000',strokeWidth:1,paintFirst:'stroke',data:{role:'ruby'},selectable:true,evented:true,hasControls:false,hasBorders:true,lockScalingX:true,lockScalingY:true,lockRotation:true,padding:6});
    canvas.add(nameText,rubyText);
  }
  function updateText(){
    if(!nameText||!rubyText)return;
    state.name=els.nameInput.value; state.ruby=els.rubyInput.value; state.nameSize=+els.nameSize.value||DEV_CONFIG.textSize.name; state.rubySize=+els.rubySize.value||DEV_CONFIG.textSize.ruby; state.color=els.textColor.value;
    nameText.set({text:state.name,fontSize:state.nameSize,fill:state.color});
    rubyText.set({text:state.ruby,fontSize:state.rubySize,fill:state.color});
    nameText.setCoords(); rubyText.setCoords();
    canvas.requestRenderAll(); scheduleSave(); recordHistory();
  }
  function resetText(){
    nameText?.set({left:DEV_CONFIG.textPosition.name.centerX,top:DEV_CONFIG.textPosition.name.centerY,originX:'center',originY:'center',angle:0});
    rubyText?.set({left:DEV_CONFIG.textPosition.ruby.centerX,top:DEV_CONFIG.textPosition.ruby.centerY,originX:'center',originY:'center',angle:0});
    nameText?.setCoords(); rubyText?.setCoords();
    canvas.discardActiveObject(); canvas.requestRenderAll(); scheduleSave(); recordHistory();
  }
  function centerProfile(){ if(!profile)return; profile.set({left:219,top:332}); profile.setCoords(); canvas.requestRenderAll(); syncScale(); scheduleSave(); recordHistory(); }
  function syncScale(){ if(!profile)return; const pct=Math.round(profile.scaleX*100); els.scaleRange.value=Math.max(25,Math.min(300,pct)); els.scaleValue.textContent=pct+'%'; state.profileScale=pct; }
  function setProfileScale(pct){ if(!profile)return; const s=pct/100; profile.scale(s); profile.setCoords(); canvas.requestRenderAll(); els.scaleValue.textContent=pct+'%'; state.profileScale=pct; scheduleSave(); recordHistory(); }
  function nudge(dx,dy){if(!profile)return;profile.left+=dx;profile.top+=dy;profile.setCoords();canvas.requestRenderAll();scheduleSave();recordHistory()}

  function snapshot(){ return JSON.stringify({version:'5.3.1', objects:canvas.toJSON(['data']).objects, state}); }
  function recordHistory(){
    if(restoring)return;
    clearTimeout(historyTimer); historyTimer=setTimeout(()=>{
      const snap=snapshot();
      if(history[historyIndex]===snap)return;
      history=history.slice(0,historyIndex+1); history.push(snap); if(history.length>60)history.shift(); else historyIndex++;
      updateUndoRedo();
    },100);
  }
  function updateUndoRedo(){ $('undoBtn').disabled=historyIndex<=0; $('redoBtn').disabled=historyIndex>=history.length-1; }
  async function loadSnapshot(snap){
    restoring=true;
    const obj=JSON.parse(snap); state=obj.state||state;
    await new Promise((resolve)=>canvas.loadFromJSON({objects:obj.objects},()=>resolve()));
    bg=canvas.getObjects().find(o=>o.data?.role==='background'); frame=canvas.getObjects().find(o=>o.data?.role==='frame'); profile=canvas.getObjects().find(o=>o.data?.role==='profile'); nameText=canvas.getObjects().find(o=>o.data?.role==='name'); rubyText=canvas.getObjects().find(o=>o.data?.role==='ruby');
    if(profile){profile.clipPath=circleClip(); profile.set({cornerStyle:'circle',cornerColor:'#e9c979',borderColor:'#e9c979',transparentCorners:false,cornerSize:18,padding:8});profile.setControlsVisibility({mtr:false});}
    [bg,frame].filter(Boolean).forEach(o=>o.set({selectable:false,evented:false}));
    [nameText,rubyText].filter(Boolean).forEach(o=>o.set({selectable:true,evented:true,hasControls:false,lockScalingX:true,lockScalingY:true,lockRotation:true,padding:6}));
    [nameText,rubyText].filter(Boolean).forEach(o=>{
      if(o.originX!=='center'){
        o.set({left:o.left + (o.width * o.scaleX) / 2, originX:'center', originY:'center'});
        o.setCoords();
      }
    });
    syncForm(); canvas.discardActiveObject(); canvas.requestRenderAll(); restoring=false; updateUndoRedo();
  }
  async function undo(){if(historyIndex<=0)return;historyIndex--;await loadSnapshot(history[historyIndex]);scheduleSave(false)}
  async function redo(){if(historyIndex>=history.length-1)return;historyIndex++;await loadSnapshot(history[historyIndex]);scheduleSave(false)}

  function scheduleSave(show=true){
    clearTimeout(scheduleSave.t); scheduleSave.t=setTimeout(async()=>{
      try{ await putSaved({snapshot:snapshot(), assets:{background:bg?.getSrc?.()||null, frame:frame?.getSrc?.()||null, profile:profile?.getSrc?.()||null}}); if(show){els.saveState.textContent='保存済み';setTimeout(()=>els.saveState.textContent='自動保存中',1200)}}catch(e){console.error(e);els.saveState.textContent='保存エラー'}
    },300);
  }
  function syncForm(){
    els.nameInput.value=state.name??nameText?.text??''; els.rubyInput.value=state.ruby??rubyText?.text??''; els.nameSize.value=state.nameSize||nameText?.fontSize||DEV_CONFIG.textSize.name; els.rubySize.value=state.rubySize||rubyText?.fontSize||DEV_CONFIG.textSize.ruby; els.textColor.value=state.color||'#fff8e8'; els.textColorHex.textContent=els.textColor.value; syncScale();
  }

  async function loadLocalAsset(path){ return new Promise((resolve,reject)=>{ fabric.Image.fromURL(path,(im)=>im?resolve(im):reject(new Error('asset load failed: '+path))); }); }
  async function createFresh(){
    canvas.clear();
    const b=await loadLocalAsset(DEV_CONFIG.assets.background);
    const f=await loadLocalAsset(DEV_CONFIG.assets.frame);
    b.set({left:0,top:0,originX:'left',originY:'top',scaleX:1,scaleY:1}); b.scaleToWidth(W); b.scaleToHeight(H); bg=addStatic(b,'background');
    f.set({left:0,top:0,originX:'left',originY:'top'}); f.scaleToWidth(W); f.scaleToHeight(H); frame=addStatic(f,'frame');
    const placeholder=new fabric.Rect({left:219,top:332,width:308,height:308,originX:'center',originY:'center',fill:'#17171a',stroke:'rgba(233,201,121,.2)',strokeWidth:1,data:{role:'profilePlaceholder'},selectable:false,evented:false});
    canvas.add(placeholder);
    makeTextObjects();
    canvas.sendToBack(bg); canvas.sendToBack(placeholder); canvas.bringToFront(frame); canvas.bringToFront(nameText); canvas.bringToFront(rubyText);
    canvas.requestRenderAll(); recordHistory(); scheduleSave();
  }
  async function replaceProfile(data){
    const im=await imgFromData(data);
    if(profile)canvas.remove(profile);
    setupProfile(im); centerProfile();
    const maxDim=Math.max(im.width,im.height); const s=308/maxDim; im.scale(s); syncScale();
    canvas.bringToFront(frame); canvas.bringToFront(nameText); canvas.bringToFront(rubyText); canvas.setActiveObject(profile); canvas.requestRenderAll(); scheduleSave();recordHistory(); toast('プロフィール画像を更新しました');
  }
  function removeProfile(){if(!profile)return;canvas.remove(profile);profile=null;canvas.discardActiveObject();canvas.requestRenderAll();scheduleSave();recordHistory();toast('プロフィール画像を削除しました')}

  canvas.on('selection:created', e=>{
    const target=e.selected?.[0];
    if(target?.data?.role==='profile')syncScale();
  });
  canvas.on('selection:updated', e=>{
    const target=e.selected?.[0];
    if(target?.data?.role==='profile')syncScale();
  });
  canvas.on('object:moving', e=>{ if(['profile','name','ruby'].includes(e.target?.data?.role))scheduleSave(false); });
  canvas.on('object:modified', e=>{
    if(e.target?.data?.role==='profile')syncScale();
    if(['profile','name','ruby'].includes(e.target?.data?.role))recordHistory();
    scheduleSave();
  });
  canvas.on('mouse:dblclick', e=>{if(e.target?.data?.role==='profile')toast('四隅をドラッグして拡大・縮小できます')});
  canvas.on('mouse:wheel', opt=>{ if(!profile||canvas.getActiveObject()!==profile)return; const d=opt.e.deltaY; let p=Math.round(profile.scaleX*100)-(d>0?3:-3);p=Math.max(25,Math.min(300,p));setProfileScale(p);opt.e.preventDefault();opt.e.stopPropagation(); });

  function resizePreview(){
    const width=Math.max(1,els.canvasWrap.clientWidth);
    const scale=Math.min(width/W, els.canvasWrap.clientHeight/H);
    els.canvasStage.style.transform=`scale(${scale})`;
  }
  window.addEventListener('resize',resizePreview);
  if('ResizeObserver' in window) new ResizeObserver(resizePreview).observe(els.canvasWrap);

  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));document.querySelectorAll('.tab-content').forEach(x=>x.classList.toggle('active',x.dataset.panel===t.dataset.tab));}));
  els.profileInput.addEventListener('change',async e=>{const f=e.target.files[0];if(f)await replaceProfile(await fileToData(f));e.target.value=''});
  ['nameInput','rubyInput','nameSize','rubySize','textColor'].forEach(id=>$(id).addEventListener('input',()=>{els.textColorHex.textContent=els.textColor.value;updateText()}));
  els.scaleRange.addEventListener('input',e=>setProfileScale(+e.target.value));
  $('centerProfile').onclick=centerProfile;$('removeProfile').onclick=removeProfile;$('resetText').onclick=resetText;
  $('nudgeCenter').onclick=centerProfile;document.querySelectorAll('[data-dx]').forEach(b=>b.addEventListener('click',()=>nudge(+b.dataset.dx,+b.dataset.dy)));
  $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
  $('downloadBtn').onclick=download;$('downloadBtn2').onclick=download;
  $('resetAll').onclick=async()=>{
    if(!confirm('保存した編集データを消去して、最初からやり直しますか？'))return;
    await clearSaved();
    history=[]; historyIndex=-1;
    state={name:'',ruby:'',nameSize:DEV_CONFIG.textSize.name,rubySize:DEV_CONFIG.textSize.ruby,color:'#fff8e8',profileScale:100};
    await createFresh();
    toast('最初からやり直しました');
  };

  function download(){
    canvas.discardActiveObject(); canvas.requestRenderAll();
    const data=canvas.toDataURL({format:'png',multiplier:1,enableRetinaScaling:false});
    const a=document.createElement('a');a.href=data;a.download='invitation-card-1280x720.png';a.click();toast('PNGを書き出しました');
  }

  async function init(){
    try{
      const saved=await getSaved();
      if(saved?.snapshot){
        await loadSnapshot(saved.snapshot);
        const obj=JSON.parse(saved.snapshot); history=[saved.snapshot];historyIndex=0; state=obj.state||state; syncForm();
        toast('前回の編集状態を復元しました');
      } else {
        await createFresh();
      }
      resizePreview();
      updateUndoRedo();
    }catch(e){console.error(e);toast('初期化に失敗しました。ページを再読み込みしてください。')}
  }
  init();
})();
