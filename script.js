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
 
 / /   A u t h   S t a t e   M a n a g e m e n t  
 d o c u m e n t . a d d E v e n t L i s t e n e r ( ' D O M C o n t e n t L o a d e d ' ,   ( )   = >   {  
     c o n s t   t o k e n   =   l o c a l S t o r a g e . g e t I t e m ( ' i c p c _ t o k e n ' ) ;  
     c o n s t   u s e r S t r   =   l o c a l S t o r a g e . g e t I t e m ( ' i c p c _ u s e r ' ) ;  
      
     c o n s t   l o g i n B t n   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' n a v - l o g i n - b t n ' ) ;  
     c o n s t   r e g i s t e r B t n   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' n a v - r e g i s t e r - b t n ' ) ;  
     c o n s t   d a s h b o a r d B t n   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' n a v - d a s h b o a r d - b t n ' ) ;  
     c o n s t   l o g o u t B t n   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' n a v - l o g o u t - b t n ' ) ;  
  
     i f   ( t o k e n   & &   u s e r S t r )   {  
         i f   ( l o g i n B t n )   l o g i n B t n . s t y l e . d i s p l a y   =   ' n o n e ' ;  
         i f   ( r e g i s t e r B t n )   r e g i s t e r B t n . s t y l e . d i s p l a y   =   ' n o n e ' ;  
         i f   ( d a s h b o a r d B t n )   d a s h b o a r d B t n . s t y l e . d i s p l a y   =   ' i n l i n e - b l o c k ' ;  
         i f   ( l o g o u t B t n )   l o g o u t B t n . s t y l e . d i s p l a y   =   ' i n l i n e - b l o c k ' ;  
  
         c o n s t   u s e r   =   J S O N . p a r s e ( u s e r S t r ) ;  
         i f   ( u s e r . r o l e   = = =   ' a d m i n '   & &   d a s h b o a r d B t n )   {  
             d a s h b o a r d B t n . t e x t C o n t e n t   =   ' A d m i n   P a n e l ' ;  
             d a s h b o a r d B t n . h r e f   =   ' a d m i n . h t m l ' ;  
         }  
  
         i f   ( l o g o u t B t n )   {  
             l o g o u t B t n . a d d E v e n t L i s t e n e r ( ' c l i c k ' ,   ( )   = >   {  
                 l o c a l S t o r a g e . r e m o v e I t e m ( ' i c p c _ t o k e n ' ) ;  
                 l o c a l S t o r a g e . r e m o v e I t e m ( ' i c p c _ u s e r ' ) ;  
                 w i n d o w . l o c a t i o n . h r e f   =   ' i n d e x . h t m l ' ;  
             } ) ;  
         }  
     }  
 } ) ;  
 

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
