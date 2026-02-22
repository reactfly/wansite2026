/**
 * Card Tilt - 3D Tilt Effect with Mouse & Gyroscope Support
 */

class CardTilt {
    constructor(cardElement, options = {}) {
        this.card = cardElement;
        this.inner = cardElement.querySelector('.gallery-card-inner');
        this.glare = cardElement.querySelector('.card-glare');
        
        this.options = {
            maxTilt: options.maxTilt || 15,
            perspective: options.perspective || 1000,
            glareOpacity: options.glareOpacity || 0.15,
            smoothFactor: options.smoothFactor || 0.1,
            ...options
        };
        
        // State
        this.currentTilt = { x: 0, y: 0 };
        this.targetTilt = { x: 0, y: 0 };
        this.isHovering = false;
        this.animationFrame = null;
        
        // Gyroscope state
        this.gyroEnabled = false;
        this.gyroValues = { beta: 0, gamma: 0 };
        
        this.init();
    }
    
    init() {
        if (GalleryUtils.prefersReducedMotion()) {
            return;
        }
        
        this.bindEvents();
        this.startAnimationLoop();
    }
    
    bindEvents() {
        // Mouse events
        this.card.addEventListener('mouseenter', () => this.onMouseEnter());
        this.card.addEventListener('mouseleave', () => this.onMouseLeave());
        this.card.addEventListener('mousemove', (e) => this.onMouseMove(e));
        
        // Touch events for mobile fallback
        this.card.addEventListener('touchstart', () => this.onTouchStart());
        this.card.addEventListener('touchend', () => this.onTouchEnd());
        this.card.addEventListener('touchmove', (e) => this.onTouchMove(e));
    }
    
    onMouseEnter() {
        if (this.gyroEnabled) return;
        
        this.isHovering = true;
        this.card.classList.add('is-tilting');
    }
    
    onMouseLeave() {
        if (this.gyroEnabled) return;
        
        this.isHovering = false;
        this.card.classList.remove('is-tilting');
        
        // Reset tilt smoothly
        this.targetTilt = { x: 0, y: 0 };
    }
    
    onMouseMove(e) {
        if (this.gyroEnabled) return;
        
        const rect = this.card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate tilt from center (-1 to 1)
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const tiltX = (y - centerY) / centerY; // Inverted for natural feel
        const tiltY = (x - centerX) / centerX;
        
        // Apply max tilt
        this.targetTilt.x = GalleryUtils.clamp(tiltX * this.options.maxTilt, -this.options.maxTilt, this.options.maxTilt);
        this.targetTilt.y = GalleryUtils.clamp(tiltY * this.options.maxTilt, -this.options.maxTilt, this.options.maxTilt);
        
        // Update glare position
        this.updateGlare(x, y, rect.width, rect.height);
    }
    
    onTouchStart() {
        if (!this.gyroEnabled) {
            this.isHovering = true;
            this.card.classList.add('is-tilting');
        }
    }
    
    onTouchEnd() {
        if (!this.gyroEnabled) {
            this.isHovering = false;
            this.card.classList.remove('is-tilting');
            this.targetTilt = { x: 0, y: 0 };
        }
    }
    
    onTouchMove(e) {
        if (this.gyroEnabled || !this.isHovering) return;
        
        const touch = e.touches[0];
        const rect = this.card.getBoundingClientRect();
        
        this.updateGlare(
            touch.clientX - rect.left,
            touch.clientY - rect.top,
            rect.width,
            rect.height
        );
    }
    
    updateGlare(x, y, width, height) {
        if (!this.glare) return;
        
        const glareX = (x / width) * 100;
        const glareY = (y / height) * 100;
        
        this.glare.style.setProperty('--glare-x', `${glareX}%`);
        this.glare.style.setProperty('--glare-y', `${glareY}%`);
    }
    
    // Gyroscope methods
    enableGyroscope() {
        if (!GalleryUtils.hasGyroscope()) return Promise.resolve(false);
        
        // Check if iOS 13+ needs permission
        if (GalleryUtils.needsGyroPermission()) {
            return this.requestGyroPermission();
        }
        
        this.startGyroscope();
        return Promise.resolve(true);
    }
    
    async requestGyroPermission() {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                this.startGyroscope();
                return true;
            }
        } catch (error) {
            console.warn('Gyroscope permission denied:', error);
        }
        return false;
    }
    
    startGyroscope() {
        this.gyroEnabled = true;
        this.card.classList.add('is-tilting');
        
        window.addEventListener('deviceorientation', (e) => this.onDeviceOrientation(e));
    }
    
    disableGyroscope() {
        this.gyroEnabled = false;
        this.card.classList.remove('is-tilting');
        this.targetTilt = { x: 0, y: 0 };
        
        window.removeEventListener('deviceorientation', (e) => this.onDeviceOrientation(e));
    }
    
    onDeviceOrientation(event) {
        if (!this.gyroEnabled) return;
        
        // beta: front-back tilt (-180 to 180)
        // gamma: left-right tilt (-90 to 90)
        let { beta, gamma } = event;
        
        // Handle null values
        if (beta === null || gamma === null) return;
        
        // Clamp values
        beta = GalleryUtils.clamp(beta, -45, 45);
        gamma = GalleryUtils.clamp(gamma, -45, 45);
        
        // Map to tilt range (-maxTilt to maxTilt)
        this.targetTilt.x = GalleryUtils.mapRange(beta, -45, 45, -this.options.maxTilt, this.options.maxTilt);
        this.targetTilt.y = GalleryUtils.mapRange(gamma, -45, 45, -this.options.maxTilt, this.options.maxTilt);
    }
    
    startAnimationLoop() {
        const animate = () => {
            // Smooth interpolation
            this.currentTilt.x = GalleryUtils.lerp(
                this.currentTilt.x,
                this.targetTilt.x,
                this.options.smoothFactor
            );
            this.currentTilt.y = GalleryUtils.lerp(
                this.currentTilt.y,
                this.targetTilt.y,
                this.options.smoothFactor
            );
            
            // Apply transform
            this.applyTransform();
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        this.animationFrame = requestAnimationFrame(animate);
    }
    
    applyTransform() {
        if (!this.inner) return;
        
        const rotateX = -this.currentTilt.x;
        const rotateY = this.currentTilt.y;
        
        this.inner.style.transform = `
            perspective(${this.options.perspective}px)
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
        `;
        
        // Dynamic shadow
        const shadowX = this.currentTilt.y * 0.5;
        const shadowY = -this.currentTilt.x * 0.5;
        const shadowBlur = 32 + Math.abs(this.currentTilt.x) + Math.abs(this.currentTilt.y);
        const shadowOpacity = 0.4 + (Math.abs(this.currentTilt.x) + Math.abs(this.currentTilt.y)) / 60;
        
        this.inner.style.boxShadow = `
            ${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity})
        `;
    }
    
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        this.disableGyroscope();
        
        // Remove inline styles
        if (this.inner) {
            this.inner.style.transform = '';
            this.inner.style.boxShadow = '';
        }
    }
}

// Make available globally
window.CardTilt = CardTilt;
