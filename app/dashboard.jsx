"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createClient } from "../lib/supabase";
import {
  LayoutDashboard, Wallet, Receipt, Target, Sparkles, Plus, Trash2,
  TrendingUp, TrendingDown, X, ArrowUpRight, ArrowDownRight, Send,
  ChevronRight, Building2, PiggyBank, CreditCard, Bitcoin, Home, Banknote,
  Menu,
  LogOut,
  RefreshCw,
  CheckCircle,
  WifiOff,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Palette ─────────────────────────────────────────────────────────────────
const SHEET_ID = "11ZvQbpQTtbayEuhaRXMOGc8QzpiKq69ODVjlxg6zReA";

const INK  = "#1B2A4A";
const GOLD = "#C98A2C";
const GREEN = "#2F6B4F";
const RED   = "#A23B3B";

const ACCOUNT_TYPES = [
  { code:"rrsp",           label:"RRSP",           color:"#1B2A4A", icon:PiggyBank  },
  { code:"tfsa",           label:"TFSA",           color:"#2E6B9E", icon:Wallet     },
  { code:"fhsa",           label:"FHSA",           color:"#4A9E8A", icon:Home       },
  { code:"non_registered", label:"Non-registered", color:"#C98A2C", icon:TrendingUp },
  { code:"cash",           label:"Cash",           color:"#8B9DB8", icon:Banknote   },
  { code:"crypto",         label:"Crypto",         color:"#7A5C8E", icon:Bitcoin    },
  { code:"real_estate",    label:"Real estate",    color:"#6B8F71", icon:Building2  },
  { code:"debt",           label:"Debt",           color:"#A23B3B", icon:CreditCard },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun"];
const TREND  = [88000, 91200, 93500, 96800, 99100, 101200];

const TICKER = [
  { sym:"S&P/TSX", val:"24,812", chg:"+0.6%", up:true  },
  { sym:"S&P 500", val:"5,431",  chg:"+1.2%", up:true  },
  { sym:"Nasdaq",  val:"17,234", chg:"+1.8%", up:true  },
  { sym:"USD/CAD", val:"1.3621", chg:"-0.1%", up:false },
  { sym:"BTC",     val:"$67,210",chg:"+2.4%", up:true  },
];

const INIT_ACCOUNTS = [
  { id:"a1", nickname:"CIBC RRSP",          type:"rrsp",           institution:"CIBC",         balance:48200  },
  { id:"a2", nickname:"Wealthsimple TFSA",  type:"tfsa",           institution:"Wealthsimple", balance:31500  },
  { id:"a3", nickname:"FHSA Savings",       type:"fhsa",           institution:"CIBC",         balance:8000   },
  { id:"a4", nickname:"Questrade Non-Reg",  type:"non_registered", institution:"Questrade",    balance:12400  },
  { id:"a5", nickname:"Everyday Chequing", type:"cash",           institution:"CIBC",         balance:6100   },
  { id:"a6", nickname:"Line of Credit",    type:"debt",           institution:"CIBC",         balance:-9800  },
];

const INIT_TXN = [
  { id:"t1", type:"income",  category:"Salary",        amount:4200, date:"2026-06-01", note:"Biweekly pay"    },
  { id:"t2", type:"income",  category:"Freelance",     amount:600,  date:"2026-06-10", note:"Etsy templates"  },
  { id:"t3", type:"income",  category:"Skip earnings", amount:380,  date:"2026-06-14", note:"Skip the Dishes" },
  { id:"t4", type:"expense", category:"Rent",          amount:1650, date:"2026-06-01", note:""                },
  { id:"t5", type:"expense", category:"Groceries",     amount:410,  date:"2026-06-05", note:""                },
  { id:"t6", type:"expense", category:"Transit",       amount:156,  date:"2026-06-03", note:"Monthly pass"    },
  { id:"t7", type:"expense", category:"Subscriptions", amount:64,   date:"2026-06-02", note:""                },
  { id:"t8", type:"expense", category:"Dining",        amount:220,  date:"2026-06-08", note:""                },
];

const INIT_GOALS = [
  { id:"g1", name:"House down payment", target:40000,  linkedType:"fhsa", emoji:"🏠" },
  { id:"g2", name:"Retire by 58",       target:600000, linkedType:"rrsp", emoji:"🌅" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = n => Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits:0 });
const fmtSigned = n => `${n<0?"-":"+"}$${fmt(n)}`;
const typeInfo = code => ACCOUNT_TYPES.find(t=>t.code===code) || ACCOUNT_TYPES[0];

// ─── UI primitives ────────────────────────────────────────────────────────────
function Card({ children, className="" }) {
  return <div className={`bg-white rounded-2xl border border-black/5 shadow-sm ${className}`}>{children}</div>;
}

function Badge({ color, label }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
      style={{ backgroundColor:`${color}18`, color }}>
      {label}
    </span>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-black/30 hover:text-black/60"><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-black/50 mb-1">{label}</label>}
      <input {...props} className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 bg-white" />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-black/50 mb-1">{label}</label>}
      <select {...props} className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 bg-white">
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Btn({ children, variant="primary", className="", ...props }) {
  const base = "inline-flex items-center gap-1.5 font-medium text-sm px-4 py-2.5 rounded-xl transition-all";
  const styles = {
    primary: `${base} bg-[#1B2A4A] text-white hover:bg-[#2E4374] active:scale-95`,
    ghost:   `${base} text-[#1B2A4A]/60 hover:bg-black/5 active:scale-95`,
  };
  return <button {...props} className={`${styles[variant]} ${className}`}>{children}</button>;
}

// ─── Ticker ───────────────────────────────────────────────────────────────────
function TickerBar() {
  return (
    <div className="bg-[#1B2A4A] text-white text-xs flex items-center gap-6 px-6 py-2 overflow-x-auto no-scrollbar shrink-0">
      {TICKER.map(t=>(
        <div key={t.sym} className="flex items-center gap-2 shrink-0">
          <span className="font-medium text-white/50">{t.sym}</span>
          <span className="font-semibold">{t.val}</span>
          <span className={`font-semibold ${t.up?"text-emerald-400":"text-red-400"}`}>{t.chg}</span>
        </div>
      ))}
      <span className="text-white/30 shrink-0 ml-auto">Live · Jun 18 2026</span>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV = [
  { id:"overview", label:"Overview",    icon:LayoutDashboard },
  { id:"accounts", label:"Accounts",    icon:Wallet          },
  { id:"cashflow", label:"Cashflow",    icon:Receipt         },
  { id:"goals",    label:"Goals",       icon:Target          },
  { id:"insights", label:"AI Insights", icon:Sparkles        },
];

function Sidebar({ page, setPage, open, setOpen, user, onSignOut, onSync, syncing, lastSynced }) {
  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={()=>setOpen(false)}/>}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-56 shrink-0 flex flex-col border-r border-black/5 bg-white
        transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="flex items-center gap-2 px-5 py-5 border-b border-black/5">
          <div className="w-8 h-8 rounded-lg bg-[#1B2A4A] flex items-center justify-center shadow-sm">
            <span className="num text-[#C98A2C] font-bold text-sm">N</span>
          </div>
          <div>
            <p className="font-bold text-sm tracking-tight leading-none">Northledger</p>
            <p className="text-[10px] text-black/40 mt-0.5">Personal finance</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item=>{
            const Icon=item.icon, active=page===item.id;
            return (
              <button key={item.id} onClick={()=>{ setPage(item.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? "bg-[#1B2A4A] text-white shadow-sm" : "text-black/50 hover:text-black hover:bg-black/5"
                }`}>
                <Icon size={16}/>
                <span>{item.label}</span>
                {item.id==="insights" && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#C98A2C]/20 text-[#C98A2C]">AI</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pb-5 space-y-3">
          <button onClick={onSync} disabled={syncing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border border-black/10 text-black/60 hover:bg-black/5 transition-all disabled:opacity-50">
            <RefreshCw size={14} className={syncing?"animate-spin":""}/>
            {syncing ? "Syncing…" : "Sync Google Sheets"}
          </button>
          {lastSynced && <p className="text-[10px] text-black/35 text-center">Last synced {lastSynced.toLocaleTimeString()}</p>}
          <div className="rounded-xl bg-gradient-to-br from-[#C98A2C]/15 to-[#C98A2C]/5 border border-[#C98A2C]/20 p-3">
            <p className="text-xs font-bold text-[#C98A2C]">Free plan</p>
            <p className="text-xs text-black/50 mt-0.5 leading-snug">Upgrade for live sync & unlimited history</p>
            <button className="mt-2 text-xs font-semibold text-[#C98A2C] flex items-center gap-1">
              Upgrade <ChevronRight size={12}/>
            </button>
          </div>
          {user && (
            <div className="border-t border-black/5 pt-3">
              <p className="text-xs font-medium text-black/50 truncate px-1 mb-2">{user.email}</p>
              <button onClick={onSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-black/50 hover:text-red-500 hover:bg-red-50 transition-all">
                <LogOut size={15}/> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewPage({ accounts, transactions, goals }) {
  const assets   = accounts.filter(a=>a.balance>0).reduce((s,a)=>s+a.balance,0);
  const liabs    = accounts.filter(a=>a.balance<0).reduce((s,a)=>s+Math.abs(a.balance),0);
  const nw       = assets - liabs;
  const prev     = TREND[TREND.length-1];
  const chg      = nw - prev;
  const chgPct   = ((chg/prev)*100).toFixed(1);
  const income   = transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expenses = transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const savRate  = income>0 ? Math.round(((income-expenses)/income)*100) : 0;

  const grouped = ACCOUNT_TYPES
    .map(t=>({ ...t, value:accounts.filter(a=>a.type===t.code&&a.balance>0).reduce((s,a)=>s+a.balance,0) }))
    .filter(g=>g.value>0);

  const trendData = [...TREND.map((v,i)=>({ m:MONTHS[i], v })), { m:"Jun*", v:nw }];

  return (
    <div className="space-y-6">
      {/* Hero net worth */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-black/40 mb-2">Total net worth · CAD</p>
        <div className="flex flex-wrap items-end gap-4">
          <h1 className="num text-5xl md:text-6xl font-semibold tabular-nums tracking-tight">${fmt(nw)}</h1>
          <div className={`flex items-center gap-1 pb-1 text-sm font-semibold ${chg>=0?"text-emerald-600":"text-red-500"}`}>
            {chg>=0?<ArrowUpRight size={16}/>:<ArrowDownRight size={16}/>}
            {fmtSigned(chg)} ({Math.abs(chgPct)}%) this month
          </div>
        </div>

        {/* Composition bar */}
        <div className="mt-5 flex h-2.5 rounded-full overflow-hidden gap-px w-full max-w-2xl">
          {grouped.map(g=>(
            <div key={g.code} style={{ width:`${(g.value/assets)*100}%`, backgroundColor:g.color }}
              className="first:rounded-l-full last:rounded-r-full" title={g.label}/>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {grouped.map(g=>(
            <div key={g.code} className="flex items-center gap-1.5 text-xs font-medium text-black/60">
              <span className="w-2 h-2 rounded-full" style={{backgroundColor:g.color}}/>
              {g.label} · <span className="font-semibold text-black/80">${fmt(g.value)}</span>
            </div>
          ))}
          {liabs>0 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500"/>
              Debt · <span className="font-semibold">${fmt(liabs)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-sm">Net worth trend</p>
            <span className="text-xs text-black/35">Jan – Jun 2026</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={trendData}>
              <XAxis dataKey="m" tick={{fontSize:11,fill:"#1B2A4A80"}} axisLine={false} tickLine={false}/>
              <YAxis hide domain={["auto","auto"]}/>
              <Tooltip
                formatter={v=>[`$${Number(v).toLocaleString()}`,"Net worth"]}
                contentStyle={{fontSize:12,border:"none",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,.1)"}}
                labelStyle={{fontWeight:600}}
              />
              <Line type="monotone" dataKey="v" stroke={GOLD} strokeWidth={2.5} dot={false}
                activeDot={{r:4,fill:GOLD}}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
          <Card className="p-5 bg-[#1B2A4A] text-white">
            <p className="text-xs font-semibold text-white/50 mb-2">Savings rate</p>
            <p className="num text-4xl font-semibold">{savRate}%</p>
            <p className="text-xs text-white/40 mt-1">of income · Jun</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold text-black/50 mb-1">Monthly surplus</p>
            <p className="num text-2xl font-semibold text-emerald-600">${fmt(income-expenses)}</p>
            <p className="text-xs text-black/40 mt-1">${fmt(income)} in · ${fmt(expenses)} out</p>
          </Card>
        </div>
      </div>

      {/* Goals + news */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="font-semibold text-sm flex items-center gap-1.5 mb-4"><Target size={14}/> Goals</p>
          <div className="space-y-4">
            {goals.map(g=>{
              const cur = accounts.filter(a=>a.type===g.linkedType).reduce((s,a)=>s+Math.max(0,a.balance),0);
              const pct = Math.min(100,(cur/g.target)*100);
              return (
                <div key={g.id}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium">{g.emoji} {g.name}</span>
                    <span className="text-xs text-black/45 tabular-nums">${fmt(cur)} / ${fmt(g.target)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                    <div className="h-full rounded-full bg-[#C98A2C]" style={{width:`${pct}%`}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <p className="font-semibold text-sm flex items-center gap-1.5 mb-4"><Sparkles size={14}/> Market pulse</p>
          <div className="space-y-3">
            {[
              { tag:"Indexes", headline:"Nasdaq up 1.2% on strong tech earnings",   time:"2h ago" },
              { tag:"Rates",   headline:"Bank of Canada holds rate at 2.75%",        time:"5h ago" },
              { tag:"FX",      headline:"CAD gains slightly vs USD on oil prices",   time:"1d ago" },
            ].map((n,i)=>(
              <div key={i} className={`pb-3 ${i<2?"border-b border-black/5":""}`}>
                <Badge color={GOLD} label={n.tag}/>
                <p className="text-sm font-medium leading-snug mt-1">{n.headline}</p>
                <p className="text-xs text-black/35 mt-0.5">{n.time}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Accounts ─────────────────────────────────────────────────────────────────
function AccountsPage({ accounts, setAccounts }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nickname:"", type:"rrsp", institution:"", balance:"" });
  const f = k => e => setForm({...form,[k]:e.target.value});

  const totalAssets = accounts.filter(a=>a.balance>0).reduce((s,a)=>s+a.balance,0);
  const totalLiabs  = accounts.filter(a=>a.balance<0).reduce((s,a)=>s+Math.abs(a.balance),0);

  function save() {
    if(!form.nickname||!form.balance) return;
    const bal = form.type==="debt" ? -Math.abs(Number(form.balance)) : Number(form.balance);
    setAccounts([...accounts,{ id:`a${Date.now()}`, nickname:form.nickname, type:form.type, institution:form.institution, balance:bal }]);
    setForm({ nickname:"", type:"rrsp", institution:"", balance:"" });
    setOpen(false);
  }

  const groups = ACCOUNT_TYPES
    .map(t=>({ ...t, items:accounts.filter(a=>a.type===t.code) }))
    .filter(g=>g.items.length>0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-black/45 mt-0.5">Assets ${fmt(totalAssets)} · Liabilities ${fmt(totalLiabs)}</p>
        </div>
        <Btn onClick={()=>setOpen(true)}><Plus size={15}/>Add account</Btn>
      </div>

      <div className="space-y-4">
        {groups.map(g=>{
          const Icon=g.icon;
          return (
            <Card key={g.code} className="overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-black/5" style={{backgroundColor:`${g.color}08`}}>
                <Icon size={14} style={{color:g.color}}/>
                <span className="text-xs font-bold uppercase tracking-widest" style={{color:g.color}}>{g.label}</span>
                <span className="ml-auto text-xs font-semibold text-black/50">
                  ${fmt(g.items.reduce((s,a)=>s+a.balance,0))}
                </span>
              </div>
              {g.items.map((a,i)=>(
                <div key={a.id} className={`flex items-center justify-between px-5 py-4 ${i<g.items.length-1?"border-b border-black/5":""}`}>
                  <div>
                    <p className="font-medium text-sm">{a.nickname}</p>
                    <p className="text-xs text-black/40 mt-0.5">{a.institution}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`num font-semibold tabular-nums ${a.balance<0?"text-red-500":""}`}>
                      {a.balance<0?"-":""}${fmt(a.balance)}
                    </span>
                    <button onClick={()=>setAccounts(accounts.filter(x=>x.id!==a.id))}
                      className="text-black/20 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </Card>
          );
        })}
        {accounts.length===0 && (
          <Card className="py-16 text-center">
            <Wallet size={32} className="mx-auto text-black/20 mb-3"/>
            <p className="font-medium text-black/40">No accounts yet</p>
            <p className="text-sm text-black/30 mt-1">Add your first account to start tracking</p>
          </Card>
        )}
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title="Add account">
        <div className="space-y-3">
          <Input label="Nickname" placeholder="e.g. CIBC RRSP" value={form.nickname} onChange={f("nickname")}/>
          <Select label="Account type" value={form.type} onChange={f("type")}
            options={ACCOUNT_TYPES.map(t=>({value:t.code,label:t.label}))}/>
          <Input label="Institution" placeholder="e.g. CIBC, Questrade" value={form.institution} onChange={f("institution")}/>
          <Input label="Current balance (CAD)" type="number" placeholder="0.00" value={form.balance} onChange={f("balance")}/>
          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" onClick={()=>setOpen(false)} className="flex-1 justify-center">Cancel</Btn>
            <Btn onClick={save} className="flex-1 justify-center">Save account</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Cashflow ─────────────────────────────────────────────────────────────────
const EXPENSE_CATS = ["Rent","Groceries","Transit","Dining","Subscriptions","Utilities","Insurance","Entertainment","Health","Other"];
const INCOME_CATS  = ["Salary","Freelance","Skip earnings","Dividends","Interest","Other"];

function CashflowPage({ transactions, setTransactions }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type:"expense", category:"Rent", amount:"", date:"2026-06-18", note:"" });
  const f = k => e => setForm({...form,[k]:e.target.value});

  const income   = transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expenses = transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);

  const byCategory = useMemo(()=>{
    const map={};
    transactions.filter(t=>t.type==="expense").forEach(t=>{ map[t.category]=(map[t.category]||0)+t.amount; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[transactions]);

  function save() {
    if(!form.amount) return;
    setTransactions([{ id:`t${Date.now()}`, ...form, amount:Number(form.amount) }, ...transactions]);
    setForm({ type:"expense", category:"Rent", amount:"", date:"2026-06-18", note:"" });
    setOpen(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cashflow</h1>
          <p className="text-sm text-black/45 mt-0.5">June 2026</p>
        </div>
        <Btn onClick={()=>setOpen(true)}><Plus size={15}/>Add entry</Btn>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:"Income",   val:income,          color:GREEN },
          { label:"Expenses", val:expenses,         color:RED   },
          { label:"Surplus",  val:income-expenses,  color:INK   },
        ].map(c=>(
          <Card key={c.label} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-black/40 mb-2">{c.label}</p>
            <p className="num text-2xl md:text-3xl font-semibold tabular-nums" style={{color:c.color}}>${fmt(c.val)}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-black/5">
            <p className="font-semibold text-sm">Recent transactions</p>
          </div>
          {transactions.slice(0,8).map((t,i)=>(
            <div key={t.id} className={`flex items-center justify-between px-5 py-3.5 ${i<7?"border-b border-black/5":""}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  t.type==="income"?"bg-emerald-50 text-emerald-600":"bg-red-50 text-red-500"}`}>
                  {t.type==="income"?"+":"-"}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.category}</p>
                  <p className="text-xs text-black/35">{t.date}</p>
                </div>
              </div>
              <span className={`tabular-nums font-semibold text-sm ${t.type==="income"?"text-emerald-600":"text-red-500"}`}>
                {t.type==="income"?"+":"-"}${fmt(t.amount)}
              </span>
            </div>
          ))}
        </Card>

        <Card className="p-5">
          <p className="font-semibold text-sm mb-4">Spending breakdown</p>
          <div className="space-y-3.5">
            {byCategory.map(([cat,amt])=>(
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{cat}</span>
                  <span className="tabular-nums text-black/50">${fmt(amt)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full rounded-full bg-[#C98A2C]" style={{width:`${(amt/expenses)*100}%`}}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title="Add transaction">
        <div className="space-y-3">
          <Select label="Type" value={form.type}
            onChange={e=>setForm({...form,type:e.target.value,category:e.target.value==="expense"?"Rent":"Salary"})}
            options={[{value:"income",label:"Income"},{value:"expense",label:"Expense"}]}/>
          <Select label="Category" value={form.category} onChange={f("category")}
            options={(form.type==="expense"?EXPENSE_CATS:INCOME_CATS).map(c=>({value:c,label:c}))}/>
          <Input label="Amount (CAD)" type="number" placeholder="0.00" value={form.amount} onChange={f("amount")}/>
          <Input label="Date" type="date" value={form.date} onChange={f("date")}/>
          <Input label="Note (optional)" placeholder="e.g. Monthly pass" value={form.note} onChange={f("note")}/>
          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" onClick={()=>setOpen(false)} className="flex-1 justify-center">Cancel</Btn>
            <Btn onClick={save} className="flex-1 justify-center">Save</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────
const GOAL_EMOJIS = ["🏠","🌅","🚗","✈️","🎓","💍","🏖️","💻","🏋️","🌱"];

function GoalsPage({ goals, setGoals, accounts }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", target:"", linkedType:"rrsp", emoji:"🏠" });
  const f = k => e => setForm({...form,[k]:e.target.value});

  function save() {
    if(!form.name||!form.target) return;
    setGoals([...goals,{ id:`g${Date.now()}`, ...form, target:Number(form.target) }]);
    setForm({ name:"", target:"", linkedType:"rrsp", emoji:"🏠" });
    setOpen(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
          <p className="text-sm text-black/45 mt-0.5">Track your financial targets</p>
        </div>
        <Btn onClick={()=>setOpen(true)}><Plus size={15}/>Add goal</Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map(g=>{
          const cur = accounts.filter(a=>a.type===g.linkedType).reduce((s,a)=>s+Math.max(0,a.balance),0);
          const pct = Math.min(100,(cur/g.target)*100);
          const ti  = typeInfo(g.linkedType);
          return (
            <Card key={g.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-2xl">{g.emoji}</span>
                  <h3 className="font-semibold text-base mt-1">{g.name}</h3>
                  <Badge color={ti.color} label={ti.label}/>
                </div>
                <button onClick={()=>setGoals(goals.filter(x=>x.id!==g.id))}
                  className="text-black/20 hover:text-red-400 transition-colors mt-1"><Trash2 size={14}/></button>
              </div>
              <div className="mb-3">
                <div className="flex justify-between mb-2">
                  <span className="num text-2xl font-semibold">${fmt(cur)}</span>
                  <span className="text-black/40 text-sm self-end">of ${fmt(g.target)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{width:`${pct}%`,backgroundColor:ti.color}}/>
                </div>
              </div>
              <div className="flex justify-between text-xs text-black/40">
                <span>{pct.toFixed(0)}% complete</span>
                <span>${fmt(g.target-cur)} remaining</span>
              </div>
            </Card>
          );
        })}
        {goals.length===0 && (
          <div className="col-span-2">
            <Card className="py-16 text-center">
              <Target size={32} className="mx-auto text-black/20 mb-3"/>
              <p className="font-medium text-black/40">No goals yet</p>
              <p className="text-sm text-black/30 mt-1">Set a target to start tracking progress</p>
            </Card>
          </div>
        )}
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title="Add goal">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-black/50 mb-1">Pick an emoji</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_EMOJIS.map(e=>(
                <button key={e} onClick={()=>setForm({...form,emoji:e})}
                  className={`w-9 h-9 rounded-lg text-lg transition-all ${form.emoji===e?"bg-[#1B2A4A]/10 ring-2 ring-[#1B2A4A]":"hover:bg-black/5"}`}>{e}</button>
              ))}
            </div>
          </div>
          <Input label="Goal name" placeholder="e.g. House down payment" value={form.name} onChange={f("name")}/>
          <Input label="Target amount (CAD)" type="number" placeholder="0.00" value={form.target} onChange={f("target")}/>
          <Select label="Linked account type" value={form.linkedType} onChange={f("linkedType")}
            options={ACCOUNT_TYPES.filter(t=>t.code!=="debt").map(t=>({value:t.code,label:t.label}))}/>
          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" onClick={()=>setOpen(false)} className="flex-1 justify-center">Cancel</Btn>
            <Btn onClick={save} className="flex-1 justify-center">Save goal</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── AI Insights ──────────────────────────────────────────────────────────────
function InsightsPage({ accounts, transactions, goals }) {
  const [messages, setMessages] = useState([{
    role:"assistant",
    content:"Hi! I'm your Northledger assistant. I have your full financial picture — accounts, cashflow, goals. Ask me anything and I'll give you direct, specific answers."
  }]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const assets   = accounts.filter(a=>a.balance>0).reduce((s,a)=>s+a.balance,0);
  const liabs    = accounts.filter(a=>a.balance<0).reduce((s,a)=>s+Math.abs(a.balance),0);
  const income   = transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expenses = transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);

  const systemPrompt = `
You are a personal finance assistant for a Canadian user. Here is their current data:

NET WORTH: $${fmt(assets-liabs)} CAD (Assets: $${fmt(assets)}, Liabilities: $${fmt(liabs)})

ACCOUNTS:
${accounts.map(a=>`- ${a.nickname} (${typeInfo(a.type).label}): ${a.balance<0?"-":""}$${fmt(a.balance)} CAD`).join("\n")}

CASHFLOW (June 2026):
- Income: $${fmt(income)} | Expenses: $${fmt(expenses)} | Surplus: $${fmt(income-expenses)}
- Savings rate: ${income>0?Math.round(((income-expenses)/income)*100):0}%
- Transactions: ${transactions.map(t=>`${t.category} ${t.type==="income"?"+":"-"}$${fmt(t.amount)}`).join(", ")}

GOALS:
${goals.map(g=>{
  const cur=accounts.filter(a=>a.type===g.linkedType).reduce((s,a)=>s+Math.max(0,a.balance),0);
  return `- ${g.name}: $${fmt(cur)} of $${fmt(g.target)} (${Math.min(100,(cur/g.target)*100).toFixed(0)}%)`;
}).join("\n")}

MARKET CONTEXT (June 18 2026):
- Bank of Canada rate: 2.75% (held)
- S&P/TSX: 24,812 (+0.6%) | S&P 500: 5,431 (+1.2%) | USD/CAD: 1.3621

Give direct, specific, confident advice based on these actual numbers. Be conversational but precise. 2-4 sentences unless more detail is needed.
  `.trim();

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  async function send(text) {
    const q = (text||input).trim();
    if(!q||loading) return;
    setInput("");
    const next = [...messages,{role:"user",content:q}];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/chat",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ system:systemPrompt, messages:next.map(m=>({role:m.role,content:m.content})) })
      });
      const data = await res.json();
      setMessages([...next,{role:"assistant",content:data.reply||"Sorry, couldn't get a response."}]);
    } catch {
      setMessages([...next,{role:"assistant",content:"Couldn't reach AI right now. Try again in a moment."}]);
    }
    setLoading(false);
  }

  const suggestions = [
    "Am I on track to retire by 58?",
    `Best use of my $${fmt(income-expenses)} surplus?`,
    "How does the BoC rate hold affect my line of credit?",
    "Where should I focus savings this month?",
  ];

  return (
    <div className="flex flex-col" style={{height:"calc(100vh - 8rem)"}}>
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles size={20} className="text-[#C98A2C]"/> AI Insights
        </h1>
        <p className="text-sm text-black/45 mt-0.5">Powered by Claude · Has full context of your finances</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m,i)=>(
            <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
              {m.role==="assistant" && (
                <div className="w-7 h-7 rounded-full bg-[#1B2A4A] flex items-center justify-center mr-2 mt-0.5 shrink-0">
                  <Sparkles size={12} className="text-[#C98A2C]"/>
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role==="user"
                  ? "bg-[#1B2A4A] text-white rounded-br-sm"
                  : "bg-gray-50 text-[#1B2A4A] rounded-bl-sm border border-black/5"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-[#1B2A4A] flex items-center justify-center mr-2 shrink-0">
                <Sparkles size={12} className="text-[#C98A2C]"/>
              </div>
              <div className="bg-gray-50 border border-black/5 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-5">
                  {[0,1,2].map(i=>(
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#C98A2C] animate-bounce-dot"
                      style={{animationDelay:`${i*150}ms`}}/>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        <div className="border-t border-black/5 p-4 shrink-0">
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestions.map(s=>(
              <button key={s} onClick={()=>send(s)} disabled={loading}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-black/10 text-black/60 hover:bg-black/5 disabled:opacity-40 transition-all">
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
              placeholder="Ask about your finances…"
              disabled={loading}
              className="flex-1 bg-white border border-black/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 disabled:opacity-50"/>
            <button onClick={()=>send()} disabled={!input.trim()||loading}
              className="bg-[#1B2A4A] text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#2E4374] transition-colors disabled:opacity-40 active:scale-95">
              <Send size={16}/>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [page,setPage]                 = useState("overview");
  const [accounts,setAccounts]         = useState(INIT_ACCOUNTS);
  const [transactions,setTransactions] = useState(INIT_TXN);
  const [goals,setGoals]               = useState(INIT_GOALS);
  const [sidebarOpen,setSidebarOpen]   = useState(false);
  const [user,setUser]                 = useState(null);
  const [syncStatus,setSyncStatus]     = useState("idle");
  const [lastSynced,setLastSynced]     = useState(null);

  useEffect(()=>{
    const supabase = createClient();
    supabase.auth.getUser().then(({data})=>setUser(data.user));
    syncFromSheets();
  },[]);

  async function syncFromSheets() {
    setSyncStatus("syncing");
    try {
      const res  = await fetch(`/api/sheets?id=11ZvQbpQTtbayEuhaRXMOGc8QzpiKq69ODVjlxg6zReA`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.transactions?.length > 0) setTransactions(data.transactions);
      if (data.balances?.length > 0) {
        setAccounts(prev => prev.map(acc => {
          const match = data.balances.find(b =>
            b.account.toLowerCase().includes(acc.institution.toLowerCase()) ||
            acc.nickname.toLowerCase().includes(b.account.toLowerCase())
          );
          return match ? { ...acc, balance: match.balance } : acc;
        }));
      }
      setLastSynced(new Date());
      setSyncStatus("success");
      setTimeout(()=>setSyncStatus("idle"), 3000);
    } catch(e) {
      console.error("Sheets sync failed:", e);
      setSyncStatus("error");
      setTimeout(()=>setSyncStatus("idle"), 5000);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex flex-col h-screen bg-white text-[#1B2A4A] overflow-hidden">
      <TickerBar/>

      {/* Sync status bar */}
      {syncStatus !== "idle" && (
        <div className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium ${
          syncStatus==="syncing" ? "bg-blue-50 text-blue-600" :
          syncStatus==="success" ? "bg-emerald-50 text-emerald-600" :
          "bg-red-50 text-red-500"}`}>
          {syncStatus==="syncing" && <><RefreshCw size={12} className="animate-spin"/> Syncing from Google Sheets…</>}
          {syncStatus==="success" && <><CheckCircle size={12}/> Synced — your real data is loaded</>}
          {syncStatus==="error"   && <><WifiOff size={12}/> Sync failed — showing demo data. <button onClick={syncFromSheets} className="underline ml-1">Retry</button></>}
        </div>
      )}

      {/* Mobile top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5 md:hidden">
        <button onClick={()=>setSidebarOpen(true)} className="text-black/50 hover:text-black">
          <Menu size={20}/>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#1B2A4A] flex items-center justify-center">
            <span className="num text-[#C98A2C] font-bold text-xs">N</span>
          </div>
          <span className="font-bold text-sm">Vaultly</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar page={page} setPage={setPage} open={sidebarOpen} setOpen={setSidebarOpen} user={user} onSignOut={handleSignOut} onSync={syncFromSheets} syncing={syncStatus==="syncing"} lastSynced={lastSynced}/>
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-7">
          {page==="overview" && <OverviewPage  accounts={accounts} transactions={transactions} goals={goals}/>}
          {page==="accounts" && <AccountsPage  accounts={accounts} setAccounts={setAccounts}/>}
          {page==="cashflow" && <CashflowPage  transactions={transactions} setTransactions={setTransactions}/>}
          {page==="goals"    && <GoalsPage     goals={goals} setGoals={setGoals} accounts={accounts}/>}
          {page==="insights" && <InsightsPage  accounts={accounts} transactions={transactions} goals={goals}/>}
        </main>
      </div>
    </div>
  );
}
