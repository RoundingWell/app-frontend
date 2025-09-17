import { animate } from 'animejs';

function animSidebar(targets) {
  return animate(targets, {
    translateX: [{ to: 20, duration: 0 }, { to: 0, duration: 200 }],
    opacity: [{ from: 0 }, { to: 1, duration: 300 }],
    ease: 'inOutQuad',
  });
}

export {
  animSidebar,
};
