import { Router, Request, Response } from 'express';
import {
  queryAll,
  queryOne,
  run,
  generateSlipText,
  exportDatabaseBackup,
  restoreDatabaseBackup,
  hashPassword,
  verifyPassword,
} from './db.js';
import {
  createToken,
  authMiddleware,
  checkLoginRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin,
} from './auth.js';

export const apiRouter = Router();

// Audit logging helper
function logAudit(
  req: Request,
  action: string,
  target_type: string,
  target_id: string | number | null = null,
  details: string = ''
) {
  const admin = (req as any).admin;
  const adminName = admin?.username || 'System';
  const adminId = admin?.adminId || null;
  const ip = req.ip || req.socket.remoteAddress || '';

  run(
    'INSERT INTO audit_logs (admin_id, admin_name, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [adminId, adminName, action, target_type, target_id ? String(target_id) : null, details, ip]
  );
}

// ----------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------

apiRouter.post('/auth/login', (req: Request, res: Response): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: `Too many failed login attempts. Please wait ${rateLimit.waitSeconds} seconds before trying again.`,
    });
    return;
  }

  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const cleanUser = String(username).trim();
  const cleanPass = String(password).trim();

  // Check database admin
  const admin = queryOne('SELECT * FROM admins WHERE username = ? OR username = ?', [
    cleanUser,
    cleanUser.toLowerCase(),
  ]);

  let isValid = false;

  if (admin) {
    isValid = verifyPassword(cleanPass, admin.password_hash, admin.salt);
  }

  // Backup admin password check if configured
  if (!isValid && process.env.BACKUP_ADMIN_PASSWORD && process.env.BACKUP_ADMIN_PASSWORD !== '<SET_IN_SECURE_CONFIG>') {
    if (cleanPass === process.env.BACKUP_ADMIN_PASSWORD) {
      isValid = true;
    }
  }

  if (!isValid) {
    recordFailedLogin(ip);
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  recordSuccessfulLogin(ip);

  const adminId = admin ? admin.id : 1;
  const adminUsername = admin ? admin.username : cleanUser;
  const adminRole = admin ? admin.role : 'Admin';

  const token = createToken({
    adminId,
    username: adminUsername,
    role: adminRole,
  });

  logAudit(req, 'LOGIN', 'ADMIN', adminId, `Admin logged in successfully (${adminUsername})`);

  res.json({
    success: true,
    token,
    user: {
      id: adminId,
      username: adminUsername,
      name: admin?.name || 'Administrator',
      role: adminRole,
    },
  });
});

apiRouter.get('/auth/me', authMiddleware, (req: Request, res: Response): void => {
  const adminPayload = (req as any).admin;
  const admin = queryOne('SELECT id, username, name, role, created_at, updated_at FROM admins WHERE id = ?', [
    adminPayload.adminId,
  ]);

  if (!admin) {
    res.json({
      user: {
        id: adminPayload.adminId,
        username: adminPayload.username,
        name: 'Administrator',
        role: adminPayload.role,
      },
    });
    return;
  }

  res.json({ user: admin });
});

apiRouter.post('/auth/change-password', authMiddleware, (req: Request, res: Response): void => {
  const adminPayload = (req as any).admin;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required.' });
    return;
  }

  if (String(newPassword).length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    return;
  }

  const admin = queryOne('SELECT * FROM admins WHERE id = ?', [adminPayload.adminId]);
  if (!admin) {
    res.status(404).json({ error: 'Admin user not found.' });
    return;
  }

  const isCurrentValid = verifyPassword(String(currentPassword).trim(), admin.password_hash, admin.salt);
  if (!isCurrentValid) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const { hash, salt } = hashPassword(String(newPassword).trim());
  run('UPDATE admins SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    hash,
    salt,
    admin.id,
  ]);

  logAudit(req, 'PASSWORD_CHANGE', 'ADMIN', admin.id, 'Password updated successfully');

  res.json({ success: true, message: 'Password changed successfully.' });
});

// ----------------------------------------------------
// DASHBOARD STATS
// ----------------------------------------------------

apiRouter.get('/dashboard/stats', authMiddleware, (req: Request, res: Response): void => {
  const totalClientsRow = queryOne('SELECT COUNT(*) as count FROM clients');
  const activeClientsRow = queryOne("SELECT COUNT(*) as count FROM clients WHERE status = 'Active'");

  const smsAndRevenueRow = queryOne(`
    SELECT 
      COALESCE(SUM(total_sms), 0) as total_sms,
      COALESCE(SUM(net_payable), 0) as total_revenue
    FROM billing_records
  `);

  const pendingRow = queryOne(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(net_payable), 0) as amount
    FROM billing_records 
    WHERE payment_status IN ('Draft', 'Record Added', 'Payment Pending', 'Payment Sent')
  `);

  const completedRow = queryOne(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(net_payable), 0) as amount
    FROM billing_records 
    WHERE payment_status = 'Payment Completed'
  `);

  // Current billing week calculation (Monday to Sunday)
  const now = new Date();
  const day = now.getDay();
  // Monday is day 1, Sunday is day 0
  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diffToMonday));
  const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const weekStart = formatDate(monday);
  const weekEnd = formatDate(sunday);

  // Recent 8 records with client & panel details
  const recentRecords = queryAll(`
    SELECT 
      r.*,
      c.whatsapp_number as client_whatsapp
    FROM billing_records r
    LEFT JOIN clients c ON r.client_id = c.id
    ORDER BY r.id DESC 
    LIMIT 8
  `);

  // Fetch countries breakdown for recent records
  for (const record of recentRecords) {
    record.countries = queryAll(
      'SELECT * FROM billing_record_countries WHERE billing_record_id = ? ORDER BY id ASC',
      [record.id]
    );
  }

  // Panel stats
  const panelStats = queryAll(`
    SELECT 
      panel_name_snapshot as panel_name,
      COUNT(id) as records_count,
      SUM(total_sms) as total_sms,
      SUM(net_payable) as total_revenue
    FROM billing_records
    GROUP BY panel_name_snapshot
    ORDER BY total_revenue DESC
  `);

  // Country breakdown stats
  const countryStats = queryAll(`
    SELECT 
      country_name_snapshot as country_name,
      flag_snapshot as flag,
      SUM(sms_count) as total_sms,
      SUM(country_total) as total_revenue
    FROM billing_record_countries
    GROUP BY country_name_snapshot, flag_snapshot
    ORDER BY total_sms DESC
    LIMIT 8
  `);

  res.json({
    totalClients: totalClientsRow?.count || 0,
    activeClients: activeClientsRow?.count || 0,
    totalSms: smsAndRevenueRow?.total_sms || 0,
    totalBillingAmount: smsAndRevenueRow?.total_revenue || 0,
    pendingPaymentsCount: pendingRow?.count || 0,
    pendingPaymentsAmount: pendingRow?.amount || 0,
    completedPaymentsCount: completedRow?.count || 0,
    completedPaymentsAmount: completedRow?.amount || 0,
    currentBillingWeek: {
      start: weekStart,
      end: weekEnd,
      formatted: `${weekStart} ➔ ${weekEnd}`,
    },
    recentRecords,
    panelStats,
    countryStats,
  });
});

// ----------------------------------------------------
// CLIENTS
// ----------------------------------------------------

apiRouter.get('/clients', authMiddleware, (req: Request, res: Response): void => {
  const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';
  const status = req.query.status ? String(req.query.status).trim() : '';

  let sql = `
    SELECT 
      c.*,
      pm.name as payment_method_name,
      COUNT(r.id) as total_weeks,
      COALESCE(SUM(r.total_sms), 0) as total_sms,
      COALESCE(SUM(r.net_payable), 0) as total_amount,
      COALESCE(SUM(CASE WHEN r.payment_status != 'Payment Completed' THEN r.net_payable ELSE 0 END), 0) as pending_amount
    FROM clients c
    LEFT JOIN payment_methods pm ON c.payment_method_id = pm.id
    LEFT JOIN billing_records r ON c.id = r.client_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status && status !== 'All') {
    sql += ' AND c.status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (LOWER(c.client_name) LIKE ? OR LOWER(c.whatsapp_number) LIKE ? OR c.id = ?)';
    params.push(`%${search}%`, `%${search}%`, isNaN(Number(search)) ? -1 : Number(search));
  }

  sql += ' GROUP BY c.id ORDER BY c.client_name COLLATE NOCASE ASC, c.id ASC';

  const clients = queryAll(sql, params);
  res.json(clients);
});

apiRouter.post('/clients', authMiddleware, (req: Request, res: Response): void => {
  const {
    client_name,
    registration_date,
    payment_method_id,
    payment_details,
    whatsapp_number,
    additional_info,
    status = 'Active',
  } = req.body;

  if (!client_name || !String(client_name).trim()) {
    res.status(400).json({ error: 'Client name is required.' });
    return;
  }

  if (!whatsapp_number || !String(whatsapp_number).trim()) {
    res.status(400).json({ error: 'WhatsApp number is required.' });
    return;
  }

  // Clean WhatsApp number
  const cleanWhatsApp = String(whatsapp_number).replace(/[^\d+]/g, '');

  const regDate = registration_date || new Date().toISOString().split('T')[0];
  const methodId = Number(payment_method_id) || 1;

  const result = run(
    `INSERT INTO clients (client_name, registration_date, payment_method_id, payment_details, whatsapp_number, additional_info, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      String(client_name).trim(),
      regDate,
      methodId,
      String(payment_details || '').trim(),
      cleanWhatsApp,
      String(additional_info || '').trim(),
      status || 'Active',
    ]
  );

  logAudit(req, 'CREATE', 'CLIENT', result.lastInsertRowid, `Created client: ${client_name}`);

  const client = queryOne(
    `SELECT c.*, pm.name as payment_method_name 
     FROM clients c 
     LEFT JOIN payment_methods pm ON c.payment_method_id = pm.id 
     WHERE c.id = ?`,
    [result.lastInsertRowid]
  );

  res.status(201).json(client);
});

apiRouter.get('/clients/:id', authMiddleware, (req: Request, res: Response): void => {
  const clientId = Number(req.params.id);
  const client = queryOne(
    `SELECT c.*, pm.name as payment_method_name 
     FROM clients c 
     LEFT JOIN payment_methods pm ON c.payment_method_id = pm.id 
     WHERE c.id = ?`,
    [clientId]
  );

  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  // Client stats
  const stats = queryOne(
    `SELECT 
       COUNT(id) as total_weeks,
       COALESCE(SUM(total_sms), 0) as total_sms,
       COALESCE(SUM(net_payable), 0) as total_amount,
       COALESCE(SUM(CASE WHEN payment_status != 'Payment Completed' THEN net_payable ELSE 0 END), 0) as pending_amount
     FROM billing_records
     WHERE client_id = ?`,
    [clientId]
  );

  res.json({ ...client, ...stats });
});

apiRouter.put('/clients/:id', authMiddleware, (req: Request, res: Response): void => {
  const clientId = Number(req.params.id);
  const {
    client_name,
    registration_date,
    payment_method_id,
    payment_details,
    whatsapp_number,
    additional_info,
    status,
  } = req.body;

  const existing = queryOne('SELECT * FROM clients WHERE id = ?', [clientId]);
  if (!existing) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  const cleanWhatsApp = whatsapp_number
    ? String(whatsapp_number).replace(/[^\d+]/g, '')
    : existing.whatsapp_number;

  run(
    `UPDATE clients SET
      client_name = ?,
      registration_date = ?,
      payment_method_id = ?,
      payment_details = ?,
      whatsapp_number = ?,
      additional_info = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      client_name !== undefined ? String(client_name).trim() : existing.client_name,
      registration_date !== undefined ? registration_date : existing.registration_date,
      payment_method_id !== undefined ? Number(payment_method_id) : existing.payment_method_id,
      payment_details !== undefined ? String(payment_details).trim() : existing.payment_details,
      cleanWhatsApp,
      additional_info !== undefined ? String(additional_info).trim() : existing.additional_info,
      status !== undefined ? status : existing.status,
      clientId,
    ]
  );

  logAudit(req, 'UPDATE', 'CLIENT', clientId, `Updated client: ${client_name || existing.client_name}`);

  const updated = queryOne(
    `SELECT c.*, pm.name as payment_method_name 
     FROM clients c 
     LEFT JOIN payment_methods pm ON c.payment_method_id = pm.id 
     WHERE c.id = ?`,
    [clientId]
  );

  res.json(updated);
});

apiRouter.delete('/clients/:id', authMiddleware, (req: Request, res: Response): void => {
  const clientId = Number(req.params.id);
  const client = queryOne('SELECT * FROM clients WHERE id = ?', [clientId]);
  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  run('DELETE FROM clients WHERE id = ?', [clientId]);
  logAudit(req, 'DELETE', 'CLIENT', clientId, `Deleted client: ${client.client_name}`);

  res.json({ success: true, message: 'Client and all linked records removed.' });
});

apiRouter.get('/clients/:id/history', authMiddleware, (req: Request, res: Response): void => {
  const clientId = Number(req.params.id);
  const client = queryOne('SELECT * FROM clients WHERE id = ?', [clientId]);
  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  const records = queryAll(
    'SELECT * FROM billing_records WHERE client_id = ? ORDER BY billing_period_start DESC, id DESC',
    [clientId]
  );

  for (const rec of records) {
    rec.countries = queryAll(
      'SELECT * FROM billing_record_countries WHERE billing_record_id = ? ORDER BY id ASC',
      [rec.id]
    );
  }

  res.json({
    client,
    records,
  });
});

apiRouter.get('/clients/:id/next-period', authMiddleware, (req: Request, res: Response): void => {
  const clientId = Number(req.params.id);
  const client = queryOne('SELECT * FROM clients WHERE id = ?', [clientId]);
  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  // Get the most recent billing record by end date
  const latestRecord = queryOne(
    'SELECT * FROM billing_records WHERE client_id = ? ORDER BY billing_period_end DESC, id DESC LIMIT 1',
    [clientId]
  );

  let nextStart: string;
  let nextEnd: string;

  if (latestRecord && latestRecord.billing_period_end) {
    const lastEnd = new Date(latestRecord.billing_period_end);
    const startD = new Date(lastEnd);
    startD.setDate(lastEnd.getDate() + 1);
    nextStart = startD.toISOString().split('T')[0];

    const endD = new Date(startD);
    endD.setDate(startD.getDate() + 6);
    nextEnd = endD.toISOString().split('T')[0];
  } else {
    // Current week Monday to Sunday
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    nextStart = monday.toISOString().split('T')[0];

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    nextEnd = sunday.toISOString().split('T')[0];
  }

  res.json({
    client_id: clientId,
    client_name: client.client_name,
    latestRecord: latestRecord || null,
    nextStart,
    nextEnd,
    formatted: `${nextStart} ➔ ${nextEnd}`,
  });
});

// ----------------------------------------------------
// PANELS & COUNTRY RATES
// ----------------------------------------------------

apiRouter.get('/panels', authMiddleware, (req: Request, res: Response): void => {
  const panels = queryAll(`
    SELECT 
      p.*,
      COUNT(pcr.id) as country_rates_count
    FROM panels p
    LEFT JOIN panel_country_rates pcr ON p.id = pcr.panel_id AND pcr.status = 'Active'
    GROUP BY p.id
    ORDER BY p.name COLLATE NOCASE ASC
  `);
  res.json(panels);
});

apiRouter.post('/panels', authMiddleware, (req: Request, res: Response): void => {
  const { name, status = 'Active' } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Panel name is required.' });
    return;
  }

  const cleanName = String(name).trim();
  const existing = queryOne('SELECT id FROM panels WHERE name = ?', [cleanName]);
  if (existing) {
    res.status(400).json({ error: 'A panel with this name already exists.' });
    return;
  }

  const result = run('INSERT INTO panels (name, status) VALUES (?, ?)', [cleanName, status]);
  logAudit(req, 'CREATE', 'PANEL', result.lastInsertRowid, `Created panel: ${cleanName}`);

  const panel = queryOne('SELECT * FROM panels WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(panel);
});

apiRouter.put('/panels/:id', authMiddleware, (req: Request, res: Response): void => {
  const panelId = Number(req.params.id);
  const { name, status } = req.body;

  const existing = queryOne('SELECT * FROM panels WHERE id = ?', [panelId]);
  if (!existing) {
    res.status(404).json({ error: 'Panel not found.' });
    return;
  }

  run('UPDATE panels SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    name ? String(name).trim() : existing.name,
    status ? status : existing.status,
    panelId,
  ]);

  logAudit(req, 'UPDATE', 'PANEL', panelId, `Updated panel: ${name || existing.name}`);

  const updated = queryOne('SELECT * FROM panels WHERE id = ?', [panelId]);
  res.json(updated);
});

apiRouter.delete('/panels/:id', authMiddleware, (req: Request, res: Response): void => {
  const panelId = Number(req.params.id);
  const panel = queryOne('SELECT * FROM panels WHERE id = ?', [panelId]);
  if (!panel) {
    res.status(404).json({ error: 'Panel not found.' });
    return;
  }

  run('DELETE FROM panels WHERE id = ?', [panelId]);
  logAudit(req, 'DELETE', 'PANEL', panelId, `Deleted panel: ${panel.name}`);

  res.json({ success: true, message: 'Panel deleted successfully.' });
});

// Panel Country Rates
apiRouter.get('/panels/:id/rates', authMiddleware, (req: Request, res: Response): void => {
  const panelId = Number(req.params.id);
  const rates = queryAll(
    `SELECT 
      pcr.*,
      c.name as country_name,
      c.iso_code,
      c.phone_code,
      c.flag
     FROM panel_country_rates pcr
     JOIN countries c ON pcr.country_id = c.id
     WHERE pcr.panel_id = ?
     ORDER BY c.name ASC`,
    [panelId]
  );
  res.json(rates);
});

apiRouter.post('/panels/:id/rates', authMiddleware, (req: Request, res: Response): void => {
  const panelId = Number(req.params.id);
  const { country_id, rate, status = 'Active' } = req.body;

  if (!country_id || rate === undefined || rate === null) {
    res.status(400).json({ error: 'Country and fixed SMS rate are required.' });
    return;
  }

  const numRate = Number(rate);
  if (isNaN(numRate) || numRate <= 0) {
    res.status(400).json({ error: 'SMS Rate must be a positive number.' });
    return;
  }

  const country = queryOne('SELECT * FROM countries WHERE id = ?', [Number(country_id)]);
  if (!country) {
    res.status(404).json({ error: 'Country not found.' });
    return;
  }

  // Check if rate already exists for this panel + country
  const existing = queryOne(
    'SELECT id FROM panel_country_rates WHERE panel_id = ? AND country_id = ?',
    [panelId, Number(country_id)]
  );

  let rateId: number;
  if (existing) {
    run(
      'UPDATE panel_country_rates SET rate = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [numRate, status, existing.id]
    );
    rateId = existing.id;
    logAudit(req, 'UPDATE', 'PANEL_RATE', rateId, `Updated rate for ${country.name}: Rs.${numRate}`);
  } else {
    const result = run(
      'INSERT INTO panel_country_rates (panel_id, country_id, rate, status) VALUES (?, ?, ?, ?)',
      [panelId, Number(country_id), numRate, status]
    );
    rateId = result.lastInsertRowid;
    logAudit(req, 'CREATE', 'PANEL_RATE', rateId, `Added rate for ${country.name}: Rs.${numRate}`);
  }

  const rateRow = queryOne(
    `SELECT 
      pcr.*,
      c.name as country_name,
      c.iso_code,
      c.phone_code,
      c.flag
     FROM panel_country_rates pcr
     JOIN countries c ON pcr.country_id = c.id
     WHERE pcr.id = ?`,
    [rateId]
  );

  res.status(201).json(rateRow);
});

apiRouter.put('/panels/:id/rates/:rateId', authMiddleware, (req: Request, res: Response): void => {
  const panelId = Number(req.params.id);
  const rateId = Number(req.params.rateId);
  const { rate, status } = req.body;

  const existing = queryOne('SELECT * FROM panel_country_rates WHERE id = ? AND panel_id = ?', [
    rateId,
    panelId,
  ]);
  if (!existing) {
    res.status(404).json({ error: 'Panel country rate not found.' });
    return;
  }

  const numRate = rate !== undefined ? Number(rate) : existing.rate;
  const newStatus = status !== undefined ? status : existing.status;

  run(
    'UPDATE panel_country_rates SET rate = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [numRate, newStatus, rateId]
  );

  logAudit(req, 'UPDATE', 'PANEL_RATE', rateId, `Updated rate: Rs.${numRate}`);

  const updated = queryOne(
    `SELECT 
      pcr.*,
      c.name as country_name,
      c.iso_code,
      c.phone_code,
      c.flag
     FROM panel_country_rates pcr
     JOIN countries c ON pcr.country_id = c.id
     WHERE pcr.id = ?`,
    [rateId]
  );

  res.json(updated);
});

apiRouter.delete('/panels/:id/rates/:rateId', authMiddleware, (req: Request, res: Response): void => {
  const panelId = Number(req.params.id);
  const rateId = Number(req.params.rateId);

  run('DELETE FROM panel_country_rates WHERE id = ? AND panel_id = ?', [rateId, panelId]);
  logAudit(req, 'DELETE', 'PANEL_RATE', rateId, 'Removed panel country rate');

  res.json({ success: true, message: 'Country rate removed.' });
});

// ----------------------------------------------------
// COUNTRIES & PAYMENT METHODS
// ----------------------------------------------------

apiRouter.get('/countries', authMiddleware, (req: Request, res: Response): void => {
  // Ensure 'Other all country' exists
  const otherExists = queryOne('SELECT id FROM countries WHERE iso_code = ? OR name = ?', ['OTHER', 'Other all country']);
  if (!otherExists) {
    run("INSERT INTO countries (name, iso_code, phone_code, flag, status) VALUES ('Other all country', 'OTHER', '+0', '🌐', 'Active')");
  }

  const countries = queryAll(`
    SELECT * FROM countries 
    ORDER BY 
      CASE 
        WHEN iso_code = 'OTHER' OR name = 'Other all country' THEN 0 
        ELSE 1 
      END, 
      name ASC
  `);
  res.json(countries);
});

apiRouter.post('/countries', authMiddleware, (req: Request, res: Response): void => {
  const { name, iso_code, phone_code, flag, status = 'Active' } = req.body;
  if (!name || !iso_code) {
    res.status(400).json({ error: 'Country name and ISO code are required.' });
    return;
  }

  const cleanIso = String(iso_code).trim().toUpperCase();
  const existing = queryOne('SELECT id FROM countries WHERE iso_code = ?', [cleanIso]);
  if (existing) {
    res.status(400).json({ error: 'Country with this ISO code already exists.' });
    return;
  }

  const result = run(
    'INSERT INTO countries (name, iso_code, phone_code, flag, status) VALUES (?, ?, ?, ?, ?)',
    [String(name).trim(), cleanIso, String(phone_code || '').trim(), String(flag || '🌐').trim(), status]
  );

  const country = queryOne('SELECT * FROM countries WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(country);
});

apiRouter.get('/payment-methods', authMiddleware, (req: Request, res: Response): void => {
  const methods = queryAll('SELECT * FROM payment_methods ORDER BY id ASC');
  res.json(methods);
});

apiRouter.post('/payment-methods', authMiddleware, (req: Request, res: Response): void => {
  const { name, status = 'Active' } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Payment method name is required.' });
    return;
  }

  const cleanName = String(name).trim();
  const result = run('INSERT INTO payment_methods (name, status) VALUES (?, ?)', [cleanName, status]);
  logAudit(req, 'CREATE', 'PAYMENT_METHOD', result.lastInsertRowid, `Added payment method: ${cleanName}`);

  const method = queryOne('SELECT * FROM payment_methods WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(method);
});

apiRouter.put('/payment-methods/:id', authMiddleware, (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const { name, status } = req.body;

  const existing = queryOne('SELECT * FROM payment_methods WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Payment method not found.' });
    return;
  }

  run('UPDATE payment_methods SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    name ? String(name).trim() : existing.name,
    status ? status : existing.status,
    id,
  ]);

  const updated = queryOne('SELECT * FROM payment_methods WHERE id = ?', [id]);
  res.json(updated);
});

apiRouter.delete('/payment-methods/:id', authMiddleware, (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  run('DELETE FROM payment_methods WHERE id = ?', [id]);
  res.json({ success: true });
});

// ----------------------------------------------------
// BILLING RECORDS (ADD RECORD & WEEKLY BILLING)
// ----------------------------------------------------

apiRouter.get('/billing-records', authMiddleware, (req: Request, res: Response): void => {
  const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';
  const status = req.query.status ? String(req.query.status).trim() : '';
  const clientId = req.query.client_id ? Number(req.query.client_id) : null;
  const panelId = req.query.panel_id ? Number(req.query.panel_id) : null;

  let sql = `
    SELECT 
      r.*,
      c.whatsapp_number as client_whatsapp,
      (SELECT status FROM whatsapp_messages WHERE billing_record_id = r.id ORDER BY id DESC LIMIT 1) as whatsapp_status,
      (SELECT COUNT(*) FROM whatsapp_messages WHERE billing_record_id = r.id) as whatsapp_send_count,
      (SELECT sent_at FROM whatsapp_messages WHERE billing_record_id = r.id ORDER BY id DESC LIMIT 1) as whatsapp_sent_at
    FROM billing_records r
    LEFT JOIN clients c ON r.client_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (clientId) {
    sql += ' AND r.client_id = ?';
    params.push(clientId);
  }

  if (panelId) {
    sql += ' AND r.panel_id = ?';
    params.push(panelId);
  }

  if (status && status !== 'All') {
    sql += ' AND r.payment_status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (LOWER(r.client_name_snapshot) LIKE ? OR LOWER(r.panel_name_snapshot) LIKE ? OR r.id = ?)';
    params.push(`%${search}%`, `%${search}%`, isNaN(Number(search)) ? -1 : Number(search));
  }

  sql += ' ORDER BY r.billing_period_start DESC, r.id DESC';

  const records = queryAll(sql, params);

  for (const rec of records) {
    rec.countries = queryAll(
      'SELECT * FROM billing_record_countries WHERE billing_record_id = ? ORDER BY id ASC',
      [rec.id]
    );
  }

  res.json(records);
});

apiRouter.get('/billing-records/:id', authMiddleware, (req: Request, res: Response): void => {
  const recordId = Number(req.params.id);
  const record = queryOne(
    `SELECT 
      r.*,
      c.whatsapp_number as client_whatsapp,
      (SELECT status FROM whatsapp_messages WHERE billing_record_id = r.id ORDER BY id DESC LIMIT 1) as whatsapp_status,
      (SELECT COUNT(*) FROM whatsapp_messages WHERE billing_record_id = r.id) as whatsapp_send_count,
      (SELECT sent_at FROM whatsapp_messages WHERE billing_record_id = r.id ORDER BY id DESC LIMIT 1) as whatsapp_sent_at
     FROM billing_records r
     LEFT JOIN clients c ON r.client_id = c.id
     WHERE r.id = ?`,
    [recordId]
  );

  if (!record) {
    res.status(404).json({ error: 'Billing record not found.' });
    return;
  }

  record.countries = queryAll(
    'SELECT * FROM billing_record_countries WHERE billing_record_id = ? ORDER BY id ASC',
    [record.id]
  );

  res.json(record);
});

apiRouter.post('/billing-records', authMiddleware, (req: Request, res: Response): void => {
  const {
    client_id,
    panel_id,
    billing_period_start,
    billing_period_end,
    billing_cycle = 'Haftawar (Weekly)',
    payment_status = 'Payment Pending',
    payment_date = null,
    clearance_date = null,
    notes = '',
    country_rows = [],
    force_duplicate = false,
  } = req.body;

  if (!client_id) {
    res.status(400).json({ error: 'Client is required.' });
    return;
  }
  if (!billing_period_start || !billing_period_end) {
    res.status(400).json({ error: 'Billing period start and end dates are required.' });
    return;
  }
  if (!Array.isArray(country_rows) || country_rows.length === 0) {
    res.status(400).json({ error: 'At least one country SMS entry is required.' });
    return;
  }

  const client = queryOne(
    `SELECT c.*, pm.name as payment_method_name 
     FROM clients c 
     LEFT JOIN payment_methods pm ON c.payment_method_id = pm.id 
     WHERE c.id = ?`,
    [Number(client_id)]
  );
  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  // Duplicate / Overlapping Date Range Protection
  if (!force_duplicate) {
    const existingSamePeriod = queryOne(
      `SELECT * FROM billing_records 
       WHERE client_id = ? AND billing_period_start = ? AND billing_period_end = ?`,
      [Number(client_id), billing_period_start, billing_period_end]
    );

    if (existingSamePeriod) {
      res.status(409).json({
        error: `Record already exists for ${client.client_name} for period ${billing_period_start} ➔ ${billing_period_end} (Record #${existingSamePeriod.id}). Please select next week or confirm overwrite.`,
        isDuplicate: true,
        existingRecordId: existingSamePeriod.id,
      });
      return;
    }
  }

  // Main panel fallback if not specified on individual rows
  const defaultPanelId = Number(panel_id) || 1;
  const defaultPanel = queryOne('SELECT * FROM panels WHERE id = ?', [defaultPanelId]) || {
    id: 1,
    name: 'KB MAX - LAMIX SMS PANEL',
  };

  // Cache panel rates for quick lookups
  const allPanels = queryAll('SELECT id, name FROM panels');
  const panelsMap = new Map<number, string>();
  for (const p of allPanels) {
    panelsMap.set(p.id, p.name);
  }

  const ratesCache = new Map<string, number>(); // key: `${panelId}_${countryId}`
  const allRates = queryAll('SELECT panel_id, country_id, rate FROM panel_country_rates WHERE status = "Active"');
  for (const r of allRates) {
    ratesCache.set(`${r.panel_id}_${r.country_id}`, r.rate);
  }

  // Backend verification & calculation
  const validatedCountries: {
    country_id: number;
    country_name: string;
    country_code: string;
    flag: string;
    sms_count: number;
    rate: number;
    country_total: number;
    panel_id: number;
    panel_name: string;
  }[] = [];

  const seenKeys = new Set<string>(); // unique panel_id + country_id
  let totalSms = 0;
  let calculatedTotal = 0;

  for (const row of country_rows) {
    const countryId = Number(row.country_id);
    const rowPanelId = Number(row.panel_id) || defaultPanelId;
    const smsCount = Number(row.sms_count);

    if (!countryId) continue;
    if (isNaN(smsCount) || smsCount < 0) {
      res.status(400).json({ error: `Invalid SMS count for country ID ${countryId}. Must be non-negative.` });
      return;
    }

    const uniqueKey = `${rowPanelId}_${countryId}`;
    if (seenKeys.has(uniqueKey)) {
      res.status(400).json({ error: 'Duplicate country row found under the same panel.' });
      return;
    }
    seenKeys.add(uniqueKey);

    const country = queryOne('SELECT * FROM countries WHERE id = ?', [countryId]);
    if (!country) {
      res.status(400).json({ error: `Country with ID ${countryId} does not exist.` });
      return;
    }

    const pName = panelsMap.get(rowPanelId) || defaultPanel.name;

    // Use custom rate if passed or look up panel configured rate
    let fixedRate = row.rate !== undefined && row.rate !== null && Number(row.rate) > 0 
      ? Number(row.rate) 
      : ratesCache.get(`${rowPanelId}_${countryId}`);

    if (fixedRate === undefined) {
      // Check if this panel has a rate for 'Other all country'
      const otherCountry = queryOne("SELECT id FROM countries WHERE iso_code = 'OTHER' OR name = 'Other all country'");
      if (otherCountry) {
        fixedRate = ratesCache.get(`${rowPanelId}_${otherCountry.id}`);
      }
      if (fixedRate === undefined) {
        // Check default panel rate
        fixedRate = ratesCache.get(`${defaultPanelId}_${countryId}`) || (otherCountry ? ratesCache.get(`${defaultPanelId}_${otherCountry.id}`) : undefined) || 2.0;
      }
    }

    const countryTotal = smsCount * fixedRate;
    totalSms += smsCount;
    calculatedTotal += countryTotal;

    validatedCountries.push({
      country_id: countryId,
      country_name: country.name,
      country_code: country.iso_code,
      flag: country.flag || '🌐',
      sms_count: smsCount,
      rate: fixedRate,
      country_total: countryTotal,
      panel_id: rowPanelId,
      panel_name: pName,
    });
  }

  if (validatedCountries.length === 0) {
    res.status(400).json({ error: 'Please enter valid SMS counts for at least one country.' });
    return;
  }

  const netPayable = calculatedTotal;

  // Snapshots
  const clientNameSnapshot = client.client_name;
  const primaryPanelNameSnapshot = validatedCountries[0]?.panel_name || defaultPanel.name;
  const primaryPanelId = validatedCountries[0]?.panel_id || defaultPanelId;
  const paymentMethodId = client.payment_method_id;
  const paymentMethodNameSnapshot = client.payment_method_name || 'Direct';
  const paymentDetailsSnapshot = client.payment_details || 'N/A';

  // Calculate default clearance date (e.g. Wednesday following billing period)
  let clearance = clearance_date;
  if (!clearance) {
    const end = new Date(billing_period_end);
    const dayOfWeek = end.getDay(); // 0 is Sun
    const daysUntilWed = (3 - dayOfWeek + 7) % 7 || 3;
    const wedDate = new Date(end);
    wedDate.setDate(end.getDate() + daysUntilWed);
    clearance = wedDate.toISOString().split('T')[0];
  }

  // Generate Slips with exact format
  const slips = generateSlipText({
    client_name: clientNameSnapshot,
    panel_name: primaryPanelNameSnapshot,
    start_date: billing_period_start,
    end_date: billing_period_end,
    cycle: billing_cycle,
    payment_method: paymentMethodNameSnapshot,
    payment_details: paymentDetailsSnapshot,
    notes: notes || 'Payment cleared on schedule',
    countries: validatedCountries.map((c) => ({
      name: c.country_name,
      flag: c.flag,
      sms: c.sms_count,
      rate: c.rate,
      total: c.country_total,
      panel_name: c.panel_name,
      panel_id: c.panel_id,
    })),
    total_sms: totalSms,
    total_amount: netPayable,
  });

  // Insert Record
  const result = run(
    `INSERT INTO billing_records (
      client_id, panel_id, client_name_snapshot, panel_name_snapshot,
      billing_period_start, billing_period_end, billing_cycle,
      total_sms, calculated_total, net_payable,
      payment_method_id, payment_method_name_snapshot, payment_details_snapshot,
      payment_status, payment_date, clearance_date,
      professional_slip, simple_slip, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      client.id,
      primaryPanelId,
      clientNameSnapshot,
      primaryPanelNameSnapshot,
      billing_period_start,
      billing_period_end,
      billing_cycle,
      totalSms,
      calculatedTotal,
      netPayable,
      paymentMethodId,
      paymentMethodNameSnapshot,
      paymentDetailsSnapshot,
      payment_status,
      payment_date,
      clearance,
      slips.professional,
      slips.simple,
      notes,
    ]
  );

  const recordId = result.lastInsertRowid;

  // Insert country breakdown with panel information
  for (const c of validatedCountries) {
    run(
      `INSERT INTO billing_record_countries (
        billing_record_id, country_id, country_name_snapshot,
        country_code_snapshot, flag_snapshot, sms_count,
        rate_snapshot, country_total, panel_id, panel_name_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        c.country_id,
        c.country_name,
        c.country_code,
        c.flag,
        c.sms_count,
        c.rate,
        c.country_total,
        c.panel_id,
        c.panel_name,
      ]
    );
  }

  logAudit(
    req,
    'CREATE',
    'BILLING_RECORD',
    recordId,
    `Added weekly record for ${clientNameSnapshot} (${totalSms} SMS, Rs.${netPayable})`
  );

  const createdRecord = queryOne(
    `SELECT 
      r.*,
      c.whatsapp_number as client_whatsapp
     FROM billing_records r
     LEFT JOIN clients c ON r.client_id = c.id
     WHERE r.id = ?`,
    [recordId]
  );
  createdRecord.countries = queryAll(
    'SELECT * FROM billing_record_countries WHERE billing_record_id = ? ORDER BY id ASC',
    [recordId]
  );

  res.status(201).json(createdRecord);
});

apiRouter.put('/billing-records/:id', authMiddleware, (req: Request, res: Response): void => {
  const recordId = Number(req.params.id);
  const {
    billing_period_start,
    billing_period_end,
    billing_cycle,
    payment_status,
    payment_date,
    clearance_date,
    notes,
    country_rows,
  } = req.body;

  const existing = queryOne('SELECT * FROM billing_records WHERE id = ?', [recordId]);
  if (!existing) {
    res.status(404).json({ error: 'Billing record not found.' });
    return;
  }

  // If country_rows are provided, recalculate
  if (Array.isArray(country_rows) && country_rows.length > 0) {
    const allPanels = queryAll('SELECT id, name FROM panels');
    const panelsMap = new Map<number, string>();
    for (const p of allPanels) {
      panelsMap.set(p.id, p.name);
    }

    const ratesCache = new Map<string, number>();
    const allRates = queryAll('SELECT panel_id, country_id, rate FROM panel_country_rates WHERE status = "Active"');
    for (const r of allRates) {
      ratesCache.set(`${r.panel_id}_${r.country_id}`, r.rate);
    }

    let totalSms = 0;
    let calculatedTotal = 0;
    const validatedCountries: any[] = [];

    for (const row of country_rows) {
      const countryId = Number(row.country_id);
      const rowPanelId = Number(row.panel_id) || existing.panel_id || 1;
      const smsCount = Number(row.sms_count);
      const country = queryOne('SELECT * FROM countries WHERE id = ?', [countryId]);
      if (!country) continue;

      const pName = row.panel_name || panelsMap.get(rowPanelId) || existing.panel_name_snapshot;
      const rate = row.rate !== undefined && Number(row.rate) > 0
        ? Number(row.rate)
        : ratesCache.get(`${rowPanelId}_${countryId}`) || row.rate_snapshot || 2.0;

      const total = smsCount * rate;
      totalSms += smsCount;
      calculatedTotal += total;

      validatedCountries.push({
        country_id: countryId,
        country_name: country.name,
        country_code: country.iso_code,
        flag: country.flag || '🌐',
        sms_count: smsCount,
        rate: rate,
        country_total: total,
        panel_id: rowPanelId,
        panel_name: pName,
      });
    }

    // Delete existing countries and re-insert
    run('DELETE FROM billing_record_countries WHERE billing_record_id = ?', [recordId]);
    for (const c of validatedCountries) {
      run(
        `INSERT INTO billing_record_countries (
          billing_record_id, country_id, country_name_snapshot,
          country_code_snapshot, flag_snapshot, sms_count,
          rate_snapshot, country_total, panel_id, panel_name_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          c.country_id,
          c.country_name,
          c.country_code,
          c.flag,
          c.sms_count,
          c.rate,
          c.country_total,
          c.panel_id,
          c.panel_name,
        ]
      );
    }

    const primaryPanel = validatedCountries[0]?.panel_name || existing.panel_name_snapshot;

    const slips = generateSlipText({
      client_name: existing.client_name_snapshot,
      panel_name: primaryPanel,
      start_date: billing_period_start || existing.billing_period_start,
      end_date: billing_period_end || existing.billing_period_end,
      cycle: billing_cycle || existing.billing_cycle,
      payment_method: existing.payment_method_name_snapshot,
      payment_details: existing.payment_details_snapshot,
      notes: notes !== undefined ? notes : existing.notes,
      countries: validatedCountries.map((c) => ({
        name: c.country_name,
        flag: c.flag,
        sms: c.sms_count,
        rate: c.rate,
        total: c.country_total,
        panel_name: c.panel_name,
        panel_id: c.panel_id,
      })),
      total_sms: totalSms,
      total_amount: calculatedTotal,
    });

    run(
      `UPDATE billing_records SET
        billing_period_start = ?,
        billing_period_end = ?,
        billing_cycle = ?,
        total_sms = ?,
        calculated_total = ?,
        net_payable = ?,
        payment_status = ?,
        payment_date = ?,
        clearance_date = ?,
        professional_slip = ?,
        simple_slip = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        billing_period_start || existing.billing_period_start,
        billing_period_end || existing.billing_period_end,
        billing_cycle || existing.billing_cycle,
        totalSms,
        calculatedTotal,
        calculatedTotal,
        payment_status || existing.payment_status,
        payment_date !== undefined ? payment_date : existing.payment_date,
        clearance_date !== undefined ? clearance_date : existing.clearance_date,
        slips.professional,
        slips.simple,
        notes !== undefined ? notes : existing.notes,
        recordId,
      ]
    );
  } else {
    // Check if custom slip text or metadata update is provided
    const { professional_slip, simple_slip } = req.body;
    
    run(
      `UPDATE billing_records SET
        payment_status = ?,
        payment_date = ?,
        clearance_date = ?,
        professional_slip = ?,
        simple_slip = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payment_status !== undefined ? payment_status : existing.payment_status,
        payment_date !== undefined ? payment_date : existing.payment_date,
        clearance_date !== undefined ? clearance_date : existing.clearance_date,
        professional_slip !== undefined ? professional_slip : existing.professional_slip,
        simple_slip !== undefined ? simple_slip : existing.simple_slip,
        notes !== undefined ? notes : existing.notes,
        recordId,
      ]
    );
  }

  logAudit(req, 'UPDATE', 'BILLING_RECORD', recordId, `Updated billing record #${recordId}`);

  const updatedRecord = queryOne(
    `SELECT 
      r.*,
      c.whatsapp_number as client_whatsapp
     FROM billing_records r
     LEFT JOIN clients c ON r.client_id = c.id
     WHERE r.id = ?`,
    [recordId]
  );
  updatedRecord.countries = queryAll(
    'SELECT * FROM billing_record_countries WHERE billing_record_id = ? ORDER BY id ASC',
    [recordId]
  );

  res.json(updatedRecord);
});

apiRouter.post('/billing-records/:id/status', authMiddleware, (req: Request, res: Response): void => {
  const recordId = Number(req.params.id);
  const { payment_status, payment_date } = req.body;

  if (!payment_status) {
    res.status(400).json({ error: 'Payment status is required.' });
    return;
  }

  const existing = queryOne('SELECT * FROM billing_records WHERE id = ?', [recordId]);
  if (!existing) {
    res.status(404).json({ error: 'Billing record not found.' });
    return;
  }

  const pDate = payment_status === 'Payment Completed' 
    ? (payment_date || new Date().toISOString().split('T')[0]) 
    : existing.payment_date;

  run(
    'UPDATE billing_records SET payment_status = ?, payment_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [payment_status, pDate, recordId]
  );

  logAudit(req, 'STATUS_CHANGE', 'BILLING_RECORD', recordId, `Payment status set to: ${payment_status}`);

  res.json({ success: true, payment_status, payment_date: pDate });
});

apiRouter.delete('/billing-records/:id', authMiddleware, (req: Request, res: Response): void => {
  const recordId = Number(req.params.id);
  const pin = req.body?.pin || req.query?.pin || req.headers['x-admin-pin'] || req.headers['x-delete-pin'];

  if (String(pin).trim() !== '41200') {
    res.status(403).json({ error: 'Security PIN ghalat hai! Record delete karne ke liye PIN 41200 darj karein.' });
    return;
  }

  const existing = queryOne('SELECT * FROM billing_records WHERE id = ?', [recordId]);
  if (!existing) {
    res.status(404).json({ error: 'Billing record not found.' });
    return;
  }

  run('DELETE FROM billing_record_countries WHERE billing_record_id = ?', [recordId]);
  run('DELETE FROM whatsapp_messages WHERE billing_record_id = ?', [recordId]);
  run('DELETE FROM billing_records WHERE id = ?', [recordId]);

  logAudit(
    req,
    'DELETE',
    'BILLING_RECORD',
    recordId,
    `Deleted billing record #${recordId} (${existing.client_name_snapshot}) using Security PIN 41200`
  );
  res.json({ success: true, message: 'Billing record kamyabi se delete ho gaya.' });
});

apiRouter.post('/billing-records/batch-delete', authMiddleware, (req: Request, res: Response): void => {
  const { ids, pin } = req.body;
  const passedPin = pin || req.headers['x-admin-pin'] || req.headers['x-delete-pin'];

  if (String(passedPin).trim() !== '41200') {
    res.status(403).json({ error: 'Security PIN ghalat hai! Records delete karne ke liye PIN 41200 darj karein.' });
    return;
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'No record IDs provided.' });
    return;
  }

  for (const id of ids) {
    const recId = Number(id);
    run('DELETE FROM billing_record_countries WHERE billing_record_id = ?', [recId]);
    run('DELETE FROM whatsapp_messages WHERE billing_record_id = ?', [recId]);
    run('DELETE FROM billing_records WHERE id = ?', [recId]);
    logAudit(req, 'DELETE', 'BILLING_RECORD', recId, `Batch deleted billing record #${recId} with PIN 41200`);
  }

  res.json({ success: true, message: `${ids.length} records successfully deleted.` });
});

// ----------------------------------------------------
// WHATSAPP INTEGRATION & MESSAGES
// ----------------------------------------------------

apiRouter.get('/whatsapp/messages', authMiddleware, (req: Request, res: Response): void => {
  const messages = queryAll(`
    SELECT 
      m.*,
      c.client_name
    FROM whatsapp_messages m
    LEFT JOIN clients c ON m.client_id = c.id
    ORDER BY m.id DESC
    LIMIT 100
  `);
  res.json(messages);
});

apiRouter.post('/whatsapp/send', authMiddleware, (req: Request, res: Response): void => {
  const {
    client_id,
    billing_record_id,
    message_type = 'Billing Slip',
    recipient_number,
    message_body,
  } = req.body;

  if (!recipient_number || !message_body) {
    res.status(400).json({ error: 'Recipient number and message body are required.' });
    return;
  }

  // Clean phone number (digits only, e.g. 923001234567)
  const cleanNumber = String(recipient_number).replace(/[^\d]/g, '');

  const settingsMode = queryOne("SELECT setting_value FROM settings WHERE setting_key = 'whatsapp_mode'");
  const mode = settingsMode?.setting_value || 'direct_link';

  const encodedText = encodeURIComponent(message_body);
  const directUrl = `https://wa.me/${cleanNumber}?text=${encodedText}`;

  let status = 'Direct Link Generated';
  let providerMessageId = null;
  let errorMsg = null;

  // If cloud API is enabled and configured, attempt real sending
  if (mode === 'cloud_api') {
    const tokenSetting = queryOne("SELECT setting_value FROM settings WHERE setting_key = 'whatsapp_api_token'");
    const phoneIdSetting = queryOne("SELECT setting_value FROM settings WHERE setting_key = 'whatsapp_phone_number_id'");

    const token = tokenSetting?.setting_value || process.env.WHATSAPP_API_TOKEN;
    const phoneId = phoneIdSetting?.setting_value || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (token && phoneId && token !== '<SET_IN_SECURE_CONFIG>' && phoneId !== '<SET_IN_SECURE_CONFIG>') {
      // In a real cloud API deployment, we would execute fetch to Meta Graph API here
      // For now we simulate provider ID and acknowledge
      providerMessageId = `wamid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      status = 'Sent';
    } else {
      status = 'Direct Link Generated';
    }
  }

  const result = run(
    `INSERT INTO whatsapp_messages (
      client_id, billing_record_id, message_type, recipient_number,
      message_body, provider_message_id, status, error_message, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      client_id ? Number(client_id) : null,
      billing_record_id ? Number(billing_record_id) : null,
      message_type,
      cleanNumber,
      message_body,
      providerMessageId,
      status,
      errorMsg,
    ]
  );

  logAudit(
    req,
    'WHATSAPP_SEND',
    'MESSAGE',
    result.lastInsertRowid,
    `Dispatched WhatsApp ${message_type} to +${cleanNumber}`
  );

  res.json({
    success: true,
    messageId: result.lastInsertRowid,
    status,
    directUrl,
    cleanNumber,
  });
});

// ----------------------------------------------------
// SETTINGS, AUDIT LOGS & BACKUP
// ----------------------------------------------------

apiRouter.get('/settings', authMiddleware, (req: Request, res: Response): void => {
  const rows = queryAll('SELECT setting_key, setting_value FROM settings');
  const settingsObj: Record<string, string> = {};
  for (const r of rows) {
    settingsObj[r.setting_key] = r.setting_value;
  }
  res.json(settingsObj);
});

apiRouter.put('/settings', authMiddleware, (req: Request, res: Response): void => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    res.status(400).json({ error: 'Invalid settings payload.' });
    return;
  }

  for (const [key, value] of Object.entries(updates)) {
    const exists = queryOne('SELECT id FROM settings WHERE setting_key = ?', [key]);
    if (exists) {
      run('UPDATE settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?', [
        String(value),
        key,
      ]);
    } else {
      run('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, String(value)]);
    }
  }

  logAudit(req, 'UPDATE', 'SETTINGS', null, 'System settings updated');
  res.json({ success: true, message: 'Settings saved successfully.' });
});

apiRouter.get('/audit-logs', authMiddleware, (req: Request, res: Response): void => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = queryAll('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', [limit]);
  res.json(logs);
});

apiRouter.get('/backup/export', authMiddleware, (req: Request, res: Response): void => {
  logAudit(req, 'BACKUP_EXPORT', 'DATABASE', null, 'Database backup exported');
  const backup = exportDatabaseBackup();
  res.json(backup);
});

apiRouter.post('/backup/restore', authMiddleware, (req: Request, res: Response): void => {
  const { backupData } = req.body;
  if (!backupData) {
    res.status(400).json({ error: 'Backup data is required.' });
    return;
  }

  const success = restoreDatabaseBackup(backupData);
  if (!success) {
    res.status(500).json({ error: 'Failed to restore database from backup.' });
    return;
  }

  logAudit(req, 'BACKUP_RESTORE', 'DATABASE', null, 'Database restored from backup');
  res.json({ success: true, message: 'Database restored successfully.' });
});
