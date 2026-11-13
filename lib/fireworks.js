// Fireworks
window.addEventListener('load', () => {
  const canvasEl = document.createElement('canvas');
  canvasEl.classList.add('fireworks');
  document.body.append(canvasEl);

  const ctx = canvasEl.getContext('2d');
  const numberOfParticles = 30;
  const colors = ['#FF1461', '#18FF92', '#5A87FF', '#FBF38C'];
  let animations = [];
  let animationFrame = null;
  let pointerX = 0;
  let pointerY = 0;

  const resizeCanvas = debounce(setCanvasSize, 500);

  function setCanvasSize() {
    canvasEl.width = 2 * window.innerWidth;
    canvasEl.height = 2 * window.innerHeight;
    canvasEl.style.width = window.innerWidth + 'px';
    canvasEl.style.height = window.innerHeight + 'px';
    ctx.scale(2, 2);
  }

  document.addEventListener('mousedown', event => {
    const target = event.target;

    if (
      target.id === 'sidebar' ||
      target.id === 'toggle-sidebar' ||
      target.nodeName === 'A' ||
      target.nodeName === 'IMG'
    ) return;

    updateCoords(event);
    animateParticles(pointerX, pointerY);
  }, false);

  setCanvasSize();
  window.addEventListener('resize', resizeCanvas, false);

  function updateCoords(event) {
    const bounds = canvasEl.getBoundingClientRect();
    pointerX = event.clientX - bounds.left;
    pointerY = event.clientY - bounds.top;
  }

  function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function easeOutExpo(progress) {
    return progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
  }

  function interpolate(start, end, progress) {
    return start + (end - start) * progress;
  }

  function createParticle(x, y) {
    const color = colors[random(0, colors.length - 1)];
    const radius = random(16, 32);
    const angle = random(0, 360) * Math.PI / 180;
    const distance = random(50, 180) * [-1, 1][random(0, 1)];

    return {
      x,
      y,
      color,
      radius,
      endX: x + distance * Math.cos(angle),
      endY: y + distance * Math.sin(angle)
    };
  }

  function drawParticle(particle, easedProgress) {
    ctx.beginPath();
    ctx.arc(
      interpolate(particle.x, particle.endX, easedProgress),
      interpolate(particle.y, particle.endY, easedProgress),
      interpolate(particle.radius, 0.1, easedProgress),
      0,
      2 * Math.PI,
      true
    );
    ctx.fillStyle = particle.color;
    ctx.fill();
  }

  function drawCircle(animation, elapsed) {
    const progress = Math.min(elapsed / animation.circleDuration, 1);
    const easedProgress = easeOutExpo(progress);
    const alphaProgress = Math.min(elapsed / animation.alphaDuration, 1);

    ctx.globalAlpha = interpolate(0.5, 0, alphaProgress);
    ctx.beginPath();
    ctx.arc(
      animation.x,
      animation.y,
      interpolate(0.1, animation.circleRadius, easedProgress),
      0,
      2 * Math.PI,
      true
    );
    ctx.lineWidth = interpolate(6, 0, easedProgress);
    ctx.strokeStyle = '#F00';
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function render(timestamp) {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    const activeAnimations = [];

    for (const animation of animations) {
      const elapsed = Math.max(0, timestamp - animation.startTime);

      if (elapsed >= animation.particleDuration) continue;

      const particleProgress = easeOutExpo(elapsed / animation.particleDuration);

      for (const particle of animation.particles) {
        drawParticle(particle, particleProgress);
      }

      if (elapsed < animation.alphaDuration) drawCircle(animation, elapsed);
      activeAnimations.push(animation);
    }

    animations = activeAnimations;

    if (animations.length) {
      animationFrame = requestAnimationFrame(render);
    } else {
      animationFrame = null;
    }
  }

  function animateParticles(x, y) {
    const particles = [];

    for (let index = 0; index < numberOfParticles; index++) {
      particles.push(createParticle(x, y));
    }

    animations.push({
      x,
      y,
      particles,
      particleDuration: random(1200, 1800),
      circleRadius: random(80, 160),
      alphaDuration: random(600, 800),
      circleDuration: random(1200, 1800),
      startTime: performance.now()
    });

    if (animationFrame === null) animationFrame = requestAnimationFrame(render);
  }

  function debounce(fn, delay) {
    let timer;

    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
});
