/**
 * Gallery Utils - Utility functions for animations and calculations
 */

const Utils = {
    /**
     * Linear interpolation between two values
     * @param {number} start - Start value
     * @param {number} end - End value  
     * @param {number} factor - Interpolation factor (0-1)
     * @returns {number}
     */
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    },
    
    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number}
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    /**
     * Map a value from one range to another
     * @param {number} value - Input value
     * @param {number} inMin - Input range minimum
     * @param {number} inMax - Input range maximum
     * @param {number} outMin - Output range minimum
     * @param {number} outMax - Output range maximum
     * @returns {number}
     */
    mapRange(value, inMin, inMax, outMin, outMax) {
        const clamped = this.clamp(value, inMin, inMax);
        return ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    },
    
    /**
     * Check if device supports touch events
     * @returns {boolean}
     */
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },
    
    /**
     * Check if device has gyroscope support
     * @returns {boolean}
     */
    hasGyroscope() {
        return 'DeviceOrientationEvent' in window;
    },
    
    /**
     * Check if iOS 13+ (needs permission request)
     * @returns {boolean}
     */
    needsGyroPermission() {
        return typeof DeviceOrientationEvent !== 'undefined' && 
               typeof DeviceOrientationEvent.requestPermission === 'function';
    },
    
    /**
     * Check if user prefers reduced motion
     * @returns {boolean}
     */
    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    
    /**
     * Debounce function
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function}
     */
    debounce(fn, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    },
    
    /**
     * Throttle function
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Limit in milliseconds
     * @returns {Function}
     */
    throttle(fn, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * Get relative position from center (-1 to 1)
     * @param {number} mouseX - Mouse X position
     * @param {number} mouseY - Mouse Y position
     * @param {HTMLElement} element - Target element
     * @returns {Object} { x, y }
     */
    getRelativePosition(mouseX, mouseY, element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        return {
            x: (mouseX - centerX) / (rect.width / 2),
            y: (mouseY - centerY) / (rect.height / 2)
        };
    },
    
    /**
     * Generate unique ID
     * @returns {string}
     */
    generateId() {
        return 'gallery-' + Math.random().toString(36).substr(2, 9);
    },
    
    /**
     * Preload image
     * @param {string} src - Image source
     * @returns {Promise}
     */
    preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },
    
    /**
     * Check if element is in viewport
     * @param {HTMLElement} element - Element to check
     * @param {number} threshold - Threshold percentage
     * @returns {boolean}
     */
    isInViewport(element, threshold = 0) {
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        
        const vertInView = (rect.top <= windowHeight * (1 - threshold)) && 
                          ((rect.top + rect.height) >= windowHeight * threshold);
        const horInView = (rect.left <= windowWidth * (1 - threshold)) && 
                         ((rect.left + rect.width) >= windowWidth * threshold);
        
        return vertInView && horInView;
    },
    
    /**
     * Get CSS custom property value
     * @param {string} property - Property name
     * @returns {string}
     */
    getCSSVariable(property) {
        return getComputedStyle(document.documentElement).getPropertyValue(property).trim();
    },
    
    /**
     * Parse CSS variable to number
     * @param {string} property - Property name
     * @returns {number}
     */
    parseCSSToNumber(property) {
        const value = this.getCSSVariable(property);
        return parseFloat(value) || 0;
    }
};

// Make available globally
window.GalleryUtils = Utils;
