// First we will begin by mapping possible header spellings to our column names.
// It makes it work better with most real-world spreadsheets without changes
const HEADER_MAP = {
    'name':'name', 'product':'name', 'product name':'name', 'item':'name',
    'category':'category', 'type':'category',
    'quantity':'quantity', 'qty':'quantity', 'stock':'quantity',
    'entry price':'entry_price', 'entry_price':'entry_price',
    'buying price':'entry_price', 'cost price':'entry_price', 'cost':'entry_price',
    'retail price':'retail_price', 'retail_price':'retail_price',
    'selling price':'retail_price', 'price':'retail_price',
};

// Converts a CSV string into an Array of product objects
// Returns { products: [...], skipped: N }
function csvToProducts(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2 ) return { products: [], skipped:0};

    // first Line is the header row
    const header = lines[0].split(',').map(h => h.trim() .toLowerCase());
    const cols = header.map(h => HEADER_MAP[h] || null);

    if(!cols.includes('name')) {
        throw new Error('CSV must have a "name" or "product" column.');
    }

    const products = [];
    let skipped = 0;

    // Process each data row (skip the header)
    for (const line of  lines.slice(1)){
        const values = line.split(',').map(v => v.trim());
        const p = {};

        cols.forEach((col, i) => {
            if (col) p[col] = values[i] || null;
        });
        // skip rows with no name
        if (!p.name) { skipped++; continue; }

        products.push({
            name: p.name,
            category:   p.category || null,
            quantity:   parseInt(String(p.quantity || 0).replace(/,/g, ''), 10) || 0,
            entry_price:    p.entry_price ? parseFloat(String(p.entry_price).replace(/,/g, '')) : null,
            retail_price:   p.retail_price ? parseFloat(String(p.retail_price).replace(/,/g, '')) : null,
        });
    }

    return { products, skipped };

}

module.exports = { csvToProducts };