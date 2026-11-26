import { useState, useEffect, useCallback } from "react";
import { endpoints } from "@/lib/api";
import { formatDateTime } from "@/lib/ui";
import { useAuth } from "@/context/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Lightbulb, Plus, Pencil, Trash2, Search, X, Tag } from "lucide-react";

const DEFAULT_TOPICS = [
  "Matériel / PC",
  "Réseau / Wifi",
  "Logiciel / Licence",
  "Imprimante / Périphérique",
  "Accès / Identifiants",
  "Sécurité",
  "Autre",
];

const TOPIC_COLORS = {
  "Matériel / PC": "bg-blue-50 text-blue-700 border-blue-200",
  "Réseau / Wifi": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Logiciel / Licence": "bg-violet-50 text-violet-700 border-violet-200",
  "Imprimante / Périphérique": "bg-amber-50 text-amber-700 border-amber-200",
  "Accès / Identifiants": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Sécurité": "bg-rose-50 text-rose-700 border-rose-200",
  "Autre": "bg-slate-100 text-slate-700 border-slate-200",
};

const emptyForm = { title: "", topic: "Matériel / PC", content: "" };

export const TipsView = () => {
  const { isAdmin } = useAuth();
  const [tips, setTips] = useState([]);
  const [topics, setTopics] = useState(DEFAULT_TOPICS);
  const [topicFilter, setTopicFilter] = useState("Tous");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await endpoints.tips();
      setTips(Array.isArray(r.data) ? r.data : []);
    } catch {
      setTips([]);
    }
  }, []);

  useEffect(() => {
    load();
    endpoints
      .meta()
      .then((r) => {
        if (Array.isArray(r.data?.tip_topics) && r.data.tip_topics.length > 0) {
          setTopics(r.data.tip_topics);
        }
      })
      .catch(() => {});
  }, [load]);

  const openAdd = () => {
    setForm({ title: "", topic: topics[0] || "Matériel / PC", content: "" });
    setModal({ mode: "add" });
  };

  const openEdit = (tip) => {
    setForm({ title: tip.title || "", topic: tip.topic || "Autre", content: tip.content || "" });
    setModal({ mode: "edit", item: tip });
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      return toast.error("Le titre et le contenu de l'astuce sont obligatoires");
    }
    setSaving(true);
    try {
      if (modal.mode === "add") {
        await endpoints.createTip(form);
        toast.success("Astuce publiée");
      } else {
        await endpoints.updateTip(modal.item.id, form);
        toast.success("Astuce modifiée");
      }
      setModal(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tip) => {
    try {
      await endpoints.deleteTip(tip.id);
      toast.success("Astuce supprimée");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Suppression impossible");
    }
  };

  const q = search.trim().toLowerCase();
  const shown = tips.filter((tip) => {
    const okTopic = topicFilter === "Tous" || tip.topic === topicFilter;
    if (!okTopic) return false;
    if (!q) return true;
    return [tip.title, tip.topic, tip.content, tip.author_name]
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(q));
  });

  const allTopicTabs = ["Tous", ...Array.from(new Set([...topics, ...tips.map((t) => t.topic).filter(Boolean)]))];
  const countByTopic = (topic) => tips.filter((t) => t.topic === topic).length;

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Lightbulb className="h-5 w-5" />
            </span>
            ASTUCES
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? "Déposez et classez vos astuces par sujet pour aider les utilisateurs au quotidien"
              : "Guides pratiques et solutions rapides publiés par l'équipe IT"}
          </p>
        </div>
        {isAdmin && (
          <button
            data-testid="add-tip-button"
            onClick={openAdd}
            className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Déposer une astuce
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {allTopicTabs.map((topic) => {
            const count = topic === "Tous" ? tips.length : countByTopic(topic);
            if (topic !== "Tous" && count === 0 && !isAdmin) return null;
            const active = topicFilter === topic;
            return (
              <button
                key={topic}
                data-testid={`tips-topic-${topic}`}
                onClick={() => setTopicFilter(topic)}
                className={`h-9 px-3.5 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-2 border transition-colors ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {topic}
                <span className={`text-xs tabular-nums ${active ? "text-blue-100" : "text-slate-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            data-testid="tips-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une astuce ou un sujet..."
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

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((tip) => (
            <article
              key={tip.id}
              data-testid={`tip-card-${tip.id}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      TOPIC_COLORS[tip.topic] || TOPIC_COLORS["Autre"]
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    {tip.topic}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        data-testid={`edit-tip-${tip.id}`}
                        onClick={() => openEdit(tip)}
                        title="Modifier l'astuce"
                        className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        data-testid={`delete-tip-${tip.id}`}
                        onClick={() => remove(tip)}
                        title="Supprimer l'astuce"
                        className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="mt-3 font-display text-lg font-bold text-slate-900 leading-snug">
                  {tip.title}
                </h3>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {tip.content}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Publié par <strong className="font-medium text-slate-600">{tip.author_name || "Admin IT"}</strong></span>
                <span>{formatDateTime(tip.updated_at || tip.created_at)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <div className="text-sm font-medium text-slate-500">Aucune astuce trouvée</div>
          <div className="text-xs mt-1">
            {isAdmin
              ? "Cliquez sur « Déposer une astuce » pour ajouter un guide sur ce sujet."
              : "Essayez un autre mot-clé ou changez de sujet."}
          </div>
        </div>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="bg-white sm:max-w-lg" data-testid="tip-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {modal?.mode === "add" ? "Déposer une astuce" : "Modifier l'astuce"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Sujet</label>
              <Select value={form.topic} onValueChange={(v) => setForm({ ...form, topic: v })}>
                <SelectTrigger data-testid="tip-topic-select" className="mt-1.5 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                  {topics.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Titre</label>
              <input
                data-testid="tip-title-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex : Connecter une imprimante réseau sous Windows"
                className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Astuce / Étapes détaillées
              </label>
              <textarea
                data-testid="tip-content-input"
                rows={6}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={"1. Ouvrez...\n2. Cliquez sur...\n3. Redémarrez si besoin."}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setModal(null)}
              className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              data-testid="tip-save-button"
              onClick={save}
              disabled={saving}
              className="h-10 px-5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-colors disabled:opacity-60"
            >
              {saving ? "Enregistrement..." : "Publier"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
