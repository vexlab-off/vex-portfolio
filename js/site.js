// Vex Labs : le comportement de la page d'accueil, en un fichier.
// Menu du téléphone, horloge Meridian du hero et sa construction, traits des sections, projets, duo vex / Claude, copie de l'adresse.
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

/* ---------- menu du téléphone ---------- */
{
  const nav = document.querySelector('.nav'), toggle = nav.querySelector('.nav__toggle');
  const setOpen = open => {
    nav.classList.toggle('nav--open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('nav--open')));
  nav.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('nav--open')) { setOpen(false); toggle.focus(); }
  });
}

/* ---------- hero : l'horloge Meridian et la construction du dessin ----------
   L'horloge lit toujours l'heure réelle : l'arc des 24 h, les graduations des minutes, le point des minutes,
   le point des secondes et sa traînée, l'heure en clair. Avec les animations, html.vx-build (posé dans le <head>,
   avant le premier rendu) cache tout ; une seule timeline le trace ensuite : guides, anneaux, graduations, dessin,
   l'horloge qui se remplit jusqu'à l'heure, puis les aiguilles qui apparaissent. finish() pose toujours l'état
   final exact, même si aucune image n'a été rendue (onglet en arrière-plan). */
{
  window.vxStarted = true;
  const svg = document.querySelector('.orbit'), stage = document.querySelector('.hero__stage'), img = stage.querySelector('img');
  const day = $('clock-day'), min = $('clock-min'), sec = $('clock-sec'), mdot = $('clock-mdot'), clock = document.querySelector('.clock');
  const still = !root.classList.contains('vx-build');
  const pad = n => String(n).padStart(2, '0');
  const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // n graduations allumées depuis midi
  const ticksDash = n => (n ? Array(n).fill('0.04 0.96').join(' ') + ' ' : '') + `0 ${60 - n}`;
  // t < 1 seulement pendant la construction, qui remplit l'horloge jusqu'à l'heure
  const setClock = t => {
    const d = new Date(), m = d.getMinutes(), v = (d.getHours() * 60 + m + d.getSeconds() / 60) * t;
    day.setAttribute('stroke-dasharray', `${v.toFixed(2)} ${(1440 - v).toFixed(2)}`);
    min.setAttribute('stroke-dasharray', ticksDash(Math.round((m + 1) * t)));
  };

  // la traînée des secondes : un seul arc qui finit dans le point ; son dégradé suit le groupe qui tourne
  const R = 262, TAIL = 48, tail = sec.querySelector('.tail'), grad = $('tail');
  const at = deg => { const r = deg * Math.PI / 180; return [(R * Math.sin(r)).toFixed(2), (-R * Math.cos(r)).toFixed(2)]; };
  const setTail = len => {
    const [x1, y1] = at(-Math.max(len, .5)), [x2, y2] = at(0);
    tail.setAttribute('d', `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`);
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => grad.setAttribute(k, v));
  };

  // secondes : fluides avec les animations (lues sur l'horloge à chaque image), un cran par seconde sinon ;
  // la boucle d'images ne tourne que quand l'horloge est à l'écran
  const syncSec = () => {
    const d = new Date(), s = d.getSeconds() + (still ? 0 : d.getMilliseconds() / 1000);
    sec.setAttribute('transform', `rotate(${(s * 6).toFixed(2)})`);
  };
  let onScreen = true, spinning = false;
  const spin = () => { if (!onScreen) { spinning = false; return; } syncSec(); requestAnimationFrame(spin); };
  const startSpin = () => { if (!still && !spinning) { spinning = true; requestAnimationFrame(spin); } };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) startSpin(); }).observe(stage);

  let built = still;
  const tick = () => {
    const d = new Date();
    if (built) setClock(1);
    mdot.setAttribute('transform', `rotate(${((d.getMinutes() + d.getSeconds() / 60) * 6).toFixed(2)})`);
    $('clock-h').textContent = pad(d.getHours());
    $('clock-m').textContent = pad(d.getMinutes());
    $('clock-s').textContent = pad(d.getSeconds());
    $('clock-date').textContent = fmtDate.format(d);
    if (still) syncSec();
  };
  // une fois par seconde, recalé à chaque fois sur la seconde de l'horloge (pas de dérive)
  const loop = () => { tick(); setTimeout(loop, 1005 - new Date().getMilliseconds()); };
  setTail(TAIL); syncSec(); loop(); startSpin();
  addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  if (still) setClock(1);
  else {
    const io = t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2, out = t => 1 - (1 - t) ** 3;
    const seg = (e, a, b) => Math.min(1, Math.max(0, (e - a) / (b - a)));
    const f = n => Math.max(0, n).toFixed(4);
    const guides = [...svg.querySelectorAll('.guide')], rings = [...svg.querySelectorAll('.ring')], ticks = svg.querySelector('.ticks');
    // un anneau pousse dans les deux sens depuis 3 h et 9 h, là où les guides le touchent
    const ringDash = p => { const q = p / 4; return `${f(q)} ${f(.5 - 2 * q)} ${f(2 * q)} ${f(.5 - 2 * q)} ${f(q)}`; };
    // chaque trait se dessine en terre cuite, comme une pointe de stylo, puis prend la couleur des lignes
    const pen = (el, e, end) => {
      const k = seg(e, end, end + 700);
      el.style.stroke = k < 1 ? `color-mix(in oklab, var(--accent) ${(70 * (1 - k)).toFixed(1)}%, var(--line))` : '';
    };
    const END = 3500;
    const render = e => {
      guides.forEach(l => { l.style.strokeDasharray = `${f(io(seg(e, 0, 600)))} 1`; pen(l, e, 600); });
      rings.forEach((c, i) => { const b = 1450 + i * 150; c.style.strokeDasharray = ringDash(io(seg(e, 550 + i * 200, b))); pen(c, e, b); });
      ticks.style.strokeDasharray = ticksDash(Math.round(60 * out(seg(e, 900, 1750)))); pen(ticks, e, 1750);
      img.style.clipPath = `circle(${(75 * io(seg(e, 1150, 2150))).toFixed(2)}% at 50% 58%)`;
      setClock(out(seg(e, 1750, 2950)));
      const s = out(seg(e, 2800, END));
      sec.style.opacity = mdot.style.opacity = clock.style.opacity = s.toFixed(3);
      clock.style.translate = `0 ${((1 - s) * 10).toFixed(2)}px`;
      setTail(TAIL * s);
    };
    let done = false, t0 = 0, fallback = 0;
    const finish = () => {
      if (done) return;
      done = true; clearTimeout(fallback);
      for (const el of [...guides, ...rings, ticks, img, sec, mdot, clock]) el.removeAttribute('style');
      setTail(TAIL); built = true; setClock(1);
    };
    const frame = now => {
      if (done) return;
      if (now - t0 >= END) { finish(); return; }
      render(now - t0); requestAnimationFrame(frame);
    };
    const go = () => {
      render(0); root.classList.remove('vx-build');   // l'état de départ prend le relais dans la même tâche : rien ne clignote
      t0 = performance.now(); requestAnimationFrame(frame);
      fallback = setTimeout(finish, END + 800);
    };
    // une page ouverte dans un onglet en arrière-plan attend d'être vue pour se construire
    if (document.hidden) addEventListener('visibilitychange', go, { once: true }); else go();
  }
}

/* ---------- chaque section tire son trait du haut une fois, à son arrivée à l'écran (rien n'est caché) ---------- */
if (root.classList.contains('vx-rules')) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-drawn'); io.unobserve(e.target); }
  }), { threshold: .15 });
  document.querySelectorAll('.rule').forEach(el => io.observe(el));
}

/* ---------- projets : une barre discrète, un projet à la fois ----------
   Le trait orange glisse vers l'onglet choisi et le projet arrive du côté d'où l'on vient.
   Un lien vers #vex-os, #meridian… (pied de page) ouvre le bon onglet. */
{
  const bar = document.querySelector('.proj__bar'), ink = bar.querySelector('.proj__ink');
  const tabs = [...bar.querySelectorAll('[role="tab"]')];
  const panel = t => $(t.getAttribute('aria-controls'));
  let cur = 0;
  const place = slide => {
    const t = tabs[cur];
    if (!slide) ink.style.transition = 'none';
    ink.style.width = `${t.offsetWidth}px`;
    ink.style.transform = `translate(${t.offsetLeft}px, ${t.offsetTop + t.offsetHeight - 1}px)`;
    if (!slide) { ink.offsetWidth; ink.style.transition = ''; }   // lire offsetWidth applique la position sans animation
  };
  const select = (i, focus) => {
    if (i !== cur) {
      const dir = Math.sign(i - cur);
      tabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; panel(t).hidden = k !== i; });
      cur = i; place(true);
      if (!reduced) [...panel(tabs[i]).children].forEach((el, k) => el.animate(
        [{ opacity: 0, transform: `translateX(${dir * 36}px)` }, { opacity: 1, transform: 'none' }],
        { duration: 620, delay: k * 90, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' }));
    }
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', e => {
      const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      select((k + tabs.length) % tabs.length, true);
    });
  });
  const fromHash = () => { const i = tabs.findIndex(t => `#${t.id}` === location.hash); if (i >= 0) select(i); };
  addEventListener('hashchange', fromHash);
  fromHash(); place(false);
  addEventListener('resize', () => place(false));
  document.fonts.ready.then(() => place(false));
}

/* ---------- duo vex / Claude : le trait se tire et le point traverse une fois à l'arrivée,
   puis l'échange continue, en pause hors de l'écran ---------- */
if (!reduced) {
  const duo = document.querySelector('.duo'), dot = duo.querySelector('.duo__dot');
  duo.classList.add('is-armed');
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !duo.classList.contains('is-on')) {
      duo.classList.add('is-on');
      dot.addEventListener('animationend', () => duo.classList.replace('is-armed', 'is-loop'), { once: true });
    }
    duo.classList.toggle('is-paused', !e.isIntersecting);
  }, { threshold: .2 }).observe(duo);
}

/* ---------- copier l'adresse ---------- */
{
  const btn = document.querySelector('[data-copy]'), out = $('copied');
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(btn.dataset.copy); out.textContent = 'Adresse copiée'; }
    catch { out.textContent = 'Copie impossible : sélectionnez l’adresse'; }
  });
}
