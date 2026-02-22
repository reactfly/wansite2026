/**
 * Lightbox - Fullscreen Image Viewer with Zoom & Pan
 */

class Lightbox {
    constructor() {
        // Elements
        this.lightbox = document.getElementById('lightbox');
        this.backdrop = document.getElementById('lightboxBackdrop');
        this.closeBtn = document.getElementById('lightboxClose');
        this.prevBtn = document.getElementById('lightboxPrev');
        this.nextBtn = document.getElementById('lightboxNext');
        this.imageContainer = document.getElementById('lightboxImageContainer');
        this.image = document.getElementById('lightboxImage');
        this.currentEl = document.getElementById('lightboxCurrent');
        this.totalEl = document.getElementById('lightboxTotal');
        this.zoomInBtn = document.getElementById('zoomIn');
        this.zoomOutBtn = document.getElementById('zoomOut');
        this.zoomLevelEl = document.getElementById('zoomLevel');
        this.announcer = document.getElementById('lightboxAnnouncer');
        
        // State
        this.images = [];
        this.currentIndex = 0;
        this.isOpen = false;
        this.zoom = 1;
        this.minZoom = 1;
        this.maxZoom = 4;
        this.zoomStep = 0.5;
        
        // Pan state
        this.pan = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.panStart = { x: 0, y: 0 };
        
        // Touch state
        this.touches = [];
        this.lastTouchDistance = 0;
        
        // Focus trap
        this.focusableElements = null;
        this.firstFocusable = null;
        this.lastFocusable = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateTotal();
    }
    
    setImages(images) {
        this.images = images;
        this.updateTotal();
    }
    
    updateTotal() {
        if (this.totalEl) {
            this.totalEl.textContent = this.images.length;
        }
    }
    
    bindEvents() {
        // Close events
        this.closeBtn?.addEventListener('click', () => this.close());
        this.backdrop?.addEventListener('click', () => this.close());
        
        // Navigation
        this.prevBtn?.addEventListener('click', () => this.prev());
        this.nextBtn?.addEventListener('click', () => this.next());
        
        // Zoom controls
        this.zoomInBtn?.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn?.addEventListener('click', () => this.zoomOut());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Wheel zoom
        this.imageContainer?.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        // Touch events for pan and pinch zoom
        this.imageContainer?.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.imageContainer?.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.imageContainer?.addEventListener('touchend', (e) => this.onTouchEnd(e));
        
        // Mouse drag pan
        this.imageContainer?.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', () => this.onMouseUp());
        
        // Prevent context menu on long press
        this.imageContainer?.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    open(index) {
        if (index < 0 || index >= this.images.length) return;
        
        this.currentIndex = index;
        this.loadImage(index);
        this.resetZoom();
        
        // Show lightbox
        this.lightbox.hidden = false;
        this.lightbox.classList.add('active');
        
        // Lock body scroll
        document.body.style.overflow = 'hidden';
        
        // Focus first element
        setTimeout(() => {
            this.closeBtn?.focus();
            this.lightbox.classList.add('has-interacted');
        }, 100);
        
        // Preload adjacent images
        this.preloadAdjacent();
        
        this.isOpen = true;
        this.announce(`Imagem ${index + 1} de ${this.images.length}`);
    }
    
    close() {
        this.lightbox.classList.remove('active');
        
        setTimeout(() => {
            this.lightbox.hidden = true;
            this.image.src = '';
            document.body.style.overflow = '';
            this.isOpen = false;
        }, 300);
    }
    
    loadImage(index) {
        const imgData = this.images[index];
        if (!imgData) return;
        
        this.imageContainer.classList.add('loading');
        
        // Create new image to preload
        const tempImg = new Image();
        tempImg.onload = () => {
            this.image.src = imgData.src;
            this.image.alt = imgData.alt || '';
            this.imageContainer.classList.remove('loading');
            
            // Reset zoom when loading new image
            this.resetZoom();
        };
        tempImg.onerror = () => {
            this.imageContainer.classList.remove('loading');
        };
        tempImg.src = imgData.src;
        
        // Update counter
        if (this.currentEl) {
            this.currentEl.textContent = index + 1;
        }
    }
    
    prev() {
        if (this.currentIndex > 0) {
            this.loadImage(this.currentIndex - 1);
            this.currentIndex--;
            this.resetZoom();
            this.preloadAdjacent();
            this.announce(`Imagem ${this.currentIndex + 1} de ${this.images.length}`);
        }
    }
    
    next() {
        if (this.currentIndex < this.images.length - 1) {
            this.loadImage(this.currentIndex + 1);
            this.currentIndex++;
            this.resetZoom();
            this.preloadAdjacent();
            this.announce(`Imagem ${this.currentIndex + 1} de ${this.images.length}`);
        }
    }
    
    preloadAdjacent() {
        const preloadIndices = [this.currentIndex - 1, this.currentIndex + 1];
        
        preloadIndices.forEach(idx => {
            if (idx >= 0 && idx < this.images.length) {
                const img = new Image();
                img.src = this.images[idx].src;
            }
        });
    }
    
    // Zoom methods
    zoomIn() {
        this.setZoom(this.zoom + this.zoomStep);
    }
    
    zoomOut() {
        this.setZoom(this.zoom - this.zoomStep);
    }
    
    setZoom(value, fromCenter = true) {
        const newZoom = GalleryUtils.clamp(value, this.minZoom, this.maxZoom);
        
        // If zooming out to 1x, reset pan
        if (newZoom === 1) {
            this.resetPan();
        } else if (fromCenter && this.zoom === 1) {
            // Start zoom from center when not panned
            this.pan = { x: 0, y: 0 };
        }
        
        this.zoom = newZoom;
        this.updateZoomDisplay();
        this.applyTransform();
        
        // Toggle zoomed class for cursor change
        this.imageContainer.classList.toggle('zoomed', this.zoom > 1);
    }
    
    updateZoomDisplay() {
        if (this.zoomLevelEl) {
            this.zoomLevelEl.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }
    
    resetZoom() {
        this.zoom = 1;
        this.resetPan();
        this.updateZoomDisplay();
        this.imageContainer.classList.remove('zoomed');
        this.applyTransform();
    }
    
    resetPan() {
        this.pan = { x: 0, y: 0 };
        this.applyTransform();
    }
    
    // Wheel zoom handler
    onWheel(e) {
        if (!this.isOpen) return;
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
        this.setZoom(this.zoom + delta);
    }
    
    // Mouse drag pan
    onMouseDown(e) {
        if (this.zoom <= 1) return;
        
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.panStart = { ...this.pan };
        this.imageContainer.style.cursor = 'grabbing';
    }
    
    onMouseMove(e) {
        if (!this.isDragging) return;
        
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        
        // Scale pan by zoom level
        this.pan.x = this.panStart.x + dx / this.zoom;
        this.pan.y = this.panStart.y + dy / this.zoom;
        
        this.clampPan();
        this.applyTransform();
    }
    
    onMouseUp() {
        this.isDragging = false;
        if (this.zoom > 1) {
            this.imageContainer.style.cursor = 'move';
        }
    }
    
    // Touch handlers for pinch zoom and swipe
    onTouchStart(e) {
        if (!this.isOpen) return;
        
        this.touches = Array.from(e.touches);
        
        if (this.touches.length === 2) {
            // Pinch start
            this.lastTouchDistance = this.getTouchDistance(this.touches);
            e.preventDefault();
        } else if (this.touches.length === 1 && this.zoom > 1) {
            // Pan start
            this.isDragging = true;
            this.dragStart = { 
                x: this.touches[0].clientX, 
                y: this.touches[0].clientY 
            };
            this.panStart = { ...this.pan };
        }
    }
    
    onTouchMove(e) {
        if (!this.isOpen) return;
        
        this.touches = Array.from(e.touches);
        
        if (this.touches.length === 2) {
            // Pinch zoom
            e.preventDefault();
            const distance = this.getTouchDistance(this.touches);
            const delta = (distance - this.lastTouchDistance) * 0.01;
            
            this.setZoom(this.zoom + delta, false);
            this.lastTouchDistance = distance;
        } else if (this.touches.length === 1 && this.isDragging && this.zoom > 1) {
            // Pan
            e.preventDefault();
            const dx = this.touches[0].clientX - this.dragStart.x;
            const dy = this.touches[0].clientY - this.dragStart.y;
            
            this.pan.x = this.panStart.x + dx / this.zoom;
            this.pan.y = this.panStart.y + dy / this.zoom;
            
            this.clampPan();
            this.applyTransform();
        }
    }
    
    onTouchEnd(e) {
        this.touches = Array.from(e.touches);
        
        if (this.touches.length < 2) {
            this.lastTouchDistance = 0;
        }
        
        if (this.touches.length === 0) {
            this.isDragging = false;
            
            // Check for swipe gesture
            const swipeThreshold = 50;
            if (this.pan.x === 0 && this.pan.y === 0) {
                // Could implement swipe navigation here
            }
        }
    }
    
    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    clampPan() {
        if (this.zoom <= 1) return;
        
        const containerRect = this.imageContainer.getBoundingClientRect();
        const imageRect = this.image.getBoundingClientRect();
        
        const maxX = Math.max(0, (imageRect.width * this.zoom - containerRect.width) / 2);
        const maxY = Math.max(0, (imageRect.height * this.zoom - containerRect.height) / 2);
        
        this.pan.x = GalleryUtils.clamp(this.pan.x, -maxX, maxX);
        this.pan.y = GalleryUtils.clamp(this.pan.y, -maxY, maxY);
    }
    
    applyTransform() {
        this.image.style.transform = `
            scale(${this.zoom}) 
            translate(${this.pan.x / this.zoom}px, ${this.pan.y / this.zoom}px)
        `;
    }
    
    // Keyboard navigation
    onKeyDown(e) {
        if (!this.isOpen) return;
        
        switch (e.key) {
            case 'ArrowLeft':
                this.prev();
                break;
            case 'ArrowRight':
                this.next();
                break;
            case 'Escape':
                this.close();
                break;
            case '+':
            case '=':
                this.zoomIn();
                break;
            case '-':
                this.zoomOut();
                break;
            case '0':
                this.resetZoom();
                break;
        }
    }
    
    // Screen reader announcement
    announce(message) {
        if (this.announcer) {
            this.announcer.textContent = message;
        }
    }
    
    // Focus trap
    handleTabKey(e) {
        if (!this.isOpen) return;
        
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === this.firstFocusable) {
                    e.preventDefault();
                    this.lastFocusable.focus();
                }
            } else {
                if (document.activeElement === this.lastFocusable) {
                    e.preventDefault();
                    this.firstFocusable.focus();
                }
            }
        }
    }
}

// Make available globally
window.Lightbox = Lightbox;
