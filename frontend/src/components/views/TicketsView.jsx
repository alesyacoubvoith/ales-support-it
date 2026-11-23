import { useState, useEffect, useCallback } from "react";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge, PriorityBadge } from "@/components/Bits";
import { formatDateTime } from "@/lib/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Inbox, Paperclip, Download, Lock, Send } from "lucide-react";
import { FILE_BASE } from "@/lib/api";

const STATUSES = ["Nouveau", "En cours", "En attente pièce", "Résolu", "Fermé"];
const ASSIGNEES = [{ id: "EMP-ALES", name: "Ales" }, { id: "EMP-SAM", name: "Sam" }];

export const TicketsView = ({ adminMode }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const params = adminMode ? {} : { creator_id: user.id };
    const r = await endpoints.tickets(params);
    setTickets(r.data);
  }, [adminMode, user.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = tickets.filter((t) => {
    const okStatus = statusFilter === "Tous" || t.status === statusFilter;
    const okSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.creator_name.toLowerCase().includes(search.toLowerCase());
    return okStatus && okSearch;
  });

  const nameOf = (id) => ASSIGNEES.find((a) => a.id === id)?.name || "—";

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">{adminMode ? "Tous les tickets" : "Mes tickets"}</h2>
          <p className="text-sm text-slate-500">{filtered.length} ticket(s)</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              data-testid="ticket-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="h-10 w-full sm:w-56 rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="ticket-status-filter" className="h-10 w-40 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
              <SelectItem value="Tous">Tous les statuts</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <th className="text-left font-semibold py-3.5 px-4">Ticket</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden md:table-cell">Catégorie</th>
                {adminMode && <th className="text-left font-semibold py-3.5 px-4 hidden lg:table-cell">Demandeur</th>}
                <th className="text-left font-semibold py-3.5 px-4">Priorité</th>
                <th className="text-left font-semibold py-3.5 px-4">Statut</th>
                <th className="text-left font-semibold py-3.5 px-4 hidden xl:table-cell">Assigné</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  data-testid={`ticket-row-${t.id}`}
                  onClick={() => setSelected(t)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-800">{t.title}</div>
                    <div className="text-xs text-slate-400">{formatDateTime(t.created_at)}</div>
                  </td>
                  <td className="py-3.5 px-4 hidden md:table-cell text-slate-600">{t.category}</td>
                  {adminMode && <td className="py-3.5 px-4 hidden lg:table-cell text-slate-600">{t.creator_name}</td>}
                  <td className="py-3.5 px-4"><PriorityBadge priority={t.priority} /></td>
                  <td className="py-3.5 px-4"><StatusBadge status={t.status} /></td>
                  <td className="py-3.5 px-4 hidden xl:table-cell text-slate-600">{nameOf(t.assigned_to)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-16 text-center text-slate-400">
                  <Inbox className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  Aucun ticket
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TicketDetail ticket={selected} adminMode={adminMode} onClose={() => setSelected(null)} onUpdated={() => { load(); setSelected(null); }} />
    </div>
  );
};

const TicketDetail = ({ ticket, adminMode, onClose, onUpdated }) => {
  const { isAdmin, user } = useAuth();
  const canUseAdminChat = Boolean(adminMode && isAdmin);
  const [status, setStatus] = useState("");
  const [assigned, setAssigned] = useState("");
  const [notes, setNotes] = useState("");
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const loadComments = useCallback(async (ticketId) => {
    try {
      const r = await endpoints.ticketAdminComments(ticketId);
      setComments(r.data);
    } catch {
      setComments([]);
    }
  }, []);

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setAssigned(ticket.assigned_to || "none");
      setNotes(ticket.resolution_notes || "");
      setCommentText("");
      if (canUseAdminChat) {
        loadComments(ticket.id);
      } else {
        setComments([]);
      }
    }
  }, [ticket, canUseAdminChat, loadComments]);

  if (!ticket) return null;

  const save = async () => {
    try {
      await endpoints.updateTicket(ticket.id, {
        status,
        assigned_to: assigned === "none" ? null : assigned,
        resolution_notes: notes,
      });
      toast.success("Ticket mis à jour");
      onUpdated();
    } catch {
      toast.error("Erreur de mise à jour");
    }
  };

  const sendComment = async () => {
    const msg = commentText.trim();
    if (!msg) return;
    setSendingComment(true);
    try {
      const r = await endpoints.addTicketAdminComment(ticket.id, msg);
      setComments((prev) => [...prev, r.data]);
      setCommentText("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Impossible d'envoyer le message");
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <Dialog open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="ticket-detail-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-xl pr-6">{ticket.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">{ticket.category}</span>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">{ticket.description}</div>
          {ticket.attachment && (
            <a href={`${FILE_BASE}${ticket.attachment.url}`} target="_blank" rel="noreferrer" data-testid="ticket-attachment-link" className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 transition-colors">
              <Paperclip className="h-4 w-4" /><span className="truncate flex-1">{ticket.attachment.name || "Pièce jointe"}</span><Download className="h-4 w-4" />
            </a>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div><span className="font-semibold text-slate-600">Demandeur:</span> {ticket.creator_name}</div>
            <div><span className="font-semibold text-slate-600">Créé:</span> {formatDateTime(ticket.created_at)}</div>
          </div>

          {canUseAdminChat ? (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Statut</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger data-testid="detail-status-select" className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Assigné à</label>
                    <Select value={assigned} onValueChange={setAssigned}>
                      <SelectTrigger data-testid="detail-assign-select" className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                        <SelectItem value="none">Non assigné</SelectItem>
                        {ASSIGNEES.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Note de résolution (visible par l'employé)</label>
                  <textarea
                    data-testid="detail-notes-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <button data-testid="detail-save-button" onClick={save} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-colors">
                  Enregistrer
                </button>
              </div>

              <div data-testid="admin-internal-chat" className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                    <Lock className="h-3.5 w-3.5" /> Discussion interne (Admins uniquement)
                  </div>
                  <span className="text-[11px] text-amber-700">Invisible pour l'employé</span>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                  {comments.map((c) => {
                    const isMine = c.author_id === user?.id;
                    return (
                      <div key={c.id} data-testid={`admin-comment-${c.id}`} className={`rounded-lg border px-3 py-2 text-xs ${isMine ? "bg-blue-50 border-blue-200" : "bg-white border-amber-200/80"}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-slate-800">{c.author_name}</span>
                          <span className="text-[11px] text-slate-400">{formatDateTime(c.created_at)}</span>
                        </div>
                        <div className="text-slate-700 whitespace-pre-wrap">{c.message}</div>
                      </div>
                    );
                  })}
                  {comments.length === 0 && (
                    <div className="text-xs text-amber-700/80 italic py-2 text-center">
                      Aucun message interne pour le moment.
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    data-testid="admin-comment-input"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendComment()}
                    placeholder="Écrire un message entre admins..."
                    className="flex-1 h-9 rounded-lg border border-amber-200 bg-white px-3 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    data-testid="admin-comment-send"
                    onClick={sendComment}
                    disabled={sendingComment || !commentText.trim()}
                    className="h-9 px-3.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" /> Envoyer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            ticket.resolution_notes && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Note du support</div>
                <div className="text-sm text-slate-700">{ticket.resolution_notes}</div>
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
