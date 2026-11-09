/* ESPELHO da etapa 5: motor completo (skills + drops + torre) a alimentar o HUD.
   Fonte de verdade: src/lib/game/*.ts  ·  src/hooks/useCombat.ts */
const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic'];
const RARITY_LABEL = {common:'Comum',uncommon:'Incomum',rare:'Rara',epic:'Épica',legendary:'Lendária',mythic:'Mítica'};
const RARITY_COLOR = {common:'156 163 175',uncommon:'74 222 128',rare:'56 189 248',epic:'167 139 250',legendary:'251 191 36',mythic:'244 114 182'};
const BOSS_INTERVAL = 10, WAVES = 9, BOSS_WAVE = 10;

const FAMILIES = [
  {biome:'Planície',icon:'🌾',mobs:['Gosma Verde','Javali Selvagem','Rato do Campo','Sílfide do Prado'],boss:'Rex Rochoso',bossIcon:'🦖'},
  {biome:'Floresta',icon:'🌲',mobs:['Lobo Sombrio','Treant','Aranha da Mata','Lobo de Musgo'],boss:'T-Rex Ancião',bossIcon:'🦕'},
  {biome:'Cavernas',icon:'🔥',mobs:['Salamandra','Golem de Pedra','Morcego de Magma','Cavaleiro de Basalto'],boss:'Rei Lich',bossIcon:'💀'},
  {biome:'Pico',icon:'❄️',mobs:['Sílfide do Gelo','Troll de Gelo','Lince das Neves','Espectro Gélido'],boss:'Wyrm Congelado',bossIcon:'🐉'},
  {biome:'Ruínas',icon:'🏛️',mobs:['Espectro','Constructo Guardião','Acólito Corrompido','Serpente de Pedra'],boss:'Serafim Caído',bossIcon:'👼'},
  {biome:'Abismo',icon:'🕳️',mobs:['Sabujo Abissal','Espectro do Vazio','Fauce do Abismo','Cultista Sombrio'],boss:'Soberano do Abismo',bossIcon:'👑'},
];
const ITEMS = [
  ['Espada de Ferro','⚔️','common'],['Arco do Caçador','🏹','uncommon'],['Cajado Arcano','🪄','rare'],
  ['Adaga das Sombras','🗡️','epic'],['Lança do Dragão','🔱','legendary'],['Cota de Malha','🥋','uncommon'],
  ['Túnica Arcana','👘','rare'],['Placa Abissal','🛡️','mythic'],['Elmo de Ferro','⛑️','uncommon'],
  ['Capuz Arcano','🎩','rare'],['Escudo Torre','🛡️','epic'],['Botas Velozes','🥾','rare'],
  ['Amuleto da Sorte','💎','epic'],['Capa do Viajante','🧥','uncommon'],
];
const SKILLS = {
  paladin:[['Martelo da Justiça',14,30,'stun'],['Aura de Devoção',30,40,'buff']],
  hunter:[['Tiro Mortal',8,30,'dmg'],['Rajada Tripla',5,15,'dmg']],
  cleric:[['Cura Maior',6,35,'heal'],['Renovar',8,25,'hot']],
  mage:[['Explosão Arcana',10,35,'dmg'],['Meteoro',25,80,'dmg']],
};
const RARITY_W = [
  {min:1,w:{common:78,uncommon:18,rare:3.4,epic:.5,legendary:.09,mythic:.01}},
  {min:10,w:{common:60,uncommon:28,rare:9,epic:2.4,legendary:.5,mythic:.1}},
  {min:20,w:{common:42,uncommon:34,rare:17,epic:5.5,legendary:1.3,mythic:.2}},
  {min:30,w:{common:28,uncommon:36,rare:24,epic:9,legendary:2.5,mythic:.5}},
];
function createRng(seed){let s0=(seed>>>0)||0x9e3779b9,s1=(s0^0x9e3779b9)>>>0,s2=(s0^0x243f6a88)>>>0,s3=(s0^0xb7e15162)>>>0;if(!(s0|s1|s2|s3))s0=1;
  const next=()=>{const t=s0^((s0<<11)&0xffffffff);s0=s1;s1=s2;s2=s3;s3=(s3^(s3>>>19)^t^(t>>>8))>>>0;return s3/4294967296;};
  return{next,int:(a,b)=>{const lo=Math.ceil(a),hi=Math.floor(b);return hi<lo?lo:lo+Math.floor(next()*(hi-lo+1));},
    chance:p=>p<=0?false:p>=1?true:next()<p,
    weighted:items=>{const u=items.filter(i=>i.weight>0),t=u.reduce((s,i)=>s+i.weight,0);let r=next()*t;
      for(const i of u){r-=i.weight;if(r<=0)return i.value;}return u[u.length-1].value;}};}
function rarityWeights(f){let lo=RARITY_W[0],up=RARITY_W[RARITY_W.length-1];
  RARITY_W.forEach((t,i)=>{if(f>=t.min){lo=t;up=RARITY_W[i+1]||t;}});
  if(lo===up||up.min===lo.min)return lo.w;const p=Math.min(1,(f-lo.min)/(up.min-lo.min));const o={};
  for(const r of RARITY_ORDER)o[r]=lo.w[r]+(up.w[r]-lo.w[r])*p;return o;}
function rollRarity(f,rng){const w=rarityWeights(f);return rng.weighted(RARITY_ORDER.map(r=>({value:r,weight:Math.max(0,w[r])})));}
function raise(r,s){return RARITY_ORDER[Math.min(5,Math.max(0,RARITY_ORDER.indexOf(r)+s))];}
const AFFIXES={common:0,uncommon:1,rare:2,epic:3,legendary:4,mythic:5};

const S={phase:'idle',floor:1,wave:1,highest:1,checkpoint:1,cleared:[],mode:'advance',gold:0,exp:0,
  loot:[],log:[],floats:[],units:[],effects:[],metrics:{},running:false,speed:1,ticks:0,
  seed:20261106,rng:createRng(20261106),transition:null,lastPhase:'idle'};
const $=id=>document.getElementById(id);

function family(f){return FAMILIES[Math.min(FAMILIES.length-1,Math.floor((f-1)/5))];}
function isBossFloor(f){return f%BOSS_INTERVAL===0;}
function wavesFor(f){return isBossFloor(f)?BOSS_WAVE:WAVES;}
function log(text,kind){S.log.unshift({text,kind:kind||'',at:S.ticks});if(S.log.length>80)S.log.pop();}

/* ---------------- actores (espelho de actors.ts) ---------------- */
const HEROES=[
  {id:'h1',name:'Paladino',icon:'🛡️',cls:'paladin',pos:'front',role:'tank'},
  {id:'h2',name:'Atirador',icon:'🏹',cls:'hunter',pos:'mid',role:'dps'},
  {id:'h3',name:'Sacerdote',icon:'✨',cls:'cleric',pos:'back',role:'healer'},
  {id:'h4',name:'Arquimago',icon:'🔮',cls:'mage',pos:'back',role:'dps'},
];
function buildHeroes(level){
  return HEROES.map(h=>{
    const hp = Math.round((h.cls==='paladin'?260:h.cls==='hunter'?190:h.cls==='cleric'?210:170) * (1+(level-1)*0.08));
    const atk = Math.round((h.cls==='mage'?62:h.cls==='hunter'?54:h.cls==='cleric'?26:32) * (1+(level-1)*0.09));
    return {...h,team:'squad',level,hp,maxHp:hp,mp:340,maxMp:340,shield:0,atk,
      aps:(h.cls==='hunter'?1.25:1.0),cd:0,fx:[],
      skills:(SKILLS[h.cls]||[]).map(([name,cd,mp,kind])=>({name,cd,mp,kind,remaining:0}))};
  });
}
function buildEnemies(floor,wave,level){
  const fam=family(floor),boss=isBossFloor(floor)&&wave>=BOSS_WAVE;
  const name=boss?fam.boss:fam.mobs[wave%fam.mobs.length];
  const icon=boss?fam.bossIcon:fam.icon;
  const hp=Math.round((boss?5200:520)*(1+(floor-1)*0.18)*(boss?1:1));
  const count=boss?1:2;const out=[];
  for(let i=0;i<count;i++)out.push({id:'e'+i,name,icon,team:'enemy',pos:'front',level:floor*2,boss,
    hp,maxHp:hp,mp:0,maxMp:0,shield:0,atk:Math.round((boss?150:52)*(1+(floor-1)*0.12)),aps:boss?0.7:0.85,cd:0,fx:[],skills:[]});
  return out;
}

/* ---------------- motor ---------------- */
function spawnWave(){
  const boss=isBossFloor(S.floor)&&S.wave>=BOSS_WAVE;
  const level=20+S.floor*2;
  const heroes=buildHeroes(level);
  S.units=[...heroes,...buildEnemies(S.floor,S.wave,level)];
  S.effects=[];S.floats=[];S.metrics={totalDamage:0,perActor:{}};
  S.phase=boss?'boss':'fighting';
  S.transition={kind:boss?'boss':'wave',label:boss?'CHEFE':('WAVE '+S.wave),at:performance.now()};
  log(boss?('☠ CHEFE: '+family(S.floor).boss):('▶ Wave '+S.wave+'/'+wavesFor(S.floor)),'boss');
}

function addFloat(targetId,kind,text,value){
  S.floats.push({id:Math.random().toString(36).slice(2),targetId,kind,text,value,at:performance.now(),
    ox:(Math.random()-0.5)*28});
  if(S.floats.length>50)S.floats.shift();
}

function recordDamage(src,amount){
  S.metrics.totalDamage+=amount;
  const a=S.metrics.perActor[src]||{dmg:0,hits:0};
  a.dmg+=amount;a.hits+=1;S.metrics.perActor[src]=a;
}

function tick(dt){
  S.ticks+=1;
  const now=performance.now();

  // efeitos (DoT/HoT)
  for(const fx of S.effects){
    fx.remaining-=dt;
    if(fx.remaining<=0)continue;
    const t=S.units.find(u=>u.id===fx.targetId);if(!t)continue;
    fx.acc=(fx.acc||0)+dt;
    if(fx.acc>=fx.interval){fx.acc=0;
      if(fx.kind==='dot'){t.hp=Math.max(0,t.hp-fx.tick);addFloat(t.id,'damage',Math.round(fx.tick),fx.tick);}
      else{t.hp=Math.min(t.maxHp,t.hp+fx.tick);addFloat(t.id,'heal','+'+Math.round(fx.tick),fx.tick);}}
  }
  S.effects=S.effects.filter(fx=>fx.remaining>0);
  for(const u of S.units)u.fx=S.effects.filter(fx=>fx.targetId===u.id);

  S.floats=S.floats.filter(f=>now-f.at<900);
  if(S.transition&&now-S.transition.at>1400)S.transition=null;

  if(S.phase!=='fighting'&&S.phase!=='boss')return;

  const heroes=S.units.filter(u=>u.team==='squad'&&u.hp>0);
  const foes=S.units.filter(u=>u.team==='enemy'&&u.hp>0);

  // skills
  for(const h of heroes){
    for(const sk of h.skills||[]){
      sk.remaining=Math.max(0,sk.remaining-dt);
      if(sk.remaining>0||h.mp<sk.mp)continue;
      const target=foes.length?foes.reduce((a,b)=>a.hp<b.hp?a:b):null;
      if(!target)break;
      h.mp-=sk.mp;sk.remaining=sk.cd;
      if(sk.kind==='dmg'){
        const dmg=Math.round(h.atk*3.2*(0.9+S.rng.next()*0.2));
        target.hp=Math.max(0,target.hp-dmg);recordDamage(h.id,dmg);
        addFloat(target.id,dmg>h.atk*3.6?'crit':'damage',Math.round(dmg),dmg);
        log(sk.name+' → '+target.name+' ('+dmg+')','');
      } else if(sk.kind==='heal'||sk.kind==='hot'){
        const hurt=heroes.reduce((a,b)=>a.hp/a.maxHp<b.hp/b.maxHp?a:b);
        const heal=Math.round(h.atk*4);
        if(sk.kind==='hot'){S.effects.push({kind:'hot',skill:sk.name,targetId:hurt.id,tick:Math.round(heal/8),interval:1,remaining:8,acc:0});}
        else{hurt.hp=Math.min(hurt.maxHp,hurt.hp+heal);addFloat(hurt.id,'heal','+'+heal,heal);}
        log(sk.name+' → '+hurt.name,'');
      } else if(sk.kind==='buff'){
        const sh=Math.round(h.maxHp*0.15);h.shield+=sh;addFloat(h.id,'shield','⬡ '+sh,sh);
      } else if(sk.kind==='stun'){
        const dmg=Math.round(h.atk*2.2);target.hp=Math.max(0,target.hp-dmg);
        recordDamage(h.id,dmg);addFloat(target.id,'damage',Math.round(dmg),dmg);
        target.stunned=(target.stunned||0)+2;
      }
    }
  }

  // auto-attacks
  for(const u of [...heroes,...foes]){
    if(u.stunned>0){u.stunned-=dt;continue;}
    u.cd-=dt;if(u.cd>0)continue;
    u.cd=1/Math.max(0.3,u.aps);
    const pool=u.team==='squad'?foes:heroes;if(!pool.length)continue;
    const target=pool.reduce((a,b)=>a.hp<b.hp?a:b);
    const crit=S.rng.chance(0.15);
    const dmg=Math.round(u.atk*(0.85+S.rng.next()*0.3)*(crit?1.4:1));
    target.hp=Math.max(0,target.hp-dmg);
    if(u.team==='squad')recordDamage(u.id,dmg);
    addFloat(target.id,crit?'crit':'damage',Math.round(dmg),dmg);
  }

  const foesLeft=S.units.filter(u=>u.team==='enemy'&&u.hp>0);
  const heroesLeft=S.units.filter(u=>u.team==='squad'&&u.hp>0);
  if(!heroesLeft.length){applyWipe();return;}
  if(!foesLeft.length){onWaveClear();}
}

function rollDrops(){
  const boss=isBossFloor(S.floor)&&S.wave>=BOSS_WAVE;
  const gold=S.rng.chance(boss?1:0.6)?S.rng.int(8,26)*Math.max(1,S.floor)*(boss?4:1):0;
  const items=[];
  const chance=Math.min(1,(boss?1:0.25)*(1+0.10));
  if(S.rng.chance(chance)){
    const rarity=boss?raise(rollRarity(S.floor,S.rng),2):rollRarity(S.floor,S.rng);
    const cands=ITEMS.filter(i=>RARITY_ORDER.indexOf(i[2])<=RARITY_ORDER.indexOf(rarity));
    const pick=cands.length?cands[S.rng.int(0,cands.length-1)]:ITEMS[0];
    const n=AFFIXES[rarity];const affixes=[];
    for(let i=0;i<n;i++)affixes.push(S.rng.int(1,34));
    items.push({name:pick[0],icon:pick[1],rarity,affixes});
  }
  return{gold,items};
}

function onWaveClear(){
  const boss=isBossFloor(S.floor)&&S.wave>=BOSS_WAVE;
  const d=rollDrops();
  S.gold+=d.gold;
  S.exp+=Math.round(20*S.floor*(1+(S.floor-1)*0.12));
  for(const it of d.items)S.loot.unshift(it);
  if(S.loot.length>30)S.loot.length=30;
  if(d.gold)log('💰 +'+d.gold+' gold','');
  for(const it of d.items)log('🎁 '+it.name+' ('+RARITY_LABEL[it.rarity]+')','');

  if(boss){completeFloor(true);return;}
  if(S.wave>=wavesFor(S.floor)){completeFloor(false);return;}
  S.wave+=1;spawnWave();
}

function completeFloor(wasBoss){
  if(!S.cleared.includes(S.floor))S.cleared.push(S.floor);
  S.highest=Math.max(S.highest,S.floor);
  S.checkpoint=Math.max(S.checkpoint,S.floor);
  if(S.mode==='farm'){S.wave=1;spawnWave();return;}
  S.floor+=1;S.wave=1;S.phase='floor_clear';
  S.transition={kind:'floor',label:family(S.floor).biome.toUpperCase()+' '+S.floor,at:performance.now()};
  log('🏢 Andar '+S.floor+' · '+family(S.floor).biome+(wasBoss?' (chefe derrotado)':''),'boss');
  const snap={floor:S.floor};S.units=[];setTimeout(()=>{if(S.floor===snap.floor)spawnWave();},500);
}

function applyWipe(){
  const respawn=S.mode==='farm'?S.floor:S.checkpoint;
  log('💀 Wipe — checkpoint '+respawn,'boss');
  S.phase='checkpoint';S.floor=respawn;S.wave=1;S.units=[];S.effects=[];
  setTimeout(()=>spawnWave(),600);
}

/* ---------------- render ---------------- */
function renderUnit(u){
  const hpPct=Math.max(0,(u.hp/u.maxHp)*100);
  const mpPct=u.maxMp>0?Math.max(0,(u.mp/u.maxMp)*100):0;
  return '<div class="unit '+(u.team==='enemy'?'foe':'')+(u.boss?' boss':'')+(u.hp>0?'':' dead')+'" data-actor="'+u.id+'">'
    +'<div class="top"><span>'+u.icon+' '+u.name+'</span><small>Lv.'+u.level+'</small></div>'
    +'<div class="bar hp '+(u.boss?'boss':'')+'"><i style="width:'+hpPct+'%"></i></div>'
    +(u.maxMp>0?'<div class="bar mp"><i style="width:'+mpPct+'%"></i></div>':'')
    +(u.shield>0?'<div class="bar sh"><i style="width:'+Math.min(100,(u.shield/u.maxHp)*100)+'%"></i></div>':'')
    +((u.fx&&u.fx.length)?'<div class="fxrow">'+u.fx.slice(0,3).map(f=>'<span class="fx" style="color:'+(f.kind==='dot'?'#f87171':'#4ade80')+'">'+f.kind.toUpperCase()+'</span>').join('')+'</div>':'')
    +'</div>';
}

let layerEl=null;
function render(){
  const fam=family(S.floor);const total=wavesFor(S.floor);
  $('p-floor').textContent='andar '+S.floor;
  $('p-wave').textContent='wave '+S.wave+'/'+total;
  const ph=$('p-phase');ph.textContent=S.phase;
  ph.className='pill'+(S.phase==='boss'?' boss':S.phase==='checkpoint'?' wipe':'');
  $('p-gold').textContent=S.gold.toLocaleString('pt-BR')+' gold';
  $('p-checkpoint').textContent='checkpoint '+S.checkpoint;
  $('f-num').textContent=S.floor;
  $('f-name').textContent=fam.biome+' '+S.floor;
  $('f-biome').textContent=isBossFloor(S.floor)?('andar de chefe · '+fam.boss):fam.mobs.join(' · ');
  $('f-prog').style.width=Math.round((S.wave/total)*100)+'%';
  $('f-wave').textContent=S.wave+' / '+total;

  const heroes=S.units.filter(u=>u.team==='squad');
  const foes=S.units.filter(u=>u.team==='enemy');
  const cp=heroes.reduce((s,h)=>s+h.atk*3+h.maxHp*0.5,0);
  $('hud').innerHTML=['SQUAD <b>'+heroes.filter(h=>h.hp>0).length+'/4</b>','CP <b>'+Math.round(cp).toLocaleString('pt-BR')+'</b>',
    'DPS <b>'+Math.round((S.metrics.totalDamage||0)/Math.max(1,S.ticks/60))+'</b>','MODO <b>'+S.mode+'</b>',
    'EXP <b>'+S.exp.toLocaleString('pt-BR')+'</b>'].map(t=>'<span class="stat">'+t+'</span>').join('');

  $('lane-front').innerHTML='<div class="lane-h">⚔️ Front</div>'
    +foes.map(renderUnit).join('')
    +heroes.filter(h=>h.pos==='front').map(renderUnit).join('');
  $('lane-mid').innerHTML='<div class="lane-h">🛡️ Mid</div>'+heroes.filter(h=>h.pos==='mid').map(renderUnit).join('');
  $('lane-back').innerHTML='<div class="lane-h">✨ Back</div>'+heroes.filter(h=>h.pos==='back').map(renderUnit).join('');

  // floats
  if(layerEl)layerEl.remove();
  layerEl=document.createElement('div');
  layerEl.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';
  const arena=$('arena').getBoundingClientRect();
  const now=performance.now();
  for(const f of S.floats){
    const node=document.querySelector('[data-actor="'+f.targetId+'"]');
    if(!node)continue;
    const r=node.getBoundingClientRect();
    const size=f.kind==='crit'?21:f.kind==='heal'?15:15;
    const color=f.kind==='crit'?'var(--dmg-crit)':f.kind==='heal'?'var(--dmg-heal)':f.kind==='shield'?'#7dd3fc':'var(--dmg-normal)';
    const span=document.createElement('span');
    span.className='float'+(f.kind==='crit'?' crit':'');
    span.textContent=f.text;
    span.style.cssText='left:'+(r.left-arena.left+r.width/2+f.ox)+'px;top:'+(r.top-arena.top+r.height*0.35)+'px;'
      +'font-size:'+size+'px;color:'+color+';animation-delay:'+Math.max(0,now-f.at-20)+'ms';
    layerEl.appendChild(span);
  }
  const tr=S.transition;
  if(tr&&now-tr.at<1400){
    const div=document.createElement('div');div.className='transition';
    const span=document.createElement('span');
    span.textContent=tr.label;
    span.style.color=tr.kind==='floor'?'#fbbf24':tr.kind==='boss'?'#f87171':'#7dd3fc';
    span.style.fontSize=(tr.kind==='floor'?26:20)+'px';
    div.appendChild(span);layerEl.appendChild(div);
  }
  $('arena').appendChild(layerEl);

  $('log').innerHTML=S.log.slice(0,24).map(e=>'<div><span class="t">'+String(e.at).padStart(6,'0')+'</span> <span class="'+(e.kind||'')+'">'+e.text+'</span></div>').join('');
  $('p-log').textContent=String(S.log.length);

  $('loot').innerHTML=S.loot.length?S.loot.map(it=>'<div class="item" style="border-color:rgb('+RARITY_COLOR[it.rarity]+' / .5)">'
    +'<div class="ic" style="box-shadow:0 0 12px -3px rgb('+RARITY_COLOR[it.rarity]+')">'+it.icon+'</div>'
    +'<div><div class="nm" style="color:rgb('+RARITY_COLOR[it.rarity]+')">'+it.name+'</div>'
    +'<div class="mt">'+RARITY_LABEL[it.rarity]+(it.affixes.length?' · '+it.affixes.length+' afixos':'')+'</div></div></div>').join('')
    :'<div class="mt" style="color:#475569">Limpa waves para gerar loot.</div>';
  $('p-loot').textContent=String(S.loot.length);

  $('btn-boss').style.display=isBossFloor(S.floor)?'inline-block':'none';
  $('btn-auto').textContent=S.running?'⏸ Pausar':'▶ Auto-batalha';
  $('btn-speed').textContent='⏩ Velocidade '+S.speed+'×';
}

/* ---------------- loop ---------------- */
let last=0,acc=0;
function frame(ts){
  if(!last)last=ts;
  const delta=Math.min((ts-last)/1000,0.2);last=ts;
  acc+=delta*S.speed;
  let steps=0;
  while(acc>=1/60&&steps<240){acc-=1/60;if(S.running)tick(1/60);S.ticks+= S.running?0:0;steps++;}
  if(!S.running)acc=0;
  render();
  requestAnimationFrame(frame);
}

/* ---------------- controlos ---------------- */
$('btn-auto').onclick=()=>{
  S.running=!S.running;
  if(S.running&&(S.phase==='idle'||S.phase==='checkpoint'))spawnWave();
  render();
};
$('btn-speed').onclick=()=>{S.speed=S.speed===1?2:S.speed===2?4:1;render();};
$('btn-boss').onclick=()=>{S.wave=BOSS_WAVE;S.running=true;spawnWave();render();};
$('btn-wipe').onclick=()=>{applyWipe();render();};
$('btn-farm').onclick=()=>{S.mode=S.mode==='farm'?'advance':'farm';log('🌾 Modo '+S.mode,'');render();};
$('btn-reset').onclick=()=>{
  Object.assign(S,{phase:'idle',floor:1,wave:1,highest:1,checkpoint:1,cleared:[],mode:'advance',
    gold:0,exp:0,loot:[],log:[],floats:[],units:[],effects:[],metrics:{},running:false,ticks:0,
    seed:Math.floor(Math.random()*1e9),transition:null});
  S.rng=createRng(S.seed);S.units=buildHeroes(22);log('↻ Reiniciado (seed '+S.seed+')','');render();
};

S.units=buildHeroes(22);
log('▶ Ascent Gate Idle etapa 5 — motor real','');
render();
requestAnimationFrame(frame);
