const fs = require('fs');
let code = fs.readFileSync('src/components/gst-reconciliation/ReconciliationTable.tsx', 'utf8');

code = code.replace(
  `import { List, type ListImperativeAPI } from 'react-window';`,
  `import { FixedSizeList as List } from 'react-window';`
);

code = code.replace(
  `const [, setListRef] = useState<ListImperativeAPI | null>(null);`,
  `const [, setListRef] = useState<any>(null);`
);

// We also need to fix `rowComponent={Row}` which is not valid for FixedSizeList
// FixedSizeList takes `children={Row}` and `itemCount={rowCount}` and `itemSize={rowHeight}` and `itemData={rowProps}`
code = code.replace(
  `rowComponent={Row}`,
  `children={Row}`
);

code = code.replace(
  `rowCount={rowCount}`,
  `itemCount={rowCount}`
);

code = code.replace(
  `rowHeight={ROW_HEIGHT}`,
  `itemSize={ROW_HEIGHT}`
);

code = code.replace(
  `rowProps={rowProps}`,
  `itemData={rowProps}`
);

fs.writeFileSync('src/components/gst-reconciliation/ReconciliationTable.tsx', code, 'utf8');
console.log('Fixed react-window');
