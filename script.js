(() => {
  // IIFE - start a new scope and run immediately to avoid polluting global scope
  const $ = (q, el = document) => el.querySelector(q); // $: shorthand for querySelector on given element or document
  const $$ = (q, el = document) => Array.from(el.querySelectorAll(q)); // $$: shorthand for querySelectorAll -> Array

  // Year
  const y = $('#year'); // Find element with id 'year'
  if (y) y.textContent = new Date().getFullYear(); // If found, set its text to current year

  // Mobile nav
  const toggle = $('.nav__toggle'); // Find nav toggle button
  const menu = $('#navmenu'); // Find nav menu
  if (toggle && menu) { // Only wire up handlers if both exist
    const close = () => { // close(): removes open state from menu
      menu.classList.remove('is-open'); // remove CSS class that shows menu
      toggle.setAttribute('aria-expanded', 'false'); // update accessibility attribute
    };
    toggle.addEventListener('click', () => { // click handler to toggle menu
      const open = !menu.classList.contains('is-open'); // determine new open state
      menu.classList.toggle('is-open', open); // toggle class accordingly
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); // update aria-expanded
    });
    // Close on click
    $$('#navmenu a').forEach(a => a.addEventListener('click', close)); // close menu when any nav link is clicked
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }); // close on Escape key
  }

  // Count up animation
  const easeOut = (t) => 1 - Math.pow(1 - t, 3); // easing function for smooth animation
  const animateCount = (el) => { // animateCount(): animate numeric value in element
    const to = parseFloat(el.getAttribute('data-count') || '0'); // target value from data attribute
    const isInt = Number.isInteger(to); // determine whether to format as integer
    const dur = 900 + Math.random() * 600; // random duration between 900 and 1500ms
    const start = performance.now(); // start timestamp

    const step = (now) => { // step(): called on each animation frame
      const t = Math.min(1, (now - start) / dur); // normalized time 0..1
      const v = to * easeOut(t); // eased value
      el.textContent = isInt ? Math.round(v).toString() : v.toFixed(2); // update displayed text
      if (t < 1) requestAnimationFrame(step); // continue until t reaches 1
    };
    requestAnimationFrame(step); // start animation frames
  };

  const counters = $$('[data-count]'); // collect elements with data-count attribute
  if ('IntersectionObserver' in window && counters.length) { // if IntersectionObserver supported and we have counters
    const io = new IntersectionObserver((entries) => { // observe visibility
      entries.forEach(en => {
        if (en.isIntersecting) { // trigger when element becomes visible
          animateCount(en.target); // start count animation
          io.unobserve(en.target); // stop observing this element
        }
      });
    }, { threshold: 0.25 }); // trigger when 25% visible
    counters.forEach(c => io.observe(c)); // observe each counter
  } else {
    counters.forEach(animateCount); // fallback: animate immediately
  }

  // Modal
  const modal = $('#modal'); // find modal element
  const openBtn = $('[data-open="modal"]'); // find button that opens modal
  const openModal = () => { if (modal) { modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); } }; // open modal and update aria
  const closeModal = () => { if (modal) { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); } }; // close modal and update aria

  if (openBtn) openBtn.addEventListener('click', openModal); // wire open button
  $$('[data-close="modal"]').forEach(b => b.addEventListener('click', closeModal)); // wire close controls
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }); // close on Escape

  // Copy buttons
  $$('[data-copy]').forEach(btn => { // for each copy button
    btn.addEventListener('click', async () => { // click handler (async because clipboard API is async)
      const sel = btn.getAttribute('data-copy'); // selector for the element to copy
      const node = sel ? $(sel) : null; // find the node to copy from selector
      if (!node) return; // nothing to copy from
      const text = node.textContent || ''; // get text content
      try {
        await navigator.clipboard.writeText(text); // try modern clipboard API
        const prev = btn.textContent; // save previous button text
        btn.textContent = 'Copied'; // show feedback
        setTimeout(() => btn.textContent = prev, 900); // restore after short delay
      } catch {
        // fallback if clipboard API fails
        const ta = document.createElement('textarea'); // create textarea
        ta.value = text; // set value to copy
        document.body.appendChild(ta); // add to DOM
        ta.select(); // select content
        document.execCommand('copy'); // exec legacy copy command
        ta.remove(); // remove textarea
      }
    });
  });
})();


(() => {
  // Cursor glow and parallax interaction
  const glow = document.getElementById('cursorGlow'); // element used for cursor glow effect
  const parallaxEls = Array.from(document.querySelectorAll('.parallax')); // elements that respond to cursor

  // Cache positions to avoid layout thrashing (getBoundingClientRect) in the animation loop
  let parallaxCache = [];
  const updateCache = () => {
    const sx = window.scrollX, sy = window.scrollY;
    parallaxCache = parallaxEls.map(el => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
    });
  };
  window.addEventListener('resize', updateCache);
  window.addEventListener('load', updateCache); // Ensure correct positions after images load
  updateCache();

  const canParallaxMQ = window.matchMedia('(hover: hover) and (pointer: fine)'); // media query to check for capable devices
  let canParallax = canParallaxMQ.matches; // boolean whether to enable parallax
  const onCapChange = () => { canParallax = canParallaxMQ.matches; }; // update on change
  if (canParallaxMQ.addEventListener) canParallaxMQ.addEventListener('change', onCapChange); // modern event
  else if (canParallaxMQ.addListener) canParallaxMQ.addListener(onCapChange); // older API

  let mx = window.innerWidth * 0.5; // interpolated cursor X (start near center)
  let my = window.innerHeight * 0.35; // interpolated cursor Y (start near top)
  let tx = mx, ty = my; // target cursor positions

  const lerp = (a, b, t) => a + (b - a) * t; // linear interpolation helper

  function onMove(e) { // update target values from pointer events
    tx = e.clientX; // target x
    ty = e.clientY; // target y
  }

  let activeEl = null; // currently active/parallaxed element

  function closestParallax(x, y) { // find the closest parallax element to (x,y) within a margin
    let bestEl = null;
    let bestR = null;
    let bestD = Infinity;
    const sx = window.scrollX, sy = window.scrollY;

    for (const item of parallaxCache) { // iterate over cached data
      // Calculate current viewport rect from absolute cache
      const left = item.x - sx;
      const top = item.y - sy;

      if (x < left - 140 || x > left + item.w + 140 || y < top - 140 || y > top + item.h + 140) continue;

      const cx = left + item.w / 2;
      const cy = top + item.h / 2;
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy); // squared distance
      if (d < bestD) { // keep closest
        bestD = d;
        bestEl = item.el;
        bestR = { left, top, width: item.w, height: item.h };
      }
    }
    return bestEl ? { el: bestEl, r: bestR } : null; // return hit info or null
  }

  function clearActive() { // clear transform on active element
    if (activeEl) {
      activeEl.style.transform = ''; // remove transform
      activeEl = null; // clear reference
    }
  }

  function updateParallax(x, y) { // apply subtle tilt transform to the nearest element
    if (!canParallax) return; // do nothing on touch devices or where pointer is coarse
    const hit = closestParallax(x, y); // find closest element
    if (!hit) {
      clearActive(); // if none, clear active transforms
      return;
    }
    const el = hit.el; // target element
    const r = hit.r; // its bounding rect

    if (activeEl && activeEl !== el) {
      activeEl.style.transform = ''; // clear previous active if different
    }
    activeEl = el; // set new active

    const cx = r.left + r.width / 2; // center x
    const cy = r.top + r.height / 2; // center y
    const dx = (x - cx) / Math.max(1, r.width); // normalized x offset
    const dy = (y - cy) / Math.max(1, r.height); // normalized y offset

    const rx = Math.max(-1, Math.min(1, dy)) * -6; // rotation X clamped and scaled
    const ry = Math.max(-1, Math.min(1, dx)) * 8; // rotation Y clamped and scaled

    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`; // apply 3D transform
  }

  window.addEventListener('mouseleave', clearActive); // clear transforms when cursor leaves window

  // Main animation loop: update cursor glow and parallax
  function animate() {
    mx = lerp(mx, tx, 0.25); // smooth X towards target
    my = lerp(my, ty, 0.25); // smooth Y towards target

    const gx = (mx / window.innerWidth) * 100; // normalized percent for CSS variable X
    const gy = (my / window.innerHeight) * 100; // normalized percent for CSS variable Y

    if (glow) {
      // Set on element directly to avoid global style recalc
      glow.style.setProperty('--gx', gx + '%');
      glow.style.setProperty('--gy', gy + '%');
    }

    // update parallax effects using top-level helper
    updateParallax(mx, my); // apply tilt to nearest element based on interpolated cursor

    requestAnimationFrame(animate); // queue next frame
  }

  requestAnimationFrame(animate); // start the animation loop

  window.addEventListener('pointermove', onMove, { passive: true }); // update targets from pointer events
  window.addEventListener('mousemove', onMove, { passive: true }); // pointermove fallback
  window.addEventListener('touchmove', (e) => { // touch fallback: use first touch
    if (e.touches && e.touches[0]) onMove(e.touches[0]);
  }, { passive: true });

  animate(); // ensure loop runs (requestAnimationFrame already started it, but repeated call is harmless)
})();


/* Download Options Modal */
(() => {
  const modal = document.getElementById('downloadModal');
  if (!modal) return;

  const openers = Array.from(document.querySelectorAll('[data-download="1"]'));
  const closers = Array.from(modal.querySelectorAll('[data-dl-close="1"]'));

  const open = () => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  };
  const close = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  };

  for (const el of openers) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });
  }

  for (const el of closers) {
    el.addEventListener('click', close);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });



  for (const btn of modal.querySelectorAll('.dl-choice')) {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-provider');
      const url = LINKS[p] || "#";
      if (url === "#") return; // stays as prototype until you paste links
      window.location.href = url;
    });
  }
})();


// Scroll reveal wiring (premium entrance animations)
(() => {
  const targets = Array.from(document.querySelectorAll([
    '.muha-panel',
    '.card',
    '.bullet',
    '.qa',
    '.chip',
    '.dl-card',
    '.step-card',
    '.sec__head'
  ].join(',')));

  targets.forEach(el => el.classList.add('reveal'));

  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  // Wait for full page load to ensure animations play smoothly without lag
  const start = () => {
    setTimeout(() => targets.forEach(el => io.observe(el)), 100);
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();


// glowBoost: intensify glow when hovering interactive elements
(() => {
  const root = document.documentElement;
  const set = (v) => root.style.setProperty('--noiseOpacity', v);
  const over = () => set('.085');
  const out = () => set('.06');
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    if (t && (t.closest('a,button,.btn,summary'))) over();
  }, { passive: true });
  document.addEventListener('pointerout', out, { passive: true });
})();

/* === Script Hub Logic === */
(() => {
  const grid = document.getElementById('scriptGrid');
  const searchInput = document.getElementById('scriptSearch');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const pagination = document.getElementById('pagination');
  if (!grid) return; // Not on scripts page

  const API_BASE = 'https://scriptblox.com/api/script';

  const fetchWithFallback = async (targetUrl) => {
    const proxies = [
      { url: 'https://api.allorigins.win/get?url=', isJson: true }, // JSON wrapper (reliable backup)
      { url: 'https://api.codetabs.com/v1/proxy?quest=', isJson: false }, // Direct pipe
      { url: 'https://corsproxy.io/?', isJson: false } // Backup
    ];

    for (const proxy of proxies) {
      try {
        const sep = proxy.url.includes('?') ? '&' : '?';
        const res = await fetch(proxy.url + encodeURIComponent(targetUrl) + sep + "_t=" + Date.now());
        if (!res.ok) throw new Error('Proxy error');

        if (proxy.isJson) {
          const data = await res.json();
          return JSON.parse(data.contents);
        } else {
          return await res.json();
        }
      } catch (e) { continue; }
    }
    throw new Error('All proxies failed');
  };

  let debounceTimer;
  let activeFilter = 'all';
  let currentPage = 1;
  let scriptsCache = {};

  // Load script content cache from localStorage
  try {
    const saved = localStorage.getItem('zylite_scripts_content');
    if (saved) scriptsCache = JSON.parse(saved);
  } catch (e) { }

  // API Response Cache Helpers
  const getApiCache = (key) => {
    try {
      const item = localStorage.getItem('zylite_api_' + key);
      if (!item) return null;
      const p = JSON.parse(item);
      if (Date.now() - p.ts > 1000 * 60 * 10) return null; // 10 min expiry
      return p.data;
    } catch (e) { return null; }
  };
  const setApiCache = (key, data) => {
    try {
      localStorage.setItem('zylite_api_' + key, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) { }
  };

  // Helper to create script card HTML
  const createCard = (s) => {
    let imgUrl = 'logo.png';
    if (s.game && s.game.imageUrl && s.game.imageUrl !== '0') {
      if (s.game.imageUrl.startsWith('http')) {
        imgUrl = s.game.imageUrl;
      } else {
        const path = s.game.imageUrl.startsWith('/') ? s.game.imageUrl : '/' + s.game.imageUrl;
        imgUrl = `https://scriptblox.com${path}`;
      }
    }

    const views = s.views ? s.views.toLocaleString() : '0';
    // Use slug for fetching details
    // We store the script in the cache immediately if available
    return `
      <article class="script-card reveal">
        <img src="${imgUrl}" alt="${s.title}" class="script-img" loading="lazy">
        <div class="script-body">
          <h3 class="script-title" title="${s.title}">${s.title}</h3>
          <div class="script-meta">
            <span style="display:flex;align-items:center;gap:4px"><i data-lucide="eye" style="width:14px;height:14px"></i> ${views}</span>
            <span>${s.game ? s.game.name : 'Unknown'}</span>
          </div>
          <div class="script-actions">
            <button class="btn btn--sm btn--primary script-btn" data-slug="${s.slug}" data-img="${imgUrl}" data-title="${s.title}">View</button>
            <button class="btn btn--sm btn--ghost copy-btn" data-slug="${s.slug}">Copy</button>
          </div>
        </div>
      </article>
    `;
  };

  // Fetch function
  const fetchScripts = async (query = '', page = 1) => {
    const isAppend = page > 1;
    const cacheKey = `${activeFilter}_${query || 'none'}_${page}`;

    // Check cache for initial load
    if (!isAppend) {
      const cached = getApiCache(cacheKey);
      if (cached) {
        grid.innerHTML = cached.map(createCard).join('');
        if (window.lucide) lucide.createIcons();
        currentPage = page;
        if (pagination) pagination.style.display = cached.length >= 20 ? 'flex' : 'none';
        setTimeout(() => grid.querySelectorAll('.script-card').forEach(el => el.classList.add('is-in')), 50);
        return;
      }
    }

    if (!isAppend) {
      grid.innerHTML = '<div class="script-loader">Loading scripts...</div>';
      if (pagination) pagination.style.display = 'none';
    } else {
      if (loadMoreBtn) loadMoreBtn.textContent = 'Loading...';
    }

    try {
      let url = `${API_BASE}/fetch?page=${page}`; // Default to "Latest" (faster, includes script)

      if (query.trim().length > 0) {
        url = `${API_BASE}/search?q=${encodeURIComponent(query)}&mode=free&page=${page}`;
      } else {
        // Apply filters if no search query
        if (activeFilter === 'universal') url = `${API_BASE}/fetch?page=${page}&universal=1`;
        if (activeFilter === 'keyless') url = `${API_BASE}/fetch?page=${page}&key=0`;
        if (activeFilter === 'trending') url = `${API_BASE}/trending?page=${page}`;
      }

      const data = await fetchWithFallback(url);

      const scripts = data.result ? (data.result.scripts || []) : [];

      // Cache scripts from list response to avoid re-fetching
      scripts.forEach(s => { if (s.slug && s.script) scriptsCache[s.slug] = s.script; });
      try { localStorage.setItem('zylite_scripts_content', JSON.stringify(scriptsCache)); } catch (e) { }

      // Save API response to cache
      if (scripts.length > 0) setApiCache(cacheKey, scripts);

      if (scripts.length === 0) {
        if (!isAppend) grid.innerHTML = '<div class="script-loader">No scripts found.</div>';
        if (pagination) pagination.style.display = 'none';
        if (loadMoreBtn) loadMoreBtn.textContent = 'Load More';
        return;
      }

      const html = scripts.map(createCard).join('');

      if (isAppend) {
        grid.insertAdjacentHTML('beforeend', html);
      } else {
        grid.innerHTML = html;
      }

      // Initialize icons for newly added elements
      if (window.lucide) lucide.createIcons();

      currentPage = page;

      if (pagination) {
        pagination.style.display = scripts.length >= 20 ? 'flex' : 'none';
      }
      if (loadMoreBtn) loadMoreBtn.textContent = 'Load More';

      // Re-trigger scroll reveal for new elements
      const newCards = grid.querySelectorAll('.script-card:not(.is-in)');
      setTimeout(() => newCards.forEach(el => el.classList.add('is-in')), 50);

    } catch (e) {
      console.error(e);
      if (!isAppend) grid.innerHTML = '<div class="script-loader" style="color:var(--warn)">Failed to load scripts. (CORS or API Error)</div>';
      if (loadMoreBtn) loadMoreBtn.textContent = 'Load More';
    }
  };

  // Initial load (Trending)
  fetchScripts();

  // Search listener
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchScripts(e.target.value, 1);
      }, 600);
    });
  }

  // Filter listeners
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update UI
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update state and fetch
      activeFilter = btn.dataset.filter;
      searchInput.value = ''; // Clear search when filtering
      currentPage = 1; // Reset page
      fetchScripts('', 1);
    });
  });

  // Load More listener
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      const q = searchInput ? searchInput.value : '';
      fetchScripts(q, currentPage + 1);
    });
  }

  // Scroll to Top Logic
  const scrollTopBtn = document.getElementById('scrollTop');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 500);
    });
    scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }


  // Modal Logic for "Get Script"
  const modal = document.getElementById('scriptModal');
  const smTitle = document.getElementById('smTitle');
  const smCode = document.getElementById('smCode');
  const smImage = document.getElementById('smImage');
  const smCopy = document.getElementById('smCopyBtn');

  document.addEventListener('click', async (e) => {
    // View Button
    const btn = e.target.closest('.script-btn');
    if (btn) {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      smTitle.textContent = btn.dataset.title;
      smImage.src = btn.dataset.img;
      smImage.style.display = 'block';

      const slug = btn.dataset.slug;

      // Check cache first
      if (scriptsCache[slug]) {
        smCode.textContent = scriptsCache[slug];
        smCopy.onclick = () => {
          navigator.clipboard.writeText(scriptsCache[slug]);
          smCopy.textContent = 'Copied!';
          setTimeout(() => smCopy.textContent = 'Copy', 1000);
        };
      } else {
        smCode.textContent = '-- Fetching script...';
        // Fetch raw script
        try {
          const rawData = await fetchWithFallback(`${API_BASE}/fetch/${slug}`);
          const scriptTxt = rawData.script ? rawData.script.script : '-- Error fetching script';
          if (rawData.script && rawData.script.script) {
            scriptsCache[slug] = rawData.script.script; // Cache it
            try { localStorage.setItem('zylite_scripts_content', JSON.stringify(scriptsCache)); } catch (e) { }
          }
          smCode.textContent = scriptTxt;

          // Setup copy button
          smCopy.onclick = () => {
            navigator.clipboard.writeText(scriptTxt);
            smCopy.textContent = 'Copied!';
            setTimeout(() => smCopy.textContent = 'Copy', 1000);
          };
        } catch (err) {
          smCode.textContent = '-- Error: ' + err.message;
        }
      }
    }

    // Quick Copy Button (on card)
    if (e.target.matches('.copy-btn')) {
      const btn = e.target;
      const originalText = btn.textContent;
      const slug = btn.dataset.slug;

      // Check cache first
      if (scriptsCache[slug]) {
        navigator.clipboard.writeText(scriptsCache[slug]);
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = originalText, 2000);
        return;
      }

      btn.textContent = '...';
      btn.style.opacity = '0.7';

      try {
        const rawData = await fetchWithFallback(`${API_BASE}/fetch/${slug}`);
        const scriptTxt = rawData.script ? rawData.script.script : '';

        if (scriptTxt) {
          scriptsCache[slug] = scriptTxt; // Cache it
          try { localStorage.setItem('zylite_scripts_content', JSON.stringify(scriptsCache)); } catch (e) { }
          await navigator.clipboard.writeText(scriptTxt);
          btn.textContent = 'Copied!';
        } else {
          btn.textContent = 'Failed';
        }
      } catch (err) {
        btn.textContent = 'Error';
      }

      btn.style.opacity = '1';
      setTimeout(() => btn.textContent = originalText, 2000);
    }

    if (e.target.matches('[data-close-script]')) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });
})();

// Typewriter effect for Hero text
(() => {
  const el = document.querySelector('.txt-type');
  if (!el) return;

  const words = JSON.parse(el.getAttribute('data-words'));
  const wait = parseInt(el.getAttribute('data-wait'), 10) || 2000;
  let txt = '';
  let wordIndex = 0;
  let isDeleting = false;
  let typeSpeed = 100;

  const type = () => {
    const current = wordIndex % words.length;
    const fullTxt = words[current];

    if (isDeleting) {
      txt = fullTxt.substring(0, txt.length - 1);
      typeSpeed = 50;
    } else {
      txt = fullTxt.substring(0, txt.length + 1);
      typeSpeed = 100;
    }

    el.textContent = txt;

    if (!isDeleting && txt === fullTxt) {
      typeSpeed = wait;
      isDeleting = true;
    } else if (isDeleting && txt === '') {
      isDeleting = false;
      wordIndex++;
      typeSpeed = 500;
    }

    setTimeout(type, typeSpeed);
  };

  type();
})();

/* Downloading Page Logic */
(() => {
  // Check if we are on the downloading page
  const downloadPage = document.getElementById('downloadPageContent');
  if (!downloadPage) return;

  const realLink = downloadPage.getAttribute('data-download-url');
  const progressBar = document.getElementById('progressBar');
  const percentageText = document.getElementById('percentageText');
  const statusText = document.getElementById('statusText');
  const manualLink = document.getElementById('manualLink');

  if (manualLink) manualLink.href = realLink;

  // Reset UI
  progressBar.style.width = '0%';
  percentageText.innerText = '0%';

  // Start fake loading process immediately
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 4; // Random increment

    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);

      // Update UI to Complete
      progressBar.style.width = '100%';
      percentageText.innerText = '100%';
      statusText.innerText = 'Finished';

      setTimeout(() => {
        // Trigger the real download
        window.location.href = realLink;

        // Redirect back to download page after a delay
        setTimeout(() => {
          window.location.href = 'download.html';
        }, 3500);
      }, 500);

    } else {
      // Update Status Text based on progress
      if (progress < 25) statusText.innerText = "Initializing...";
      else if (progress < 50) statusText.innerText = "Tracking files...";
      else if (progress < 85) statusText.innerText = "Starting download...";
      else statusText.innerText = "Finalizing...";

      // Update bar
      progressBar.style.width = progress + '%';
      percentageText.innerText = Math.floor(progress) + '%';
    }
  }, 100);
})();

/* Floating Header Logic */
(() => {
  const header = document.querySelector('.hdr');
  if (!header) return;

  const checkScroll = () => {
    // Add 'is-top' class if at the top, remove it when scrolled
    header.classList.toggle('is-top', window.scrollY <= 50);
  };

  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll(); // Run on load
})();

// Hero UI View Switcher
(() => {
  const heroUi = document.querySelector('.hero__ui');
  if (!heroUi) return;

  // 1. Create Tabs
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'hero-tabs';
  tabsContainer.innerHTML = `
    <button class="hero-tab active" data-view="executor">Executor</button>
    <button class="hero-tab" data-view="scripthub">Script Hub</button>
  `;

  // 2. Wrap existing content (Executor View)
  const executorView = document.createElement('div');
  executorView.className = 'hero-view active';
  executorView.id = 'view-executor';
  while (heroUi.firstChild) {
    executorView.appendChild(heroUi.firstChild);
  }

  // Helper to create views
  const createView = (id, title, status, img, beta, sub) => {
    const view = document.createElement('div');
    view.className = 'hero-view';
    view.id = id;
    view.innerHTML = `
      <div class="muha-panel parallax">
        <div class="muha-panel__top">
          <div class="muha-panel__title">${title}</div>
          <div class="muha-panel__status"><span class="muha-dot"></span>${status}</div>
        </div>
        <div class="muha-panel__body">
          <div class="executor-frame">
            <img src="${img}" alt="${title} Interface" class="muha-logo" loading="lazy" decoding="async">
          </div>
          <div class="muha-beta" style="font-size: 24px; margin-top: 15px;">${beta}</div>
          <div class="muha-sub">${sub}</div>
        </div>
      </div>
    `;
    return view;
  };

  // 3. Create Script Hub View
  const scriptHubView = createView('view-scripthub', 'Script Hub', 'Online', 'scripthub.png', 'Script Hub', 'Access thousands of scripts instantly within the executor.');

  // 4. Create Settings View
  // (Removed as per user request)

  // 5. Reassemble DOM
  heroUi.appendChild(tabsContainer);
  heroUi.appendChild(executorView);
  heroUi.appendChild(scriptHubView);

  // Force parallax cache update so new panels get the 3D effect
  window.dispatchEvent(new Event('resize'));

  // 6. Event Listeners
  const tabs = tabsContainer.querySelectorAll('.hero-tab');
  const views = [executorView, scriptHubView];

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetId = `view-${tab.dataset.view}`;
      views.forEach(v => {
        v.classList.toggle('active', v.id === targetId);
      });
    });
  });
})();

// Star Animation System (Smooth Drift + Parallax)
(() => {
  const stars = document.getElementById('star-container');
  if (!stars) return;

  let driftY = 0;
  let lastTime = performance.now();
  const speed = 0.015; // Pixels per millisecond (approx 0.9px per frame at 60fps)

  const update = (time) => {
    const delta = time - lastTime;
    lastTime = time;

    // 1. Continuous Drift
    driftY += speed * delta;

    // 2. Scroll Parallax
    const scrollY = window.scrollY;

    // Combine both: drift moves down (+), scroll moves stars slower than page (0.15 factor)
    // We use modulo 500 for drift to keep numbers small (matching background size)
    const activeDrift = driftY % 500;

    // If we just translate, the background might run out. 
    // Since it's a repeating background-image, we can just cycle the translation.
    // However, modulo on the total transform can look jerky if not perfectly seamless.
    // Best trick: The background repeats every 500px.
    // So we effectively animate `background-position-y` via transform, or just wrap the transform value.

    const finalY = (activeDrift + (scrollY * 0.2));

    // Use translate3d for GPU acceleration
    stars.style.transform = `translate3d(0, ${finalY}px, 0)`;

    requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
})();

// Initialize Lucide icons globally
if (window.lucide) {
  lucide.createIcons();
}
