import fs from 'fs';
import path from 'path';

const renames = [
  ['SignatureModal',          'Modal_Signature'],
  ['GlobalClientModal',       'Modal_Client'],
  ['SalesChartModal',         'Modal_Chart_Sales'],
  ['ScheduleFilterModal',     'Modal_Filter_Schedule'],
  ['CheckoutModal',           'Modal_Checkout_Sales'],
  ['DataImportModal',         'Modal_Import'],
  ['DocumentEditModal',       'Modal_Edit_Document'],
  ['ProductDetailModal',      'Modal_Detail_Product'],
  ['DocumentViewerModal',     'Modal_Viewer_Document'],
  ['ItemDetailModal',         'Modal_Detail_Item'],
  ['ClientForm',              'Form_Client'],
  ['ScheduleForm',            'Form_Schedule'],
  ['ServiceForm',             'Form_Service'],
  ['ItemForm',                'Form_Item'],
  ['EmployeeFormTabs',        'Form_Employee'],
  ['BarcodeScanner',          'Scanner_Barcode'],
  ['CameraCapture',           'Widget_Camera'],
  ['SignaturePad',            'Widget_Signature'],
  ['AttendanceWidget',        'Widget_Attendance'],
  ['ClockInOut',              'Widget_ClockInOut'],
  ['PermissionGate',          'Gate_Permission'],
  ['DarkModeToggle',          'Toggle_DarkMode'],
  ['CustomDropdown',          'Dropdown_Custom'],
  ['IconButton',              'Button_Icon'],
  ['MobileAddButton',         'Button_Add_Mobile'],
  ['CSVImportButton',         'Button_ImportCSV'],
  ['ReportChart',             'Chart_Report'],
  ['ReportFilter',            'Filter_Report'],
  ['Scrollable',              'Container_Scrollable'],
  ['SquareImage',             'Image_Square'],
  ['ActionFooter',            'Footer_Action'],
  ['MobileTable',             'Table_Mobile'],
  ['DatabaseConnectionManager', 'Manager_DatabaseConnection'],
  ['MobileAddressBarManager', 'Manager_MobileAddressBar'],
  ['InstallAppPrompt',        'Prompt_InstallApp'],
  ['OnlyOfficeEditor',        'Editor_OnlyOffice'],
  ['ApiDebugInfo',            'Debug_ApiInfo'],
  ['PermissionDebug',         'Debug_Permission'],
];

function walkDir(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walkDir('frontend/src');
let totalChanges = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  for (const [oldName, newName] of renames) {
    // Use a function to build the regex with a literal pattern to avoid double-escape issues
    // Pattern matches: from './path/OldName' or from './path/OldName.jsx'
    // We split replacement into: find the old name at end of import path, replace with new name
    const escaped = oldName.replace(/[.*+?^${}()|[\]\]/g, '\$&');
    const pattern = `(from\s+['"](?:[^'"]*\/)?)(${escaped})(\.jsx)?(['"])`;
    const regex = new RegExp(pattern, 'g');
    content = content.replace(regex, (match, prefix, name, ext, quote) => {
      return `${prefix}${newName}${ext || ''}${quote}`;
    });
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated: ${file}`);
    totalChanges++;
  }
}

console.log(`\nDone. Updated ${totalChanges} files.`);
