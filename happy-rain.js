/* Decorative happy faces from https://facemood.grtimed.com/tag/高興?page=1 (2026-11-19). No runtime network calls. */
(function(){
  'use strict';
  var faces=["(*´Д`)つ))´∀`)", "(*‘ v`*)", "(^u^)", "(^y^)", "(ﾉ>ω<)ﾉ", "(｡A｡)", "(*’ｰ’*)", "d(d＇∀＇)", "d(`･∀･)b", "(,,・ω・,,)", "(*´ω`)人(´ω`*)", "(*´∀`)~♥", "(ゝ∀･)", "(ﾟ3ﾟ)～♪", "ξ( ✿＞◡❛)", "_(:3 」∠ )_", "(^_っ^)", "(｡◕∀◕｡)", "ヽ(́◕◞౪◟◕‵)ﾉ", "ヽ(✿ﾟ▽ﾟ)ノ", "ლ｜＾Д＾ლ｜", "ヾ(；ﾟ(OO)ﾟ)ﾉ", "థ౪థ", "ε٩(๑> ₃ <)۶з", "(」・ω・)」うー！(／・ω・)／にゃー！", "(σ′▽‵)′▽‵)σ", "｡:.ﾟヽ(*´∀`)ﾉﾟ.:｡", "(　ﾟ∀ﾟ)つ≡≡≡♡♡♡)`ν゜)ｸﾞｼｬ", "ლ(╹◡╹ლ)", "(✪ω✪)", "(◔⊖◔)つ", "(⁰▿⁰)", "(∂ω∂)", "(๑´ㅂ`๑)", "(´◓Д◔`)", "(๑´ڡ`๑)", "･*･:≡(　ε:)", "(´▽`ʃ♡ƪ)\"", "ｷﾀ━━━━(ﾟ∀ﾟ)━━━━!!", "ヽ(・×・´)ゞ", "(o´罒`o)", "_(:3 ⌒ﾞ)_"],bag=[],active=null,timer=null;
  function shuffled(){var a=faces.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),v=a[i];a[i]=a[j];a[j]=v;}return a;}
  function stop(){if(timer)clearTimeout(timer);timer=null;if(active)active.remove();active=null;}
  function show(overlay){
    stop();
    if(!overlay||!overlay.isConnected||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches))return;
    var count=window.innerWidth<600?12:18,layer=document.createElement('div'),used=new Set();
    layer.className='happy-rain';layer.setAttribute('aria-hidden','true');
    for(var i=0;i<count;i++){
      if(!bag.length)bag=shuffled();
      var face=bag.shift();if(used.has(face)){i--;continue;}used.add(face);
      var span=document.createElement('span'),delay=Math.random()*220;
      span.textContent=face;
      span.style.setProperty('--x',((i+.5)/count*100).toFixed(2)+'%');
      span.style.setProperty('--start',(-Math.random()*38).toFixed(2)+'vh');
      span.style.setProperty('--delay',delay.toFixed(0)+'ms');
      span.style.setProperty('--duration',(2000-delay).toFixed(0)+'ms');
      span.style.setProperty('--size',(window.innerWidth<600?14+Math.random()*4:16+Math.random()*6).toFixed(1)+'px');
      layer.appendChild(span);
    }
    overlay.prepend(layer);active=layer;
    timer=setTimeout(stop,2000);
  }
  window.LunchHappyRain={show:show,stop:stop};
})();
