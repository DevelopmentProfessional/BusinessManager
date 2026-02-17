/**
 * Swipe-based Calendar Navigation Utility
 * 
 * This module provides touch-gesture navigation for mobile web calendar applications.
 * Supports month, week, and day views with horizontal swipe detection.
 * 
 * Features:
 * - Touch Events API for gesture detection
 * - Configurable swipe distance threshold
 * - Date bounds validation (1900-2100)
 * - Cooldown period to prevent rapid swipes
 * - Visual feedback during swipe
 * - Smooth CSS transitions
 * - Handles edge cases (month boundaries, invalid dates)
 * 
 * Usage:
 * const swipeHandler = new SwipeCalendarNavigation({
 *   containerElement: document.getElementById('calendar-container'),
 *   currentDate: new Date(),
 *   currentView: 'month', // 'month', 'week', or 'day'
 *   onNavigate: (newDate) => { updateCalendar(newDate); },
 *   onSwipeStart: () => { console.log('Swipe started'); },
 *   onSwipeProgress: (offset) => { applyVisualFeedback(offset); },
 *   onSwipeEnd: () => { clearVisualFeedback(); }
 * });
 */

export class SwipeCalendarNavigation {
  constructor(config = {}) {
    // Configuration
    this.containerElement = config.containerElement;
    this.currentDate = config.currentDate || new Date();
    this.currentView = config.currentView || 'month'; // 'month', 'week', 'day'
    this.onNavigate = config.onNavigate || (() => {});
    this.onSwipeStart = config.onSwipeStart || (() => {});
    this.onSwipeProgress = config.onSwipeProgress || (() => {});
    this.onSwipeEnd = config.onSwipeEnd || (() => {});
    
    // Gesture thresholds
    this.MIN_SWIPE_DISTANCE = config.minSwipeDistance || 50; // pixels
    this.MAX_SWIPE_DURATION = config.maxSwipeDuration || 500; // milliseconds
    this.SWIPE_COOLDOWN = config.swipeCooldown || 300; // milliseconds
    
    // Date bounds
    this.MIN_DATE = config.minDate || new Date(1900, 0, 1);
    this.MAX_DATE = config.maxDate || new Date(2100, 11, 31);
    
    // Touch tracking state
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.lastSwipeTime = 0;
    this.isTracking = false;
    
    // Bind methods
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    
    // Initialize
    this.attach();
  }
  
  /**
   * Attach event listeners to the container element
   */
  attach() {
    if (!this.containerElement) {
      console.error('SwipeCalendarNavigation: No container element provided');
      return;
    }
    
    // Add touch event listeners
    // Use passive: false for touchmove to allow preventDefault if needed
    this.containerElement.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.containerElement.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    this.containerElement.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    
    // Prevent text selection during swipe
    this.containerElement.style.userSelect = 'none';
    this.containerElement.style.webkitUserSelect = 'none';
    
    // Allow vertical pan but enable horizontal swipe detection
    this.containerElement.style.touchAction = 'pan-y';
  }
  
  /**
   * Remove event listeners (cleanup)
   */
  detach() {
    if (!this.containerElement) return;
    
    this.containerElement.removeEventListener('touchstart', this.handleTouchStart);
    this.containerElement.removeEventListener('touchmove', this.handleTouchMove);
    this.containerElement.removeEventListener('touchend', this.handleTouchEnd);
  }
  
  /**
   * Handle touch start event
   */
  handleTouchStart(event) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.touchStartTime = Date.now();
    this.isTracking = true;
    
    this.onSwipeStart();
  }
  
  /**
   * Handle touch move event (for visual feedback)
   */
  handleTouchMove(event) {
    if (!this.isTracking) return;
    
    const currentX = event.touches[0].clientX;
    const currentY = event.touches[0].clientY;
    const deltaX = currentX - this.touchStartX;
    const deltaY = currentY - this.touchStartY;
    
    // Only show feedback for horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Constrain offset for subtle visual feedback
      const maxOffset = 100;
      const constrainedOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaX * 0.3));
      this.onSwipeProgress(constrainedOffset);
    }
  }
  
  /**
   * Handle touch end event (detect and execute swipe)
   */
  handleTouchEnd(event) {
    if (!this.isTracking) return;
    
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    
    const distanceX = this.touchStartX - touchEndX;
    const distanceY = this.touchStartY - touchEndY;
    const swipeDuration = touchEndTime - this.touchStartTime;
    const timeSinceLastSwipe = touchEndTime - this.lastSwipeTime;
    
    // Reset tracking
    this.isTracking = false;
    this.onSwipeEnd();
    
    // Validate swipe conditions
    // 1. Must be primarily horizontal
    if (Math.abs(distanceY) > Math.abs(distanceX)) {
      return; // Vertical scroll, not horizontal swipe
    }
    
    // 2. Must exceed minimum distance
    if (Math.abs(distanceX) < this.MIN_SWIPE_DISTANCE) {
      return; // Swipe too short
    }
    
    // 3. Must be reasonably fast
    if (swipeDuration > this.MAX_SWIPE_DURATION) {
      return; // Swipe too slow (likely a drag)
    }
    
    // 4. Must respect cooldown period
    if (timeSinceLastSwipe < this.SWIPE_COOLDOWN) {
      return; // Too soon after last swipe
    }
    
    // Determine direction and navigate
    if (distanceX > 0) {
      // Swiped left (finger moved right to left) → go forward
      this.navigateNext();
    } else {
      // Swiped right (finger moved left to right) → go backward
      this.navigatePrevious();
    }
    
    this.lastSwipeTime = touchEndTime;
  }
  
  /**
   * Navigate to previous period (month, week, or day)
   */
  navigatePrevious() {
    const newDate = new Date(this.currentDate);
    
    switch (this.currentView) {
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
        
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
        
      case 'month':
      default:
        // Navigate to previous month
        const currentDay = newDate.getDate();
        newDate.setMonth(newDate.getMonth() - 1);
        
        // Handle edge case: If current day doesn't exist in previous month
        // (e.g., March 31 → February 31 doesn't exist)
        // Set to last valid day of that month
        const maxDayInNewMonth = new Date(
          newDate.getFullYear(),
          newDate.getMonth() + 1,
          0
        ).getDate();
        
        if (currentDay > maxDayInNewMonth) {
          newDate.setDate(maxDayInNewMonth);
        }
        break;
    }
    
    // Validate date bounds
    if (newDate < this.MIN_DATE) {
      console.warn('Cannot navigate before', this.MIN_DATE.toLocaleDateString());
      return;
    }
    
    this.currentDate = newDate;
    this.onNavigate(newDate);
  }
  
  /**
   * Navigate to next period (month, week, or day)
   */
  navigateNext() {
    const newDate = new Date(this.currentDate);
    
    switch (this.currentView) {
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
        
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
        
      case 'month':
      default:
        // Navigate to next month
        const currentDay = newDate.getDate();
        newDate.setMonth(newDate.getMonth() + 1);
        
        // Handle edge case: If current day doesn't exist in next month
        // (e.g., January 31 → February 31 doesn't exist)
        // Set to last valid day of that month
        const maxDayInNewMonth = new Date(
          newDate.getFullYear(),
          newDate.getMonth() + 1,
          0
        ).getDate();
        
        if (currentDay > maxDayInNewMonth) {
          newDate.setDate(maxDayInNewMonth);
        }
        break;
    }
    
    // Validate date bounds
    if (newDate > this.MAX_DATE) {
      console.warn('Cannot navigate beyond', this.MAX_DATE.toLocaleDateString());
      return;
    }
    
    this.currentDate = newDate;
    this.onNavigate(newDate);
  }
  
  /**
   * Update the current date (call this when date changes externally)
   */
  setCurrentDate(date) {
    this.currentDate = new Date(date);
  }
  
  /**
   * Update the current view (call this when view changes)
   */
  setCurrentView(view) {
    if (['month', 'week', 'day'].includes(view)) {
      this.currentView = view;
    }
  }
}

/**
 * Simple usage example (vanilla JavaScript)
 */
export function initializeSwipeNavigation() {
  const calendarContainer = document.getElementById('calendar-container');
  const monthYearDisplay = document.getElementById('month-year-display');
  
  let currentDate = new Date();
  let currentView = 'month';
  
  const swipeHandler = new SwipeCalendarNavigation({
    containerElement: calendarContainer,
    currentDate: currentDate,
    currentView: currentView,
    
    // Called when navigation occurs
    onNavigate: (newDate) => {
      currentDate = newDate;
      updateCalendarDisplay(newDate);
      updateMonthYearHeader(newDate);
      loadEventsForDate(newDate);
    },
    
    // Optional: Visual feedback during swipe
    onSwipeProgress: (offset) => {
      calendarContainer.style.transform = `translateX(${offset}px)`;
    },
    
    // Optional: Reset visual feedback
    onSwipeEnd: () => {
      calendarContainer.style.transition = 'transform 0.3s ease-out';
      calendarContainer.style.transform = 'translateX(0)';
      setTimeout(() => {
        calendarContainer.style.transition = '';
      }, 300);
    }
  });
  
  // Clean up when page unloads
  window.addEventListener('beforeunload', () => {
    swipeHandler.detach();
  });
  
  return swipeHandler;
}

/**
 * Helper: Update calendar display (implement based on your UI)
 */
function updateCalendarDisplay(date) {
  console.log('Update calendar for', date.toLocaleDateString());
  // Implement your calendar rendering logic here
}

/**
 * Helper: Update month/year header
 */
function updateMonthYearHeader(date) {
  const monthYearDisplay = document.getElementById('month-year-display');
  if (monthYearDisplay) {
    monthYearDisplay.textContent = date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }
}

/**
 * Helper: Load events for the new date range
 */
function loadEventsForDate(date) {
  console.log('Load events for', date.toLocaleDateString());
  // Implement your API call or data loading here
  // Example:
  // fetch(`/api/events?date=${date.toISOString()}`)
  //   .then(res => res.json())
  //   .then(events => renderEvents(events));
}

export default SwipeCalendarNavigation;
