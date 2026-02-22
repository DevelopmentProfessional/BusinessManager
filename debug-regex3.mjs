const content = `import GlobalClientModal from './pages/components/GlobalClientModal';`;
const oldName = 'GlobalClientModal';

// Original regex from the script
const regexOrig = new RegExp(
  `(from\s+['"](?:[^'"]*\/)?)(${ oldName })(\.jsx)?(['"])`,
  'g'
);
console.log('Original regex source:', regexOrig.source);
console.log('Original match:', regexOrig.exec(content));

// Fixed regex - the issue might be something subtle, let me just print what the regex actually is
// from\s+['"](?:[^'"]*\/)?  -- this should match "from '.../components/"
// But [^'"]* won't match the ' in the opening quote... wait, the opening quote IS matched by ['"]
// THEN [^'"]* matches the path chars (no quotes), then \/ matches the slash
// That should be fine...

// Let me try with the actual character by character breakdown:
// from\s+   matches "from "
// ['"]      matches "'"  (opening quote)
// (?:       non-capturing group
//   [^'"]*  matches "./pages/components"  (all non-quote chars)
//   \/      matches "/"   -- Wait! This requires the path to CONTAIN a slash before the component name
//           But the component name IS at the end after the last slash
//           So [^'"]* matches "./pages/components" and \/ matches "/"
//           Then GlobalClientModal is matched
//           Then \.jsx is optional
//           Then ['"] should match "'"
// )?        optional - but if it doesn't match, then GlobalClientModal would need to be right after the opening quote

// This looks correct... let me check if maybe the issue is something else
// Let me try without the 'g' flag
const regexNoG = new RegExp(
  `(from\s+['"](?:[^'"]*\/)?)(${ oldName })(\.jsx)?(['"])`
);
console.log('No-g match:', regexNoG.exec(content));

// Try with a literal regex
const regexLiteral = /(from\s+['"](?:[^'"]*\/)?)GlobalClientModal(\.jsx)?(['"])/;
console.log('Literal regex match:', regexLiteral.exec(content));
