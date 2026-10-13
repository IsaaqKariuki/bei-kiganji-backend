const { pool: db } = require('./db');
// check for incoming requests if they have a valid admin key
function isAdmin(req) {
    // tHe admin key can arrive in a header called x-admin key or as a URL parameter
    const key = req.headers['x-admin-key'] || req.query.adminKey;
    return Boolean(process.env.ADMIN_KEY) && key === process.env.ADMIN_KEY;
}

// Middleware: only admin key holders get through
// middleware is a function that runs BEFORE your route handler.
// Call next() to continue, or send an error to stop
function requireAdmin(req, res, next) {
    if (isAdmin(req)) return next ();
    return res.status(401).json({ error: 'Hello There An Admin Key is Required.'});
}

// Middleware: admin key OR a valid non-revoked share token.
// This protects read routes: anyone with a share token can search.
async function requireAccess(req, res, next) {
    if (isAdmin(req)) return next();

    const token = req.query.token || req.headers['x-share-token'];
    if (!token) return res.status(401).json({ error:'Access token required.'});

    try {
        const [rows] = await db.query(
            'SELECT id FROM share_links WHERE token = ? AND is_revoked = FALSE',
            [token]
        );

        if(rows.length === 0) {
            return res.status(403).json({ error: 'Invalid or revoked link.'});
        }
        return next();// valid token - let them through
    } catch(err) {
        return res.status(500).json({ error:err.message });
    }
}

module.exports = { requireAdmin, requireAccess};