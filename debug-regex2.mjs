const content = `import GlobalClientModal from './pages/components/GlobalClientModal';`;
// Test simpler pattern first
const r1 = /from\s+['"]/.exec(content);
console.log('from quote match:', r1);

const r2 = /from\s+['"]([^'"]+)['"]/.exec(content);
console.log('full path match:', r2);

// The issue - the quote at the END: the path ends with GlobalClientModal' 
// The closing quote captured by [^'"]* stops before the quote, then we need the component name to follow
// But the path is: './pages/components/GlobalClientModal'
// After the last slash we have: GlobalClientModal
// Then the closing quote '
// So the regex should match: prefix = "./pages/components/", name = "GlobalClientModal", ext = undefined, quote = "'"

// Let's test step by step
const r3 = new RegExp(`(from\s+['"](?:[^'"]*\/)?)(GlobalClientModal)(\.jsx)?(['"])`).exec(content);
console.log('full regex match:', r3);

// Check if the issue is that [^'"]* is greedy and consuming the whole path including GlobalClientModal
// Actually [^'"]* matches any char except quotes, so it will match ./pages/components/
// Then GlobalClientModal is matched by the name group
// Then the quote... but wait, is there an issue with the lookahead after the name?

// Let me try without the non-capturing group
const r4 = /from\s+['"]([^'"]*\/)?GlobalClientModal(\.jsx)?['"]/.exec(content);
console.log('simplified regex match:', r4);
