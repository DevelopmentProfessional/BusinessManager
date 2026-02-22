const content = `import GlobalClientModal from './pages/components/GlobalClientModal';`;
const oldName = 'GlobalClientModal';
const newName = 'Modal_Client';
const regex = new RegExp(
  `(from\s+['"](?:[^'"]*\/)?)(${ oldName })(\.jsx)?(['"])`,
  'g'
);
console.log('Input:', content);
console.log('Match:', content.match(regex));
const result = content.replace(regex, (match, prefix, name, ext, quote) => {
  return `${prefix}${newName}${ext || ''}${quote}`;
});
console.log('Result:', result);
