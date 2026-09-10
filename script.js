let toggle;
let navLinks;
let groupCards;
let lightbox;
let lbCaption;
let lbPrev;
let lbNext;
let lbClose;
let carouselTrack;
let carouselContainer;

let currentGroup = [];
let currentIndex = 0;
let isMoving = false;
let slideWidth = 0;
let pointerStart = null;
let pointerDelta = 0;

function buildCarousel(images, title, startIndex = 0) {
  currentGroup = images.map(img => img.trim()).filter(Boolean);
  currentIndex = startIndex;
  carouselTrack.innerHTML = '';
  const slides = [];

  currentGroup.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    const img = document.createElement('img');
    img.src = src;
    img.alt = `${title} - ${i + 1}`;
    slide.appendChild(img);
    slides.push(slide);
  });

  if (slides.length === 1) {
    slides.push(slides[0].cloneNode(true));
  }

  const firstClone = slides[0].cloneNode(true);
  const lastClone = slides[slides.length - 1].cloneNode(true);
  carouselTrack.appendChild(lastClone);
  slides.forEach((s) => carouselTrack.appendChild(s));
  carouselTrack.appendChild(firstClone);

  slideWidth = carouselContainer.clientWidth;
  carouselTrack.style.transition = 'none';
  carouselTrack.style.transform = `translateX(${-(currentIndex + 1) * slideWidth}px)`;
  requestAnimationFrame(() => {
    carouselTrack.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
  });
  lbCaption.textContent = `${title} (${currentIndex + 1} of ${currentGroup.length})`;
}

function openLightbox(images, title, startIndex = 0) {
  lightbox.classList.remove('hidden');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // Stop scrolling behind lightbox
  buildCarousel(images, title, startIndex);
}

function closeLightbox() {
  lightbox.classList.add('hidden');
  lightbox.setAttribute('aria-hidden', 'true');
  carouselTrack.innerHTML = '';
  document.body.style.overflow = ''; // Re-enable scrolling
}

function updateCaption() {
  const currentImage = carouselTrack.querySelectorAll('.carousel-slide img')[currentIndex + 1];
  const title = currentImage ? currentImage.alt.split(' - ')[0] : '';
  lbCaption.textContent = `${title} (${currentIndex + 1} of ${currentGroup.length})`;
}

function goTo(index) {
  if (!currentGroup.length || isMoving) return;
  isMoving = true;
  currentIndex = (index + currentGroup.length) % currentGroup.length;
  carouselTrack.style.transform = `translateX(${-(currentIndex + 1) * slideWidth}px)`;
  updateCaption();
}

function nextSlide() { goTo(currentIndex + 1); }
function prevSlide() { goTo(currentIndex - 1); }

function attachCarouselListeners() {
  carouselTrack.addEventListener('transitionend', () => {
    const slides = carouselTrack.querySelectorAll('.carousel-slide');
    if (slides.length === 0) {
      isMoving = false;
      return;
    }

    if (currentIndex >= currentGroup.length) {
      currentIndex = 0;
      carouselTrack.style.transition = 'none';
      carouselTrack.style.transform = `translateX(${-(currentIndex + 1) * slideWidth}px)`;
      void carouselTrack.offsetWidth;
      carouselTrack.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    if (currentIndex < 0) {
      currentIndex = currentGroup.length - 1;
      carouselTrack.style.transition = 'none';
      carouselTrack.style.transform = `translateX(${-(currentIndex + 1) * slideWidth}px)`;
      void carouselTrack.offsetWidth;
      carouselTrack.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    updateCaption();
    isMoving = false;
  });

  groupCards.forEach((card) => {
    card.addEventListener('click', () => {
      const images = card.dataset.images ? card.dataset.images.split(',') : [];
      const title = card.dataset.title || '';
      openLightbox(images, title, 0);
    });
  });

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target.classList.contains('lightbox-backdrop')) closeLightbox();
  });

  lbPrev.addEventListener('click', prevSlide);
  lbNext.addEventListener('click', nextSlide);

  document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'Escape') closeLightbox();
  });

  window.addEventListener('resize', () => {
    if (!carouselContainer || lightbox.classList.contains('hidden')) return;
    slideWidth = carouselContainer.clientWidth;
    carouselTrack.style.transition = 'none';
    carouselTrack.style.transform = `translateX(${-(currentIndex + 1) * slideWidth}px)`;
    void carouselTrack.offsetWidth;
    carouselTrack.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
  });

  carouselContainer.addEventListener('pointerdown', (e) => {
    pointerStart = e.clientX;
    carouselTrack.style.transition = 'none';
    carouselContainer.setPointerCapture(e.pointerId);
  });

  carouselContainer.addEventListener('pointermove', (e) => {
    if (pointerStart === null) return;
    pointerDelta = e.clientX - pointerStart;
    carouselTrack.style.transform = `translateX(${-(currentIndex + 1) * slideWidth + pointerDelta}px)`;
  });

  carouselContainer.addEventListener('pointerup', () => {
    if (pointerStart === null) return;
    carouselTrack.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    if (Math.abs(pointerDelta) > 60) {
      if (pointerDelta > 0) prevSlide(); else nextSlide();
    } else {
      carouselTrack.style.transform = `translateX(${-(currentIndex + 1) * slideWidth}px)`;
    }
    pointerStart = null;
    pointerDelta = 0;
  });
}

function init() {
  toggle = document.querySelector('.menu-toggle');
  navLinks = document.querySelector('.nav-links');
  groupCards = document.querySelectorAll('.group-card');
  lightbox = document.getElementById('lightbox');
  lbCaption = document.querySelector('.lb-caption');
  lbPrev = document.querySelector('.lb-prev');
  lbNext = document.querySelector('.lb-next');
  lbClose = document.querySelector('.lb-close');
  carouselTrack = document.querySelector('.carousel-track');
  carouselContainer = document.querySelector('.carousel');

  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
  }

  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      toggle.classList.toggle('active');
    });

    document.querySelectorAll('.nav-links a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        toggle.classList.remove('active');
      });
    });
  }

  initAnimations();

  if (!groupCards.length || !lightbox || !lbCaption || !lbPrev || !lbNext || !lbClose || !carouselTrack || !carouselContainer) {
    return;
  }

  attachCarouselListeners();
}

function initAnimations() {
  const animateElements = document.querySelectorAll('.card, .team-card, .motto-card, .resource-card, .group-card, .join-card, .section-label, h2, .split-layout p, .stats-panel, .hiring-panel, .hero-text > *, .timeline-item');
  
  animateElements.forEach((el) => {
    el.classList.add('scroll-animate');
    
    if (el.parentElement) {
      if (['card-grid', 'team-grid', 'motto-grid', 'gallery-groups', 'hero-text'].some(c => el.parentElement.classList.contains(c))) {
        const children = Array.from(el.parentElement.children);
        const childIndex = children.indexOf(el);
        if (childIndex === 1) el.classList.add('delay-100');
        else if (childIndex === 2) el.classList.add('delay-200');
        else if (childIndex === 3) el.classList.add('delay-300');
        else if (childIndex >= 4) el.classList.add('delay-400');
      }
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  });

  animateElements.forEach(el => observer.observe(el));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* Wave canvas animation (lightweight sine waves in official ICPC colors) */
(function () {
  const canvas = document.getElementById('wave-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let rafId = null;

  // Tri-color waves matching Think (Red), Create (White), Solve (Blue)
  const waves = [
    { amp: 20, len: 0.010, speed: 0.6, phase: 0, color: 'rgba(255, 51, 102, 0.12)' },   // Crimson Red
    { amp: 14, len: 0.008, speed: 0.4, phase: 60, color: 'rgba(255, 255, 255, 0.07)' },  // Frosted White
    { amp: 10, len: 0.012, speed: 0.3, phase: 120, color: 'rgba(0, 82, 255, 0.1)' }     // Cyber Blue
  ];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.max(0, Math.floor(width * dpr));
    canvas.height = Math.max(0, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let t = 0;

  function draw() {
    ctx.clearRect(0, 0, width, height);
    waves.forEach((w) => {
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 2) {
        const y = height / 2 + Math.sin((x * w.len) + (t * w.speed) + w.phase) * w.amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = w.color;
      ctx.fill();
    });
    t += 0.016;
    rafId = requestAnimationFrame(draw);
  }

  function start() {
    cancelAnimationFrame(rafId);
    resize();
    draw();
  }

  window.addEventListener('resize', () => {
    clearTimeout(window._waveResizeTimer);
    window._waveResizeTimer = setTimeout(() => {
      resize();
    }, 120);
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    window.addEventListener('DOMContentLoaded', start);
  }
})();

// Auth State Management
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('icpc_token');
  const userStr = localStorage.getItem('icpc_user');
  
  const loginBtn = document.getElementById('nav-login-btn');
  const registerBtn = document.getElementById('nav-register-btn');
  const dashboardBtn = document.getElementById('nav-dashboard-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');

  if (token && userStr) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (registerBtn) registerBtn.style.display = 'none';
    if (dashboardBtn) dashboardBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';

    const user = JSON.parse(userStr);
    if ((user.role === 'ADMIN' || user.role === 'admin') && dashboardBtn) {
      dashboardBtn.textContent = 'Admin Panel';
      dashboardBtn.href = 'admin.html';
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('icpc_token');
        localStorage.removeItem('icpc_user');
        window.location.href = 'index.html';
      });
    }
  }
});

// Photo Modal Functionality
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('photo-modal');
  if (!modal) return;
  
  const modalImg = document.getElementById('modal-img');
  const modalName = document.getElementById('modal-name');
  const modalRole = document.getElementById('modal-role');
  const closeBtn = document.querySelector('.close-modal');

  // Add click event to all member photo wrappers
  const photoWrappers = document.querySelectorAll('.member-photo-wrapper');
  
  photoWrappers.forEach(wrapper => {
    wrapper.addEventListener('click', function(e) {
      e.stopPropagation();
      const card = this.closest('.member-card');
      const img = this.querySelector('img');
      const name = card.querySelector('.member-name').textContent;
      const role = card.querySelector('.member-role').textContent;

      modalImg.src = img.src;
      modalName.textContent = name;
      modalRole.textContent = role;

      modal.style.display = 'flex';
      // Small delay to allow display block to apply before adding class for transition
      setTimeout(() => {
        modal.classList.add('show');
      }, 10);
      document.body.style.overflow = 'hidden'; // Prevent scrolling
    });
  });

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }, 300); // Wait for transition
  };

  closeBtn.addEventListener('click', closeModal);

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close on Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModal();
    }
  });
});

/* Moving Particle Canvas & Floating Orbit Badges for Footer (Gravitas Style) */
function initMovingFooter() {
  const footer = document.querySelector('.footer');
  if (!footer) return;

  // 1. Prepend Canvas for moving background bubble particles
  let canvas = footer.querySelector('.footer-bubble-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'footer-bubble-canvas';
    footer.prepend(canvas);
  }

  // 2. Prepend Floating Circular Social Orbit Badges
  if (!footer.querySelector('.footer-badges-container')) {
    const badgesWrapper = document.createElement('div');
    badgesWrapper.className = 'container footer-badges-container';
    badgesWrapper.innerHTML = `
      <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" class="social-orbit-badge badge-instagram" aria-label="Instagram">
        <svg class="badge-text-svg" viewBox="0 0 100 100">
          <path id="circle-ig" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
          <text font-size="8.5" font-weight="700" letter-spacing="2" fill="#ffffff">
            <textPath href="#circle-ig" startOffset="0%">• INSTAGRAM • INSTAGRAM •</textPath>
          </text>
        </svg>
        <div class="badge-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
        </div>
      </a>

      <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" class="social-orbit-badge badge-youtube" aria-label="YouTube">
        <svg class="badge-text-svg" viewBox="0 0 100 100">
          <path id="circle-yt" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
          <text font-size="8.5" font-weight="700" letter-spacing="2" fill="#ffffff">
            <textPath href="#circle-yt" startOffset="0%">• YOUTUBE • YOUTUBE •</textPath>
          </text>
        </svg>
        <div class="badge-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
      </a>

      <a href="https://www.linkedin.com/company/icpc-club-amrita-nagercoil/posts/?feedView=all" target="_blank" rel="noopener noreferrer" class="social-orbit-badge badge-linkedin" aria-label="LinkedIn">
        <svg class="badge-text-svg" viewBox="0 0 100 100">
          <path id="circle-li" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
          <text font-size="8.5" font-weight="700" letter-spacing="2" fill="#ffffff">
            <textPath href="#circle-li" startOffset="0%">• LINKEDIN • LINKEDIN •</textPath>
          </text>
        </svg>
        <div class="badge-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
          </svg>
        </div>
      </a>

      <a href="https://x.com" target="_blank" rel="noopener noreferrer" class="social-orbit-badge badge-x" aria-label="X (Twitter)">
        <svg class="badge-text-svg" viewBox="0 0 100 100">
          <path id="circle-x" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
          <text font-size="8.5" font-weight="700" letter-spacing="2" fill="#ffffff">
            <textPath href="#circle-x" startOffset="0%">• TWITTER • TWITTER •</textPath>
          </text>
        </svg>
        <div class="badge-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </div>
      </a>
    `;

    const divider = footer.querySelector('.footer-divider');
    if (divider) {
      footer.insertBefore(badgesWrapper, divider);
    } else {
      footer.appendChild(badgesWrapper);
    }
  }

  // 3. Setup canvas particles animation
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let particles = [];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = footer.clientWidth;
    height = footer.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    particles = [];
    const count = Math.max(25, Math.floor(width / 16));
    const colors = [
      'rgba(147, 51, 234, ',   // Purple
      'rgba(99, 102, 241, ',   // Indigo
      'rgba(236, 72, 153, ',   // Pink/Magenta
      'rgba(56, 189, 248, ',   // Cyan/Blue
      'rgba(255, 255, 255, '   // Translucent white
    ];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 20 + 4,
        speedY: Math.random() * 0.7 + 0.25,
        swingAmp: Math.random() * 1.8 + 0.4,
        swingSpeed: Math.random() * 0.02 + 0.008,
        swingPhase: Math.random() * Math.PI * 2,
        baseOpacity: Math.random() * 0.25 + 0.06,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  let rafId = null;
  function draw() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach(p => {
      p.y -= p.speedY;
      p.swingPhase += p.swingSpeed;
      const currentX = p.x + Math.sin(p.swingPhase) * p.swingAmp;

      if (p.y + p.radius < 0) {
        p.y = height + p.radius;
        p.x = Math.random() * width;
      }

      ctx.beginPath();
      ctx.arc(currentX, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.baseOpacity + ')';
      ctx.fill();
    });

    rafId = requestAnimationFrame(draw);
  }

  function start() {
    cancelAnimationFrame(rafId);
    resize();
    createParticles();
    draw();
  }

  window.addEventListener('resize', () => {
    clearTimeout(window._footerBubbleTimer);
    window._footerBubbleTimer = setTimeout(() => {
      resize();
      createParticles();
    }, 120);
  });

  start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMovingFooter);
} else {
  initMovingFooter();
}

