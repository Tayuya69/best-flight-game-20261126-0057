// Cendrawasih Airlift — input.js
// One job: keyboard and mouse input, reduced to one steering state.
// Keyboard: arrows/WASD pitch + bank, W/S or Shift/Ctrl throttle,
// Space flaps/brake, Enter start, P pause, M mute. Mouse: drag to steer,
// wheel for throttle, click on the HUD throttle buttons.

// Key codes we care about, by KeyboardEvent.code.
const INPUT_KEYS = {
  pitchUp: ['ArrowUp', 'KeyW'],
  pitchDown: ['ArrowDown', 'KeyS'],
  bankLeft: ['ArrowLeft', 'KeyA'],
  bankRight: ['ArrowRight', 'KeyD'],
  throttleUp: ['ShiftLeft', 'ShiftRight', 'KeyE'],
  throttleDown: ['ControlLeft', 'ControlRight', 'KeyQ'],
  brake: ['Space'],
  start: ['Enter', 'NumpadEnter'],
  pause: ['KeyP'],
  mute: ['KeyM'],
  job1: ['Digit1'],
  job2: ['Digit2'],
  job3: ['Digit3'],
};

function makeInput(canvas) {
  const held = new Set();
  const pressed = new Set(); // edge-triggered keys, consumed once
  const mouse = {
    dragging: false,
    dragX: 0, // accumulated drag, -1..1, steers the plane
    dragY: 0,
    x: 0,
    y: 0,
    wheel: 0, // accumulated wheel ticks, consumed by the loop
    clicked: null, // {x, y} of the last click, consumed once
  };

  function codeOf(e) {
    return e.code || '';
  }

  function onKeyDown(e) {
    const c = codeOf(e);
    if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      held.add(c);
      pressed.add(c);
    }
  }

  function onKeyUp(e) {
    held.delete(codeOf(e));
  }

  function onMouseDown(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    mouse.dragging = true;
    mouse.dragX = 0;
    mouse.dragY = 0;
  }

  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    if (mouse.dragging) {
      mouse.dragX = Math.max(-1, Math.min(1, mouse.dragX + e.movementX / 260));
      mouse.dragY = Math.max(-1, Math.min(1, mouse.dragY + e.movementY / 260));
    }
  }

  function onMouseUp(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    mouse.dragging = false;
    // A click is a press and release almost in place.
    if (Math.abs(mouse.dragX) < 0.05 && Math.abs(mouse.dragY) < 0.05) {
      mouse.clicked = { x, y };
    }
    mouse.dragX = 0;
    mouse.dragY = 0;
  }

  function onWheel(e) {
    e.preventDefault();
    mouse.wheel += e.deltaY < 0 ? 1 : -1;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function anyHeld(list) {
    return list.some((c) => held.has(c));
  }

  return {
    // Steering for this frame: pitch -1 (nose down) .. 1 (nose up),
    // bank -1 (left) .. 1 (right). Mouse drag blends with the keys.
    steering() {
      let pitch = 0;
      let bank = 0;
      if (anyHeld(INPUT_KEYS.pitchUp)) pitch += 1;
      if (anyHeld(INPUT_KEYS.pitchDown)) pitch -= 1;
      if (anyHeld(INPUT_KEYS.bankLeft)) bank -= 1;
      if (anyHeld(INPUT_KEYS.bankRight)) bank += 1;
      if (mouse.dragging) {
        bank += mouse.dragX;
        pitch -= mouse.dragY;
      }
      return {
        pitch: Math.max(-1, Math.min(1, pitch)),
        bank: Math.max(-1, Math.min(1, bank)),
      };
    },
    throttleDelta() {
      let d = 0;
      if (anyHeld(INPUT_KEYS.throttleUp)) d += 1;
      if (anyHeld(INPUT_KEYS.throttleDown)) d -= 1;
      if (mouse.wheel !== 0) {
        d += mouse.wheel * 0.25;
        mouse.wheel = 0;
      }
      return d;
    },
    brakeHeld() {
      return anyHeld(INPUT_KEYS.brake);
    },
    // True once for a key pressed since the last call.
    wasPressed(list) {
      for (const c of list) {
        if (pressed.has(c)) {
          pressed.delete(c);
          return true;
        }
      }
      return false;
    },
    // Consume the edge queue at the end of a frame.
    endFrame() {
      pressed.clear();
    },
    // The last click position, or null. Consumed on read.
    takeClick() {
      const c = mouse.clicked;
      mouse.clicked = null;
      return c;
    },
    mousePos() {
      return { x: mouse.x, y: mouse.y };
    },
    isDragging() {
      return mouse.dragging;
    },
  };
}
