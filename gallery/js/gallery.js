/**
 * Gallery - Main entry point for the Premium Image Gallery
 */

class Gallery {
    constructor() {
        this.grid = document.getElementById('galleryGrid');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.gyroPermissionBtn = document.getElementById('gyroPermissionBtn');
        
        this.images = [];
        this.cards = [];
        this.cardTiltInstances = [];
        this.lightbox = null;
        this.scrollAnimations = null;
        
        // Image data - using sample images
        this.imageData = this.getSampleImages();
        
        this.init();
    }
    
    getSampleImages() {
        // Sample images for the gallery
        return [
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Paisagem montanhosa ao pôr do sol',
                title: 'Montanhas Douradas',
                description: 'Pôr do sol nas montanhas'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Praia tropical com águas cristalinas',
                title: 'Paraíso Tropical',
                description: 'Praia de águas transparentes'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Cidade nocturna iluminada',
                title: 'City Lights',
                description: 'Vista nocturna da cidade'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Floresta verdejante',
                title: 'Verde Eterno',
                description: 'Natureza na sua plenitude'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Deserto com dunas',
                title: 'Mar de Areia',
                description: 'Beleza do deserto'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Lago de águas calmas',
                title: 'Reflexos',
                description: 'Lago平静 ao amanhecer'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Cascata majestosa',
                title: 'Força da Natureza',
                description: 'Cascata em toda sua glória'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Aurora boreal',
                title: 'Danças Celestiais',
                description: 'Aurora no céu nocturno'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Campo de flores',
                title: 'Jardim das Cores',
                description: 'Mar de flores silvestres'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Pôr do sol na praia',
                title: 'Ouro Líquido',
                description: 'Pôr do sol na orla'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Neve nas montanhas',
                title: 'Reino Branco',
                description: 'Pico coberto de neve'
            },
            {
                src: '../imagens/001.jpeg',
                thumb: '../imagens/001.jpeg',
                alt: 'Floresta nebulosa',
                title: 'Misticismo',
                description: 'Neblina na floresta'
            }
        ];
    }
    
    async init() {
        // Wait for GSAP to load
        await this.waitForGSAP();
        
        // Initialize components
        this.lightbox = new Lightbox();
        this.scrollAnimations = new ScrollAnimations();
        
        // Generate cards
        this.generateCards();
        
        // Initialize tilt effects
        this.initTiltEffects();
        
        // Initialize scroll animations
        this.initScrollAnimations();
        
        // Setup gyro button
        this.setupGyroButton();
        
        // Hide loading
        this.hideLoading();
        
        // Handle resize
        window.addEventListener('resize', GalleryUtils.debounce(() => this.onResize(), 200));
    }
    
    waitForGSAP() {
        return new Promise(resolve => {
            const checkGSAP = () => {
                if (window.gsap && window.ScrollTrigger) {
                    resolve();
                } else {
                    setTimeout(checkGSAP, 100);
                }
            };
            checkGSAP();
        });
    }
    
    generateCards() {
        if (!this.grid) return;
        
        this.imageData.forEach((imgData, index) => {
            const card = this.createCard(imgData, index);
            this.grid.appendChild(card);
            this.cards.push(card);
        });
        
        // Set images to lightbox
        this.lightbox.setImages(this.imageData);
    }
    
    createCard(imgData, index) {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.setAttribute('role', 'listitem');
        card.setAttribute('data-index', index);
        
        card.innerHTML = `
            <div class="gallery-card-inner">
                <div class="card-glare"></div>
                <div class="card-image-wrapper">
                    <img 
                        class="card-image" 
                        src="${imgData.thumb}" 
                        alt="${imgData.alt}"
                        loading="lazy"
                        decoding="async"
                    >
                </div>
                <div class="card-content">
                    <h3 class="card-title">${imgData.title}</h3>
                    <p class="card-description">${imgData.description}</p>
                </div>
            </div>
        `;
        
        // Add click handler for lightbox
        card.addEventListener('click', () => {
            this.lightbox.open(index);
        });
        
        // Add keyboard handler
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.lightbox.open(index);
            }
        });
        
        // Make card focusable
        card.setAttribute('tabindex', '0');
        
        // Handle image load for smooth transition
        const img = card.querySelector('.card-image');
        img.addEventListener('load', () => {
            img.classList.add('loaded');
        });
        
        return card;
    }
    
    initTiltEffects() {
        if (GalleryUtils.prefersReducedMotion()) return;
        
        this.cards.forEach(card => {
            const tilt = new CardTilt(card, {
                maxTilt: 15,
                perspective: 1000,
                smoothFactor: 0.1
            });
            this.cardTiltInstances.push(tilt);
        });
    }
    
    initScrollAnimations() {
        this.scrollAnimations.init();
        this.scrollAnimations.animateCards(this.cards);
    }
    
    setupGyroButton() {
        // Check if device supports gyro
        if (!GalleryUtils.hasGyroscope()) {
            this.gyroPermissionBtn?.classList.add('hidden');
            return;
        }
        
        // Check if already enabled (session storage)
        if (sessionStorage.getItem('gyroEnabled') === 'true') {
            this.enableGyroForAll();
            return;
        }
        
        // Show button for iOS or devices that need permission
        if (GalleryUtils.needsGyroPermission()) {
            this.gyroPermissionBtn?.addEventListener('click', async () => {
                const granted = await this.requestGyroPermission();
                if (granted) {
                    this.enableGyroForAll();
                    this.gyroPermissionBtn?.classList.add('hidden');
                    sessionStorage.setItem('gyroEnabled', 'true');
                }
            });
        } else if (!GalleryUtils.isTouchDevice()) {
            // Non-touch devices don't need gyro button
            this.gyroPermissionBtn?.classList.add('hidden');
        }
    }
    
    async requestGyroPermission() {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.warn('Gyroscope permission error:', error);
            return false;
        }
    }
    
    enableGyroForAll() {
        this.cardTiltInstances.forEach(tilt => {
            tilt.enableGyroscope();
        });
    }
    
    onResize() {
        this.scrollAnimations.refresh();
    }
    
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.hidden = true;
        }
    }
}

// Initialize gallery when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.gallery = new Gallery();
});
