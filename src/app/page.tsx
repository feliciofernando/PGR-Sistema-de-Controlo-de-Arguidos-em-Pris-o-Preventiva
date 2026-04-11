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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
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
  Printer,
  Sun,
  Moon,
  Shield,
  ArrowRight,
  LogOut,
  Upload,
  Paperclip,
  UserCog,
  Settings,
  Lock,
  Unlock,
  Mail,
  Info,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { ThemeProvider, useTheme } from "next-themes";

// ===================== TYPES =====================
interface Arguido {
  id: number;
  numeroId: string;
  numeroProcesso: string;
  nomeArguido: string;
  nomePai: string;
  nomeMae: string;
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
  filteredArguidos?: Arguido[];
}

interface DocumentItem {
  id: number;
  arguidoId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  category: string;
  description: string;
  url: string;
  createdAt: string;
}

interface SystemUser {
  id: number;
  username: string;
  nome: string;
  role: string;
  ativo: boolean;
  createdAt: string;
  ultimoLogin: string | null;
}

type RoleType = 'admin' | 'operador' | 'magistrado' | 'consultor';

// ===================== PERMISSION HELPER =====================
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['create', 'edit', 'delete', 'export', 'view_all', 'view_own', 'manage_users', 'import'],
  operador: ['create', 'edit', 'delete', 'export', 'view_all', 'import'],
  magistrado: ['create', 'edit', 'view_own', 'export'],
  consultor: ['view_all', 'export'],
};

function canPerform(userRole: string, action: string): boolean {
  const perms = ROLE_PERMISSIONS[userRole] || [];
  return perms.includes(action);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
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
  if (days < 0) return "bg-[#d9534f] text-white font-bold";   // Vencido
  if (days === 0) return "bg-[#d9534f] text-white font-bold";  // Vence hoje
  if (days === 1) return "bg-[#e07020] text-white font-bold";  // Vence amanhã — laranja suave
  if (days <= 7) return "bg-[#c8a830] text-white font-bold";   // 2-7 dias — amarelo escuro
  return "bg-[#5cb85c] text-white font-bold";                   // >7 dias
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
  nomePai: "",
  nomeMae: "",
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
        <div className="landing-insignia mb-6">
          <img 
            src="/insignia-pgr.png" 
            alt="Brasão PGR" 
            className="w-20 h-20 sm:w-20 sm:h-20 md:w-22 md:h-22 object-contain"
          />
        </div>

        {/* Title */}
        <h1 className="landing-fade-in-up-delay-1 text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-3">
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
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <span className="text-xs uppercase tracking-[0.2em] text-stone-300 font-semibold">Pesquisa Pública</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>

        {/* Search Section */}
        <div className="landing-fade-in-up-delay-3 w-full max-w-lg">
          <form onSubmit={handleSearch} className="relative flex gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nº Processo, Nome ou ID do Arguido..."
                className="w-full h-12 pl-11 pr-4 bg-white/[0.12] backdrop-blur-md border border-white/[0.20] rounded-xl text-sm text-white placeholder-stone-400 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={searchLoading || !searchQuery.trim()}
              className="h-12 px-6 bg-white/[0.15] backdrop-blur-md border border-white/[0.25] text-white font-semibold text-sm rounded-xl hover:bg-white/[0.22] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
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
            <p className="text-xs text-white/50 text-center">
              {searchResults.length} resultado{searchResults.length > 1 ? 's' : ''} encontrado{searchResults.length > 1 ? 's' : ''}
            </p>
            {searchResults.map((item) => {
              const days1 = getDaysRemaining(item.fimPrimeiroPrazo);
              const days2 = getDaysRemaining(item.fimSegundoPrazo);
              return (
                <div
                  key={item.id}
                  className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl p-5 text-left hover:border-orange-500/40 hover:bg-black/70 transition-all duration-300 shadow-lg shadow-black/30"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate">{item.nomeArguido}</h3>
                      <p className="text-xs text-white/50 mt-0.5">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
            <div className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl p-6 text-center shadow-lg shadow-black/30">
              <AlertCircle className="w-8 h-8 text-white/40 mx-auto mb-3" />
              <p className="text-sm text-white/60">{searchMsg}</p>
              <p className="text-xs text-white/30 mt-1">
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
    <div className="bg-white/[0.10] rounded-lg px-3 py-2.5 flex flex-col gap-1 border border-white/[0.06]">
      <div className="flex items-center gap-1.5 text-white/40">
        {icon}
        <span className="text-[10px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-white font-medium truncate">{value}</span>
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

  // Password recovery state (email-based with link)
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Recovery link detection (from email)
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryNewPass, setRecoveryNewPass] = useState('');
  const [recoveryConfirmPass, setRecoveryConfirmPass] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  // Detect recovery hash from email link on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        setRecoveryToken(accessToken);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

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

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!resetEmail) {
      setResetError('Email é obrigatório');
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetEmailSent(true);
      } else {
        setResetError(data.error || 'Falha ao enviar email');
      }
    } catch {
      setResetError('Erro de ligação ao servidor');
    } finally {
      setResetLoading(false);
    }
  };

  const openReset = () => {
    setResetOpen(true);
    setResetEmail('');
    setResetError('');
    setResetEmailSent(false);
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    if (!recoveryNewPass || recoveryNewPass.length < 6) {
      setRecoveryError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (recoveryNewPass !== recoveryConfirmPass) {
      setRecoveryError('As senhas não coincidem');
      return;
    }
    setRecoveryLoading(true);
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: recoveryToken, new_password: recoveryNewPass }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecoverySuccess(true);
        toast({ title: 'Senha alterada!', description: 'Pode agora fazer login com a nova senha.' });
        setTimeout(() => {
          setRecoveryToken(null);
          setRecoverySuccess(false);
          setRecoveryNewPass('');
          setRecoveryConfirmPass('');
        }, 4000);
      } else {
        setRecoveryError(data.error || 'Falha ao alterar senha');
      }
    } catch {
      setRecoveryError('Erro de ligação ao servidor');
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #1a1a2e 100%)' }}
    >
      {/* Animated Fog Layers — same as Landing Page */}
      <div className="landing-fog-layer landing-fog-1" />
      <div className="landing-fog-layer landing-fog-2" />
      <div className="landing-fog-layer landing-fog-3" />
      <div className="landing-fog-layer landing-fog-4" />
      <div className="landing-fog-layer landing-fog-5" />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* ===== Recovery Password Form — exclusive screen when token is present ===== */}
        {recoveryToken && !recoverySuccess ? (
          <Card className="shadow-2xl bg-white/[0.97] backdrop-blur-sm border border-white/30">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 bg-pgr-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <Lock className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-900">Redefinir Senha</CardTitle>
              <CardDescription className="text-sm text-gray-500">Defina a sua nova senha de acesso</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                {recoveryError && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {recoveryError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Nova Senha</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={recoveryNewPass}
                    onChange={(e) => setRecoveryNewPass(e.target.value)}
                    className="h-11 bg-stone-100 text-gray-900 border-stone-200"
                    autoFocus
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Confirmar Nova Senha</Label>
                  <Input
                    type="password"
                    placeholder="Repita a nova senha"
                    value={recoveryConfirmPass}
                    onChange={(e) => setRecoveryConfirmPass(e.target.value)}
                    className="h-11 bg-stone-100 text-gray-900 border-stone-200"
                    minLength={6}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-pgr-primary text-white font-bold text-sm hover:opacity-90"
                  disabled={recoveryLoading || !recoveryNewPass || !recoveryConfirmPass}
                >
                  {recoveryLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      A alterar...
                    </span>
                  ) : 'Redefinir Senha'}
                </Button>
              </form>

              <p className="text-[11px] text-gray-400 text-center mt-4">
                Procuradoria-Geral da República de Angola
              </p>
            </CardContent>
          </Card>
        ) : (
        <>
        {/* ===== Login Card — normal login screen ===== */}
        <Card className="shadow-2xl bg-white/[0.97] backdrop-blur-sm border border-white/30">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-pgr-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Scale className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-gray-900">PGR ANGOLA</CardTitle>
            <CardDescription className="text-sm text-gray-500">Sistema de Controlo de Arguidos em Prisão Preventiva</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              {loginError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {loginError}
                </div>
              )}
              {recoverySuccess && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  Senha alterada com sucesso! Pode agora entrar.
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="login-user" className="text-sm font-medium text-gray-700">Utilizador</Label>
                <Input
                  id="login-user"
                  type="text"
                  placeholder="nome.utilizador"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="h-11 bg-stone-100 text-gray-900 border-stone-200"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-pass" className="text-sm font-medium text-gray-700">Senha</Label>
                <Input
                  id="login-pass"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="h-11 bg-stone-100 text-gray-900 border-stone-200"
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

            {/* Forgot Password Link */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={openReset}
                className="text-xs text-pgr-primary hover:underline cursor-pointer font-medium"
              >
                Esqueceu a senha?
              </button>
            </div>

            <p className="text-[11px] text-gray-400 text-center mt-4">
              Acesso restrito e monitorizado — Procuradoria-Geral da República de Angola
            </p>
          </CardContent>
        </Card>

        {/* Password Reset Dialog — Email-based recovery link */}
        <Dialog open={resetOpen} onOpenChange={(open) => { if (!open) setResetOpen(false); }}>
          <DialogContent className="max-w-sm border-stone-200 text-gray-900">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-pgr-primary" />
                {resetEmailSent ? 'Email Enviado' : 'Recuperar Senha'}
              </DialogTitle>
              <DialogDescription>
                {resetEmailSent
                  ? 'Enviamos um link para o seu email. Verifique a caixa de entrada.'
                  : 'Introduza o seu email para receber o link de recuperação.'}
              </DialogDescription>
            </DialogHeader>
            {resetEmailSent ? (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-14 h-14 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                    <Mail className="h-7 w-7 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600 font-medium">Verifique a sua caixa de entrada</p>
                  <p className="text-xs text-gray-400 mt-1">Clique no link enviado para <strong>{resetEmail}</strong></p>
                  <p className="text-[11px] text-gray-400 mt-2">O link é válido por 1 hora. Verifique também o spam.</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setResetOpen(false)}>Fechar</Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleResetRequest} className="space-y-4">
                {resetError && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {resetError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Email</Label>
                  <Input
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value.trim())}
                    className="text-sm bg-stone-100 border-stone-200"
                    autoFocus
                    required
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" type="button" onClick={() => setResetOpen(false)}>Cancelar</Button>
                  <Button
                    size="sm"
                    className="bg-pgr-primary text-white font-bold hover:opacity-90"
                    type="submit"
                    disabled={resetLoading || !resetEmail}
                  >
                    {resetLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4 mr-1" />Enviar Link</>}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
        </>
        )}
      </div>
    </div>
  );
}

// ===================== MAIN PAGE =====================
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-5 w-5" />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-pgr-text-muted hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</p>
      </TooltipContent>
    </Tooltip>
  );
}

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

  // Form validation state
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Table state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCrime, setFilterCrime] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPrazo, setFilterPrazo] = useState("");
  const [detencaoDe, setDetencaoDe] = useState("");
  const [detencaoAte, setDetencaoAte] = useState("");
  const [prazoDe, setPrazoDe] = useState("");
  const [prazoAte, setPrazoAte] = useState("");
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 500;

  // Document state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDocDialog, setDeleteDocDialog] = useState<number | null>(null);

  // Report filter state
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    crime: '',
    status: '',
    magistrado: '',
  });
  const [reportStats, setReportStats] = useState<DashboardStats | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Fetch data - using refs to avoid lint issues with setState in effects
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const magistradoParam = authUser?.role === 'magistrado' ? `?magistrado=${encodeURIComponent(authUser.nome)}` : '';
      const alertasUrl = authUser?.role === 'magistrado'
        ? `/api/alertas?limit=100&magistrado=${encodeURIComponent(authUser.nome)}`
        : '/api/alertas?limit=100';
      const [statsRes, alertasRes] = await Promise.all([
        fetch(`/api/stats${magistradoParam}`),
        fetch(alertasUrl),
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
        page: '1',
        pageSize: pageSize.toString(),
      });
      if (authUser?.role === 'magistrado') {
        params.set('magistrado', authUser.nome);
      }
      if (detencaoDe) params.set('detencaoDe', detencaoDe);
      if (detencaoAte) params.set('detencaoAte', detencaoAte);
      if (prazoDe) params.set('prazoDe', prazoDe);
      if (prazoAte) params.set('prazoAte', prazoAte);
      const res = await fetch(`/api/arguidos?${params}`);
      if (res.ok) {
        const data = await res.json();
        setArguidos(data.data);
        setTotalRecords(data.pagination.total);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadStats = async (extraParams?: string) => {
    try {
      const magistradoParam = authUser?.role === 'magistrado' ? `?magistrado=${encodeURIComponent(authUser.nome)}` : '';
      const res = await fetch(`/api/stats${magistradoParam}${extraParams || ''}`);
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadAlertas = async () => {
    try {
      const magistradoParam = authUser?.role === 'magistrado'
        ? `?limit=100&magistrado=${encodeURIComponent(authUser.nome)}`
        : '?limit=100';
      const res = await fetch(`/api/alertas${magistradoParam}`);
      if (res.ok) setAlertas(await res.json());
    } catch (e) { console.error(e); }
  };

  // ============ PWA & PUSH NOTIFICATIONS ============
  useEffect(() => {
    // Check URL params for view
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view && ['dashboard', 'cadastro', 'gestao', 'alertas', 'relatorios', 'sistema', 'consultar', 'utilizadores'].includes(view)) {
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
  }, [activeView, searchTerm, filterCrime, filterStatus, filterPrazo, detencaoDe, detencaoAte, prazoDe, prazoAte]);

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
            atencao: Math.max(0, (statsData.prazosProximos || 0) - (statsData.prazosCriticos || 0)),
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
    setFormErrors({});
    setDuplicateWarning(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (arguido: Arguido) => {
    setFormData({
      numeroProcesso: arguido.numeroProcesso,
      nomeArguido: arguido.nomeArguido,
      nomePai: arguido.nomePai,
      nomeMae: arguido.nomeMae,
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
    setFormErrors({});
    setDuplicateWarning(null);
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.nomeArguido.trim()) {
      errors.nomeArguido = "Nome do arguido é obrigatório.";
    }
    if (!formData.numeroProcesso.trim()) {
      errors.numeroProcesso = "Nº do processo é obrigatório.";
    }
    if (!formData.crime.trim()) {
      errors.crime = "Crime é obrigatório.";
    }

    // Date logic: dataProrrogacao must be after dataMedidasAplicadas
    if (formData.dataProrrogacao && formData.dataMedidasAplicadas) {
      const prorro = new Date(formData.dataProrrogacao);
      const medidas = new Date(formData.dataMedidasAplicadas);
      if (prorro <= medidas) {
        errors.dataProrrogacao = "Data de prorrogação deve ser posterior à data das medidas aplicadas.";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkDuplicates = async (): Promise<boolean> => {
    if (!formData.nomeArguido.trim() || formMode === "edit") return false;

    setCheckingDuplicates(true);
    setDuplicateWarning(null);

    try {
      const res = await fetch(`/api/arguidos?search=${encodeURIComponent(formData.nomeArguido.trim())}&pageSize=10`);
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const exactMatch = data.data.find(
            (a: Arguido) =>
              a.nomeArguido.toLowerCase().trim() === formData.nomeArguido.toLowerCase().trim() &&
              a.numeroProcesso === formData.numeroProcesso
          );
          if (exactMatch) {
            setDuplicateWarning(`Já existe um arguido com o nome "${exactMatch.nomeArguido}" e Nº Processo "${exactMatch.numeroProcesso}" (ID: ${exactMatch.numeroId}).`);
            return true;
          }
          // Similar name check
          const similar = data.data.filter(
            (a: Arguido) =>
              a.nomeArguido.toLowerCase().includes(formData.nomeArguido.toLowerCase().trim()) ||
              formData.nomeArguido.toLowerCase().trim().includes(a.nomeArguido.toLowerCase())
          );
          if (similar.length > 0) {
            setDuplicateWarning(
              `Encontrado(s) ${similar.length} registo(s) com nome semelhante: ${similar.map((a: Arguido) => `${a.nomeArguido} (${a.numeroId})`).join(', ')}`
            );
            return false; // Warning only, not blocking
          }
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setCheckingDuplicates(false);
    }
    return false;
  };

  const handleSubmitForm = async () => {
    setDuplicateWarning(null);

    if (!validateForm()) {
      toast({ title: "Erro de validação", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    // Check duplicates on create
    if (formMode === "create") {
      const isDuplicate = await checkDuplicates();
      if (isDuplicate) {
        toast({ title: "Possível duplicado", description: "Já existe um registo com o mesmo nome e nº de processo.", variant: "destructive" });
        return;
      }
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
        setFormErrors({});
        setDuplicateWarning(null);
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
        // Load documents for this arguido
        const docsRes = await fetch(`/api/documents?arguido_id=${id}`);
        if (docsRes.ok) setDocuments(await docsRes.json());
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

  // Upload document handler
  const handleUploadDocument = async (arguidoId: number, file: File, description: string, category: string) => {
    setDocsLoading(true);
    try {
      const fd = new FormData();
      fd.append('arguido_id', String(arguidoId));
      fd.append('file', file);
      fd.append('description', description);
      fd.append('category', category);
      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      if (res.ok) {
        toast({ title: "Documento enviado!", description: file.name });
        const docsRes = await fetch(`/api/documents?arguido_id=${arguidoId}`);
        if (docsRes.ok) setDocuments(await docsRes.json());
      } else {
        const err = await res.json();
        toast({ title: "Erro", description: err.error || "Falha ao enviar documento.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Erro de conexão.", variant: "destructive" });
    } finally {
      setDocsLoading(false);
      setUploadDialogOpen(false);
    }
  };

  // Delete document handler
  const handleDeleteDocument = async (docId: number) => {
    try {
      const res = await fetch(`/api/documents?id=${docId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: "Documento eliminado." });
        setDeleteDocDialog(null);
        if (viewDetail) {
          const docsRes = await fetch(`/api/documents?arguido_id=${viewDetail.id}`);
          if (docsRes.ok) setDocuments(await docsRes.json());
        }
      }
    } catch (e) { console.error(e); }
  };

  // Report export PDF handler
  const handleExportReportPdf = async () => {
    const data = reportStats || stats;
    if (!data || !data.filteredArguidos || data.filteredArguidos.length === 0) {
      toast({ title: "Sem dados", description: "Nenhum arguido para exportar.", variant: "destructive" });
      return;
    }
    try {
      toast({ title: "A gerar PDF do relatório..." });
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;

      doc.setFillColor(194, 65, 12);
      doc.rect(0, 0, pageW, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PGR ANGOLA — RELATÓRIO FILTRADO", margin + 2, 9);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-AO")} | Total: ${data.filteredArguidos.length}`, margin + 2, 14);

      const headers = [["ID", "Nº Processo", "Nome", "Crime", "Magistrado", "Medidas", "Detenção", "1º Prazo", "Status"]];
      const rows = data.filteredArguidos.map((a) => [
        a.numeroId, a.numeroProcesso, a.nomeArguido || "—", a.crime || "—",
        a.magistrado || "—", a.medidasAplicadas || "—", formatDate(a.dataDetencao),
        formatDate(a.fimPrimeiroPrazo), a.status.charAt(0).toUpperCase() + a.status.slice(1),
      ]);

      autoTable(doc, {
        startY: 21,
        head: headers,
        body: rows,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.5, lineColor: [210, 210, 210] },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: "bold", halign: "center" },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        margin: { left: margin, right: margin, top: 21, bottom: 15 },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(240, 240, 240);
        doc.rect(0, pageH - 8, pageW, 8, "F");
        doc.setFontSize(6.5);
        doc.setTextColor(150, 150, 150);
        doc.text(`PGR Angola © ${new Date().getFullYear()} — Relatório Filtrado`, margin, pageH - 3.5);
        doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 3.5, { align: "right" });
      }

      doc.save(`Relatorio_PGR_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "Relatório exportado!" });
    } catch (err) {
      console.error("Report PDF error:", err);
      toast({ title: "Erro", description: "Falha ao gerar PDF.", variant: "destructive" });
    }
  };

  // Load report stats with filters (POST to advanced endpoint)
  const loadReportStats = async () => {
    setReportLoading(true);
    try {
      const body: Record<string, string> = {};
      if (reportFilters.startDate) body.dateFrom = reportFilters.startDate;
      if (reportFilters.endDate) body.dateTo = reportFilters.endDate;
      if (reportFilters.crime) body.crime = reportFilters.crime;
      if (reportFilters.status) body.status = reportFilters.status;
      if (reportFilters.magistrado) body.magistrado = reportFilters.magistrado;
      const res = await fetch('/api/relatorios/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setReportStats(data);
      }
    } catch (e) { console.error(e); }
    setReportLoading(false);
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
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`ID: ${arguido.numeroId}  |  Processo Nº: ${arguido.numeroProcesso}`, margin, y);
      y += 8;
      doc.setFontSize(15);
      doc.text(arguido.nomeArguido, margin, y);

      // Status badge
      const statusColors: Record<string, [number, number, number]> = {
        ativo: [28, 61, 90],
        vencido: [161, 0, 0],
        encerrado: [156, 163, 175],
      };
      const sc = statusColors[arguido.status] || [120, 120, 120];
      doc.setFontSize(10);
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
        doc.setFontSize(11);
        doc.setTextColor(194, 65, 12);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, y);
        doc.setDrawColor(194, 65, 12);
        doc.setLineWidth(0.4);
        doc.line(margin, y + 1.5, pageWidth - margin, y + 1.5);
        y += 6;
      };

      const fieldRow = (label: string, value: string) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(60, 55, 50); // escuro
        doc.text(label, margin, y);
        doc.setTextColor(28, 25, 23);
        doc.text(value || "—", margin + 50, y);
        y += 6.5;
      };

      sectionTitle("DADOS PESSOAIS E PROCESSUAIS");
      fieldRow("Nome:", arguido.nomeArguido);
      fieldRow("Nome do Pai:", arguido.nomePai || "—");
      fieldRow("Nome da Mãe:", arguido.nomeMae || "—");
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
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(label, margin + yOffset + boxW / 2, y + 6, { align: "center" });
        doc.setFontSize(10);
        doc.text(dateStr ? formatDate(dateStr) : "Não definido", margin + yOffset + boxW / 2, y + 12, { align: "center" });
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(getDeadlineLabel(days), margin + yOffset + boxW / 2, y + 18, { align: "center" });
      };

      drawDeadlineBox("1º PRAZO (3 MESES)", arguido.fimPrimeiroPrazo, days1, 0);
      drawDeadlineBox("2º PRAZO (PRORROGAÇÃO)", arguido.fimSegundoPrazo, days2, pageWidth / 2 - margin + 3);
      y += 28;

      // === Observações ===
      if (arguido.remessaJgAlteracao || arguido.obs1 || arguido.obs2) {
        sectionTitle("OBSERVAÇÕES");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 55, 50);
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
          styles: { fontSize: 9, cellPadding: 2.5 },
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
      doc.text(`© ${new Date().getFullYear()} Procuradoria-Geral da República de Angola — Sistema de Controlo de Arguidos em Prisão Preventiva`, pageWidth / 2, pageH - 5, { align: "center" });
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

  const handleExportPDF = async () => {
    if (arguidos.length === 0) {
      toast({ title: "Sem dados", description: "Nenhum arguido para exportar.", variant: "destructive" });
      return;
    }

    try {
      toast({ title: "A gerar PDF...", description: `${arguidos.length} arguidos a exportar` });

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      // Landscape orientation
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;

      // === HEADER ===
      doc.setFillColor(194, 65, 12);
      doc.rect(0, 0, pageW, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PGR ANGOLA", margin + 2, 9);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("Sistema de Controlo de Arguidos em Prisão Preventiva", margin + 2, 14);

      // Right side: date + count
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255, 0.7);
      doc.text(`Exportado em: ${new Date().toLocaleString("pt-AO")}`, pageW - margin - 2, 9, { align: "right" });
      doc.text(`Total: ${arguidos.length} arguido${arguidos.length !== 1 ? "s" : ""}`, pageW - margin - 2, 14, { align: "right" });

      // === TABLE ===
      const headers = [
        ["ID", "Nº Processo", "Nome do Arguido", "Nome do Pai", "Nome da Mãe", "Crime", "Magistrado", "Medidas", "Detenção", "1º Prazo", "Prazo", "2º Prazo", "Prazo", "Status"],
      ];

      const rows = arguidos.map(a => {
        const days1 = getDaysRemaining(a.fimPrimeiroPrazo);
        const days2 = getDaysRemaining(a.fimSegundoPrazo);
        return [
          a.numeroId,
          a.numeroProcesso,
          a.nomeArguido || "—",
          a.nomePai || "—",
          a.nomeMae || "—",
          a.crime || "—",
          a.magistrado || "—",
          a.medidasAplicadas || "—",
          formatDate(a.dataDetencao),
          formatDate(a.fimPrimeiroPrazo),
          days1 !== null ? getDeadlineLabel(days1) : "—",
          formatDate(a.fimSegundoPrazo),
          days2 !== null ? getDeadlineLabel(days2) : "—",
          a.status.charAt(0).toUpperCase() + a.status.slice(1),
        ];
      });

      autoTable(doc, {
        startY: 21,
        head: headers,
        body: rows,
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          lineColor: [210, 210, 210],
          lineWidth: 0.3,
          textColor: [40, 40, 40],
          font: "helvetica",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [60, 60, 60],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248],
        },
        columnStyles: {
          0: { cellWidth: 18, halign: "center" },  // ID
          1: { cellWidth: 28 },                       // Nº Processo
          2: { cellWidth: 38 },                       // Nome
          3: { cellWidth: 30 },                       // Pai
          4: { cellWidth: 30 },                       // Mãe
          5: { cellWidth: 28 },                       // Crime
          6: { cellWidth: 25 },                       // Magistrado
          7: { cellWidth: 26 },                       // Medidas
          8: { cellWidth: 20, halign: "center" },    // Detenção
          9: { cellWidth: 20, halign: "center" },    // 1º Prazo
          10: { cellWidth: 24, halign: "center" },   // Prazo label
          11: { cellWidth: 20, halign: "center" },   // 2º Prazo
          12: { cellWidth: 24, halign: "center" },   // Prazo label
          13: { cellWidth: 17, halign: "center" },   // Status
        },
        didParseCell: (data) => {
          // Color code the deadline labels (columns 10 and 12)
          if (data.section === "body" && (data.column.index === 10 || data.column.index === 12)) {
            const text = String(data.cell.raw);
            if (text.includes("Vencido")) {
              data.cell.styles.textColor = [180, 30, 30];
              data.cell.styles.fontStyle = "bold";
            } else if (text.includes("amanhã") || text.includes("hoje")) {
              data.cell.styles.textColor = [200, 80, 20];
              data.cell.styles.fontStyle = "bold";
            } else if (text.includes("dias restantes")) {
              data.cell.styles.textColor = [80, 130, 60];
            }
          }
          // Color code status (column 13)
          if (data.section === "body" && data.column.index === 13) {
            const text = String(data.cell.raw).toLowerCase();
            if (text === "vencido") {
              data.cell.styles.textColor = [180, 30, 30];
              data.cell.styles.fontStyle = "bold";
            } else if (text === "ativo") {
              data.cell.styles.textColor = [28, 61, 90];
              data.cell.styles.fontStyle = "bold";
            } else if (text === "encerrado") {
              data.cell.styles.textColor = [120, 120, 120];
            }
          }
        },
        margin: { left: margin, right: margin, top: 21, bottom: 15 },
      });

      // === FOOTER on each page ===
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(240, 240, 240);
        doc.rect(0, pageH - 8, pageW, 8, "F");
        doc.setFontSize(6.5);
        doc.setTextColor(150, 150, 150);
        doc.text(`PGR Angola © ${new Date().getFullYear()} — Sistema de Controlo de Arguidos em Prisão Preventiva`, margin, pageH - 3.5);
        doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 3.5, { align: "right" });
      }

      doc.save(`Arguidos_PGR_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "PDF exportado!", description: `${arguidos.length} arguidos em ${pageCount} página${pageCount !== 1 ? "s" : ""}` });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({ title: "Erro", description: "Falha ao gerar PDF.", variant: "destructive" });
    }
  };

  const handleExportSelectedPDF = async (selectedArguidos: Arguido[]) => {
    if (selectedArguidos.length === 0) {
      toast({ title: "Sem seleção", description: "Nenhum arguido selecionado.", variant: "destructive" });
      return;
    }

    try {
      toast({ title: "A gerar PDF...", description: `${selectedArguidos.length} arguidos selecionados` });

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;

      doc.setFillColor(194, 65, 12);
      doc.rect(0, 0, pageW, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PGR ANGOLA", margin + 2, 9);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("Sistema de Controlo de Arguidos em Prisão Preventiva — Selecionados", margin + 2, 14);

      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255, 0.7);
      doc.text(`Exportado em: ${new Date().toLocaleString("pt-AO")}`, pageW - margin - 2, 9, { align: "right" });
      doc.text(`Selecionados: ${selectedArguidos.length}`, pageW - margin - 2, 14, { align: "right" });

      const headers = [
        ["ID", "Nº Processo", "Nome do Arguido", "Nome do Pai", "Nome da Mãe", "Crime", "Magistrado", "Medidas", "Detenção", "1º Prazo", "Prazo", "2º Prazo", "Prazo", "Status"],
      ];

      const rows = selectedArguidos.map(a => {
        const days1 = getDaysRemaining(a.fimPrimeiroPrazo);
        const days2 = getDaysRemaining(a.fimSegundoPrazo);
        return [
          a.numeroId,
          a.numeroProcesso,
          a.nomeArguido || "—",
          a.nomePai || "—",
          a.nomeMae || "—",
          a.crime || "—",
          a.magistrado || "—",
          a.medidasAplicadas || "—",
          formatDate(a.dataDetencao),
          formatDate(a.fimPrimeiroPrazo),
          days1 !== null ? getDeadlineLabel(days1) : "—",
          formatDate(a.fimSegundoPrazo),
          days2 !== null ? getDeadlineLabel(days2) : "—",
          a.status.charAt(0).toUpperCase() + a.status.slice(1),
        ];
      });

      autoTable(doc, {
        startY: 21,
        head: headers,
        body: rows,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [210, 210, 210], lineWidth: 0.3, textColor: [40, 40, 40], font: "helvetica", overflow: "linebreak" },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center", valign: "middle", cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 18, halign: "center" },
          1: { cellWidth: 28 },
          2: { cellWidth: 38 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 },
          5: { cellWidth: 28 },
          6: { cellWidth: 25 },
          7: { cellWidth: 26 },
          8: { cellWidth: 20, halign: "center" },
          9: { cellWidth: 20, halign: "center" },
          10: { cellWidth: 24, halign: "center" },
          11: { cellWidth: 20, halign: "center" },
          12: { cellWidth: 24, halign: "center" },
          13: { cellWidth: 17, halign: "center" },
        },
        margin: { left: margin, right: margin, top: 21, bottom: 15 },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(240, 240, 240);
        doc.rect(0, pageH - 8, pageW, 8, "F");
        doc.setFontSize(6.5);
        doc.setTextColor(150, 150, 150);
        doc.text(`PGR Angola © ${new Date().getFullYear()} — Sistema de Controlo de Arguidos em Prisão Preventiva`, margin, pageH - 3.5);
        doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 3.5, { align: "right" });
      }

      doc.save(`Arguidos_Selecionados_PGR_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "PDF exportado!", description: `${selectedArguidos.length} arguidos em ${pageCount} página${pageCount !== 1 ? "s" : ""}` });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({ title: "Erro", description: "Falha ao gerar PDF.", variant: "destructive" });
    }
  };

  // Navigation items — filtered by permissions
  const navItems = [
    { id: "dashboard", label: "Painel", icon: LayoutDashboard },
    ...(canPerform(authUser?.role || '', 'create') ? [{ id: "cadastro", label: "Cadastro", icon: UserPlus }] : []),
    { id: "gestao", label: "Gestão", icon: Users },
    { id: "consultar", label: "Consultar", icon: Search },
    { id: "alertas", label: "Alertas", icon: Bell },
    { id: "relatorios", label: "Relatórios", icon: BarChart3 },
    ...(canPerform(authUser?.role || '', 'manage_users') ? [{ id: "utilizadores", label: "Utilizadores", icon: UserCog }] : []),
    ...(authUser?.role === 'admin' ? [{ id: "sistema", label: "Sistema", icon: Shield }] : []),
  ];

  const urgentCount = stats?.prazosCriticos || 0;

  // ===================== RENDER =====================
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        {/* HEADER + NAVBAR */}
        <header className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-stone-200/80 dark:border-gray-800 shadow-sm">
          <nav className="flex items-center">
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center justify-center gap-2 flex-1 px-4 py-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`relative flex items-center gap-2.5 px-5 py-2.5 text-[15px] font-semibold rounded-lg transition-all duration-200
                      ${isActive
                        ? "bg-stone-900 text-white shadow-md dark:bg-orange-600 dark:hover:bg-orange-700"
                        : "text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                      }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                    {item.id === "alertas" && urgentCount > 0 && (
                      <span className="ml-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {urgentCount}
                      </span>
                    )}
                  </button>
                );
              })}

            </div>

            {/* Right side icons — desktop */}
            <div className="hidden md:flex items-center gap-1 pr-3">
              {/* Theme toggle */}
              <ThemeToggle />

              {/* Bell icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`relative h-10 w-10 rounded-full transition-colors ${pushSubscribed ? 'text-green-600 hover:bg-green-500/10' : 'text-pgr-text-muted hover:bg-stone-100 dark:hover:bg-gray-800 hover:text-stone-900 dark:hover:text-gray-200'}`}
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
              <div className="w-px h-6 bg-stone-200 dark:bg-gray-700 mx-1" />

              {/* User info + Sair button */}
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs font-semibold text-pgr-text dark:text-gray-100 leading-tight">{authUser?.nome || authUser?.username}</p>
                  <p className="text-[10px] text-pgr-text-muted leading-tight">{authUser?.role || 'Operador'}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full text-pgr-text-muted hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
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
                        : "text-pgr-text dark:text-gray-400 border-transparent hover:bg-stone-100 dark:hover:bg-gray-800"
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
                <ThemeToggle />
                <button
                  className={`relative h-10 w-10 flex items-center justify-center rounded-full transition-colors ${pushSubscribed ? 'text-green-600 bg-green-500/10' : 'text-pgr-text-muted bg-stone-50 dark:bg-gray-800'}`}
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
                      className="relative h-10 w-10 flex items-center justify-center rounded-full text-pgr-text-muted bg-stone-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
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
        <main className="flex-1 overflow-auto dark:bg-gray-950">
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
              {/* ============ DASHBOARD VIEW ============ */}
              {activeView === "dashboard" && (
                <DashboardView
                  stats={stats}
                  loading={loading}
                  onNavigate={setActiveView}
                  onViewDetail={(id) => fetchAndShowDetail(id)}
                  authUser={authUser}
                />
              )}

              {/* ============ CADASTRO VIEW ============ */}
              {activeView === "cadastro" && canPerform(authUser?.role || '', 'create') && (
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
                  detencaoDe={detencaoDe}
                  setDetencaoDe={setDetencaoDe}
                  detencaoAte={detencaoAte}
                  setDetencaoAte={setDetencaoAte}
                  prazoDe={prazoDe}
                  setPrazoDe={setPrazoDe}
                  prazoAte={prazoAte}
                  setPrazoAte={setPrazoAte}
                  totalRecords={totalRecords}
                  onEdit={canPerform(authUser?.role || '', 'edit') ? handleOpenEdit : () => {}}
                  onDelete={canPerform(authUser?.role || '', 'delete') ? (id) => setDeleteDialog(id) : () => {}}
                  onView={(a) => fetchAndShowDetail(a.id)}
                  onPdf={handleDownloadPdf}
                  onRefresh={loadArguidos}
                  onExport={canPerform(authUser?.role || '', 'export') ? handleExportPDF : () => {}}
                  onExportSelected={canPerform(authUser?.role || '', 'export') ? handleExportSelectedPDF : () => {}}
                  onNew={canPerform(authUser?.role || '', 'create') ? handleOpenCreate : () => {}}
                  canCreate={canPerform(authUser?.role || '', 'create')}
                  canEdit={canPerform(authUser?.role || '', 'edit')}
                  canDelete={canPerform(authUser?.role || '', 'delete')}
                  canExport={canPerform(authUser?.role || '', 'export')}
                  canImport={canPerform(authUser?.role || '', 'import')}
                />
              )}

              {/* ============ CONSULTAR VIEW ============ */}
              {activeView === "consultar" && (
                <ConsultarView authUser={authUser} />
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
                <RelatoriosView stats={reportStats || stats} reportFilters={reportFilters} setReportFilters={setReportFilters} onApplyFilters={loadReportStats} reportLoading={reportLoading} onExportPdf={handleExportReportPdf} canExport={canPerform(authUser?.role || '', 'export')} />
              )}

              {/* ============ UTILIZADORES VIEW ============ */}
              {activeView === "utilizadores" && canPerform(authUser?.role || '', 'manage_users') && (
                <UtilizadoresView />
              )}

              {/* ============ SISTEMA VIEW (admin only) ============ */}
              {activeView === "sistema" && authUser?.role === 'admin' && (
                <SistemaView stats={stats} />
              )}
            </div>
          </main>

        {/* FOOTER */}
        <footer className="bg-stone-200 dark:bg-gray-900 text-pgr-text-muted dark:text-gray-400 border-t border-stone-200 dark:border-gray-800 py-3 px-4 text-center text-xs mt-auto">
          <div className="flex items-center justify-center gap-2">
            <Gavel className="h-3 w-3" />
            <span>© {new Date().getFullYear()} Procuradoria-Geral da República de Angola — Sistema de Controlo de Arguidos em Prisão Preventiva</span>
          </div>
          {!pushSubscribed && notificationPermission !== 'denied' && (
            <button
              onClick={handleSubscribePush}
              className="mt-2 inline-flex items-center gap-1.5 text-pgr-text-secondary dark:text-gray-400 hover:text-pgr-text dark:hover:text-gray-200 transition-colors underline underline-offset-2 decoration-stone-300 dark:decoration-gray-600 hover:decoration-pgr-text"
            >
              <span>🔔</span> Ativar alertas no dispositivo
            </button>
          )}
        </footer>

        {/* ============ FORM DIALOG ============ */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-stone-200 dark:border-gray-800 text-pgr-text dark:text-gray-100">
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
            <FormFields formData={formData} setFormData={setFormData} formErrors={formErrors} />
            {duplicateWarning && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm rounded-lg px-4 py-3 mt-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Aviso de possível duplicado</p>
                  <p className="text-xs mt-0.5">{duplicateWarning}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" className="bg-stone-100 dark:bg-gray-800 text-pgr-text-muted dark:text-gray-400 hover:text-stone-900 dark:hover:text-gray-100 border-stone-200 dark:border-gray-700" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button className="bg-pgr-primary text-white font-bold hover:opacity-90" onClick={handleSubmitForm} disabled={checkingDuplicates}>
                {checkingDuplicates ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    A verificar duplicados...
                  </span>
                ) : formMode === "create" ? "Cadastrar" : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ VIEW DETAIL DIALOG ============ */}
        <Dialog open={!!viewDetail || viewDetailLoading} onOpenChange={() => { if (!viewDetailLoading) setViewDetail(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-stone-200 dark:border-gray-800 text-pgr-text dark:text-gray-100">
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
              <Button variant="outline" className="bg-stone-100 dark:bg-gray-800 text-pgr-text-muted dark:text-gray-400 hover:text-stone-900 dark:hover:text-gray-100 border-stone-200 dark:border-gray-700" onClick={() => setViewDetail(null)}>Fechar</Button>
              <Button variant="outline" className="text-pgr-primary border-pgr-primary hover:bg-orange-50 dark:hover:bg-orange-900/20 bg-stone-100 dark:bg-gray-800" onClick={() => { if (viewDetail) handleDownloadPdf(viewDetail); }}>
                <FileDown className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button variant="outline" className="bg-stone-100 dark:bg-gray-800 text-pgr-text-muted dark:text-gray-400 hover:text-stone-900 dark:hover:text-gray-100 border-stone-200 dark:border-gray-700" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
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
          <AlertDialogContent className="border-stone-200 dark:border-gray-800 text-pgr-text dark:text-gray-100">
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
              className="relative pointer-events-auto w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden bg-white border border-stone-200"
              style={{ animation: 'slideInAppNotification 0.4s ease-out' }}
            >
              {/* Header — PGR Angola branding */}
              <div className="bg-stone-800 px-5 py-4">
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
                <div className="h-1 bg-stone-300" />
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
                <div className="flex items-center gap-3.5 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      {inAppNotification.criticos} Caso(s) Crítico(s)
                    </p>
                    <p className="text-[11px] text-amber-500 dark:text-amber-400">Prazo muito próximo</p>
                  </div>
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{inAppNotification.criticos}</span>
                </div>

                {/* Atenção */}
                <div className="flex items-center gap-3.5 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
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
                <div className="border-t border-stone-200 dark:border-gray-700 my-1" />

                {/* Total */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-medium text-pgr-text-muted">Total de Casos</p>
                  <p className="text-sm font-bold text-pgr-text dark:text-gray-100">{inAppNotification.total}</p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-5 pb-4 flex items-center gap-2">
                <Button
                  size="sm"
                  className={`flex-1 text-white text-sm font-semibold ${
                    inAppNotification.hasUrgent
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-stone-800 hover:bg-stone-700'
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
    </ThemeProvider>
  );
}

// ===================== FORM FIELDS COMPONENT =====================
function FormFields({ formData, setFormData, formErrors }: {
  formData: Omit<Arguido, "id" | "numeroId" | "createdAt" | "updatedAt">;
  setFormData: React.Dispatch<React.SetStateAction<Omit<Arguido, "id" | "numeroId" | "createdAt" | "updatedAt">>>;
  formErrors?: Record<string, string>;
}) {
  const update = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
      {/* Personal Info */}
      <div className="md:col-span-2">
        <h4 className="text-sm font-semibold text-pgr-text dark:text-gray-100 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Dados Pessoais e Processuais
        </h4>
      </div>

      <div className="space-y-2">
        <Label htmlFor="numeroProcesso" className="text-pgr-text dark:text-gray-100">Nº Processo *</Label>
        <Input id="numeroProcesso" value={formData.numeroProcesso} onChange={e => update("numeroProcesso", e.target.value)} placeholder="Ex: PGR-2024-001" className={`bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary ${formErrors?.numeroProcesso ? 'border-red-400 focus:border-red-500' : ''}`} />
        {formErrors?.numeroProcesso && <p className="text-xs text-red-500">{formErrors.numeroProcesso}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="nomeArguido" className="text-pgr-text dark:text-gray-100">Nome do Arguido *</Label>
        <Input id="nomeArguido" value={formData.nomeArguido} onChange={e => update("nomeArguido", e.target.value)} placeholder="Nome completo" className={`bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary ${formErrors?.nomeArguido ? 'border-red-400 focus:border-red-500' : ''}`} />
        {formErrors?.nomeArguido && <p className="text-xs text-red-500">{formErrors.nomeArguido}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="nomePai" className="text-pgr-text dark:text-gray-100">Nome do Pai</Label>
        <Input id="nomePai" value={formData.nomePai} onChange={e => update("nomePai", e.target.value)} placeholder="Nome do pai" className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nomeMae" className="text-pgr-text dark:text-gray-100">Nome da Mãe</Label>
        <Input id="nomeMae" value={formData.nomeMae} onChange={e => update("nomeMae", e.target.value)} placeholder="Nome da mãe" className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataDetencao" className="text-pgr-text dark:text-gray-100">Data de Detenção</Label>
        <Input id="dataDetencao" type="date" value={formData.dataDetencao ? formData.dataDetencao.slice(0, 10) : ""} onChange={e => update("dataDetencao", e.target.value || null)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="crime" className="text-pgr-text dark:text-gray-100">Crime *</Label>
        <Select value={formData.crime} onValueChange={v => update("crime", v)}>
          <SelectTrigger className={`bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 ${formErrors?.crime ? 'border-red-400' : ''}`}><SelectValue placeholder="Selecionar crime" /></SelectTrigger>
          <SelectContent>
            {CRIMES_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Ou digite outro..." value={formData.crime && !CRIMES_LIST.includes(formData.crime) ? formData.crime : ""} onChange={e => update("crime", e.target.value)} className={`bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary ${formErrors?.crime ? 'border-red-400 focus:border-red-500' : ''}`} />
        {formErrors?.crime && <p className="text-xs text-red-500">{formErrors.crime}</p>}
      </div>

      {/* Dates */}
      <div className="md:col-span-2 mt-2">
        <h4 className="text-sm font-semibold text-pgr-text dark:text-gray-100 mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Datas e Prazos Processuais
        </h4>
      </div>

      <div className="space-y-2">
        <Label htmlFor="medidasAplicadas" className="text-pgr-text dark:text-gray-100">Medidas Aplicadas</Label>
        <Select value={formData.medidasAplicadas} onValueChange={v => update("medidasAplicadas", v)}>
          <SelectTrigger className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700"><SelectValue placeholder="Selecionar medida" /></SelectTrigger>
          <SelectContent>
            {MEDIDAS_LIST.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataMedidasAplicadas" className="text-pgr-text dark:text-gray-100">Data das Medidas Aplicadas</Label>
        <Input id="dataMedidasAplicadas" type="date" value={formData.dataMedidasAplicadas ? formData.dataMedidasAplicadas.slice(0, 10) : ""} onChange={e => update("dataMedidasAplicadas", e.target.value || null)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
        <p className="text-[10px] text-pgr-text-muted">1º prazo será calculado automaticamente (+3 meses)</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataRemessaJg" className="text-pgr-text dark:text-gray-100">Data de Remessa ao JG</Label>
        <Input id="dataRemessaJg" type="date" value={formData.dataRemessaJg ? formData.dataRemessaJg.slice(0, 10) : ""} onChange={e => update("dataRemessaJg", e.target.value || null)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataRegresso" className="text-pgr-text dark:text-gray-100">Data de Regresso</Label>
        <Input id="dataRegresso" type="date" value={formData.dataRegresso ? formData.dataRegresso.slice(0, 10) : ""} onChange={e => update("dataRegresso", e.target.value || null)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataRemessaSic" className="text-pgr-text dark:text-gray-100">Data de Remessa ao SIC</Label>
        <Input id="dataRemessaSic" type="date" value={formData.dataRemessaSic ? formData.dataRemessaSic.slice(0, 10) : ""} onChange={e => update("dataRemessaSic", e.target.value || null)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="magistrado" className="text-pgr-text dark:text-gray-100">Magistrado Responsável</Label>
        <Input id="magistrado" value={formData.magistrado} onChange={e => update("magistrado", e.target.value)} placeholder="Nome do magistrado" className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>

      {/* Prorrogacao */}
      <div className="md:col-span-2 mt-2">
        <h4 className="text-sm font-semibold text-pgr-text dark:text-gray-100 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Prorrogação (2º Prazo)
        </h4>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataProrrogacao" className="text-pgr-text dark:text-gray-100">Data de Prorrogação</Label>
        <Input id="dataProrrogacao" type="date" value={formData.dataProrrogacao ? formData.dataProrrogacao.slice(0, 10) : ""} onChange={e => update("dataProrrogacao", e.target.value || null)} className={`bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary ${formErrors?.dataProrrogacao ? 'border-red-400 focus:border-red-500' : ''}`} />
        {formErrors?.dataProrrogacao && <p className="text-xs text-red-500">{formErrors.dataProrrogacao}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="duracaoProrrogacao" className="text-pgr-text dark:text-gray-100">Duração da Prorrogação (meses)</Label>
        <Input id="duracaoProrrogacao" type="number" min={0} max={12} value={formData.duracaoProrrogacao || ""} onChange={e => update("duracaoProrrogacao", parseInt(e.target.value) || 0)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
        <p className="text-[10px] text-pgr-text-muted">2º prazo = Data Prorrogação + Duração</p>
      </div>

      {/* Calculated dates display */}
      {(formData.dataMedidasAplicadas || formData.dataProrrogacao) && (
        <div className="md:col-span-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
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
        <h4 className="text-sm font-semibold text-pgr-text dark:text-gray-100 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Observações
        </h4>
      </div>

      <div className="space-y-2">
        <Label htmlFor="remessaJgAlteracao" className="text-pgr-text dark:text-gray-100">Remessa ao JG / Alteração</Label>
        <Textarea id="remessaJgAlteracao" value={formData.remessaJgAlteracao} onChange={e => update("remessaJgAlteracao", e.target.value)} placeholder="Histórico de alterações..." rows={3} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status" className="text-pgr-text dark:text-gray-100">Status</Label>
        <Select value={formData.status} onValueChange={v => update("status", v)}>
          <SelectTrigger className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs1" className="text-pgr-text dark:text-gray-100">Observação 1</Label>
        <Textarea id="obs1" value={formData.obs1} onChange={e => update("obs1", e.target.value)} rows={2} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obs2" className="text-pgr-text dark:text-gray-100">Observação 2</Label>
        <Textarea id="obs2" value={formData.obs2} onChange={e => update("obs2", e.target.value)} rows={2} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary" />
      </div>
    </div>
  );
}

// ===================== DASHBOARD VIEW =====================
function DashboardView({ stats, loading, onNavigate, onViewDetail, authUser }: {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (view: string) => void;
  onViewDetail: (id: number) => void;
  authUser: { username: string; nome: string; role: string } | null;
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

  const isMagistrado = authUser?.role === 'magistrado';

  const conformidade = stats.ativos > 0
    ? Math.max(0, Math.round(((stats.ativos - stats.prazosCriticos) / stats.ativos) * 100))
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
      {/* Magistrado Welcome Banner */}
      {isMagistrado && (
        <div className="rounded-xl p-5 bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Scale className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Bem-vindo, {authUser?.nome || authUser?.username}</h2>
              <p className="text-sm text-white/80">Aqui estão os seus processos sob supervisão</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">{isMagistrado ? 'Painel do Magistrado' : 'Painel'}</h2>
          <p className="text-sm text-muted-foreground">{isMagistrado ? 'Visão dos seus processos sob supervisão' : 'Visão geral do sistema de controlo'}</p>
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
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800 pgr-card-hover border-l-4 border-l-stone-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pgr-text-muted font-medium">Total Arguidos</p>
                <p className="text-2xl font-bold text-pgr-text dark:text-gray-100">{stats.totalArguidos}</p>
              </div>
              <div className="w-10 h-10 bg-pgr-surface rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-pgr-text-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800 pgr-card-hover border-l-4 border-l-green-500">
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

        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800 pgr-card-hover border-l-4 border-l-red-500">
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

        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800 pgr-card-hover border-l-4 border-l-amber-500">
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
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Taxa de Conformidade</CardTitle>
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

        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Distribuição por Status</CardTitle>
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

        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Casos por Crime</CardTitle>
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
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-pgr-text dark:text-gray-100">
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
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-pgr-text dark:text-gray-100">
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
                    className={`cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-stone-50 dark:bg-gray-800 hover:bg-stone-200 dark:hover:bg-gray-700' : 'bg-stone-100 dark:bg-gray-800/60 hover:bg-stone-200 dark:hover:bg-gray-700'} text-pgr-text dark:text-gray-100`}
                    onClick={() => onViewDetail(p.id)}
                  >
                    <TableCell className="py-2.5">
                      <span className={`inline-block text-sm font-bold px-2 py-0.5 rounded whitespace-nowrap ${getDeadlineColor(p.diasRestantes)}`}>
                        {getDeadlineLabel(p.diasRestantes)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <p className="text-sm font-medium leading-tight text-gray-800 dark:text-gray-100"><span className="inline-block max-w-[180px] lg:max-w-[240px] align-bottom truncate">{p.nomeArguido}</span></p>
                      <p className="text-sm text-gray-500 dark:text-gray-400"><span className="inline-block max-w-[180px] lg:max-w-[240px] align-bottom truncate">{p.numeroProcesso}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 hidden md:table-cell">
                      <p className="text-sm text-gray-600 dark:text-gray-300"><span className="inline-block max-w-[130px] align-bottom truncate">{p.crime}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 hidden sm:table-cell">
                      <p className="text-sm text-gray-600 dark:text-gray-300"><span className="inline-block max-w-[90px] align-bottom truncate">{p.tipo}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <p className="text-sm font-medium whitespace-nowrap text-gray-800 dark:text-gray-100">{formatDate(p.dataVencimento)}</p>
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
        <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">Novo Cadastro</h2>
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
function GestaoView({ arguidos, loading, searchTerm, setSearchTerm, filterCrime, setFilterCrime, filterStatus, setFilterStatus, filterPrazo, setFilterPrazo, detencaoDe, setDetencaoDe, detencaoAte, setDetencaoAte, prazoDe, setPrazoDe, prazoAte, setPrazoAte, totalRecords, onEdit, onDelete, onView, onPdf, onRefresh, onExport, onExportSelected, onNew, canCreate, canEdit, canDelete, canExport, canImport, selectedIds: parentSelectedIds, setSelectedIds: setParentSelectedIds }: {
  arguidos: Arguido[];
  loading: boolean;
  searchTerm: string; setSearchTerm: (v: string) => void;
  filterCrime: string; setFilterCrime: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  filterPrazo: string; setFilterPrazo: (v: string) => void;
  detencaoDe: string; setDetencaoDe: (v: string) => void;
  detencaoAte: string; setDetencaoAte: (v: string) => void;
  prazoDe: string; setPrazoDe: (v: string) => void;
  prazoAte: string; setPrazoAte: (v: string) => void;
  totalRecords: number;
  onEdit: (a: Arguido) => void;
  onDelete: (id: number) => void;
  onView: (a: Arguido) => void;
  onPdf: (a: Arguido) => void;
  onRefresh: () => void;
  onExport: () => void;
  onExportSelected?: (ids: number[]) => void;
  onNew: () => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  canImport?: boolean;
  selectedIds?: Set<number>;
  setSelectedIds?: (ids: Set<number>) => void;
}) {
  const { toast } = useToast();
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  // Batch operations state
  const [selectedIdsLocal, setSelectedIdsLocal] = useState<Set<number>>(new Set());
  const selIds = parentSelectedIds ?? selectedIdsLocal;
  const setSelIds = setParentSelectedIds ?? setSelectedIdsLocal;
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const [batchStatus, setBatchStatus] = useState("");

  const toggleSelect = (id: number) => {
    setSelIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selIds.size === arguidos.length) {
      setSelIds(new Set());
    } else {
      setSelIds(new Set(arguidos.map(a => a.id)));
    }
  };

  const handleBatchStatusChange = async () => {
    if (!batchStatus || selIds.size === 0) return;
    setBatchLoading(true);
    try {
      const res = await fetch('/api/arguidos/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selIds), updates: { status: batchStatus } }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: 'Status actualizado', description: `${data.updated} registo(s) actualizado(s) para "${batchStatus}"` });
        setSelIds(new Set());
        setBatchStatus("");
        onRefresh();
      } else {
        toast({ title: 'Erro', description: 'Falha na operação.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro de ligação.', variant: 'destructive' });
    } finally {
      setBatchLoading(false);
    }
  };

  const handleClearFilters = () => {
    setDetencaoDe(""); setDetencaoAte(""); setPrazoDe(""); setPrazoAte("");
    setFilterStatus(""); setFilterCrime("");
  };

  const hasAdvancedFilters = detencaoDe || detencaoAte || prazoDe || prazoAte;

  const handleDownloadTemplate = () => {
    const headers = 'numero_processo,nome_arguido,nome_pai,nome_mae,data_detencao,crime,magistrado,medidas_aplicadas,data_medidas_aplicadas,status';
    const exampleRow = 'PROC-2024-001,João da Silva,António da Silva,Maria da Conceição,2024-01-15,Homicídio,Dr. Manuel Santos,Prisão Preventiva,2024-01-20,ativo';
    const csvContent = headers + '\n' + exampleRow + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_importacao_arguidos.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Template descarregado', description: 'Use este modelo para preencher os dados.' });
  };

  const handleImportCsv = async () => {
    if (!csvFile) {
      toast({ title: 'Sem ficheiro', description: 'Selecione um ficheiro CSV.', variant: 'destructive' });
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await fetch('/api/arguidos/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Importação concluída',
          description: `${data.imported} registo${data.imported !== 1 ? 's' : ''} importado${data.imported !== 1 ? 's' : ''} com sucesso.${data.errors.length > 0 ? ` ${data.errors.length} erro(s) encontrado(s).` : ''}`,
          variant: data.errors.length > 0 ? 'default' : 'default',
        });
        setCsvDialogOpen(false);
        setCsvFile(null);
        onRefresh();
      } else {
        toast({ title: 'Erro na importação', description: data.error || 'Falha ao importar o ficheiro CSV.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro de ligação ao servidor.', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">Gestão de Arguidos</h2>
          <p className="text-sm text-muted-foreground">{totalRecords} registo{totalRecords !== 1 ? "s" : ""} encontrado{totalRecords !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></Button>
          {canExport && (
            <Button variant="outline" size="sm" onClick={onExport}><FileText className="h-4 w-4 mr-1" /> Exportar PDF</Button>
          )}
          {canImport && (
            <Button variant="outline" size="sm" onClick={() => setCsvDialogOpen(true)}><Upload className="h-4 w-4 mr-1" /> Importar CSV</Button>
          )}
          {canCreate && (
            <Button size="sm" className="bg-[#D35400] hover:bg-[#E67E22]" onClick={onNew}>
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pgr-text-muted" />
              <Input
                placeholder="Pesquisar por nome, Nº processo ou ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary placeholder:text-stone-400 dark:placeholder:text-gray-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterCrime || "todos"} onValueChange={v => setFilterCrime(v === "todos" ? "" : v)}>
                <SelectTrigger className="w-40 bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary"><SelectValue placeholder="Crime" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Crimes</SelectItem>
                  {CRIMES_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus || "todos"} onValueChange={v => setFilterStatus(v === "todos" ? "" : v)}>
                <SelectTrigger className="w-36 bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPrazo} onValueChange={v => setFilterPrazo(v === "todos" ? "" : v)}>
                <SelectTrigger className="w-40 bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary"><SelectValue placeholder="Prazo" /></SelectTrigger>
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

      {/* Advanced Date Filters (collapsible) */}
      <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="flex items-center gap-2 text-sm font-medium text-pgr-text-muted hover:text-pgr-text dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
        <Filter className="h-4 w-4" />
        {showAdvancedFilters ? 'Ocultar Filtros Avançados' : 'Filtros Avançados'}
        {hasAdvancedFilters && <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] dark:bg-amber-900 dark:text-amber-200">Ativos</Badge>}
      </button>
      {showAdvancedFilters && (
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800 animate-[fadeIn_0.2s_ease-out]">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-pgr-text-muted dark:text-gray-400">Detenção de</Label>
                <Input type="date" value={detencaoDe} onChange={e => setDetencaoDe(e.target.value)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 text-sm h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-pgr-text-muted dark:text-gray-400">Detenção até</Label>
                <Input type="date" value={detencaoAte} onChange={e => setDetencaoAte(e.target.value)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 text-sm h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-pgr-text-muted dark:text-gray-400">1º Prazo de</Label>
                <Input type="date" value={prazoDe} onChange={e => setPrazoDe(e.target.value)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 text-sm h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-pgr-text-muted dark:text-gray-400">1º Prazo até</Label>
                <Input type="date" value={prazoAte} onChange={e => setPrazoAte(e.target.value)} className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 text-sm h-9" />
              </div>
            </div>
            {hasAdvancedFilters && (
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs text-pgr-text-muted hover:text-red-600">Limpar Filtros</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch Action Bar */}
      {selIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-stone-800 dark:bg-gray-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 border border-stone-700 dark:border-gray-700 animate-[fadeIn_0.2s_ease-out]">
          <span className="text-sm font-semibold">{selIds.size} seleccionado{selIds.size !== 1 ? 's' : ''}</span>
          <div className="w-px h-6 bg-stone-600" />
          <Select value={batchStatus} onValueChange={setBatchStatus}>
            <SelectTrigger className="w-36 h-8 text-xs bg-stone-700 border-stone-600 text-white"><SelectValue placeholder="Alterar Status..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white" disabled={!batchStatus || batchLoading} onClick={handleBatchStatusChange}>
            {batchLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
            Aplicar
          </Button>
          {onExportSelected && (
            <Button size="sm" variant="ghost" className="h-8 text-xs text-stone-400 hover:text-white hover:bg-stone-700" onClick={() => onExportSelected(Array.from(selIds))}>
              <FileDown className="h-3 w-3 mr-1" /> Exportar PDF
            </Button>
          )}
          <div className="w-px h-6 bg-stone-600" />
          <Button size="sm" variant="ghost" className="h-8 text-xs text-stone-400 hover:text-white hover:bg-stone-700" onClick={() => setSelIds(new Set())}>
            Limpar
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
        <CardContent className="p-0 [&>[data-slot=table-container]]:max-h-[calc(100vh-320px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-pgr-text-muted" />
            </div>
          ) : arguidos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum registo encontrado.</p>
              {canCreate && <Button variant="link" size="sm" onClick={onNew}>Criar novo registo</Button>}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="hover:bg-stone-700! bg-stone-700 border-none">
                    <TableHead className="text-sm font-semibold text-white w-10"><Checkbox checked={selIds.size === arguidos.length && arguidos.length > 0} onCheckedChange={toggleSelectAll} className="border-white/40" /></TableHead>
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
                      <TableRow key={a.id} className={`cursor-pointer transition-colors ${selIds.has(a.id) ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : idx % 2 === 0 ? 'bg-stone-50 dark:bg-gray-800 hover:bg-stone-200 dark:hover:bg-gray-700' : 'bg-stone-100 dark:bg-gray-800/60 hover:bg-stone-200 dark:hover:bg-gray-700'} text-pgr-text dark:text-gray-100`} onClick={() => onView(a)}>
                        <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selIds.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} /></TableCell>
                        <TableCell className="text-sm font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">{a.numeroId}</TableCell>
                        <TableCell className="text-sm font-medium text-gray-800 dark:text-gray-100"><p className="max-w-[120px] truncate">{a.numeroProcesso}</p></TableCell>
                        <TableCell className="text-sm font-medium text-gray-800 dark:text-gray-100"><p className="max-w-[250px] truncate">{a.nomeArguido}</p></TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell"><p className="max-w-[150px] truncate">{a.crime}</p></TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell"><p className="max-w-[140px] truncate">{a.magistrado}</p></TableCell>
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
                            {canEdit && (
                              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(a); }}><Edit className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
                            )}
                            {canExport && (
                              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-7 gap-1 text-[#D35400] hover:text-[#BA4A00] hover:bg-[#D35400]/10 text-sm font-semibold px-2" onClick={(e) => { e.stopPropagation(); onPdf(a); }}><FileDown className="h-3.5 w-3.5" />PDF</Button></TooltipTrigger><TooltipContent>Descarregar Ficha PDF</TooltipContent></Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}><Trash2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Eliminar</TooltipContent></Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {/* Footer with total count */}
              <div className="flex items-center justify-center px-4 py-3 border-t border-stone-200 dark:border-gray-700">
                <p className="text-sm text-pgr-text-muted">
                  {totalRecords} registo{totalRecords !== 1 ? "s" : ""}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {/* CSV Import Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-pgr-text flex items-center gap-2">
              <Upload className="h-5 w-5" /> Importar Arguidos via CSV
            </DialogTitle>
            <DialogDescription>
              Importe arguidos em massa usando um ficheiro CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-pgr-text dark:text-gray-100">Ficheiro CSV</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={e => setCsvFile(e.target.files?.[0] || null)}
                className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700"
              />
              {csvFile && (
                <p className="text-xs text-muted-foreground">Selecionado: {csvFile.name}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Campos obrigatórios: <strong>nome_arguido</strong>, <strong>crime</strong></span>
            </div>
            <Button variant="link" size="sm" className="text-[#D35400] p-0 h-auto" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> Descarregar modelo CSV
            </Button>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>Cancelar</Button>
            <Button
              className="bg-[#D35400] hover:bg-[#E67E22]"
              onClick={handleImportCsv}
              disabled={!csvFile || importing}
            >
              {importing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {importing ? 'A importar...' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">Sistema de Alertas</h2>
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
          <Card className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.prazosCriticos}</p>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Críticos</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{Math.max(0, stats.prazosProximos - stats.prazosCriticos)}</p>
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Atenção</p>
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
      <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Histórico de Alertas</CardTitle>
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
                    className={`cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-stone-50 dark:bg-gray-800 hover:bg-stone-200 dark:hover:bg-gray-700' : 'bg-stone-100 dark:bg-gray-800/60 hover:bg-stone-200 dark:hover:bg-gray-700'} text-pgr-text dark:text-gray-100`}
                    onClick={() => alerta.arguidoId && onView(alerta.arguidoId)}
                  >
                    <TableCell className="py-2.5">
                      <span className={`inline-block text-sm font-bold px-2 py-0.5 rounded whitespace-nowrap ${getDeadlineColor(alerta.diasRestantes)}`}>
                        {getDeadlineLabel(alerta.diasRestantes)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <p className="text-sm text-gray-600 dark:text-gray-300"><span className="inline-block max-w-[75px] align-bottom truncate">{alerta.tipoAlerta.replace("_", " ")}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <p className="text-sm text-gray-800 dark:text-gray-100"><span className="inline-block max-w-[220px] sm:max-w-[320px] md:max-w-[420px] align-bottom truncate">{alerta.mensagem}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 hidden sm:table-cell">
                      <p className="text-sm text-gray-600 dark:text-gray-300"><span className="inline-block max-w-[65px] align-bottom truncate">{alerta.canalEnvio}</span></p>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(alerta.dataDisparo)}</p>
                    </TableCell>
                    <TableCell className="py-2.5 text-center">
                      {alerta.arguidoId && (
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
      <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Regras de Alerta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-start gap-2 p-3 bg-stone-50 dark:bg-gray-800 border border-stone-200 dark:border-gray-700 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-500 dark:text-red-400">Vencido</p>
                <p className="text-sm text-red-500 dark:text-red-400">Notificação imediata, registo de não conformidade</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-stone-50 dark:bg-gray-800 border border-stone-200 dark:border-gray-700 rounded-lg">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">Crítico</p>
                <p className="text-sm text-orange-600 dark:text-orange-400">Alerta prioritário, destaque máximo</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-stone-50 dark:bg-gray-800 border border-stone-200 dark:border-gray-700 rounded-lg">
              <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Atenção</p>
                <p className="text-sm text-amber-600 dark:text-amber-400">Alerta preventivo, acompanhamento diário</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== RELATÓRIOS VIEW =====================
function RelatoriosView({ stats, reportFilters, setReportFilters, onApplyFilters, reportLoading, onExportPdf, canExport }: { stats: DashboardStats | null; reportFilters: { startDate: string; endDate: string; crime: string; status: string; magistrado: string }; setReportFilters: React.Dispatch<React.SetStateAction<{ startDate: string; endDate: string; crime: string; status: string; magistrado: string }>>; onApplyFilters: () => void; reportLoading: boolean; onExportPdf: () => void; canExport: boolean }) {
  const hasActiveFilters = reportFilters.startDate || reportFilters.endDate || reportFilters.crime || reportFilters.status || reportFilters.magistrado;

  const handleClearFilters = () => {
    setReportFilters({ startDate: '', endDate: '', crime: '', status: '', magistrado: '' });
  };

  if (reportLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">Relatórios e Analytics</h2>
          <p className="text-sm text-muted-foreground">Análise detalhada dos dados do sistema</p>
        </div>
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardContent className="p-12 text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-pgr-text-muted" />
            <p className="text-sm text-pgr-text-muted">A aplicar filtros...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">Relatórios e Analytics</h2>
          <p className="text-sm text-muted-foreground">Análise detalhada dos dados do sistema</p>
        </div>
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">A carregar dados do relatório...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">Relatórios e Analytics</h2>
          <p className="text-sm text-muted-foreground">Análise detalhada dos dados do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExportPdf} disabled={!canExport}>
            <FileDown className="h-4 w-4 mr-1" /> Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-pgr-text-muted" />
            <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Filtros Avançados</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 text-xs">Filtros ativos</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-pgr-text-muted">Data Início</Label>
              <Input
                type="date"
                value={reportFilters.startDate}
                onChange={e => setReportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-pgr-text-muted">Data Fim</Label>
              <Input
                type="date"
                value={reportFilters.endDate}
                onChange={e => setReportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-pgr-text-muted">Crime</Label>
              <Select value={reportFilters.crime || "__all__"} onValueChange={v => setReportFilters(prev => ({ ...prev, crime: v === "__all__" ? "" : v }))}>
                <SelectTrigger className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary text-sm">
                  <SelectValue placeholder="Todos os crimes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os crimes</SelectItem>
                  {CRIMES_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-pgr-text-muted">Status</Label>
              <Select value={reportFilters.status || "__all__"} onValueChange={v => setReportFilters(prev => ({ ...prev, status: v === "__all__" ? "" : v }))}>
                <SelectTrigger className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary text-sm">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-4">
              <Label className="text-xs text-pgr-text-muted">Magistrado</Label>
              <Input
                type="text"
                placeholder="Filtrar por nome do magistrado..."
                value={reportFilters.magistrado}
                onChange={e => setReportFilters(prev => ({ ...prev, magistrado: e.target.value }))}
                className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="bg-[#D35400] hover:bg-[#E67E22]" onClick={onApplyFilters}>
              <Filter className="h-4 w-4 mr-1" /> Filtrar
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              <RefreshCw className="h-4 w-4 mr-1" /> Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-pgr-text dark:text-gray-100">{stats.totalArguidos}</p><p className="text-sm text-pgr-text-muted">Total Registados</p></CardContent></Card>
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-green-600">{stats.ativos}</p><p className="text-sm text-pgr-text-muted">Ativos</p></CardContent></Card>
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-red-500">{stats.vencidos}</p><p className="text-sm text-pgr-text-muted">Vencidos</p></CardContent></Card>
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{stats.prazosProximos}</p><p className="text-sm text-pgr-text-muted">Prazos Próximos</p></CardContent></Card>
      </div>

      {/* Status Distribution */}
      {stats.statusCounts && stats.statusCounts.length > 0 && (
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {stats.statusCounts.map((sc, idx) => {
                const statusColors: Record<string, string> = { ativo: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800', vencido: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800', encerrado: 'bg-stone-200 dark:bg-gray-800 text-stone-600 dark:text-gray-400 border-stone-300 dark:border-gray-700' };
                const barColors: Record<string, string> = { ativo: 'bg-green-500', vencido: 'bg-red-500', encerrado: 'bg-stone-400' };
                const pct = stats.totalArguidos > 0 ? (sc._count.status / stats.totalArguidos) * 100 : 0;
                return (
                  <div key={idx} className={`rounded-lg border p-3 ${statusColors[sc.status] || 'bg-stone-100 dark:bg-gray-800 text-stone-600 dark:text-gray-400 border-stone-200 dark:border-gray-700'}`}>
                    <p className="text-xs font-medium uppercase tracking-wider opacity-70">{sc.status}</p>
                    <p className="text-xl font-bold mt-1">{sc._count.status}</p>
                    <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColors[sc.status] || 'bg-stone-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <p className="text-xs mt-1 opacity-60">{pct.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Crimes Distribution */}
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Distribuição por Crime</CardTitle>
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
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Carga por Magistrado</CardTitle>
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
        <Card className="lg:col-span-2 bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Evolução Mensal</CardTitle>
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
      <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-pgr-text dark:text-gray-100">Resumo por Crime</CardTitle>
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
                <TableRow key={idx} className={`transition-colors ${idx % 2 === 0 ? 'bg-stone-50 dark:bg-gray-800 hover:bg-stone-200 dark:hover:bg-gray-700' : 'bg-stone-100 dark:bg-gray-800/60 hover:bg-stone-200 dark:hover:bg-gray-700'} text-pgr-text dark:text-gray-100`}>
                  <TableCell className="text-base font-medium text-gray-800 dark:text-gray-100">{c.crime || "Não especificado"}</TableCell>
                  <TableCell className="text-base text-right text-gray-800 dark:text-gray-100">{c._count.crime}</TableCell>
                  <TableCell className="text-base text-right text-gray-800 dark:text-gray-100">
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

// ===================== CONSULTAR VIEW =====================
function ConsultarView({ authUser }: { authUser: { username: string; nome: string; role: string } | null }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Arguido[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [selectedArguido, setSelectedArguido] = useState<Arguido | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchDone(false);
    setResults([]);
    setSelectedArguido(null);

    try {
      const params = new URLSearchParams({
        search: searchQuery.trim(),
        page: '1',
        pageSize: '20',
      });
      if (authUser?.role === 'magistrado') {
        params.set('magistrado', authUser.nome);
      }
      const res = await fetch(`/api/arguidos?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.data || []);
      } else {
        toast({ title: 'Erro', description: 'Falha na pesquisa.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro de ligação ao servidor.', variant: 'destructive' });
    } finally {
      setSearchDone(true);
      setLoading(false);
    }
  };

  const handleSelectArguido = async (arguido: Arguido) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/arguidos/${arguido.id}`);
      if (res.ok) {
        const fullArguido = await res.json();
        setSelectedArguido(fullArguido);
      } else {
        toast({ title: 'Erro', description: 'Falha ao carregar detalhes.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro de ligação.', variant: 'destructive' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedArguido(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">Consultar Arguido</h2>
        <p className="text-sm text-muted-foreground">Pesquise por nome, número de processo ou ID para ver detalhes completos.</p>
      </div>

      {/* Search Bar */}
      <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pgr-text-muted" />
              <Input
                placeholder="Pesquisar por nome, Nº processo ou ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary placeholder:text-stone-400 dark:placeholder:text-gray-500"
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="bg-[#D35400] hover:bg-[#E67E22] text-white font-semibold gap-2 disabled:opacity-40"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Pesquisar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results Table */}
      {searchDone && results.length > 0 && (
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-pgr-text dark:text-gray-100">
              {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 [&>[data-slot=table-container]]:max-h-[300px]">
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
                  <TableHead className="text-sm font-semibold text-white text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((a, idx) => {
                  const days1 = getDaysRemaining(a.fimPrimeiroPrazo);
                  const days2 = getDaysRemaining(a.fimSegundoPrazo);
                  const nearestDays = [days1, days2].filter(d => d !== null).sort((x, y) => x! - y!)[0] ?? null;
                  const isSelected = selectedArguido?.id === a.id;
                  return (
                    <TableRow key={a.id} className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-stone-300/70 dark:bg-gray-700/70 ring-2 ring-inset ring-stone-500 dark:ring-gray-400'
                        : idx % 2 === 0 ? 'bg-stone-50 dark:bg-gray-800 hover:bg-stone-200 dark:hover:bg-gray-700' : 'bg-stone-100 dark:bg-gray-800/60 hover:bg-stone-200 dark:hover:bg-gray-700'
                    } text-pgr-text dark:text-gray-100`} onClick={() => handleSelectArguido(a)}>
                      <TableCell className="text-sm font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">{a.numeroId}</TableCell>
                      <TableCell className="text-sm font-medium text-gray-800 dark:text-gray-100"><p className="max-w-[120px] truncate">{a.numeroProcesso}</p></TableCell>
                      <TableCell className="text-sm font-medium text-gray-800 dark:text-gray-100"><p className="max-w-[250px] truncate">{a.nomeArguido}</p></TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell"><p className="max-w-[150px] truncate">{a.crime}</p></TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell"><p className="max-w-[120px] truncate">{a.magistrado}</p></TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-gray-600 dark:text-gray-300">{a.fimPrimeiroPrazo ? formatDate(a.fimPrimeiroPrazo) : '—'}</p>
                          {nearestDays !== null && (
                            <span className={`inline-block w-fit text-[10px] font-bold px-1.5 py-0.5 rounded ${getDeadlineColor(nearestDays)}`}>
                              {getDeadlineLabel(nearestDays)}
                            </span>
                          )}
                        </div>
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
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSelectArguido(a)}><Eye className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Ver Detalhes</TooltipContent></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Panel — shown below the table */}
      {selectedArguido && (
        <div className="space-y-3" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {/* Detail header with close button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-stone-800 rounded-lg flex items-center justify-center">
                <Eye className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-pgr-text dark:text-gray-100">Ficha Completa do Arguido</h3>
                <p className="text-xs text-muted-foreground">{selectedArguido.nomeArguido} — {selectedArguido.numeroProcesso}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCloseDetail} className="gap-1.5 border-stone-200 dark:border-gray-800 text-pgr-text dark:text-gray-100-muted hover:text-stone-900 hover:bg-stone-100 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" />
              Fechar
            </Button>
          </div>
          {detailLoading ? (
            <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
              <CardContent className="py-12 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-pgr-text-muted" />
              </CardContent>
            </Card>
          ) : (
            <DetailView arguido={selectedArguido} />
          )}
        </div>
      )}

      {/* No Results */}
      {searchDone && results.length === 0 && (
        <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm text-muted-foreground">Nenhum arguido encontrado.</p>
            <p className="text-xs text-muted-foreground mt-1">Tente pesquisar por outro nome, número de processo ou ID.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===================== UTILIZADORES VIEW =====================
function UtilizadoresView() {
  const { toast } = useToast();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('operador');
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao carregar utilizadores.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChangeRole = async (userId: number, newRoleVal: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRoleVal }),
      });
      if (res.ok) {
        toast({ title: "Função atualizada", description: `Função alterada para ${newRoleVal}` });
        loadUsers();
      } else {
        const err = await res.json();
        toast({ title: "Erro", description: err.error || "Falha ao atualizar.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar função.", variant: "destructive" });
    }
  };

  const handleToggleActive = async (userId: number, ativo: boolean) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, ativo: !ativo }),
      });
      if (res.ok) {
        toast({ title: ativo ? "Utilizador desativado" : "Utilizador ativado" });
        loadUsers();
      } else {
        toast({ title: "Erro", description: "Falha ao alterar estado.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao alterar estado.", variant: "destructive" });
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername || !newPassword || !newNome) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, nome: newNome, role: newRole, email: newEmail }),
      });
      if (res.ok) {
        toast({ title: "Utilizador criado", description: `${newNome} (${newUsername}) criado com sucesso.` });
        setCreateDialogOpen(false);
        setNewUsername('');
        setNewPassword('');
        setNewNome('');
        setNewEmail('');
        setNewRole('operador');
        loadUsers();
      } else {
        const err = await res.json();
        toast({ title: "Erro", description: err.error || "Falha ao criar utilizador.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao criar utilizador.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700';
      case 'operador': return 'bg-blue-100 text-blue-700';
      case 'magistrado': return 'bg-amber-100 text-amber-700';
      case 'consultor': return 'bg-green-100 text-green-700';
      default: return 'bg-stone-100 text-stone-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">Gestão de Utilizadores</h2>
          <p className="text-sm text-muted-foreground">{users.length} utilizador{users.length !== 1 ? "es" : ""} registado{users.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" className="bg-[#D35400] hover:bg-[#E67E22]" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Utilizador
        </Button>
      </div>

      <Card className="bg-pgr-surface dark:bg-gray-900 border border-stone-200 dark:border-gray-800">
        <CardContent className="p-0 [&>[data-slot=table-container]]:max-h-[calc(100vh-280px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-pgr-text-muted" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <UserCog className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum utilizador registado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-stone-700! bg-stone-700 border-none">
                  <TableHead className="text-sm font-semibold text-white">Username</TableHead>
                  <TableHead className="text-sm font-semibold text-white">Nome</TableHead>
                  <TableHead className="text-sm font-semibold text-white">Função</TableHead>
                  <TableHead className="text-sm font-semibold text-white">Estado</TableHead>
                  <TableHead className="text-sm font-semibold text-white hidden md:table-cell">Último Login</TableHead>
                  <TableHead className="text-sm font-semibold text-white hidden lg:table-cell">Criado em</TableHead>
                  <TableHead className="text-sm font-semibold text-white text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, idx) => (
                  <TableRow key={u.id} className={`transition-colors ${idx % 2 === 0 ? 'bg-stone-50 dark:bg-gray-800 hover:bg-stone-200 dark:hover:bg-gray-700' : 'bg-stone-100 dark:bg-gray-800/60 hover:bg-stone-200 dark:hover:bg-gray-700'} text-pgr-text dark:text-gray-100`}>
                    <TableCell className="text-sm font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">{u.username}</TableCell>
                    <TableCell className="text-sm font-medium text-gray-800 dark:text-gray-100">{u.nome}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) => handleChangeRole(u.id, v)}
                      >
                        <SelectTrigger className={`h-7 w-28 text-[11px] font-semibold border-0 ${getRoleBadgeColor(u.role)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operador">Operador</SelectItem>
                          <SelectItem value="magistrado">Magistrado</SelectItem>
                          <SelectItem value="consultor">Consultor</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.ativo ? "default" : "secondary"} className={`text-[10px] font-semibold ${u.ativo ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-stone-200 text-stone-500 hover:bg-stone-200'}`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                      {u.ultimoLogin ? formatDate(u.ultimoLogin) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${u.ativo ? 'text-amber-500 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}`}
                            onClick={() => handleToggleActive(u.id, u.ativo)}
                          >
                            {u.ativo ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{u.ativo ? 'Desativar' : 'Ativar'}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md border-stone-200 dark:border-gray-800 text-pgr-text dark:text-gray-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-pgr-primary" />
              Novo Utilizador
            </DialogTitle>
            <DialogDescription>Crie uma nova conta de acesso ao sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Username *</Label>
              <Input
                placeholder="nome.apelido"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase().trim())}
                className="text-sm bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary placeholder:text-stone-400 dark:placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha *</Label>
              <Input
                type="password"
                placeholder="Senha segura"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="text-sm bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary placeholder:text-stone-400 dark:placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome Completo *</Label>
              <Input
                placeholder="Nome completo do utilizador"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                className="text-sm bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary placeholder:text-stone-400 dark:placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email <span className="text-gray-400 font-normal">(para recuperação de senha)</span></Label>
              <Input
                type="email"
                placeholder="seu.email@exemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value.trim())}
                className="text-sm bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary placeholder:text-stone-400 dark:placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Função</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary">
                  <SelectValue placeholder="Selecionar função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="magistrado">Magistrado</SelectItem>
                  <SelectItem value="consultor">Consultor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)} disabled={creating}>Cancelar</Button>
            <Button size="sm" className="bg-[#D35400] hover:bg-[#E67E22]" onClick={handleCreateUser} disabled={creating || !newUsername || !newPassword || !newNome}>
              {creating ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
              {creating ? "A criar..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================== DETAIL VIEW =====================
// ===================== TIMELINE TYPES =====================
interface TimelineEntry {
  id: string;
  type: 'audit' | 'alerta';
  action: string;
  description: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  username: string | null;
  createdAt: string;
}

function DetailView({ arguido }: { arguido: Arguido }) {
  const { toast } = useToast();
  const days1 = getDaysRemaining(arguido.fimPrimeiroPrazo);
  const days2 = getDaysRemaining(arguido.fimSegundoPrazo);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState('outro');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load timeline data when detail view opens
  const loadTimeline = async (arguidoId: number) => {
    try {
      const res = await fetch(`/api/arguidos/${arguidoId}/history`);
      if (res.ok) {
        const data = await res.json();
        if (data.timeline) setTimeline(data.timeline);
      }
    } catch {
      /* non-blocking */
    } finally {
      setTimelineLoading(false);
    }
  };

  // Load documents for this arguido
  const loadDocuments = async (arguidoId: number) => {
    try {
      const res = await fetch(`/api/documents?arguido_id=${arguidoId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data || []);
      }
    } catch {
      /* non-blocking */
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (arguido?.id) {
      loadTimeline(arguido.id);
      loadDocuments(arguido.id);
    }
  }, [arguido?.id]);

  const handleUploadDocument = async () => {
    if (!uploadFile) {
      toast({ title: "Erro", description: "Selecione um ficheiro.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('arguido_id', String(arguido.id));
      formData.append('description', uploadDescription);
      formData.append('category', uploadCategory);
      formData.append('file', uploadFile);
      const res = await fetch('/api/documents', { method: 'POST', body: formData });
      if (res.ok) {
        toast({ title: "Documento anexado", description: uploadFile.name });
        setUploadDialogOpen(false);
        setUploadFile(null);
        setUploadDescription('');
        setUploadCategory('outro');
        loadDocuments(arguido.id);
      } else {
        const err = await res.json();
        toast({ title: "Erro", description: err.error || "Falha ao enviar documento.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao enviar documento.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      const res = await fetch(`/api/documents?id=${docId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: "Documento eliminado" });
        loadDocuments(arguido.id);
      } else {
        toast({ title: "Erro", description: "Falha ao eliminar documento.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao eliminar documento.", variant: "destructive" });
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'mandado': return 'bg-red-100 text-red-700';
      case 'certidao': return 'bg-blue-100 text-blue-700';
      case 'relatorio': return 'bg-green-100 text-green-700';
      default: return 'bg-stone-100 text-stone-600';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'mandado': return 'Mandado';
      case 'certidao': return 'Certidão';
      case 'relatorio': return 'Relatório';
      default: return 'Outro';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-stone-100 rounded-lg">
        <div>
          <p className="text-sm font-bold text-pgr-text dark:text-gray-100">{arguido.numeroId}</p>
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
          <DetailField label="Nome do Arguido" value={arguido.nomeArguido} />
          <DetailField label="Nome do Pai" value={arguido.nomePai || '—'} />
          <DetailField label="Nome da Mãe" value={arguido.nomeMae || '—'} />
          <DetailField label="Data de Detenção" value={formatDate(arguido.dataDetencao)} />
          <DetailField label="Crime" value={arguido.crime} />
          <DetailField label="Magistrado" value={arguido.magistrado} />
        </div>
        <div className="space-y-3">
          <DetailField label="Medidas Aplicadas" value={arguido.medidasAplicadas} />
          <DetailField label="Data das Medidas" value={formatDate(arguido.dataMedidasAplicadas)} />
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

      {/* Timeline - Linha do Tempo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-pgr-primary" />
            Linha do Tempo
          </CardTitle>
          <CardDescription className="text-[11px]">Histórico de alterações, alertas e ações do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {timelineLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-pgr-text-muted" />
              <span className="ml-2 text-xs text-muted-foreground">A carregar histórico...</span>
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 mx-auto mb-2 text-stone-300" />
              <p className="text-xs text-muted-foreground">Sem registos no histórico.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-0">
              {timeline.map((entry, idx) => {
                const isAudit = entry.type === 'audit';
                const dotColor = getTimelineDotColor(entry);
                const iconBg = getTimelineIconBg(entry);
                return (
                  <div key={entry.id} className="flex gap-3 relative">
                    {/* Vertical line */}
                    {idx < timeline.length - 1 && (
                      <div className="absolute left-[15px] top-[32px] bottom-0 w-px bg-stone-200" />
                    )}
                    {/* Dot */}
                    <div className={`relative z-10 mt-1 w-[32px] h-[32px] rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                      {isAudit ? (
                        entry.action === 'criacao' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-700" /> :
                        entry.action === 'remocao' ? <Trash2 className="h-3.5 w-3.5 text-red-600" /> :
                        entry.action === 'status_change' ? <RefreshCw className="h-3.5 w-3.5 text-orange-600" /> :
                        <Edit className="h-3.5 w-3.5 text-blue-600" />
                      ) : (
                        <AlertCircle className={`h-3.5 w-3.5 ${dotColor}`} />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-4 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          isAudit
                            ? entry.action === 'criacao' ? 'bg-green-100 text-green-700'
                              : entry.action === 'remocao' ? 'bg-red-100 text-red-700'
                              : entry.action === 'status_change' ? 'bg-orange-100 text-orange-700'
                              : 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isAudit ? entry.action : 'alerta'}
                        </span>
                        {entry.username && (
                          <span className="text-[10px] text-muted-foreground">por {entry.username}</span>
                        )}
                      </div>
                      <p className="text-xs font-medium mt-0.5 text-pgr-text">{entry.description}</p>
                      {/* Show old/new value for field changes */}
                      {entry.fieldChanged && (entry.oldValue || entry.newValue) && (
                        <div className="mt-1 text-[10px] flex items-center gap-1.5 flex-wrap">
                          <span className="text-muted-foreground">{entry.fieldChanged}:</span>
                          {entry.oldValue && (
                            <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded line-through">{entry.oldValue}</span>
                          )}
                          {entry.oldValue && entry.newValue && <span className="text-stone-300">→</span>}
                          {entry.newValue && (
                            <span className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded font-medium">{entry.newValue}</span>
                          )}
                        </div>
                      )}
                      {/* Alert deadline info */}
                      {!isAudit && entry.oldValue && (
                        <div className="mt-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getDeadlineColor(
                            entry.oldValue.includes('Expirado') ? -1 :
                            entry.oldValue.includes('Vence hoje') ? 0 :
                            entry.oldValue.includes('Crítico') ? 1 :
                            entry.oldValue.includes('Atenção') ? 5 : 30
                          )}`}>
                            {entry.oldValue}
                          </span>
                        </div>
                      )}
                      <p className="text-[10px] text-stone-400 mt-0.5">{formatDate(entry.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentos Anexados */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-pgr-primary" />
                Documentos Anexados
              </CardTitle>
              <CardDescription className="text-[11px]">Ficheiros e documentos associados a este arguido</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Anexar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-pgr-text-muted" />
              <span className="ml-2 text-xs text-muted-foreground">A carregar documentos...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <Paperclip className="h-8 w-8 mx-auto mb-2 text-stone-300" />
              <p className="text-xs text-muted-foreground">Nenhum documento anexado</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-start justify-between gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 h-8 w-8 rounded bg-stone-200 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-stone-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-pgr-text truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getCategoryBadge(doc.category)}`}>
                          {getCategoryLabel(doc.category)}
                        </span>
                        <span className="text-[10px] text-stone-400">{formatFileSize(doc.fileSize)}</span>
                        <span className="text-[10px] text-stone-400">{formatDate(doc.createdAt)}</span>
                      </div>
                      {doc.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{doc.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Descarregar</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteDocument(doc.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Eliminar</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md border-stone-200 dark:border-gray-800 text-pgr-text dark:text-gray-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-pgr-primary" />
              Anexar Documento
            </DialogTitle>
            <DialogDescription>Envie um ficheiro para o processo de {arguido.nomeArguido}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ficheiro *</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.zip"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="text-sm bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary"
              />
              <p className="text-[10px] text-muted-foreground">Tamanho máximo: 10 MB. Formatos: PDF, DOC, XLS, JPG, PNG, TXT, ZIP</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Categoria</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary">
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mandado">Mandado</SelectItem>
                  <SelectItem value="certidao">Certidão</SelectItem>
                  <SelectItem value="relatorio">Relatório</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Descrição</Label>
              <Textarea
                placeholder="Descrição do documento (opcional)"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={3}
                className="text-sm bg-stone-100 dark:bg-gray-800 text-pgr-text dark:text-gray-100 border-stone-200 dark:border-gray-700 focus:border-pgr-primary placeholder:text-stone-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>Cancelar</Button>
            <Button size="sm" className="bg-[#D35400] hover:bg-[#E67E22]" onClick={handleUploadDocument} disabled={uploading || !uploadFile}>
              {uploading ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {uploading ? "A enviar..." : "Anexar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getTimelineDotColor(entry: TimelineEntry): string {
  const action = entry.action.toLowerCase();
  if (action.includes('expirado')) return 'text-red-600';
  if (action.includes('critico')) return 'text-red-500';
  if (action.includes('vence hoje')) return 'text-orange-500';
  return 'text-amber-600';
}

function getTimelineIconBg(entry: TimelineEntry): string {
  if (entry.type === 'audit') {
    switch (entry.action) {
      case 'criacao': return 'bg-green-100';
      case 'remocao': return 'bg-red-100';
      case 'status_change': return 'bg-orange-100';
      default: return 'bg-blue-50';
    }
  }
  // Alert types
  const action = entry.action.toLowerCase();
  if (action.includes('expirado') || action.includes('critico')) return 'bg-red-50 dark:bg-red-900/30';
  if (action.includes('vence hoje')) return 'bg-orange-50 dark:bg-orange-900/30';
  return 'bg-amber-50 dark:bg-amber-900/30';
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-stone-200 dark:border-gray-700">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-xs text-right">{value}</span>
    </div>
  );
}

// ===================== SISTEMA VIEW (Admin: Backup/Restore + System Info) =====================
function SistemaView({ stats }: { stats: DashboardStats | null }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    restored: { arguidos: number; alertas: number; auditLogs: number; documents: number };
    errors?: string[];
  } | null>(null);
  const [sysInfo, setSysInfo] = useState<{
    totalUsers: number;
    dbStatus: string;
  } | null>(null);

  useEffect(() => {
    const loadSysInfo = async () => {
      try {
        const [usersRes, statsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/stats'),
        ]);
        const totalUsers = usersRes.ok ? (await usersRes.json()).length : 0;
        const dbStatus = statsRes.ok ? 'online' : 'erro';
        setSysInfo({ totalUsers, dbStatus });
      } catch {
        setSysInfo({ totalUsers: 0, dbStatus: 'erro' });
      }
    };
    loadSysInfo();
  }, []);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) {
        throw new Error('Erro ao exportar backup');
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = 'backup_pgr.json';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Backup exportado!', description: `Ficheiro: ${filename}` });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao exportar backup.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) {
      toast({ title: 'Erro', description: 'Selecione um ficheiro de backup.', variant: 'destructive' });
      return;
    }
    setRestoring(true);
    setRestoreResult(null);
    try {
      const text = await restoreFile.text();
      const json = JSON.parse(text);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (res.ok) {
        setRestoreResult(data);
        toast({ title: 'Backup restaurado!', description: `${data.restored.arguidos} arguidos, ${data.restored.alertas} alertas restaurados.` });
      } else {
        toast({ title: 'Erro', description: data.error || 'Falha ao restaurar backup.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro', description: 'Ficheiro de backup inválido.', variant: 'destructive' });
    } finally {
      setRestoring(false);
      setRestoreFile(null);
      setRestoreDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-pgr-text dark:text-gray-100">Sistema</h2>
          <p className="text-sm text-muted-foreground">Gestão de backup e informação do sistema</p>
        </div>
      </div>

      {/* System Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-pgr-surface border border-stone-200 pgr-card-hover border-l-4 border-l-stone-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pgr-text-muted font-medium">Total Arguidos</p>
                <p className="text-2xl font-bold text-pgr-text dark:text-gray-100">{stats?.totalArguidos ?? '—'}</p>
              </div>
              <div className="w-10 h-10 bg-pgr-surface rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-pgr-text-muted" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-pgr-surface border border-stone-200 pgr-card-hover border-l-4 border-l-teal-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pgr-text-muted font-medium">Total Utilizadores</p>
                <p className="text-2xl font-bold text-teal-600">{sysInfo?.totalUsers ?? '—'}</p>
              </div>
              <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center">
                <UserCog className="h-5 w-5 text-teal-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-pgr-surface border border-stone-200 pgr-card-hover border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pgr-text-muted font-medium">Base de Dados</p>
                <p className="text-2xl font-bold text-green-600">
                  {sysInfo?.dbStatus === 'online' ? 'Online' : 'Erro'}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup Actions */}
      <Card className="bg-pgr-surface border border-stone-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-pgr-text flex items-center gap-2">
            <Shield className="h-4 w-4" /> Backup e Restauração
          </CardTitle>
          <CardDescription>Exportar ou restaurar dados do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="bg-pgr-primary text-white font-bold hover:opacity-90"
              onClick={handleExportBackup}
              disabled={exporting}
            >
              {exporting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {exporting ? 'A exportar...' : 'Exportar Backup Completo'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setRestoreDialogOpen(true); setRestoreResult(null); }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Restaurar Backup
            </Button>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Atenção:</strong> A restauração irá sobrepor dados existentes. Certifique-se de ter um backup atualizado antes de prosseguir.
            </p>
          </div>

          {/* Restore Results */}
          {restoreResult && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-green-800">Restauração concluída com sucesso:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white rounded-md p-2 text-center">
                  <p className="text-lg font-bold text-pgr-text dark:text-gray-100">{restoreResult.restored.arguidos}</p>
                  <p className="text-xs text-pgr-text-muted">Arguidos</p>
                </div>
                <div className="bg-white rounded-md p-2 text-center">
                  <p className="text-lg font-bold text-pgr-text dark:text-gray-100">{restoreResult.restored.alertas}</p>
                  <p className="text-xs text-pgr-text-muted">Alertas</p>
                </div>
                <div className="bg-white rounded-md p-2 text-center">
                  <p className="text-lg font-bold text-pgr-text dark:text-gray-100">{restoreResult.restored.auditLogs}</p>
                  <p className="text-xs text-pgr-text-muted">Logs de Auditoria</p>
                </div>
                <div className="bg-white rounded-md p-2 text-center">
                  <p className="text-lg font-bold text-pgr-text dark:text-gray-100">{restoreResult.restored.documents}</p>
                  <p className="text-xs text-pgr-text-muted">Documentos</p>
                </div>
              </div>
              {restoreResult.errors && restoreResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-amber-700">Erros ({restoreResult.errors.length}):</p>
                  <ul className="text-xs text-amber-600 list-disc pl-4 mt-1 max-h-32 overflow-y-auto">
                    {restoreResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar Backup</DialogTitle>
            <DialogDescription>
              Selecione o ficheiro JSON de backup para restaurar os dados do sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="backup-file">Ficheiro de Backup (.json)</Label>
              <Input
                id="backup-file"
                type="file"
                accept=".json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                A restauração irá sobrepor dados existentes. Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRestoreDialogOpen(false); setRestoreFile(null); }}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 text-white font-bold hover:bg-red-700"
              onClick={handleRestoreBackup}
              disabled={!restoreFile || restoring}
            >
              {restoring ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {restoring ? 'A restaurar...' : 'Restaurar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Notifications Section */}
      <Card className="bg-pgr-surface border border-stone-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-pgr-text flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notificações por Email
          </CardTitle>
          <CardDescription>Configure alertas automáticos por email para prazos processuais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">Configuração necessária (Gmail SMTP)</p>
              <p className="text-xs mt-1">Adicione estas variáveis de ambiente no Vercel (Settings → Environment Variables):</p>
              <code className="block text-[11px] bg-blue-100 dark:bg-blue-900/50 rounded px-2 py-1 mt-1 font-mono">
                SMTP_GMAIL_USER=seu-email@gmail.com<br/>
                SMTP_GMAIL_APP_PASSWORD=sua-senha-de-app<br/>
                ADMIN_EMAIL=seu-email@gmail.com
              </code>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  toast({ title: 'A verificar configuração de email...' });
                  const res = await fetch('/api/notifications/email');
                  const data = await res.json();
                  if (data.success && data.sent > 0) {
                    toast({ title: 'Email enviado!', description: `${data.sent} alertas processados via ${data.provider}` });
                  } else {
                    toast({ title: 'Info', description: data.message || data.configHint || 'Email não configurado', variant: 'default' });
                  }
                } catch {
                  toast({ title: 'Erro', description: 'Falha ao verificar email.', variant: 'destructive' });
                }
              }}
            >
              <Bell className="h-4 w-4 mr-2" />
              Verificar Alertas de Prazo
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  toast({ title: 'A enviar email de teste...' });
                  const res = await fetch('/api/notifications/email', { method: 'POST' });
                  const data = await res.json();
                  if (data.success) {
                    toast({ title: 'Email de teste enviado!', description: `ID: ${data.emailId} → ${data.sentTo}` });
                  } else {
                    toast({ title: 'Não configurado', description: data.configHint || data.error || 'Configure a API key primeiro.', variant: 'default' });
                  }
                } catch {
                  toast({ title: 'Erro', description: 'Falha ao enviar email de teste.', variant: 'destructive' });
                }
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Enviar Email de Teste
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== ENTRY POINT (Auth gate) =====================
// Auto-skip landing page if URL contains password recovery hash
// (Supabase auth recovery links use #type=recovery&access_token=xxx)
function shouldSkipLanding(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  return !!(hash && hash.includes('type=recovery'));
}

export default function HomePage() {
  const [showLanding, setShowLanding] = useState(() => !shouldSkipLanding());
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
