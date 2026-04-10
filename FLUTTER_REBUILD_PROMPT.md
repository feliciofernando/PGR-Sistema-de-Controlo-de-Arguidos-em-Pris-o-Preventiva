# PGR ANGOLA — Flutter Desktop App Rebuild Prompt

## VISÃO GERAL DO PROJECTO

Construir uma aplicação Flutter **desktop** (Windows/Mac/Linux) clone do sistema web **"PGR Angola - Sistema de Controlo de Arguidos em Prisão Preventiva"** da Procuradoria-Geral da República de Angola.

**Arquitectura:** Flutter Desktop + Supabase (backend) + PDF client-side (syncfusion_pdf ou pdf)
**Estilo Visual:** Profissional, institucional (governo), tema quente stone/orange, moderno mas sério.
**Idioma da UI:** Português (Angola)

---

## 1. TEMA VISUAL E DESIGN SYSTEM

### Cores Principais (Light Theme)
```
Background geral:      #f7f6f3 (cinza quente/crú)
Superfície/Cards:      #ffffff
Bordas:                #e5e2db / #e7e5e4
Cor Primária:          #c2410c (laranja PGR escuro)
Cor Primária Light:    #ea580c
Cor Primária Dark:     #9a3412
Texto principal:       #1c1917 (stone-900)
Texto secundário:      #57534e (stone-600)
Texto muted:           #a8a29e (stone-400)
Destructive:           #dc2626
Success (verde):       #28A745
Warning (amarelo):     #FFC107 / #f0ad4e
Info/Azul:             #1c3d5a
```

### Cores de Status
```
Ativo:     background #1c3d5a, texto branco
Vencido:   background #a10000, texto branco
Encerrado: background #9ca3af (gray-400), texto branco
```

### Cores de Prazos (Badges)
```
Vencido (dias < 0):     background #d9534f, texto branco, bold
Crítico (dias ≤ 3):     background #d9534f, texto branco, bold
Atenção (dias ≤ 7):     background #f0ad4e, texto branco, bold
Normal (dias > 7):      background #5cb85c, texto branco, bold
Sem prazo:              background #e5e7eb (gray-200), texto #4b5563
```

### Cores dos Gráficos (Chart)
```
Chart 1: #c2410c (laranja PGR)
Chart 2: #16a34a (verde)
Chart 3: #d97706 (amarelo)
Chart 4: #dc2626 (vermelho)
Chart 5: #78716c (cinza)
Cores adicionais pie chart: #374151, #FFD700, #28A745, #DC3545, #FFC107, #6c757d, #17a2b8, #e83e8c
```

### Tipografia
- Fonte principal: "Segoe UI", "Inter", system-ui (semelhante no Flutter: usar `GoogleFonts.inter()` ou fontes system default)
- Títulos: bold/semibold
- Corpo: regular
- Muted text: 12-13px
- Labels: 14px semibold
- Títulos de secção: 24px bold

### Cards
- Background: white
- Borda: 1px stone-200
- Border-radius: 8px (0.5rem)
- Hover effect: sombra + translateY(-1px) com animação 0.15s
- Cards KPI no dashboard têm border-left colorido (4px): stone, green, red, amber

### Scrollbar customizada
- Largura: 6px
- Track: transparent
- Thumb: #d6d3d1, hover: #a8a29e, border-radius: 3px

---

## 2. ESTRUTURA DA APLICAÇÃO (5 ECRÃS + Login + Dialogs)

### 2.1 Login Page
- Card centralizado (max-width 448px), sombra 2xl
- Ícone da balança (Scale/⚖️) dentro de quadrado laranja arredondado (64x64) com shadow
- Título: "PGR ANGOLA" (bold, 20px)
- Subtítulo: "Sistema de Controlo de Arguidos em Prisão Preventiva" (14px, muted)
- Campo "Utilizador" (Input text)
- Campo "Senha" (Input password)
- Botão "Entrar no Sistema" (laranja, full-width, h-44px)
- Mensagem de erro em banner vermelho com ícone AlertCircle
- Loading: spinner + "A verificar..."
- Footer: "Acesso restrito e monitorizado — Procuradoria-Geral da República de Angola" (11px, muted, center)

### 2.2 Layout Principal (após login)
```
┌─────────────────────────────────────────────────────┐
│ HEADER / NAVBAR (sticky top)                         │
│ [Painel] [Cadastro] [Gestão] [Alertas] [Relatórios]  🔔│
├─────────────────────────────────────────────────────┤
│                                                      │
│ MAIN CONTENT (scrollable, max-width 1600px centered) │
│                                                      │
│                                                      │
│                                                      │
├─────────────────────────────────────────────────────┤
│ FOOTER: © 2024 PGR Angola — Sistema de Controlo...  │
└─────────────────────────────────────────────────────┘
```

**Navbar:**
- 5 tabs com ícones + texto: Painel (LayoutDashboard), Cadastro (UserPlus), Gestão (Users), Alertas (Bell com badge count), Relatórios (BarChart3)
- Tab activa: background laranja, texto branco, shadow, border-bottom 3px
- Tab inactiva: texto stone, hover: bg-stone-100
- Ícone sino (🔔) no lado direito: verde quando push activo, com dot verde
- Em mobile: tabs horizontais scrolláveis com ícone + label em coluna

**Footer:**
- Background: stone-200
- Ícone Gavel + texto "© 2024 Procuradoria-Geral da República de Angola — Sistema de Controlo de Arguidos em Prisão Preventiva"
- Botão "Ativar alertas no dispositivo" (se push não subscrito)

### 2.3 Ecrã: PAINEL (Dashboard)

**Cabeçalho:**
- Título "Painel" (24px bold)
- Subtítulo "Visão geral do sistema de controlo" (14px muted)
- Botões à direita: "Novo Cadastro" (outline), "Ver Todos" (laranja)

**KPI Cards (grid 2x2 em mobile, 4 colunas em desktop):**
1. **Total Arguidos** — ícone Users, border-left stone, valor grande + label muted
2. **Ativos** — ícone CheckCircle, border-left green, valor verde
3. **Vencidos** — ícone AlertCircle, border-left red, valor vermelho
4. **Alertas** — ícone Bell, border-left amber, valor amber

**Linha 2 (3 cards):**
1. **Taxa de Conformidade** — percentual grande (colorido: green ≥80%, yellow ≥50%, red <50%) + Progress bar + label "Dos prazos dentro do limite"
2. **Distribuição por Status** — Gráfico Pie (donut, innerRadius 35, outerRadius 60) com cores [#28A745, #DC3545, #6c757d] para ativo/vencido/encerrado. Legenda abaixo.
3. **Casos por Crime** — Gráfico Bar horizontal (top 7 crimes), cor #374151, radius [0,4,4,0]

**Linha 3:**
- **Evolução Mensal de Casos** — Gráfico Line, cor #374151, strokeWidth 2, dots #374151. Mostra últimos 6 meses. Apenas mostra se houver dados.

**Linha 4 (condicional):**
- **Processos com Prazo Próximo** — Tabela com header sticky (bg-stone-700, texto branco):
  - Colunas: Prazo | Nome / Processo | Crime (hidden md) | Tipo (hidden sm) | Vencimento (right)
  - Badge de prazo colorido (VENCIDO ou D-N dias)
  - Linhas alternadas (stone-50 / stone-100)
  - Clicável → abre Detail Dialog

### 2.4 Ecrã: CADASTRO (Novo Arguido)

**Formulário com 3 secções:**

**Secção 1: Dados Pessoais e Processuais** (ícone FileText)
- Nº Processo * (text input, placeholder "Ex: PGR-2024-001")
- Nome do Arguido * (text input)
- Data de Detenção (date picker)
- Crime (dropdown + input para "Outro")
  - Lista: Homicídio, Roubo, Furto, Tráfico de drogas, Corrupção, Fraude, Lavagem de dinheiro, Sequestro, Trafico de armas, Crime informático, Abuso de poder, Peculato, Outros

**Secção 2: Datas e Prazos Processuais** (ícone Calendar)
- Medidas Aplicadas (dropdown)
  - Lista: Prisão Preventiva, Prisão Domiciliaria, Liberdade Provisória, Obrigação de Permanência, Suspensão de Funções
- Data das Medidas Aplicadas (date) — nota: "1º prazo será calculado automaticamente (+3 meses)"
- Data de Remessa ao JG (date)
- Data de Regresso (date)
- Data de Remessa ao SIC (date)
- Magistrado Responsável (text)

**Secção 3: Prorrogação 2º Prazo** (ícone Clock)
- Data de Prorrogação (date)
- Duração da Prorrogação em meses (number, 0-12) — nota: "2º prazo = Data Prorrogação + Duração"
- **Box amarelo informativo** mostrando prazos calculados automaticamente

**Secção 4: Observações** (ícone FileText)
- Remessa ao JG / Alteração (textarea, 3 rows)
- Status (dropdown: Ativo, Vencido, Encerrado)
- Observação 1 (textarea, 2 rows)
- Observação 2 (textarea, 2 rows)

**Acções:** "Limpar Formulário" (outline) + "Cadastrar Arguido" (laranja, ícone UserPlus)

### 2.5 Ecrã: GESTÃO DE ARGUIDOS

**Cabeçalho:** Título + total de registos + botões (Refresh, Exportar CSV, Novo)

**Barra de Filtros (Card):**
- Search input (com ícone lupa à esquerda): "Pesquisar por nome, Nº processo ou ID..."
- Dropdown Status: Todos, Ativo, Vencido, Encerrado
- Dropdown Prazo: Todos, Vencido, Crítico, Atenção, Normal

**Tabela Principal (max-height 500px, scroll):**
Header sticky (bg-stone-700, texto branco):
| ID (mono) | Nº Processo | Nome | Crime (hidden md) | Magistrado (hidden lg) | 1º Prazo (badge colorido) | Status (badge) | Ações (right) |

**Ações por row:**
- 👁️ Ver (Eye) → abre Detail Dialog
- ✏️ Editar (Edit) → abre Form Dialog em modo edit
- 📄 PDF (FileDown, cor laranja) → gera e descarrega PDF
- 🗑️ Eliminar (Trash2, vermelho) → abre AlertDialog confirmação

**Paginação:** "Página X de Y (N registos)" + botões prev/next + números de página (max 5 visíveis)

### 2.6 Ecrã: ALERTAS

**Cabeçalho:** Título + total alertas + botões "Testar Notificação" + "Verificar Prazos"

**Summary Cards (grid 2x2):**
1. Críticos (bg-red-50, border-red-200, texto red-500)
2. Atenção (bg-amber-50, border-amber-200, texto amber-600)
3. Vencidos (bg-red-800/15, border-red-800/30, texto red-500)
4. Normal (bg-green-500/15, border-green-500/30, texto green-600)

**Histórico de Alertas (Tabela, max-height 500px):**
Header sticky (bg-stone-700):
| Prazo (badge) | Tipo | Mensagem | Canal (hidden sm) | Data (right) | 👁️ |
- Linhas alternadas, clicáveis → abre Detail do arguido

**Regras de Alerta (Card com 3 colunas):**
- 🔴 Vencido: "Notificação imediata, registo de não conformidade"
- 🟠 Crítico: "Alerta prioritário, destaque máximo"
- 🟡 Atenção: "Alerta preventivo, acompanhamento diário"

### 2.7 Ecrã: RELATÓRIOS E ANALYTICS

**Summary Cards (4):** Total Registados | Ativos | Vencidos | Prazos Próximos

**Gráficos (grid 2 colunas):**
1. **Distribuição por Crime** — Pie chart com labels "{name} ({percent}%)", 8 cores
2. **Carga por Magistrado** — Bar chart vertical (top 8), cor #374151, labels rotacionados -20°

**Evolução Mensal (full width):** Line chart, "Novos Casos", últimos 6 meses

**Resumo por Crime (Tabela, max-height 400px):**
| Crime | Total | % do Total |

---

## 3. DIALOGS E OVERLAYS

### 3.1 Form Dialog (Create/Edit)
- Max-width 4xl, max-height 90vh, scrollable
- Header: ícone UserPlus + "Novo Cadastro" ou "Editar Arguido"
- Corpo: FormFields (mesmo formulário do Cadastro)
- Footer: "Cancelar" (outline) + "Cadastrar" / "Salvar Alterações" (laranja)

### 3.2 Detail Dialog
- Max-width 4xl, max-height 90vh, scrollable
- Header: ícone Eye + "Detalhes do Arguido — {numeroId}"
- **Header card:** numeroId, nome (grande), processo, badge status
- **Deadline cards (2 colunas):** 1º Prazo (3 meses) e 2º Prazo (Prorrogação) com data, badge colorido, border vermelho se ≤3 dias
- **Details grid (2 colunas):** Data Detenção, Crime, Medidas, Data Medidas, Magistrado | Remessa JG, Regresso, Remessa SIC, Prorrogação, Cadastrado em
- **Observações card** (condicional): Remessa JG/Alteração, Obs1, Obs2
- Footer: "Fechar" + "PDF" (outline laranja) + "Eliminar" (destructive) + "Editar" (laranja)

### 3.3 Delete Confirmation (AlertDialog)
- Ícone AlertTriangle (vermelho)
- Título: "Confirmar Eliminação"
- Mensagem: "Tem a certeza que deseja eliminar este registo? Esta acção é irreversível."
- Botões: "Cancelar" + "Eliminar" (vermelho)

### 3.4 In-App Notification Overlay (no login/splash)
- Fullscreen backdrop (bg-black/30)
- Card flutuante (max-width sm, rounded-2xl, shadow-2xl)
- Animação: slideInAppNotification (0.4s ease-out)
- Header: bg laranja, ícone Scale, "PGR ANGOLA", "Resumo de Alertas do Sistema"
- Urgency bar: vermelho com shimmer animation (se urgente), amber (se não)
- 4 linhas de resumo com icones:
  - 🔴 X Prazo(s) Expirado(s) — bg-red-500/10
  - 🟠 X Caso(s) Crítico(s) — bg-orange-50
  - 🟡 X Caso(s) em estado de Atenção — bg-amber-50
  - 🟢 X Caso(s) Normal — bg-emerald-50
- Total de Casos
- Botões: "Ver Alertas" (vermelho se urgente, laranja se não) + "Fechar"
- Pulsing red dot (se urgente)

---

## 4. BACKEND / API (Supabase)

### 4.1 Credenciais Supabase
```
URL: https://tuzwhphlmaqdljdhztuy.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1endocGhsbWFxZGxqZGh6dHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjgwMTAsImV4cCI6MjA5MDE0NDAxMH0.S9eykBwv4iJcy8wuwR34ICdvEhKlUe1wPV0gl1SKzBM
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1endocGhsbWFxZGxqZGh6dHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU2ODAxMCwiZXhwIjoyMDkwMTQ0MDEwfQ.KxKWsbywICA3-QdKeahFBhFwBvuAWGaszblTriq8sYs
```

### 4.2 Tabelas Supabase

**Tabela `arguidos`:**
| Coluna (snake_case) | Tipo | Descrição |
|---|---|---|
| id | bigint (PK, auto) | ID interno |
| numero_id | varchar | ID público formato "PGR-XXXX" |
| numero_processo | varchar | Nº do processo |
| nome_arguido | varchar | Nome completo |
| data_detencao | date (nullable) | Data de detenção |
| crime | varchar | Tipo de crime |
| data_remessa_jg | date (nullable) | Remessa ao Juiz de Garantias |
| data_regresso | date (nullable) | Data de regresso |
| medidas_aplicadas | varchar | Tipo de medida |
| data_medidas_aplicadas | date (nullable) | Data aplicação medidas |
| data_remessa_sic | date (nullable) | Remessa ao SIC |
| fim_primeiro_prazo | date (nullable) | = data_medidas_aplicadas + 3 meses |
| data_prorrogacao | date (nullable) | Data da prorrogação |
| duracao_prorrogacao | integer (default 0) | Meses da prorrogação |
| fim_segundo_prazo | date (nullable) | = data_prorrogacao + duracao |
| magistrado | varchar | Magistrado responsável |
| remessa_jg_alteracao | text | Histórico de alterações |
| obs1 | text | Observação 1 |
| obs2 | text | Observação 2 |
| status | varchar (default 'ativo') | ativo / vencido / encerrado |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

**Tabela `alertas`:**
| Coluna (snake_case) | Tipo | Descrição |
|---|---|---|
| id | bigint (PK, auto) | ID |
| arguido_id | bigint (FK → arguidos.id) | Arguido |
| tipo_alerta | varchar | "primeiro_prazo" ou "segundo_prazo" |
| dias_restantes | integer | Dias até vencimento |
| mensagem | text | Mensagem do alerta |
| canal_envio | varchar | "sistema" |
| status_envio | varchar | "pendente" ou "enviado" |
| data_disparo | timestamptz | Data do alerta |
| data_leitura | timestamptz (nullable) | Data leitura |
| created_at | timestamptz | Auto |

**Tabela `system_users`:**
| Coluna | Tipo | Descrição |
|---|---|---|
| id | bigint (PK, auto) | ID |
| username | varchar | Utilizador (unique) |
| nome | varchar | Nome completo |
| role | varchar | Papel |
| password_hash | varchar | Hash bcrypt |
| ativo | boolean | Conta activa |
| ultimo_login | timestamptz (nullable) | Último login |
| login_count | integer | Total de logins |

**Tabela `push_subscriptions`:**
| Coluna | Tipo |
|---|---|
| endpoint | text (PK) |
| p256dh_key | text |
| auth_key | text |
| user_agent | text (nullable) |

### 4.3 API Endpoints (recriar em Flutter usando supabase_flutter diretamente)

**Autenticação:**
- `POST /api/auth/login` — Body: `{username, password}` → valida contra `system_users` com bcrypt. Retorna `{success, user: {id, username, nome, role}}`. Rate limiting: 5 tentativas/5min, lockout 15min.
  - **No Flutter:** Usar `supabase_flutter` para query directa à tabela `system_users`, validar senha com `bcrypt` package localmente.

**CRUD Arguidos:**
- `GET /api/arguidos?search=&status=&prazoFilter=&page=&pageSize=&sortBy=created_at&sortOrder=desc` → Lista com search multi-campo (nome, numero_processo, numero_id), filtros, paginação. Prazo filter aplicado in-memory.
- `POST /api/arguidos` — Cria arguido. Auto-gera `numero_id` formato `PGR-XXXX`. Calcula `fim_primeiro_prazo` = data_medidas + 3 meses, `fim_segundo_prazo` = data_prorrogacao + duracao.
- `GET /api/arguidos/{id}` — Busca arguido com alertas relacionados (select `*, alertas(*)`)
- `PUT /api/arguidos/{id}` — Update parcial, recalcula prazos.
- `DELETE /api/arguidos/{id}` — Elimina registo.

**Estatísticas:**
- `GET /api/stats` → Dashboard stats: totalArguidos, ativos, vencidos, encerrados, totalAlertas, alertasPendentes, prazosProximos, prazosCriticos, processosUrgentes[], crimes[], magistrados[], monthlyCounts{}, statusCounts[].
  - Categorias de prazo: próximo (≤7 dias), crítico (≤3 dias), urgente (≤7 dias na tabela)

**Alertas:**
- `GET /api/alertas?arguidoId=&statusEnvio=&limit=` — Lista com join arguido
- `POST /api/alertas` — Cria alerta OU verifica prazos (`{action: "check"}`)
  - **checkDeadlines:** Scaneia todos arguidos ativos, cria alertas para prazos ≤7 dias (sem duplicados por dia), marca expired como "vencido", envia push notifications

**Push Notifications:**
- `POST /api/push/subscribe` — Regista push subscription
- `DELETE /api/push/subscribe?endpoint=` — Remove subscription
- `GET /api/push/notify-alertas` — Categoriza todos arguidos (expirados, criticos, atencao, normal), envia push com summary, retorna dados

### 4.4 Mapeamento camelCase ↔ snake_case
O app usa camelCase no frontend e snake_case na BD. Funções helper:
```dart
String toSnake(String str) => str.replaceAllMapped(RegExp(r'[A-Z]'), (m) => '_${m[0]!.toLowerCase()}');
String toCamel(String str) => str.replaceAllMapped(RegExp(r'_([a-z])'), (m) => m[1]!.toUpperCase());
```

---

## 5. LÓGICA DE NEGÓCIO

### 5.1 Cálculo de Prazos
- **1º Prazo:** `data_medidas_aplicadas + 3 meses` (calculado automaticamente)
- **2º Prazo:** `data_prorrogacao + duracao_prorrogacao` meses (se preenchido)
- **Auto-ID:** `PGR-{count+1 com 4 dígitos}` (ex: PGR-0001, PGR-0042)

### 5.2 Cálculo de Dias Restantes
```dart
int? getDaysRemaining(DateTime? deadline) {
  if (deadline == null) return null;
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final target = DateTime(deadline.year, deadline.month, deadline.day);
  return (target.difference(today).inDays).ceil();
}
```

### 5.3 Categorização de Urgência
```
dias < 0   → EXPIRADO (vermelho, badge "VENCIDO")
dias = 0   → VENCE HOJE! (vermelho)
dias = 1   → VENCE AMANHÃ! (vermelho)
dias ≤ 3   → CRÍTICO (vermelho)
dias ≤ 7   → ATENÇÃO (amarelo)
dias > 7   → NORMAL (verde)
sem prazo  → SEM PRAZO (cinza)
```

### 5.4 Taxa de Conformidade
```
conformidade = ((ativos - prazosCriticos) / ativos) * 100
```
- ≥80%: verde, 50-79%: amarelo, <50%: vermelho

### 5.5 Verificação de Prazos (checkDeadlines)
1. Buscar todos arguidos com status "ativo"
2. Para cada prazo (1º e 2º), calcular dias restantes
3. Se dias ≤ 7 e dias ≥ 0: verificar se alerta já existe para este arguido+tipo+dias nas últimas 24h
4. Se não existe: criar alerta com mensagem categorizada
5. Se dias = 0: marcar arguido como "vencido"
6. Enviar push notifications para alertas críticos (dias ≤ 1)

### 5.6 Formato de Data
- Locale: pt-AO
- Formato: "dd/MM/yyyy"
- Placeholder para null: "—"

---

## 6. FUNCIONALIDADES ESPECÍFICAS

### 6.1 Exportação CSV
- Headers: ID, Nº Processo, Nome, Crime, Magistrado, Medidas, Fim 1º Prazo, Fim 2º Prazo, Status
- Todos os valores entre aspas, separados por vírgula
- Nome do ficheiro: `arguidos_pgr_{YYYY-MM-DD}.csv`

### 6.2 Geração de PDF (Ficha do Arguido)
- **Cliente-side** (não precisa de backend)
- PDF profissional com cabeçalho PGR
- Conteúdo: todos os campos do arguido, prazos calculados, badges de status
- Nome do ficheiro: `Ficha_{numeroId}_{nome_sanitizado}.pdf`
- Em Flutter usar `syncfusion_flutter_pdf` ou `pdf` package

### 6.3 Sistema de Alertas/Notificações
No desktop Flutter, em vez de push notifications web:
- **Notificação in-app:** Overlay/banner no startup com resumo de alertas
- **Notificações do sistema:** Usar `local_notifications` package para notificações desktop
- **Alarme sonoro:** Usar Web Audio API equivalent (audioplayers package) com beep de alerta
  - Urgente: triple beep 880Hz square wave
  - Atenção: single ping 660Hz sine wave

### 6.4 Paginação
- Page size: 15 registos
- Mostrar: "Página X de Y (N registos)"
- Máximo 5 botões de página visíveis
- Botões prev/next sempre visíveis

---

## 7. MODELO DE DADOS (Dart Classes)

```dart
class Arguido {
  final int id;
  final String numeroId;
  final String numeroProcesso;
  final String nomeArguido;
  final DateTime? dataDetencao;
  final String crime;
  final DateTime? dataRemessaJg;
  final DateTime? dataRegresso;
  final String medidasAplicadas;
  final DateTime? dataMedidasAplicadas;
  final DateTime? dataRemessaSic;
  final DateTime? fimPrimeiroPrazo;
  final DateTime? dataProrrogacao;
  final int duracaoProrrogacao;
  final DateTime? fimSegundoPrazo;
  final String magistrado;
  final String remessaJgAlteracao;
  final String obs1;
  final String obs2;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<AlertaItem>? alertas;
}

class AlertaItem {
  final int id;
  final int arguidoId;
  final String tipoAlerta;
  final int diasRestantes;
  final String mensagem;
  final String canalEnvio;
  final String statusEnvio;
  final DateTime dataDisparo;
  final DateTime? dataLeitura;
  final DateTime createdAt;
  final ArguidoMini? arguido; // {numeroId, numeroProcesso, nomeArguido}
}

class DashboardStats {
  final int totalArguidos;
  final int ativos;
  final int vencidos;
  final int encerrados;
  final int totalAlertas;
  final int alertasPendentes;
  final int prazosProximos;
  final int prazosCriticos;
  final List<ProcessoUrgente> processosUrgentes;
  final List<CrimeCount> crimes;
  final List<MagistradoCount> magistrados;
  final Map<String, int> monthlyCounts;
  final List<StatusCount> statusCounts;
}

class User {
  final int id;
  final String username;
  final String nome;
  final String role;
}
```

---

## 8. PACOTES FLUTTER RECOMENDADOS

```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.8.0      # Supabase client
  provider: ^6.1.0              # State management
  http: ^1.2.0                  # HTTP requests (alternativa)
  bcrypt: ^1.1.3                # Password verification
  syncfusion_flutter_pdf: ^25.0.0  # PDF generation (client-side)
  syncfusion_flutter_charts: ^25.0.0 # Charts (Pie, Bar, Line)
  intl: ^0.19.0                 # Date formatting, locales
  file_picker: ^8.0.0           # CSV save location
  path_provider: ^2.1.0         # File paths
  local_notifications: ^17.0.0  # Desktop notifications
  audioplayers: ^6.0.0          # Alert sounds
  shared_preferences: ^2.2.0    # Local persistence (login state)
  uuid: ^4.4.0                  # Unique IDs
  csv: ^6.0.0                   # CSV export
  google_fonts: ^6.2.0          # Fonts
  flutter_hooks: ^0.20.0        # Hooks (optional)
  window_manager: ^0.4.0        # Desktop window config
```

---

## 9. ESTRUTURA DE PASTAS RECOMENDADA

```
lib/
├── main.dart                    # Entry point, app config
├── app.dart                     # MaterialApp, routes, theme
├── theme/
│   ├── app_theme.dart           # ThemeData, colors, text styles
│   └── app_colors.dart          # Color constants
├── models/
│   ├── arguido.dart             # Arguido model
│   ├── alerta.dart              # AlertaItem model
│   ├── dashboard_stats.dart     # DashboardStats model
│   ├── user.dart                # User model
│   └── converters.dart          # camelCase/snake_case, date utils
├── services/
│   ├── supabase_service.dart    # Supabase client init & queries
│   ├── auth_service.dart        # Login, rate limiting, session
│   ├── arguidos_service.dart    # CRUD arguidos
│   ├── alertas_service.dart     # Alert management & deadline checking
│   ├── stats_service.dart       # Dashboard statistics
│   ├── pdf_service.dart         # PDF generation
│   ├── csv_service.dart         # CSV export
│   └── notification_service.dart # Desktop notifications & sounds
├── providers/
│   ├── auth_provider.dart       # Auth state
│   ├── arguidos_provider.dart   # Arguidos state & filters
│   ├── stats_provider.dart      # Stats state
│   └── alertas_provider.dart    # Alertas state
├── screens/
│   ├── login_screen.dart        # Login page
│   ├── main_shell.dart          # Layout with navbar, content, footer
│   ├── dashboard_screen.dart    # Dashboard/KPI view
│   ├── cadastro_screen.dart     # New arguido form
│   ├── gestao_screen.dart       # Arguidos table with filters
│   ├── alertas_screen.dart      # Alert system view
│   └── relatorios_screen.dart   # Reports & analytics
├── widgets/
│   ├── kpi_card.dart            # KPI stat card
│   ├── deadline_badge.dart      # Color-coded deadline badge
│   ├── status_badge.dart        # Status badge (ativo/vencido/encerrado)
│   ├── arguido_form.dart        # Reusable form fields
│   ├── arguido_detail.dart      # Detail view
│   ├── alert_notification_overlay.dart  # In-app notification popup
│   ├── delete_confirm_dialog.dart       # Delete confirmation
│   ├── form_dialog.dart         # Create/Edit form dialog
│   ├── detail_dialog.dart       # View detail dialog
│   ├── data_table.dart          # Reusable data table
│   ├── pagination.dart          # Pagination controls
│   ├── search_bar.dart          # Search input with icon
│   ├── filter_bar.dart          # Status/Prazo filters
│   └── conformidade_card.dart   # Conformidade percentage card
└── utils/
    ├── date_helpers.dart        # formatDate, getDaysRemaining, etc.
    ├── constants.dart           # CRIMES_LIST, MEDIDAS_LIST
    └── validators.dart          # Form validation
```

---

## 10. REGRAS DE NEGÓCIO ADICIONAIS

### 10.1 Validações
- Nome do arguido é obrigatório (não pode estar vazio)
- Username max 50 chars, password max 100 chars
- Duracao prorrogacao: 0-12 meses
- Status: apenas "ativo", "vencido", "encerrado"

### 10.2 Rate Limiting (Login)
- 5 tentativas por IP em janela de 5 minutos
- Lockout de 15 minutos após exceder
- Reset em login bem-sucedido

### 10.3 Auto-Ações
- Login bem-sucedido: actualizar `ultimo_login` e incrementar `login_count`
- Criação de arguido: auto-gerar numeroId (PGR-XXXX), calcular prazos
- Edição: recalcular prazos se datas forem alteradas
- Verificação de prazos: criar alertas, marcar vencidos, enviar notificações
- Na inicialização do app: verificar prazos automaticamente e mostrar notificação in-app

### 10.4 Persistência de Login
No web original, login fica apenas em memória React (perde ao refresh).
Para desktop Flutter: **guardar sessão localmente** usando `shared_preferences` para melhor UX.

---

## 11. FLUXO DA APLICAÇÃO

```
1. App启动 → Verifica sessão guardada (shared_preferences)
2. Se sem sessão → LoginScreen
3. Login válido → MainShell (navbar + content)
4. Auto: Verificar prazos → mostrar NotificationOverlay se houver alertas
5. Default view: Dashboard (Painel)
6. Navegação via tabs no navbar
7. CRUD de arguidos via dialogs
8. PDF gerado client-side ao clicar botão
9. CSV export ao clicar Exportar
10. Alertas verificados manualmente ou automaticamente
```

---

## 12. NOTAS ESPECIAIS PARA DESKTOP

### Window Manager Config
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await windowManager.ensureInitialized();
  windowManager.setMinimumSize(Size(1024, 700));
  windowManager.setSize(Size(1400, 900));
  windowManager.setTitle('PGR Angola — Sistema de Controlo de Arguidos');
  windowManager.center();
  runApp(const PgrApp());
}
```

### Responsividade
- Min width: 1024px (desktop)
- Layout adaptativo: usar LayoutBuilder ou MediaQuery para grid columns
- Tables com colunas responsivas (hidden em widths menores)

### Atalhos de Teclado
- Ctrl+N: Novo cadastro
- Ctrl+E: Exportar CSV
- Ctrl+F: Focus na barra de pesquisa
- Escape: Fechar dialogs
