const crypto = require('crypto');
const {requireAdmin, requireAccess } = require('./auth');
const multer    =require('multer');
const { csvToProducts } = require('./csv');
const upload = multer({ storage: multer.memoryStorage()});
const express = require('express');
const router = express.Router();// this is a mini app that hold just the routes
const {pool: db } = require('./db');

// =========================================================================
// GET /api/products?search=pipe
// Returns products matching the search term
// If no search term, returns up to 500products
// ===================================================================================
router.get('/products', requireAccess, async (req, res) => {
    try{
        // req.query holds anything after ? in the URL.
        // e.g / products?search= pipe -> req.query.search = 'pipe'
        const search = (req.query.search || '').trim();

        let rows;

        if (search) {
            // LIKE %PIPE% matches any name containing 'pipe' anywhere.
            // the ? is a placeholder - we never put user input directly 
            // unto sql (that could allow sql injection)
            const like = `%${search}%`;
            [rows] = await db.query(
                `SELECT id, name, category, quantity, entry_price, retail_price, updated_at
                FROM products
                WHERE is_deleted = FALSE
                    AND (name LIKE ? OR category LIKE ?)
                ORDER BY name
                LIMIT 200`
                [like, like]
            );
        } else {
            [rows] = await db.query(
                `SELECT id, name, category, quantity, entry_price, retail_price, updated_at
                FROM products
                WHERE is_deleted = FALSE
                ORDER BY name
                LIMIT 500`
            );
        }
        res.json({ products: rows});
    } catch (err){
        res.status(500).json({ error: err.message});
    }
});


// GET /api/changes?since=2026-07-13t16:15:00
// The sync endpoint . returns every row that changed after since
// Includes deleted rows - is_deleted = TRUE travels as a normal change
// Returns severTime so the phone can save the SERVER's clock , not its own
router. get('/changes', requireAccess, async (req, res) => {
    try {
        const since = req.query.since || '1970-01-01 00:00:00';

        const [rows] = await db.query(
            `SELECT id, name, category, quantity, entry_price, retail_price,
                is_deleted, updated_at
            FROM products
            WHERE updated_at > ?
            ORDER BY updated_at ASC`,
            [since]
        );
        // NOW(3) = current server time with millisecond precision.
        // The phone saves this as its "last synced" bookmark.
        const [[{ now }]] = await db.query('SELECT NOW(3) AS now');

        res.json({ changes: rows, serverTime: now });
    } catch (err){
        res.status(500).json({ error: err.message });
    }
});

// GET /api/share-links — list all share links (admin only)
router.get('/share-links', requireAdmin, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM share_links ORDER BY created_at DESC');
    res.json(rows);
});


// ==================================
// POST / api/products  -> ADDS one product 
//=====================================
router.post('/products',requireAdmin, async (req, res) => {
    try {
        const {name, category, quantity, entry_price, retail_price} = req.body;
        // A pro duct must have a name - reject if missing
        if (!name || !String(name).trim()){
            return res.status(400).json({error: 'Product name is required.'});
        }

        const [result] = await db.query(
            'INSERT INTO products (name, category, quantity, entry_price, retail_price) VALUES (?, ?, ?, ?, ?)',
            [String(name).trim(), category || null, quantity || 0, entry_price ?? null, retail_price ?? null]
        );
        // result.inserted is the id MYsql assigned to the new row.
        res.status(201).json({id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// PUT /api/products/:id -> edits of products
router.put('/products/:id', requireAdmin, async (req, res) => {
    try{
        const allowed = ['name', 'category', 'quantity', 'entry_price', 'retail_price'];
        const sets = [];
        const params =[];

        // A set is only built for fields that were actually sent
        // it helps one to edit just the price without changing the name
        for (const field of allowed) {
            if (field in req.body) {
                sets.push(`${field} = ?`);
                params.push(req.body[field]);
            }
        }
        if (sets.length === 0) {
            return res.status(400).json({ error: 'Nothing to update.'});
        }

        params.push(req.params.id);// id from the URL

        const [result] =  await db.query(
            `UPDATE products SET ${sets.join(', ')} WHERE id= ? AND is_deleted = FALSE`,
            params
        );

        if (result. affectedRows === 0) {
            return res.status(404).json({error: 'Product not found.'});
        }

        res.json({ updated:true });
    }   catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/products/:id
// Soft delete: flips is_deleted to TRUE instead of removing the row entirely
// the HTTP method is DELETE, but the SQL is UPDATE - different layers
router.delete('/products/:id',requireAdmin, async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE products SET is_deleted = TRUE WHERE id = ? AND is_deleted = FALSE',
            [req.params.id]
        );

        if (result.affectedRows ===0) {
            return res.status(404).json({ error: 'Product not found.'});
        }

        res.json({ deleted: true});

    } catch(err) {
        res.status(500).json({ error: err,message });
    }
});

// DELETE /api/share-links/:token — revoke a link
router.delete('/share-links/:token', requireAdmin, async (req, res) => {
    await db.query('UPDATE share_links SET is_revoked = TRUE WHERE token = ?', [req.params.token]);
    res.json({ ok: true });
});

//Restore a soft-delete product
router.post('/products/:id/restore',requireAdmin, async (req, res) => {
    try{
        const [result] = await db.query(
            'UPDATE products SET is_deleted = FALSE WHERE id = ? AND is_deleted = TRUE',
            [req.params.id]
        );
        if (result. affectedRows === 0) {
            return res.status(404).json({ error: 'Nothing to restore.'});
        }
        res.json({ restored: true });
    }catch (err) {
        res.status(500).json({ error: err.message});
    }
});

// POST /api/products/upload
// accepts a csv file in a form field called file 
router.post ('/products/upload', upload.single('file'), requireAdmin, async (req, res) => {
    try {
        if(!req.file) {
            return res.status(400).json({ error: 'No file uploaded. Field name must be "file".'});
        }

        const text = req.file.buffer.toString('utf8');
        const { products, skipped } = csvToProducts(text);

        if (products.length === 0) {
            return res.status(400).json({ error: 'No valid products found in the file.'});
        }

        const values = products.map(p => 
            [p.name, p.category, p.quantity, p.entry_price, p.retail_price]
        );
        await db.query(
            'INSERT INTO products (name, category, quantity, entry_price, retail_price) VALUES ?',
            [values]
        );

        res.json({ inserted: products.length, skipped });

    } catch (err) {
        res.status(400).json({ error: err.message});
    }
});

// CREATE a new share Link
router.post('/share-links', requireAdmin, async (req, res) => {
    try {
        // Generate a 16 random bytes, convert to hex = 32 characters.
        // Cryptographically random -practically impossible to guess.
        const token = crypto.randomBytes(16).toString('hex');
        await db.query(
            'INSERT INTO share_links (token, label) VALUES (?,?)',
            [token, (req.body && req.body.label) || null]
        );
        res.status(201).json({ token });
    }catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List all share links
router.get('/share', requireAdmin, async (req,res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, token, label, is_revoked, created_at FROM share_links ORDER BY created_at DESC'
        );
        res.json({ links: rows });
    }catch (err) {
        res.status(500).json({ error: err.message});
    }
});
// Revoke a share link (blocks that token from working)
router.delete('/share/:id', requireAdmin,async (req, res) => {
    try {
        await db.query('UPDATE share_links SET is_revoked = TRUE WHERE id = ?', [req.params.id]);
        res.json({ revoked: true });
    }catch (err) {
        res.status(500).json({ error: err.message});
    }
});

// Export the router so server.js can use it
module.exports = router;