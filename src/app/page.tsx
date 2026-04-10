"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
/* jsPDF loaded dynamically inside handleDownloadPdf to avoid Vercel bundling issues */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Bell,
  BarChart3,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  Download,
  FileText,
  Filter,
  RefreshCw,
  TrendingUp,
  Calendar,
  Scale,
  Gavel,
  FileDown,
  Shield,
  ArrowRight,
  LogOut,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

// ===================== TYPES =====================
interface Arguido {
  id: number;
  numeroId: string;
  numeroProcesso: string;
  nomeArguido: string;
  dataDetencao: string | null;
  crime: string;
  dataRemessaJg: string | null;
  dataRegresso: string | null;
  medidasAplicadas: string;
  dataMedidasAplicadas: string | null;
  dataRemessaSic: string | null;
  fimPrimeiroPrazo: string | null;
  dataProrrogacao: string | null;
  duracaoProrrogacao: number;
  fimSegundoPrazo: string | null;
  magistrado: string;
  remessaJgAlteracao: string;
  obs1: string;
  obs2: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AlertaItem {
  id: number;
  arguidoId: number;
  tipoAlerta: string;
  diasRestantes: number;
  mensagem: string;
  canalEnvio: string;
  statusEnvio: string;
  dataDisparo: string;
  arguido?: { numeroId: string; numeroProcesso: string; nomeArguido: string };
}

interface DashboardStats {
  totalArguidos: number;
  ativos: number;
  vencidos: number;
  encerrados: number;
  totalAlertas: number;
  alertasPendentes: number;
  prazosProximos: number;
  prazosCriticos: number;
  processosUrgentes: Array<{
    id: number;
    numeroId: string;
    numeroProcesso: string;
    nomeArguido: string;
    crime: string;
    diasRestantes: number;
    dataVencimento: string;
    tipo: string;
  }>;
  crimes: Array<{ crime: string; _count: { crime: number } }>;
  magistrados: Array<{ magistrado: string; _count: { magistrado: number } }>;
  monthlyCounts: Record<string, number>;
  statusCounts: Array<{ status: string; _count: { status: number } }>;
}

const CRIMES_LIST = [
  "Homicídio", "Roubo", "Furto", "Tráfico de drogas", "Corrupção",
  "Fraude", "Lavagem de dinheiro", "Sequestro", "Trafico de armas",
  "Crime informático", "Abuso de poder", "Peculato", "Outros",
];

const MEDIDAS_LIST = [
  "Prisão Preventiva", "Prisão Domiciliaria", "Liberdade Provisória",
  "Obrigação de Permanência", "Suspensão de Funções",
];

// ===================== HELPERS =====================
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getDaysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.ceil((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDeadlineColor(days: number | null): string {
  if (days === null) return "bg-gray-200 text-gray-600";
  if (days < 0) return "bg-[#d9534f] text-white font-bold";
  if (days <= 3) return "bg-[#d9534f] text-white font-bold";
  if (days <= 7) return "bg-[#f0ad4e] text-white font-bold";
  return "bg-[#5cb85c] text-white font-bold";
}

function getDeadlineLabel(days: number | null): string {
  if (days === null) return "Sem prazo";
  if (days < 0) return `Vencido há ${Math.abs(days)} dia${Math.abs(days) > 1 ? "s" : ""}`;
  if (days === 0) return "Vence hoje!";
  if (days === 1) return "Vence amanhã!";
  return `${days} dias restantes`;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ativo": return "default";
    case "vencido": return "destructive";
    case "encerrado": return "secondary";
    default: return "outline";
  }
}

const emptyArguido: Omit<Arguido, "id" | "numeroId" | "createdAt" | "updatedAt"> = {
  numeroProcesso: "",
  nomeArguido: "",
  dataDetencao: null,
  crime: "",
  dataRemessaJg: null,
  dataRegresso: null,
  medidasAplicadas: "",
  dataMedidasAplicadas: null,
  dataRemessaSic: null,
  fimPrimeiroPrazo: null,
  dataProrrogacao: null,
  duracaoProrrogacao: 0,
  fimSegundoPrazo: null,
  magistrado: "",
  remessaJgAlteracao: "",
  obs1: "",
  obs2: "",
  status: "ativo",
};

// ===================== PUBLIC SEARCH TYPES =====================
interface PublicArguidoSummary {
  id: number;
  numeroId: string;
  numeroProcesso: string;
  nomeArguido: string;
  dataDetencao: string | null;
  crime: string;
  medidasAplicadas: string;
  dataMedidasAplicadas: string | null;
  fimPrimeiroPrazo: string | null;
  fimSegundoPrazo: string | null;
  status: string;
  magistrado: string;
}

// ===================== LANDING PAGE =====================
function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicArguidoSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');

  const handleEnter = () => {
    setIsExiting(true);
    setTimeout(() => onEnter(), 600);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchDone(false);
    setSearchMsg('');
    setSearchResults([]);

    try {
      const res = await fetch(`/api/arguidos/search-public?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (data.found) {
        setSearchResults(data.results);
        setSearchMsg('');
      } else {
        setSearchResults([]);
        setSearchMsg(data.message || 'Nenhum processo encontrado.');
      }
    } catch {
      setSearchMsg('Erro de ligação ao servidor.');
    } finally {
      setSearchDone(true);
      setSearchLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-start relative overflow-hidden ${isExiting ? 'landing-fadeout' : ''}`}
      style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #1a1a2e 100%)' }}>
      
      {/* Animated Fog Layers */}
      <div className="landing-fog-layer landing-fog-1" />
      <div className="landing-fog-layer landing-fog-2" />
      <div className="landing-fog-layer landing-fog-3" />
      <div className="landing-fog-layer landing-fog-4" />
      <div className="landing-fog-layer landing-fog-5" />
      
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-12 sm:pt-16 pb-8 w-full max-w-3xl">
        
        {/* PGR Insignia */}
        <div className="landing-insignia mb-8">
          <img 
            src="/insignia-pgr.png" 
            alt="Brasão PGR" 
            className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain"
          />
        </div>

        {/* Title */}
        <h1 className="landing-fade-in-up-delay-1 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
          Procuradoria-Geral da República
        </h1>

        {/* Subtitle with shimmer */}
        <div className="landing-fade-in-up-delay-2 mb-2">
          <p className="text-lg sm:text-xl md:text-2xl font-semibold landing-text-shimmer">
            REPÚBLICA DE ANGOLA
          </p>
        </div>

        {/* System name */}
        <div className="landing-fade-in-up-delay-2 mt-4 mb-8">
          <div className="inline-flex items-center gap-3 bg-white/[0.06] backdrop-blur-sm border border-white/[0.1] rounded-full px-8 py-4">
            <Scale className="w-7 h-7 text-orange-400" />
            <span className="text-lg sm:text-xl md:text-2xl text-stone-200 font-semibold">
              Sistema de Controlo de Arguidos em Prisão Preventiva
            </span>
          </div>
        </div>

        {/* Enter Button */}
        <div className="landing-fade-in-up-delay-3 mb-10">
          <button
            onClick={handleEnter}
            className="group relative px-10 py-4 bg-gradient-to-r from-[#c2410c] via-[#ea580c] to-[#c2410c] text-white font-bold text-base sm:text-lg rounded-xl shadow-[0_0_30px_rgba(194,65,12,0.3)] hover:shadow-[0_0_50px_rgba(194,65,12,0.5)] transition-all duration-500 overflow-hidden cursor-pointer"
          >
            {/* Shimmer overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative flex items-center gap-3">
              <Shield className="w-5 h-5" />
              ACESSAR SISTEMA
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="w-full max-w-md flex items-center gap-4 mb-6 landing-fade-in-up-delay-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-stone-500 font-medium">Pesquisa Pública</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* Search Section */}
        <div className="landing-fade-in-up-delay-3 w-full max-w-lg">
          <form onSubmit={handleSearch} className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nº Processo, Nome ou ID do Arguido..."
                className="w-full h-11 pl-10 pr-4 bg-white/[0.07] backdrop-blur-sm border border-white/[0.12] rounded-xl text-sm text-white placeholder-stone-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={searchLoading || !searchQuery.trim()}
              className="h-11 px-5 bg-gradient-to-r from-[#c2410c] to-[#ea580c] text-white font-semibold text-sm rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {searchLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Pesquisar</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Search Results */}
        {searchDone && searchResults.length > 0 && (
          <div className="w-full max-w-2xl mt-6 space-y-3 animate-[fadeIn_0.3s_ease-out]">
            <p className="text-xs text-stone-400 text-center">
              {searchResults.length} resultado{searchResults.length > 1 ? 's' : ''} encontrado{searchResults.length > 1 ? 's' : ''}
            </p>
            {searchResults.map((item) => {
              const days1 = getDaysRemaining(item.fimPrimeiroPrazo);
              const days2 = getDaysRemaining(item.fimSegundoPrazo);
              return (
                <div
                  key={item.id}
                  className="bg-white/[0.06] backdrop-blur-md border border-white/[0.1] rounded-2xl p-5 text-left hover:border-orange-500/30 hover:bg-white/[0.08] transition-all duration-300"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate">{item.nomeArguido}</h3>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {item.numeroId} · Processo Nº {item.numeroProcesso}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide ${
                      item.status === 'ativo' ? 'bg-[#1c3d5a] text-blue-300' :
                      item.status === 'vencido' ? 'bg-[#a10000]/80 text-red-300' :
                      'bg-stone-600/80 text-stone-300'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <InfoPill icon={<Calendar className="w-3 h-3" />} label="Detenção" value={formatDate(item.dataDetencao)} />
                    <InfoPill icon={<Gavel className="w-3 h-3" />} label="Crime" value={item.crime || '—'} />
                    <InfoPill icon={<Building2 className="w-3 h-3" />} label="Medida" value={item.medidasAplicadas || '—'} />
                    <InfoPill icon={<UserPlus className="w-3 h-3" />} label="Magistrado" value={item.magistrado || '—'} />
                    <InfoPill
                      icon={<Clock className="w-3 h-3" />}
                      label="1º Prazo"
                      value={item.fimPrimeiroPrazo ? formatDate(item.fimPrimeiroPrazo) : '—'}
                      badge={days1 !== null ? getDeadlineLabel(days1) : undefined}
                      badgeColor={days1 !== null ? getDeadlineColor(days1) : undefined}
                    />
                    <InfoPill
                      icon={<Clock className="w-3 h-3" />}
                      label="2º Prazo"
                      value={item.fimSegundoPrazo ? formatDate(item.fimSegundoPrazo) : '—'}
                      badge={days2 !== null ? getDeadlineLabel(days2) : undefined}
                      badgeColor={days2 !== null ? getDeadlineColor(days2) : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No Results Message */}
        {searchDone && searchResults.length === 0 && searchMsg && (
          <div className="w-full max-w-lg mt-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 text-center">
              <AlertCircle className="w-8 h-8 text-stone-500 mx-auto mb-3" />
              <p className="text-sm text-stone-400">{searchMsg}</p>
              <p className="text-xs text-stone-600 mt-1">
                Tente pesquisar pelo nome, número do processo ou ID.
              </p>
            </div>
          </div>
        )}

        {/* Footer text */}
        <div className="landing-fade-in-up-delay-3 mt-auto pt-10">
          <p className="text-[11px] text-stone-500 tracking-wide">
            Acesso restrito e monitorizado — PGR Angola © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ===================== INFO PILL COMPONENT =====================
function InfoPill({ icon, label, value, badge, badgeColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="bg-white/[0.04] rounded-lg px-3 py-2.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-stone-500">
        {icon}
        <span className="text-[10px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-200 font-medium truncate">{value}</span>
        {badge && badgeColor && (
          <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ===================== LOGIN PAGE =====================
function LoginPage({ onLogin }: { onLogin: (user: { username: string; nome: string; role: string }) => void }) {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLogin(data.user);
      } else {
        setLoginError(data.error || 'Credenciais inválidas');
      }
    } catch {
      setLoginError('Erro de ligação ao servidor');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pgr-bg p-4">
      <Card className="w-full max-w-md shadow-2xl bg-pgr-surface border border-stone-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-pgr-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Scale className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-pgr-text">PGR ANGOLA</CardTitle>
          <CardDescription className="text-sm text-pgr-text-muted">Sistema de Controlo de Arguidos em Prisão Preventiva</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {loginError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="login-user" className="text-sm font-medium text-pgr-text">Utilizador</Label>
              <Input
                id="login-user"
                type="text"
                placeholder="nome.utilizador"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="h-11 bg-stone-100 text-pgr-text border-stone-200"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-pass" className="text-sm font-medium text-pgr-text">Senha</Label>
              <Input
                id="login-pass"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="h-11 bg-stone-100 text-pgr-text border-stone-200"
                autoComplete="current-password"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-pgr-primary text-white font-bold text-sm hover:opacity-90"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  A verificar...
                </span>
              ) : (
                'Entrar no Sistema'
              )}
            </Button>
          </form>
          <p className="text-[11px] text-pgr-text-muted text-center mt-6">
            Acesso restrito e monitorizado — Procuradoria-Geral da República de Angola
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== MAIN PAGE =====================
function AppContent({ authUser, onLogout }: { authUser: { username: string; nome: string; role: string } | null; onLogout: () => void }) {
  const { toast } = useToast();

  const [activeView, setActiveView] = useState("dashboard");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [arguidos, setArguidos] = useState<Arguido[]>([]);
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Push notification state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "default">("default");
  const [pushSubscribed, setPushSubscribed] = useState(false);

  // In-app notification state (works on ALL devices including iOS)
  const [inAppNotification, setInAppNotification] = useState<{
    expirados: number;
    criticos: number;
    atencao: number;
    normal: number;
    total: number;
    hasUrgent: boolean;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState(emptyArguido);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewDetail, setViewDetail] = useState<Arguido | null>(null);
  const [viewDetailLoading, setViewDetailLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<number | null>(null);

  // Table state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCrime, setFilterCrime] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPrazo, setFilterPrazo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 15;

  // Fetch data - using refs to avoid lint issues with setState in effects
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [statsRes, alertasRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/alertas?limit=100"),
      ]);
      if (statsRes.ok) {
        setStats(await statsRes.json());
      } else {
        console.error("Stats API error:", statsRes.status);
      }
      if (alertasRes.ok) {
        setAlertas(await alertasRes.json());
      } else {
        console.error("Alertas API error:", alertasRes.status);
      }
    } catch (e) {
      console.error("Failed to load initial data:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadArguidos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        crime: filterCrime,
        status: filterStatus,
        prazoFilter: filterPrazo,
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });
      const res = await fetch(`/api/arguidos?${params}`);
      if (res.ok) {
        const data = await res.json();
        setArguidos(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalRecords(data.pagination.total);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadAlertas = async () => {
    try {
      const res = await fetch("/api/alertas?limit=100");
      if (res.ok) setAlertas(await res.json());
    } catch (e) { console.error(e); }
  };

  // ============ PWA & PUSH NOTIFICATIONS ============
  useEffect(() => {
    // Check URL params for view
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view && ['dashboard', 'cadastro', 'gestao', 'alertas', 'relatorios'].includes(view)) {
      setActiveView(view);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    registerServiceWorker().then(() => {
      // Auto-request notification permission + subscribe after a short delay
      setTimeout(() => {
        forceSubscribePush().then(() => {
          // After subscribing, auto-check deadlines + send push notifications
          setTimeout(() => {
            autoCheckAndNotify();
          }, 1000);
        });
      }, 2000);
    });

    // On visibility change: only reload stats, do NOT trigger notifications again
    // Notifications should only appear once per page load
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] Page became visible, reloading data only (no notifications)');
        loadStats();
        loadAlertas();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (activeView === "gestao") loadArguidos();
  }, [activeView, searchTerm, filterCrime, filterStatus, filterPrazo, currentPage]);

  // Register Service Worker
  const registerServiceWorker = async (): Promise<boolean> => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[PWA] Service Worker registered:', registration.scope);

        // Check if already subscribed
        try {
          const sub = await registration.pushManager.getSubscription();
          setPushSubscribed(!!sub);
        } catch {
          // Push not available in this environment
        }
        return true;
      } catch (err) {
        // Silent fail — SW not critical for core functionality
        console.warn('[PWA] Service Worker not available in this environment');
        return false;
      }
    }
    return false;
  };

  const checkNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  };

  // Convert base64 VAPID key to Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Force subscribe — called automatically on first visit
  const forceSubscribePush = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (!('Notification' in window)) return false;

    try {
      // If already subscribed, do nothing
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        setPushSubscribed(true);
        return true;
      }

      // Request permission (shows browser dialog)
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission !== 'granted') return false;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return false;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')!))),
          },
        }),
      });

      if (res.ok) {
        setPushSubscribed(true);
        console.log('[PWA] Push subscribed successfully');
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Auto-subscribe failed:', err);
      return false;
    }
  };

  const handleSubscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({ title: 'Não suportado', description: 'Este navegador não suporta notificações push.', variant: 'destructive' });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission !== 'granted') {
        toast({ title: 'Permissão negada', description: 'Ative as notificações nas configurações do navegador.', variant: 'destructive' });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        toast({ title: 'Erro', description: 'Chave VAPID não configurada.', variant: 'destructive' });
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')!))),
          },
        }),
      });

      if (res.ok) {
        setPushSubscribed(true);
        toast({ title: 'Notificações Ativadas!', description: 'Receberá alertas de prazos diretamente no seu dispositivo.' });
      } else {
        toast({ title: 'Erro', description: 'Falha ao registar notificações.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Push subscribe error:', err);
      toast({ title: 'Erro', description: 'Falha ao ativar notificações.', variant: 'destructive' });
    }
  };

  const handleUnsubscribePush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, { method: 'DELETE' });
      }
      setPushSubscribed(false);
      toast({ title: 'Notificações desativadas' });
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    }
  };

  // Test notification
  const handleTestNotification = async () => {
    try {
      toast({ title: "A verificar alertas do sistema..." });

      // Fetch real summary from server
      const notifyRes = await fetch("/api/push/notify-alertas");
      if (notifyRes.ok) {
        const d = await notifyRes.json();

        // Show in-app notification with real data (rich overlay — works everywhere)
        setInAppNotification({
          expirados: d.expirados,
          criticos: d.criticos,
          atencao: d.atencao,
          normal: d.normal,
          total: d.total,
          hasUrgent: d.hasUrgent,
        });
        // Push is sent via API → Service Worker (single source — no duplicate native notification)

        if (d.sent > 0) {
          toast({ title: "Push + In-App", description: `${d.sent} push + notificação no ecrã mostrada.` });
        } else {
          toast({ title: "In-App Notificação", description: "Notificação mostrada no ecrã." });
        }
      } else {
        // Fallback with fake test data
        setInAppNotification({
          expirados: 1,
          criticos: 2,
          atencao: 3,
          normal: 10,
          total: 16,
          hasUrgent: true,
        });

      }
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao verificar alertas.", variant: "destructive" });
    }
  };

  // ===== AUTO: Check deadlines + show in-app notification =====
  // Cooldown: only run once per session load, NOT on every visibility change
  // Push notifications are sent only via Service Worker (single source of truth)
  const _autoNotifyDone = React.useRef(false);

  const autoCheckAndNotify = async () => {
    // Prevent duplicate runs — only once per page load
    if (_autoNotifyDone.current) {
      console.log('[Auto-Notify] Skipping — already notified this session');
      return;
    }

    try {
      console.log('[Auto-Notify] Starting automatic alert check (once per session)...');

      // 1. Run deadline check (updates DB with any new alerts)
      try {
        const checkRes = await fetch("/api/alertas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check" }),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          console.log('[Auto-Notify] DB check done, new alerts:', checkData.newAlertsCreated);
        }
      } catch (e) {
        console.warn('[Auto-Notify] Deadline check failed (non-critical):', e);
      }

      // 2. Reload stats and alerts list
      loadStats();
      loadAlertas();

      // 3. Get categorized summary + show in-app overlay (ALWAYS, regardless of push success)
      try {
        const notifyRes = await fetch("/api/push/notify-alertas");
        if (notifyRes.ok) {
          const d = await notifyRes.json();
          console.log('[Auto-Notify] Summary:', d.expirados, 'expirados,', d.criticos, 'criticos,', d.atencao, 'atencao,', d.normal, 'normal | Push sent:', d.sent);

          // 4. Show in-app notification overlay — ALWAYS (works on ALL devices including iOS)
          if (d.expirados > 0 || d.criticos > 0 || d.atencao > 0) {
            setInAppNotification({
              expirados: d.expirados,
              criticos: d.criticos,
              atencao: d.atencao,
              normal: d.normal,
              total: d.total,
              hasUrgent: d.hasUrgent,
            });
          }
          return;
        }
      } catch (pushErr) {
        console.warn('[Auto-Notify] Push API failed, using stats fallback:', pushErr);
      }

      // 5. Fallback: use stats API if push API failed
      try {
        const statsData = await fetch('/api/stats').then(r => r.json());
        if (statsData && (statsData.prazosCriticos > 0 || statsData.prazosProximos > 0)) {
          setInAppNotification({
            expirados: statsData.vencidos || 0,
            criticos: statsData.prazosCriticos || 0,
            atencao: (statsData.prazosProximos || 0) - (statsData.prazosCriticos || 0),
            normal: (statsData.ativos || 0) - (statsData.prazosProximos || 0),
            total: statsData.totalArguidos || 0,
            hasUrgent: (statsData.prazosCriticos || 0) > 0,
          });
        }
      } catch (e) {
        console.warn('[Auto-Notify] Stats fallback also failed:', e);
      }
    } catch (err) {
      console.warn('[Auto-Notify] Background check failed:', err);
    }

    // Mark as done — will NOT run again until page is fully reloaded
    _autoNotifyDone.current = true;
  };

  // Show native browser notification (Desktop/Android only, does NOT work on iOS)
  const showLocalNotification = (title: string, body: string) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        // Skip on iOS — new Notification() doesn't work on iOS Safari
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
          console.log('[Auto-Notify] Skipping native notification on iOS (not supported), using in-app notification instead');
          return;
        }
        const notification = new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/maskable-icon-192x192.png',
          tag: 'pgr-local-' + Date.now(),
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
        });
        notification.onclick = () => {
          window.focus();
          window.location.href = '/?view=alertas';
          notification.close();
        };
        console.log('[Auto-Notify] Native notification shown:', title);
      }
    } catch (e) {
      console.warn('[Auto-Notify] Native notification failed (expected on iOS):', e);
    }
  };

  // ===== IN-APP NOTIFICATION (works on ALL devices including iOS) =====

  // Play alert sound using Web Audio API (works on iOS)
  const playAlertSound = (urgent: boolean = false) => {
    try {
      if (typeof window === 'undefined' || !window.AudioContext && !(window as unknown as Record<string, unknown>).webkitAudioContext) return;
      const AudioCtx = window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext;
      const ctx = new (AudioCtx as typeof AudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.gain.value = 0.3;

      if (urgent) {
        // Triple beep for critical
        oscillator.frequency.value = 880;
        oscillator.type = 'square';
        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.setValueAtTime(0, now + 0.15);
        gainNode.gain.setValueAtTime(0.3, now + 0.25);
        gainNode.gain.setValueAtTime(0, now + 0.4);
        gainNode.gain.setValueAtTime(0.3, now + 0.5);
        gainNode.gain.setValueAtTime(0, now + 0.65);
        oscillator.start(now);
        oscillator.stop(now + 0.65);
      } else {
        // Single ping for warning
        oscillator.frequency.value = 660;
        oscillator.type = 'sine';
        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
      }
    } catch (e) {
      // Sound not critical — silent fail
      console.warn('[Audio] Could not play alert sound:', e);
    }
  };

  // Check deadlines
  const checkDeadlines = async () => {
    try {
      const res = await fetch("/api/alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Verificação concluída", description: `${data.newAlertsCreated} novo(s) alerta(s) criado(s).` });
        loadStats();
        loadAlertas();
      }
    } catch (e) { console.error(e); }
  };

  // CRUD handlers
  const handleOpenCreate = () => {
    setFormData(emptyArguido);
    setEditingId(null);
    setFormMode("create");
    setFormOpen(true);
  };

  const handleOpenEdit = (arguido: Arguido) => {
    setFormData({
      numeroProcesso: arguido.numeroProcesso,
      nomeArguido: arguido.nomeArguido,
      dataDetencao: arguido.dataDetencao,
      crime: arguido.crime,
      dataRemessaJg: arguido.dataRemessaJg,
      dataRegresso: arguido.dataRegresso,
      medidasAplicadas: arguido.medidasAplicadas,
      dataMedidasAplicadas: arguido.dataMedidasAplicadas,
      dataRemessaSic: arguido.dataRemessaSic,
      fimPrimeiroPrazo: arguido.fimPrimeiroPrazo,
      dataProrrogacao: arguido.dataProrrogacao,
      duracaoProrrogacao: arguido.duracaoProrrogacao,
      fimSegundoPrazo: arguido.fimSegundoPrazo,
      magistrado: arguido.magistrado,
      remessaJgAlteracao: arguido.remessaJgAlteracao,
      obs1: arguido.obs1,
      obs2: arguido.obs2,
      status: arguido.status,
    });
    setEditingId(arguido.id);
    setFormMode("edit");
    setFormOpen(true);
  };

  const handleSubmitForm = async () => {
    if (!formData.nomeArguido.trim()) {
      toast({ title: "Erro", description: "Nome do arguido é obrigatório.", variant: "destructive" });
      return;
    }
    try {
      const editId = formMode === "edit" ? (editingId || viewDetail?.id) : undefined;
      const finalUrl = formMode === "create" ? "/api/arguidos" : `/api/arguidos/${editId}`;

      const res = await fetch(finalUrl, {
        method: formMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast({ title: formMode === "create" ? "Arguido cadastrado!" : "Arguido atualizado!" });
        setFormOpen(false);
        setEditingId(null);
        setViewDetail(null);
        loadStats();
        loadArguidos();
        loadAlertas();
      } else {
        toast({ title: "Erro", description: "Falha ao salvar.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Erro de conexão.", variant: "destructive" });
    }
  };

  const handleEditFromView = () => {
    if (viewDetail) {
      handleOpenEdit(viewDetail);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/arguidos/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Arguido removido." });
        setDeleteDialog(null);
        setViewDetail(null);
        loadStats();
        loadArguidos();
      }
    } catch (e) { console.error(e); }
  };

  // Fetch full arguido by ID and open detail dialog
  const fetchAndShowDetail = async (id: number) => {
    setViewDetailLoading(true);
    try {
      const res = await fetch(`/api/arguidos/${id}`);
      if (res.ok) {
        const fullArguido = await res.json();
        setViewDetail(fullArguido);
      } else {
        toast({ title: "Erro", description: "Falha ao carregar detalhes.", variant: "destructive" });
      }
    } catch (e) {
      console.error("Fetch detail error:", e);
      toast({ title: "Erro", description: "Erro de conexão.", variant: "destructive" });
    } finally {
      setViewDetailLoading(false);
    }
  };

  const handleDownloadPdf = async (arguido: Arguido) => {
    try {
      toast({ title: "A gerar PDF...", description: `Ficha de ${arguido.nomeArguido}` });

      // Dynamic import to avoid Vercel/Next.js bundling issues
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;

      // === HEADER ===
      doc.setFillColor(194, 65, 12); // #c2410c
      doc.rect(0, 0, pageWidth, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("PGR ANGOLA", pageWidth / 2, 12, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Procuradoria-Geral da República — Ficha de Arguido em Prisão Preventiva", pageWidth / 2, 20, { align: "center" });

      // === Identificação ===
      let y = 36;
      doc.setTextColor(28, 25, 23); // #1c1917
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`ID: ${arguido.numeroId}  |  Processo Nº: ${arguido.numeroProcesso}`, margin, y);
      y += 7;
      doc.setFontSize(14);
      doc.text(arguido.nomeArguido, margin, y);

      // Status badge
      const statusColors: Record<string, [number, number, number]> = {
        ativo: [28, 61, 90],
        vencido: [161, 0, 0],
        encerrado: [156, 163, 175],
      };
      const sc = statusColors[arguido.status] || [120, 120, 120];
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const statusLabel = arguido.status.charAt(0).toUpperCase() + arguido.status.slice(1);
      const statusTextW = doc.getTextWidth(statusLabel) + 8;
      doc.setFillColor(sc[0], sc[1], sc[2]);
      doc.roundedRect(pageWidth - margin - statusTextW, y - 5, statusTextW, 7, 1.5, 1.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(statusLabel, pageWidth - margin - statusTextW / 2, y, { align: "center" });

      y += 12;

      // === Dados Pessoais ===
      const sectionTitle = (title: string) => {
        doc.setFontSize(10);
        doc.setTextColor(194, 65, 12);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, y);
        doc.setDrawColor(194, 65, 12);
        doc.setLineWidth(0.4);
        doc.line(margin, y + 1.5, pageWidth - margin, y + 1.5);
        y += 6;
      };

      const fieldRow = (label: string, value: string) => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 113, 108); // #78716c
        doc.text(label, margin, y);
        doc.setTextColor(28, 25, 23);
        doc.setFont("helvetica", "bold");
        doc.text(value || "—", margin + 50, y);
        y += 5.5;
      };

      sectionTitle("DADOS PESSOAIS E PROCESSUAIS");
      fieldRow("Nome:", arguido.nomeArguido);
      fieldRow("Nº Processo:", arguido.numeroProcesso);
      fieldRow("Nº ID:", arguido.numeroId);
      fieldRow("Data de Detenção:", formatDate(arguido.dataDetencao));
      fieldRow("Crime:", arguido.crime);
      fieldRow("Magistrado:", arguido.magistrado);
      fieldRow("Status:", statusLabel);
      y += 3;

      // === Datas e Prazos ===
      sectionTitle("DATAS E PRAZOS PROCESSUAIS");
      fieldRow("Medidas Aplicadas:", arguido.medidasAplicadas);
      fieldRow("Data das Medidas:", formatDate(arguido.dataMedidasAplicadas));
      fieldRow("Remessa ao JG:", formatDate(arguido.dataRemessaJg));
      fieldRow("Data de Regresso:", formatDate(arguido.dataRegresso));
      fieldRow("Remessa ao SIC:", formatDate(arguido.dataRemessaSic));
      fieldRow("Data Prorrogação:", formatDate(arguido.dataProrrogacao));
      fieldRow("Duração Prorrogação:", arguido.duracaoProrrogacao ? `${arguido.duracaoProrrogacao} meses` : "—");
      y += 3;

      // === Prazos Card ===
      sectionTitle("PRAZOS CALCULADOS");
      const days1 = getDaysRemaining(arguido.fimPrimeiroPrazo);
      const days2 = getDaysRemaining(arguido.fimSegundoPrazo);

      const drawDeadlineBox = (label: string, dateStr: string | null, days: number | null, yOffset: number) => {
        const boxW = (pageWidth - margin * 2 - 6) / 2;
        const boxH = 22;
        const dc = days === null ? [229, 231, 235] : days < 0 || days <= 3 ? [217, 83, 79] : days <= 7 ? [240, 173, 78] : [92, 184, 92];
        doc.setFillColor(dc[0], dc[1], dc[2]);
        doc.roundedRect(margin + yOffset, y, boxW, boxH, 2, 2, "F");
        doc.setTextColor(days === null ? 75 : 255, days === null ? 85 : 255, days === null ? 99 : 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(label, margin + yOffset + boxW / 2, y + 6, { align: "center" });
        doc.setFontSize(9);
        doc.text(dateStr ? formatDate(dateStr) : "Não definido", margin + yOffset + boxW / 2, y + 12, { align: "center" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(getDeadlineLabel(days), margin + yOffset + boxW / 2, y + 18, { align: "center" });
      };

      drawDeadlineBox("1º PRAZO (3 MESES)", arguido.fimPrimeiroPrazo, days1, 0);
      drawDeadlineBox("2º PRAZO (PRORROGAÇÃO)", arguido.fimSegundoPrazo, days2, pageWidth / 2 - margin + 3);
      y += 28;

      // === Observações ===
      if (arguido.remessaJgAlteracao || arguido.obs1 || arguido.obs2) {
        sectionTitle("OBSERVAÇÕES");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(87, 83, 78);
        if (arguido.remessaJgAlteracao) {
          doc.setFont("helvetica", "bold");
          doc.text("Remessa JG / Alteração:", margin, y);
          doc.setFont("helvetica", "normal");
          y += 4.5;
          const lines1 = doc.splitTextToSize(arguido.remessaJgAlteracao, pageWidth - margin * 2);
          doc.text(lines1, margin, y);
          y += lines1.length * 4 + 2;
        }
        if (arguido.obs1) {
          doc.setFont("helvetica", "bold");
          doc.text("Observação 1:", margin, y);
          doc.setFont("helvetica", "normal");
          y += 4.5;
          const lines2 = doc.splitTextToSize(arguido.obs1, pageWidth - margin * 2);
          doc.text(lines2, margin, y);
          y += lines2.length * 4 + 2;
        }
        if (arguido.obs2) {
          doc.setFont("helvetica", "bold");
          doc.text("Observação 2:", margin, y);
          doc.setFont("helvetica", "normal");
          y += 4.5;
          const lines3 = doc.splitTextToSize(arguido.obs2, pageWidth - margin * 2);
          doc.text(lines3, margin, y);
          y += lines3.length * 4 + 2;
        }
        y += 3;
      }

      // === Alertas (se existirem via detail view) ===
      const rawAlertas = (arguido as unknown as Record<string, unknown>).alertas;
      if (rawAlertas && Array.isArray(rawAlertas) && rawAlertas.length > 0) {
        sectionTitle("HISTÓRICO DE ALERTAS");
        const alerts = rawAlertas as Array<Record<string, unknown>>;
        autoTable(doc, {
          startY: y,
          head: [["Prazo", "Tipo", "Dias", "Data", "Status"]],
          body: alerts.slice(0, 10).map(a => [
            (a.tipo_alerta as string || "").replace("_", " "),
            getDeadlineLabel(a.dias_restantes as number ?? null),
            String(a.dias_restantes ?? ""),
            a.data_disparo ? formatDate(a.data_disparo as string) : "—",
            a.status_envio || "—",
          ]),
          theme: "grid",
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [113, 113, 122], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 245, 244] },
          margin: { left: margin, right: margin },
        });
      }

      // === FOOTER ===
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFillColor(231, 229, 228);
      doc.rect(0, pageH - 12, pageWidth, 12, "F");
      doc.setFontSize(7);
      doc.setTextColor(168, 162, 158);
      doc.text("© 2024 Procuradoria-Geral da República de Angola — Sistema de Controlo de Arguidos em Prisão Preventiva", pageWidth / 2, pageH - 5, { align: "center" });
      doc.text(`Gerado em ${new Date().toLocaleString("pt-AO")}`, pageWidth / 2, pageH - 1.5, { align: "center" });

      // Save
      const safeName = arguido.nomeArguido.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").substring(0, 50);
      doc.save(`Ficha_${arguido.numeroId}_${safeName}.pdf`);

      toast({ title: "PDF gerado!", description: `Ficha de ${arguido.nomeArguido} descarregada.` });
    } catch (e) {
      console.error("PDF generation error:", e);
      toast({ title: "Erro", description: "Falha ao gerar ficha PDF: " + String(e), variant: "destructive" });
    }
  };

  const handleExportCSV = () => {
    if (arguidos.length === 0) return;
    const headers = ["ID", "Nº Processo", "Nome", "Crime", "Magistrado", "Medidas", "Fim 1º Prazo", "Fim 2º Prazo", "Status"];
    const rows = arguidos.map(a => [
      a.numeroId, a.numeroProcesso, a.nomeArguido, a.crime, a.magistrado,
      a.medidasAplicadas, a.fimPrimeiroPrazo ? formatDate(a.fimPrimeiroPrazo) : "",
      a.fimSegundoPrazo ? formatDate(a.fimSegundoPrazo) : "", a.status,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arguidos_pgr_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportação CSV concluída!" });
  };

  // Navigation items
  const navItems = [
    { id: "dashboard", label: "Painel", icon: LayoutDashboard },
    { id: "cadastro", label: "Cadastro", icon: UserPlus },
    { id: "gestao", label: "Gestão", icon: Users },
    { id: "alertas", label: "Alertas", icon: Bell },
    { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  ];

  const urgentCount = stats?.prazosCriticos || 0;

  // ===================== RENDER =====================
  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        {/* HEADER + NAVBAR */}
        <header className="sticky top-0 z-50 bg-white border-b border-stone-200 shadow-sm">
          <nav className="flex items-center">
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center justify-center flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`relative flex items-center gap-2.5 px-6 py-4 text-[15px] font-semibold transition-colors border-b-[3px] rounded-lg
                      ${isActive
                        ? "bg-pgr-primary text-white shadow-lg border-transparent"
                        : " text-pgr-text hover:text-pgr-text border-transparent hover:bg-stone-100"
                      }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                    {item.id === "alertas" && urgentCount > 0 && (
                      <span className="absolute -top-0.5 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {urgentCount}
                      </span>
                    )}
                  </button>
                );
              })}

            </div>

            {/* Right side icons — desktop */}
            <div className="hidden md:flex items-center gap-1 pr-3">
              {/* Bell icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`relative h-10 w-10 rounded-full transition-colors ${pushSubscribed ? 'text-green-600 hover:bg-green-500/10' : 'text-pgr-text-muted hover:bg-stone-100 hover:text-stone-900'}`}
                    onClick={pushSubscribed ? handleUnsubscribePush : handleSubscribePush}
                  >
                    <Bell className="h-5 w-5" />
                    {pushSubscribed && (
                      <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-green-500 rounded-full" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{pushSubscribed ? 'Notificações ativas — Clique para desativar' : 'Ativar notificações push'}</p>
                </TooltipContent>
              </Tooltip>

              {/* Divider */}
              <div className="w-px h-6 bg-stone-200 mx-1" />

              {/* User info + Sair button */}
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs font-semibold text-pgr-text leading-tight">{authUser?.nome || authUser?.username}</p>
                  <p className="text-[10px] text-pgr-text-muted leading-tight">{authUser?.role || 'Operador'}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full text-pgr-text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={onLogout}
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">Sair do sistema</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Mobile / Tablet Nav */}
            <div className="md:hidden flex items-center flex-1 overflow-x-auto scrollbar-hide">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`relative flex flex-col items-center justify-center gap-1 min-w-[64px] flex-1 py-3 border-b-[3px] transition-colors
                      ${isActive
                        ? "text-pgr-primary border-pgr-primary"
                        : "text-pgr-text border-transparent hover:bg-stone-100"
                      }`}
                  >
                    <div className="relative">
                      <Icon className="h-5 w-5" />
                      {item.id === "alertas" && urgentCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                          {urgentCount}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold leading-tight">{item.label}</span>
                  </button>
                );
              })}

              {/* Bell + Sair icons at the end of mobile nav */}
              <div className="flex items-center gap-1 pr-1 py-2 flex-shrink-0">
                <button
                  className={`relative h-10 w-10 flex items-center justify-center rounded-full transition-colors ${pushSubscribed ? 'text-green-600 bg-green-500/10' : 'text-pgr-text-muted bg-stone-50'}`}
                  onClick={pushSubscribed ? handleUnsubscribePush : handleSubscribePush}
                >
                  <Bell className="h-5 w-5" />
                  {pushSubscribed && (
                    <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full" />
                  )}
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="relative h-10 w-10 flex items-center justify-center rounded-full text-pgr-text-muted bg-stone-50 hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={onLogout}
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">Sair do sistema</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </nav>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-auto">
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
              {/* ============ DASHBOARD VIEW ============ */}
              {activeView === "dashboard" && (
                <DashboardView
                  stats={stats}
                  loading={loading}
                  onNavigate={setActiveView}
                  onViewDetail={(id) => fetchAndShowDetail(id)}
                />
              )}

              {/* ============ CADASTRO VIEW ============ */}
              {activeView === "cadastro" && (
                <CadastroView
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={() => {
                    setFormMode("create");
                    // Direct create
                    if (!formData.nomeArguido.trim()) {
                      toast({ title: "Erro", description: "Nome do arguido é obrigatório.", variant: "destructive" });
                      return;
                    }
                    (async () => {
                      try {
                        const res = await fetch("/api/arguidos", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(formData),
                        });
                        if (res.ok) {
                          toast({ title: "Arguido cadastrado com sucesso!" });
                          setFormData(emptyArguido);
                          loadStats();
                          loadAlertas();
                        } else {
                          toast({ title: "Erro", description: "Falha ao cadastrar.", variant: "destructive" });
                        }
                      } catch { toast({ title: "Erro", description: "Erro de conexão.", variant: "destructive" }); }
                    })();
                  }}
                />
              )}

              {/* ============ GESTÃO VIEW ============ */}
              {activeView === "gestao" && (
                <GestaoView
                  arguidos={arguidos}
                  loading={loading}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  filterCrime={filterCrime}
                  setFilterCrime={setFilterCrime}
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                  filterPrazo={filterPrazo}
                  setFilterPrazo={setFilterPrazo}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalPages={totalPages}
                  totalRecords={totalRecords}
                  onEdit={handleOpenEdit}
                  onDelete={(id) => setDeleteDialog(id)}
                  onView={(a) => fetchAndShowDetail(a.id)}
                  onPdf={handleDownloadPdf}
                  onRefresh={loadArguidos}
                  onExport={handleExportCSV}
                  onNew={handleOpenCreate}
                />
              )}

              {/* ============ ALERTAS VIEW ============ */}
              {activeView === "alertas" && (
                <AlertasView
                  alertas={alertas}
                  stats={stats}
                  onCheck={checkDeadlines}
                  onTestNotification={handleTestNotification}
                  onView={(id) => fetchAndShowDetail(id)}
                />
              )}

              {/* ============ RELATÓRIOS VIEW ============ */}
              {activeView === "relatorios" && (
                <RelatoriosView stats={stats} />
              )}
            </div>
          </main>

        {/* FOOTER */}
        <footer className="bg-stone-200 text-pgr-text-muted border-t border-stone-200 py-3 px-4 text-center text-xs mt-auto">
          <div className="flex items-center justify-center gap-2">
            <Gavel className="h-3 w-3" />
            <span>© 2024 Procuradoria-Geral da República de Angola — Sistema de Controlo de Arguidos em Prisão Preventiva</span>
          </div>
          {!pushSubscribed && notificationPermission !== 'denied' && (
            <button
              onClick={handleSubscribePush}
              className="mt-2 inline-flex items-center gap-1.5 text-pgr-text-secondary hover:text-pgr-text transition-colors underline underline-offset-2 decoration-stone-300 hover:decoration-pgr-text"
            >
              <span>🔔</span> Ativar alertas no dispositivo
            </button>
          )}
        </footer>

        {/* ============ FORM DIALOG ============ */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-stone-200 text-pgr-text">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-pgr-primary" />
                {formMode === "create" ? "Novo Cadastro" : "Editar Arguido"}
              </DialogTitle>
              <DialogDescription>
                {formMode === "create"
                  ? "Preencha os dados do arguido em prisão preventiva."
                  : "Atualize os dados do arguido."}
              </DialogDescription>
            </DialogHeader>
            <FormFields formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button variant="outline" className="bg-stone-100 text-pgr-text-muted hover:text-stone-900 border-stone-200" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button className="bg-pgr-primary text-white font-bold hover:opacity-90" onClick={handleSubmitForm}>
                {formMode === "create" ? "Cadastrar" : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ VIEW DETAIL DIALOG ============ */}
        <Dialog open={!!viewDetail || viewDetailLoading} onOpenChange={() => { if (!viewDetailLoading) setViewDetail(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-stone-200 text-pgr-text">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-pgr-primary" />
                {viewDetailLoading ? "A carregar..." : `Detalhes do Arguido — ${viewDetail?.numeroId}`}
              </DialogTitle>
              <DialogDescription>Informações completas do processo.</DialogDescription>
            </DialogHeader>
            {viewDetailLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-pgr-text-muted" />
                <span className="ml-3 text-sm text-muted-foreground">A carregar detalhes...</span>
              </div>
            ) : viewDetail && <DetailView arguido={viewDetail} />}
            <DialogFooter className="gap-2">
              <Button variant="outline" className="bg-stone-100 text-pgr-text-muted hover:text-stone-900 border-stone-200" onClick={() => setViewDetail(null)}>Fechar</Button>
              <Button variant="outline" className="text-pgr-primary border-pgr-primary hover:bg-orange-50 bg-stone-100" onClick={() => { if (viewDetail) handleDownloadPdf(viewDetail); }}>
                <FileDown className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button variant="destructive" onClick={() => { if (viewDetail) setDeleteDialog(viewDetail.id); }}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
              <Button className="bg-pgr-primary text-white font-bold hover:opacity-90" onClick={handleEditFromView}>
                <Edit className="h-4 w-4 mr-1" /> Editar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ DELETE CONFIRMATION ============ */}
        <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <AlertDialogContent className="border-stone-200 text-pgr-text">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Confirmar Eliminação
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem a certeza que deseja eliminar este registo? Esta acção é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white font-bold"
                onClick={() => deleteDialog && handleDelete(deleteDialog)}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ============ IN-APP NOTIFICATION OVERLAY (iOS fallback) ============ */}
        {inAppNotification && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-4 px-4 pointer-events-none">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/30 pointer-events-auto"
              onClick={() => setInAppNotification(null)}
            />
            {/* Notification Card */}
            <div
              className="relative pointer-events-auto w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden bg-stone-100 border border-pgr-primary/30"
              style={{ animation: 'slideInAppNotification 0.4s ease-out' }}
            >
              {/* Header — PGR Angola branding */}
              <div className="bg-pgr-primary px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Scale className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">PGR ANGOLA</h3>
                    <p className="text-[11px] text-white/60">Resumo de Alertas do Sistema</p>
                  </div>
                </div>
              </div>

              {/* Urgency indicator bar */}
              {inAppNotification.hasUrgent && (
                <div className="h-1 bg-red-500 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-300 to-transparent" style={{ animation: 'shimmer 1.5s ease-in-out infinite' }} />
                </div>
              )}
              {!inAppNotification.hasUrgent && (
                <div className="h-1 bg-amber-400" />
              )}

              {/* Summary Rows */}
              <div className="px-5 py-4 space-y-2.5">
                {/* Expirados */}
                <div className="flex items-center gap-3.5 py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="h-4.5 w-4.5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-600">
                      {inAppNotification.expirados} Prazo(s) Expirado(s)
                    </p>
                    <p className="text-[11px] text-red-500">Expirados</p>
                  </div>
                  <span className="text-xl font-bold text-red-500">{inAppNotification.expirados}</span>
                </div>

                {/* Críticos */}
                <div className="flex items-center gap-3.5 py-2 px-3 rounded-xl bg-orange-50 border border-pgr-primary/20">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4.5 w-4.5 text-pgr-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-pgr-primary">
                      {inAppNotification.criticos} Caso(s) Crítico(s)
                    </p>
                    <p className="text-[11px] text-pgr-primary">Prazo muito próximo</p>
                  </div>
                  <span className="text-xl font-bold text-pgr-primary">{inAppNotification.criticos}</span>
                </div>

                {/* Atenção */}
                <div className="flex items-center gap-3.5 py-2 px-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4.5 w-4.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-600">
                      {inAppNotification.atencao} Caso(s) em estado de Atenção
                    </p>
                    <p className="text-[11px] text-amber-600">Prazo próximo</p>
                  </div>
                  <span className="text-xl font-bold text-amber-600">{inAppNotification.atencao}</span>
                </div>

                {/* Normal */}
                <div className="flex items-center gap-3.5 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-600">
                      {inAppNotification.normal} Caso(s) em estado Normal
                    </p>
                    <p className="text-[11px] text-emerald-600">Dentro do prazo</p>
                  </div>
                  <span className="text-xl font-bold text-emerald-600">{inAppNotification.normal}</span>
                </div>

                {/* Divider */}
                <div className="border-t border-stone-200 my-1" />

                {/* Total */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-medium text-pgr-text-muted">Total de Casos</p>
                  <p className="text-sm font-bold text-pgr-text">{inAppNotification.total}</p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-5 pb-4 flex items-center gap-2">
                <Button
                  size="sm"
                  className={`flex-1 text-white text-sm font-semibold ${
                    inAppNotification.hasUrgent
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-pgr-primary hover:opacity-90'
                  }`}
                  onClick={() => {
                    setInAppNotification(null);
                    setActiveView("alertas");
                  }}
                >
                  Ver Alertas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-sm"
                  onClick={() => setInAppNotification(null)}
                >
                  Fechar
                </Button>
              </div>

              {/* Pulsing dot for urgent */}
              {inAppNotification.hasUrgent && (
                <div className="absolute top-4 right-4">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ===================== FORM FIELDS COMPONENT =====================
function FormFields({ formData, setFormData }: {
  formData: Omit<Arguido, "id" | "numeroId" | "createdAt" | "updatedAt">;
  setFormData: React.Dispatch<React.SetStateAction<Omit<Arguido, "id" | "numeroId" | "createdAt" | "updatedAt">>>;
}) {
  const update = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
      {/* Personal Info */}
      <div className="md:col-span-2">
        <h4 className="text-sm font-semibold text-pgr-text mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Dados Pessoais e Processuais
        </h4>
      </div>

      <div className="space-y-2">
        <Label htmlFor="numeroProcesso" className="text-pgr-text">Nº Processo *</Label>
        <Input id="numeroProcesso" value={formData.numeroProcesso} onChange={e => update("numeroProcesso", e.target.value)} placeholder="Ex: PGR-2024-001" className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nomeArguido" className="text-pgr-text">Nome do Arguido *</Label>
        <Input id="nomeArguido" value={formData.nomeArguido} onChange={e => update("nomeArguido", e.target.value)} placeholder="Nome completo" className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataDetencao" className="text-pgr-text">Data de Detenção</Label>
        <Input id="dataDetencao" type="date" value={formData.dataDetencao ? formData.dataDetencao.slice(0, 10) : ""} onChange={e => update("dataDetencao", e.target.value || null)} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="crime" className="text-pgr-text">Crime</Label>
        <Select value={formData.crime} onValueChange={v => update("crime", v)}>
          <SelectTrigger className="bg-stone-100 text-pgr-text border-stone-200"><SelectValue placeholder="Selecionar crime" /></SelectTrigger>
          <SelectContent>
            {CRIMES_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Ou digite outro..." value={formData.crime && !CRIMES_LIST.includes(formData.crime) ? formData.crime : ""} onChange={e => update("crime", e.target.value)} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      {/* Dates */}
      <div className="md:col-span-2 mt-2">
        <h4 className="text-sm font-semibold text-pgr-text mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Datas e Prazos Processuais
        </h4>
      </div>

      <div className="space-y-2">
        <Label htmlFor="medidasAplicadas" className="text-pgr-text">Medidas Aplicadas</Label>
        <Select value={formData.medidasAplicadas} onValueChange={v => update("medidasAplicadas", v)}>
          <SelectTrigger className="bg-stone-100 text-pgr-text border-stone-200"><SelectValue placeholder="Selecionar medida" /></SelectTrigger>
          <SelectContent>
            {MEDIDAS_LIST.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataMedidasAplicadas" className="text-pgr-text">Data das Medidas Aplicadas</Label>
        <Input id="dataMedidasAplicadas" type="date" value={formData.dataMedidasAplicadas ? formData.dataMedidasAplicadas.slice(0, 10) : ""} onChange={e => update("dataMedidasAplicadas", e.target.value || null)} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
        <p className="text-[10px] text-pgr-text-muted">1º prazo será calculado automaticamente (+3 meses)</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataRemessaJg" className="text-pgr-text">Data de Remessa ao JG</Label>
        <Input id="dataRemessaJg" type="date" value={formData.dataRemessaJg ? formData.dataRemessaJg.slice(0, 10) : ""} onChange={e => update("dataRemessaJg", e.target.value || null)} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataRegresso" className="text-pgr-text">Data de Regresso</Label>
        <Input id="dataRegresso" type="date" value={formData.dataRegresso ? formData.dataRegresso.slice(0, 10) : ""} onChange={e => update("dataRegresso", e.target.value || null)} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataRemessaSic" className="text-pgr-text">Data de Remessa ao SIC</Label>
        <Input id="dataRemessaSic" type="date" value={formData.dataRemessaSic ? formData.dataRemessaSic.slice(0, 10) : ""} onChange={e => update("dataRemessaSic", e.target.value || null)} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="magistrado" className="text-pgr-text">Magistrado Responsável</Label>
        <Input id="magistrado" value={formData.magistrado} onChange={e => update("magistrado", e.target.value)} placeholder="Nome do magistrado" className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      {/* Prorrogacao */}
      <div className="md:col-span-2 mt-2">
        <h4 className="text-sm font-semibold text-pgr-text mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Prorrogação (2º Prazo)
        </h4>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataProrrogacao" className="text-pgr-text">Data de Prorrogação</Label>
        <Input id="dataProrrogacao" type="date" value={formData.dataProrrogacao ? formData.dataProrrogacao.slice(0, 10) : ""} onChange={e => update("dataProrrogacao", e.target.value || null)} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="duracaoProrrogacao" className="text-pgr-text">Duração da Prorrogação (meses)</Label>
        <Input id="duracaoProrrogacao" type="number" min={0} max={12} value={formData.duracaoProrrogacao || ""} onChange={e => update("duracaoProrrogacao", parseInt(e.target.value) || 0)} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
        <p className="text-[10px] text-pgr-text-muted">2º prazo = Data Prorrogação + Duração</p>
      </div>

      {/* Calculated dates display */}
      {(formData.dataMedidasAplicadas || formData.dataProrrogacao) && (
        <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-600 mb-1">📅 Prazos Calculados:</p>
          {formData.dataMedidasAplicadas && (
            <p className="text-xs text-amber-600">
              Fim 1º Prazo: {(() => {
                const d = new Date(formData.dataMedidasAplicadas);
                d.setMonth(d.getMonth() + 3);
                return formatDate(d.toISOString());
              })()}
            </p>
          )}
          {formData.dataProrrogacao && formData.duracaoProrrogacao > 0 && (
            <p className="text-xs text-amber-600">
              Fim 2º Prazo: {(() => {
                const d = new Date(formData.dataProrrogacao);
                d.setMonth(d.getMonth() + formData.duracaoProrrogacao);
                return formatDate(d.toISOString());
              })()}
            </p>
          )}
        </div>
      )}

      {/* Observations */}
      <div className="md:col-span-2 mt-2">
        <h4 className="text-sm font-semibold text-pgr-text mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Observações
        </h4>
      </div>

      <div className="space-y-2">
        <Label htmlFor="remessaJgAlteracao" className="text-pgr-text">Remessa ao JG / Alteração</Label>
        <Textarea id="remessaJgAlteracao" value={formData.remessaJgAlteracao} onChange={e => update("remessaJgAlteracao", e.target.value)} placeholder="Histórico de alterações..." rows={3} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status" className="text-pgr-text">Status</Label>
        <Select value={formData.status} onValueChange={v => update("status", v)}>
          <SelectTrigger className="bg-stone-100 text-pgr-text border-stone-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs1" className="text-pgr-text">Observação 1</Label>
        <Textarea id="obs1" value={formData.obs1} onChange={e => update("obs1", e.target.value)} rows={2} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs2" className="text-pgr-text">Observação 2</Label>
        <Textarea id="obs2" value={formData.obs2} onChange={e => update("obs2", e.target.value)} rows={2} className="bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary" />
      </div>
    </div>
  );
}

// ===================== DASHBOARD VIEW =====================
function DashboardView({ stats, loading, onNavigate, onViewDetail }: {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (view: string) => void;
  onViewDetail: (id: number) => void;
}) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-pgr-text-muted mb-2" />
          <p className="text-sm text-muted-foreground">A carregar dados...</p>
        </div>
      </div>
    );
  }

  const conformidade = stats.ativos > 0
    ? Math.round(((stats.ativos - stats.prazosCriticos) / stats.ativos) * 100)
    : 100;

  const pieData = stats.statusCounts.map(s => ({
    name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s._count.status,
  }));

  const PIE_COLORS = ["#28A745", "#DC3545", "#6c757d"];

  const crimeData = stats.crimes.slice(0, 7).map(c => ({
    name: c.crime.length > 12 ? c.crime.substring(0, 12) + "..." : c.crime,
    fullName: c.crime,
    total: c._count.crime,
  }));

  const monthlyData = Object.entries(stats.monthlyCounts).map(([key, count]) => ({
    month: new Date(key + "-01").toLocaleDateString("pt-AO", { month: "short", year: "2-digit" }),
    casos: count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text">Painel</h2>
          <p className="text-sm text-muted-foreground">Visão geral do sistema de controlo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigate("cadastro")}>
            <Plus className="h-4 w-4 mr-1" /> Novo Cadastro
          </Button>
          <Button size="sm" className="bg-pgr-primary text-white font-bold hover:opacity-90" onClick={() => onNavigate("gestao")}>
            <Users className="h-4 w-4 mr-1" /> Ver Todos
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-pgr-surface border border-stone-200 pgr-card-hover border-l-4 border-l-stone-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pgr-text-muted font-medium">Total Arguidos</p>
                <p className="text-2xl font-bold text-pgr-text">{stats.totalArguidos}</p>
              </div>
              <div className="w-10 h-10 bg-pgr-surface rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-pgr-text-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-pgr-surface border border-stone-200 pgr-card-hover border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pgr-text-muted font-medium">Ativos</p>
                <p className="text-2xl font-bold text-green-600">{stats.ativos}</p>
              </div>
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-pgr-surface border border-stone-200 pgr-card-hover border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pgr-text-muted font-medium">Vencidos</p>
                <p className="text-2xl font-bold text-red-500">{stats.vencidos}</p>
              </div>
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-pgr-surface border border-stone-200 pgr-card-hover border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pgr-text-muted font-medium">Alertas</p>
                <p className="text-2xl font-bold text-amber-600">{stats.alertasPendentes}</p>
              </div>
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conformidade + Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-pgr-surface border border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text">Taxa de Conformidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2" style={{ color: conformidade >= 80 ? "#28A745" : conformidade >= 50 ? "#FFC107" : "#DC3545" }}>
                {conformidade}%
              </div>
              <Progress value={conformidade} className="h-2 mb-2" />
              <p className="text-sm text-pgr-text-muted">Dos prazos dentro do limite</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-pgr-surface border border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={5} dataKey="value">
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend iconSize={12} wrapperStyle={{ fontSize: 13, color: '#aaa' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-pgr-surface border border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text">Casos por Crime</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={crimeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#aaa' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#aaa' }} width={90} />
                <RechartsTooltip formatter={(v: number, _: string, p: { payload: { fullName: string } }) => [v, p.payload.fullName]} />
                <Bar dataKey="total" fill="#374151" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      {monthlyData.length > 0 && (
        <Card className="bg-pgr-surface border border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-pgr-text">
              <TrendingUp className="h-4 w-4" /> Evolução Mensal de Casos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#aaa' }} />
                <YAxis tick={{ fontSize: 12, fill: '#aaa' }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="casos" stroke="#374151" strokeWidth={2} dot={{ fill: "#374151" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Urgent Processes - Table */}
      {stats.processosUrgentes.length > 0 && (
        <Card className="bg-pgr-surface border border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-pgr-text">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Processos com Prazo Próximo
              <span className="ml-auto text-sm font-normal text-pgr-text-muted">{stats.processosUrgentes.length} processo(s)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 [&>[data-slot=table-container]]:max-h-80">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-stone-700! bg-stone-700 border-none">
                  <TableHead className="text-sm font-semibold text-white">Prazo</TableHead>
                  <TableHead className="text-sm font-semibold text-white">Nome / Processo</TableHead>
                  <TableHead className="text-sm font-semibold text-white hidden md:table-cell">Crime</TableHead>
                  <TableHead className="text-sm font-semibold text-white hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="text-sm font-semibold text-white text-right">Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.processosUrgentes.map((p, idx) => (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-stone-50 hover:bg-stone-200' : 'bg-stone-100 hover:bg-stone-200'} text-pgr-text`}
                    onClick={() => onViewDetail(p.id)}
                  >
                    <TableCell className="py-2.5">
                      <span className={`inline-block text-sm font-bold px-2 py-0.5 rounded ${getDeadlineColor(p.diasRestantes)}`}>
                        {p.diasRestantes <= 0 ? "VENCIDO" : `D-${p.diasRestantes}`}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <p className="text-sm font-medium leading-tight text-[#222]"><span className="inline-block max-w-[180px] lg:max-w-[240px] align-bottom truncate">{p.nomeArguido}</span></p>
                      <p className="text-sm text-[#555]"><span className="inline-block max-w-[180px] lg:max-w-[240px] align-bottom truncate">{p.numeroProcesso}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 hidden md:table-cell">
                      <p className="text-sm text-[#333]"><span className="inline-block max-w-[130px] align-bottom truncate">{p.crime}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 hidden sm:table-cell">
                      <p className="text-sm text-[#333]"><span className="inline-block max-w-[90px] align-bottom truncate">{p.tipo}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <p className="text-sm font-medium whitespace-nowrap text-[#222]">{formatDate(p.dataVencimento)}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

// ===================== CADASTRO VIEW =====================
function CadastroView({ formData, setFormData, onSubmit }: {
  formData: Omit<Arguido, "id" | "numeroId" | "createdAt" | "updatedAt">;
  setFormData: React.Dispatch<React.SetStateAction<Omit<Arguido, "id" | "numeroId" | "createdAt" | "updatedAt">>>;
  onSubmit: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-pgr-text">Novo Cadastro</h2>
        <p className="text-sm text-muted-foreground">Formulário de registro de arguido em prisão preventiva</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <FormFields formData={formData} setFormData={setFormData} />
          <Separator className="my-4" />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setFormData(emptyArguido)}>
              Limpar Formulário
            </Button>
            <Button className="bg-[#D35400] hover:bg-[#E67E22]" onClick={onSubmit}>
              <UserPlus className="h-4 w-4 mr-2" /> Cadastrar Arguido
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== GESTÃO VIEW =====================
function GestaoView({ arguidos, loading, searchTerm, setSearchTerm, filterCrime, setFilterCrime, filterStatus, setFilterStatus, filterPrazo, setFilterPrazo, currentPage, setCurrentPage, totalPages, totalRecords, onEdit, onDelete, onView, onPdf, onRefresh, onExport, onNew }: {
  arguidos: Arguido[];
  loading: boolean;
  searchTerm: string; setSearchTerm: (v: string) => void;
  filterCrime: string; setFilterCrime: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  filterPrazo: string; setFilterPrazo: (v: string) => void;
  currentPage: number; setCurrentPage: (v: number) => void;
  totalPages: number; totalRecords: number;
  onEdit: (a: Arguido) => void;
  onDelete: (id: number) => void;
  onView: (a: Arguido) => void;
  onPdf: (a: Arguido) => void;
  onRefresh: () => void;
  onExport: () => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text">Gestão de Arguidos</h2>
          <p className="text-sm text-muted-foreground">{totalRecords} registo{totalRecords !== 1 ? "s" : ""} encontrado{totalRecords !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={onExport}><Download className="h-4 w-4 mr-1" /> Exportar</Button>
          <Button size="sm" className="bg-[#D35400] hover:bg-[#E67E22]" onClick={onNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="bg-pgr-surface border border-stone-200">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pgr-text-muted" />
              <Input
                placeholder="Pesquisar por nome, Nº processo ou ID..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary placeholder:text-stone-400"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterStatus} onValueChange={v => { setFilterStatus(v === "todos" ? "" : v); setCurrentPage(1); }}>
                <SelectTrigger className="w-36 bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPrazo} onValueChange={v => { setFilterPrazo(v === "todos" ? "" : v); setCurrentPage(1); }}>
                <SelectTrigger className="w-40 bg-stone-100 text-pgr-text border-stone-200 focus:border-pgr-primary"><SelectValue placeholder="Prazo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Prazos</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                  <SelectItem value="atencao">Atenção</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-pgr-surface border border-stone-200">
        <CardContent className="p-0 [&>[data-slot=table-container]]:max-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-pgr-text-muted" />
            </div>
          ) : arguidos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum registo encontrado.</p>
              <Button variant="link" size="sm" onClick={onNew}>Criar novo registo</Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="hover:bg-stone-700! bg-stone-700 border-none">
                    <TableHead className="text-sm font-semibold text-white">ID</TableHead>
                    <TableHead className="text-sm font-semibold text-white">Nº Processo</TableHead>
                    <TableHead className="text-sm font-semibold text-white">Nome</TableHead>
                    <TableHead className="text-sm font-semibold text-white hidden md:table-cell">Crime</TableHead>
                    <TableHead className="text-sm font-semibold text-white hidden lg:table-cell">Magistrado</TableHead>
                    <TableHead className="text-sm font-semibold text-white">1º Prazo</TableHead>
                    <TableHead className="text-sm font-semibold text-white">Status</TableHead>
                    <TableHead className="text-sm font-semibold text-white text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arguidos.map((a, idx) => {
                    const days1 = getDaysRemaining(a.fimPrimeiroPrazo);
                    const days2 = getDaysRemaining(a.fimSegundoPrazo);
                    const nearestDays = [days1, days2].filter(d => d !== null).sort((a, b) => a! - b!)[0] ?? null;
                    return (
                      <TableRow key={a.id} className={`cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-stone-50 hover:bg-stone-200' : 'bg-stone-100 hover:bg-stone-200'} text-pgr-text`}>
                        <TableCell className="text-sm font-mono text-[#555] whitespace-nowrap">{a.numeroId}</TableCell>
                        <TableCell className="text-sm font-medium text-[#222]"><p className="max-w-[120px] truncate">{a.numeroProcesso}</p></TableCell>
                        <TableCell className="text-sm font-medium text-[#222]"><p className="max-w-[250px] truncate">{a.nomeArguido}</p></TableCell>
                        <TableCell className="text-sm text-[#333] hidden md:table-cell"><p className="max-w-[150px] truncate">{a.crime}</p></TableCell>
                        <TableCell className="text-sm text-[#333] hidden lg:table-cell"><p className="max-w-[140px] truncate">{a.magistrado}</p></TableCell>
                        <TableCell>
                          <span className={`inline-block text-sm font-bold px-2 py-0.5 rounded ${getDeadlineColor(nearestDays)}`}>
                            {getDeadlineLabel(nearestDays)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                            a.status === 'ativo' ? 'bg-[#1c3d5a] text-white' :
                            a.status === 'vencido' ? 'bg-[#a10000] text-white' :
                            'bg-gray-400 text-white'
                          }`}>
                            {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onView(a); }}><Eye className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Ver</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(a); }}><Edit className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-7 gap-1 text-[#D35400] hover:text-[#BA4A00] hover:bg-[#D35400]/10 text-sm font-semibold px-2" onClick={(e) => { e.stopPropagation(); onPdf(a); }}><FileDown className="h-3.5 w-3.5" />PDF</Button></TooltipTrigger><TooltipContent>Descarregar Ficha PDF</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}><Trash2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Eliminar</TooltipContent></Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200">
                <p className="text-sm text-pgr-text-muted">
                  Página {currentPage} de {totalPages} ({totalRecords} registo{totalRecords !== 1 ? "s" : ""})
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7 border-stone-200 text-pgr-text-muted hover:text-stone-900 hover:bg-stone-100" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                    const page = start + i;
                    if (page > totalPages) return null;
                    return (
                      <Button key={page} variant={page === currentPage ? "default" : "outline"} size="icon" className={`h-7 w-7 text-xs ${page === currentPage ? 'bg-pgr-primary text-white' : 'border-stone-200 text-pgr-text-muted hover:text-stone-900 hover:bg-stone-100'}`} onClick={() => setCurrentPage(page)}>
                        {page}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="icon" className="h-7 w-7 border-stone-200 text-pgr-text-muted hover:text-stone-900 hover:bg-stone-100" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== ALERTAS VIEW =====================
function AlertasView({ alertas, stats, onCheck, onTestNotification, onView }: {
  alertas: AlertaItem[];
  stats: DashboardStats | null;
  onCheck: () => void;
  onTestNotification: () => void;
  onView: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text">Sistema de Alertas</h2>
          <p className="text-sm text-muted-foreground">{alertas.length} alerta{alertas.length !== 1 ? "s" : ""} registado{alertas.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onTestNotification}>
            <Bell className="h-4 w-4 mr-1" /> Testar Notificação
          </Button>
          <Button className="bg-[#D35400] hover:bg-[#E67E22]" size="sm" onClick={onCheck}>
            <RefreshCw className="h-4 w-4 mr-1" /> Verificar Prazos
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-red-50 border border-red-200">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{stats.prazosCriticos}</p>
              <p className="text-sm text-red-500 font-medium">Críticos</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border border-amber-200">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.prazosProximos - stats.prazosCriticos}</p>
              <p className="text-sm text-amber-600 font-medium">Atenção</p>
            </CardContent>
          </Card>
          <Card className="bg-red-800/15 border border-red-800/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{stats.vencidos}</p>
              <p className="text-sm text-red-500 font-medium">Vencidos</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/15 border border-green-500/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.ativos - stats.prazosProximos}</p>
              <p className="text-sm text-green-600 font-medium">Normal</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alert History - Table */}
      <Card className="bg-pgr-surface border border-stone-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-pgr-text">Histórico de Alertas</CardTitle>
          <CardDescription className="text-pgr-text-muted">Alertas gerados pelo sistema de verificação automática</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {alertas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-4">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum alerta registado.</p>
              <p className="text-sm mt-1">Clique em &quot;Verificar Prazos&quot; para iniciar a verificação.</p>
            </div>
          ) : (
            <div className="[&>[data-slot=table-container]]:max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="hover:bg-stone-700! bg-stone-700 border-none">
                  <TableHead className="text-sm font-semibold text-white">Prazo</TableHead>
                  <TableHead className="text-sm font-semibold text-white">Tipo</TableHead>
                  <TableHead className="text-sm font-semibold text-white">Mensagem</TableHead>
                  <TableHead className="text-sm font-semibold text-white hidden sm:table-cell">Canal</TableHead>
                  <TableHead className="text-sm font-semibold text-white text-right">Data</TableHead>
                  <TableHead className="text-sm font-semibold text-white w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.map((alerta, idx) => (
                  <TableRow
                    key={alerta.id}
                    className={`cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-stone-50 hover:bg-stone-200' : 'bg-stone-100 hover:bg-stone-200'} text-pgr-text`}
                    onClick={() => alerta.arguidoId && onView(alerta.arguidoId)}
                  >
                    <TableCell className="py-2.5">
                      <span className={`inline-block text-sm font-bold px-2 py-0.5 rounded ${getDeadlineColor(alerta.diasRestantes)}`}>
                        {alerta.diasRestantes <= 0 ? "VENCIDO" : `D-${alerta.diasRestantes}`}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <p className="text-sm text-[#333]"><span className="inline-block max-w-[75px] align-bottom truncate">{alerta.tipoAlerta.replace("_", " ")}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <p className="text-sm text-[#222]"><span className="inline-block max-w-[220px] sm:max-w-[320px] md:max-w-[420px] align-bottom truncate">{alerta.mensagem}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 hidden sm:table-cell">
                      <p className="text-sm text-[#333]"><span className="inline-block max-w-[65px] align-bottom truncate">{alerta.canalEnvio}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <p className="text-sm text-[#333] whitespace-nowrap">{formatDate(alerta.dataDisparo)}</p>
                    </TableCell>
                    <TableCell className="py-2.5 text-center">
                      {alerta.arguidoId && (
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#555] hover:text-[#222] hover:bg-[#d0d0d0] transition-colors"
                          onClick={(e) => { e.stopPropagation(); onView(alerta.arguidoId); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Rules */}
      <Card className="bg-pgr-surface border border-stone-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-pgr-text">Regras de Alerta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-start gap-2 p-3 bg-stone-50 border border-stone-200 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-500">Vencido</p>
                <p className="text-sm text-red-500">Notificação imediata, registo de não conformidade</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-stone-50 border border-stone-200 rounded-lg">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-600">Crítico</p>
                <p className="text-sm text-orange-600">Alerta prioritário, destaque máximo</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-stone-50 border border-stone-200 rounded-lg">
              <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-600">Atenção</p>
                <p className="text-sm text-amber-600">Alerta preventivo, acompanhamento diário</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== RELATÓRIOS VIEW =====================
function RelatoriosView({ stats }: { stats: DashboardStats | null }) {
  if (!stats) return null;

  const crimeChartData = stats.crimes.map(c => ({
    name: c.crime,
    value: c._count.crime,
  }));

  const magistradoData = stats.magistrados.slice(0, 8).map(m => ({
    name: m.magistrado.length > 15 ? m.magistrado.substring(0, 15) + "..." : m.magistrado,
    fullName: m.magistrado,
    processos: m._count.magistrado,
  }));

  const COLORS = ["#374151", "#FFD700", "#28A745", "#DC3545", "#FFC107", "#6c757d", "#17a2b8", "#e83e8c"];

  const monthlyData = Object.entries(stats.monthlyCounts).map(([key, count]) => ({
    month: new Date(key + "-01").toLocaleDateString("pt-AO", { month: "short", year: "2-digit" }),
    casos: count,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-pgr-text">Relatórios e Analytics</h2>
        <p className="text-sm text-muted-foreground">Análise detalhada dos dados do sistema</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-pgr-surface border border-stone-200"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-pgr-text">{stats.totalArguidos}</p><p className="text-sm text-pgr-text-muted">Total Registados</p></CardContent></Card>
        <Card className="bg-pgr-surface border border-stone-200"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">{stats.ativos}</p><p className="text-sm text-pgr-text-muted">Ativos</p></CardContent></Card>
        <Card className="bg-pgr-surface border border-stone-200"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-red-500">{stats.vencidos}</p><p className="text-sm text-pgr-text-muted">Vencidos</p></CardContent></Card>
        <Card className="bg-pgr-surface border border-stone-200"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{stats.prazosProximos}</p><p className="text-sm text-pgr-text-muted">Prazos Próximos</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Crimes Distribution */}
        <Card className="bg-pgr-surface border border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text">Distribuição por Crime</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={crimeChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }: { name: string; percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={{ strokeWidth: 1 }}>
                  {crimeChartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Magistrado Load */}
        <Card className="bg-pgr-surface border border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text">Carga por Magistrado</CardTitle>
          </CardHeader>
          <CardContent>
            {magistradoData.length === 0 ? (
              <div className="text-center py-12 text-pgr-text-muted text-sm">Sem dados de magistrados.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={magistradoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#aaa' }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12, fill: '#aaa' }} />
                  <RechartsTooltip formatter={(v: number, _: string, p: { payload: { fullName: string } }) => [v, p.payload.fullName]} />
                  <Bar dataKey="processos" fill="#374151" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="lg:col-span-2 bg-pgr-surface border border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <div className="text-center py-12 text-pgr-text-muted text-sm">Sem dados mensais suficientes.</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#aaa' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#aaa' }} />
                  <Legend wrapperStyle={{ color: '#aaa' }} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="casos" stroke="#374151" strokeWidth={2} dot={{ fill: "#374151", r: 4 }} activeDot={{ r: 6 }} name="Novos Casos" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Data Table */}
      <Card className="bg-pgr-surface border border-stone-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-pgr-text">Resumo por Crime</CardTitle>
        </CardHeader>
        <CardContent className="p-0 [&>[data-slot=table-container]]:max-h-[400px]">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-stone-700! bg-stone-700 border-none">
                <TableHead className="text-sm text-white">Crime</TableHead>
                <TableHead className="text-sm text-white text-right">Total</TableHead>
                <TableHead className="text-sm text-white text-right">% do Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.crimes.map((c, idx) => (
                <TableRow key={idx} className={`transition-colors ${idx % 2 === 0 ? 'bg-stone-50 hover:bg-stone-200' : 'bg-stone-100 hover:bg-stone-200'} text-pgr-text`}>
                  <TableCell className="text-base font-medium text-[#222]">{c.crime || "Não especificado"}</TableCell>
                  <TableCell className="text-base text-right text-[#222]">{c._count.crime}</TableCell>
                  <TableCell className="text-base text-right text-[#222]">
                    {stats.totalArguidos > 0 ? ((c._count.crime / stats.totalArguidos) * 100).toFixed(1) : 0}%
                  </TableCell>
                </TableRow>
              ))}
              {stats.crimes.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-8">Sem dados disponíveis.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== DETAIL VIEW =====================
function DetailView({ arguido }: { arguido: Arguido }) {
  const days1 = getDaysRemaining(arguido.fimPrimeiroPrazo);
  const days2 = getDaysRemaining(arguido.fimSegundoPrazo);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-stone-100 rounded-lg">
        <div>
          <p className="text-sm font-bold text-pgr-text">{arguido.numeroId}</p>
          <p className="text-lg font-semibold">{arguido.nomeArguido}</p>
          <p className="text-xs text-muted-foreground">Processo Nº {arguido.numeroProcesso}</p>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
          arguido.status === 'ativo' ? 'bg-[#1c3d5a] text-white' :
          arguido.status === 'vencido' ? 'bg-[#a10000] text-white' :
          'bg-gray-400 text-white'
        }`}>
          {arguido.status.charAt(0).toUpperCase() + arguido.status.slice(1)}
        </span>
      </div>

      {/* Deadline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className={days1 !== null && days1 <= 3 ? "border-red-300 bg-red-50/30" : ""}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">1º Prazo (3 meses)</p>
            <p className="text-sm font-medium">{arguido.fimPrimeiroPrazo ? formatDate(arguido.fimPrimeiroPrazo) : "Não definido"}</p>
            <span className={`inline-block text-[10px] mt-1 font-bold px-2 py-0.5 rounded ${getDeadlineColor(days1)}`}>
              {getDeadlineLabel(days1)}
            </span>
          </CardContent>
        </Card>
        <Card className={days2 !== null && days2 <= 3 ? "border-red-300 bg-red-50/30" : ""}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">2º Prazo (Prorrogação)</p>
            <p className="text-sm font-medium">{arguido.fimSegundoPrazo ? formatDate(arguido.fimSegundoPrazo) : "Não definido"}</p>
            <span className={`inline-block text-[10px] mt-1 font-bold px-2 py-0.5 rounded ${getDeadlineColor(days2)}`}>
              {getDeadlineLabel(days2)}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-3">
          <DetailField label="Data de Detenção" value={formatDate(arguido.dataDetencao)} />
          <DetailField label="Crime" value={arguido.crime} />
          <DetailField label="Medidas Aplicadas" value={arguido.medidasAplicadas} />
          <DetailField label="Data das Medidas" value={formatDate(arguido.dataMedidasAplicadas)} />
          <DetailField label="Magistrado" value={arguido.magistrado} />
        </div>
        <div className="space-y-3">
          <DetailField label="Remessa ao JG" value={formatDate(arguido.dataRemessaJg)} />
          <DetailField label="Data de Regresso" value={formatDate(arguido.dataRegresso)} />
          <DetailField label="Remessa ao SIC" value={formatDate(arguido.dataRemessaSic)} />
          <DetailField label="Data de Prorrogação" value={arguido.dataProrrogacao ? `${formatDate(arguido.dataProrrogacao)} (${arguido.duracaoProrrogacao} meses)` : "—"} />
          <DetailField label="Cadastrado em" value={formatDate(arguido.createdAt)} />
        </div>
      </div>

      {/* Observations */}
      {(arguido.remessaJgAlteracao || arguido.obs1 || arguido.obs2) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold">Observações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {arguido.remessaJgAlteracao && (
              <div><p className="text-[10px] font-medium text-muted-foreground">Remessa JG / Alteração:</p><p>{arguido.remessaJgAlteracao}</p></div>
            )}
            {arguido.obs1 && (
              <div><p className="text-[10px] font-medium text-muted-foreground">Observação 1:</p><p>{arguido.obs1}</p></div>
            )}
            {arguido.obs2 && (
              <div><p className="text-[10px] font-medium text-muted-foreground">Observação 2:</p><p>{arguido.obs2}</p></div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-stone-200">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-xs text-right">{value}</span>
    </div>
  );
}

// ===================== ENTRY POINT (Auth gate) =====================
export default function HomePage() {
  const [showLanding, setShowLanding] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState<{ username: string; nome: string; role: string } | null>(null);

  const handleEnterLanding = () => {
    setShowLanding(false);
  };

  const handleLogin = (user: { username: string; nome: string; role: string }) => {
    setIsAuthenticated(true);
    setAuthUser(user);
  };

  // Step 1: Landing page with animated fog background
  if (showLanding) {
    return <LandingPage onEnter={handleEnterLanding} />;
  }

  // Step 2: Login page
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Step 3: Main application
  return <AppContent authUser={authUser} onLogout={() => { setIsAuthenticated(false); setAuthUser(null); setShowLanding(true); }} />;
}
