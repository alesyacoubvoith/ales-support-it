import { useState, useEffect, useCallback, useRef } from "react";
import { endpoints } from "@/lib/api";
import { formatDate, daysUntil } from "@/lib/ui";
import { useAuth } from "@/context/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MonitorSmartphone, Monitor, Printer, Tablet, Download, Upload, Plus, Pencil, Trash2, Cpu, Mail, Copy, ExternalLink, FileDown, Search, X } from "lucide-react";

const TYPE_ICON = { Ordinateur: Monitor, Imprimante: Printer, Tablette: Tablet };
const STATUS_STYLES = {
  "En service": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "En stock": "bg-blue-50 text-blue-700 border-blue-200",
  "En panne": "bg-rose-50 text-rose-700 border-rose-200",
  "Réformé": "bg-slate-100 text-slate-600 border-slate-200",
};
const emptyForm = {
  name: "",
  type: "Ordinateur",
  imo: "",
  brand: "",
  model: "",
  serial: "",
  assigned_to: "",
  status: "En service",
  purchase_date: "",
  warranty_end: "",
  notes: "",
};

const toUtf8Base64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const formatAssetLines = (a) => [
  `- Nom / Référence : ${a.name || "—"}`,
  `- Type : ${a.type || "—"}`,
  `- Code IMO : ${a.imo || "—"}`,
  `- Marque / Modèle : ${[a.brand, a.model].filter(Boolean).join(" ") || "—"}`,
  `- N° de série : ${a.serial || "—"}`,
  `- Affecté à : ${a.assigned_to || "—"}`,
  `- Date d'achat : ${a.purchase_date ? formatDate(a.purchase_date) : "—"}`,
  `- Fin de garantie : ${a.warranty_end ? formatDate(a.warranty_end) : "—"}`,
  `- Statut : Réformé`,
  `- Remarques : ${a.notes || "—"}`,
].join("\n");

const buildReformeDraft = (items, senderName) => {
  const list = items.filter(Boolean);
  if (list.length === 0) {
    return {
      subject: "[Parc IT] Demande de réforme matériel",
      body: `Bonjour,\n\nMerci de sélectionner un matériel à réformer.\n\nCordialement,\n${senderName || "Support IT"}`,
    };
  }
  const subject =
    list.length === 1
      ? `[Parc IT] Réforme matériel — ${list[0].name}${list[0].imo ? ` (${list[0].imo})` : ""}`
      : `[Parc IT] Réforme matériel (${list.length} équipements)`;
  const intro =
    list.length === 1
      ? "Le matériel informatique suivant va être réformé :"
      : `Les ${list.length} matériels informatiques suivants vont être réformés :`;
  const details = list.map((a, idx) => (list.length > 1 ? `Matériel #${idx + 1}\n${formatAssetLines(a)}` : formatAssetLines(a))).join("\n\n");
  const body = `Bonjour,\n\n${intro}\n\n${details}\n\nMerci de prendre en compte cette mise en réforme dans le suivi du parc.\n\nCordialement,\n${senderName || "Support IT"}`;
  return { subject, body };
};

export const ParcView = () => {
  const { isAdmin, user } = useAuth();
  const canManageParc = isAdmin || Boolean(user?.can_access_parc);
  const [assets, setAssets] = useState([]);
  const [meta, setMeta] = useState({ asset_types: [], asset_statuses: [] });
  const [tab, setTab] = useState("Tous");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [outlookOpen, setOutlookOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [draftTo, setDraftTo] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    const r = await endpoints.assets();
    setAssets(r.data);
  }, []);

  useEffect(() => {
    load();
    endpoints.meta().then((r) => setMeta(r.data)).catch(() => {});
  }, [load]);

  const tabs = ["Tous", "Ordinateur", "Imprimante", "Tablette"];
  const q = search.trim().toLowerCase();
  const shown = assets.filter((a) => {
    const okTab = tab === "Tous" || a.type === tab;
    if (!okTab) return false;
    if (!q) return true;
    return [a.name, a.assigned_to, a.imo, a.brand, a.model, a.serial, a.notes]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));
  });
  const countBy = (t) => assets.filter((a) => a.type === t).length;

  const openAdd = () => { setForm(emptyForm); setModal({ mode: "add" }); };
  const openEdit = (a) => {
    setForm({
      ...a,
      imo: a.imo || "",
      purchase_date: a.purchase_date || "",
      warranty_end: a.warranty_end || "",
      brand: a.brand || "",
      model: a.model || "",
      serial: a.serial || "",
      assigned_to: a.assigned_to || "",
      notes: a.notes || "",
    });
    setModal({ mode: "edit", item: a });
  };

  const openOutlookDraft = (targetAssets) => {
    const list = (targetAssets && targetAssets.length ? targetAssets : assets.filter((a) => a.status === "Réformé"));
    const fallback = list.length ? list : assets.slice(0, 1);
    const ids = fallback.map((a) => a.id).filter(Boolean);
    setSelectedIds(ids);
    const { subject, body } = buildReformeDraft(fallback, user?.name);
    setDraftSubject(subject);
    setDraftBody(body);
    setOutlookOpen(true);
  };

  const toggleAssetInDraft = (asset) => {
    const exists = selectedIds.includes(asset.id);
    const nextIds = exists ? selectedIds.filter((id) => id !== asset.id) : [...selectedIds, asset.id];
    setSelectedIds(nextIds);
    const nextItems = assets.filter((a) => nextIds.includes(a.id));
    const { subject, body } = buildReformeDraft(nextItems, user?.name);
    setDraftSubject(subject);
    setDraftBody(body);
  };

  const save = async (openDraftAfter = false) => {
    if (!form.name.trim()) return toast.error("Le nom est obligatoire");
    const payload = {
      ...form,
      purchase_date: form.purchase_date || null,
      warranty_end: form.warranty_end || null,
    };
    try {
      let savedAsset;
      if (modal.mode === "add") {
        const res = await endpoints.createAsset(payload);
        savedAsset = res.data;
        toast.success("Matériel ajouté");
      } else {
        const res = await endpoints.updateAsset(modal.item.id, payload);
        savedAsset = res.data;
        toast.success("Matériel modifié");
      }
      setModal(null);
      await load();
      if (openDraftAfter && savedAsset) {
        const { subject, body } = buildReformeDraft([savedAsset], user?.name);
        setSelectedIds([savedAsset.id]);
        setDraftSubject(subject);
        setDraftBody(body);
        setOutlookOpen(true);
      }
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };

  const cleanTo = draftTo.replace(/[\r\n]+/g, "").trim();
  const mailtoHref = `mailto:${cleanTo}?subject=${encodeURIComponent(draftSubject)}&body=${encodeURIComponent(draftBody)}`;
  const outlookWebProHref = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(cleanTo)}&subject=${encodeURIComponent(draftSubject)}&body=${encodeURIComponent(draftBody)}`;
  const outlookWebPersoHref = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(cleanTo)}&subject=${encodeURIComponent(draftSubject)}&body=${encodeURIComponent(draftBody)}`;

  const downloadEmlDraft = () => {
    const crlfBody = draftBody.replace(/\r?\n/g, "\r\n");
    const eml = [
      `To: ${cleanTo}`,
      `Subject: =?UTF-8?B?${toUtf8Base64(draftSubject)}?=`,
      "X-Unsent: 1",
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      crlfBody,
    ].join("\r\n");
    const blob = new Blob([eml], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "brouillon-reforme-outlook.eml";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Brouillon .eml téléchargé (ouvre-le avec Outlook)");
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(`Objet : ${draftSubject}\n\n${draftBody}`);
      toast.success("Contenu du brouillon copié");
    } catch {
      toast.error("Copie automatique impossible");
    }
  };

  const remove = async (a) => {
    try {
      await endpoints.deleteAsset(a.id);
      toast.success("Matériel supprimé");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Suppression impossible");
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await endpoints.exportAssets();
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "parc-informatique.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Export Excel téléchargé");
    } catch {
      toast.error("Export impossible");
    } finally {
      setExporting(false);
    }
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = (await file.text()).replace(/^\uFEFF/, "");
      const lines = content.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error("Le fichier CSV est vide.");
        return;
      }

      const separator = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase());

      const findColumn = (...names) =>
        headers.findIndex((h) => names.includes(h));

      const nameIndex = findColumn("nom", "nom / réf", "nomref", "reference");

      if (nameIndex === -1) {
        toast.error("La colonne Nom est introuvable dans le fichier.");
        return;
      }

      setImporting(true);
      let count = 0;

      for (const line of lines.slice(1)) {
        const values = line.split(separator).map((v) => v.trim());
        const get = (...names) => {
          const index = findColumn(...names);
          return index >= 0 ? values[index] || "" : "";
        };

        const name = values[nameIndex];
        if (!name) continue;

        await endpoints.createAsset({
          name,
          type: get("type") || "Ordinateur",
          imo: get("imo", "code imo", "n° imo"),
          brand: get("marque"),
          model: get("modèle", "modele"),
          serial: get("n° série", "n serie", "numero de serie", "serial"),
          assigned_to: get("affecté à", "affecte a", "assigned_to"),
          status: get("statut", "status") || "En service",
          purchase_date: get("date d'achat", "date achat", "purchase_date") || null,
          warranty_end: get("fin de garantie", "garantie", "warranty_end") || null,
          notes: get("remarques", "remarque", "notes"),
        });

        count++;
      }

      toast.success(`${count} matériel(s) importé(s) !`);
      load();
    } catch {
      toast.error("Erreur pendant l'importation du fichier CSV.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Parc informatique</h2>
          <p className="text-sm text-slate-500">{assets.length} matériels · ordinateurs, imprimantes, tablettes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={importCsv}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {importing ? "Importation..." : "Importer CSV"}
              </button>
            </>
          )}
          <button
            data-testid="outlook-reforme-button"
            onClick={() => openOutlookDraft()}
            className="h-10 px-3.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 active:scale-[0.98] transition-colors flex items-center gap-2"
          >
            <Mail className="h-4 w-4" /> Brouillon Outlook (Réformé)
          </button>
          <button data-testid="export-parc-button" onClick={exportExcel} disabled={exporting} className="h-10 px-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 active:scale-[0.98] transition-colors flex items-center gap-2 disabled:opacity-60">
            <Download className="h-4 w-4" /> Exporter Excel
          </button>
          {canManageParc && (
            <button data-testid="add-asset-button" onClick={openAdd} className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-colors flex items-center gap-2">
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = TYPE_ICON[t] || Cpu;
            const active = tab === t;
            return (
              <button key={t} data-testid={`parc-tab-${t}`} onClick={() => setTab(t)} className={`h-9 px-3.5 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-2 border transition-colors ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {t !== "Tous" && <Icon className="h-4 w-4" />}
                {t === "Tous" ? "Tous" : t}
                <span className={`text-xs tabular-nums ${active ? "text-blue-100" : "text-slate-400"}`}>{t === "Tous" ? assets.length : countBy(t)}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            data-testid="parc-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un matériel ou une personne..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <th className="text-left font-semibold py-3.5 px-4">Matériel</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden sm:table-cell">IMO</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden md:table-cell">Marque / Modèle</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden lg:table-cell">N° série</th>
                <th className="text-left font-semibold py-3.5 px-4">Affecté à</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden lg:table-cell">Fin de garantie</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden xl:table-cell">Remarques</th>
                <th className="text-left font-semibold py-3.5 px-4">Statut</th>
                {canManageParc && <th className="text-right font-semibold py-3.5 px-4">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((a) => {
                const Icon = TYPE_ICON[a.type] || Cpu;
                const warrantyDays = daysUntil(a.warranty_end);
                const warrantyTone =
                  warrantyDays === null
                    ? "text-slate-400"
                    : warrantyDays < 0
                    ? "text-rose-600 font-medium"
                    : warrantyDays <= 30
                    ? "text-amber-600 font-medium"
                    : "text-slate-600";
                return (
                  <tr key={a.id} data-testid={`asset-row-${a.id}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center"><Icon className="h-4 w-4" /></div>
                        <div>
                          <div className="font-medium text-slate-800">{a.name}</div>
                          <div className="text-xs text-slate-400">{a.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell font-mono text-xs text-slate-600">{a.imo || "—"}</td>
                    <td className="py-3 px-4 hidden md:table-cell text-slate-600">{[a.brand, a.model].filter(Boolean).join(" ") || "—"}</td>
                    <td className="py-3 px-4 hidden lg:table-cell font-mono text-xs text-slate-500">{a.serial || "—"}</td>
                    <td className="py-3 px-4 text-slate-600">{a.assigned_to || "—"}</td>
                    <td className={`py-3 px-4 hidden lg:table-cell text-xs ${warrantyTone}`}>
                      {a.warranty_end ? formatDate(a.warranty_end) : "—"}
                    </td>
                    <td className="py-3 px-4 hidden xl:table-cell text-xs text-slate-500 max-w-[180px] truncate" title={a.notes}>
                      {a.notes || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{a.status}</span>
                    </td>
                    {canManageParc && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {a.status === "Réformé" && (
                            <button
                              data-testid={`outlook-asset-${a.id}`}
                              onClick={() => openOutlookDraft([a])}
                              title="Créer un brouillon Outlook (réforme)"
                              className="h-8 px-2 rounded-md flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              <span className="hidden 2xl:inline">Outlook</span>
                            </button>
                          )}
                          <button data-testid={`edit-asset-${a.id}`} onClick={() => openEdit(a)} title="Modifier" className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Pencil className="h-4 w-4" /></button>
                          {isAdmin && (
                            <button data-testid={`delete-asset-${a.id}`} onClick={() => remove(a)} title="Supprimer" className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={canManageParc ? 9 : 8} className="py-16 text-center text-slate-400">
                  <MonitorSmartphone className="h-8 w-8 mx-auto mb-2 text-slate-300" />Aucun matériel
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="bg-white sm:max-w-lg" data-testid="asset-modal">
          <DialogHeader><DialogTitle className="font-display text-xl">{modal?.mode === "add" ? "Ajouter un matériel" : "Modifier le matériel"}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Nom / Réf</label>
                <input data-testid="asset-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="PC-BUREAU-204" className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Type</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger data-testid="asset-type-select" className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                    {meta.asset_types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">IMO</label>
                <input data-testid="asset-imo-input" value={form.imo} onChange={(e) => setForm({ ...form, imo: e.target.value })} placeholder="IMO-2025-001" className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">N° série</label>
                <input data-testid="asset-serial-input" value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Marque</label>
                <input data-testid="asset-brand-input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Dell" className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Modèle</label>
                <input data-testid="asset-model-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="OptiPlex 7090" className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Affecté à</label>
                <input data-testid="asset-assigned-input" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Marie Dupont" className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Statut</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="asset-status-select" className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                    {meta.asset_statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Date d'achat</label>
                <input data-testid="asset-date-input" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Fin de garantie</label>
                <input data-testid="asset-warranty-input" type="date" value={form.warranty_end} onChange={(e) => setForm({ ...form, warranty_end: e.target.value })} className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Remarques</label>
              <textarea data-testid="asset-notes-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observations, état, accessoires fournis..." className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
            </div>
          </div>
          {form.status === "Réformé" && (
            <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="text-xs text-blue-800">
                Statut <strong>Réformé</strong> sélectionné : tu peux préparer directement le mail Outlook avec les infos de ce matériel.
              </div>
              <button
                type="button"
                data-testid="modal-save-outlook-button"
                onClick={() => save(true)}
                className="shrink-0 h-8 px-3 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" /> Enregistrer & brouillon Outlook
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setModal(null)} className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Annuler</button>
            <button data-testid="asset-save-button" onClick={() => save(false)} className="h-10 px-5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-colors">Enregistrer</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={outlookOpen} onOpenChange={setOutlookOpen}>
        <DialogContent className="bg-white sm:max-w-2xl" data-testid="outlook-reforme-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Brouillon Outlook — Matériel réformé
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Matériel(s) inclus ({selectedIds.length})
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-lg border border-slate-200 bg-slate-50">
                {assets.map((a) => {
                  const checked = selectedIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAssetInDraft(a)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        checked
                          ? "bg-blue-600 text-white border-blue-600"
                          : a.status === "Réformé"
                          ? "bg-white text-slate-700 border-amber-300 hover:bg-amber-50"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {a.name}{a.status === "Réformé" ? " · Réformé" : ""}
                    </button>
                  );
                })}
                {assets.length === 0 && <span className="text-xs text-slate-400">Aucun matériel dans le parc</span>}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Destinataire (optionnel)</label>
              <input
                data-testid="outlook-to-input"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                placeholder="ex: direction@entreprise.fr, achats@entreprise.fr"
                className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Objet du mail</label>
              <input
                data-testid="outlook-subject-input"
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Contenu du brouillon</label>
              <textarea
                data-testid="outlook-body-input"
                rows={10}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap gap-2">
              <a
                data-testid="outlook-mailto-link"
                href={mailtoHref}
                className="h-9 px-3.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" /> Ouvrir dans Outlook (PC)
              </a>
              <a
                data-testid="outlook-web-pro-link"
                href={outlookWebProHref}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Outlook Web (Pro)
              </a>
              <a
                data-testid="outlook-web-perso-link"
                href={outlookWebPersoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Outlook.com
              </a>
              <button
                type="button"
                data-testid="outlook-eml-button"
                onClick={downloadEmlDraft}
                className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5"
              >
                <FileDown className="h-3.5 w-3.5" /> Télécharger brouillon .eml
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="outlook-copy-button"
                onClick={copyDraft}
                className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copier
              </button>
              <button
                type="button"
                onClick={() => setOutlookOpen(false)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
