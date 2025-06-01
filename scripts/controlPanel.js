const walkAudio = document.querySelector('#walk-audio');
walkAudio.loop = true;

export class ControlPanel {
  constructor() {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.jump = false;

    this.weapons = ['gun', 'block'];
    this.selectedWeaponIndex = 0;

    this.gun = false;
    this.block = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
  }

  startListening() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('wheel', this._onWheel);
  }

  stopListening() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('wheel', this._onWheel);
  }

  _selectWeapon(index) {
    this.selectedWeaponIndex = index;
    this.gun = index === 0;
    this.block = index === 1;
  }

  _onWheel(event) {
    const direction = Math.sign(event.deltaY);
    let newIndex = this.selectedWeaponIndex + direction;
    if (newIndex < 0) newIndex = this.weapons.length - 1;
    if (newIndex >= this.weapons.length) newIndex = 0;
    this._selectWeapon(newIndex);
  }

  _onKeyDown(event) {
    let changed = false;

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        if (!this.moveForward) changed = true;
        this.moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        if (!this.moveLeft) changed = true;
        this.moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        if (!this.moveBackward) changed = true;
        this.moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (!this.moveRight) changed = true;
        this.moveRight = true;
        break;
      case 'Space':
        this.jump = true;
        break;
    }

    switch (event.key) {
      case '1':
      case '&':
        this._selectWeapon(0);
        break;
      case '2':
      case 'é':
        this._selectWeapon(1);
        break;
    }

    if (changed) this._updateWalkingAudio();
  }

  _onKeyUp(event) {
    let changed = false;

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        if (this.moveForward) changed = true;
        this.moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        if (this.moveLeft) changed = true;
        this.moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        if (this.moveBackward) changed = true;
        this.moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (this.moveRight) changed = true;
        this.moveRight = false;
        break;
      case 'Space':
        this.jump = false;
        break;
    }

    if (changed) this._updateWalkingAudio();
  }

  _updateWalkingAudio() {
    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;

    if (isMoving) {
      if (walkAudio.paused) {
        walkAudio.play().catch(e => {
          // Bijv. als de gebruiker nog niet op iets geklikt heeft
          console.warn('Audio play werd geblokkeerd:', e);
        });
      }
    } else {
      walkAudio.pause();
      walkAudio.currentTime = 0; // reset naar begin
    }
  }
}
