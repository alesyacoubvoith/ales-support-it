import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGINS || "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-User-Id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const TICKET_CATEGORIES = [
  "Matériel / PC",
  "Réseau / Wifi",
  "Logiciel / Licence",
  "Imprimante / Périphérique",
  "Accès / Identifiants",
  "Autre",
];
const TICKET_PRIORITIES = ["Basse", "Moyenne", "Haute", "Urgente"];
const TICKET_STATUSES = ["Nouveau", "En cours", "En attente pièce", "Résolu", "Fermé"];
const STOCK_CATEGORIES = [
  "Câbles & Adaptateurs",
  "Écrans & Moniteurs",
  "Claviers & Souris",
  "PC Portable / Tour",
  "Composants / RAM / SSD",
  "Toners & Cartouches",
  "Casques & Audio",
];
const ASSET_TYPES = ["Ordinateur", "Imprimante", "Tablette"];
const ASSET_STATUSES = ["En service", "En stock", "En panne", "Réformé"];

const SEED_ADMINS = [
  { id: "EMP-ALES", name: "Ales", role: "admin", title: "Technicien Support IT", can_access_parc: true },
  { id: "EMP-SAM", name: "Sam", role: "admin", title: "Technicien Support IT", can_access_parc: true },
  { id: "EMP-IT", name: "Admin IT", role: "admin", title: "Service IT", can_access_parc: true },
];

const SEED_NAMES = {
  "EMP-001": "Marie Dupont",
  "EMP-002": "Lucas Martin",
  "EMP-003": "Sophie Bernard",
  "EMP-ALES": "Ales",
  "EMP-SAM": "Sam",
  "EMP-IT": "Admin IT",
};

const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

// Persistent JSON file store (data/db.json)
let DB = {
  users: [],
  tickets: [],
  ticketComments: [],
  inventory: [],
  reminders: [],
  assets: [],
  logs: [],
  files: [],
};

function saveDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(DB, null, 2), "utf8");
  fs.renameSync(tmpFile, DB_FILE);
}

function getReqUser(req) {
  const raw = req.headers["x-user-id"];
  if (!raw) return null;
  const uid = String(raw).trim().toUpperCase();
  return DB.users.find((u) => u.id === uid) || null;
}

function seed() {
  const base = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  if (DB.users.length === 0) {
    DB.users.push(...SEED_ADMINS.map((u) => ({ ...u })));
  }

  if (DB.tickets.length === 0) {
    const samples = [
      ["PC ne démarre plus au bureau 204", "Écran noir au démarrage, voyant orange clignote.", "Matériel / PC", "Haute", "En cours", "EMP-001", "EMP-ALES", 2, ""],
      ["Wifi instable en salle de réunion", "La connexion coupe toutes les 10 min pendant les visios.", "Réseau / Wifi", "Moyenne", "Nouveau", "EMP-002", null, 1, ""],
      ["Licence Office expirée", "Impossible d'ouvrir Excel, message de licence.", "Logiciel / Licence", "Haute", "En attente pièce", "EMP-003", "EMP-SAM", 3, ""],
      ["Imprimante étage 2 bourrage papier", "Bourrage récurrent sur le bac 1.", "Imprimante / Périphérique", "Basse", "Résolu", "EMP-001", "EMP-ALES", 5, "Galets d'entraînement nettoyés et remplacés."],
      ["Mot de passe oublié messagerie", "Compte verrouillé après plusieurs tentatives.", "Accès / Identifiants", "Urgente", "Nouveau", "EMP-002", null, 0, ""],
      ["Casque micro ne fonctionne plus", "Le micro n'est plus détecté sur Teams.", "Casques & Audio", "Moyenne", "En cours", "EMP-003", "EMP-ALES", 1, ""],
      ["Nouvel écran à configurer", "Besoin d'un second écran pour le poste logistique.", "Matériel / PC", "Basse", "Fermé", "EMP-002", "EMP-SAM", 8, "Second écran 24\" installé avec câble DisplayPort."],
      ["VPN ne se connecte pas", "Erreur d'authentification sur le client VPN en télétravail.", "Réseau / Wifi", "Haute", "Nouveau", "EMP-003", null, 0, ""],
      ["PC portable surchauffe et s'éteint", "Ventilateur bruyant puis arrêt brutal en visio.", "Matériel / PC", "Haute", "Résolu", "EMP-001", "EMP-ALES", 10, "Nettoyage poussière ventilateur + pâte thermique changée."],
      ["Coupures Wifi open space aile Nord", "Perte de signal fréquente en matinée.", "Réseau / Wifi", "Haute", "Résolu", "EMP-003", "EMP-SAM", 12, "Point d'accès redémarré et canal Wifi ajusté."],
      ["Imprimante accueil hors ligne", "Impossible d'imprimer les bons de livraison.", "Imprimante / Périphérique", "Moyenne", "Résolu", "EMP-002", "EMP-ALES", 14, "IP fixe reconfigurée sur le serveur d'impression."],
      ["Station d'accueil USB-C non reconnue", "Écrans externes ne s'allument plus via le dock.", "Matériel / PC", "Moyenne", "Fermé", "EMP-001", "EMP-SAM", 18, "Firmware du dock mis à jour + câble USB-C remplacé."],
    ];
    for (const [title, description, category, priority, status, creator_id, assigned_to, daysAgo, notes] of samples) {
      const createdDate = new Date(base - daysAgo * dayMs - 3 * hourMs);
      const isResolved = status === "Résolu" || status === "Fermé";
      const updatedDate = isResolved ? new Date(createdDate.getTime() + (4 + (daysAgo % 12)) * hourMs) : createdDate;
      const ticketId = newId();
      DB.tickets.push({
        id: ticketId,
        title,
        description,
        category,
        priority,
        status,
        creator_id,
        creator_name: SEED_NAMES[creator_id] || creator_id,
        assigned_to,
        resolution_notes: notes,
        attachment: null,
        created_at: createdDate.toISOString(),
        updated_at: updatedDate.toISOString(),
      });
    }
    if (DB.tickets[0]) {
      DB.ticketComments.push(
        {
          id: newId(),
          ticket_id: DB.tickets[0].id,
          author_id: "EMP-ALES",
          author_name: "Ales",
          message: "J'ai testé l'alimentation, le bloc semble instable. Je vérifie si on a un OptiPlex en stock.",
          created_at: new Date(base - 2 * dayMs).toISOString(),
        },
        {
          id: newId(),
          ticket_id: DB.tickets[0].id,
          author_id: "EMP-SAM",
          author_name: "Sam",
          message: "OK, il reste une alim de rechange dans l'armoire B2 si besoin.",
          created_at: new Date(base - 1 * dayMs - 18 * hourMs).toISOString(),
        }
      );
    }
  }

  if (DB.inventory.length === 0) {
    const items = [
      ["Câbles HDMI 2m", "Câbles & Adaptateurs", 3, 10, "unité", "Armoire A1", null],
      ["Toners HP LaserJet", "Toners & Cartouches", 1, 4, "unité", "Stock imprimante", null],
      ["Souris Ergonomiques", "Claviers & Souris", 2, 8, "unité", "Armoire B2", null],
      ["Claviers AZERTY USB", "Claviers & Souris", 15, 5, "unité", "Armoire B2", null],
      ["Écrans 24\" Dell", "Écrans & Moniteurs", 6, 3, "unité", "Réserve", null],
      ["Adaptateurs USB-C / HDMI", "Câbles & Adaptateurs", 12, 6, "unité", "Armoire A1", null],
      ["Barrettes RAM 16Go DDR4", "Composants / RAM / SSD", 9, 4, "unité", "Coffre composants", null],
      ["SSD 500Go", "Composants / RAM / SSD", 7, 3, "unité", "Coffre composants", null],
      ["PC Portables Lenovo", "PC Portable / Tour", 4, 2, "unité", "Réserve sécurisée", null],
      ["Casques USB Jabra", "Casques & Audio", 10, 4, "unité", "Armoire B3", null],
      ["Câbles Ethernet RJ45 3m", "Câbles & Adaptateurs", 25, 10, "unité", "Armoire A1", null],
      ["Cartouches encre couleur", "Toners & Cartouches", 5, 4, "unité", "Stock imprimante", null],
    ];
    for (const [name, category, quantity, min_threshold, unit, location, maintenance_date] of items) {
      DB.inventory.push({
        id: newId(),
        name,
        category,
        quantity,
        min_threshold,
        unit,
        location,
        maintenance_date,
        notes: "",
        last_restock_date: new Date(base - 20 * dayMs).toISOString(),
      });
    }
  }

  if (DB.reminders.length === 0) {
    const rems = [
      ["Maintenance imprimante étage 2", 3, "Maintenance"],
      ["Renouvellement licences Office", 12, "Licence"],
      ["Audit matériel trimestriel", 25, "Audit"],
      ["Fin de garantie PC portables Lenovo", 40, "Garantie"],
    ];
    for (const [title, days, category] of rems) {
      DB.reminders.push({
        id: newId(),
        title,
        due_date: new Date(base + days * dayMs).toISOString().slice(0, 10),
        category,
        notes: "",
        done: false,
        created_at: nowIso(),
      });
    }
  }

  if (DB.assets.length === 0) {
    const assets = [
      ["PC-BUREAU-204", "Ordinateur", "Dell", "OptiPlex 7090", "DL7090-204", "IMO-2024-001", "Marie Dupont", "En service", 400, 320, "Poste principal comptabilité"],
      ["PC-PORT-ALES", "Ordinateur", "Lenovo", "ThinkPad T14", "LN-T14-001", "IMO-2025-014", "Ales", "En service", 180, 540, "Support IT mobile"],
      ["IMP-ETAGE2", "Imprimante", "HP", "LaserJet Pro M404", "HP-M404-02", "IMO-2023-008", "Service commun", "En panne", 600, -45, "Bourrage bac 1 à surveiller"],
      ["TAB-LOGISTIQUE", "Tablette", "Samsung", "Galaxy Tab A8", "SM-TABA8-07", "IMO-2025-022", "Lucas Martin", "En service", 90, 640, "Inventaire entrepôt"],
      ["PC-ACCUEIL", "Ordinateur", "HP", "ProDesk 400", "HP-PD400-11", "IMO-2023-019", "Accueil", "En service", 500, 120, ""],
      ["IMP-DIRECTION", "Imprimante", "Brother", "MFC-L2750DW", "BR-L2750-03", "IMO-2024-005", "Direction", "En service", 300, 430, "Toner remplacé en octobre"],
      ["TAB-DEMO", "Tablette", "Apple", "iPad 9e gen", "AP-IPAD9-02", "IMO-2025-031", "Stock", "En stock", 60, 670, "Disponible pour prêt"],
    ];
    for (const [name, type, brand, model, serial, imo, assigned_to, status, daysAgo, warrantyOffset, notes] of assets) {
      DB.assets.push({
        id: newId(),
        name,
        type,
        brand,
        model,
        serial,
        imo,
        assigned_to,
        status,
        purchase_date: new Date(base - daysAgo * dayMs).toISOString().slice(0, 10),
        warranty_end: new Date(base + warrantyOffset * dayMs).toISOString().slice(0, 10),
        notes,
        created_at: nowIso(),
      });
    }
  }
}

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      DB = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
        ticketComments: Array.isArray(parsed.ticketComments) ? parsed.ticketComments : [],
        inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
        reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        files: Array.isArray(parsed.files) ? parsed.files : [],
      };
      return;
    } catch (e) {
      console.warn("Could not parse db.json, re-seeding:", e.message);
    }
  }
  seed();
  saveDB();
}

loadDB();

const api = express.Router();

// ---------------- Meta ----------------
api.get("/", (_req, res) => {
  res.json({ message: "IT Helpdesk API" });
});

api.get("/meta", (_req, res) => {
  res.json({
    ticket_categories: TICKET_CATEGORIES,
    ticket_priorities: TICKET_PRIORITIES,
    ticket_statuses: TICKET_STATUSES,
    stock_categories: STOCK_CATEGORIES,
    asset_types: ASSET_TYPES,
    asset_statuses: ASSET_STATUSES,
  });
});

// ---------------- Users ----------------
api.get("/users", (_req, res) => {
  const sorted = [...DB.users].sort((a, b) => a.role.localeCompare(b.role));
  res.json(sorted);
});

api.post("/users", (req, res) => {
  const { id = "", name = "", role = "employee", title = "", can_access_parc = false } = req.body || {};
  const uid = String(id).trim().toUpperCase();
  const cleanName = String(name).trim();
  if (!uid || !cleanName) return res.status(400).json({ detail: "ID et nom requis" });
  if (role !== "admin" && role !== "employee") return res.status(400).json({ detail: "Rôle invalide" });
  if (DB.users.some((u) => u.id === uid)) return res.status(409).json({ detail: "Cet ID existe déjà" });
  const doc = {
    id: uid,
    name: cleanName,
    role,
    title: String(title || "").trim(),
    can_access_parc: role === "admin" ? true : Boolean(can_access_parc),
  };
  DB.users.push(doc);
  saveDB();
  res.json(doc);
});

api.delete("/users/:userId", (req, res) => {
  const uid = String(req.params.userId || "").trim().toUpperCase();
  const target = DB.users.find((u) => u.id === uid);
  if (!target) return res.status(404).json({ detail: "Compte introuvable" });
  const adminCount = DB.users.filter((u) => u.role === "admin").length;
  if (target.role === "admin" && adminCount <= 1) {
    return res.status(400).json({ detail: "Impossible de supprimer le dernier admin" });
  }
  DB.users = DB.users.filter((u) => u.id !== uid);
  saveDB();
  res.json({ ok: true });
});

// ---------------- First-run setup ----------------
api.get("/setup-needed", (_req, res) => {
  res.json({ needed: DB.users.length === 0 });
});

api.post("/setup", (req, res) => {
  if (DB.users.length > 0) return res.status(400).json({ detail: "La plateforme est déjà configurée" });
  const { id = "", name = "" } = req.body || {};
  const uid = String(id).trim().toUpperCase();
  const cleanName = String(name).trim();
  if (!uid || !cleanName) return res.status(400).json({ detail: "ID et nom requis" });
  const doc = { id: uid, name: cleanName, role: "admin", title: "Administrateur", can_access_parc: true };
  DB.users.push(doc);
  saveDB();
  res.json({ user: doc });
});

// ---------------- Upload (disk persisted) ----------------
api.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "Fichier requis" });
  const original = path.basename(req.file.originalname || "file.bin");
  const rawExt = original.includes(".") ? original.split(".").pop() : "bin";
  const safeExt = rawExt.replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const diskName = `${newId()}.${safeExt}`;
  const storagePath = `helpdesk/uploads/${diskName}`;
  const destPath = path.resolve(UPLOADS_DIR, diskName);
  if (!destPath.startsWith(UPLOADS_DIR + path.sep)) {
    return res.status(400).json({ detail: "Nom de fichier invalide" });
  }
  fs.writeFileSync(destPath, req.file.buffer);
  DB.files.push({
    storage_path: storagePath,
    filename: diskName,
    original_filename: original,
    content_type: req.file.mimetype || "application/octet-stream",
    size: req.file.size,
    created_at: nowIso(),
  });
  saveDB();
  res.json({ name: original, url: `/api/files/${storagePath}`, size: req.file.size });
});

api.get("/files/*", (req, res) => {
  const storagePath = req.params[0];
  const record = DB.files.find((f) => f.storage_path === storagePath);
  if (!record) return res.status(404).json({ detail: "Fichier introuvable" });
  const filePath = path.resolve(UPLOADS_DIR, record.filename);
  if (!filePath.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(filePath)) {
    return res.status(404).json({ detail: "Fichier introuvable" });
  }
  res.setHeader("Content-Type", record.content_type);
  res.setHeader("Content-Disposition", `attachment; filename="${record.original_filename}"`);
  res.sendFile(filePath);
});

// ---------------- Auth (ID only) ----------------
api.post("/auth/login", (req, res) => {
  const uid = String(req.body?.employee_id || "").trim().toUpperCase();
  const user = DB.users.find((u) => u.id === uid);
  if (!user) return res.status(404).json({ detail: "ID employé introuvable" });
  const ua = String(req.headers["user-agent"] || "");
  const device = ["Mobile", "Android", "iPhone"].some((m) => ua.includes(m)) ? "Mobile" : "Desktop";
  const ip = (req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : null) || req.ip || "—";
  DB.logs.unshift({
    id: newId(),
    employee_id: user.id,
    employee_name: user.name,
    role: user.role,
    login_time: nowIso(),
    ip_address: ip,
    device_type: device,
    status: "Succès",
  });
  saveDB();
  res.json({ user });
});

// ---------------- Tickets ----------------
api.get("/tickets", (req, res) => {
  const { creator_id, status } = req.query;
  let result = [...DB.tickets];
  if (creator_id) result = result.filter((t) => t.creator_id === creator_id);
  if (status) result = result.filter((t) => t.status === status);
  result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json(result);
});

api.post("/tickets", (req, res) => {
  const { title, description, category, priority, creator_id, attachment = null } = req.body || {};
  const creator = DB.users.find((u) => u.id === creator_id);
  const ts = nowIso();
  const doc = {
    id: newId(),
    title,
    description,
    category,
    priority,
    status: "Nouveau",
    creator_id,
    creator_name: creator ? creator.name : creator_id,
    assigned_to: null,
    resolution_notes: "",
    attachment,
    created_at: ts,
    updated_at: ts,
  };
  DB.tickets.unshift(doc);
  saveDB();
  res.json(doc);
});

api.patch("/tickets/:ticketId", (req, res) => {
  const { ticketId } = req.params;
  const ticket = DB.tickets.find((t) => t.id === ticketId);
  if (!ticket) return res.status(404).json({ detail: "Ticket introuvable" });
  const allowed = ["status", "assigned_to", "resolution_notes", "priority"];
  const body = req.body || {};
  let changed = false;
  for (const key of allowed) {
    if (body[key] !== undefined) {
      ticket[key] = body[key];
      changed = true;
    }
  }
  if (!changed) return res.status(400).json({ detail: "Aucune donnée" });
  ticket.updated_at = nowIso();
  saveDB();
  res.json(ticket);
});

// ---------------- Admin-only ticket comments ----------------
api.get("/tickets/:ticketId/admin-comments", (req, res) => {
  const reqUser = getReqUser(req);
  if (!reqUser || reqUser.role !== "admin") {
    return res.status(403).json({ detail: "Accès réservé aux administrateurs" });
  }
  const ticket = DB.tickets.find((t) => t.id === req.params.ticketId);
  if (!ticket) return res.status(404).json({ detail: "Ticket introuvable" });
  const comments = DB.ticketComments
    .filter((c) => c.ticket_id === ticket.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  res.json(comments);
});

api.post("/tickets/:ticketId/admin-comments", (req, res) => {
  const reqUser = getReqUser(req);
  if (!reqUser || reqUser.role !== "admin") {
    return res.status(403).json({ detail: "Accès réservé aux administrateurs" });
  }
  const ticket = DB.tickets.find((t) => t.id === req.params.ticketId);
  if (!ticket) return res.status(404).json({ detail: "Ticket introuvable" });
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ detail: "Message requis" });
  const doc = {
    id: newId(),
    ticket_id: ticket.id,
    author_id: reqUser.id,
    author_name: reqUser.name,
    message,
    created_at: nowIso(),
  };
  DB.ticketComments.push(doc);
  saveDB();
  res.json(doc);
});

api.get("/tickets/resolved-stats", (req, res) => {
  const reqUser = getReqUser(req);
  if (!reqUser || reqUser.role !== "admin") {
    return res.status(403).json({ detail: "Accès réservé aux administrateurs" });
  }
  const resolvedTickets = DB.tickets
    .filter((t) => t.status === "Résolu" || t.status === "Fermé")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const totalResolved = resolvedTickets.length;
  const categoryMap = new Map();
  for (const cat of TICKET_CATEGORIES) {
    categoryMap.set(cat, { category: cat, count: 0, tickets: [] });
  }

  let totalHours = 0;
  let measuredCount = 0;
  const byPriority = Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, 0]));

  const enrichedTickets = resolvedTickets.map((t) => {
    const createdMs = new Date(t.created_at).getTime();
    const updatedMs = new Date(t.updated_at).getTime();
    const durationHours =
      Number.isFinite(createdMs) && Number.isFinite(updatedMs) && updatedMs >= createdMs
        ? Math.max(0.5, Math.round(((updatedMs - createdMs) / (1000 * 60 * 60)) * 10) / 10)
        : null;
    if (durationHours !== null) {
      totalHours += durationHours;
      measuredCount += 1;
    }

    const catEntry = categoryMap.get(t.category) || { category: t.category || "Autre", count: 0, tickets: [] };
    catEntry.count += 1;
    catEntry.tickets.push({ id: t.id, title: t.title, priority: t.priority, status: t.status, updated_at: t.updated_at });
    categoryMap.set(catEntry.category, catEntry);

    if (byPriority[t.priority] !== undefined) byPriority[t.priority] += 1;
    else byPriority[t.priority || "Autre"] = 1;

    return {
      ...t,
      duration_hours: durationHours,
    };
  });

  const byCategory = Array.from(categoryMap.values())
    .map((entry) => ({
      ...entry,
      percentage: totalResolved > 0 ? Math.round((entry.count / totalResolved) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topCategory = byCategory[0] && byCategory[0].count > 0 ? byCategory[0] : null;
  const avgResolutionHours = measuredCount > 0 ? Math.round((totalHours / measuredCount) * 10) / 10 : 0;

  res.json({
    total_resolved: totalResolved,
    total_tickets: DB.tickets.length,
    resolution_rate: DB.tickets.length > 0 ? Math.round((totalResolved / DB.tickets.length) * 100) : 0,
    avg_resolution_hours: avgResolutionHours,
    top_category: topCategory ? { category: topCategory.category, count: topCategory.count, percentage: topCategory.percentage } : null,
    by_category: byCategory,
    by_priority: byPriority,
    resolved_tickets: enrichedTickets,
  });
});

// ---------------- Inventory ----------------
api.get("/inventory", (_req, res) => {
  const sorted = [...DB.inventory].sort((a, b) => a.name.localeCompare(b.name));
  res.json(sorted);
});

api.post("/inventory", (req, res) => {
  const {
    name,
    category,
    quantity = 0,
    min_threshold = 0,
    unit = "unité",
    location = "",
    maintenance_date = null,
    notes = "",
  } = req.body || {};
  const doc = {
    id: newId(),
    name,
    category,
    quantity: Number(quantity) || 0,
    min_threshold: Number(min_threshold) || 0,
    unit,
    location,
    maintenance_date,
    notes,
    last_restock_date: nowIso(),
  };
  DB.inventory.push(doc);
  saveDB();
  res.json(doc);
});

api.patch("/inventory/:itemId", (req, res) => {
  const item = DB.inventory.find((i) => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ detail: "Article introuvable" });
  const allowed = ["name", "category", "quantity", "min_threshold", "unit", "location", "maintenance_date", "notes"];
  const body = req.body || {};
  let changed = false;
  for (const key of allowed) {
    if (body[key] !== undefined) {
      item[key] = key === "quantity" || key === "min_threshold" ? Number(body[key]) : body[key];
      changed = true;
    }
  }
  if (!changed) return res.status(400).json({ detail: "Aucune donnée" });
  if (body.quantity !== undefined) item.last_restock_date = nowIso();
  saveDB();
  res.json(item);
});

api.delete("/inventory/:itemId", (req, res) => {
  const idx = DB.inventory.findIndex((i) => i.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ detail: "Article introuvable" });
  DB.inventory.splice(idx, 1);
  saveDB();
  res.json({ ok: true });
});

api.get("/inventory/template", (_req, res) => {
  const wb = XLSX.utils.book_new();
  const rows = [
    ["Nom", "Catégorie", "Quantité", "Seuil d'alerte", "Unité", "Emplacement"],
    ["Câbles HDMI 2m", "Câbles & Adaptateurs", 10, 5, "unité", "Armoire A1"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Stock");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=modele-stock.xlsx");
  res.send(buf);
});

api.post("/inventory/import", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "Fichier Excel illisible (.xlsx attendu)" });
  let wb;
  try {
    wb = XLSX.read(req.file.buffer, { type: "buffer" });
  } catch {
    return res.status(400).json({ detail: "Fichier Excel illisible (.xlsx attendu)" });
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return res.json({ imported: 0 });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
  if (!rows || rows.length === 0) return res.json({ imported: 0 });

  const header = rows[0].map((c) => (c !== null && c !== undefined ? String(c).trim().toLowerCase() : ""));
  const col = (...names) => {
    for (const n of names) {
      const idx = header.findIndex((h) => h.includes(n));
      if (idx !== -1) return idx;
    }
    return null;
  };

  const ci = {
    name: col("nom", "name"),
    category: col("catég", "categ", "cat"),
    quantity: col("quant", "qté", "qte"),
    threshold: col("seuil", "alerte", "min"),
    unit: col("unité", "unite", "unit"),
    location: col("emplace", "lieu", "location"),
  };

  if (ci.name === null) return res.status(400).json({ detail: "Colonne 'Nom' introuvable" });

  const val = (row, key, def = "") => {
    const idx = ci[key];
    if (idx === null || idx >= row.length || row[idx] === null || row[idx] === undefined) return def;
    return row[idx];
  };
  const toInt = (x) => {
    const n = parseInt(Number(x), 10);
    return Number.isFinite(n) ? n : 0;
  };

  let imported = 0;
  for (const row of rows.slice(1)) {
    const name = val(row, "name");
    if (!name || !String(name).trim()) continue;
    DB.inventory.push({
      id: newId(),
      name: String(name).trim(),
      category: String(val(row, "category", "Autre")).trim() || "Autre",
      quantity: toInt(val(row, "quantity", 0)),
      min_threshold: toInt(val(row, "threshold", 0)),
      unit: String(val(row, "unit", "unité")).trim() || "unité",
      location: String(val(row, "location", "")).trim(),
      maintenance_date: null,
      notes: "",
      last_restock_date: nowIso(),
    });
    imported += 1;
  }
  if (imported > 0) saveDB();
  res.json({ imported });
});

// ---------------- Parc informatique (assets) ----------------
api.get("/assets", (_req, res) => {
  const sorted = [...DB.assets].sort((a, b) => a.name.localeCompare(b.name));
  res.json(sorted);
});

api.get("/assets/export", (_req, res) => {
  const wb = XLSX.utils.book_new();
  const sorted = [...DB.assets].sort((a, b) => (a.type || "").localeCompare(b.type || ""));
  const rows = [
    ["Nom", "Type", "IMO", "Marque", "Modèle", "N° série", "Affecté à", "Statut", "Date d'achat", "Fin de garantie", "Remarques"],
    ...sorted.map((a) => [
      a.name || "",
      a.type || "",
      a.imo || "",
      a.brand || "",
      a.model || "",
      a.serial || "",
      a.assigned_to || "",
      a.status || "",
      a.purchase_date || "",
      a.warranty_end || "",
      a.notes || "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Parc informatique");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=parc-informatique.xlsx");
  res.send(buf);
});

api.post("/assets", (req, res) => {
  const reqUser = getReqUser(req);
  if (!reqUser || (reqUser.role !== "admin" && !reqUser.can_access_parc)) {
    return res.status(403).json({ detail: "Accès au parc informatique non autorisé" });
  }
  const {
    name,
    type = "Ordinateur",
    imo = "",
    brand = "",
    model = "",
    serial = "",
    assigned_to = "",
    status = "En service",
    purchase_date = null,
    warranty_end = null,
    notes = "",
  } = req.body || {};
  if (!String(name || "").trim()) return res.status(400).json({ detail: "Le nom est obligatoire" });
  const doc = {
    id: newId(),
    name: String(name).trim(),
    type,
    imo: String(imo || "").trim(),
    brand,
    model,
    serial,
    assigned_to,
    status,
    purchase_date: purchase_date || null,
    warranty_end: warranty_end || null,
    notes: String(notes || "").trim(),
    created_at: nowIso(),
  };
  DB.assets.push(doc);
  saveDB();
  res.json(doc);
});

api.patch("/assets/:assetId", (req, res) => {
  const reqUser = getReqUser(req);
  if (!reqUser || (reqUser.role !== "admin" && !reqUser.can_access_parc)) {
    return res.status(403).json({ detail: "Accès au parc informatique non autorisé" });
  }
  const asset = DB.assets.find((a) => a.id === req.params.assetId);
  if (!asset) return res.status(404).json({ detail: "Matériel introuvable" });
  const allowed = ["name", "type", "imo", "brand", "model", "serial", "assigned_to", "status", "purchase_date", "warranty_end", "notes"];
  const body = req.body || {};
  let changed = false;
  for (const key of allowed) {
    if (body[key] !== undefined) {
      asset[key] = body[key];
      changed = true;
    }
  }
  if (!changed) return res.status(400).json({ detail: "Aucune donnée" });
  saveDB();
  res.json(asset);
});

api.delete("/assets/:assetId", (req, res) => {
  const reqUser = getReqUser(req);
  if (!reqUser || reqUser.role !== "admin") {
    return res.status(403).json({ detail: "Seuls les administrateurs peuvent supprimer un matériel" });
  }
  const idx = DB.assets.findIndex((a) => a.id === req.params.assetId);
  if (idx === -1) return res.status(404).json({ detail: "Matériel introuvable" });
  DB.assets.splice(idx, 1);
  saveDB();
  res.json({ ok: true });
});

// ---------------- Reminders ----------------
api.get("/reminders", (_req, res) => {
  const sorted = [...DB.reminders].sort((a, b) => a.due_date.localeCompare(b.due_date));
  res.json(sorted);
});

api.post("/reminders", (req, res) => {
  const { title, due_date, category = "Général", notes = "" } = req.body || {};
  const doc = {
    id: newId(),
    title,
    due_date,
    category,
    notes,
    done: false,
    created_at: nowIso(),
  };
  DB.reminders.push(doc);
  saveDB();
  res.json(doc);
});

api.patch("/reminders/:reminderId", (req, res) => {
  const rem = DB.reminders.find((r) => r.id === req.params.reminderId);
  if (!rem) return res.status(404).json({ detail: "Rappel introuvable" });
  rem.done = !rem.done;
  saveDB();
  res.json(rem);
});

api.delete("/reminders/:reminderId", (req, res) => {
  const idx = DB.reminders.findIndex((r) => r.id === req.params.reminderId);
  if (idx === -1) return res.status(404).json({ detail: "Rappel introuvable" });
  DB.reminders.splice(idx, 1);
  saveDB();
  res.json({ ok: true });
});

// ---------------- Logs ----------------
api.get("/logs", (_req, res) => {
  const sorted = [...DB.logs].sort((a, b) => b.login_time.localeCompare(a.login_time)).slice(0, 500);
  res.json(sorted);
});

// ---------------- Stats ----------------
api.get("/stats", (_req, res) => {
  const tickets = DB.tickets;
  const inventory = DB.inventory;
  const open_tickets = tickets.filter((t) => t.status !== "Résolu" && t.status !== "Fermé");
  const low_stock = inventory.filter((i) => i.quantity <= i.min_threshold);
  const today = new Date().toISOString().slice(0, 10);
  const logs_today = DB.logs.filter((l) => l.login_time >= today).length;
  const by_status = Object.fromEntries(TICKET_STATUSES.map((s) => [s, tickets.filter((t) => t.status === s).length]));
  const by_priority = Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, tickets.filter((t) => t.priority === p).length]));
  res.json({
    open_tickets: open_tickets.length,
    total_tickets: tickets.length,
    low_stock: low_stock.length,
    total_items: inventory.length,
    logs_today,
    resolved: tickets.filter((t) => t.status === "Résolu" || t.status === "Fermé").length,
    by_status,
    by_priority,
  });
});

app.use("/api", api);

// Serve built frontend static assets
const buildDir = path.join(__dirname, "frontend", "build");
app.use(
  express.static(buildDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);

app.get("*", (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/assets/")) {
    return res.status(404).json({ detail: "Ressource introuvable" });
  }
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(buildDir, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`Support IT server running on http://${HOST}:${PORT}`);
});
