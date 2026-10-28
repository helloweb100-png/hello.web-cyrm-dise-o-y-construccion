/* ==========================================================================
   CYRM Diseño & Construcción · app.js
   --------------------------------------------------------------------------
   · Todo es mejora progresiva: si GSAP / Lenis no cargan, la página sigue
     siendo 100% usable (solo se pierden los efectos avanzados).
   · Respeta prefers-reduced-motion en cada efecto.
   · Para cambiar el número de WhatsApp edita CONFIG (primeras líneas).
   ========================================================================== */
(() => {
    'use strict';

    /* ─────────────── CONFIGURACIÓN (EDITAR AQUÍ) ─────────────── */
    const CONFIG = {
        phone: '526141862623',              // código de país + número, sin "+" ni espacios
        phoneDisplay: '+52 614 186 2623',   // cómo se muestra en pantalla
        defaultMessage: 'Hola CYRM, quiero platicar sobre mi proyecto.'
    };

    /* ─────────────── UTILIDADES ─────────────── */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const root = document.documentElement;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeInOut = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    const animate = hasGsap && !reduceMotion;   // ¿activamos efectos avanzados?

    let lenis = null;

    /* ─────────────── WHATSAPP ─────────────── */
    const waUrl = (text) =>
        `https://wa.me/${CONFIG.phone}?text=${encodeURIComponent(text || CONFIG.defaultMessage)}`;

    function bindWhatsApp() {
        $$('[data-wa]').forEach((a) => {
            a.href = waUrl(a.dataset.waText);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        });
        $$('[data-phone-text]').forEach((el) => { el.textContent = CONFIG.phoneDisplay; });
    }

    /* ─────────────── BLOQUEO DE SCROLL (menú, visor) ─────────────── */
    function lockScroll(lock) {
        root.classList.toggle('is-locked', lock);
        if (lenis) { lock ? lenis.stop() : lenis.start(); }
    }

    /* ─────────────── SMOOTH SCROLL (Lenis) ─────────────── */
    function initLenis() {
        if (reduceMotion || typeof window.Lenis === 'undefined') return;
        lenis = new window.Lenis({
            duration: 1.25,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            wheelMultiplier: .9
        });
        if (hasGsap) {
            lenis.on('scroll', window.ScrollTrigger.update);
            window.gsap.ticker.add((t) => lenis.raf(t * 1000));
            window.gsap.ticker.lagSmoothing(0);
        } else {
            const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
            requestAnimationFrame(raf);
        }
        lenis.stop();   // se activa cuando termina el loader
    }

    function initAnchors() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            closeMenu();
            const offset = -(parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 70) + 1;
            if (lenis) lenis.scrollTo(target, { offset, duration: 1.7 });
            else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
            history.replaceState(null, '', id);
        });
    }

    /* ─────────────── TEXTO POR PALABRAS ─────────────── */
    function splitWords(el) {
        let i = 0;
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        const wi = document.createElement('span');
                        w.className = 'w';
                        wi.className = 'wi';
                        wi.style.setProperty('--i', i++);
                        wi.textContent = part;
                        w.appendChild(wi);
                        frag.appendChild(w);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    walk(child);
                }
            });
        };
        walk(el);
        return $$('.wi', el);
    }

    function wrapWords(el, className) {
        const out = [];
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const s = document.createElement('span');
                        s.className = className;
                        s.textContent = part;
                        out.push(s);
                        frag.appendChild(s);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    walk(child);
                }
            });
        };
        walk(el);
        return out;
    }

    /* ─────────────── REVEALS (IntersectionObserver) ─────────────── */
    function initReveals() {
        if (!reduceMotion) $$('[data-split]').forEach(splitWords);
        const els = $$('[data-reveal], [data-split]');
        if (reduceMotion || !('IntersectionObserver' in window)) {
            els.forEach((el) => el.classList.add('is-in'));
            return;
        }
        // Los elementos con máscara (clip-path total) no disparan el observador:
        // se observa a su padre y la clase se aplica al elemento enmascarado.
        const targets = new Map();
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                targets.get(en.target).classList.add('is-in');
                io.unobserve(en.target);
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: .1 });
        els.forEach((el) => {
            const watch = el.dataset.reveal === 'mask' ? el.parentElement : el;
            targets.set(watch, el);
            io.observe(watch);
        });
    }

    /* ─────────────── HEADER + MENÚ MÓVIL ─────────────── */
    let closeMenu = () => {};

    function initMenu() {
        const burger = $('#burger');
        const menu = $('#menu');
        if (!burger || !menu) return;

        const setOpen = (open) => {
            menu.classList.toggle('is-open', open);
            menu.setAttribute('aria-hidden', String(!open));
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            root.classList.toggle('is-menu-open', open);
            lockScroll(open);
            if (open) $('a', menu)?.focus({ preventScroll: true });
            else burger.focus({ preventScroll: true });
        };
        closeMenu = () => { if (menu.classList.contains('is-open')) setOpen(false); };

        burger.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
        window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });
    }

    function initHeader() {
        const header = $('#header');
        const progress = $('[data-progress]');
        if (!header) return;

        if (animate) {
            const { gsap, ScrollTrigger } = window;
            ScrollTrigger.create({
                start: 0, end: 'max',
                onUpdate: (self) => {
                    const y = self.scroll();
                    header.classList.toggle('is-stuck', y > 24);
                    const menuOpen = root.classList.contains('is-menu-open');
                    header.classList.toggle('is-hidden', !menuOpen && self.direction === 1 && y > 520);
                    if (self.direction === -1) header.classList.remove('is-hidden');
                }
            });
            if (progress) {
                gsap.to(progress, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });
            }
        } else if (progress) {
            // Respaldo sin GSAP: barra de progreso con un listener pasivo
            let ticking = false;
            window.addEventListener('scroll', () => {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(() => {
                    header.classList.toggle('is-stuck', window.scrollY > 24);
                    const max = root.scrollHeight - window.innerHeight;
                    progress.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1) : 0})`;
                    ticking = false;
                });
            }, { passive: true });
        }
    }

    function initNavSpy() {
        if (!('IntersectionObserver' in window)) return;
        const links = $$('.nav a');
        const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                const link = map.get(en.target.id);
                if (!link) return;
                if (en.isIntersecting) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        map.forEach((_, id) => { const sec = document.getElementById(id); if (sec) io.observe(sec); });
    }

    /* ─────────────── PARTÍCULAS DEL HERO ─────────────── */
    function initParticles() {
        const canvas = $('[data-particles]');
        if (!canvas || reduceMotion) return;
        const hero = canvas.parentElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = 0, h = 0, pts = [], raf = 0, running = false;
        const mouse = { x: -9999, y: -9999, active: false };

        function resize() {
            const r = hero.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, r.width < 768 ? 1 : 1.5);   // canvas decorativo: no necesita resolución completa
            w = r.width; h = r.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.round(clamp((w * h) / 21000, 22, 72));
            pts = Array.from({ length: count }, () => ({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
                r: Math.random() * 1.5 + .7
            }));
        }

        function step() {
            ctx.clearRect(0, 0, w, h);
            const link = Math.min(150, w * .17);
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                p.x += p.vx; p.y += p.vy;
                if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
                if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;

                if (mouse.active) {
                    const dx = p.x - mouse.x, dy = p.y - mouse.y;
                    const d = Math.hypot(dx, dy);
                    if (d < 120 && d > 0) { const f = (1 - d / 120) * .8; p.x += (dx / d) * f; p.y += (dy / d) * f; }
                    if (d < 170) {
                        ctx.strokeStyle = `rgba(18,153,208,${((1 - d / 170) * .38).toFixed(3)})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
                    }
                }
                for (let j = i + 1; j < pts.length; j++) {
                    const q = pts[j];
                    const d = Math.hypot(p.x - q.x, p.y - q.y);
                    if (d < link) {
                        ctx.strokeStyle = `rgba(12,116,172,${((1 - d / link) * .2).toFixed(3)})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
                    }
                }
                ctx.fillStyle = 'rgba(18,153,208,.55)';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            }
            raf = requestAnimationFrame(step);
        }

        const start = () => { if (!running) { running = true; raf = requestAnimationFrame(step); } };
        const stop = () => { running = false; cancelAnimationFrame(raf); };

        resize();
        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 200); });
        if (finePointer) {
            hero.addEventListener('pointermove', (e) => {
                const r = hero.getBoundingClientRect();
                mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
            }, { passive: true });
            hero.addEventListener('pointerleave', () => { mouse.active = false; });
        }
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(([en]) => { en.isIntersecting ? start() : stop(); }).observe(hero);
        } else start();
        document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    }

    /* ─────────────── HERO ─────────────── */
    function initHero() {
        const hero = $('.hero');
        const noop = { loadSlides() {}, intro() { if (hero) { hero.classList.remove('is-waiting'); hero.classList.add('is-lit'); this.loadSlides(); } } };
        if (!hero) return noop;

        /* Slideshow (CSS + JS, no depende de GSAP) */
        const slides = $$('.slide', hero);
        const bars = $$('.bar', hero);
        const cap = $('[data-caption]', hero);
        const captions = [
            'Fachada residencial con recubrimiento de piedra',
            'Barra y asador en porcelanato tipo mármol',
            'Escalera interior con herrería a la medida',
            'Frente de casa con andadores y áreas verdes'
        ];
        let idx = 0;

        function go(n) {
            if (n === idx || !slides[n]) return;
            const prev = slides[idx], next = slides[n];
            slides.forEach((s) => { if (s !== prev && s !== next) s.classList.remove('is-prev', 'is-active'); });
            prev.classList.remove('is-active');
            prev.classList.add('is-prev');
            next.classList.remove('is-prev');
            next.classList.add('is-active');
            bars.forEach((b, i) => {
                b.classList.toggle('is-active', i === n);
                b.classList.toggle('is-done', i < n);
                b.setAttribute('aria-current', String(i === n));
            });
            if (cap) cap.textContent = captions[n];
            idx = n;
        }

        if (reduceMotion) {
            hero.classList.add('is-static');
            bars.forEach((b, i) => b.addEventListener('click', () => go(i)));
        } else {
            hero.classList.add('is-waiting');   // el slideshow arranca cuando abre el loader
            hero.addEventListener('animationend', (e) => {
                if (e.animationName === 'barfill') go((idx + 1) % slides.length);
            });
            bars.forEach((b, i) => b.addEventListener('click', () => go(i)));
            if ('IntersectionObserver' in window) {
                new IntersectionObserver(([en]) => hero.classList.toggle('is-paused', !en.isIntersecting)).observe(hero);
            }
        }

        /* Las fotos 2-4 del slideshow se piden después de abrir el loader, para no competir con la primera */
        const loadSlides = () => slides.forEach((s) => {
            const img = $('img', s);
            if (!img || !img.dataset.src) return;
            if (img.dataset.srcset) img.srcset = img.dataset.srcset;
            img.src = img.dataset.src;
            delete img.dataset.src;
        });
        noop.loadSlides = loadSlides;

        if (!animate) return noop;

        /* Entrada y parallax con GSAP */
        const { gsap } = window;
        const title = $('[data-split-hero]', hero);
        const words = title ? splitWords(title) : [];
        root.classList.add('hero-anim');

        const tl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } });
        tl.to('.hero__curtain', { xPercent: 101, duration: 1.5, ease: 'expo.inOut' }, 0)
          .from('.slides', { scale: 1.22, duration: 2.4, ease: 'power3.out' }, 0)
          .from(words, { yPercent: 118, duration: 1.15, stagger: .07 }, .35)
          .from('[data-hero-in]', { y: 28, opacity: 0, duration: 1, stagger: .12 }, .55)
          .from('.hero__caption', { yPercent: 101, duration: 1.1, ease: 'expo.out' }, 1.05)
          .from('.edge--d', { scaleX: 0, duration: 1.4, ease: 'expo.inOut' }, .45)
          .from('.edge--v', { scaleY: 0, duration: 1.4, ease: 'expo.inOut' }, .45)
          .from('.hero__hex', { opacity: 0, scale: .82, duration: 2.2, ease: 'power3.out' }, .3)
          .add(() => hero.classList.add('is-lit'), 1);

        gsap.to('.slides', { yPercent: 9, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.hero__copy', { yPercent: -7, opacity: .1, ease: 'none', scrollTrigger: { trigger: hero, start: '25% top', end: 'bottom 15%', scrub: true } });
        gsap.to('.hero__hex', { rotation: 70, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

        return { loadSlides, intro() { hero.classList.remove('is-waiting'); tl.play(); loadSlides(); } };
    }

    /* ─────────────── MARQUEE (reacciona a la velocidad de scroll) ─────────────── */
    function initMarquee() {
        const track = $('[data-marquee]');
        if (!track || reduceMotion || !lenis || !track.getAnimations) return;
        const anim = track.getAnimations()[0];
        if (!anim) return;
        let rate = 1, target = 1, visible = false, raf = 0;
        lenis.on('scroll', ({ velocity }) => { target = 1 + Math.min(Math.abs(velocity) * .5, 7); });
        const tick = () => {
            target += (1 - target) * .06;
            rate += (target - rate) * .1;
            anim.playbackRate = rate;
            if (visible) raf = requestAnimationFrame(tick);
        };
        new IntersectionObserver(([en]) => {
            visible = en.isIntersecting;
            cancelAnimationFrame(raf);
            if (visible) raf = requestAnimationFrame(tick);
        }).observe(track);
    }

    /* ─────────────── MANIFIESTO (texto que se ilumina con el scroll) ─────────────── */
    function initManifesto() {
        const el = $('[data-manifesto]');
        if (!el || !animate) return;
        const { gsap } = window;
        const words = wrapWords(el, 'mw');
        gsap.set(words, { opacity: .46 });
        gsap.to(words, {
            opacity: 1, ease: 'none', duration: .3, stagger: .1,
            scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 55%', scrub: true }
        });
    }

    /* ─────────────── ZOOM: el hexágono del logo se abre y revela el render ─────────────── */
    function initZoom() {
        const scene = $('[data-zoom]');
        if (!scene || !animate) return;
        const { ScrollTrigger } = window;
        const media = $('[data-zoom-media]', scene);
        const img = $('img', media);
        const title = $('[data-zoom-title]', scene);
        const copy = $('[data-zoom-copy]', scene);
        const outline = $('[data-zoom-outline]', scene);
        root.classList.add('zoom-pin');

        let hex = [], rect = [];
        const compute = () => {
            const W = scene.clientWidth, H = scene.clientHeight;
            const cx = W / 2, cy = H * .6;
            const R = Math.min(W * .4, H * .28);           // radio del hexágono (punta arriba)
            const k = Math.sqrt(3) / 2 * R;
            hex = [[cx, cy - R], [cx + k, cy - R / 2], [cx + k, cy + R / 2], [cx, cy + R], [cx - k, cy + R / 2], [cx - k, cy - R / 2]];
            rect = [[W / 2, 0], [W, 0], [W, H], [W / 2, H], [0, H], [0, 0]];
        };

        const render = (p) => {
            const e = easeInOut(clamp(p / .72, 0, 1));
            const pts = hex.map((h, i) => [lerp(h[0], rect[i][0], e), lerp(h[1], rect[i][1], e)]);
            media.style.clipPath = 'polygon(' + pts.map((q) => `${q[0].toFixed(1)}px ${q[1].toFixed(1)}px`).join(',') + ')';
            outline.setAttribute('points', pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' '));
            outline.style.opacity = String(1 - clamp(e * 1.7, 0, 1));
            img.style.transform = `scale(${lerp(1.3, 1, e).toFixed(4)})`;
            title.style.opacity = String(1 - clamp(e * 2.4, 0, 1));
            title.style.transform = `translateY(${(-e * 46).toFixed(1)}px)`;
            scene.style.setProperty('--scrim', clamp((e - .5) / .5, 0, 1).toFixed(3));
            const c = clamp((p - .74) / .26, 0, 1);
            copy.style.opacity = String(c);
            copy.style.transform = `translateY(${((1 - c) * 36).toFixed(1)}px)`;
            copy.style.pointerEvents = c > .6 ? 'auto' : 'none';
        };

        compute();
        render(0);
        ScrollTrigger.create({
            trigger: scene, start: 'top top', end: '+=170%',
            pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
            onRefresh: (self) => { compute(); render(self.progress); },
            onUpdate: (self) => render(self.progress)
        });
    }

    /* ─────────────── SERVICIOS: pila que se comprime al llegar la siguiente ─────────────── */
    function initStack() {
        const cards = $$('.svc');
        if (cards.length < 2 || !animate) return;
        const { gsap } = window;
        cards.forEach((card, i) => {
            if (i === cards.length - 1) return;
            gsap.to($('.svc__inner', card), {
                scale: .94, ease: 'none',
                scrollTrigger: { trigger: cards[i + 1], start: 'top 92%', end: 'top 18%', scrub: true }
            });
        });
    }

    /* ─────────────── GALERÍA: filtros ─────────────── */
    function initGallery() {
        const list = $('[data-gallery]');
        if (!list) return;
        const items = $$('.g-item', list);
        const chips = $$('[data-filter]');
        // Revelación escalonada por máscara (se lee de izquierda a derecha en cada fila de 3)
        items.forEach((it, i) => {
            const fig = $('figure', it);
            fig.setAttribute('data-reveal', 'mask');
            fig.style.setProperty('--d', `${(i % 3) * .09}s`);
        });

        chips.forEach((chip) => chip.addEventListener('click', () => {
            if (chip.classList.contains('is-active')) return;
            chips.forEach((c) => {
                c.classList.toggle('is-active', c === chip);
                c.setAttribute('aria-pressed', String(c === chip));
            });
            const f = chip.dataset.filter;
            items.forEach((it) => it.classList.add('is-hiding'));
            setTimeout(() => {
                items.forEach((it) => { it.hidden = !(f === 'todos' || it.dataset.cat === f); });
                items.filter((it) => !it.hidden).forEach((it, i) => {
                    it.style.transitionDelay = `${i * 45}ms`;
                    requestAnimationFrame(() => requestAnimationFrame(() => it.classList.remove('is-hiding')));
                });
                setTimeout(() => {
                    items.forEach((it) => { it.style.transitionDelay = ''; });
                    if (hasGsap) window.ScrollTrigger.refresh();
                }, 900);
            }, 280);
        }));
    }

    /* ─────────────── VISOR DE IMÁGENES (la foto se abre desde su miniatura) ─────────────── */
    function initLightbox() {
        const dlg = $('#lightbox');
        if (!dlg || typeof dlg.showModal !== 'function') return;
        const img = $('.lightbox__img', dlg);
        const cap = $('.lightbox__cap', dlg);
        let btns = [], cur = 0, opener = null;

        const visible = () => $$('[data-lb]').filter((b) => !b.closest('.g-item').hidden);

        function load(i, dir = 0, thumb = null) {
            cur = (i + btns.length) % btns.length;
            const b = btns[cur];
            const src = $('img', b);
            img.src = src.currentSrc || src.src;
            img.alt = src.alt;
            cap.textContent = $('figcaption', b.closest('figure'))?.textContent || '';
            if (!animate) return;
            const { gsap } = window;
            const play = () => {
                if (thumb) {
                    const first = thumb.getBoundingClientRect();
                    const last = img.getBoundingClientRect();
                    gsap.fromTo(img,
                        { x: first.left + first.width / 2 - (last.left + last.width / 2), y: first.top + first.height / 2 - (last.top + last.height / 2), scale: first.width / last.width },
                        { x: 0, y: 0, scale: 1, duration: .95, ease: 'expo.out', clearProps: 'transform' });
                } else {
                    gsap.fromTo(img, { opacity: 0, x: dir * 50 }, { opacity: 1, x: 0, duration: .55, ease: 'power3.out', clearProps: 'transform,opacity' });
                }
                gsap.fromTo(cap, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .6, delay: .25, ease: 'power3.out', clearProps: 'transform,opacity' });
            };
            (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => requestAnimationFrame(play));
        }

        $$('[data-lb]').forEach((b) => b.addEventListener('click', () => {
            btns = visible();
            opener = b;
            lockScroll(true);
            dlg.showModal();
            load(btns.indexOf(b), 0, $('img', b));
        }));

        const step = (d) => load(cur + d, d);
        $('[data-lb-prev]', dlg).addEventListener('click', () => step(-1));
        $('[data-lb-next]', dlg).addEventListener('click', () => step(1));
        $('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
        dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') step(1);
            if (e.key === 'ArrowLeft') step(-1);
        });
        dlg.addEventListener('close', () => { lockScroll(false); opener && opener.focus({ preventScroll: true }); });

        let sx = 0;
        dlg.addEventListener('pointerdown', (e) => { sx = e.clientX; });
        dlg.addEventListener('pointerup', (e) => {
            const dx = e.clientX - sx;
            if (Math.abs(dx) > 60 && e.pointerType === 'touch') step(dx < 0 ? 1 : -1);
        });
    }

    /* ─────────────── BENTO: spotlight + parallax interno ─────────────── */
    function initBento() {
        if (finePointer) {
            $$('.cell').forEach((cell) => cell.addEventListener('pointermove', (e) => {
                const r = cell.getBoundingClientRect();
                cell.style.setProperty('--mx', `${e.clientX - r.left}px`);
                cell.style.setProperty('--my', `${e.clientY - r.top}px`);
            }, { passive: true }));
        }
        if (!animate) return;
        $$('[data-parallax]').forEach((el) => {
            window.gsap.fromTo(el, { yPercent: -5 }, {
                yPercent: 5, ease: 'none',
                scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
            });
        });
    }

    /* ─────────────── NÚMEROS ─────────────── */
    function initCounters() {
        const els = $$('[data-count]');
        const zone = $('[data-stats]');
        if (!els.length || !zone) return;
        if (!animate || !('IntersectionObserver' in window)) return;
        els.forEach((el) => { el.textContent = '0'; });
        const io = new IntersectionObserver(([en]) => {
            if (!en.isIntersecting) return;
            io.disconnect();
            els.forEach((el) => {
                const o = { v: 0 };
                window.gsap.to(o, {
                    v: Number(el.dataset.count), duration: 1.9, ease: 'power3.out',
                    onUpdate: () => { el.textContent = String(Math.round(o.v)); }
                });
            });
        }, { threshold: .35 });
        io.observe(zone);
    }

    /* ─────────────── PROCESO: scroll horizontal (escritorio) ─────────────── */
    function initProcess() {
        const pin = $('[data-proc]');
        const track = $('[data-proc-track]');
        const bar = $('[data-proc-bar]');
        if (!pin || !track || !animate) return;
        const { gsap } = window;

        gsap.matchMedia().add('(min-width: 1024px) and (min-height: 560px)', () => {
            root.classList.add('proc-h');
            const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
            gsap.to(track, {
                x: () => -dist(), ease: 'none',
                scrollTrigger: {
                    trigger: pin, start: 'top top', end: () => '+=' + dist(),
                    pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
                    onUpdate: (self) => { if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`; }
                }
            });
            return () => {
                root.classList.remove('proc-h');
                gsap.set(track, { clearProps: 'transform' });
                if (bar) bar.style.transform = '';
            };
        });
    }

    /* ─────────────── FAQ ─────────────── */
    function initFaq() {
        const items = $$('.qa');
        items.forEach((qa) => {
            const btn = $('.qa__q', qa);
            btn.addEventListener('click', () => {
                const willOpen = btn.getAttribute('aria-expanded') !== 'true';
                items.forEach((o) => {
                    const open = o === qa && willOpen;
                    o.classList.toggle('is-open', open);
                    $('.qa__q', o).setAttribute('aria-expanded', String(open));
                });
            });
        });
    }

    /* ─────────────── FORMULARIO → WHATSAPP ─────────────── */
    function initForm() {
        const form = $('#wa-form');
        if (!form) return;
        const status = $('#form-status');
        const f = {
            name: $('#f-name'), type: $('#f-type'), place: $('#f-place'),
            phone: $('#f-phone'), msg: $('#f-msg')
        };

        const setError = (input, message) => {
            const out = input.closest('.field').querySelector('.field__error');
            if (out) out.textContent = message || '';
            if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
        };
        Object.values(f).forEach((el) => el && el.addEventListener('input', () => setError(el, '')));

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            status.textContent = '';
            const name = f.name.value.trim();
            const type = f.type.value;
            const phone = f.phone.value.trim();
            const digits = phone.replace(/\D/g, '');

            let firstBad = null;
            const check = (cond, input, msg) => { if (!cond) { setError(input, msg); firstBad = firstBad || input; } else setError(input, ''); };
            check(name.length >= 2, f.name, 'Escribe tu nombre para saber cómo dirigirnos a ti.');
            check(!!type, f.type, 'Elige qué quieres hacer.');
            check(!phone || (digits.length >= 8 && digits.length <= 15), f.phone, 'Revisa tu teléfono: usa solo números y lada.');
            if (firstBad) { firstBad.focus(); return; }

            const lines = [`Hola CYRM, soy ${name}.`, `Quiero información sobre: ${type}.`];
            if (f.place.value.trim()) lines.push(`Ubicación del proyecto: ${f.place.value.trim()}.`);
            if (f.msg.value.trim()) lines.push(`Mi idea: ${f.msg.value.trim()}`);
            if (phone) lines.push(`Mi teléfono: ${phone}`);
            const url = waUrl(lines.join('\n'));

            window.open(url, '_blank', 'noopener');

            status.textContent = `¡Listo, ${name.split(' ')[0]}! Abrimos WhatsApp con tu solicitud. Si no se abrió, `;
            const a = document.createElement('a');
            a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'haz clic aquí';
            status.append(a, '.');
        });
    }

    /* ─────────────── BOTONES MAGNÉTICOS ─────────────── */
    function initMagnetic() {
        if (!animate || !finePointer) return;
        const { gsap } = window;
        $$('.btn:not(.btn--block)').forEach((btn) => {
            btn.classList.add('is-magnetic');
            const xTo = gsap.quickTo(btn, 'x', { duration: .6, ease: 'power3' });
            const yTo = gsap.quickTo(btn, 'y', { duration: .6, ease: 'power3' });
            btn.addEventListener('pointermove', (e) => {
                const r = btn.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * .2);
                yTo((e.clientY - (r.top + r.height / 2)) * .3);
            });
            btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
        });
    }

    /* ─────────────── WHATSAPP FLOTANTE ─────────────── */
    function initWaFloat() {
        const wa = $('.wa-float');
        if (!wa) return;
        const tip = $('[data-wa-tip]', wa);
        setTimeout(() => {
            wa.classList.add('is-visible');
            if (!tip) return;
            setTimeout(() => tip.classList.add('is-on'), 1800);
            setTimeout(() => tip.classList.remove('is-on'), 7500);
        }, 3200);
    }

    /* ─────────────── ARRANQUE ─────────────── */
    const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
    let refreshTimer = 0;
    const scheduleRefresh = () => {
        if (!hasGsap) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => window.ScrollTrigger.refresh(), 250);
    };

    async function boot() {
        if ('scrollRestoration' in history && !location.hash) history.scrollRestoration = 'manual';
        if (!location.hash) window.scrollTo(0, 0);

        bindWhatsApp();
        $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

        if (hasGsap) {
            window.gsap.registerPlugin(window.ScrollTrigger);
            // Un solo refresh coordinado (load + fuentes + apertura del loader) en vez de varios automáticos
            window.ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,resize' });
            if (animate) root.classList.add('gsap-on');
        }

        /* El trabajo se reparte en tareas cortas mientras el loader está en pantalla,
           así el hilo principal nunca se bloquea y el spinner se mantiene fluido. */
        initLenis();
        initAnchors();
        initGallery();      // marca las figuras con data-reveal antes de que el observador las recolecte
        initReveals();
        initMenu();
        await nextTask();

        initHeader();
        initNavSpy();
        const hero = initHero();
        await nextTask();

        initMarquee();
        initManifesto();
        await nextTask();

        initZoom();
        await nextTask();

        initStack();
        initLightbox();
        initBento();
        await nextTask();

        initCounters();
        initProcess();
        await nextTask();

        initFaq();
        initForm();
        initMagnetic();

        window.addEventListener('load', scheduleRefresh, { once: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRefresh);

        const onReveal = () => {
            hero.intro();
            initParticles();
            if (lenis) lenis.start();
            initWaFloat();
            scheduleRefresh();
        };
        if (window.cyrmLoader) window.cyrmLoader.whenReady(onReveal);
        else onReveal();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
