// Calendar Debug Script
// Run this in browser console to diagnose calendar rendering issues

export function debugCalendar() {
  console.log('🔍 CALENDAR DEBUG STARTING...');
  
  // Check if calendar exists
  const calendar = document.querySelector('.rbc-calendar');
  if (!calendar) {
    console.error('❌ No .rbc-calendar found!');
    return;
  }
  console.log('✅ Calendar found:', calendar);
  
  // Check month view
  const monthView = document.querySelector('.rbc-month-view');
  if (monthView) {
    console.log('✅ Month view found');
    
    // Check rows
    const rows = monthView.querySelectorAll('.rbc-row');
    console.log(`📊 Found ${rows.length} rows`);
    
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('*');
      console.log(`Row ${index + 1}: ${cells.length} elements`);
      
      // Check for Sunday cells
      const sundayCells = Array.from(cells).filter((cell, i) => (i + 1) % 7 === 0);
      if (sundayCells.length > 0) {
        console.warn(`⚠️ Row ${index + 1} has ${sundayCells.length} Sunday cells:`, sundayCells);
      }
      
      // Check specific cell types
      const dayBgCells = row.querySelectorAll('.rbc-day-bg');
      const dateCells = row.querySelectorAll('.rbc-date-cell');
      const rowBgCells = row.querySelectorAll('.rbc-row-bg');
      
      console.log(`  - rbc-day-bg: ${dayBgCells.length}`);
      console.log(`  - rbc-date-cell: ${dateCells.length}`);
      console.log(`  - rbc-row-bg: ${rowBgCells.length}`);
    });
    
    // Check header
    const header = monthView.querySelector('.rbc-header');
    if (header) {
      const headerCells = header.querySelectorAll('*');
      console.log(`📅 Header has ${headerCells.length} cells:`, Array.from(headerCells).map(cell => cell.textContent));
    }
  }
  
  // Check week view
  const weekView = document.querySelector('.rbc-time-view');
  if (weekView) {
    console.log('✅ Week view found');
    
    // Check headers
    const headers = weekView.querySelectorAll('.rbc-header, .rbc-time-header, .rbc-time-header-content');
    headers.forEach((header, index) => {
      const cells = header.querySelectorAll('*');
      console.log(`Week header ${index + 1}: ${cells.length} cells:`, Array.from(cells).map(cell => cell.textContent));
    });
  }
  
  // Check for Sunday elements
  const allElements = document.querySelectorAll('.rbc-month-view *, .rbc-time-view *');
  const sundayElements = Array.from(allElements).filter((el, i) => (i + 1) % 7 === 0);
  console.log(`🔍 Found ${sundayElements.length} potential Sunday elements`);
  
  // Check CSS computed styles
  const testCell = document.querySelector('.rbc-day-bg, .rbc-date-cell');
  if (testCell) {
    const styles = window.getComputedStyle(testCell);
    console.log('📏 Cell computed styles:', {
      display: styles.display,
      width: styles.width,
      height: styles.height,
      padding: styles.padding,
      margin: styles.margin,
      visibility: styles.visibility,
      opacity: styles.opacity
    });
  }
  
  // Check grid layout
  const gridContainer = document.querySelector('.rbc-month-view .rbc-row, .rbc-time-view .rbc-header');
  if (gridContainer) {
    const styles = window.getComputedStyle(gridContainer);
    console.log('🔲 Grid layout:', {
      display: styles.display,
      gridTemplateColumns: styles.gridTemplateColumns,
      gap: styles.gap
    });
  }
  
  console.log('🔍 CALENDAR DEBUG COMPLETE');
}

// Auto-run when imported
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(debugCalendar, 1000); // Wait for calendar to render
    });
  } else {
    setTimeout(debugCalendar, 1000);
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.debugCalendar = debugCalendar;
}
