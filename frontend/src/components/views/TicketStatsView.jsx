import { useState, useEffect, useCallback } from "react";
import { endpoints } from "@/lib/api";
import { StatCard, StatusBadge, PriorityBadge } from "@/components/Bits";
import { formatDateTime } from "@/lib/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle2, Flame, Clock, TrendingUp, Search, Inbox } from "lucide-react";

const ASSIGNEES = [
  { id: "EMP-ALES", name: "Ales" },
  { id: "EMP-SAM", name: "Sam" },
  { id: "EMP-IT", name: "Admin IT" },
];

export const TicketStatsView = () => {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Toutes");

  const load = useCallback(async () => {
    try {
      const r = await endpoints.resolvedTicketStats();
      setData(r.data);
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return <div className="text-slate-400">Chargement des statistiques...</div>;
  }

  const nameOf = (id) => ASSIGNEES.find((a) => a.id === id)?.name || id || "—";
  const formatDuration = (hours) => {
    if (hours === null || hours === undefined) return "—";
    if (hours < 24) return `${hours}h`;
    const days = Math.round((hours / 24) * 10) / 10;
    return `${days}j`;
  };

  const chartData = data.by_category.map((c) => ({
    name: c.category.split(" / ")[0],
    fullCategory: c.category,
    count: c.count,
    percentage: c.percentage,
  }));

  const maxCatCount = Math.max(...data.by_category.map((c) => c.count), 1);

  const filteredTickets = data.resolved_tickets.filter((t) => {
    const okCat = catFilter === "Toutes" || t.category === catFilter;
    const q = search.toLowerCase();
    const okSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.resolution_notes || "").toLowerCase().includes(q) ||
      (t.creator_name || "").toLowerCase().includes(q);
    return okCat && okSearch;
  });

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Statistiques des tickets résolus</h2>
        <p className="text-sm text-slate-500">
          Analyse des incidents clôturés pour identifier les problèmes les plus récurrents
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tickets résolus"
          value={data.total_resolved}
          icon={CheckCircle2}
          tone="emerald"
          hint={`Sur ${data.total_tickets} tickets au total`}
        />
        <StatCard
          label="Problème le + récurrent"
          value={data.top_category ? data.top_category.category.split(" / ")[0] : "—"}
          icon={Flame}
          tone="amber"
          hint={data.top_category ? `${data.top_category.count} ticket(s) · ${data.top_category.percentage}%` : "Aucune donnée"}
        />
        <StatCard
          label="Temps moyen"
          value={formatDuration(data.avg_resolution_hours)}
          icon={Clock}
          tone="blue"
          hint="Entre création et résolution"
        />
        <StatCard
          label="Taux de résolution"
          value={`${data.resolution_rate}%`}
          icon={TrendingUp}
          tone="slate"
          hint="Tickets Résolus & Fermés"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800">Volume des tickets résolus par catégorie</h3>
              <p className="text-xs text-slate-400">Permet de repérer rapidement les pannes récurrentes</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value, _name, item) => [`${value} ticket(s) (${item.payload.percentage}%)`, item.payload.fullCategory]}
                  contentStyle={{ borderRadius: "0.75rem", borderColor: "#e2e8f0", fontSize: "12px" }}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Classement de récurrence</h3>
          <p className="text-xs text-slate-400 mb-4">Catégories triées par fréquence</p>
          <div className="space-y-3">
            {data.by_category.map((c, idx) => (
              <div key={c.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 truncate pr-2">
                    {idx + 1}. {c.category}
                  </span>
                  <span className="font-semibold text-slate-800 tabular-nums shrink-0">
                    {c.count} ({c.percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${idx === 0 && c.count > 0 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${(c.count / maxCatCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">Historique détaillé des tickets résolus</h3>
            <p className="text-xs text-slate-400">{filteredTickets.length} ticket(s) affiché(s)</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                data-testid="resolved-stats-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un problème..."
                className="h-9 w-full sm:w-56 rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger data-testid="resolved-stats-category-filter" className="h-9 w-48 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                <SelectItem value="Toutes">Toutes les catégories</SelectItem>
                {data.by_category.map((c) => (
                  <SelectItem key={c.category} value={c.category}>
                    {c.category} ({c.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <th className="text-left font-semibold py-3.5 px-4">Problème</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden md:table-cell">Catégorie</th>
                <th className="text-left font-semibold py-3.5 px-4">Priorité</th>
                <th className="text-left font-semibold py-3.5 px-4">Statut</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden lg:table-cell">Technicien</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden sm:table-cell">Délai</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden xl:table-cell">Solution apportée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTickets.map((t) => (
                <tr key={t.id} data-testid={`resolved-ticket-row-${t.id}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-800">{t.title}</div>
                    <div className="text-xs text-slate-400">
                      {t.creator_name} · Résolu le {formatDateTime(t.updated_at)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 hidden md:table-cell text-slate-600">{t.category}</td>
                  <td className="py-3.5 px-4">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-3.5 px-4 hidden lg:table-cell text-slate-600">{nameOf(t.assigned_to)}</td>
                  <td className="py-3.5 px-4 hidden sm:table-cell font-mono text-xs text-slate-600">
                    {formatDuration(t.duration_hours)}
                  </td>
                  <td className="py-3.5 px-4 hidden xl:table-cell text-slate-600 max-w-xs truncate" title={t.resolution_notes}>
                    {t.resolution_notes || "—"}
                  </td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Inbox className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    Aucun ticket résolu pour ce filtre
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
