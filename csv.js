// First we will begin by mapping possible header spellings to our column names.
// It makes it work better with most real-world spreadsheets without changes
const HEADER_MAP = {
    'name':'name', 'product':'name', 'product name':'name', 'item':'name',
    'category':'category', 'type':'category',
    'quantity':'quantity', 'qty':'quantity', 'stock':'quantity',
    'entry price':'entry_price', 'entry_price':'entry_price',
    'buying price':'entry_price', 'cost price':'entry_price', 'cost':'entry_price',
    
};

// Converts a CSV string into an Array of product objects
// Returns { products: [...], skipped: N }
function toNum(val) {
  if (val == null || val === '') return null;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function csvToProducts(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2 ) return { products: [], skipped:0};

    // first Line is the header row
    // Parse header row and map known headers
    // Remove possible UTF-8 BOM from first line
    if (lines[0].charCodeAt(0) === 0xFEFF) {
        lines[0] = lines[0].slice(1);
    }
    // Determine delimiter (comma or semicolon) based on header line
    const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
    // Parse header row and map known headers
    let header = lines[0].split(delimiter).map(h => h.trim().replace(/^"(.*)"$/, '$1').toLowerCase());
let cols = header.map(h => HEADER_MAP[h] || null);
    // If no explicit 'name' column, try to infer from any header containing the word "name"
    if (!cols.includes('name')) {
        const nameIdx = header.findIndex(h => h.includes('name'));
        if (nameIdx !== -1) {
            cols[nameIdx] = 'name';
        }
    }
    // After inference, ensure a name column exists
    if (!cols.includes('name')) {
        throw new Error('CSV must have a "name" or "product" column.');
    }

    const products = [];
    let skipped = 0;

    // Process each data row (skip the header)
    for (const line of lines.slice(1)) {
    // Split on the delimiter but ignore commas inside quoted fields
    const values = line.split(new RegExp(`\\${delimiter}(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)`)).map(v => {
        v = v.trim();
        // Remove surrounding quotes if present
        if (v.startsWith('"') && v.endsWith('"')) {
            v = v.slice(1, -1);
        }
        return v;
    });
    const p = {};

        cols.forEach((col, i) => {
            if (col) p[col] = values[i] || null;
        });
        // skip rows with no name
        if (!p.name) { skipped++; continue; }

        products.push({
            name: p.name,
            category:   p.category || null,
            quantity:   toNum(p.quantity) ?? 0,
            entry_price:    toNum(p.entry_price) ?? 0,
            // retail_price:   toNum(p.retail_price) ?? 0,
        });
    }

    return { products, skipped };

}

module.exports = { csvToProducts };