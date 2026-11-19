/* Decorative happy faces from https://facemood.grtimed.com/tag/高興?page=1 (2026-11-19). No runtime network calls. */
(function(){
  'use strict';
  var faces=["(*´Д`)つ))´∀`)", "(*‘ v`*)", "(^u^)", "(^y^)", "(ﾉ>ω<)ﾉ", "(｡A｡)", "(*’ｰ’*)", "d(d＇∀＇)", "d(`･∀･)b", "(,,・ω・,,)", "(*´ω`)人(´ω`*)", "(*´∀`)~♥", "(ゝ∀･)", "(ﾟ3ﾟ)～♪", "ξ( ✿＞◡❛)", "_(:3 」∠ )_", "(^_っ^)", "(｡◕∀◕｡)", "ヽ(́◕◞౪◟◕‵)ﾉ", "ヽ(✿ﾟ▽ﾟ)ノ", "ლ｜＾Д＾ლ｜", "ヾ(；ﾟ(OO)ﾟ)ﾉ", "థ౪థ", "ε٩(๑> ₃ <)۶з", "(」・ω・)」うー！(／・ω・)／にゃー！", "(σ′▽‵)′▽‵)σ", "｡:.ﾟヽ(*´∀`)ﾉﾟ.:｡", "(　ﾟ∀ﾟ)つ≡≡≡♡♡♡)`ν゜)ｸﾞｼｬ", "ლ(╹◡╹ლ)", "(✪ω✪)", "(◔⊖◔)つ", "(⁰▿⁰)", "(∂ω∂)", "(๑´ㅂ`๑)", "(´◓Д◔`)", "(๑´ڡ`๑)", "･*･:≡(　ε:)", "(´▽`ʃ♡ƪ)\"", "ｷﾀ━━━━(ﾟ∀ﾟ)━━━━!!", "ヽ(・×・´)ゞ", "(o´罒`o)", "_(:3 ⌒ﾞ)_"],bag=[],active=null,timer=null;
  function shuffled(items){var a=items.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),v=a[i];a[i]=a[j];a[j]=v;}return a;}
  function stop(){if(timer)clearTimeout(timer);timer=null;if(active)active.remove();active=null;}
  function show(overlay){
    stop();
    if(!overlay||!overlay.isConnected||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches))return;
    var compact=window.innerWidth<600,count=compact?12:18;
    var layer=document.createElement('div'),used=new Set(),lastEnd=0;
    var lanes=shuffled(Array.from({length:count},function(_,i){return 5+(i+.5)/count*90;}));
    layer.className='happy-rain';layer.setAttribute('aria-hidden','true');
    for(var i=0;i<count;i++){
      if(!bag.length)bag=shuffled(faces);
      var face=bag.shift();if(used.has(face)){i--;continue;}used.add(face);
      var span=document.createElement('span');
      var delay=i*175+Math.floor(Math.random()*100);
      var duration=6100+i*60+Math.floor(Math.random()*50);
      lastEnd=Math.max(lastEnd,delay+duration);
      span.textContent=face;
      span.style.setProperty('--x',lanes[i].toFixed(2)+'%');
      span.style.setProperty('--start',(-2-Math.random()*20).toFixed(2)+'vh');
      span.style.setProperty('--delay',delay+'ms');
      span.style.setProperty('--duration',duration+'ms');
      span.style.setProperty('--size',(compact?10+Math.random()*3:12+Math.random()*4).toFixed(1)+'px');
      layer.appendChild(span);
    }
    overlay.prepend(layer);active=layer;
    timer=setTimeout(stop,lastEnd+100);
  }
  window.LunchHappyRain={show:show,stop:stop};
})();
