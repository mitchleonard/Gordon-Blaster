// Gordon the Guinea Pig: Poop Blaster — vanilla JS build (with Mute)
(() => {
  const BAD = ["👹","💀","😈"];
  const GOOD = ["🍎","😃","😍"];
  const BULLET = "💩";
  const GPIG = "🐹";

  const START_HEALTH = 5;
  const MAX_ONSCREEN = 14;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (min,max)=>Math.random()*(max-min)+min;
  const dist = (x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);
  const levelFromScore = (score) => Math.floor(score/10)+1;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const restartBtn = document.getElementById("restartBtn");
  const muteBtn = document.getElementById("muteBtn");
  const overlay = document.getElementById("overlay");
  const overlayStart = document.getElementById("overlayStart");
  const pauseCurtain = document.getElementById("pauseCurtain");
  const resumeBtn = document.getElementById("resumeBtn");
  const pauseRestart = document.getElementById("pauseRestart");
  const pauseInfo = document.getElementById("pauseInfo");
  const pauseTitle = document.getElementById("pauseTitle");

  const state = {
    running:false, paused:false, score:0, health:START_HEALTH, level:1,
    message:"Protect Gordon! Move to aim • Click/Tap to fire 💩",
    w:800, h:520, lastSpawn:0, enemies:[], bullets:[], enemiesCleared:0,
    mouse:{x:400,y:260}, gp:{x:400,y:440}, dpr:1, rafId:0,
    audioCtx:null, canPlayAudio:false, muted:false,
  };

  function resize(){
    const parent = canvas.parentElement;
    const cssW = Math.floor(parent.clientWidth);
    const cssH = Math.floor(Math.max(420, Math.min(700, parent.clientWidth*0.6)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW*dpr);
    canvas.height = Math.floor(cssH*dpr);
    state.w = canvas.width; state.h = canvas.height;
  }

  function drawEmoji(emoji,x,y,size,rot=0){
    ctx.save(); ctx.translate(x,y); if(rot!==0) ctx.rotate(rot);
    ctx.font = `${size}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(emoji,0,0); ctx.restore();
  }

  function getAudioCtx(){
    if (state.audioCtx) return state.audioCtx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    state.audioCtx = new Ctor();
    return state.audioCtx;
  }
  function ensureAudio(){
    const ctx = getAudioCtx(); if (!ctx) return false;
    if (ctx.state === "suspended") ctx.resume();
    state.canPlayAudio = ctx.state === "running";
    return state.canPlayAudio;
  }
  function beep(time, freq, dur=0.1, type="square", vol=0.06){
    if (state.muted) return;
    const ctx = getAudioCtx(); if (!ctx || !state.canPlayAudio) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(vol, time); o.connect(g); g.connect(ctx.destination);
    o.start(time); g.gain.exponentialRampToValueAtTime(0.0001, time + dur); o.stop(time + dur + 0.02);
  }
  function sfxReward(){ const ctx = getAudioCtx(); if (!ctx || !state.canPlayAudio || state.muted) return; const t = ctx.currentTime; beep(t+0.00,440,0.08,"square",0.06); beep(t+0.09,660,0.08,"square",0.06); }
  function sfxPunish(){ const ctx = getAudioCtx(); if (!ctx || !state.canPlayAudio || state.muted) return; const t = ctx.currentTime; beep(t+0.00,370,0.06,"square",0.055); beep(t+0.00,415,0.06,"square",0.04); beep(t+0.08,220,0.10,"triangle",0.05); }
  function sfxMiss(){ const ctx = getAudioCtx(); if (!ctx || !state.canPlayAudio || state.muted) return; const t = ctx.currentTime; beep(t,160,0.09,"triangle",0.05); }

  function startGame(){
    state.score=0; state.health=START_HEALTH; state.level = levelFromScore(0);
    state.message="Protect Gordon! Move to aim • Click/Tap to fire 💩";
    state.enemies.length=0; state.bullets.length=0; state.lastSpawn=0;
    state.mouse.x=state.gp.x; state.mouse.y=state.gp.y-120;
    ensureAudio(); state.paused=false; state.running=true;
  }
  function restartGame(){ startGame(); }
  function togglePause(){ if(!state.running) return; state.paused=!state.paused; state.message = state.paused? "Paused — Gordon is waiting…" : "Game on!"; }

  function pointerToCanvas(clientX, clientY){
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) * (canvas.width / r.width), y: (clientY - r.top) * (canvas.height / r.height) };
  }
  canvas.addEventListener("mousemove", (e)=>{ const p = pointerToCanvas(e.clientX,e.clientY); state.mouse = p; });
  canvas.addEventListener("touchstart", (e)=>{ if(!e.touches[0]) return; const p=pointerToCanvas(e.touches[0].clientX,e.touches[0].clientY); state.mouse=p; }, {passive:true});
  canvas.addEventListener("touchmove", (e)=>{ if(!e.touches[0]) return; const p=pointerToCanvas(e.touches[0].clientX,e.touches[0].clientY); state.mouse=p; }, {passive:true});
  canvas.addEventListener("click", (e)=>{ ensureAudio(); const p=pointerToCanvas(e.clientX,e.clientY); state.mouse=p; shoot(); });
  canvas.addEventListener("touchend", ()=>{ ensureAudio(); shoot(); }, {passive:true});

  startBtn.addEventListener("click", ()=> startGame());
  pauseBtn.addEventListener("click", ()=> togglePause());
  restartBtn.addEventListener("click", ()=> restartGame());
  overlayStart.addEventListener("click", ()=> startGame());
  resumeBtn.addEventListener("click", ()=> { state.paused=false; });
  pauseRestart.addEventListener("click", ()=> restartGame());
  muteBtn.addEventListener("click", ()=>{
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? "🔇 Mute" : "🔊 Sound";
    muteBtn.setAttribute("aria-label", state.muted ? "Unmute" : "Mute");
  });

  function shoot(){
    if(!state.running || state.paused) return;
    const armY = state.gp.y - 20;
    [-14,14].forEach((dx)=>{
      const ox = state.gp.x + dx*(state.w/800);
      const oy = armY;
      const ang = Math.atan2(state.mouse.y-oy, state.mouse.x-ox);
      const speed = 8*(state.w/800);
      state.bullets.push({ x:ox, y:oy, vx:Math.cos(ang)*speed, vy:Math.sin(ang)*speed, size: 28*(state.w/800) });
    });
  }

  function loop(t){
    if(state.running && !state.paused){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle="#0b1220"; ctx.fillRect(0,0,canvas.width,canvas.height);

      state.gp.x += (state.mouse.x - state.gp.x) * 0.12;

      const spawnCooldown = Math.max(260, 900 - (state.level - 1) * 110);
      if(t - state.lastSpawn > spawnCooldown && state.enemies.length < MAX_ONSCREEN){
        state.lastSpawn = t;
        const isGood = Math.random() < 0.4;
        const emoji = isGood ? GOOD[(Math.random()*GOOD.length)|0] : BAD[(Math.random()*BAD.length)|0];
        const size = rand(28,44)*(state.w/800);
        const x = rand(size*1.2, state.w - size*1.2);
        const vy = rand(1.4,2.8) * (1 + (state.level-1)*0.14) * (state.h/520);
        state.enemies.push({x, y:-size, vy, size, good:isGood, emoji});
      }

      for(let i=state.enemies.length-1; i>=0; i--){
        const e = state.enemies[i];
        e.y += e.vy;
        if(e.y - e.size > state.h){
          if(!e.good){ state.health = clamp(state.health-1,0,99); state.message = "Yikes! A baddie zapped past Gordon — −1 ❤️"; sfxMiss(); }
          state.enemies.splice(i,1);
        }
      }

      for(let i=state.bullets.length-1; i>=0; i--){
        const b = state.bullets[i];
        b.x += b.vx; b.y += b.vy;
        if(b.x < -50 || b.x > state.w+50 || b.y < -50 || b.y > state.h+50){
          state.bullets.splice(i,1);
        }
      }

      for(let i=state.enemies.length-1; i>=0; i--){
        const e = state.enemies[i];
        for(let j=state.bullets.length-1; j>=0; j--){
          const b = state.bullets[j];
          const r = e.size*0.62 + b.size*0.45;
          if(dist(e.x,e.y,b.x,b.y) < r){
            state.bullets.splice(j,1);
            state.enemies.splice(i,1);
            const delta = e.good ? -1 : +1;
            const after = state.score + delta;
            state.level = levelFromScore(after);
            if(e.good){ state.message = "Uh‑oh! That was one of Gordon’s favorites. −1"; sfxPunish(); }
            else { state.message = "Great shot! You protected Gordon! +1"; sfxReward(); }
            state.score = after;
            break;
          }
        }
      }

      const gpSize = 60*(state.w/800);
      const armLen = 46*(state.w/800);
      const aimAng = Math.atan2(state.mouse.y - (state.gp.y - 20), state.mouse.x - state.gp.x);
      ctx.strokeStyle = "#ffdfa5"; ctx.lineWidth = Math.max(6, 6*(state.w/800)); ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(state.gp.x - gpSize*0.55, state.gp.y - 10); ctx.lineTo(state.gp.x - gpSize*0.55 + Math.cos(aimAng)*armLen, state.gp.y - 10 + Math.sin(aimAng)*armLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(state.gp.x + gpSize*0.55, state.gp.y - 10); ctx.lineTo(state.gp.x + gpSize*0.55 + Math.cos(aimAng)*armLen, state.gp.y - 10 + Math.sin(aimAng)*armLen); ctx.stroke();

      drawEmoji(GPIG, state.gp.x, state.gp.y, gpSize*1.2);
      state.bullets.forEach(b=> drawEmoji(BULLET, b.x, b.y, b.size));
      state.enemies.forEach(e=> drawEmoji(e.emoji, e.x, e.y, e.size));

      const pad = 16*(state.w/800);
      ctx.font = `${Math.max(18*(state.w/800),14)}px ui-sans-serif, system-ui`;
      ctx.fillStyle = "#e6f0ff";
      ctx.textAlign="left"; ctx.fillText(`Score: ${state.score}`, pad, 30*(state.w/800)); ctx.fillText(`Level: ${state.level}`, pad, 56*(state.w/800));
      ctx.textAlign="right"; ctx.fillText("❤️".repeat(state.health), state.w - pad, 34*(state.w/800));
      ctx.textAlign="center"; ctx.fillText(state.message, state.w/2, 34*(state.w/800));

      if(state.health <= 0){ state.paused = true; state.message = "Game Over — Gordon needs a cuddle. Press Restart."; }
    }
    requestAnimationFrame(loop);
  }

  resize(); window.addEventListener("resize", resize);
  requestAnimationFrame(loop);
  overlay.classList.remove("hidden");
})();