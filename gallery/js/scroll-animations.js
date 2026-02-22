/**
 * Scroll Animations - GSAP ScrollTrigger for Gallery Cards
 */

class ScrollAnimations {
    constructor() {
        this.cards = [];
        this.gsap = window.gsap;
        this.ScrollTrigger = window.ScrollTrigger;
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        
        if (!this.gsap || !this.ScrollTrigger) {
            console.warn('GSAP or ScrollTrigger not available');
            return;
        }
        
        // Register ScrollTrigger
        this.gsap.registerPlugin(this.ScrollTrigger);
        
        this.initialized = true;
    }
    
    animateCards(cards) {
        if (!this.initialized) this.init();
        if (GalleryUtils.prefersReducedMotion()) {
            this.animateReducedMotion(cards);
            return;
        }
        
        this.cards = cards;
        
        // Header text animation
        this.animateHeader();
        
        // Card stagger animation
        this.animateCardEntrance();
        
        // Parallax effect on images
        this.animateParallax();
    }
    
    animateHeader() {
        const title = document.querySelector('.gallery-title');
        const subtitle = document.querySelector('.gallery-subtitle');
        
        if (!title) return;
        
        // Split text into words for animation
        const words = title.querySelectorAll('.title-word');
        
        if (words.length > 0) {
            this.gsap.fromTo(words, 
                { 
                    y: 60, 
                    opacity: 0,
                    rotateX: -40
                },
                {
                    y: 0,
                    opacity: 1,
                    rotateX: 0,
                    duration: 0.8,
                    stagger: 0.15,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: title,
                        start: 'top 80%',
                        toggleActions: 'play none none reverse'
                    }
                }
            );
        }
        
        if (subtitle) {
            this.gsap.fromTo(subtitle,
                { y: 20, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.6,
                    delay: 0.4,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: subtitle,
                        start: 'top 90%',
                        toggleActions: 'play none none reverse'
                    }
                }
            );
        }
    }
    
    animateCardEntrance() {
        if (!this.cards.length) return;
        
        this.gsap.fromTo(this.cards,
            {
                y: 80,
                opacity: 0,
                rotateX: 15,
                scale: 0.95
            },
            {
                y: 0,
                opacity: 1,
                rotateX: 0,
                scale: 1,
                duration: 0.7,
                stagger: 0.1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: '#galleryGrid',
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                }
            }
        );
    }
    
    animateParallax() {
        // Parallax effect on card images
        this.cards.forEach(card => {
            const image = card.querySelector('.card-image');
            if (!image) return;
            
            this.gsap.fromTo(image,
                { yPercent: -10 },
                {
                    yPercent: 10,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: card,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: true
                    }
                }
            );
        });
    }
    
    animateReducedMotion(cards) {
        // Simple fade in without animations
        cards.forEach(card => {
            card.style.opacity = '1';
            card.style.transform = 'none';
        });
        
        const title = document.querySelector('.gallery-title');
        const subtitle = document.querySelector('.gallery-subtitle');
        
        if (title) title.style.opacity = '1';
        if (subtitle) subtitle.style.opacity = '1';
    }
    
    refresh() {
        if (this.ScrollTrigger) {
            this.ScrollTrigger.refresh();
        }
    }
    
    kill() {
        if (this.ScrollTrigger) {
            this.ScrollTrigger.getAll().forEach(trigger => trigger.kill());
        }
    }
}

// Make available globally
window.ScrollAnimations = ScrollAnimations;
