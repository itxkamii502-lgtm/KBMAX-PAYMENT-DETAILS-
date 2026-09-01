import initSqlJs, { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'kbmax.sqlite');

let db: Database;
let SQL: any;

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(checkHash, 'hex'));
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('Loaded existing SQLite database from:', DB_FILE);
    } catch (err) {
      console.error('Failed to load database file, creating fresh one:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log('Created new in-memory SQLite database.');
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON;');

  // Create tables
  createTables();
  seedInitialData();
  saveDatabase();

  return db;
}

export function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      iso_code TEXT UNIQUE NOT NULL,
      phone_code TEXT NOT NULL,
      flag TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS panels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS panel_country_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      panel_id INTEGER NOT NULL,
      country_id INTEGER NOT NULL,
      rate REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(panel_id, country_id),
      FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE,
      FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      registration_date TEXT NOT NULL,
      payment_method_id INTEGER NOT NULL,
      payment_details TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      additional_info TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
    );

    CREATE TABLE IF NOT EXISTS billing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      panel_id INTEGER NOT NULL,
      client_name_snapshot TEXT NOT NULL,
      panel_name_snapshot TEXT NOT NULL,
      billing_period_start TEXT NOT NULL,
      billing_period_end TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'Haftawar (Weekly)',
      total_sms INTEGER NOT NULL DEFAULT 0,
      calculated_total REAL NOT NULL DEFAULT 0,
      net_payable REAL NOT NULL DEFAULT 0,
      payment_method_id INTEGER NOT NULL,
      payment_method_name_snapshot TEXT NOT NULL,
      payment_details_snapshot TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'Payment Pending',
      payment_date TEXT,
      clearance_date TEXT,
      professional_slip TEXT,
      simple_slip TEXT,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (panel_id) REFERENCES panels(id)
    );

    CREATE TABLE IF NOT EXISTS billing_record_countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      billing_record_id INTEGER NOT NULL,
      country_id INTEGER NOT NULL,
      country_name_snapshot TEXT NOT NULL,
      country_code_snapshot TEXT NOT NULL,
      flag_snapshot TEXT NOT NULL,
      sms_count INTEGER NOT NULL,
      rate_snapshot REAL NOT NULL,
      country_total REAL NOT NULL,
      panel_id INTEGER,
      panel_name_snapshot TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (billing_record_id) REFERENCES billing_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      billing_record_id INTEGER,
      message_type TEXT NOT NULL,
      recipient_number TEXT NOT NULL,
      message_body TEXT NOT NULL,
      provider_message_id TEXT,
      status TEXT NOT NULL DEFAULT 'Not Sent',
      error_message TEXT,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (billing_record_id) REFERENCES billing_records(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      admin_name TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.run('ALTER TABLE billing_record_countries ADD COLUMN panel_id INTEGER;');
  } catch (_) {}
  try {
    db.run('ALTER TABLE billing_record_countries ADD COLUMN panel_name_snapshot TEXT;');
  } catch (_) {}
}

function seedInitialData() {
  // 1. Admin account
  const adminRows = queryAll('SELECT id FROM admins LIMIT 1');
  if (adminRows.length === 0) {
    const adminUser = process.env.ADMIN_USERNAME && process.env.ADMIN_USERNAME !== '<SET_IN_SECURE_CONFIG>' 
      ? process.env.ADMIN_USERNAME 
      : 'admin';
    const adminPass = process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== '<SET_IN_SECURE_CONFIG>'
      ? process.env.ADMIN_PASSWORD
      : 'admin123';
    
    const { hash, salt } = hashPassword(adminPass);
    run(
      'INSERT INTO admins (username, password_hash, salt, name, role) VALUES (?, ?, ?, ?, ?)',
      [adminUser, hash, salt, 'KB MAX Administrator', 'Admin']
    );
    console.log(`Initialized default Admin account: ${adminUser}`);
  }

  // 2. Payment Methods
  const initialMethods = ['EasyPaisa', 'JazzCash', 'Bank Transfer', 'SadaPay', 'NayaPay', 'Other'];
  for (const method of initialMethods) {
    const exists = queryOne('SELECT id FROM payment_methods WHERE name = ?', [method]);
    if (!exists) {
      run('INSERT INTO payment_methods (name, status) VALUES (?, ?)', [method, 'Active']);
    }
  }

  // 3. Countries Dataset (Comprehensive Global List)
  const countriesData = [
    { name: 'Other all country', iso: 'OTHER', code: '+0', flag: '🌐' },
    { name: 'Tanzania', iso: 'TZ', code: '+255', flag: '🇹🇿' },
    { name: 'Malaysia', iso: 'MY', code: '+60', flag: '🇲🇾' },
    { name: 'Pakistan', iso: 'PK', code: '+92', flag: '🇵🇰' },
    { name: 'United Arab Emirates', iso: 'AE', code: '+971', flag: '🇦🇪' },
    { name: 'Saudi Arabia', iso: 'SA', code: '+966', flag: '🇸🇦' },
    { name: 'United Kingdom', iso: 'GB', code: '+44', flag: '🇬🇧' },
    { name: 'United States', iso: 'US', code: '+1', flag: '🇺🇸' },
    { name: 'Kenya', iso: 'KE', code: '+254', flag: '🇰🇪' },
    { name: 'South Africa', iso: 'ZA', code: '+27', flag: '🇿🇦' },
    { name: 'Nigeria', iso: 'NG', code: '+234', flag: '🇳🇬' },
    { name: 'Bangladesh', iso: 'BD', code: '+880', flag: '🇧🇩' },
    { name: 'India', iso: 'IN', code: '+91', flag: '🇮🇳' },
    { name: 'Indonesia', iso: 'ID', code: '+62', flag: '🇮🇩' },
    { name: 'Turkey', iso: 'TR', code: '+90', flag: '🇹🇷' },
    { name: 'Egypt', iso: 'EG', code: '+20', flag: '🇪🇬' },
    { name: 'Oman', iso: 'OM', code: '+968', flag: '🇴🇲' },
    { name: 'Qatar', iso: 'QA', code: '+974', flag: '🇶🇦' },
    { name: 'Bahrain', iso: 'BH', code: '+973', flag: '🇧🇭' },
    { name: 'Kuwait', iso: 'KW', code: '+965', flag: '🇰🇼' },
    { name: 'Germany', iso: 'DE', code: '+49', flag: '🇩🇪' },
    { name: 'France', iso: 'FR', code: '+33', flag: '🇫🇷' },
    { name: 'Canada', iso: 'CA', code: '+1', flag: '🇨🇦' },
    { name: 'Australia', iso: 'AU', code: '+61', flag: '🇦🇺' },
    { name: 'Singapore', iso: 'SG', code: '+65', flag: '🇸🇬' },
    { name: 'Thailand', iso: 'TH', code: '+66', flag: '🇹🇭' },
    { name: 'Philippines', iso: 'PH', code: '+63', flag: '🇵🇭' },
    { name: 'Sri Lanka', iso: 'LK', code: '+94', flag: '🇱🇰' },
    { name: 'Nepal', iso: 'NP', code: '+977', flag: '🇳🇵' },
    { name: 'Brazil', iso: 'BR', code: '+55', flag: '🇧🇷' },
    { name: 'Ghana', iso: 'GH', code: '+233', flag: '🇬🇭' },
    { name: 'Uganda', iso: 'UG', code: '+256', flag: '🇺🇬' },
    { name: 'Vietnam', iso: 'VN', code: '+84', flag: '🇻🇳' },
    { name: 'Morocco', iso: 'MA', code: '+212', flag: '🇲🇦' },
    { name: 'Afghanistan', iso: 'AF', code: '+93', flag: '🇦🇫' },
    { name: 'Albania', iso: 'AL', code: '+355', flag: '🇦🇱' },
    { name: 'Algeria', iso: 'DZ', code: '+213', flag: '🇩🇿' },
    { name: 'Andorra', iso: 'AD', code: '+376', flag: '🇦🇩' },
    { name: 'Angola', iso: 'AO', code: '+244', flag: '🇦🇴' },
    { name: 'Argentina', iso: 'AR', code: '+54', flag: '🇦🇷' },
    { name: 'Armenia', iso: 'AM', code: '+374', flag: '🇦🇲' },
    { name: 'Austria', iso: 'AT', code: '+43', flag: '🇦🇹' },
    { name: 'Azerbaijan', iso: 'AZ', code: '+994', flag: '🇦🇿' },
    { name: 'Bahamas', iso: 'BS', code: '+1242', flag: '🇧🇸' },
    { name: 'Barbados', iso: 'BB', code: '+1246', flag: '🇧🇧' },
    { name: 'Belarus', iso: 'BY', code: '+375', flag: '🇧🇾' },
    { name: 'Belgium', iso: 'BE', code: '+32', flag: '🇧🇪' },
    { name: 'Belize', iso: 'BZ', code: '+501', flag: '🇧🇿' },
    { name: 'Benin', iso: 'BJ', code: '+229', flag: '🇧🇯' },
    { name: 'Bhutan', iso: 'BT', code: '+975', flag: '🇧🇹' },
    { name: 'Bolivia', iso: 'BO', code: '+591', flag: '🇧🇴' },
    { name: 'Bosnia and Herzegovina', iso: 'BA', code: '+387', flag: '🇧🇦' },
    { name: 'Botswana', iso: 'BW', code: '+267', flag: '🇧🇼' },
    { name: 'Brunei', iso: 'BN', code: '+673', flag: '🇧🇳' },
    { name: 'Bulgaria', iso: 'BG', code: '+359', flag: '🇧🇬' },
    { name: 'Burkina Faso', iso: 'BF', code: '+226', flag: '🇧🇫' },
    { name: 'Burundi', iso: 'BI', code: '+257', flag: '🇧🇮' },
    { name: 'Cambodia', iso: 'KH', code: '+855', flag: '🇰🇭' },
    { name: 'Cameroon', iso: 'CM', code: '+237', flag: '🇨🇲' },
    { name: 'Cape Verde', iso: 'CV', code: '+238', flag: '🇨🇻' },
    { name: 'Central African Republic', iso: 'CF', code: '+236', flag: '🇨🇫' },
    { name: 'Chad', iso: 'TD', code: '+235', flag: '🇹🇩' },
    { name: 'Chile', iso: 'CL', code: '+56', flag: '🇨🇱' },
    { name: 'China', iso: 'CN', code: '+86', flag: '🇨🇳' },
    { name: 'Colombia', iso: 'CO', code: '+57', flag: '🇨🇴' },
    { name: 'Comoros', iso: 'KM', code: '+269', flag: '🇰🇲' },
    { name: 'Congo', iso: 'CG', code: '+242', flag: '🇨🇬' },
    { name: 'DR Congo', iso: 'CD', code: '+243', flag: '🇨🇩' },
    { name: 'Costa Rica', iso: 'CR', code: '+506', flag: '🇨🇷' },
    { name: 'Croatia', iso: 'HR', code: '+385', flag: '🇭🇷' },
    { name: 'Cuba', iso: 'CU', code: '+53', flag: '🇨🇺' },
    { name: 'Cyprus', iso: 'CY', code: '+357', flag: '🇨🇾' },
    { name: 'Czech Republic', iso: 'CZ', code: '+420', flag: '🇨🇿' },
    { name: 'Denmark', iso: 'DK', code: '+45', flag: '🇩🇰' },
    { name: 'Djibouti', iso: 'DJ', code: '+253', flag: '🇩🇯' },
    { name: 'Dominica', iso: 'DM', code: '+1767', flag: '🇩🇲' },
    { name: 'Dominican Republic', iso: 'DO', code: '+1809', flag: '🇩🇴' },
    { name: 'Ecuador', iso: 'EC', code: '+593', flag: '🇪🇨' },
    { name: 'El Salvador', iso: 'SV', code: '+503', flag: '🇸🇻' },
    { name: 'Equatorial Guinea', iso: 'GQ', code: '+240', flag: '🇬🇶' },
    { name: 'Eritrea', iso: 'ER', code: '+291', flag: '🇪🇷' },
    { name: 'Estonia', iso: 'EE', code: '+372', flag: '🇪🇪' },
    { name: 'Eswatini', iso: 'SZ', code: '+268', flag: '🇸🇿' },
    { name: 'Ethiopia', iso: 'ET', code: '+251', flag: '🇪🇹' },
    { name: 'Fiji', iso: 'FJ', code: '+679', flag: '🇫🇯' },
    { name: 'Finland', iso: 'FI', code: '+358', flag: '🇫🇮' },
    { name: 'Gabon', iso: 'GA', code: '+241', flag: '🇬🇦' },
    { name: 'Gambia', iso: 'GM', code: '+220', flag: '🇬🇲' },
    { name: 'Georgia', iso: 'GE', code: '+995', flag: '🇬🇪' },
    { name: 'Greece', iso: 'GR', code: '+30', flag: '🇬🇷' },
    { name: 'Grenada', iso: 'GD', code: '+1473', flag: '🇬🇩' },
    { name: 'Guatemala', iso: 'GT', code: '+502', flag: '🇬🇹' },
    { name: 'Guinea', iso: 'GN', code: '+224', flag: '🇬🇳' },
    { name: 'Guinea-Bissau', iso: 'GW', code: '+245', flag: '🇬🇼' },
    { name: 'Guyana', iso: 'GY', code: '+592', flag: '🇬🇾' },
    { name: 'Haiti', iso: 'HT', code: '+509', flag: '🇭🇹' },
    { name: 'Honduras', iso: 'HN', code: '+504', flag: '🇭🇳' },
    { name: 'Hong Kong', iso: 'HK', code: '+852', flag: '🇭🇰' },
    { name: 'Hungary', iso: 'HU', code: '+36', flag: '🇭🇺' },
    { name: 'Iceland', iso: 'IS', code: '+354', flag: '🇮🇸' },
    { name: 'Iran', iso: 'IR', code: '+98', flag: '🇮🇷' },
    { name: 'Iraq', iso: 'IQ', code: '+964', flag: '🇮🇶' },
    { name: 'Ireland', iso: 'IE', code: '+353', flag: '🇮🇪' },
    { name: 'Israel', iso: 'IL', code: '+972', flag: '🇮🇱' },
    { name: 'Italy', iso: 'IT', code: '+39', flag: '🇮🇹' },
    { name: 'Ivory Coast', iso: 'CI', code: '+225', flag: '🇨🇮' },
    { name: 'Jamaica', iso: 'JM', code: '+1876', flag: '🇯🇲' },
    { name: 'Japan', iso: 'JP', code: '+81', flag: '🇯🇵' },
    { name: 'Jordan', iso: 'JO', code: '+962', flag: '🇯🇴' },
    { name: 'Kazakhstan', iso: 'KZ', code: '+7', flag: '🇰🇿' },
    { name: 'Kiribati', iso: 'KI', code: '+686', flag: '🇰🇮' },
    { name: 'Kyrgyzstan', iso: 'KG', code: '+996', flag: '🇰🇬' },
    { name: 'Laos', iso: 'LA', code: '+856', flag: '🇱🇦' },
    { name: 'Latvia', iso: 'LV', code: '+371', flag: '🇱🇻' },
    { name: 'Lebanon', iso: 'LB', code: '+961', flag: '🇱🇧' },
    { name: 'Lesotho', iso: 'LS', code: '+266', flag: '🇱🇸' },
    { name: 'Liberia', iso: 'LR', code: '+231', flag: '🇱🇷' },
    { name: 'Libya', iso: 'LY', code: '+218', flag: '🇱🇾' },
    { name: 'Liechtenstein', iso: 'LI', code: '+423', flag: '🇱🇮' },
    { name: 'Lithuania', iso: 'LT', code: '+370', flag: '🇱🇹' },
    { name: 'Luxembourg', iso: 'LU', code: '+352', flag: '🇱🇺' },
    { name: 'Macau', iso: 'MO', code: '+853', flag: '🇲🇴' },
    { name: 'Madagascar', iso: 'MG', code: '+261', flag: '🇲🇬' },
    { name: 'Malawi', iso: 'MW', code: '+265', flag: '🇲🇼' },
    { name: 'Maldives', iso: 'MV', code: '+960', flag: '🇲🇻' },
    { name: 'Mali', iso: 'ML', code: '+223', flag: '🇲🇱' },
    { name: 'Malta', iso: 'MT', code: '+356', flag: '🇲🇹' },
    { name: 'Mauritania', iso: 'MR', code: '+222', flag: '🇲🇷' },
    { name: 'Mauritius', iso: 'MU', code: '+230', flag: '🇲🇺' },
    { name: 'Mexico', iso: 'MX', code: '+52', flag: '🇲🇽' },
    { name: 'Moldova', iso: 'MD', code: '+373', flag: '🇲🇩' },
    { name: 'Monaco', iso: 'MC', code: '+377', flag: '🇲🇨' },
    { name: 'Mongolia', iso: 'MN', code: '+976', flag: '🇲🇳' },
    { name: 'Montenegro', iso: 'ME', code: '+382', flag: '🇲🇪' },
    { name: 'Mozambique', iso: 'MZ', code: '+258', flag: '🇲🇿' },
    { name: 'Myanmar', iso: 'MM', code: '+95', flag: '🇲🇲' },
    { name: 'Namibia', iso: 'NA', code: '+264', flag: '🇳🇦' },
    { name: 'Netherlands', iso: 'NL', code: '+31', flag: '🇳🇱' },
    { name: 'New Zealand', iso: 'NZ', code: '+64', flag: '🇳🇿' },
    { name: 'Nicaragua', iso: 'NI', code: '+505', flag: '🇳🇮' },
    { name: 'Niger', iso: 'NE', code: '+227', flag: '🇳🇪' },
    { name: 'North Macedonia', iso: 'MK', code: '+389', flag: '🇲🇰' },
    { name: 'Norway', iso: 'NO', code: '+47', flag: '🇳🇴' },
    { name: 'Palestine', iso: 'PS', code: '+970', flag: '🇵🇸' },
    { name: 'Panama', iso: 'PA', code: '+507', flag: '🇵🇦' },
    { name: 'Papua New Guinea', iso: 'PG', code: '+675', flag: '🇵🇬' },
    { name: 'Paraguay', iso: 'PY', code: '+595', flag: '🇵🇾' },
    { name: 'Peru', iso: 'PE', code: '+51', flag: '🇵🇪' },
    { name: 'Poland', iso: 'PL', code: '+48', flag: '🇵🇱' },
    { name: 'Portugal', iso: 'PT', code: '+351', flag: '🇵🇹' },
    { name: 'Romania', iso: 'RO', code: '+40', flag: '🇷🇴' },
    { name: 'Russia', iso: 'RU', code: '+7', flag: '🇷🇺' },
    { name: 'Rwanda', iso: 'RW', code: '+250', flag: '🇷🇼' },
    { name: 'Senegal', iso: 'SN', code: '+221', flag: '🇸🇳' },
    { name: 'Serbia', iso: 'RS', code: '+381', flag: '🇷🇸' },
    { name: 'Sierra Leone', iso: 'SL', code: '+232', flag: '🇸🇱' },
    { name: 'Slovakia', iso: 'SK', code: '+421', flag: '🇸🇰' },
    { name: 'Slovenia', iso: 'SI', code: '+386', flag: '🇸🇮' },
    { name: 'Somalia', iso: 'SO', code: '+252', flag: '🇸🇴' },
    { name: 'South Korea', iso: 'KR', code: '+82', flag: '🇰🇷' },
    { name: 'South Sudan', iso: 'SS', code: '+211', flag: '🇸🇸' },
    { name: 'Spain', iso: 'ES', code: '+34', flag: '🇪🇸' },
    { name: 'Sudan', iso: 'SD', code: '+249', flag: '🇸🇩' },
    { name: 'Suriname', iso: 'SR', code: '+597', flag: '🇸🇷' },
    { name: 'Sweden', iso: 'SE', code: '+46', flag: '🇸🇪' },
    { name: 'Switzerland', iso: 'CH', code: '+41', flag: '🇨🇭' },
    { name: 'Syria', iso: 'SY', code: '+963', flag: '🇸🇾' },
    { name: 'Taiwan', iso: 'TW', code: '+886', flag: '🇹🇼' },
    { name: 'Tajikistan', iso: 'TJ', code: '+992', flag: '🇹🇯' },
    { name: 'Togo', iso: 'TG', code: '+228', flag: '🇹🇬' },
    { name: 'Trinidad and Tobago', iso: 'TT', code: '+1868', flag: '🇹🇹' },
    { name: 'Tunisia', iso: 'TN', code: '+216', flag: '🇹🇳' },
    { name: 'Turkmenistan', iso: 'TM', code: '+993', flag: '🇹🇲' },
    { name: 'Ukraine', iso: 'UA', code: '+380', flag: '🇺🇦' },
    { name: 'Uruguay', iso: 'UY', code: '+598', flag: '🇺🇾' },
    { name: 'Uzbekistan', iso: 'UZ', code: '+998', flag: '🇺🇿' },
    { name: 'Venezuela', iso: 'VE', code: '+58', flag: '🇻🇪' },
    { name: 'Yemen', iso: 'YE', code: '+967', flag: '🇾🇪' },
    { name: 'Zambia', iso: 'ZM', code: '+260', flag: '🇿🇲' },
    { name: 'Zimbabwe', iso: 'ZW', code: '+263', flag: '🇿🇼' },
  ];

  for (const c of countriesData) {
    const exists充满 = queryOne('SELECT id FROM countries WHERE iso_code = ?', [c.iso]);
    if (!exists充满) {
      run(
        'INSERT INTO countries (name, iso_code, phone_code, flag, status) VALUES (?, ?, ?, ?, ?)',
        [c.name, c.iso, c.code, c.flag, 'Active']
      );
    }
  }

  // 4. Default Panel (KB MAX - LAMIX SMS PANAL)
  let panel = queryOne('SELECT id, name FROM panels WHERE name = ? OR name = ?', ['KB MAX - LAMIX SMS PANAL', 'KB MAX - LAMIX SMS PANEL']);
  if (!panel) {
    run('INSERT INTO panels (name, status) VALUES (?, ?)', ['KB MAX - LAMIX SMS PANAL', 'Active']);
    panel = queryOne('SELECT id, name FROM panels WHERE name = ?', ['KB MAX - LAMIX SMS PANAL']);
  } else if (panel.name === 'KB MAX - LAMIX SMS PANEL') {
    run('UPDATE panels SET name = ? WHERE id = ?', ['KB MAX - LAMIX SMS PANAL', panel.id]);
    panel.name = 'KB MAX - LAMIX SMS PANAL';
  }

  if (panel) {
    const panelId = panel.id;
    const defaultRates: Record<string, number> = {
      TZ: 4.0,
      MY: 3.0,
      PK: 2.0,
      AE: 6.5,
      SA: 5.5,
      GB: 8.0,
      US: 7.5,
      KE: 4.5,
      ZA: 5.0,
      NG: 3.8,
    };

    for (const [iso, rate] of Object.entries(defaultRates)) {
      const country = queryOne('SELECT id FROM countries WHERE iso_code = ?', [iso]);
      if (country) {
        const rateExists = queryOne(
          'SELECT id FROM panel_country_rates WHERE panel_id = ? AND country_id = ?',
          [panelId, country.id]
        );
        if (!rateExists) {
          run(
            'INSERT INTO panel_country_rates (panel_id, country_id, rate, status) VALUES (?, ?, ?, ?)',
            [panelId, country.id, rate, 'Active']
          );
        }
      }
    }
  }

  // 5. Default Settings
  const defaultSettings: Record<string, string> = {
    business_name: 'KB MAX',
    billing_cycle: 'Haftawar (Weekly)',
    default_clearance_day: 'Wednesday',
    currency: 'PKR',
    currency_symbol: 'Rs.',
    slip_header: '📋 KBMAX PAYMENT DETAILS',
    slip_footer: 'Thank you for choosing KB MAX!',
    note_text: 'Payment cleared on schedule',
    payment_confirmation_message: `╔══════════════════════════════════╗
💳 KBMAX PAYMENT
╚══════════════════════════════════╝

📅 {{date_range}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ YOUR PAYMENT HAS BEEN COMPLETED

💸 PAYMENT SENT SUCCESSFULLY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ Thank you for your hard work and support.

🔥 STAY ACTIVE • STAY STRONG
💎 KBMAX TEAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    professional_slip_template: `📋 KBMAX PAYMENT DETAILS
━━━━━━━━━━━━━━━━━━━━
👤 Client Name: {{client_name}}
📅 Billing Period: {{billing_period_start}} ➔ {{billing_period_end}}
🔄 Billing Cycle: {{billing_cycle}}
━━━━━━━━━━━━━━━━━━━━

{{country_rows}}
━━━━━━━━━━━━━━━━━━━━

📊 TOTAL SMS COUNT: {{total_sms}} SMS
💰 CALCULATED TOTAL PKR: {{currency_symbol}} {{calculated_total}} {{currency}}
💵 NET PAYABLE (GRAND TOTAL): {{currency_symbol}} {{net_payable}} {{currency}}
━━━━━━━━━━━━━━━━━━━━

⏰ PAYMENT SCHEDULE:
📌 Monday to Sunday record payment is cleared on Wednesday (Budh ko payment clearance)
━━━━━━━━━━━━━━━━━━━━

💳 KBMAX PAYMENT DETAILS:
• Method: {{payment_method}}
• Details: {{payment_details}}

📝 Note: {{notes}}
━━━━━━━━━━━━━━━━━━━━
{{slip_footer}}`,
    simple_slip_template: `*KBMAX PAYMENT DETAILS*
👤 *Client:* {{client_name}}
📅 *Period:* {{billing_period_start}} to {{billing_period_end}}
📱 *Panel:* {{panel_name}}

{{simple_country_rows}}
------------------------------
*Total SMS:* {{total_sms}} SMS
*Total Amount:* {{currency_symbol}} {{net_payable}} {{currency}}
💳 *KBMAX Payment Details:* {{payment_details}}
*Status:* {{payment_status}}

Thank you for choosing KB MAX!`,
    whatsapp_mode: 'direct_link',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const exists = queryOne('SELECT id, setting_value FROM settings WHERE setting_key = ?', [key]);
    if (!exists) {
      run('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, value]);
    } else if (
      key === 'payment_confirmation_message' &&
      exists.setting_value &&
      (exists.setting_value.includes('Payment done ho chuki hai.') || exists.setting_value.includes('STAY LOYAL'))
    ) {
      run('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
    }
  }

  // Clean existing billing records slips if they contain "Stay Loyal"
  const recordsWithStayLoyal = queryAll('SELECT id, professional_slip, simple_slip FROM billing_records');
  for (const rec of recordsWithStayLoyal) {
    let pro = rec.professional_slip || '';
    let sim = rec.simple_slip || '';
    let updated = false;

    if (pro.includes('Stay Loyal • ') || pro.includes('STAY LOYAL • ') || pro.includes('• Stay Loyal')) {
      pro = pro.replace(/• Stay Loyal/gi, '').replace(/Stay Loyal • /gi, '').replace(/STAY LOYAL • /gi, '');
      updated = true;
    }
    if (sim.includes('Stay Loyal • ') || sim.includes('STAY LOYAL • ') || sim.includes('• Stay Loyal')) {
      sim = sim.replace(/• Stay Loyal/gi, '').replace(/Stay Loyal • /gi, '').replace(/STAY LOYAL • /gi, '');
      updated = true;
    }
    if (updated) {
      run('UPDATE billing_records SET professional_slip = ?, simple_slip = ? WHERE id = ?', [pro, sim, rec.id]);
    }
  }

  // 6. Seed Sample Clients & Weekly Records if none exist
  const existingClients = queryAll('SELECT id FROM clients LIMIT 1');
  if (existingClients.length === 0) {
    const jazzCash = queryOne('SELECT id FROM payment_methods WHERE name = ?', ['JazzCash']);
    const easyPaisa = queryOne('SELECT id FROM payment_methods WHERE name = ?', ['EasyPaisa']);
    const bankTransfer = queryOne('SELECT id FROM payment_methods WHERE name = ?', ['Bank Transfer']);

    // Client 1: Aatskamii
    run(
      `INSERT INTO clients (client_name, registration_date, payment_method_id, payment_details, whatsapp_number, additional_info, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Aatskamii',
        '2026-08-01',
        jazzCash ? jazzCash.id : 1,
        'JazzCash: 80049388 (Title: Kamik)',
        '923001234567',
        'VIP Client - Daily SMS delivery',
        'Active',
      ]
    );
    const client1 = queryOne('SELECT id FROM clients WHERE client_name = ?', ['Aatskamii']);

    // Client 2: Muhammad Ali
    run(
      `INSERT INTO clients (client_name, registration_date, payment_method_id, payment_details, whatsapp_number, additional_info, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Muhammad Ali',
        '2026-08-01',
        easyPaisa ? easyPaisa.id : 1,
        'EasyPaisa: 03219876543 (Title: M. Ali)',
        '923219876543',
        'Regular weekly billing',
        'Active',
      ]
    );
    const client2 = queryOne('SELECT id FROM clients WHERE client_name = ?', ['Muhammad Ali']);

    // Client 3: Ahmed Khan
    run(
      `INSERT INTO clients (client_name, registration_date, payment_method_id, payment_details, whatsapp_number, additional_info, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Ahmed Khan',
        '2026-08-15',
        bankTransfer ? bankTransfer.id : 1,
        'Meezan Bank: 010203040506 (Title: Ahmed Khan)',
        '923335557788',
        'High volume international routes',
        'Active',
      ]
    );

    // Create demonstration weekly record for Aatskamii
    if (client1 && panel) {
      const pRecord = generateSlipText({
        client_name: 'Aatskamii',
        panel_name: 'KB MAX - LAMIX SMS PANEL',
        start_date: '2026-08-24',
        end_date: '2026-08-29',
        cycle: 'Haftawar (Weekly)',
        payment_method: 'JazzCash',
        payment_details: 'JazzCash: 80049388 (Title: Kamik)',
        notes: 'Payment cleared on schedule',
        countries: [
          { name: 'Tanzania', flag: '🇹🇿', sms: 255, rate: 4.0, total: 1020 },
          { name: 'Malaysia', flag: '🇲🇾', sms: 566, rate: 3.0, total: 1698 },
          { name: 'Pakistan', flag: '🇵🇰', sms: 36, rate: 2.0, total: 72 },
        ],
        total_sms: 857,
        total_amount: 2790,
      });

      run(
        `INSERT INTO billing_records (
          client_id, panel_id, client_name_snapshot, panel_name_snapshot,
          billing_period_start, billing_period_end, billing_cycle,
          total_sms, calculated_total, net_payable,
          payment_method_id, payment_method_name_snapshot, payment_details_snapshot,
          payment_status, payment_date, clearance_date, professional_slip, simple_slip, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          client1.id,
          panel.id,
          'Aatskamii',
          'KB MAX - LAMIX SMS PANEL',
          '2026-08-24',
          '2026-08-29',
          'Haftawar (Weekly)',
          857,
          2790,
          2790,
          jazzCash ? jazzCash.id : 1,
          'JazzCash',
          'JazzCash: 80049388 (Title: Kamik)',
          'Payment Completed',
          '2026-08-27',
          '2026-08-27',
          pRecord.professional,
          pRecord.simple,
          'Payment cleared on schedule',
        ]
      );

      const record = queryOne('SELECT id FROM billing_records WHERE client_id = ? ORDER BY id DESC LIMIT 1', [client1.id]);
      if (record) {
        const tz = queryOne('SELECT id FROM countries WHERE iso_code = ?', ['TZ']);
        const my = queryOne('SELECT id FROM countries WHERE iso_code = ?', ['MY']);
        const pk = queryOne('SELECT id FROM countries WHERE iso_code = ?', ['PK']);

        if (tz) {
          run(
            `INSERT INTO billing_record_countries (billing_record_id, country_id, country_name_snapshot, country_code_snapshot, flag_snapshot, sms_count, rate_snapshot, country_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [record.id, tz.id, 'Tanzania', 'TZ', '🇹🇿', 255, 4.0, 1020]
          );
        }
        if (my) {
          run(
            `INSERT INTO billing_record_countries (billing_record_id, country_id, country_name_snapshot, country_code_snapshot, flag_snapshot, sms_count, rate_snapshot, country_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [record.id, my.id, 'Malaysia', 'MY', '🇲🇾', 566, 3.0, 1698]
          );
        }
        if (pk) {
          run(
            `INSERT INTO billing_record_countries (billing_record_id, country_id, country_name_snapshot, country_code_snapshot, flag_snapshot, sms_count, rate_snapshot, country_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [record.id, pk.id, 'Pakistan', 'PK', '🇵🇰', 36, 2.0, 72]
          );
        }

        // WhatsApp message log
        run(
          `INSERT INTO whatsapp_messages (client_id, billing_record_id, message_type, recipient_number, message_body, status, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            client1.id,
            record.id,
            'Billing Slip',
            '923001234567',
            pRecord.professional,
            'Sent',
            '2026-08-27 10:30:00',
          ]
        );
      }
    }

    // Record for Muhammad Ali
    if (client2 && panel) {
      const pRecord2 = generateSlipText({
        client_name: 'Muhammad Ali',
        panel_name: 'KB MAX - LAMIX SMS PANEL',
        start_date: '2026-08-24',
        end_date: '2026-08-30',
        cycle: 'Haftawar (Weekly)',
        payment_method: 'EasyPaisa',
        payment_details: 'EasyPaisa: 03219876543 (Title: M. Ali)',
        notes: 'Payment scheduled for Wednesday',
        countries: [
          { name: 'Pakistan', flag: '🇵🇰', sms: 1000, rate: 2.0, total: 2000 },
        ],
        total_sms: 1000,
        total_amount: 2000,
      });

      run(
        `INSERT INTO billing_records (
          client_id, panel_id, client_name_snapshot, panel_name_snapshot,
          billing_period_start, billing_period_end, billing_cycle,
          total_sms, calculated_total, net_payable,
          payment_method_id, payment_method_name_snapshot, payment_details_snapshot,
          payment_status, clearance_date, professional_slip, simple_slip, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          client2.id,
          panel.id,
          'Muhammad Ali',
          'KB MAX - LAMIX SMS PANEL',
          '2026-08-24',
          '2026-08-30',
          'Haftawar (Weekly)',
          1000,
          2000,
          2000,
          easyPaisa ? easyPaisa.id : 1,
          'EasyPaisa',
          'EasyPaisa: 03219876543 (Title: M. Ali)',
          'Payment Pending',
          '2026-09-02',
          pRecord2.professional,
          pRecord2.simple,
          'Payment scheduled for Wednesday',
        ]
      );
      const record2 = queryOne('SELECT id FROM billing_records WHERE client_id = ? ORDER BY id DESC LIMIT 1', [client2.id]);
      if (record2) {
        const pk = queryOne('SELECT id FROM countries WHERE iso_code = ?', ['PK']);
        if (pk) {
          run(
            `INSERT INTO billing_record_countries (billing_record_id, country_id, country_name_snapshot, country_code_snapshot, flag_snapshot, sms_count, rate_snapshot, country_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [record2.id, pk.id, 'Pakistan', 'PK', '🇵🇰', 1000, 2.0, 2000]
          );
        }
      }
    }

    // Audit log
    run(
      'INSERT INTO audit_logs (admin_name, action, target_type, details) VALUES (?, ?, ?, ?)',
      ['System', 'INITIALIZE', 'DATABASE', 'Seeded initial panels, countries, rates, and demonstration records.']
    );
  }
}

// Slip generation helper
export function generateSlipText(params: {
  client_name: string;
  panel_name: string;
  start_date: string;
  end_date: string;
  cycle?: string;
  payment_method: string;
  payment_details: string;
  notes?: string;
  countries: {
    name: string;
    flag: string;
    sms: number;
    rate: number;
    total: number;
    panel_name?: string;
    panel_id?: number;
  }[];
  total_sms: number;
  total_amount: number;
  currency_symbol?: string;
  currency?: string;
}): { professional: string; simple: string } {
  const sym = params.currency_symbol || 'Rs.';
  const cur = params.currency || 'PKR';
  const cycle = params.cycle || 'Haftawar (Weekly)';

  // Group countries by panel if multiple panels exist
  const panelsMap = new Map<string, typeof params.countries>();
  for (const c of params.countries) {
    const pName = c.panel_name || params.panel_name || 'SMS PANEL';
    if (!panelsMap.has(pName)) {
      panelsMap.set(pName, []);
    }
    panelsMap.get(pName)!.push(c);
  }

  const isMultiPanel = panelsMap.size > 1;

  let bodyContent = '';

  if (!isMultiPanel) {
    // Single panel formatting with clear Panel identifier
    const pTitle = params.panel_name || 'KB MAX - LAMIX SMS PANAL';
    const countryBlocks = params.countries
      .map(
        (c) => `🌐 ${c.flag} ${c.name.toUpperCase()}
• Total SMS: ${(c.sms || 0).toLocaleString()} SMS
• Fixed Rate: ${sym} ${(c.rate || 0).toFixed(2)} / SMS
• Country Total: ${sym} ${(c.total || 0).toLocaleString()} ${cur}`
      )
      .join('\n\n');

    bodyContent = `📱 PANEL: ${pTitle.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━
${countryBlocks}`;
  } else {
    // Multi-panel formatting listing all panels together
    const panelBlocks: string[] = [];
    let pIdx = 1;

    for (const [panelTitle, panelCountries] of panelsMap.entries()) {
      const panelSms = panelCountries.reduce((sum, item) => sum + (item.sms || 0), 0);
      const panelPkr = panelCountries.reduce((sum, item) => sum + (item.total || 0), 0);

      const cBlocks = panelCountries
        .map(
          (c) => `🌐 ${c.flag} ${c.name.toUpperCase()}
• Total SMS: ${(c.sms || 0).toLocaleString()} SMS
• Fixed Rate: ${sym} ${(c.rate || 0).toFixed(2)} / SMS
• Country Total: ${sym} ${(c.total || 0).toLocaleString()} ${cur}`
        )
        .join('\n\n');

      panelBlocks.push(
        `📱 PANEL ${pIdx}: ${panelTitle.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━
${cBlocks}
📊 Panel Subtotal: ${panelSms.toLocaleString()} SMS | ${sym} ${panelPkr.toLocaleString()} ${cur}`
      );
      pIdx++;
    }

    bodyContent = panelBlocks.join('\n\n━━━━━━━━━━━━━━━━━━━━\n');
  }

  const headerTitle = '📋 KBMAX PAYMENT DETAILS';

  const professional = `${headerTitle}
━━━━━━━━━━━━━━━━━━━━
👤 Client Name: ${params.client_name}
📅 Payment Period: ${params.start_date} ➔ ${params.end_date}
🔄 Billing Cycle: ${cycle}
━━━━━━━━━━━━━━━━━━━━
${bodyContent}
━━━━━━━━━━━━━━━━━━━━
📊 TOTAL SMS COUNT: ${(params.total_sms || 0).toLocaleString()} SMS
💰 CALCULATED TOTAL PKR: ${sym} ${(params.total_amount || 0).toLocaleString()} ${cur}
━━━━━━━━━━━━━━━━━━━━
⏰ PAYMENT SCHEDULE:
📌 Monday to Sunday record payment is cleared on Wednesday
━━━━━━━━━━━━━━━━━━━━
💳 KBMAX PAYMENT DETAILS:
• Method: ${params.payment_method}
• Details: ${params.payment_details}
━━━━━━━━━━━━━━━━━━━━
Thank you for your support! ❤️
Stay Active • Stay Strong 💯🔥`;

  // Simple country lines
  const simpleCountryLines = params.countries
    .map(
      (c) =>
        `• ${c.flag} ${c.name}${c.panel_name ? ` (${c.panel_name})` : ''}: ${(c.sms || 0).toLocaleString()} SMS × ${sym}${(c.rate || 0).toFixed(2)} = ${sym}${(c.total || 0).toLocaleString()}`
    )
    .join('\n');

  const simple = `*KBMAX PAYMENT DETAILS*
━━━━━━━━━━━━━━━━━━━━
👤 *Client:* ${params.client_name}
📅 *Payment Period:* ${params.start_date} to ${params.end_date}
🔄 *Cycle:* ${cycle}
------------------------------
${simpleCountryLines}
------------------------------
*Total SMS:* ${(params.total_sms || 0).toLocaleString()} SMS
*Calculated Total:* ${sym} ${(params.total_amount || 0).toLocaleString()} ${cur}
------------------------------
💳 *KBMAX Payment Details:*
• *Method:* ${params.payment_method}
• *Details:* ${params.payment_details}
------------------------------
Thank you for your support! ❤️
Stay Active • Stay Strong 💯🔥`;

  return { professional, simple };
}

// SQL Query helper methods
export function queryAll<T = any>(sql: string, params: SqlValue[] = []): T[] {
  if (!db) return [];
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params: SqlValue[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sql: string, params: SqlValue[] = []): { lastInsertRowid: number; changes: number } {
  if (!db) return { lastInsertRowid: 0, changes: 0 };
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  stmt.step();
  stmt.free();

  const lastIdRow = db.exec('SELECT last_insert_rowid() as id');
  const lastId = (lastIdRow[0]?.values[0]?.[0] as number) || 0;

  const changesRow = db.exec('SELECT changes() as count');
  const changes = (changesRow[0]?.values[0]?.[0] as number) || 0;

  saveDatabase();
  return { lastInsertRowid: lastId, changes };
}

export function exportDatabaseBackup(): { data: string; filename: string } {
  saveDatabase();
  const fileBuffer = fs.readFileSync(DB_FILE);
  return {
    data: fileBuffer.toString('base64'),
    filename: `kbmax_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
  };
}

export function restoreDatabaseBackup(base64Data: string): boolean {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    db.close();
    fs.writeFileSync(DB_FILE, buffer);
    db = new SQL.Database(buffer);
    db.run('PRAGMA foreign_keys = ON;');
    return true;
  } catch (err) {
    console.error('Restore error:', err);
    return false;
  }
}
