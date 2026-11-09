/* SHLIFIM sound — tiny WebAudio tones (no asset files). Respects a mute setting. */
window.SLSound = (function(){
  var ctx=null, muted=false;
  try{ muted = JSON.parse(localStorage.getItem('ml-muted')||'false'); }catch(e){}
  function ac(){ if(!ctx){ var C=window.AudioContext||window.webkitAudioContext; if(C) ctx=new C(); } if(ctx&&ctx.state==='suspended'){ try{ctx.resume();}catch(e){} } return ctx; }
  function blip(freq,start,dur,type,vol){ var c=ac(); if(!c) return; var o=c.createOscillator(),g=c.createGain();
    o.type=type||'sine'; o.frequency.value=freq; o.connect(g); g.connect(c.destination);
    var t=c.currentTime+start; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||0.16,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur+0.03); }
  /* Synth tones — now used as the fallback when an SFX file can't play (offline, decode error). */
  function toneSuccess(){ blip(660,0,0.12,'sine',0.18); blip(880,0.1,0.15,'sine',0.18); blip(1320,0.2,0.2,'sine',0.12); }
  function toneWrong(){ blip(200,0,0.22,'sawtooth',0.13); blip(150,0.09,0.3,'sawtooth',0.11); }
  function toneFanfare(){ [523,659,784,1046].forEach(function(f,i){ blip(f,i*0.1,0.22,'triangle',0.16); }); }

  /* Pre-rendered one-shots. Paths resolve against the document, like audio/manifest.js. */
  var SFX_SRC = { correct:'audio/sfx/correct.mp3', wrong:'audio/sfx/wrong.mp3', trophy:'audio/sfx/trophy.mp3' };
  // Loudness balance: the mistake pop is mastered at full scale (peak 1.0) while the other two
  // peak around 0.8 — without this it lands harder than the reward sounds, which reads as punishing.
  var SFX_VOL = { correct:1, wrong:0.7, trophy:1 };
  var sfxEl = {};
  function el(name){
    if(!sfxEl[name]){ var a=new Audio(); a.preload='auto'; a.volume=SFX_VOL[name]||1; a.src=SFX_SRC[name]; sfxEl[name]=a; }
    return sfxEl[name];
  }
  // Warm the files up on the first real interaction, so the very first correct answer
  // is not silent while the mp3 is still downloading.
  var primed=false;
  function prime(){ if(primed) return; primed=true;
    try{ Object.keys(SFX_SRC).forEach(function(n){ el(n).load(); }); }catch(e){} }
  try{ ['pointerdown','keydown'].forEach(function(ev){
    window.addEventListener(ev, prime, {once:true, passive:true}); }); }catch(e){}

  // A correct answer can unlock an achievement in the same instant, which would stack the win
  // sound on top of the trophy sound. Fade the win out instead of cutting it — an abrupt pause
  // mid-waveform makes an audible click.
  var fadeTimer={};
  function cancelFade(name){
    if(fadeTimer[name]){ clearInterval(fadeTimer[name]); fadeTimer[name]=null; }
    if(sfxEl[name]) sfxEl[name].volume=SFX_VOL[name]||1;
  }
  function duck(name, ms){
    var a=sfxEl[name];
    if(!a || a.paused) return;
    cancelFade(name);
    var base=SFX_VOL[name]||1, steps=6, i=0;
    fadeTimer[name]=setInterval(function(){
      i++;
      try{ a.volume=Math.max(0, base*(1-i/steps)); }catch(e){}
      if(i>=steps){ cancelFade(name); try{ a.pause(); a.currentTime=0; }catch(e){} }
    }, Math.max(10, ms/steps));
  }

  function play(name, fallback){
    if(muted) return;
    try{
      var a=el(name);
      cancelFade(name);           // a restart must not be killed by a fade still in flight
      a.pause();
      a.currentTime=0;            // restart instead of overlapping on rapid answers
      var p=a.play();
      if(p&&p.catch) p.catch(function(){ try{ fallback(); }catch(e){} });
    }catch(e){ try{ fallback(); }catch(e2){} }
  }

  return {
    success:function(){ play('correct', toneSuccess); },   // student answered correctly
    wrong:function(){ play('wrong', toneWrong); },         // student made a mistake
    // the trophy is the bigger moment — it takes the stage from the answer sounds
    trophy:function(){ duck('correct',120); duck('wrong',120); play('trophy', toneFanfare); },
    ding:function(){ if(muted) return; blip(880,0,0.13,'triangle',0.16); blip(1175,0.07,0.18,'triangle',0.12); },
    pop:function(){ if(muted) return; blip(523,0,0.08,'sine',0.14); blip(784,0.06,0.12,'sine',0.11); },
    fanfare:function(){ if(muted) return; toneFanfare(); },
    setMuted:function(m){ muted=!!m; try{ localStorage.setItem('ml-muted', JSON.stringify(muted)); }catch(e){}
      if(muted){ try{ Object.keys(sfxEl).forEach(function(n){ cancelFade(n); sfxEl[n].pause(); }); }catch(e){} } },
    isMuted:function(){ return muted; }
  };
})();

/* Hebrew TTS: pre-generated ElevenLabs "Liam" MP3 for known term names,
   graceful fallback to the Web Speech API for everything else. */
(function () {
  var audioEl = null; // single shared element, avoids overlaps

  function browserSpeak(text) {
    try {
      if (!window.speechSynthesis || !text) return;
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'he-IL'; u.rate = 0.95; u.pitch = 1;
      var vs = window.speechSynthesis.getVoices() || [];
      var he = vs.filter(function (v) { return /he|iw/i.test(v.lang); })[0];
      if (he) u.voice = he;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  window.SLSpeakBrowser = browserSpeak; // exposed so callers/tests can spy or force it

  // key = plain term (used to find the pre-recorded MP3); spoken = optional vocalized/menukad
  // form used ONLY by the browser-voice fallback for more accurate pronunciation.
  window.SLSpeak = function (key, spoken) {
    key = (key == null ? '' : String(key)).trim();
    var say = (spoken == null || spoken === '') ? key : String(spoken);
    var map = window.AUDIO_MANIFEST;
    var file = (map && key) ? map[key] : null;
    if (!file) { window.SLSpeakBrowser(say); return; }
    try {
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      if (!audioEl) { audioEl = new Audio(); }
      audioEl.pause();
      audioEl.onerror = function () { window.SLSpeakBrowser(say); };
      audioEl.src = file;
      var p = audioEl.play();
      if (p && p.catch) p.catch(function () { window.SLSpeakBrowser(say); });
    } catch (e) { window.SLSpeakBrowser(say); }
  };

  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function () { window.speechSynthesis.getVoices(); };
    }
  } catch (e) {}
})();
